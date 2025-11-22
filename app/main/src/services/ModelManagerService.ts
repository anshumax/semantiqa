import { promises as fs } from 'node:fs';
import { createReadStream, createWriteStream } from 'node:fs';
import { join, dirname } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { app } from 'electron';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import type { 
  ModelsListResponse,
  ModelsDownloadRequest,
  ModelsEnableRequest,
  ModelsHealthcheckResponse,
  ModelManifestEntry,
  SemantiqaError 
} from '@semantiqa/contracts';
import type { Database as BetterSqliteDatabase } from 'better-sqlite3';

type LoadModelManifestFn = typeof import('../../../../core/dist/models').loadModelManifest;
let loadModelManifestRef: LoadModelManifestFn | null = null;

async function getLoadModelManifest(): Promise<LoadModelManifestFn> {
  if (!loadModelManifestRef) {
    const moduleUrl = pathToFileURL(join(__dirname, '../../../../core/dist/models.js')).href;
    const dynamicImport = new Function('specifier', 'return import(specifier);') as (specifier: string) => Promise<
      typeof import('../../../../core/dist/models')
    >;
    const module = await dynamicImport(moduleUrl);
    loadModelManifestRef = module.loadModelManifest;
  }
  return loadModelManifestRef;
}

export interface ModelManagerDeps {
  openSourcesDb: () => BetterSqliteDatabase;
  audit: (event: {
    action: string;
    modelId?: string;
    status: 'success' | 'failure';
    details?: Record<string, unknown>;
  }) => void;
  logger: {
    info(message: string, meta?: Record<string, unknown>): void;
    warn(message: string, meta?: Record<string, unknown>): void;
    error(message: string, meta?: Record<string, unknown>): void;
  };
  emitProgress?: (event: string, payload: unknown) => void;
}

interface InstalledModel {
  id: string;
  name: string;
  kind: 'embedding' | 'generator';
  sizeMb: number;
  license: string;
  sha256: string;
  installedAt: string;
  enabledTasks: ('summaries' | 'nlsql')[];
  path?: string;
  description?: string;
}

export class ModelManagerService {
  private modelsDir: string;

  constructor(private readonly deps: ModelManagerDeps) {
    this.modelsDir = join(app.getPath('userData'), 'models');
  }

  async listModels(): Promise<ModelsListResponse | SemantiqaError> {
    const { openSourcesDb, logger, audit } = this.deps;

    try {
      logger.info('Loading model manifest and installed models');
      audit({ action: 'models.list.started', status: 'success' });

      // Load available models from manifest
      const loadModelManifest = await getLoadModelManifest();
      const available = await loadModelManifest();
      logger.info(`Loaded ${available.length} models from manifest`);

      // Load installed models from database
      const installed = await this.getInstalledModels(openSourcesDb());

      audit({ 
        action: 'models.list.completed', 
        status: 'success',
        details: { available: available.length, installed: installed.length }
      });

      // Filter out installed models from available list
      const installedIds = new Set(installed.map(m => m.id));
      const availableOnly = available.filter((model: any) => !installedIds.has(model.id));

      return {
        installed: installed.map(model => ({
          id: model.id,
          name: model.name,
          kind: model.kind,
          sizeMb: model.sizeMb,
          license: model.license,
          sha256: model.sha256,
          description: model.description,
          tasks: model.kind === 'embedding' ? [] : ['summaries', 'nlsql'] as const,
          installedAt: model.installedAt,
          enabledTasks: model.enabledTasks,
          path: model.path,
        })),
        available: availableOnly.map((model: any) => ({
          id: model.id,
          name: model.name,
          kind: model.kind,
          sizeMb: model.sizeMb,
          license: model.license,
          sha256: model.sha256,
          description: model.description,
          tasks: model.kind === 'embedding' ? [] : ['summaries', 'nlsql'] as const,
        }))
      };
    } catch (error) {
      logger.error('Failed to list models', { error });
      audit({ 
        action: 'models.list.failed', 
        status: 'failure',
        details: { error: (error as Error).message }
      });

      return {
        code: 'INTERNAL_ERROR',
        message: 'Failed to load model list',
        details: { error: (error as Error).message }
      };
    }
  }

  async downloadModel(request: ModelsDownloadRequest): Promise<{ ok: true } | SemantiqaError> {
    const { logger, audit, openSourcesDb } = this.deps;

    try {
      logger.info('Download model requested', { modelId: request.id });
      audit({ action: 'models.download.started', modelId: request.id, status: 'success' });

      // Ensure models directory exists
      await this.ensureModelsDir();

      // Load manifest to get model details
      const loadModelManifest = await getLoadModelManifest();
      const manifest = await loadModelManifest();
      const modelEntry = manifest.find(m => m.id === request.id);
      
      if (!modelEntry) {
        logger.warn('Model not found in manifest', { modelId: request.id });
        return {
          code: 'NOT_FOUND',
          message: 'Model not found in manifest',
          details: { modelId: request.id }
        };
      }

      // Get the raw manifest to access download URL
      const manifestRaw = await this.loadRawManifest();
      const modelRaw = manifestRaw.models.find((m: any) => m.id === request.id);
      
      if (!modelRaw?.url) {
        logger.error('Model URL not found in manifest', { modelId: request.id });
        return {
          code: 'INTERNAL_ERROR',
          message: 'Model download URL not configured',
          details: { modelId: request.id }
        };
      }

      const downloadUrl = modelRaw.url;
      const modelFileName = `${request.id}.model`;
      const tempPath = join(this.modelsDir, `${modelFileName}.download`);
      const finalPath = join(this.modelsDir, modelFileName);

      logger.info('Starting model download', { 
        modelId: request.id, 
        url: downloadUrl,
        expectedSize: modelEntry.sizeMb 
      });

      // Download with resumable support
      const downloadedPath = await this.downloadWithResume(
        downloadUrl,
        tempPath,
        modelEntry.sizeMb,
        logger,
        5,
        request.id
      );

      // Verify SHA256 checksum (skip if placeholder)
      if (modelEntry.sha256 !== 'skip-verification') {
        logger.info('Verifying model checksum', { modelId: request.id });
        const actualHash = await this.computeSHA256(downloadedPath);
        
        if (actualHash !== modelEntry.sha256) {
          logger.error('Checksum mismatch', { 
            modelId: request.id, 
            expected: modelEntry.sha256, 
            actual: actualHash 
          });
          
          // Clean up invalid download
          await fs.unlink(downloadedPath).catch(() => {});
          
          return {
            code: 'VALIDATION_ERROR',
            message: 'Downloaded model failed SHA256 verification',
            details: { 
              modelId: request.id,
              expected: modelEntry.sha256,
              actual: actualHash
            }
          };
        }
      } else {
        logger.warn('Skipping checksum verification (placeholder SHA256)', { modelId: request.id });
      }

      logger.info('Checksum verified successfully', { modelId: request.id });

      // Move to final location
      await fs.rename(downloadedPath, finalPath);

      // Register in database
      const db = openSourcesDb();
      const now = new Date().toISOString();
      
      db.prepare(`
        INSERT INTO models (id, name, kind, size_mb, license, path, sha256, enabled_tasks, installed_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          path = excluded.path,
          installed_at = excluded.installed_at,
          updated_at = excluded.updated_at
      `).run(
        modelEntry.id,
        modelEntry.name,
        modelEntry.kind,
        modelEntry.sizeMb,
        modelEntry.license,
        finalPath,
        modelEntry.sha256,
        JSON.stringify(modelEntry.kind === 'generator' ? ['summaries', 'nlsql'] : []),
        now,
        now
      );

      logger.info('Model downloaded and registered successfully', { 
        modelId: request.id,
        path: finalPath 
      });
      
      audit({ 
        action: 'models.download.completed', 
        modelId: request.id, 
        status: 'success',
        details: { path: finalPath, size: modelEntry.sizeMb }
      });

      return { ok: true };
    } catch (error) {
      logger.error('Model download failed', { modelId: request.id, error });
      audit({ 
        action: 'models.download.failed', 
        modelId: request.id,
        status: 'failure',
        details: { error: (error as Error).message }
      });

      return {
        code: 'INTERNAL_ERROR',
        message: 'Failed to download model',
        details: { error: (error as Error).message }
      };
    }
  }

  private async loadRawManifest(): Promise<{ version: string; models: any[] }> {
    const candidates = [
      join(process.cwd(), 'models', 'models.json'),
      join(__dirname, '..', '..', '..', '..', 'models', 'models.json'),
      join(__dirname, '..', '..', '..', '..', 'core', 'models', 'models.json'),
    ];

    for (const pathCandidate of candidates) {
      try {
        const raw = await fs.readFile(pathCandidate, 'utf-8');
        return JSON.parse(raw);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          throw error;
        }
      }
    }

    throw new Error(`Model manifest not found. Looked in: ${candidates.join(', ')}`);
  }

  private async downloadWithResume(
    url: string,
    destPath: string,
    expectedSizeMb: number,
    logger: ModelManagerDeps['logger'],
    maxRedirects: number = 5,
    modelId?: string
  ): Promise<string> {
    // Check if partial download exists
    let startByte = 0;
    try {
      const stats = await fs.stat(destPath);
      startByte = stats.size;
      logger.info('Resuming download from byte', { startByte });
    } catch {
      // File doesn't exist, start from beginning
    }

    return new Promise((resolve, reject) => {
      const https = require('https');
      const http = require('http');
      
      const makeRequest = (currentUrl: string, redirectCount: number) => {
        if (redirectCount > maxRedirects) {
          reject(new Error('Too many redirects'));
          return;
        }

        const protocol = currentUrl.startsWith('https') ? https : http;
        const options = {
          headers: startByte > 0 ? { 'Range': `bytes=${startByte}-` } : {}
        };

        const request = protocol.get(currentUrl, options, (response: any) => {
          // Handle redirects (301, 302, 303, 307, 308)
          if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
            logger.info('Following redirect', { 
              from: currentUrl, 
              to: response.headers.location,
              statusCode: response.statusCode 
            });
            makeRequest(response.headers.location, redirectCount + 1);
            return;
          }

          if (response.statusCode === 416) {
            // Range not satisfiable - file already complete
            logger.info('File already downloaded');
            resolve(destPath);
            return;
          }

          if (response.statusCode !== 200 && response.statusCode !== 206) {
            reject(new Error(`Download failed with status ${response.statusCode}`));
            return;
          }

          const fileStream = createWriteStream(destPath, { flags: startByte > 0 ? 'a' : 'w' });
          let downloaded = startByte;
          const totalSize = expectedSizeMb * 1024 * 1024;

          // Emit initial progress
          if (modelId && this.deps.emitProgress) {
            this.deps.emitProgress('models:download:progress', {
              modelId,
              downloadedMb: Math.round(downloaded / (1024 * 1024)),
              totalMb: Math.round(totalSize / (1024 * 1024)),
              progress: Math.round((downloaded / totalSize) * 100),
              status: 'downloading'
            });
          }

          let lastProgressEmit = 0;
          
          response.on('data', (chunk: Buffer) => {
            downloaded += chunk.length;
            const progress = Math.round((downloaded / totalSize) * 100);
            
            // Emit progress event every 1MB
            const downloadedMb = Math.round(downloaded / (1024 * 1024));
            if (modelId && this.deps.emitProgress && downloadedMb > lastProgressEmit) {
              lastProgressEmit = downloadedMb;
              this.deps.emitProgress('models:download:progress', {
                modelId,
                downloadedMb,
                totalMb: Math.round(totalSize / (1024 * 1024)),
                progress,
                status: 'downloading'
              });
              logger.info('Progress event emitted', { downloadedMb, progress: `${progress}%` });
            }
            
            if (downloaded % (10 * 1024 * 1024) < chunk.length) { // Log every 10MB
              logger.info('Download progress', { 
                downloadedMb: Math.round(downloaded / (1024 * 1024)), 
                totalMb: Math.round(totalSize / (1024 * 1024)),
                progress: `${progress}%` 
              });
            }
          });

          response.pipe(fileStream);

          fileStream.on('finish', () => {
            fileStream.close();
            logger.info('Download completed');
            
            // Emit completion event
            if (modelId && this.deps.emitProgress) {
              this.deps.emitProgress('models:download:progress', {
                modelId,
                downloadedMb: Math.round(totalSize / (1024 * 1024)),
                totalMb: Math.round(totalSize / (1024 * 1024)),
                progress: 100,
                status: 'completed'
              });
            }
            
            resolve(destPath);
          });

          fileStream.on('error', (err: Error) => {
            fs.unlink(destPath).catch(() => {});
            
            // Emit error event
            if (modelId && this.deps.emitProgress) {
              this.deps.emitProgress('models:download:progress', {
                modelId,
                progress: 0,
                status: 'error',
                error: err.message
              });
            }
            
            reject(err);
          });
        });

        request.on('error', (err: Error) => {
          // Emit error event
          if (modelId && this.deps.emitProgress) {
            this.deps.emitProgress('models:download:progress', {
              modelId,
              progress: 0,
              status: 'error',
              error: err.message
            });
          }
          reject(err);
        });

        // No timeout - downloads can take as long as needed
        // The connection will naturally fail if there's a network issue
      };

      makeRequest(url, 0);
    });
  }

  private async computeSHA256(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = createHash('sha256');
      const stream = createReadStream(filePath);

      stream.on('data', (data) => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  async enableModel(request: ModelsEnableRequest): Promise<{ ok: true } | SemantiqaError> {
    const { openSourcesDb, logger, audit } = this.deps;

    try {
      logger.info('Enable model requested', { modelId: request.id, tasks: request.tasks });
      audit({ 
        action: 'models.enable.started', 
        modelId: request.id, 
        status: 'success',
        details: { tasks: request.tasks }
      });

      const db = openSourcesDb();
      
      // Check if model exists and is installed
      const existing = db.prepare(`
        SELECT id FROM models WHERE id = ?
      `).get(request.id) as { id: string } | undefined;

      if (!existing) {
        logger.warn('Attempted to enable non-existent model', { modelId: request.id });
        return {
          code: 'NOT_FOUND',
          message: 'Model not found or not installed',
          details: { modelId: request.id }
        };
      }

      // Update enabled tasks
      db.prepare(`
        UPDATE models 
        SET enabled_tasks = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(JSON.stringify(request.tasks), request.id);

      logger.info('Model enabled successfully', { modelId: request.id, tasks: request.tasks });
      audit({ 
        action: 'models.enable.completed', 
        modelId: request.id, 
        status: 'success',
        details: { tasks: request.tasks }
      });

      return { ok: true };
    } catch (error) {
      logger.error('Failed to enable model', { modelId: request.id, error });
      audit({ 
        action: 'models.enable.failed', 
        modelId: request.id,
        status: 'failure',
        details: { error: (error as Error).message }
      });

      return {
        code: 'INTERNAL_ERROR',
        message: 'Failed to enable model',
        details: { error: (error as Error).message }
      };
    }
  }

  async healthcheckModel(modelId: string): Promise<ModelsHealthcheckResponse | SemantiqaError> {
    const { logger, audit } = this.deps;

    try {
      logger.info('Model healthcheck requested', { modelId });
      audit({ action: 'models.healthcheck.started', modelId, status: 'success' });

      // Placeholder implementation
      // In a real implementation, this would:
      // 1. Load the model if not already loaded
      // 2. Run a simple inference test
      // 3. Measure latency and throughput
      // 4. Return actual metrics

      logger.warn('Model healthcheck not yet implemented', { modelId });
      
      return {
        code: 'INTERNAL_ERROR',
        message: 'Model healthcheck functionality not yet implemented',
        details: { modelId }
      };
    } catch (error) {
      logger.error('Model healthcheck failed', { modelId, error });
      audit({ 
        action: 'models.healthcheck.failed', 
        modelId,
        status: 'failure',
        details: { error: (error as Error).message }
      });

      return {
        code: 'INTERNAL_ERROR',
        message: 'Failed to run model healthcheck',
        details: { error: (error as Error).message }
      };
    }
  }

  private async getInstalledModels(db: BetterSqliteDatabase): Promise<InstalledModel[]> {
    const rows = db.prepare(`
      SELECT id, name, kind, size_mb, license, path, sha256, enabled_tasks, installed_at, updated_at
      FROM models
      WHERE installed_at IS NOT NULL
    `).all() as Array<{
      id: string;
      name: string;
      kind: string;
      size_mb: number;
      license: string;
      path: string | null;
      sha256: string;
      enabled_tasks: string;
      installed_at: string;
      updated_at: string;
    }>;

    return rows.map(row => ({
      id: row.id,
      name: row.name,
      kind: row.kind as 'embedding' | 'generator',
      sizeMb: row.size_mb,
      license: row.license,
      sha256: row.sha256,
      installedAt: row.installed_at,
      enabledTasks: JSON.parse(row.enabled_tasks || '[]') as ('summaries' | 'nlsql')[],
      path: row.path ?? undefined,
    }));
  }

  private async ensureModelsDir(): Promise<void> {
    try {
      await fs.mkdir(this.modelsDir, { recursive: true });
    } catch (error) {
      this.deps.logger.error('Failed to create models directory', { error });
      throw error;
    }
  }
}