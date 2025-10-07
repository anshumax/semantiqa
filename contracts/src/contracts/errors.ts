import { z } from 'zod';

import { NonEmptyString } from './common';

export const ErrorCodeSchema = z.enum([
  'POLICY_VIOLATION',
  'DIALECT_UNSUPPORTED',
  'TIMEOUT',
  'VALIDATION_ERROR',
  'AUTH_REQUIRED',
  'NOT_FOUND',
]);

export type ErrorCode = z.infer<typeof ErrorCodeSchema>;

export const SemantiqaErrorSchema = z.object({
  code: ErrorCodeSchema,
  message: NonEmptyString,
  details: z.unknown().optional(),
});

export type SemantiqaError = z.infer<typeof SemantiqaErrorSchema>;
