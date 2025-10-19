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

    const canvasData = this.canvasRepo.getCanvas(canvasId);
    if (!canvasData) {
      throw new Error(`Canvas with id '${canvasId}' not found`);
    }

    return {
      canvas: canvasData.canvas,
      blocks: includeBlocks ? canvasData.blocks : [],
      relationships: includeRelationships ? canvasData.relationships : [],
    };
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
          lineWidth: relationship.lineWidth ?? 2,
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