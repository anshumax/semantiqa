function createInferenceSession() {
  if (!onnxModule) {
    throw new Error('onnxruntime-node dependency not available');
  }
  return onnxModule.InferenceSession;
}
import { join } from 'node:path';

type InferenceSession = ReturnType<typeof createInferenceSession>

let onnxModule: { InferenceSession: { create: (...args: any[]) => Promise<any> } } | undefined;
if (typeof window === 'undefined') {
  try {
    // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
    onnxModule = require('onnxruntime-node');
  } catch (error) {
    onnxModule = undefined;
  }
}

export interface EmbeddingModelConfig {
  modelId: string;
  modelPath: string;
  dimension: number;
}

export interface EmbeddingVectorResult {
  vector: number[];
  modelId: string;
}

export class EmbeddingService {
  private session?: Awaited<ReturnType<ReturnType<typeof createInferenceSession>['create']>>;

  constructor(private readonly config: EmbeddingModelConfig) {}

  async load() {
    if (this.session || !onnxModule) {
      return;
    }
    const modelFile = join(process.cwd(), this.config.modelPath);
    this.session = await onnxModule.InferenceSession.create(modelFile, { executionProviders: ['cpu'] });
  }

  async embed(text: string): Promise<EmbeddingVectorResult> {
    if (!onnxModule) {
      const hashVector = hashText(text, this.config.dimension);
      return { vector: hashVector, modelId: this.config.modelId };
    }

    if (!this.session) {
      await this.load();
    }
    const tokens = tokenize(text);
    const inputTensor = buildInputTensor(tokens);
    const output = await this.session!.run({ input: inputTensor });
    const vector = Array.from(output.output.data as Float32Array);
    return { vector, modelId: this.config.modelId };
  }
}

function tokenize(text: string): number[] {
  const words = text.toLowerCase().split(/\W+/).filter(Boolean);
  return words.map((word) => Math.min(word.length, 32));
}

function buildInputTensor(tokens: number[]) {
  const padded = new Float32Array(tokens.length || 1);
  tokens.forEach((token, index) => {
    padded[index] = token;
  });

  return {
    type: 'float32',
    data: padded,
    dims: [1, padded.length],
  } as unknown as import('onnxruntime-node').Tensor;
}

function hashText(text: string, dimension: number): number[] {
  const vector = new Array<number>(dimension).fill(0);
  for (let i = 0; i < text.length; i += 1) {
    const charCode = text.charCodeAt(i);
    const index = i % dimension;
    vector[index] += charCode / 255;
  }
  const mag = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  return mag === 0 ? vector : vector.map((value) => value / mag);
}


