import { describe, expect, it } from 'vitest';

import { VectorIndex } from '../src/vectorIndex';

describe('VectorIndex', () => {
  it('indexes and searches vectors', () => {
    const index = new VectorIndex({
      initialEmbeddings: {
        'table:accounts': [1, 0, 0],
        'table:customers': [0, 1, 0],
      },
    });

    const results = index.search([1, 0, 0], 1);

    expect(results[0]).toEqual({ ownerId: 'table:accounts', score: 1 });
  });
});


