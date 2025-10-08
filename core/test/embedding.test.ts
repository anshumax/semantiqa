import { describe, expect, it } from 'vitest';

import { EmbeddingService } from '../src/embedding';

describe('EmbeddingService', () => {
  it('returns embedding vector with model id (fallback)', async () => {
    const service = new EmbeddingService({
      modelId: 'embed-bge-small-onnx',
      modelPath: 'models/embed-bge-small.onnx',
      dimension: 3,
    });

    const result = await service.embed('hello world');

    expect(result.modelId).toBe('embed-bge-small-onnx');
    expect(result.vector).toHaveLength(3);
    expect(result.vector.every((value) => Number.isFinite(value))).toBe(true);
  });
});


