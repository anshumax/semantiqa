import type {
  ILlmProvider,
  LlmGenerationOptions,
  LlmGenerationResult,
  LlmInitOptions,
} from './ILlmProvider.js';

/**
 * External LLM provider (Ollama, LM Studio, OpenAI-compatible APIs)
 * 
 * This is a stub for future implementation.
 * Will support calling external LLM services via HTTP API.
 */
export class ExternalLlmProvider implements ILlmProvider {
  private endpoint: string | null = null;
  private apiKey: string | null = null;
  private ready: boolean = false;

  async initialize(endpoint: string, options?: LlmInitOptions): Promise<void> {
    this.endpoint = endpoint;
    this.ready = false;

    // TODO: Implement
    // - Validate endpoint URL
    // - Test connection with a ping/health check
    // - Store API key if provided
    // - Set ready = true on success

    console.warn('[ExternalLlmProvider] Not yet implemented - using fallback mode');
  }

  isReady(): boolean {
    return this.ready;
  }

  getMode(): 'llm' | 'fallback' {
    return this.ready ? 'llm' : 'fallback';
  }

  async generateText(prompt: string, options?: LlmGenerationOptions): Promise<LlmGenerationResult> {
    const start = performance.now();

    // TODO: Implement HTTP API call to external service
    // Example for Ollama: POST /api/generate
    // Example for OpenAI: POST /v1/completions

    // For now, return fallback response
    console.warn('[ExternalLlmProvider] Not yet implemented - returning fallback');
    
    return {
      text: `[External LLM not implemented] ${prompt.slice(0, 100)}`,
      latencyMs: performance.now() - start,
      tokensEstimated: 10,
      mode: 'fallback',
    };
  }

  async dispose(): Promise<void> {
    // Cleanup any HTTP connections if needed
    this.ready = false;
    this.endpoint = null;
    this.apiKey = null;
  }
}

