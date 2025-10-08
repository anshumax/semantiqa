import { describe, expect, it } from 'vitest';

import { HybridSearchService } from '../src/hybridSearch';

describe('HybridSearchService', () => {
  it('combines keyword and vector scores', async () => {
    const service = new HybridSearchService({
      keywordIndex: [
        { ownerId: 'table:accounts', name: 'Accounts Table' },
        { ownerId: 'table:customers', name: 'Customers Table' },
      ],
      initialEmbeddings: {
        'table:accounts': [1, 0, 0],
        'table:customers': [0, 1, 0],
      },
    });

    const results = await service.hybridSearch('Accounts', [1, 0, 0], 2);

    expect(results[0].ownerId).toBe('table:accounts');
    expect(results[0].totalScore).toBeGreaterThan(results[1].totalScore);
  });
});


