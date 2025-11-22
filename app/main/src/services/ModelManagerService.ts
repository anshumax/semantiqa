import { promises as fs } from 'node:fs';
import { createReadStream, createWriteStream } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { app } from 'electron';
import { loadModelManifest } from '../../../../core/dist/models';
import type { 
  ModelsListResponse,
  ModelsDownloadRequest,
  ModelsEnableRequest,
  ModelsHealthcheckResponse,
  ModelManifestEntry,
  SemantiqaError 
} from '@semantiqa/contracts';
import type { Database as BetterSqliteDatabase } from 'better-sqlite3';

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
      const available = await loadModelManifest();
      logger.info(`Loaded ${available.length} models from manifest`);

      // Load installed models from database
      const installed = await this.getInstalledModels(openSourcesDb());

      audit({ 
        action: 'models.list.completed', 
        status: 'success',
        details: { available: available.length, installed: installed.length }
      });

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
        available: available.map((model: any) => ({
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
        logger
      );

      // Verify SHA256 checksum
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

      logger.info('Checksum verified successfully', { modelId: request.id });

      // Move to final location
      await fs.rename(downloadedPath, finalPath);

      // Register in database
      const db = openSourcesDb();
      const now = new Date().toISOString();
      
      db.prepare(`
        INSERT INTO models (id, name, kind, size_mb, path, sha256, enabled_tasks, installed_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          path = excluded.path,
          installed_at = excluded.installed_at,
          updated_at = excluded.updated_at
      `).run(
        modelEntry.id,
        modelEntry.name,
        modelEntry.kind,
        modelEntry.sizeMb,
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
    const manifestPath = join(process.cwd(), 'models', 'models.json');
    const raw = await fs.readFile(manifestPath, 'utf-8');
    return JSON.parse(raw);
  }

  private async downloadWithResume(
    url: string,
    destPath: string,
    expectedSizeMb: number,
    logger: ModelManagerDeps['logger']
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
      const protocol = url.startsWith('https') ? https : http;

      const options = {
        headers: startByte > 0 ? { 'Range': `bytes=${startByte}-` } : {}
      };

      const request = protocol.get(url, options, (response: any) => {
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

        response.on('data', (chunk: Buffer) => {
          downloaded += chunk.length;
          const progress = Math.round((downloaded / totalSize) * 100);
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
          resolve(destPath);
        });

        fileStream.on('error', (err: Error) => {
          fs.unlink(destPath).catch(() => {});
          reject(err);
        });
      });

      request.on('error', (err: Error) => {
        reject(err);
      });

      request.setTimeout(30000, () => {
        request.destroy();
        reject(new Error('Download timeout'));
      });
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
      SELECT id, name, kind, size_mb, path, sha256, enabled_tasks, installed_at, updated_at
      FROM models
      WHERE installed_at IS NOT NULL
    `).all() as Array<{
      id: string;
      name: string;
      kind: string;
      size_mb: number;
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
      license: '', // Would need to store this in DB or fetch from manifest
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