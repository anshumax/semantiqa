declare module 'onnxruntime-node' {
  export interface Tensor {
    type: string;
    data: Float32Array;
    dims: number[];
  }

  export class InferenceSession {
    static create(modelPath: string, options?: Record<string, unknown>): Promise<InferenceSession>;
    run(feeds: Record<string, Tensor>): Promise<Record<string, { data: Float32Array }>>;
  }
}


