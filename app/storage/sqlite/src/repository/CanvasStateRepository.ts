import type { Database } from 'better-sqlite3';
import {
  CanvasState,
  CanvasBlock,
  CanvasTableBlock,
  CanvasRelationship,
  CanvasViewport,
  CanvasPosition,
  CanvasSize,
  CanvasStateSchema,
  CanvasBlockSchema,
  CanvasTableBlockSchema,
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
  source_id: string;
  target_id: string;
  source_table_id: string;
  target_table_id: string;
  source_column_name?: string;
  target_column_name?: string;
  source_handle?: string;
  target_handle?: string;
  relationship_type: string;
  confidence_score: number;
  visual_style: string;
  line_color: string;
  line_width: number;
  curve_path?: string;
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
    tableBlocks: CanvasTableBlock[];
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

    // Get canvas source blocks
    const blocksStatement = this.db.prepare<{ canvas_id: string }>(`
      SELECT id, canvas_id, source_id, position_x, position_y, width, height, 
             z_index, color_theme, is_selected, is_minimized, custom_title,
             created_at, updated_at
      FROM canvas_source_blocks WHERE canvas_id = @canvas_id
      ORDER BY z_index ASC, created_at ASC
    `);
    
    const blockRows = blocksStatement.all({ canvas_id: canvasId }) as CanvasBlockRow[];

    // Get canvas relationships
    const relationshipsStatement = this.db.prepare<{ canvas_id: string }>(`
      SELECT id, canvas_id, source_id, target_id, source_table_id, target_table_id,
             source_column_name, target_column_name, source_handle, target_handle,
             relationship_type, confidence_score, visual_style, line_color, line_width,
             curve_path, is_selected, created_at, updated_at
      FROM canvas_relationships WHERE canvas_id = @canvas_id
      ORDER BY created_at ASC
    `);
    
    const relationshipRows = relationshipsStatement.all({ canvas_id: canvasId }) as CanvasRelationshipRow[];

    // Convert rows to domain objects
    const canvas: CanvasState = {
      id: canvasRow.id,
      name: canvasRow.name,
      description: canvasRow.description || undefined,
      viewport: {
        zoom: canvasRow.viewport_zoom,
        centerX: canvasRow.viewport_center_x,
        centerY: canvasRow.viewport_center_y,
      },
      gridSize: canvasRow.grid_size,
      snapToGrid: Boolean(canvasRow.snap_to_grid),
      autoSave: Boolean(canvasRow.auto_save),
      theme: canvasRow.theme as 'dark' | 'light',
      canvasVersion: canvasRow.canvas_version,
      createdAt: canvasRow.created_at,
      updatedAt: canvasRow.updated_at,
      lastSavedAt: canvasRow.last_saved_at || undefined,
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
      customTitle: row.custom_title || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    const relationships: CanvasRelationship[] = relationshipRows.map(row => ({
      id: row.id,
      canvasId: row.canvas_id,
      sourceId: row.source_id,
      targetId: row.target_id,
      sourceTableId: row.source_table_id,
      targetTableId: row.target_table_id,
      sourceColumnName: row.source_column_name || undefined,
      targetColumnName: row.target_column_name || undefined,
      sourceHandle: (row.source_handle as 'top' | 'right' | 'bottom' | 'left') || undefined,
      targetHandle: (row.target_handle as 'top' | 'right' | 'bottom' | 'left') || undefined,
      relationshipType: row.relationship_type as any,
      confidenceScore: row.confidence_score,
      visualStyle: row.visual_style as any,
      lineColor: row.line_color,
      lineWidth: row.line_width,
      curvePath: row.curve_path || undefined,
      isSelected: Boolean(row.is_selected),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    // Get canvas table blocks for drill-down view
    const tableBlocksStatement = this.db.prepare<{ canvas_id: string }>(`
      SELECT id, canvas_id, source_id, table_id, position_x, position_y, width, height, 
             z_index, color_theme, is_selected, is_minimized, custom_title,
             created_at, updated_at
      FROM canvas_table_blocks WHERE canvas_id = @canvas_id
      ORDER BY z_index ASC, created_at ASC
    `);
    
    const tableBlockRows = tableBlocksStatement.all({ canvas_id: canvasId }) as any[];

    const tableBlocks: CanvasTableBlock[] = tableBlockRows.map(row => ({
      id: row.id,
      canvasId: row.canvas_id,
      sourceId: row.source_id,
      tableId: row.table_id,
      position: { x: row.position_x, y: row.position_y },
      size: { width: row.width, height: row.height },
      zIndex: row.z_index,
      colorTheme: row.color_theme as any,
      isSelected: Boolean(row.is_selected),
      isMinimized: Boolean(row.is_minimized),
      customTitle: row.custom_title || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return { canvas, blocks, relationships, tableBlocks };
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

    // Check if canvas state exists
    const existing = this.db.prepare(`
      SELECT id, created_at FROM canvas_state WHERE id = ?
    `).get(validatedState.id) as { id: string; created_at: string } | undefined;

    if (existing) {
      // Update existing canvas state
      const updateStmt = this.db.prepare(`
        UPDATE canvas_state 
        SET name = @name,
            description = @description,
            viewport_zoom = @viewport_zoom,
            viewport_center_x = @viewport_center_x,
            viewport_center_y = @viewport_center_y,
            grid_size = @grid_size,
            snap_to_grid = @snap_to_grid,
            auto_save = @auto_save,
            theme = @theme,
            canvas_version = @canvas_version,
            updated_at = @updated_at,
            last_saved_at = @last_saved_at
        WHERE id = @id
      `);

      updateStmt.run({
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
        updated_at: validatedState.updatedAt,
        last_saved_at: validatedState.lastSavedAt,
      });
    } else {
      // Insert new canvas state
      const insertStmt = this.db.prepare(`
        INSERT INTO canvas_state (
          id, name, description, viewport_zoom, viewport_center_x, viewport_center_y,
          grid_size, snap_to_grid, auto_save, theme, canvas_version,
          created_at, updated_at, last_saved_at
        ) VALUES (
          @id, @name, @description, @viewport_zoom, @viewport_center_x, @viewport_center_y,
          @grid_size, @snap_to_grid, @auto_save, @theme, @canvas_version,
          @created_at, @updated_at, @last_saved_at
        )
      `);

      insertStmt.run({
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

    // Check if block exists
    const existing = this.db.prepare(`
      SELECT id, created_at FROM canvas_source_blocks WHERE id = ?
    `).get(validatedBlock.id) as { id: string; created_at: string } | undefined;

    if (existing) {
      // Update existing block
      const updateStmt = this.db.prepare(`
        UPDATE canvas_source_blocks 
        SET canvas_id = @canvas_id, 
            source_id = @source_id, 
            position_x = @position_x, 
            position_y = @position_y, 
            width = @width, 
            height = @height, 
            z_index = @z_index,
            color_theme = @color_theme, 
            is_selected = @is_selected, 
            is_minimized = @is_minimized, 
            custom_title = @custom_title,
            updated_at = @updated_at
        WHERE id = @id
      `);

      updateStmt.run({
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
        updated_at: validatedBlock.updatedAt,
      });
    } else {
      // Insert new block
      const insertStmt = this.db.prepare(`
        INSERT INTO canvas_source_blocks (
          id, canvas_id, source_id, position_x, position_y, width, height, z_index,
          color_theme, is_selected, is_minimized, custom_title,
          created_at, updated_at
        ) VALUES (
          @id, @canvas_id, @source_id, @position_x, @position_y, @width, @height, @z_index,
          @color_theme, @is_selected, @is_minimized, @custom_title,
          @created_at, @updated_at
        )
      `);

      insertStmt.run({
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
    }

    return validatedBlock;
  }

  /**
   * Create or update a canvas table block
   */
  saveCanvasTableBlock(block: Omit<CanvasTableBlock, 'createdAt' | 'updatedAt'>): CanvasTableBlock {
    const validatedBlock = CanvasTableBlockSchema.parse({
      ...block,
      updatedAt: new Date().toISOString(),
    });

    // Check if block exists
    const existing = this.db.prepare(`
      SELECT id, created_at FROM canvas_table_blocks WHERE id = ?
    `).get(validatedBlock.id) as { id: string; created_at: string } | undefined;

    if (existing) {
      // Update existing block
      const updateStmt = this.db.prepare(`
        UPDATE canvas_table_blocks 
        SET canvas_id = @canvas_id, 
            source_id = @source_id, 
            table_id = @table_id,
            position_x = @position_x, 
            position_y = @position_y, 
            width = @width, 
            height = @height, 
            z_index = @z_index,
            color_theme = @color_theme, 
            is_selected = @is_selected, 
            is_minimized = @is_minimized, 
            custom_title = @custom_title,
            updated_at = @updated_at
        WHERE id = @id
      `);

      updateStmt.run({
        id: validatedBlock.id,
        canvas_id: validatedBlock.canvasId,
        source_id: validatedBlock.sourceId,
        table_id: validatedBlock.tableId,
        position_x: validatedBlock.position.x,
        position_y: validatedBlock.position.y,
        width: validatedBlock.size.width,
        height: validatedBlock.size.height,
        z_index: validatedBlock.zIndex,
        color_theme: validatedBlock.colorTheme,
        is_selected: validatedBlock.isSelected ? 1 : 0,
        is_minimized: validatedBlock.isMinimized ? 1 : 0,
        custom_title: validatedBlock.customTitle ?? null,
        updated_at: validatedBlock.updatedAt,
      });
    } else {
      // Insert new block
      const insertStmt = this.db.prepare(`
        INSERT INTO canvas_table_blocks (
          id, canvas_id, source_id, table_id, position_x, position_y, width, height, z_index,
          color_theme, is_selected, is_minimized, custom_title,
          created_at, updated_at
        ) VALUES (
          @id, @canvas_id, @source_id, @table_id, @position_x, @position_y, @width, @height, @z_index,
          @color_theme, @is_selected, @is_minimized, @custom_title,
          @created_at, @updated_at
        )
      `);

      insertStmt.run({
        id: validatedBlock.id,
        canvas_id: validatedBlock.canvasId,
        source_id: validatedBlock.sourceId,
        table_id: validatedBlock.tableId,
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
    }

    return validatedBlock;
  }

  /**
   * Update table block position only (for frequent drag updates)
   */
  updateTableBlockPosition(blockId: string, position: CanvasPosition): void {
    const statement = this.db.prepare(`
      UPDATE canvas_table_blocks 
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
   * Delete a canvas block and its associated relationships
   */
  deleteCanvasBlock(blockId: string, sourceId: string): number {
    const transaction = this.db.transaction(() => {
      // First, delete all relationships involving this block's source
      const deleteRelationshipsStmt = this.db.prepare(`
        DELETE FROM canvas_relationships 
        WHERE source_id = ? OR target_id = ?
      `);
      const relResult = deleteRelationshipsStmt.run(sourceId, sourceId);
      console.log(`Deleted ${relResult.changes} relationships for block ${blockId}`);

      // Delete from source blocks table
      const deleteSourceBlockStmt = this.db.prepare(`
        DELETE FROM canvas_source_blocks WHERE id = ?
      `);
      const sourceResult = deleteSourceBlockStmt.run(blockId);

      // Delete from table blocks table
      const deleteTableBlockStmt = this.db.prepare(`
        DELETE FROM canvas_table_blocks WHERE id = ?
      `);
      const tableResult = deleteTableBlockStmt.run(blockId);

      return (sourceResult.changes ?? 0) + (tableResult.changes ?? 0);
    });

    return transaction();
  }

  /**
   * Create or update a canvas relationship
   */
  saveCanvasRelationship(relationship: Omit<CanvasRelationship, 'createdAt' | 'updatedAt'>): CanvasRelationship {
    console.log('💾 Saving relationship to database:', {
      id: relationship.id,
      canvasId: relationship.canvasId,
      sourceTableId: relationship.sourceTableId,
      targetTableId: relationship.targetTableId,
      sourceId: relationship.sourceId,
      targetId: relationship.targetId
    });

    const validatedRelationship = CanvasRelationshipSchema.parse({
      ...relationship,
      updatedAt: new Date().toISOString(),
    });

    // Check if relationship exists
    const existing = this.db.prepare(`
      SELECT id, created_at FROM canvas_relationships WHERE id = ?
    `).get(validatedRelationship.id) as { id: string; created_at: string } | undefined;

    let result: { changes: number; lastInsertRowid: number | bigint };

    if (existing) {
      // Update existing relationship
      console.log('💾 Updating existing relationship:', validatedRelationship.id);
      
      const updateStmt = this.db.prepare(`
        UPDATE canvas_relationships 
        SET canvas_id = @canvas_id, 
            source_id = @source_id, 
            target_id = @target_id, 
            source_table_id = @source_table_id, 
            target_table_id = @target_table_id,
            source_column_name = @source_column_name, 
            target_column_name = @target_column_name,
            source_handle = @source_handle,
            target_handle = @target_handle,
            relationship_type = @relationship_type, 
            confidence_score = @confidence_score,
            visual_style = @visual_style, 
            line_color = @line_color, 
            line_width = @line_width, 
            curve_path = @curve_path, 
            is_selected = @is_selected,
            updated_at = @updated_at
        WHERE id = @id
      `);

      result = updateStmt.run({
        id: validatedRelationship.id,
        canvas_id: validatedRelationship.canvasId,
        source_id: validatedRelationship.sourceId,
        target_id: validatedRelationship.targetId,
        source_table_id: validatedRelationship.sourceTableId,
        target_table_id: validatedRelationship.targetTableId,
        source_column_name: validatedRelationship.sourceColumnName || null,
        target_column_name: validatedRelationship.targetColumnName || null,
        source_handle: validatedRelationship.sourceHandle || null,
        target_handle: validatedRelationship.targetHandle || null,
        relationship_type: validatedRelationship.relationshipType,
        confidence_score: validatedRelationship.confidenceScore,
        visual_style: validatedRelationship.visualStyle,
        line_color: validatedRelationship.lineColor,
        line_width: validatedRelationship.lineWidth,
        curve_path: validatedRelationship.curvePath ?? null,
        is_selected: validatedRelationship.isSelected ? 1 : 0,
        updated_at: validatedRelationship.updatedAt,
      });
    } else {
      // Insert new relationship
      console.log('💾 Inserting new relationship:', {
        id: validatedRelationship.id,
        canvasId: validatedRelationship.canvasId,
        sourceTableId: validatedRelationship.sourceTableId,
        targetTableId: validatedRelationship.targetTableId
      });

      const insertStmt = this.db.prepare(`
        INSERT INTO canvas_relationships (
          id, canvas_id, source_id, target_id, source_table_id, target_table_id,
          source_column_name, target_column_name, source_handle, target_handle,
          relationship_type, confidence_score, visual_style, line_color, line_width,
          curve_path, is_selected, created_at, updated_at
        ) VALUES (
          @id, @canvas_id, @source_id, @target_id, @source_table_id, @target_table_id,
          @source_column_name, @target_column_name, @source_handle, @target_handle,
          @relationship_type, @confidence_score, @visual_style, @line_color, @line_width,
          @curve_path, @is_selected, @created_at, @updated_at
        )
      `);

      result = insertStmt.run({
        id: validatedRelationship.id,
        canvas_id: validatedRelationship.canvasId,
        source_id: validatedRelationship.sourceId,
        target_id: validatedRelationship.targetId,
        source_table_id: validatedRelationship.sourceTableId,
        target_table_id: validatedRelationship.targetTableId,
        source_column_name: validatedRelationship.sourceColumnName || null,
        target_column_name: validatedRelationship.targetColumnName || null,
        source_handle: validatedRelationship.sourceHandle || null,
        target_handle: validatedRelationship.targetHandle || null,
        relationship_type: validatedRelationship.relationshipType,
        confidence_score: validatedRelationship.confidenceScore,
        visual_style: validatedRelationship.visualStyle,
        line_color: validatedRelationship.lineColor,
        line_width: validatedRelationship.lineWidth,
        curve_path: validatedRelationship.curvePath ?? null,
        is_selected: validatedRelationship.isSelected ? 1 : 0,
        created_at: validatedRelationship.createdAt ?? new Date().toISOString(),
        updated_at: validatedRelationship.updatedAt,
      });
    }
    
    console.log('💾 Relationship save result:', {
      changes: result.changes,
      lastInsertRowid: result.lastInsertRowid,
      id: validatedRelationship.id,
      wasUpdate: !!existing
    });

    // Debug: Show all relationships in the table after saving
    try {
      console.log('💾 Starting detailed save logging...');
      
      // Check the table contents immediately after saving
      const allRelationshipsAfterSave = this.db.prepare(`SELECT * FROM canvas_relationships`).all();
      console.log('💾 ALL RELATIONSHIPS IN TABLE AFTER SAVE:', allRelationshipsAfterSave);
      
      // Check specifically for our canvas
      const canvasRelationshipsAfterSave = this.db.prepare(`SELECT * FROM canvas_relationships WHERE canvas_id = ?`).all(validatedRelationship.canvasId);
      console.log('💾 RELATIONSHIPS FOR CANVAS AFTER SAVE:', canvasRelationshipsAfterSave);
      
      // Check if our specific relationship exists
      const specificRelAfterSave = this.db.prepare(`SELECT * FROM canvas_relationships WHERE id = ?`).get(validatedRelationship.id);
      console.log('💾 SPECIFIC RELATIONSHIP AFTER SAVE:', specificRelAfterSave);
      
      console.log('💾 Detailed save logging completed successfully');
    } catch (error) {
      console.error('💾 ERROR in detailed save logging:', error);
      console.error('💾 Error details:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
    }

    // Note: PRAGMA synchronous is set at database level, not per transaction
    
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
   * Get all relationships for a canvas
   */
  getCanvasRelationships(canvasId: string = 'default'): CanvasRelationship[] {
    const statement = this.db.prepare<{ canvas_id: string }>(`
      SELECT id, canvas_id, source_id, target_id, source_table_id, target_table_id,
             source_column_name, target_column_name, source_handle, target_handle,
             relationship_type, confidence_score, visual_style, line_color, line_width,
             curve_path, is_selected, created_at, updated_at
      FROM canvas_relationships 
      WHERE canvas_id = @canvas_id
      ORDER BY created_at ASC
    `);
    
    const rows = statement.all({ canvas_id: canvasId }) as CanvasRelationshipRow[];
    console.log('🔍 Loading relationships from database:', {
      canvasId,
      count: rows.length,
      relationships: rows.map(r => ({
        id: r.id,
        sourceTableId: r.source_table_id,
        targetTableId: r.target_table_id,
        sourceHandle: r.source_handle,
        targetHandle: r.target_handle
      }))
    });
    
    return rows.map(row => ({
      id: row.id,
      canvasId: row.canvas_id,
      sourceId: row.source_id,
      targetId: row.target_id,
      sourceTableId: row.source_table_id,
      targetTableId: row.target_table_id,
      sourceColumnName: row.source_column_name || undefined,
      targetColumnName: row.target_column_name || undefined,
      sourceHandle: (row.source_handle as 'top' | 'right' | 'bottom' | 'left') || undefined,
      targetHandle: (row.target_handle as 'top' | 'right' | 'bottom' | 'left') || undefined,
      relationshipType: row.relationship_type as any,
      confidenceScore: row.confidence_score,
      visualStyle: row.visual_style as any,
      lineColor: row.line_color,
      lineWidth: row.line_width,
      curvePath: row.curve_path,
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
    console.log('🎨 ensureDefaultCanvas called');
    
    // Check if default canvas already exists
    const existing = this.db.prepare(`
      SELECT id FROM canvas_state WHERE id = 'default'
    `).get();
    
    if (existing) {
      console.log('🎨 Default canvas already exists, skipping creation');
      return; // Early exit - don't touch anything
    }
    
    console.log('🎨 Creating default canvas');
    const now = new Date().toISOString();
    
    this.db.prepare(`
      INSERT INTO canvas_state (
        id, name, description, viewport_zoom, viewport_center_x, viewport_center_y,
        grid_size, snap_to_grid, auto_save, theme, canvas_version,
        created_at, updated_at, last_saved_at
      ) VALUES (
        'default', 'Main Canvas', 'The main canvas workspace', 1.0, 0, 0,
        20, 1, 1, 'dark', '1.0.0',
        @created_at, @updated_at, @last_saved_at
      )
    `).run({
      created_at: now,
      updated_at: now,
      last_saved_at: now,
    });
    
    console.log('🎨 Default canvas created successfully');
  }
}