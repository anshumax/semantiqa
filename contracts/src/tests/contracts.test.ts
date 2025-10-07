import { describe, expect, it } from 'vitest';

import {
  AuditListRequestSchema,
  ModelsEnableRequestSchema,
  NlSqlGenerateRequestSchema,
  QueryRunReadOnlyRequestSchema,
  SearchSemanticRequestSchema,
  SourcesAddRequestSchema,
} from '../contracts';

describe('Contracts validation', () => {
  it('validates SourcesAddRequest for Postgres', () => {
    const result = SourcesAddRequestSchema.safeParse({
      kind: 'postgres',
      name: 'FakeBank PG',
      connection: {
        host: 'localhost',
        port: 5432,
        database: 'fakebank',
        user: 'readonly',
        password: 'secret',
        ssl: false,
      },
      owners: ['data-team'],
      tags: ['postgres', 'fakebank'],
    });

    expect(result.success).toBe(true);
  });

  it('rejects SourcesAddRequest with missing connection fields', () => {
    const result = SourcesAddRequestSchema.safeParse({
      kind: 'postgres',
      name: 'Broken',
      connection: {
        host: 'localhost',
      },
    });

    expect(result.success).toBe(false);
  });

  it('validates SearchSemanticRequest with scope', () => {
    const result = SearchSemanticRequestSchema.safeParse({
      q: 'credit limit',
      scope: {
        sourceIds: ['source-1'],
        types: ['table', 'column'],
        limit: 5,
      },
    });

    expect(result.success).toBe(true);
  });

  it('validates QueryRunReadOnlyRequest defaults', () => {
    const result = QueryRunReadOnlyRequestSchema.safeParse({
      sourceId: 'source-1',
      sql: 'SELECT 1',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.maxRows).toBe(500);
    }
  });

  it('validates ModelsEnableRequest tasks', () => {
    const result = ModelsEnableRequestSchema.safeParse({
      id: 'model-1',
      tasks: ['summaries', 'nlsql'],
    });

    expect(result.success).toBe(true);
  });

  it('validates NL SQL request scope defaults', () => {
    const result = NlSqlGenerateRequestSchema.safeParse({
      question: 'How many accounts were opened last month?',
      scope: null,
    });

    expect(result.success).toBe(true);
  });

  it('fails NL SQL request with empty question', () => {
    const result = NlSqlGenerateRequestSchema.safeParse({ question: '' });
    expect(result.success).toBe(false);
  });

  it('validates AuditListRequest empty', () => {
    const result = AuditListRequestSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});
