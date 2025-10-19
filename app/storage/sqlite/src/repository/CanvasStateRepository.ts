import type { Database } from 'better-sqlite3';
import {
  CanvasState,
  CanvasBlock, 
  CanvasRelationship,
  CanvasViewport,
  CanvasPosition,
  CanvasSize,
  CanvasStateSchema,
  CanvasBlockSchema,
  CanvasRelationshipSchema
} from '@semantiqa/contracts';

export interface CanvasStateRow {
  id: string;
  name: string;
  description?: string;
  viewport_zoom: number;
  viewport_center_x: number;
  viewport_center_y: number;
  grid_size: number;
  snap_to_grid: boolean;
  auto_save: boolean;
  theme: string;
  canvas_version: string;
  created_at: string;
  updated_at: string;
  last_saved_at?: string;
}

export interface CanvasBlockRow {
  id: string;
  canvas_id: string;
  source_id: string;
  position_x: number;
  position_y: number;
  width: number;
  height: number;
  z_index: number;
  color_theme: string;
  is_selected: boolean;
  is_minimized: boolean;
  custom_title?: string;
  created_at: string;
  updated_at: string;
}

export interface CanvasRelationshipRow {
  id: string;
  canvas_id: string;
  source_block_id: string;
  target_block_id: string;
  source_table_name: string;
  source_column_name: string;
  target_table_name: string;
  target_column_name: string;
  relationship_type: string;
  confidence_score: number;
  visual_style: string;
  line_color: string;
  line_width: number;
  curve_path?: string;
  is_intra_source: boolean;
  is_selected: boolean;
  created_at: string;
  updated_at: string;
}

export class CanvasStateRepository {
  constructor(private readonly db: Database) {}

  /**
   * Get canvas state by ID, including blocks and relationships
   */
  getCanvas(canvasId: string = 'default'): {
    canvas: CanvasState;
    blocks: CanvasBlock[];
    relationships: CanvasRelationship[];
  } | null {
    // Get canvas state
    const canvasStatement = this.db.prepare<{ id: string }>(`
      SELECT id, name, description, viewport_zoom, viewport_center_x, viewport_center_y,
             grid_size, snap_to_grid, auto_save, theme, canvas_version, 
             created_at, updated_at, last_saved_at
      FROM canvas_state WHERE id = @id
    `);
    
    const canvasRow = canvasStatement.get({ id: canvasId }) as CanvasStateRow | undefined;
    if (!canvasRow) {
      return null;
    }

    // Get canvas blocks
    const blocksStatement = this.db.prepare<{ canvas_id: string }>(`
      SELECT id, canvas_id, source_id, position_x, position_y, width, height, 
             z_index, color_theme, is_selected, is_minimized, custom_title,
             created_at, updated_at
      FROM canvas_blocks WHERE canvas_id = @canvas_id
      ORDER BY z_index ASC, created_at ASC
    `);
    
    const blockRows = blocksStatement.all({ canvas_id: canvasId }) as CanvasBlockRow[];

    // Get canvas relationships
    const relationshipsStatement = this.db.prepare<{ canvas_id: string }>(`
      SELECT id, canvas_id, source_block_id, target_block_id, source_table_name, 
             source_column_name, target_table_name, target_column_name, relationship_type,
             confidence_score, visual_style, line_color, line_width, curve_path,
             is_intra_source, is_selected, created_at, updated_at
      FROM canvas_relationships WHERE canvas_id = @canvas_id
      ORDER BY created_at ASC
    `);
    
    const relationshipRows = relationshipsStatement.all({ canvas_id: canvasId }) as CanvasRelationshipRow[];

    // Convert rows to domain objects
    const canvas: CanvasState = {
      id: canvasRow.id,
      name: canvasRow.name,
      description: canvasRow.description,
      viewport: {
        zoom: canvasRow.viewport_zoom,
        centerX: canvasRow.viewport_center_x,
        centerY: canvasRow.viewport_center_y,
      },
      gridSize: canvasRow.grid_size,
      snapToGrid: canvasRow.snap_to_grid,
      autoSave: canvasRow.auto_save,
      theme: canvasRow.theme as 'dark' | 'light',
      canvasVersion: canvasRow.canvas_version,
      createdAt: canvasRow.created_at,
      updatedAt: canvasRow.updated_at,
      lastSavedAt: canvasRow.last_saved_at,
    };

    const blocks: CanvasBlock[] = blockRows.map(row => ({
      id: row.id,
      canvasId: row.canvas_id,
      sourceId: row.source_id,
      position: { x: row.position_x, y: row.position_y },
      size: { width: row.width, height: row.height },
      zIndex: row.z_index,
      colorTheme: row.color_theme as any,
      isSelected: Boolean(row.is_selected),
      isMinimized: Boolean(row.is_minimized),
      customTitle: row.custom_title,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    const relationships: CanvasRelationship[] = relationshipRows.map(row => ({
      id: row.id,
      canvasId: row.canvas_id,
      sourceBlockId: row.source_block_id,
      targetBlockId: row.target_block_id,
      sourceTableName: row.source_table_name,
      sourceColumnName: row.source_column_name,
      targetTableName: row.target_table_name,
      targetColumnName: row.target_column_name,
      relationshipType: row.relationship_type as any,
      confidenceScore: row.confidence_score,
      visualStyle: row.visual_style as any,
      lineColor: row.line_color,
      lineWidth: row.line_width,
      curvePath: row.curve_path,
      isIntraSource: Boolean(row.is_intra_source),
      isSelected: Boolean(row.is_selected),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return { canvas, blocks, relationships };
  }

  /**
   * Save or update canvas state
   */
  saveCanvasState(canvasState: Partial<CanvasState> & { id: string }): void {
    const validatedState = CanvasStateSchema.parse({
      ...canvasState,
      updatedAt: new Date().toISOString(),
      lastSavedAt: new Date().toISOString(),
    });

    const statement = this.db.prepare(`
      INSERT OR REPLACE INTO canvas_state (
        id, name, description, viewport_zoom, viewport_center_x, viewport_center_y,
        grid_size, snap_to_grid, auto_save, theme, canvas_version,
        created_at, updated_at, last_saved_at
      ) VALUES (
        @id, @name, @description, @viewport_zoom, @viewport_center_x, @viewport_center_y,
        @grid_size, @snap_to_grid, @auto_save, @theme, @canvas_version,
        COALESCE((SELECT created_at FROM canvas_state WHERE id = @id), @created_at),
        @updated_at, @last_saved_at
      )
    `);

    statement.run({
      id: validatedState.id,
      name: validatedState.name,
      description: validatedState.description ?? null,
      viewport_zoom: validatedState.viewport.zoom,
      viewport_center_x: validatedState.viewport.centerX,
      viewport_center_y: validatedState.viewport.centerY,
      grid_size: validatedState.gridSize,
      snap_to_grid: validatedState.snapToGrid ? 1 : 0,
      auto_save: validatedState.autoSave ? 1 : 0,
      theme: validatedState.theme,
      canvas_version: validatedState.canvasVersion,
      created_at: validatedState.createdAt ?? new Date().toISOString(),
      updated_at: validatedState.updatedAt,
      last_saved_at: validatedState.lastSavedAt,
    });
  }

  /**
   * Update viewport state only (for frequent zoom/pan updates)
   */
  updateViewport(canvasId: string, viewport: CanvasViewport): void {
    const statement = this.db.prepare(`
      UPDATE canvas_state 
      SET viewport_zoom = @zoom, 
          viewport_center_x = @centerX, 
          viewport_center_y = @centerY,
          updated_at = @updated_at
      WHERE id = @id
    `);

    statement.run({
      id: canvasId,
      zoom: viewport.zoom,
      centerX: viewport.centerX,
      centerY: viewport.centerY,
      updated_at: new Date().toISOString(),
    });
  }

  /**
   * Create or update a canvas block
   */
  saveCanvasBlock(block: Omit<CanvasBlock, 'createdAt' | 'updatedAt'>): CanvasBlock {
    const validatedBlock = CanvasBlockSchema.parse({
      ...block,
      updatedAt: new Date().toISOString(),
    });

    const statement = this.db.prepare(`
      INSERT OR REPLACE INTO canvas_blocks (
        id, canvas_id, source_id, position_x, position_y, width, height, z_index,
        color_theme, is_selected, is_minimized, custom_title,
        created_at, updated_at
      ) VALUES (
        @id, @canvas_id, @source_id, @position_x, @position_y, @width, @height, @z_index,
        @color_theme, @is_selected, @is_minimized, @custom_title,
        COALESCE((SELECT created_at FROM canvas_blocks WHERE id = @id), @created_at),
        @updated_at
      )
    `);

    statement.run({
      id: validatedBlock.id,
      canvas_id: validatedBlock.canvasId,
      source_id: validatedBlock.sourceId,
      position_x: validatedBlock.position.x,
      position_y: validatedBlock.position.y,
      width: validatedBlock.size.width,
      height: validatedBlock.size.height,
      z_index: validatedBlock.zIndex,
      color_theme: validatedBlock.colorTheme,
      is_selected: validatedBlock.isSelected ? 1 : 0,
      is_minimized: validatedBlock.isMinimized ? 1 : 0,
      custom_title: validatedBlock.customTitle ?? null,
      created_at: validatedBlock.createdAt ?? new Date().toISOString(),
      updated_at: validatedBlock.updatedAt,
    });

    return validatedBlock;
  }

  /**
   * Update block position only (for frequent drag updates)
   */
  updateBlockPosition(blockId: string, position: CanvasPosition): void {
    const statement = this.db.prepare(`
      UPDATE canvas_blocks 
      SET position_x = @x, position_y = @y, updated_at = @updated_at
      WHERE id = @id
    `);

    statement.run({
      id: blockId,
      x: position.x,
      y: position.y,
      updated_at: new Date().toISOString(),
    });
  }

  /**
   * Delete a canvas block and its relationships
   */
  deleteCanvasBlock(blockId: string): number {
    const transaction = this.db.transaction(() => {
      // Delete relationships involving this block
      const deleteRelationshipsStmt = this.db.prepare(`
        DELETE FROM canvas_relationships 
        WHERE source_block_id = ? OR target_block_id = ?
      `);
      const relationshipResult = deleteRelationshipsStmt.run(blockId, blockId);

      // Delete the block
      const deleteBlockStmt = this.db.prepare(`
        DELETE FROM canvas_blocks WHERE id = ?
      `);
      const blockResult = deleteBlockStmt.run(blockId);

      return (relationshipResult.changes ?? 0) + (blockResult.changes ?? 0);
    });

    return transaction();
  }

  /**
   * Create or update a canvas relationship
   */
  saveCanvasRelationship(relationship: Omit<CanvasRelationship, 'createdAt' | 'updatedAt'>): CanvasRelationship {
    const validatedRelationship = CanvasRelationshipSchema.parse({
      ...relationship,
      updatedAt: new Date().toISOString(),
    });

    const statement = this.db.prepare(`
      INSERT OR REPLACE INTO canvas_relationships (
        id, canvas_id, source_block_id, target_block_id, source_table_name,
        source_column_name, target_table_name, target_column_name, relationship_type,
        confidence_score, visual_style, line_color, line_width, curve_path,
        is_intra_source, is_selected, created_at, updated_at
      ) VALUES (
        @id, @canvas_id, @source_block_id, @target_block_id, @source_table_name,
        @source_column_name, @target_table_name, @target_column_name, @relationship_type,
        @confidence_score, @visual_style, @line_color, @line_width, @curve_path,
        @is_intra_source, @is_selected,
        COALESCE((SELECT created_at FROM canvas_relationships WHERE id = @id), @created_at),
        @updated_at
      )
    `);

    statement.run({
      id: validatedRelationship.id,
      canvas_id: validatedRelationship.canvasId,
      source_block_id: validatedRelationship.sourceBlockId,
      target_block_id: validatedRelationship.targetBlockId,
      source_table_name: validatedRelationship.sourceTableName,
      source_column_name: validatedRelationship.sourceColumnName,
      target_table_name: validatedRelationship.targetTableName,
      target_column_name: validatedRelationship.targetColumnName,
      relationship_type: validatedRelationship.relationshipType,
      confidence_score: validatedRelationship.confidenceScore,
      visual_style: validatedRelationship.visualStyle,
      line_color: validatedRelationship.lineColor,
      line_width: validatedRelationship.lineWidth,
      curve_path: validatedRelationship.curvePath ?? null,
      is_intra_source: validatedRelationship.isIntraSource ? 1 : 0,
      is_selected: validatedRelationship.isSelected ? 1 : 0,
      created_at: validatedRelationship.createdAt ?? new Date().toISOString(),
      updated_at: validatedRelationship.updatedAt,
    });

    return validatedRelationship;
  }

  /**
   * Delete a canvas relationship
   */
  deleteCanvasRelationship(relationshipId: string): boolean {
    const statement = this.db.prepare(`
      DELETE FROM canvas_relationships WHERE id = ?
    `);
    
    const result = statement.run(relationshipId);
    return (result.changes ?? 0) > 0;
  }

  /**
   * Get all blocks for a canvas
   */
  getCanvasBlocks(canvasId: string = 'default'): CanvasBlock[] {
    const statement = this.db.prepare<{ canvas_id: string }>(`
      SELECT id, canvas_id, source_id, position_x, position_y, width, height, 
             z_index, color_theme, is_selected, is_minimized, custom_title,
             created_at, updated_at
      FROM canvas_blocks 
      WHERE canvas_id = @canvas_id
      ORDER BY z_index ASC, created_at ASC
    `);
    
    const rows = statement.all({ canvas_id: canvasId }) as CanvasBlockRow[];
    
    return rows.map(row => ({
      id: row.id,
      canvasId: row.canvas_id,
      sourceId: row.source_id,
      position: { x: row.position_x, y: row.position_y },
      size: { width: row.width, height: row.height },
      zIndex: row.z_index,
      colorTheme: row.color_theme as any,
      isSelected: Boolean(row.is_selected),
      isMinimized: Boolean(row.is_minimized),
      customTitle: row.custom_title,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  /**
   * Get all relationships for a canvas
   */
  getCanvasRelationships(canvasId: string = 'default'): CanvasRelationship[] {
    const statement = this.db.prepare<{ canvas_id: string }>(`
      SELECT id, canvas_id, source_block_id, target_block_id, source_table_name, 
             source_column_name, target_table_name, target_column_name, relationship_type,
             confidence_score, visual_style, line_color, line_width, curve_path,
             is_intra_source, is_selected, created_at, updated_at
      FROM canvas_relationships 
      WHERE canvas_id = @canvas_id
      ORDER BY created_at ASC
    `);
    
    const rows = statement.all({ canvas_id: canvasId }) as CanvasRelationshipRow[];
    
    return rows.map(row => ({
      id: row.id,
      canvasId: row.canvas_id,
      sourceBlockId: row.source_block_id,
      targetBlockId: row.target_block_id,
      sourceTableName: row.source_table_name,
      sourceColumnName: row.source_column_name,
      targetTableName: row.target_table_name,
      targetColumnName: row.target_column_name,
      relationshipType: row.relationship_type as any,
      confidenceScore: row.confidence_score,
      visualStyle: row.visual_style as any,
      lineColor: row.line_color,
      lineWidth: row.line_width,
      curvePath: row.curve_path,
      isIntraSource: Boolean(row.is_intra_source),
      isSelected: Boolean(row.is_selected),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  /**
   * Mark canvas as saved
   */
  markCanvasSaved(canvasId: string): void {
    const statement = this.db.prepare(`
      UPDATE canvas_state 
      SET last_saved_at = @last_saved_at
      WHERE id = @id
    `);

    statement.run({
      id: canvasId,
      last_saved_at: new Date().toISOString(),
    });
  }

  /**
   * Initialize default canvas if it doesn't exist
   */
  ensureDefaultCanvas(): void {
    const statement = this.db.prepare(`
      INSERT OR IGNORE INTO canvas_state (id, name) VALUES ('default', 'Main Canvas')
    `);
    
    statement.run();
  }
}