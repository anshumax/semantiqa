import { describe, expect, it, vi } from 'vitest';

import { loadModelManifest } from '../src/models';

vi.mock('node:fs', () => ({
  promises: {
    readFile: vi.fn().mockResolvedValue(
      JSON.stringify({
        version: '1.0',
        models: [
          {
            id: 'embed-bge-small-onnx',
            name: 'BGE Small (ONNX)',
            kind: 'embedding',
            size_mb: 95,
            license: 'Apache-2.0',
            sha256: 'placeholder',
            url: 'https://example.com/embed.onnx',
          },
        ],
      }),
    ),
  },
}));

vi.mock('node:path', () => ({
  join: (...segments: string[]) => segments.join('/'),
}));

describe('loadModelManifest', () => {
  it('loads manifest entries', async () => {
    const models = await loadModelManifest();

    expect(models).toHaveLength(1);
    expect(models[0]).toEqual(
      expect.objectContaining({ id: 'embed-bge-small-onnx', kind: 'embedding' }),
    );
  });
});


