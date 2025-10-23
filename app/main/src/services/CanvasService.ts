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
    };
    
    console.log('🟪 Returning response with blockCount:', response.blocks.length);
    console.log('🟪 Enriched blocks:', response.blocks.map(b => ({ id: b.id, sourceName: b.source?.name, sourceKind: b.source?.kind })));
    
    return response;
  }

  /**
   * Update canvas state, blocks, and relationships
   */
  async updateCanvas(request: CanvasUpdateRequest): Promise<CanvasUpdateResponse> {
    const { canvasId = 'default', canvas, blocks = [], relationships = [] } = request;
    
    const transaction = this.db.transaction(() => {
      let updatedCanvas: CanvasState | undefined;
      
      if (canvas) {
        this.canvasRepo.saveCanvasState({ 
          id: canvasId, 
          ...canvas 
        });
        // Get the updated canvas state
        const current = this.canvasRepo.getCanvas(canvasId);
        if (!current) {
          throw new Error(`Canvas with id '${canvasId}' not found`);
        }
        updatedCanvas = current.canvas;
      }

      const updatedBlocks = blocks.map(block => {
        if (!block.id) {
          throw new Error('Block ID is required for updates');
        }
        return this.canvasRepo.saveCanvasBlock({
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
      });

      const updatedRelationships = relationships.map(relationship => {
        if (!relationship.id) {
          throw new Error('Relationship ID is required for updates');
        }
        return this.canvasRepo.saveCanvasRelationship({
          ...relationship,
          canvasId: relationship.canvasId || canvasId,
          sourceBlockId: relationship.sourceBlockId || '',
          targetBlockId: relationship.targetBlockId || '',
          sourceTableName: relationship.sourceTableName || '',
          sourceColumnName: relationship.sourceColumnName || '',
          targetTableName: relationship.targetTableName || '',
          targetColumnName: relationship.targetColumnName || '',
          relationshipType: relationship.relationshipType || 'semantic_link',
          confidenceScore: relationship.confidenceScore ?? 1.0,
          visualStyle: relationship.visualStyle || 'solid',
          lineColor: relationship.lineColor || '#8bb4f7',
          lineWidth: relationship.lineWidth ?? 3,
          isIntraSource: relationship.isIntraSource ?? false,
          isSelected: relationship.isSelected ?? false,
        });
      });

      // Get current canvas state if not updated
      if (!updatedCanvas) {
        const current = this.canvasRepo.getCanvas(canvasId);
        if (!current) {
          throw new Error(`Canvas with id '${canvasId}' not found`);
        }
        updatedCanvas = current.canvas;
      }

      return { updatedCanvas, updatedBlocks, updatedRelationships };
    });

    const result = transaction();

    return {
      success: true,
      updatedCanvas: result.updatedCanvas,
      updatedBlocks: result.updatedBlocks,
      updatedRelationships: result.updatedRelationships,
    };
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
   * Delete a canvas block
   */
  async deleteCanvasBlock(blockId: string): Promise<number> {
    return this.canvasRepo.deleteCanvasBlock(blockId);
  }

  /**
   * Delete a canvas relationship
   */
  async deleteCanvasRelationship(relationshipId: string): Promise<boolean> {
    return this.canvasRepo.deleteCanvasRelationship(relationshipId);
  }
}