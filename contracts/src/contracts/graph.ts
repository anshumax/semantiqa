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

export const GraphGetRequestSchema = z.object({
  filter: z
    .object({
      scope: z.enum(['schema', 'metadata']).optional(),
      sourceIds: z.array(NonEmptyString).optional(),
      includeEdges: z.boolean().optional(),
    })
    .optional(),
});

export type GraphGetRequest = z.infer<typeof GraphGetRequestSchema>;

export const GraphGetResponseSchema = z.object({
  nodes: z.array(GraphNodeSchema),
  edges: z.array(GraphEdgeSchema),
  stats: z.record(z.string(), z.number()).optional(),
});

export type GraphGetResponse = z.infer<typeof GraphGetResponseSchema>;

export const ExplorerSourceSchema = z.object({
  id: NonEmptyString,
  name: NonEmptyString,
  kind: z.enum(['postgres', 'mysql', 'mongo', 'duckdb']),
  status: z
    .enum(['not_crawled', 'crawling', 'crawled', 'error'])
    .default('not_crawled'),
  connectionStatus: z.enum(['unknown', 'checking', 'connected', 'error']).default('unknown'),
  lastCrawlAt: IsoDateTimeSchema.optional(),
  lastError: z.string().optional(),
  lastConnectedAt: IsoDateTimeSchema.optional(),
  lastConnectionError: z.string().optional(),
  owners: z.array(NonEmptyString).default([]),
  tags: z.array(NonEmptyString).default([]),
});

export type ExplorerSource = z.infer<typeof ExplorerSourceSchema>;

export const ExplorerTreeNodeSchema = z.object({
  id: NonEmptyString,
  parentId: NonEmptyString.optional(),
  type: z.enum(['schema', 'table', 'view', 'collection', 'field']),
  label: NonEmptyString,
  meta: z.record(z.string(), z.unknown()).default({}),
  hasChildren: z.boolean().default(false),
});

export type ExplorerTreeNode = z.infer<typeof ExplorerTreeNodeSchema>;

export const ExplorerSnapshotSchema = z.object({
  sources: z.array(ExplorerSourceSchema),
  nodes: z.array(ExplorerTreeNodeSchema),
  fetchedAt: IsoDateTimeSchema,
});

export type ExplorerSnapshot = z.infer<typeof ExplorerSnapshotSchema>;

export const ColumnSampleSchema = z.object({
  name: NonEmptyString,
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
});

export type ColumnSample = z.infer<typeof ColumnSampleSchema>;

export const TableProfileSchema = z.object({
  rowCount: z.number().int().nonnegative().optional(),
  columns: z.array(
    z.object({
      name: NonEmptyString,
      type: z.string(),
      nullPercent: z.number().min(0).max(100).optional(),
      distinctPercent: z.number().min(0).max(100).optional(),
      min: z.union([z.string(), z.number()]).optional(),
      max: z.union([z.string(), z.number()]).optional(),
      samples: z.array(ColumnSampleSchema).optional(),
    }),
  ),
});

export type TableProfile = z.infer<typeof TableProfileSchema>;

export const ExplorerTableDetailSchema = z.object({
  id: NonEmptyString,
  name: NonEmptyString,
  schema: z.string().optional(),
  description: z.string().optional(),
  owners: z.array(NonEmptyString).default([]),
  tags: z.array(NonEmptyString).default([]),
  sensitivity: SensitivityLevelSchema.default('internal'),
  status: VerificationStatusSchema.default('draft'),
  columns: z.array(
    z.object({
      id: NonEmptyString,
      name: NonEmptyString,
      type: z.string(),
      description: z.string().optional(),
      nullable: z.boolean().optional(),
      sensitivity: SensitivityLevelSchema.optional(),
    }),
  ),
  profile: TableProfileSchema.optional(),
});

export type ExplorerTableDetail = z.infer<typeof ExplorerTableDetailSchema>;

export const InspectorPatchSchema = GraphNodeSchema.pick({ id: true }).merge(
  z.object({
    props: GraphNodePropsSchema.partial(),
  }),
);

export type InspectorPatch = z.infer<typeof InspectorPatchSchema>;

export const ResultsGridColumnSchema = z.object({
  id: NonEmptyString,
  name: NonEmptyString,
  type: z.string(),
  masked: z.boolean().default(false),
  pii: z.boolean().default(false),
});

export type ResultsGridColumn = z.infer<typeof ResultsGridColumnSchema>;

export const ResultsGridRowSchema = z.record(z.string(), z.unknown());

export type ResultsGridRow = z.infer<typeof ResultsGridRowSchema>;

export const ResultsGridSchema = z.object({
  columns: z.array(ResultsGridColumnSchema),
  rows: z.array(ResultsGridRowSchema),
  truncated: z.boolean().default(false),
  maskedFields: z.array(NonEmptyString).default([]),
});

export type ResultsGrid = z.infer<typeof ResultsGridSchema>;