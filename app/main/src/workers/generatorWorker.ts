import { parentPort } from 'node:worker_threads';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';

type GeneratorTaskType = 'summarize' | 'rewrite' | 'genSqlSkeleton' | 'genFederatedQuery' | 'healthcheck';

interface GeneratorTaskMessage {
  type: 'task';
  taskId: string;
  taskType: GeneratorTaskType;
  payload: Record<string, unknown>;
  modelPath: string;
}

interface InitMessage {
  type: 'init';
  modelPath: string;
  options?: {
    threads?: number;
    batchSize?: number;
    systemPrompt?: string;
  };
}

type IncomingMessage = GeneratorTaskMessage | InitMessage;

interface GeneratorResult<T = unknown> {
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

let llamaModule: typeof import('node-llama-cpp') | null = null;
let model: import('node-llama-cpp').LlamaModel | null = null;
let context: import('node-llama-cpp').LlamaContext | null = null;
let session: import('node-llama-cpp').LlamaChatSession | null = null;
let currentModelPath: string | null = null;
let loadMode: 'llama' | 'fallback' = 'fallback';

async function ensureModel(modelPath: string, options?: InitMessage['options']) {
  if (currentModelPath === modelPath && session) {
    return loadMode;
  }

  disposeSession();

  if (!existsSync(modelPath)) {
    loadMode = 'fallback';
    return loadMode;
  }

  try {
    const module = await import('node-llama-cpp');
    llamaModule = module;
    model = new module.LlamaModel({
      modelPath,
      gpuLayers: 0,
      seed: 42,
    });
    context = new module.LlamaContext({
      model,
      threads: options?.threads ?? 4,
      batchSize: options?.batchSize ?? 256,
    });
    session = new module.LlamaChatSession({
      context,
      systemPrompt:
        options?.systemPrompt ??
        'You are Semantiqa, an offline assistant that helps describe schemas and craft SQL safely.',
    });
    loadMode = 'llama';
    currentModelPath = modelPath;
  } catch (error) {
    loadMode = 'fallback';
    currentModelPath = modelPath;
    disposeSession();
    // The fallback path intentionally swallows errors so the app remains functional without the native binding.
    console.warn('[generatorWorker] Failed to load node-llama-cpp, falling back to heuristics:', error);
  }

  return loadMode;
}

function disposeSession() {
  session?.dispose?.();
  context?.dispose?.();
  model?.dispose?.();
  session = null;
  context = null;
  model = null;
}

function estimateTokens(text: string) {
  return Math.max(1, Math.round(text.length / 4));
}

async function generateText(
  prompt: string,
  opts: { maxTokens?: number; temperature?: number } = {},
): Promise<{ text: string; latencyMs: number; tokens: number; mode: 'llama' | 'fallback' }> {
  const start = performance.now();

  if (loadMode === 'llama' && session) {
    try {
      const text = await session.prompt(prompt, {
        maxTokens: opts.maxTokens ?? 512,
        temperature: opts.temperature ?? 0.2,
        topP: 0.9,
        repeatPenalty: 1.1,
      });
      return {
        text,
        latencyMs: performance.now() - start,
        tokens: estimateTokens(text),
        mode: 'llama',
      };
    } catch (error) {
      console.warn('[generatorWorker] Llama prompt failed, falling back to heuristics:', error);
      loadMode = 'fallback';
    }
  }

  const fallbackText = heuristicGenerate(prompt);
  return {
    text: fallbackText,
    latencyMs: performance.now() - start + 5,
    tokens: estimateTokens(fallbackText),
    mode: 'fallback',
  };
}

function heuristicGenerate(prompt: string) {
  const hash = createHash('sha1').update(prompt).digest('hex').slice(0, 6);
  return `/* Heuristic response (${hash}) */ ${prompt.slice(0, 160)}`.trim();
}

function heuristicSummary(text: string) {
  const sentences = text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .filter(Boolean);
  const summary = sentences.slice(0, 2).join(' ');
  const highlights = sentences.slice(0, 3).map((s) => s.trim());
  return { summary: summary || text.slice(0, 160), highlights };
}

function heuristicSql(question: string, scope?: { tableHints?: string[]; columnHints?: string[] }) {
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

async function handleTask(message: GeneratorTaskMessage) {
  const { taskId, taskType, payload, modelPath } = message;

  try {
    await ensureModel(modelPath);

    switch (taskType) {
      case 'summarize': {
        const text = String(payload.text ?? '');
        const summaryPrompt = `Summarize the following content in 3 bullet points with clear, non-fluffy prose:\n${text}`;
        const result = await generateText(summaryPrompt, { maxTokens: 256, temperature: 0.15 });

        let summary = result.text.trim();
        let highlights: string[];
        if (loadMode === 'fallback') {
          const heuristic = heuristicSummary(text);
          summary = heuristic.summary;
          highlights = heuristic.highlights;
        } else {
          highlights = summary
            .split(/\n|-/)
            .map((line) => line.replace(/^[•\-\d.]+/, '').trim())
            .filter(Boolean)
            .slice(0, 3);
        }

        sendResult({
          taskId,
          ok: true,
          result: { summary, highlights },
          metrics: {
            latencyMs: result.latencyMs,
            tokensEstimated: result.tokens,
            mode: loadMode,
          },
        });
        break;
      }
      case 'rewrite': {
        const text = String(payload.text ?? '');
        const instruction =
          String(payload.instructions ?? '') ||
          'Rewrite this text to be concise, active voice, and business-friendly.';
        const rewritePrompt = `${instruction}\nText:\n${text}`;
        const result = await generateText(rewritePrompt, { maxTokens: 512, temperature: 0.2 });
        sendResult({
          taskId,
          ok: true,
          result: {
            output: result.text.trim(),
            rationale:
              loadMode === 'fallback'
                ? 'Generated via deterministic heuristic because node-llama-cpp is unavailable.'
                : 'Generated via local Llama model.',
          },
          metrics: {
            latencyMs: result.latencyMs,
            tokensEstimated: result.tokens,
            mode: loadMode,
          },
        });
        break;
      }
      case 'genSqlSkeleton': {
        const question = String(payload.question ?? '');
        const scope = (payload.scope as Record<string, unknown>) ?? {};
        const sqlPrompt = `You are Semantiqa. Derive a SQL skeleton for the request: "${question}".`
          + ' Use only table and column names that appear in the scope hints.'
          + ' Return only SQL, no explanations.';

        const result = await generateText(sqlPrompt, { maxTokens: 400, temperature: 0.1 });
        const sql =
          loadMode === 'fallback'
            ? heuristicSql(question, {
                tableHints: Array.isArray(scope.tableHints) ? (scope.tableHints as string[]) : undefined,
                columnHints: Array.isArray(scope.columnHints) ? (scope.columnHints as string[]) : undefined,
              })
            : result.text.trim();

        sendResult({
          taskId,
          ok: true,
          result: {
            sql,
            reasoning:
              loadMode === 'fallback'
                ? 'Heuristic SQL skeleton derived from question and hints.'
                : 'Generated via local Llama model.',
            warnings: loadMode === 'fallback' ? ['LLM unavailable, heuristic skeleton only'] : [],
          },
          metrics: {
            latencyMs: result.latencyMs,
            tokensEstimated: result.tokens,
            mode: loadMode,
          },
        });
        break;
      }
      case 'genFederatedQuery': {
        const question = String(payload.question ?? '');
        const relationships = Array.isArray(payload.relationships) ? (payload.relationships as string[]) : [];
        const planPrompt = `Generate a federated query plan for "${question}".`
          + ' Highlight which sources should be queried and how to join them safely.';
        const result = await generateText(planPrompt, { maxTokens: 400, temperature: 0.25 });
        const plan =
          loadMode === 'fallback'
            ? [
                `Identify relevant datasets based on relationships: ${relationships.join(', ') || 'none provided'}.`,
                'Fetch constrained projections from each source.',
                'Join using semantic keys and apply final filters.',
              ]
            : result.text.split(/\n+/).map((line) => line.trim()).filter(Boolean);

        sendResult({
          taskId,
          ok: true,
          result: {
            plan,
            narrative:
              loadMode === 'fallback'
                ? 'Federated strategy derived heuristically.'
                : 'Detailed plan from local Llama model.',
          },
          metrics: {
            latencyMs: result.latencyMs,
            tokensEstimated: result.tokens,
            mode: loadMode,
          },
        });
        break;
      }
      case 'healthcheck': {
        const hcPrompt =
          'You are performing a healthcheck. Respond with "READY" followed by a brief status sentence.';
        const result = await generateText(hcPrompt, { maxTokens: 32, temperature: 0.05 });
        const tokensPerSec =
          result.latencyMs > 0 ? Math.max(1, Math.round(result.tokens / (result.latencyMs / 1000))) : result.tokens;
        sendResult({
          taskId,
          ok: true,
          result: {
            status: result.text.trim(),
          },
          metrics: {
            latencyMs: result.latencyMs,
            tokensEstimated: tokensPerSec,
            mode: loadMode,
          },
        });
        break;
      }
      default:
        throw new Error(`Unsupported task type: ${taskType}`);
    }
  } catch (error) {
    sendResult({
      taskId,
      ok: false,
      error: { message: (error as Error).message || 'Unknown worker error' },
    });
  }
}

function sendResult(message: GeneratorResult) {
  parentPort?.postMessage(message);
}

parentPort?.on('message', (message: IncomingMessage) => {
  if (message.type === 'init') {
    void ensureModel(message.modelPath, message.options).then((mode) => {
      parentPort?.postMessage({
        type: 'ready',
        mode,
      });
    });
    return;
  }

  void handleTask(message);
});

parentPort?.on('close', () => {
  disposeSession();
});

