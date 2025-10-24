import type { Database } from 'better-sqlite3';
import {
  CanvasGetRequest,
  CanvasGetResponse,
  CanvasUpdateRequest,
  CanvasUpdateResponse,
  CanvasSaveRequest,
  CanvasSaveResponse,
  CanvasState,
} from '@semantiqa/contracts';
import { CanvasStateRepository } from '@semantiqa/storage-sqlite';

export class CanvasService {
  private readonly canvasRepo: CanvasStateRepository;

  constructor(private readonly db: Database) {
    this.canvasRepo = new CanvasStateRepository(db);
    
    // Ensure default canvas exists
    this.canvasRepo.ensureDefaultCanvas();
  }

  /**
   * Get canvas state with blocks and relationships
   */
  async getCanvas(request: CanvasGetRequest): Promise<CanvasGetResponse> {
    const { canvasId = 'default', includeBlocks = true, includeRelationships = true } = request;

    console.log('🟪 CanvasService.getCanvas called with:', { canvasId, includeBlocks, includeRelationships });
    
    const canvasData = this.canvasRepo.getCanvas(canvasId);
    if (!canvasData) {
      console.error('🔥 Canvas not found in database:', canvasId);
      throw new Error(`Canvas with id '${canvasId}' not found`);
    }
    
    console.log('🔍 About to load relationships from database...');

    console.log('🟪 Repository returned:', {
      canvasId: canvasData.canvas.id,
      blockCount: canvasData.blocks.length,
      relationshipCount: canvasData.relationships.length,
      blocks: canvasData.blocks.map(b => ({ id: b.id, sourceId: b.sourceId, position: b.position }))
    });

    // Enrich blocks with source information
    const enrichedBlocks = includeBlocks ? canvasData.blocks.map(block => {
      // Get source info from database including status
      const sourceStmt = this.db.prepare(`
        SELECT id, name, kind, connection_status, status, last_error
        FROM sources WHERE id = ?
      `);
      const source = sourceStmt.get(block.sourceId) as { 
        id: string; 
        name: string; 
        kind: string;
        connection_status?: string;
        status?: string;
        last_error?: string;
      } | undefined;
      
      return {
        ...block,
        source: source ? {
          id: source.id,
          name: source.name,
          kind: source.kind as 'postgres' | 'mysql' | 'mongo' | 'duckdb',
          connectionStatus: source.connection_status as 'unknown' | 'checking' | 'connected' | 'error',
          crawlStatus: source.status as 'not_crawled' | 'crawling' | 'crawled' | 'error',
          lastError: source.last_error || undefined,
        } : { 
          id: block.sourceId, 
          name: 'Unknown Source', 
          kind: 'postgres' as const,
          connectionStatus: 'unknown' as const,
          crawlStatus: 'not_crawled' as const,
        }
      };
    }) : [];

    const response = {
      canvas: canvasData.canvas,
      blocks: enrichedBlocks,
      relationships: includeRelationships ? canvasData.relationships : [],
      tableBlocks: canvasData.tableBlocks || [],
    };
    
    console.log('🟪 Returning response with blockCount:', response.blocks.length);
    console.log('🟪 Enriched blocks:', response.blocks.map(b => ({ id: b.id, sourceName: b.source?.name, sourceKind: b.source?.kind })));
    
    return response;
  }

  /**
   * Update canvas state, blocks, and relationships
   */
  async updateCanvas(request: CanvasUpdateRequest): Promise<CanvasUpdateResponse> {
    console.log('📦 Bulk updating canvas state:', {
      canvasId: request.canvasId,
      blocksCount: request.blocks?.length || 0,
      relationshipsCount: request.relationships?.length || 0,
      blocks: request.blocks?.map(b => ({ id: b.id, sourceId: b.sourceId, position: b.position }))
    });

    const { canvasId = 'default', canvas, blocks = [], relationships = [] } = request;
    
    // Single transaction for all changes
    const transaction = this.db.transaction(() => {
      // Update canvas state if provided
      if (canvas) {
        this.canvasRepo.saveCanvasState({ 
          id: canvasId, 
          ...canvas 
        });
      }
      
      // Blocks and relationships are never bulk-deleted
      // They are only deleted individually via explicit user actions:
      // - deleteCanvasBlock() for blocks (which cascades to relationships)
      // - deleteCanvasRelationship() for individual relationships
      // This preserves user data and prevents accidental loss
      
      // Insert new blocks
      if (blocks.length > 0) {
        console.log('📦 Inserting blocks:', blocks.length);
        for (const block of blocks) {
          console.log('📦 Saving block:', { id: block.id, sourceId: block.sourceId, position: block.position });
          this.canvasRepo.saveCanvasBlock({
            ...block,
            canvasId: block.canvasId || canvasId,
            sourceId: block.sourceId || '',
            position: block.position || { x: 0, y: 0 },
            size: block.size || { width: 200, height: 120 },
            zIndex: block.zIndex ?? 0,
            colorTheme: block.colorTheme || 'auto',
            isSelected: block.isSelected ?? false,
            isMinimized: block.isMinimized ?? false,
          });
        }
        console.log('📦 All blocks saved successfully');
      }
      
      // Insert/update table blocks
      if (request.tableBlocks && request.tableBlocks.length > 0) {
        console.log('📦 Inserting table blocks:', request.tableBlocks.length);
        for (const tableBlock of request.tableBlocks) {
          console.log('📦 Saving table block:', { id: tableBlock.id, tableId: tableBlock.tableId, position: tableBlock.position });
          this.canvasRepo.saveCanvasTableBlock({
            ...tableBlock,
            canvasId: tableBlock.canvasId || canvasId,
            sourceId: tableBlock.sourceId || '',
            tableId: tableBlock.tableId || '',
            position: tableBlock.position || { x: 0, y: 0 },
            size: tableBlock.size || { width: 200, height: 150 },
            zIndex: tableBlock.zIndex ?? 0,
            colorTheme: tableBlock.colorTheme || 'auto',
            isSelected: tableBlock.isSelected ?? false,
            isMinimized: tableBlock.isMinimized ?? false,
          });
        }
        console.log('📦 All table blocks saved successfully');
      }
      
      // Insert new relationships
      if (relationships.length > 0) {
        for (const rel of relationships) {
          this.canvasRepo.saveCanvasRelationship({
            ...rel,
            canvasId: rel.canvasId || canvasId,
            sourceId: rel.sourceId || '',
            targetId: rel.targetId || '',
            sourceTableId: rel.sourceTableId || '',
            targetTableId: rel.targetTableId || '',
            sourceColumnName: rel.sourceColumnName || undefined,
            targetColumnName: rel.targetColumnName || undefined,
            relationshipType: rel.relationshipType || 'semantic_link',
            confidenceScore: rel.confidenceScore ?? 1.0,
            visualStyle: rel.visualStyle || 'solid',
            lineColor: rel.lineColor || '#8bb4f7',
            lineWidth: rel.lineWidth ?? 3,
            isSelected: rel.isSelected ?? false,
          });
        }
      }
    });
    
    // Execute transaction
    transaction();
    console.log('📦 Canvas update transaction completed');
    
    // Debug: Check what's in the database after the transaction
    console.log('🔍 AFTER TRANSACTION - Checking database contents:');
    const allBlocksAfterTransaction = this.db.prepare(`SELECT * FROM canvas_source_blocks`).all();
    console.log('🔍 ALL BLOCKS AFTER TRANSACTION:', allBlocksAfterTransaction);
    
    const canvasBlocksAfterTransaction = this.db.prepare(`SELECT * FROM canvas_source_blocks WHERE canvas_id = ?`).all(canvasId);
    console.log('🔍 CANVAS BLOCKS AFTER TRANSACTION:', canvasBlocksAfterTransaction);
    
    const allRelationshipsAfterTransaction = this.db.prepare(`SELECT * FROM canvas_relationships`).all();
    console.log('🔍 ALL RELATIONSHIPS AFTER TRANSACTION:', allRelationshipsAfterTransaction);
    
    const canvasRelationshipsAfterTransaction = this.db.prepare(`SELECT * FROM canvas_relationships WHERE canvas_id = ?`).all(canvasId);
    console.log('🔍 CANVAS RELATIONSHIPS AFTER TRANSACTION:', canvasRelationshipsAfterTransaction);
    
    return { success: true };
  }

  /**
   * Delete a canvas block and all its relationships
   */
  async deleteBlock(request: { canvasId: string; blockId: string; sourceId: string }): Promise<{ success: boolean }> {
    const { blockId, sourceId } = request;
    
    console.log('🗑️ Deleting block:', { blockId, sourceId });
    
    try {
      const deletedCount = this.canvasRepo.deleteCanvasBlock(blockId, sourceId);
      console.log(`✅ Successfully deleted block and ${deletedCount} associated items`);
      
      return { success: true };
    } catch (error) {
      console.error('❌ Failed to delete block:', error);
      return { success: false };
    }
  }

  /**
   * Save canvas (mark as saved and return summary)
   */
  async saveCanvas(request: CanvasSaveRequest): Promise<CanvasSaveResponse> {
    const { canvasId = 'default', forceSave = false } = request;

    // Mark canvas as saved
    this.canvasRepo.markCanvasSaved(canvasId);

    return {
      success: true,
      lastSavedAt: new Date().toISOString(),
      changesSaved: 1, // TODO: Track actual changes when change tracking is implemented
    };
  }

  /**
   * Update just the viewport (for frequent zoom/pan operations)
   */
  async updateViewport(canvasId: string, viewport: { zoom: number; centerX: number; centerY: number }): Promise<void> {
    this.canvasRepo.updateViewport(canvasId, viewport);
  }

  /**
   * Update just a block position (for frequent drag operations)
   */
  async updateBlockPosition(blockId: string, position: { x: number; y: number }): Promise<void> {
    this.canvasRepo.updateBlockPosition(blockId, position);
  }


  /**
   * Delete a canvas relationship
   */
  async deleteCanvasRelationship(relationshipId: string): Promise<boolean> {
    return this.canvasRepo.deleteCanvasRelationship(relationshipId);
  }
}