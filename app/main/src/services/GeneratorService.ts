import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import type {
  ModelsHealthcheckRequest,
  ModelsHealthcheckResponse,
  NlSqlGenerateRequest,
  NlSqlGenerateResponse,
  SemantiqaError,
} from '@semantiqa/contracts';
import type { Database as BetterSqliteDatabase } from 'better-sqlite3';
import type { ILlmProvider } from './llm/ILlmProvider.js';
import { LlmProviderFactory, type LlmProviderConfig } from './llm/LlmProviderFactory.js';

interface ActiveModel {
  id: string;
  path: string;
  enabledTasks: Array<'summaries' | 'nlsql'>;
}

interface GeneratorServiceOptions {
  threads?: number;
  batchSize?: number;
  systemPrompt?: string;
}

export interface GeneratorServiceDeps {
  openSourcesDb: () => BetterSqliteDatabase;
  audit: (event: { action: string; status: 'success' | 'failure'; details?: Record<string, unknown> }) => void;
  logger: Pick<Console, 'info' | 'warn' | 'error'>;
  llmProviderConfig?: LlmProviderConfig;
}

export class GeneratorService {
  private readonly llmProvider: ILlmProvider;
  private readonly options: GeneratorServiceOptions;

  constructor(private readonly deps: GeneratorServiceDeps) {
    const cpuCount = Math.max(2, os.cpus().length - 1);
    this.options = {
      threads: Math.min(4, cpuCount),
      batchSize: 256,
      systemPrompt: 'You are Semantiqa, an offline assistant that helps describe schemas and craft SQL safely.',
    };

    // Create LLM provider from config or use default (local)
    this.llmProvider = deps.llmProviderConfig
      ? LlmProviderFactory.createProvider(deps.llmProviderConfig)
      : LlmProviderFactory.createDefault();
  }

  /**
   * Validates that native modules required for the generator service are properly built.
   * This is a static method that can be called during app startup.
   * Returns null if validation passes, or an error message if it fails.
   */
  static async validateNativeModules(): Promise<string | null> {
    try {
      // Try to import node-llama-cpp
      const module = await import('node-llama-cpp');

      // Check if the LlamaModel class exists (indicates native bindings are loaded)
      if (!module.LlamaModel) {
        return 'node-llama-cpp native bindings not loaded. Run "pnpm install" to rebuild native modules.';
      }

      return null; // Validation passed
    } catch (error) {
      const errorMessage = (error as Error).message || String(error);
      if (
        errorMessage.includes('_llama') ||
        errorMessage.includes('undefined') ||
        errorMessage.includes('Cannot destructure')
      ) {
        return 'node-llama-cpp native bindings not available. Run "pnpm install" to rebuild native modules for Electron.';
      }
      return `Failed to load node-llama-cpp: ${errorMessage}`;
    }
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

      // Initialize provider if needed
      if (!this.llmProvider.isReady()) {
        await this.llmProvider.initialize(model.path, this.options);
      }

      // Generate summary using LLM provider
      const summaryPrompt = `Summarize the following content in 3 bullet points with clear, non-fluffy prose:\n${input.text}`;
      const result = await this.llmProvider.generateText(summaryPrompt, {
        maxTokens: 256,
        temperature: 0.15,
      });

      let summary = result.text.trim();
      let highlights: string[];

      if (result.mode === 'fallback') {
        const heuristic = this.heuristicSummary(input.text);
        summary = heuristic.summary;
        highlights = heuristic.highlights;
      } else {
        highlights = summary
          .split(/\n|-/)
          .map((line) => line.replace(/^[•\-\d.]+/, '').trim())
          .filter(Boolean)
          .slice(0, 3);
      }

      const finalResult = { summary, highlights };
      this.writeCache('summarize', cacheKey, finalResult);
      return finalResult;
    } catch (error) {
      return this.internalError('Failed to summarize content', error);
    }
  }

  async rewrite(
    input: { text: string; instructions?: string },
  ): Promise<{ output: string; rationale: string } | SemantiqaError> {
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

      // Initialize provider if needed
      if (!this.llmProvider.isReady()) {
        await this.llmProvider.initialize(model.path, this.options);
      }

      const instruction =
        input.instructions?.trim() || 'Rewrite this text to be concise, active voice, and business-friendly.';
      const rewritePrompt = `${instruction}\nText:\n${input.text}`;

      const result = await this.llmProvider.generateText(rewritePrompt, {
        maxTokens: 512,
        temperature: 0.2,
      });

      const finalResult = {
        output: result.text.trim(),
        rationale:
          result.mode === 'fallback'
            ? 'Generated via deterministic heuristic because node-llama-cpp is unavailable.'
            : 'Generated via local Llama model.',
      };

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

      // Initialize provider if needed
      if (!this.llmProvider.isReady()) {
        await this.llmProvider.initialize(model.path, this.options);
      }

      const sqlPrompt =
        `You are Semantiqa. Derive a SQL skeleton for the request: "${request.question}".` +
        ' Use only table and column names that appear in the scope hints.' +
        ' Return only SQL, no explanations.';

      const result = await this.llmProvider.generateText(sqlPrompt, {
        maxTokens: 400,
        temperature: 0.1,
      });

      const sql =
        result.mode === 'fallback'
          ? this.heuristicSql(request.question, request.scope as any)
          : result.text.trim();

      const finalResponse: NlSqlGenerateResponse = {
        question: request.question,
        candidates: [
          {
            sql,
            plan:
              result.mode === 'fallback'
                ? 'Heuristic SQL skeleton derived from question and hints.'
                : 'Generated via local Llama model.',
            warnings: result.mode === 'fallback' ? ['LLM unavailable, heuristic skeleton only'] : [],
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

      // Initialize provider if needed
      if (!this.llmProvider.isReady()) {
        await this.llmProvider.initialize(model.path, this.options);
      }

      const planPrompt =
        `Generate a federated query plan for "${input.question}".` +
        ' Highlight which sources should be queried and how to join them safely.';

      const result = await this.llmProvider.generateText(planPrompt, {
        maxTokens: 400,
        temperature: 0.25,
      });

      const plan =
        result.mode === 'fallback'
          ? [
              `Identify relevant datasets based on relationships: ${input.relationships?.join(', ') || 'none provided'}.`,
              'Fetch constrained projections from each source.',
              'Join using semantic keys and apply final filters.',
            ]
          : result.text
              .split(/\n+/)
              .map((line) => line.trim())
              .filter(Boolean);

      const finalResult = {
        plan,
        narrative:
          result.mode === 'fallback' ? 'Federated strategy derived heuristically.' : 'Detailed plan from local Llama model.',
      };

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

      // Initialize provider if needed
      if (!this.llmProvider.isReady()) {
        await this.llmProvider.initialize(model.path, this.options);
      }

      const start = performance.now();
      const hcPrompt = 'You are performing a healthcheck. Respond with "READY" followed by a brief status sentence.';

      const result = await this.llmProvider.generateText(hcPrompt, {
        maxTokens: 32,
        temperature: 0.05,
      });

      const latencyMs = Math.max(1, Math.round(result.latencyMs));
      const tokensPerSec =
        latencyMs > 0 ? Math.max(1, Math.round(result.tokensEstimated / (latencyMs / 1000))) : result.tokensEstimated;

      return {
        id: model.id,
        ok: true,
        latencyMs,
        tokensPerSec,
        errors: result.mode === 'fallback' ? ['node-llama-cpp unavailable, running in heuristic fallback mode'] : [],
      };
    } catch (error) {
      return this.internalError('Failed to run model healthcheck', error);
    }
  }

  /**
   * Cleanup LLM provider resources
   */
  async dispose(): Promise<void> {
    await this.llmProvider.dispose();
  }

  private getModelForTask(task: 'summaries' | 'nlsql', preferredId?: string): ActiveModel | SemantiqaError {
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

  // Heuristic fallback functions
  private heuristicSummary(text: string): { summary: string; highlights: string[] } {
    const sentences = text
      .replace(/\s+/g, ' ')
      .split(/(?<=[.!?])\s+/)
      .filter(Boolean);
    const summary = sentences.slice(0, 2).join(' ');
    const highlights = sentences.slice(0, 3).map((s) => s.trim());
    return { summary: summary || text.slice(0, 160), highlights };
  }

  private heuristicSql(question: string, scope?: { tableHints?: string[]; columnHints?: string[] }): string {
    const tables = scope?.tableHints?.length ? scope.tableHints : ['table_one'];
    const firstTable = tables[0];
    const sqlLines = [`SELECT`, `  -- columns inferred from: ${question}`, `FROM ${firstTable}`];
    if (tables.length > 1) {
      sqlLines.push(
        ...tables.slice(1).map((table, idx) => {
          const joinKey = scope?.columnHints?.[idx] ?? 'id';
          return `JOIN ${table} ON ${firstTable}.${joinKey} = ${table}.${joinKey}`;
        }),
      );
    }
    sqlLines.push(`WHERE /* add filters derived from natural language */;`);
    return sqlLines.join('\n');
  }
}

function isError(value: ActiveModel | SemantiqaError): value is SemantiqaError {
  return (value as SemantiqaError).code !== undefined;
}
