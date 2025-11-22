import { z } from 'zod';
import { NonEmptyString } from './common';

export const SummaryTypeSchema = z.enum(['heuristic', 'ai_generated', 'user_edited']);

export type SummaryType = z.infer<typeof SummaryTypeSchema>;

export const SummaryModeSchema = z.enum(['auto', 'ai', 'heuristic']);

export type SummaryMode = z.infer<typeof SummaryModeSchema>;

export const GenerateSummaryRequestSchema = z.object({
  nodeId: NonEmptyString,
  force: z.boolean().optional(),
  mode: SummaryModeSchema.optional(), // 'auto' (default), 'ai', or 'heuristic'
});

export type GenerateSummaryRequest = z.infer<typeof GenerateSummaryRequestSchema>;

export const GenerateSummaryResponseSchema = z.object({
  nodeId: NonEmptyString,
  summary: z.string(),
  summaryType: SummaryTypeSchema,
  generatedAt: z.string(),
});

export type GenerateSummaryResponse = z.infer<typeof GenerateSummaryResponseSchema>;

export const GenerateBatchSummariesRequestSchema = z.object({
  nodeIds: z.array(NonEmptyString).min(1),
});

export type GenerateBatchSummariesRequest = z.infer<typeof GenerateBatchSummariesRequestSchema>;

export const BatchSummaryResultSchema = z.object({
  nodeId: NonEmptyString,
  success: z.boolean(),
  summary: z.string().optional(),
  summaryType: SummaryTypeSchema.optional(),
  generatedAt: z.string().optional(),
  error: z.string().optional(),
});

export type BatchSummaryResult = z.infer<typeof BatchSummaryResultSchema>;

export const GenerateBatchSummariesResponseSchema = z.object({
  results: z.array(BatchSummaryResultSchema),
  successCount: z.number(),
  failureCount: z.number(),
});

export type GenerateBatchSummariesResponse = z.infer<typeof GenerateBatchSummariesResponseSchema>;

