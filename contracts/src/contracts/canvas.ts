import { z } from 'zod';

import { IsoDateTimeSchema, NonEmptyString } from './common';

// Canvas viewport and global state
export const CanvasViewportSchema = z.object({
  zoom: z.number().min(0.1).max(5.0).default(1.0),
  centerX: z.number().default(0.0),
  centerY: z.number().default(0.0),
});

export type CanvasViewport = z.infer<typeof CanvasViewportSchema>;

export const CanvasStateSchema = z.object({
  id: NonEmptyString.default('default'),
  name: NonEmptyString.default('Main Canvas'),
  description: z.string().optional(),
  viewport: CanvasViewportSchema,
  gridSize: z.number().int().min(10).max(100).default(20),
  snapToGrid: z.boolean().default(true),
  autoSave: z.boolean().default(true),
  theme: z.enum(['dark', 'light']).default('dark'),
  canvasVersion: NonEmptyString.default('2.1'),
  createdAt: IsoDateTimeSchema.optional(),
  updatedAt: IsoDateTimeSchema.optional(),
  lastSavedAt: IsoDateTimeSchema.optional(),
});

export type CanvasState = z.infer<typeof CanvasStateSchema>;

// Canvas block representing a data source
export const CanvasPositionSchema = z.object({
  x: z.number(),
  y: z.number(),
});

export type CanvasPosition = z.infer<typeof CanvasPositionSchema>;

export const CanvasSizeSchema = z.object({
  width: z.number().min(100).max(500).default(200),
  height: z.number().min(80).max(300).default(120),
});

export type CanvasSize = z.infer<typeof CanvasSizeSchema>;

export const CanvasBlockSchema = z.object({
  id: NonEmptyString,
  canvasId: NonEmptyString.default('default'),
  sourceId: NonEmptyString,
  position: CanvasPositionSchema,
  size: CanvasSizeSchema,
  zIndex: z.number().int().default(0),
  colorTheme: z.enum(['auto', 'blue', 'green', 'purple', 'orange', 'red']).default('auto'),
  isSelected: z.boolean().default(false),
  isMinimized: z.boolean().default(false),
  customTitle: z.string().optional(),
  createdAt: IsoDateTimeSchema.optional(),
  updatedAt: IsoDateTimeSchema.optional(),
});

export type CanvasBlock = z.infer<typeof CanvasBlockSchema>;

// Canvas relationship with visual properties
export const CanvasRelationshipStyleSchema = z.enum(['solid', 'dashed', 'dotted']);
export const CanvasRelationshipTypeSchema = z.enum(['semantic_link', 'foreign_key', 'derives_from']);

export type CanvasRelationshipStyle = z.infer<typeof CanvasRelationshipStyleSchema>;
export type CanvasRelationshipType = z.infer<typeof CanvasRelationshipTypeSchema>;

export const CanvasRelationshipSchema = z.object({
  id: NonEmptyString,
  canvasId: NonEmptyString.default('default'),
  sourceBlockId: NonEmptyString,
  targetBlockId: NonEmptyString,
  sourceTableName: NonEmptyString,
  sourceColumnName: NonEmptyString,
  targetTableName: NonEmptyString,
  targetColumnName: NonEmptyString,
  relationshipType: CanvasRelationshipTypeSchema.default('semantic_link'),
  confidenceScore: z.number().min(0).max(1).default(1.0),
  visualStyle: CanvasRelationshipStyleSchema.default('solid'),
  lineColor: NonEmptyString.default('#8bb4f7'),
  lineWidth: z.number().min(1).max(10).default(2),
  curvePath: z.string().optional(), // SVG path data
  isIntraSource: z.boolean().default(false),
  isSelected: z.boolean().default(false),
  createdAt: IsoDateTimeSchema.optional(),
  updatedAt: IsoDateTimeSchema.optional(),
});

export type CanvasRelationship = z.infer<typeof CanvasRelationshipSchema>;

// Canvas navigation for drill-down
export const CanvasNavigationLevelSchema = z.object({
  level: z.number().int().min(0).max(2),
  sourceId: NonEmptyString.optional(),
  schema: z.string().optional(),
  breadcrumbs: z.array(z.object({
    label: NonEmptyString,
    level: z.number().int(),
    sourceId: NonEmptyString.optional(),
    schema: z.string().optional(),
  })).default([]),
});

export type CanvasNavigationLevel = z.infer<typeof CanvasNavigationLevelSchema>;

// Canvas layout settings
export const CanvasLayoutAlgorithmSchema = z.enum(['force_directed', 'hierarchical', 'grid', 'manual']);

export const CanvasLayoutSettingsSchema = z.object({
  id: NonEmptyString.default('default'),
  canvasId: NonEmptyString.default('default'),
  algorithm: CanvasLayoutAlgorithmSchema.default('force_directed'),
  nodeSpacing: z.number().min(100).max(500).default(250),
  levelSpacing: z.number().min(100).max(300).default(180),
  autoArrange: z.boolean().default(true),
  collisionDetection: z.boolean().default(true),
  settings: z.record(z.string(), z.unknown()).default({}),
});

export type CanvasLayoutSettings = z.infer<typeof CanvasLayoutSettingsSchema>;

// Semantic relationships for canvas integration
export const SemanticRelationshipSchema = z.object({
  id: NonEmptyString,
  sourceNodeId: NonEmptyString,
  targetNodeId: NonEmptyString,
  sourceFieldPath: NonEmptyString,
  targetFieldPath: NonEmptyString,
  relationshipType: CanvasRelationshipTypeSchema.default('semantic_link'),
  confidenceScore: z.number().min(0).max(1),
  detectionMethod: z.enum(['manual', 'name_similarity', 'type_inference', 'statistical']).default('manual'),
  validationStatus: z.enum(['unvalidated', 'confirmed', 'rejected']).default('unvalidated'),
  metadata: z.record(z.string(), z.unknown()).default({}),
  createdAt: IsoDateTimeSchema.optional(),
  updatedAt: IsoDateTimeSchema.optional(),
});

export type SemanticRelationship = z.infer<typeof SemanticRelationshipSchema>;

// Canvas change tracking for undo/redo
export const CanvasChangeTypeSchema = z.enum([
  'block_move',
  'block_create', 
  'block_delete',
  'block_resize',
  'relationship_create',
  'relationship_delete',
  'relationship_edit',
  'canvas_state_update',
  'viewport_change'
]);

export const CanvasChangeSchema = z.object({
  id: NonEmptyString,
  canvasId: NonEmptyString.default('default'),
  changeType: CanvasChangeTypeSchema,
  entityId: NonEmptyString,
  entityType: z.enum(['block', 'relationship', 'canvas_state']),
  oldState: z.record(z.string(), z.unknown()).optional(),
  newState: z.record(z.string(), z.unknown()).optional(),
  changeTimestamp: IsoDateTimeSchema,
  userActionId: NonEmptyString.optional(), // Groups related changes
});

export type CanvasChange = z.infer<typeof CanvasChangeSchema>;

// Canvas API request/response schemas

// Get canvas state
export const CanvasGetRequestSchema = z.object({
  canvasId: NonEmptyString.optional().default('default'),
  includeBlocks: z.boolean().default(true),
  includeRelationships: z.boolean().default(true),
  includeLevelData: z.boolean().default(false),
});

export type CanvasGetRequest = z.infer<typeof CanvasGetRequestSchema>;

export const CanvasGetResponseSchema = z.object({
  canvas: CanvasStateSchema,
  blocks: z.array(CanvasBlockSchema).default([]),
  relationships: z.array(CanvasRelationshipSchema).default([]),
  navigationLevel: CanvasNavigationLevelSchema.optional(),
  layoutSettings: CanvasLayoutSettingsSchema.optional(),
});

export type CanvasGetResponse = z.infer<typeof CanvasGetResponseSchema>;

// Update canvas state
export const CanvasUpdateRequestSchema = z.object({
  canvasId: NonEmptyString.optional().default('default'),
  canvas: CanvasStateSchema.partial().optional(),
  blocks: z.array(CanvasBlockSchema.partial().extend({ id: NonEmptyString })).optional(),
  relationships: z.array(CanvasRelationshipSchema.partial().extend({ id: NonEmptyString })).optional(),
  userActionId: NonEmptyString.optional(),
});

export type CanvasUpdateRequest = z.infer<typeof CanvasUpdateRequestSchema>;

export const CanvasUpdateResponseSchema = z.object({
  success: z.boolean(),
  updatedCanvas: CanvasStateSchema.optional(),
  updatedBlocks: z.array(CanvasBlockSchema).optional(),
  updatedRelationships: z.array(CanvasRelationshipSchema).optional(),
});

export type CanvasUpdateResponse = z.infer<typeof CanvasUpdateResponseSchema>;

// Create canvas block
export const CanvasBlockCreateRequestSchema = z.object({
  canvasId: NonEmptyString.optional().default('default'),
  sourceId: NonEmptyString,
  position: CanvasPositionSchema,
  size: CanvasSizeSchema.optional(),
  colorTheme: CanvasBlockSchema.shape.colorTheme.optional(),
  customTitle: z.string().optional(),
});

export type CanvasBlockCreateRequest = z.infer<typeof CanvasBlockCreateRequestSchema>;

export const CanvasBlockCreateResponseSchema = z.object({
  block: CanvasBlockSchema,
});

export type CanvasBlockCreateResponse = z.infer<typeof CanvasBlockCreateResponseSchema>;

// Update canvas block
export const CanvasBlockUpdateRequestSchema = z.object({
  blockId: NonEmptyString,
  position: CanvasPositionSchema.optional(),
  size: CanvasSizeSchema.optional(),
  colorTheme: CanvasBlockSchema.shape.colorTheme.optional(),
  isSelected: z.boolean().optional(),
  isMinimized: z.boolean().optional(),
  customTitle: z.string().optional(),
  userActionId: NonEmptyString.optional(),
});

export type CanvasBlockUpdateRequest = z.infer<typeof CanvasBlockUpdateRequestSchema>;

export const CanvasBlockUpdateResponseSchema = z.object({
  block: CanvasBlockSchema,
});

export type CanvasBlockUpdateResponse = z.infer<typeof CanvasBlockUpdateResponseSchema>;

// Delete canvas block
export const CanvasBlockDeleteRequestSchema = z.object({
  blockId: NonEmptyString,
  userActionId: NonEmptyString.optional(),
});

export type CanvasBlockDeleteRequest = z.infer<typeof CanvasBlockDeleteRequestSchema>;

export const CanvasBlockDeleteResponseSchema = z.object({
  success: z.boolean(),
  deletedRelationships: z.array(NonEmptyString).default([]), // IDs of relationships that were also deleted
});

export type CanvasBlockDeleteResponse = z.infer<typeof CanvasBlockDeleteResponseSchema>;

// Create canvas relationship
export const CanvasRelationshipCreateRequestSchema = z.object({
  canvasId: NonEmptyString.optional().default('default'),
  sourceBlockId: NonEmptyString,
  targetBlockId: NonEmptyString,
  sourceTableName: NonEmptyString,
  sourceColumnName: NonEmptyString,
  targetTableName: NonEmptyString,
  targetColumnName: NonEmptyString,
  relationshipType: CanvasRelationshipTypeSchema.optional(),
  confidenceScore: z.number().min(0).max(1).optional(),
  userActionId: NonEmptyString.optional(),
});

export type CanvasRelationshipCreateRequest = z.infer<typeof CanvasRelationshipCreateRequestSchema>;

export const CanvasRelationshipCreateResponseSchema = z.object({
  relationship: CanvasRelationshipSchema,
});

export type CanvasRelationshipCreateResponse = z.infer<typeof CanvasRelationshipCreateResponseSchema>;

// Update canvas relationship
export const CanvasRelationshipUpdateRequestSchema = z.object({
  relationshipId: NonEmptyString,
  visualStyle: CanvasRelationshipStyleSchema.optional(),
  lineColor: NonEmptyString.optional(),
  lineWidth: z.number().min(1).max(10).optional(),
  curvePath: z.string().optional(),
  isSelected: z.boolean().optional(),
  userActionId: NonEmptyString.optional(),
});

export type CanvasRelationshipUpdateRequest = z.infer<typeof CanvasRelationshipUpdateRequestSchema>;

export const CanvasRelationshipUpdateResponseSchema = z.object({
  relationship: CanvasRelationshipSchema,
});

export type CanvasRelationshipUpdateResponse = z.infer<typeof CanvasRelationshipUpdateResponseSchema>;

// Delete canvas relationship
export const CanvasRelationshipDeleteRequestSchema = z.object({
  relationshipId: NonEmptyString,
  userActionId: NonEmptyString.optional(),
});

export type CanvasRelationshipDeleteRequest = z.infer<typeof CanvasRelationshipDeleteRequestSchema>;

export const CanvasRelationshipDeleteResponseSchema = z.object({
  success: z.boolean(),
});

export type CanvasRelationshipDeleteResponse = z.infer<typeof CanvasRelationshipDeleteResponseSchema>;

// Canvas save
export const CanvasSaveRequestSchema = z.object({
  canvasId: NonEmptyString.optional().default('default'),
  forceSave: z.boolean().default(false),
});

export type CanvasSaveRequest = z.infer<typeof CanvasSaveRequestSchema>;

export const CanvasSaveResponseSchema = z.object({
  success: z.boolean(),
  lastSavedAt: IsoDateTimeSchema,
  changesSaved: z.number().int(),
});

export type CanvasSaveResponse = z.infer<typeof CanvasSaveResponseSchema>;

// Canvas export/import
export const CanvasExportRequestSchema = z.object({
  canvasId: NonEmptyString.optional().default('default'),
  includeCredentials: z.boolean().default(false), // Security: should always be false
});

export type CanvasExportRequest = z.infer<typeof CanvasExportRequestSchema>;

export const CanvasExportDataSchema = z.object({
  canvas: CanvasStateSchema,
  blocks: z.array(CanvasBlockSchema),
  relationships: z.array(CanvasRelationshipSchema),
  sources: z.array(z.object({
    id: NonEmptyString,
    name: NonEmptyString,
    kind: z.enum(['postgres', 'mysql', 'mongo', 'duckdb']),
    connectionInfo: z.object({
      host: z.string().optional(),
      port: z.number().optional(),
      database: z.string().optional(),
      filePath: z.string().optional(),
    }).optional(), // Connection details without credentials
    owners: z.array(NonEmptyString).default([]),
    tags: z.array(NonEmptyString).default([]),
  })),
  layoutSettings: CanvasLayoutSettingsSchema.optional(),
  exportedAt: IsoDateTimeSchema,
  exportVersion: NonEmptyString.default('2.1'),
});

export type CanvasExportData = z.infer<typeof CanvasExportDataSchema>;

export const CanvasExportResponseSchema = z.object({
  exportData: CanvasExportDataSchema,
});

export type CanvasExportResponse = z.infer<typeof CanvasExportResponseSchema>;

export const CanvasImportRequestSchema = z.object({
  exportData: CanvasExportDataSchema,
  canvasId: NonEmptyString.optional().default('default'),
  mergeMode: z.enum(['replace', 'merge']).default('replace'),
});

export type CanvasImportRequest = z.infer<typeof CanvasImportRequestSchema>;

export const CanvasImportResponseSchema = z.object({
  success: z.boolean(),
  canvas: CanvasStateSchema,
  blocksCreated: z.number().int(),
  relationshipsCreated: z.number().int(),
  sourcesRequiringCredentials: z.array(NonEmptyString), // Source IDs that need re-authentication
});

export type CanvasImportResponse = z.infer<typeof CanvasImportResponseSchema>;

// Canvas auto-layout
export const CanvasAutoLayoutRequestSchema = z.object({
  canvasId: NonEmptyString.optional().default('default'),
  algorithm: CanvasLayoutAlgorithmSchema.optional(),
  preserveSelected: z.boolean().default(true),
  animateTransition: z.boolean().default(true),
});

export type CanvasAutoLayoutRequest = z.infer<typeof CanvasAutoLayoutRequestSchema>;

export const CanvasAutoLayoutResponseSchema = z.object({
  success: z.boolean(),
  updatedBlocks: z.array(CanvasBlockSchema),
  transitionDuration: z.number().optional(), // milliseconds
});

export type CanvasAutoLayoutResponse = z.infer<typeof CanvasAutoLayoutResponseSchema>;