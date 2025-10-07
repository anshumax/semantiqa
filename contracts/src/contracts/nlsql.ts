import { z } from 'zod';

import { NonEmptyString, PositiveInt } from './common';

export const NlSqlGenerateRequestSchema = z.object({
  question: NonEmptyString,
  scope: z
    .object({
      sourceId: NonEmptyString.optional(),
      tableHints: z.array(NonEmptyString).optional(),
      columnHints: z.array(NonEmptyString).optional(),
      maxJoins: PositiveInt.max(5).optional(),
    })
    .nullish(),
});

export type NlSqlGenerateRequest = z.infer<typeof NlSqlGenerateRequestSchema>;

export const NlSqlCandidateSchema = z.object({
  sql: NonEmptyString,
  plan: z.string().optional(),
  warnings: z.array(NonEmptyString).default([]),
});

export type NlSqlCandidate = z.infer<typeof NlSqlCandidateSchema>;

export const NlSqlGenerateResponseSchema = z.object({
  question: NonEmptyString,
  candidates: z.array(
    NlSqlCandidateSchema.extend({
      policy: z
        .object({
          allowed: z.boolean(),
          reasons: z.array(NonEmptyString).default([]),
        })
        .default({ allowed: true, reasons: [] }),
    }),
  ),
});

export type NlSqlGenerateResponse = z.infer<typeof NlSqlGenerateResponseSchema>;
