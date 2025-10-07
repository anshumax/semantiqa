import { z } from 'zod';

import { NonEmptyString, PositiveInt } from './common';

export const QueryRunReadOnlyRequestSchema = z.object({
  sourceId: NonEmptyString,
  sql: NonEmptyString,
  maxRows: PositiveInt.max(10_000).default(500),
});

export type QueryRunReadOnlyRequest = z.infer<typeof QueryRunReadOnlyRequestSchema>;

export const QueryColumnSchema = z.object({
  name: NonEmptyString,
  type: NonEmptyString,
  nullable: z.boolean(),
});

export type QueryColumn = z.infer<typeof QueryColumnSchema>;

export const QueryResultSchema = z.object({
  columns: z.array(QueryColumnSchema),
  rows: z.array(z.record(NonEmptyString, z.unknown())),
  truncated: z.boolean(),
  executionMs: z.number().int().min(0).optional(),
  warnings: z.array(NonEmptyString).default([]),
});

export type QueryResult = z.infer<typeof QueryResultSchema>;
