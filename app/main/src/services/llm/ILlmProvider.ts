/**
 * LLM Provider Abstraction
 * 
 * This abstraction allows swapping between different LLM backends:
 * - Local models (node-llama-cpp)
 * - External APIs (Ollama, LM Studio, OpenAI)
 * - Future implementations
 */

export interface LlmGenerationOptions {
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  repeatPenalty?: number;
}

export interface LlmGenerationResult {
  text: string;
  latencyMs: number;
  tokensEstimated: number;
  mode: 'llm' | 'fallback';
}

export interface LlmInitOptions {
  threads?: number;
  batchSize?: number;
  systemPrompt?: string;
}

/**
 * Interface for LLM providers
 */
export interface ILlmProvider {
  /**
   * Initialize the provider with a model path or configuration
   */
  initialize(modelPath: string, options?: LlmInitOptions): Promise<void>;

  /**
   * Check if the provider is ready to generate text
   */
  isReady(): boolean;

  /**
   * Get the current mode (llm if using actual model, fallback if using heuristics)
   */
  getMode(): 'llm' | 'fallback';

  /**
   * Generate text from a prompt
   */
  generateText(prompt: string, options?: LlmGenerationOptions): Promise<LlmGenerationResult>;

  /**
   * Cleanup resources
   */
  dispose(): Promise<void>;
}

