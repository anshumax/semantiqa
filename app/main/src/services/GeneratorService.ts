import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { Worker } from 'node:worker_threads';

import type {
  ModelsHealthcheckRequest,
  ModelsHealthcheckResponse,
  NlSqlGenerateRequest,
  NlSqlGenerateResponse,
  SemantiqaError,
} from '@semantiqa/contracts';
import type { Database as BetterSqliteDatabase } from 'better-sqlite3';

type GeneratorTaskType = 'summarize' | 'rewrite' | 'genSqlSkeleton' | 'genFederatedQuery' | 'healthcheck';

interface WorkerReadyMessage {
  type: 'ready';
  mode: 'llama' | 'fallback';
}

interface WorkerResultMessage<T = unknown> {
  type: 'result';
  taskId: string;
  ok: boolean;
  result?: T;
  metrics?: {
    latencyMs: number;
    tokensEstimated: number;
    mode: 'llama' | 'fallback';
  };
  error?: {
    message: string;
  };
}

type WorkerMessage<T = unknown> = WorkerReadyMessage | WorkerResultMessage<T>;

interface WorkerTaskPayload {
  type: 'task';
  taskId: string;
  taskType: GeneratorTaskType;
  payload: Record<string, unknown>;
  modelPath: string;
}

interface InitPayload {
  type: 'init';
  modelPath: string;
  options?: {
    threads?: number;
    batchSize?: number;
    systemPrompt?: string;
  };
}

type OutboundMessage = WorkerTaskPayload | InitPayload;

interface ActiveModel {
  id: string;
  path: string;
  enabledTasks: Array<'summaries' | 'nlsql'>;
}

interface GeneratorWorkerOptions {
  threads?: number;
  batchSize?: number;
  systemPrompt?: string;
}

type PendingTask = {
  resolve: (value: WorkerResultMessage<unknown>) => void;
  reject: (error: Error) => void;
};

class GeneratorWorkerPool {
  private worker: Worker | null = null;
  private pendingTasks = new Map<string, PendingTask>();
  private currentModelPath: string | null = null;
  private readyResolver: (() => void) | null = null;
  private readyPromise: Promise<void> | null = null;

  constructor(
    private readonly options: GeneratorWorkerOptions,
    private readonly logger: Pick<Console, 'info' | 'warn' | 'error'>,
  ) {}

  async runTask<T>(
    taskType: GeneratorTaskType,
    payload: Record<string, unknown>,
    modelPath: string,
  ): Promise<WorkerResultMessage<T>> {
    await this.ensureWorker(modelPath);

    if (!this.worker) {
      throw new Error('Generator worker is not available');
    }

    const taskId = randomUUID();
    return new Promise<WorkerResultMessage<T>>((resolve, reject) => {
      this.pendingTasks.set(taskId, {
        resolve: (value) => resolve(value as WorkerResultMessage<T>),
        reject,
      });
      const message: WorkerTaskPayload = {
        type: 'task',
        taskId,
        taskType,
        payload,
        modelPath,
      };
      this.worker!.postMessage(message);
    });
  }

  async dispose() {
    if (this.worker) {
      this.logger.info('[GeneratorWorkerPool] Disposing worker');
      await this.worker.terminate().catch((error) => {
        this.logger.warn('[GeneratorWorkerPool] Failed to terminate worker', { error });
      });
    }
    this.worker = null;
    this.currentModelPath = null;
    this.pendingTasks.clear();
  }

  private async ensureWorker(modelPath: string) {
    if (this.worker && this.currentModelPath === modelPath) {
      return this.readyPromise;
    }

    await this.dispose();
    this.currentModelPath = modelPath;

    const workerPath = path.join(__dirname, '..', 'workers', 'generatorWorker.js');
    this.worker = new Worker(workerPath);

    this.worker.on('message', (message: WorkerMessage) => {
      if (message.type === 'ready') {
        this.logger.info('[GeneratorWorkerPool] Worker ready', { mode: message.mode });
        this.readyResolver?.();
        this.readyResolver = null;
        return;
      }

      const pending = this.pendingTasks.get(message.taskId);
      if (!pending) {
        this.logger.warn('[GeneratorWorkerPool] Received result for unknown task', { taskId: message.taskId });
        return;
      }

      this.pendingTasks.delete(message.taskId);
      if (message.ok) {
        pending.resolve(message);
      } else {
        pending.reject(new Error(message.error?.message ?? 'Generator worker failed'));
      }
    });

    this.worker.on('error', (error) => {
      this.logger.error('[GeneratorWorkerPool] Worker error', { error });
      for (const pending of this.pendingTasks.values()) {
        pending.reject(error);
      }
      this.pendingTasks.clear();
    });

    this.worker.on('exit', (code) => {
      if (code !== 0) {
        this.logger.error('[GeneratorWorkerPool] Worker exited unexpectedly', { code });
      }
      this.worker = null;
      this.currentModelPath = null;
    });

    this.readyPromise = new Promise<void>((resolve) => {
      this.readyResolver = resolve;
    });

    const initMessage: InitPayload = {
      type: 'init',
      modelPath,
      options: this.options,
    };
    this.worker.postMessage(initMessage);

    return this.readyPromise;
  }
}

interface GeneratorServiceDeps {
  openSourcesDb: () => BetterSqliteDatabase;
  audit: (event: { action: string; status: 'success' | 'failure'; details?: Record<string, unknown> }) => void;
  logger: Pick<Console, 'info' | 'warn' | 'error'>;
}

export class GeneratorService {
  private readonly workerPool: GeneratorWorkerPool;

  constructor(private readonly deps: GeneratorServiceDeps) {
    const cpuCount = Math.max(2, os.cpus().length - 1);
    this.workerPool = new GeneratorWorkerPool({ threads: Math.min(4, cpuCount) }, deps.logger);
  }

  async summarize(input: { text: string }): Promise<{ summary: string; highlights: string[] } | SemantiqaError> {
    try {
      const model = this.getModelForTask('summaries');
      if (isError(model)) {
        return model;
      }

      const payload = { text: input.text.trim() };
      const cacheKey = this.hashPayload(payload);
      const cached = this.readCache<{ summary: string; highlights: string[] }>('summarize', cacheKey);
      if (cached) {
        this.deps.logger.info('[GeneratorService] Returning cached summary');
        return cached;
      }

      const result = await this.workerPool.runTask<{ summary: string; highlights: string[] }>(
        'summarize',
        payload,
        model.path,
      );

      const finalResult = result.result ?? { summary: '', highlights: [] };
      this.writeCache('summarize', cacheKey, finalResult);
      return finalResult;
    } catch (error) {
      return this.internalError('Failed to summarize content', error);
    }
  }

  async rewrite(input: { text: string; instructions?: string }): Promise<{ output: string; rationale: string } | SemantiqaError> {
    try {
      const model = this.getModelForTask('summaries');
      if (isError(model)) {
        return model;
      }

      const payload = { text: input.text.trim(), instructions: input.instructions?.trim() };
      const cacheKey = this.hashPayload(payload);
      const cached = this.readCache<{ output: string; rationale: string }>('rewrite', cacheKey);
      if (cached) {
        return cached;
      }

      const result = await this.workerPool.runTask<{ output: string; rationale: string }>(
        'rewrite',
        payload,
        model.path,
      );

      const finalResult = result.result ?? { output: input.text, rationale: 'No changes applied.' };
      this.writeCache('rewrite', cacheKey, finalResult);
      return finalResult;
    } catch (error) {
      return this.internalError('Failed to rewrite text', error);
    }
  }

  async generateNlSql(request: NlSqlGenerateRequest): Promise<NlSqlGenerateResponse | SemantiqaError> {
    try {
      const model = this.getModelForTask('nlsql');
      if (isError(model)) {
        return model;
      }

      const payloadForHash = { question: request.question, scope: request.scope };
      const cacheKey = this.hashPayload(payloadForHash);
      const cached = this.readCache<NlSqlGenerateResponse>('nlsql', cacheKey);
      if (cached) {
        return cached;
      }

      const response = await this.workerPool.runTask<{
        sql: string;
        reasoning: string;
        warnings: string[];
      }>('genSqlSkeleton', { question: request.question, scope: request.scope }, model.path);

      const payload = response.result ?? {
        sql: 'SELECT 1;',
        reasoning: 'Fallback reasoning.',
        warnings: ['LLM unavailable.'],
      };

      const finalResponse: NlSqlGenerateResponse = {
        question: request.question,
        candidates: [
          {
            sql: payload.sql,
            plan: payload.reasoning,
            warnings: payload.warnings ?? [],
            policy: { allowed: true, reasons: [] },
          },
        ],
      };
      this.writeCache('nlsql', cacheKey, finalResponse);
      return finalResponse;
    } catch (error) {
      return this.internalError('Failed to generate SQL', error);
    }
  }

  async generateFederatedPlan(input: {
    question: string;
    relationships?: string[];
  }): Promise<{ plan: string[]; narrative: string } | SemantiqaError> {
    try {
      const model = this.getModelForTask('nlsql');
      if (isError(model)) {
        return model;
      }

      const payloadForHash = { question: input.question, relationships: input.relationships };
      const cacheKey = this.hashPayload(payloadForHash);
      const cached = this.readCache<{ plan: string[]; narrative: string }>('federated', cacheKey);
      if (cached) {
        return cached;
      }

      const result = await this.workerPool.runTask<{ plan: string[]; narrative: string }>(
        'genFederatedQuery',
        payloadForHash,
        model.path,
      );

      const finalResult = result.result ?? { plan: [], narrative: 'No narrative available' };
      this.writeCache('federated', cacheKey, finalResult);
      return finalResult;
    } catch (error) {
      return this.internalError('Failed to generate federated plan', error);
    }
  }

  async healthcheck(request: ModelsHealthcheckRequest): Promise<ModelsHealthcheckResponse | SemantiqaError> {
    try {
      const model = this.getModelForTask('summaries', request.id);
      if (isError(model)) {
        return model;
      }

      const result = await this.workerPool.runTask<{ status: string }>('healthcheck', {}, model.path);
      const latencyMs = Math.max(1, Math.round(result.metrics?.latencyMs ?? 1));
      const tokensPerSec = Math.max(1, Math.round(result.metrics?.tokensEstimated ?? 1));

      return {
        id: model.id,
        ok: true,
        latencyMs,
        tokensPerSec,
        errors:
          result.metrics?.mode === 'fallback'
            ? ['node-llama-cpp unavailable, running in heuristic fallback mode']
            : [],
      };
    } catch (error) {
      return this.internalError('Failed to run model healthcheck', error);
    }
  }

  private getModelForTask(
    task: 'summaries' | 'nlsql',
    preferredId?: string,
  ): ActiveModel | SemantiqaError {
    const db = this.deps.openSourcesDb();
    const rows = db
      .prepare(
        `
        SELECT id, path, enabled_tasks
        FROM models
        WHERE kind = 'generator'
          AND path IS NOT NULL
        ORDER BY installed_at DESC
      `,
      )
      .all() as Array<{ id: string; path: string | null; enabled_tasks: string | null }>;

    const normalized = rows
      .map<ActiveModel | null>((row) => {
        if (!row.path) {
          return null;
        }
        let enabled: Array<'summaries' | 'nlsql'> = [];
        if (row.enabled_tasks) {
          try {
            enabled = JSON.parse(row.enabled_tasks) as Array<'summaries' | 'nlsql'>;
          } catch {
            enabled = [];
          }
        }
        return { id: row.id, path: row.path, enabledTasks: enabled };
      })
      .filter(Boolean) as ActiveModel[];

    const candidate = normalized.find((model) => {
      if (preferredId && model.id !== preferredId) {
        return false;
      }
      return model.enabledTasks.includes(task);
    });

    if (!candidate) {
      return this.validationError('No generator model with required task enabled', {
        task,
        preferredId,
      });
    }

    if (!fs.existsSync(candidate.path)) {
      return this.validationError('Generator model file is missing', {
        path: candidate.path,
      });
    }

    return candidate;
  }

  private validationError(message: string, details?: Record<string, unknown>): SemantiqaError {
    return {
      code: 'VALIDATION_ERROR',
      message,
      details,
    };
  }

  private internalError(message: string, error: unknown): SemantiqaError {
    this.deps.logger.error('[GeneratorService] ' + message, { error });
    return {
      code: 'INTERNAL_ERROR',
      message,
      details: {
        error: error instanceof Error ? error.message : error,
      },
    };
  }

  private hashPayload(payload: unknown): string {
    const hash = createHash('sha256');
    hash.update(JSON.stringify(payload));
    return hash.digest('hex');
  }

  private cacheKey(task: string, hash: string) {
    return `generator_cache:${task}:${hash}`;
  }

  private readCache<T>(task: string, hash: string): T | null {
    try {
      const db = this.deps.openSourcesDb();
      const row = db
        .prepare('SELECT value FROM settings WHERE key = ?')
        .get(this.cacheKey(task, hash)) as { value: string } | undefined;
      if (!row) {
        return null;
      }
      return JSON.parse(row.value) as T;
    } catch (error) {
      this.deps.logger.warn('[GeneratorService] Failed to read cache entry', { task, hash, error });
      return null;
    }
  }

  private writeCache(task: string, hash: string, value: unknown) {
    try {
      const db = this.deps.openSourcesDb();
      db.prepare(
        `
        INSERT INTO settings (key, value, updated_at)
        VALUES (?, ?, datetime('now'))
        ON CONFLICT(key) DO UPDATE SET
          value = excluded.value,
          updated_at = excluded.updated_at
      `,
      ).run(this.cacheKey(task, hash), JSON.stringify(value));
    } catch (error) {
      this.deps.logger.warn('[GeneratorService] Failed to write cache entry', { task, hash, error });
    }
  }
}

function isError(value: ActiveModel | SemantiqaError): value is SemantiqaError {
  return (value as SemantiqaError).code !== undefined;
}

