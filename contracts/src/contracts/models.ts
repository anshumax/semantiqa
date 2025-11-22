import { z } from 'zod';

import { ModelTaskSchema, NonEmptyString, PositiveInt } from './common';

export const ModelManifestEntrySchema = z.object({
  id: NonEmptyString,
  name: NonEmptyString,
  kind: z.enum(['embedding', 'generator']),
  sizeMb: PositiveInt,
  license: NonEmptyString,
  sha256: NonEmptyString,
  description: z.string().optional(),
  tasks: z.array(ModelTaskSchema),
});

export type ModelManifestEntry = z.infer<typeof ModelManifestEntrySchema>;

export const ModelsListResponseSchema = z.object({
  installed: z.array(
    ModelManifestEntrySchema.extend({
      installedAt: NonEmptyString,
      enabledTasks: z.array(ModelTaskSchema),
      path: NonEmptyString.optional(),
    }),
  ),
  available: z.array(ModelManifestEntrySchema),
});

export type ModelsListResponse = z.infer<typeof ModelsListResponseSchema>;

export const ModelsDownloadRequestSchema = z.object({
  id: NonEmptyString,
});

export type ModelsDownloadRequest = z.infer<typeof ModelsDownloadRequestSchema>;

export const ModelsEnableRequestSchema = z.object({
  id: NonEmptyString,
  tasks: z.array(ModelTaskSchema).min(1),
});

export type ModelsEnableRequest = z.infer<typeof ModelsEnableRequestSchema>;

export const ModelsHealthcheckRequestSchema = z.object({
  id: NonEmptyString.optional(),
});

export type ModelsHealthcheckRequest = z.infer<typeof ModelsHealthcheckRequestSchema>;

export const ModelsHealthcheckResponseSchema = z.object({
  id: NonEmptyString,
  ok: z.boolean(),
  latencyMs: PositiveInt,
  tokensPerSec: PositiveInt.nullable(),
  errors: z.array(NonEmptyString).default([]),
});

export type ModelsHealthcheckResponse = z.infer<typeof ModelsHealthcheckResponseSchema>;
