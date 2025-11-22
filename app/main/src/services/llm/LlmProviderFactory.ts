import type { ILlmProvider } from './ILlmProvider.js';
import { LocalLlamaProvider } from './LocalLlamaProvider.js';
import { ExternalLlmProvider } from './ExternalLlmProvider.js';

export type LlmProviderType = 'local' | 'external';

export interface LlmProviderConfig {
  type: LlmProviderType;
  modelPath?: string;  // For local provider
  endpoint?: string;   // For external provider
  apiKey?: string;     // For external provider
}

/**
 * Factory for creating LLM providers
 */
export class LlmProviderFactory {
  static createProvider(config: LlmProviderConfig): ILlmProvider {
    switch (config.type) {
      case 'local':
        return new LocalLlamaProvider();
      
      case 'external':
        return new ExternalLlmProvider();
      
      default:
        throw new Error(`Unknown LLM provider type: ${(config as any).type}`);
    }
  }

  /**
   * Create default provider (local)
   */
  static createDefault(): ILlmProvider {
    return new LocalLlamaProvider();
  }
}

