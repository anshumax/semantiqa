import { z } from 'zod';

export const SourceKindSchema = z.enum(['postgres', 'mysql', 'mongo', 'duckdb']);
export type SourceKind = z.infer<typeof SourceKindSchema>;

export const ModelTaskSchema = z.enum(['summaries', 'nlsql']);
export type ModelTask = z.infer<typeof ModelTaskSchema>;

export const GraphNodeTypeSchema = z.enum([
  'source',
  'schema',
  'table',
  'column',
  'collection',
  'field',
  'metric',
  'domain',
  'note',
]);
export type GraphNodeType = z.infer<typeof GraphNodeTypeSchema>;

export const SensitivityLevelSchema = z.enum(['public', 'internal', 'restricted', 'confidential']);
export type SensitivityLevel = z.infer<typeof SensitivityLevelSchema>;

export const VerificationStatusSchema = z.enum(['draft', 'verified', 'deprecated']);
export type VerificationStatus = z.infer<typeof VerificationStatusSchema>;

export const IsoDateTimeSchema = z
  .string()
  .min(1)
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: 'Invalid ISO date-time string',
  });

export const NonEmptyString = z.string().min(1);

export const PositiveInt = z.number().int().positive();

export const NonNegativeNumber = z.number().min(0);
