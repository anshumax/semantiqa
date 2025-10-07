import { z } from 'zod';

import { IsoDateTimeSchema, NonEmptyString } from './common';

export const AuditEntrySchema = z.object({
  id: NonEmptyString,
  actor: NonEmptyString,
  entity: NonEmptyString,
  entityId: NonEmptyString.nullable(),
  action: NonEmptyString,
  inputHash: NonEmptyString.optional(),
  input: z.unknown().optional(),
  outcome: z.unknown().optional(),
  timestamp: IsoDateTimeSchema,
});

export type AuditEntry = z.infer<typeof AuditEntrySchema>;

export const AuditListRequestSchema = z.object({
  since: IsoDateTimeSchema.optional(),
});

export type AuditListRequest = z.infer<typeof AuditListRequestSchema>;

export const AuditListResponseSchema = z.object({
  entries: z.array(AuditEntrySchema),
});

export type AuditListResponse = z.infer<typeof AuditListResponseSchema>;
