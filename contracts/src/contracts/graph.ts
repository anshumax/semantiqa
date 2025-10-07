import { z } from 'zod';

import {
  GraphNodeTypeSchema,
  IsoDateTimeSchema,
  NonEmptyString,
  SensitivityLevelSchema,
  VerificationStatusSchema,
} from './common';

export const GraphNodePropsSchema = z.object({
  displayName: NonEmptyString,
  description: z.string().optional(),
  owners: z.array(NonEmptyString).default([]),
  tags: z.array(NonEmptyString).default([]),
  sensitivity: SensitivityLevelSchema.default('internal'),
  status: VerificationStatusSchema.default('draft'),
});

export type GraphNodeProps = z.infer<typeof GraphNodePropsSchema>;

export const GraphNodeSchema = z.object({
  id: NonEmptyString,
  type: GraphNodeTypeSchema,
  props: GraphNodePropsSchema,
  originDeviceId: NonEmptyString.optional(),
  createdAt: IsoDateTimeSchema.optional(),
  updatedAt: IsoDateTimeSchema.optional(),
});

export type GraphNode = z.infer<typeof GraphNodeSchema>;

export const GraphEdgeSchema = z.object({
  id: NonEmptyString,
  srcId: NonEmptyString,
  dstId: NonEmptyString,
  type: NonEmptyString,
  props: z.record(z.string(), z.unknown()).default({}),
  createdAt: IsoDateTimeSchema.optional(),
  updatedAt: IsoDateTimeSchema.optional(),
});

export type GraphEdge = z.infer<typeof GraphEdgeSchema>;

export const GraphUpsertNodeRequestSchema = z.object({
  patch: GraphNodeSchema.partial({ id: true }),
});

export type GraphUpsertNodeRequest = z.infer<typeof GraphUpsertNodeRequestSchema>;

export const GraphGetResponseSchema = z.object({
  nodes: z.array(GraphNodeSchema),
  edges: z.array(GraphEdgeSchema),
  stats: z.record(z.string(), z.number()).optional(),
});

export type GraphGetResponse = z.infer<typeof GraphGetResponseSchema>;
