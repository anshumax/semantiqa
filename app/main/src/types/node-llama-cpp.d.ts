declare module 'node-llama-cpp' {
  export interface LlamaModelOptions {
    modelPath: string;
    gpuLayers?: number;
    seed?: number;
    contextSize?: number;
    embedding?: boolean;
  }

  export interface LlamaContextOptions {
    model: LlamaModel;
    threads?: number;
    batchSize?: number;
  }

  export interface PromptOptions {
    maxTokens?: number;
    temperature?: number;
    topP?: number;
    repeatPenalty?: number;
    stop?: string[];
  }

  export class LlamaModel {
    constructor(options: LlamaModelOptions);
    dispose(): void;
  }

  export class LlamaContext {
    constructor(options: LlamaContextOptions);
    dispose(): void;
  }

  export interface LlamaChatSessionOptions {
    context: LlamaContext;
    systemPrompt?: string;
  }

  export class LlamaChatSession {
    constructor(options: LlamaChatSessionOptions);
    prompt(message: string, options?: PromptOptions): Promise<string>;
    dispose(): void;
  }
}

