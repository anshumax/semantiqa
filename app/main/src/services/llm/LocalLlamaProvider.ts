import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import type {
  ILlmProvider,
  LlmGenerationOptions,
  LlmGenerationResult,
  LlmInitOptions,
} from './ILlmProvider.js';

/**
 * Local LLM provider using node-llama-cpp
 * Runs in the Electron main process (worker threads not supported)
 */
export class LocalLlamaProvider implements ILlmProvider {
  private model: any = null;
  private context: any = null;
  private session: any = null;
  private currentModelPath: string | null = null;
  private loadMode: 'llm' | 'fallback' = 'fallback';
  private initOptions: LlmInitOptions | null = null;

  async initialize(modelPath: string, options?: LlmInitOptions): Promise<void> {
    // If already initialized with same model, skip
    if (this.currentModelPath === modelPath && this.session) {
      return;
    }

    // Dispose existing session
    await this.disposeSession();

    // Check if model file exists
    if (!existsSync(modelPath)) {
      console.warn('[LocalLlamaProvider] Model file not found:', modelPath);
      this.loadMode = 'fallback';
      this.currentModelPath = modelPath;
      return;
    }

    this.initOptions = options || {};

    try {
      console.log('[LocalLlamaProvider] Attempting to load node-llama-cpp...');
      const llamaModule = await import('node-llama-cpp');

      console.log('[LocalLlamaProvider] Getting Llama instance (will build if needed for Electron)...');
      // Use getLlama() which handles Electron-specific initialization
      const llama = await llamaModule.getLlama({
        build: 'auto', // Build from source for Electron if needed
        gpu: false,
      });

      console.log('[LocalLlamaProvider] Creating LlamaModel instance...');
      this.model = await llama.loadModel({
        modelPath,
        gpuLayers: 0,
      });

      console.log('[LocalLlamaProvider] LlamaModel loaded, creating context...');
      this.context = await this.model.createContext({
        threads: options?.threads ?? 4,
        batchSize: options?.batchSize ?? 256,
      });

      const systemPrompt = options?.systemPrompt ?? 
        'You are Semantiqa, an offline assistant that helps describe schemas and craft SQL safely.';

      console.log('[LocalLlamaProvider] Creating chat session...');
      // Import the LlamaChatSession class
      const { LlamaChatSession } = await import('node-llama-cpp');
      this.session = new LlamaChatSession({
        contextSequence: this.context.getSequence(),
        systemPrompt,
      });

      this.loadMode = 'llm';
      this.currentModelPath = modelPath;
      console.log('[LocalLlamaProvider] ✓ Successfully loaded node-llama-cpp with native bindings');
    } catch (error) {
      this.loadMode = 'fallback';
      this.currentModelPath = modelPath;
      await this.disposeSession();

      // Provide detailed error message
      const errorMessage = (error as Error).message || String(error);
      if (
        errorMessage.includes('_llama') ||
        errorMessage.includes('undefined') ||
        errorMessage.includes('destructure')
      ) {
        console.warn(
          '[LocalLlamaProvider] ⚠ Native bindings not available for node-llama-cpp.',
          '\n  This usually means the module is not compatible with the current Electron environment.',
          '\n  Falling back to heuristics mode.',
          '\n  Error:',
          errorMessage,
        );
      } else {
        console.warn('[LocalLlamaProvider] Failed to load node-llama-cpp, falling back to heuristics:', error);
      }
    }
  }

  isReady(): boolean {
    return this.currentModelPath !== null && (this.loadMode === 'llm' ? this.session !== null : true);
  }

  getMode(): 'llm' | 'fallback' {
    return this.loadMode;
  }

  async generateText(prompt: string, options?: LlmGenerationOptions): Promise<LlmGenerationResult> {
    const start = performance.now();

    // Try using actual LLM if available
    if (this.loadMode === 'llm' && this.session) {
      try {
        console.log(`[LocalLlamaProvider] Generating text with ${options?.maxTokens ?? 512} maxTokens...`);
        console.log(`[LocalLlamaProvider] Prompt: ${prompt.slice(0, 100)}...`);
        
        const text = await this.session.prompt(prompt, {
          maxTokens: options?.maxTokens ?? 512,
          temperature: options?.temperature ?? 0.2,
          topP: options?.topP ?? 0.9,
          repeatPenalty: options?.repeatPenalty ?? 1.1,
        });

        console.log(`[LocalLlamaProvider] Generated ${text.length} chars in ${performance.now() - start}ms`);

        return {
          text,
          latencyMs: performance.now() - start,
          tokensEstimated: this.estimateTokens(text),
          mode: 'llm',
        };
      } catch (error) {
        console.warn('[LocalLlamaProvider] LLM prompt failed, falling back to heuristics:', error);
        this.loadMode = 'fallback';
      }
    }

    // Fallback to heuristics
    const fallbackText = this.heuristicGenerate(prompt);
    return {
      text: fallbackText,
      latencyMs: performance.now() - start + 5,
      tokensEstimated: this.estimateTokens(fallbackText),
      mode: 'fallback',
    };
  }

  async dispose(): Promise<void> {
    await this.disposeSession();
  }

  private async disposeSession(): Promise<void> {
    try {
      this.session?.dispose?.();
      this.context?.dispose?.();
      this.model?.dispose?.();
    } catch (error) {
      console.warn('[LocalLlamaProvider] Error disposing session:', error);
    }

    this.session = null;
    this.context = null;
    this.model = null;
  }

  private estimateTokens(text: string): number {
    return Math.max(1, Math.round(text.length / 4));
  }

  private heuristicGenerate(prompt: string): string {
    const hash = createHash('sha1').update(prompt).digest('hex').slice(0, 6);
    return `/* Heuristic response (${hash}) */ ${prompt.slice(0, 160)}`.trim();
  }
}

