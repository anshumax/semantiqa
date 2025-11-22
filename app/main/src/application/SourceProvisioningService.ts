import type { SemantiqaError, SourcesAddRequest } from '@semantiqa/contracts';
import { SourceService } from '@semantiqa/graph-service';
import type { CanvasService } from '../services/CanvasService.js';

export interface SourceProvisioningDeps {
  openSourcesDb: () => any;
  triggerMetadataCrawl: (sourceId: string) => Promise<void>;
  secureStore: (scope: { sourceId: string; key: string }, secret: string) => Promise<void>;
  updateCrawlStatus: (sourceId: string, status: 'not_crawled' | 'crawling' | 'crawled' | 'error', error?: { message: string; meta?: Record<string, unknown> }) => Promise<void> | void;
  updateConnectionStatus: (sourceId: string, status: 'unknown' | 'checking' | 'connected' | 'error', error?: { message: string; meta?: Record<string, unknown> }) => Promise<void> | void;
  audit: (event: {
    action: string;
    sourceId?: string;
    status: 'success' | 'failure';
    details?: Record<string, unknown>;
  }) => void;
  logger: {
    info(message: string, meta?: Record<string, unknown>): void;
    warn(message: string, meta?: Record<string, unknown>): void;
    error(message: string, meta?: Record<string, unknown>): void;
  };
  createSourceService?: () => SourceService;
  canvasService?: CanvasService;
}

export class SourceProvisioningService {
  private sourceService: SourceService | null = null;

  constructor(private readonly deps: SourceProvisioningDeps) {}

  private ensureSourceService() {
    if (!this.sourceService) {
      this.sourceService = this.deps.createSourceService
        ? this.deps.createSourceService()
        : new SourceService({ openDatabase: this.deps.openSourcesDb });
    }
    return this.sourceService;
  }

  async createSource(request: SourcesAddRequest): Promise<{ sourceId: string } | SemantiqaError> {
    const { triggerMetadataCrawl, secureStore, audit, logger } = this.deps;
    const sourceService = this.ensureSourceService();

    logger.info('Provisioning source', { kind: request.kind, name: request.name });

    const startAuditContext = {
      action: 'sources.add.requested',
      status: 'success' as const,
      details: { kind: request.kind, name: request.name },
    };
    audit(startAuditContext);

    // Check for existing connection before creating
    const existing = sourceService.findExistingConnection(request);
    if (existing) {
      logger.warn('Duplicate connection detected', { existing, request: { kind: request.kind, name: request.name } });
      
      // Check if a canvas block already exists for this source
      if (this.deps.canvasService) {
        try {
          const canvasData = await this.deps.canvasService.getCanvas({
            canvasId: 'default',
            includeBlocks: true,
            includeRelationships: false,
            includeLevelData: false
          });
          
          const blockExists = canvasData.blocks?.some(block => block.sourceId === existing.id);
          
          if (!blockExists) {
            logger.info('Canvas block does not exist for duplicate source - creating one', { sourceId: existing.id });
            await this.createCanvasBlockForSource(existing.id, existing.name);
            audit({
              action: 'sources.add.duplicate_canvas_block_created',
              sourceId: existing.id,
              status: 'success',
              details: { sourceName: existing.name },
            });
            
            // Return success since we created the canvas block
            return { sourceId: existing.id };
          }
          
          logger.info('Canvas block already exists for duplicate source', { sourceId: existing.id });
        } catch (canvasError) {
          logger.warn('Failed to check/create canvas block for duplicate source', { 
            error: canvasError, 
            sourceId: existing.id 
          });
          // Continue with error response if canvas block check/creation fails
        }
      }
      
      // Canvas block already exists or canvas service unavailable - return error
      const errorMessage = `A source with the same connection already exists: "${existing.name}" (ID: ${existing.id})`;
      audit({
        action: 'sources.add.duplicate_rejected',
        status: 'failure',
        details: { existing: existing.name, existingId: existing.id, kind: request.kind, name: request.name },
      });
      
      return {
        code: 'VALIDATION_ERROR',
        message: errorMessage,
        details: { existingSourceId: existing.id, existingSourceName: existing.name },
      } satisfies SemantiqaError;
    }

    let created: { sourceId: string } | null = null;

    try {
      created = await sourceService.addSource(request, 'not_crawled', 'checking');
      const { sourceId } = created;

      await this.updateStatus(sourceId, 'not_crawled', { audit, logger });
      await this.updateConnectionStatus(sourceId, 'checking', { audit, logger });

      try {
        await this.persistSecrets({ request, sourceId, secureStore });
      } catch (error) {
        logger.error('Failed to persist secrets', { error, sourceId });
        audit({
          action: 'sources.add.secrets_failed',
          sourceId,
          status: 'failure',
          details: { error: (error as Error).message ?? 'Unknown error' },
        });
        this.safeRemoveSource(sourceService, sourceId, audit, logger);
        await this.updateStatus(sourceId, 'error', {
          audit,
          logger,
          errorMeta: { message: (error as Error).message ?? 'Unable to store credentials' },
        });
        await this.updateConnectionStatus(sourceId, 'error', {
          audit,
          logger,
          errorMessage: (error as Error).message ?? 'Unable to store credentials',
        });

        return {
          code: 'AUTH_REQUIRED',
          message: 'Unable to store credentials. Please verify keychain access and retry.',
        } satisfies SemantiqaError;
      }

      audit({
        action: 'sources.add.persisted',
        sourceId,
        status: 'success',
        details: { kind: request.kind },
      });

      await this.updateStatus(sourceId, 'crawling', { audit, logger });

      try {
        await triggerMetadataCrawl(sourceId);
        audit({
          action: 'sources.add.crawl_triggered',
          sourceId,
          status: 'success',
        });
      } catch (error) {
        logger.warn('Failed to trigger metadata crawl', { error, sourceId });
        audit({
          action: 'sources.add.crawl_failed',
          sourceId,
          status: 'failure',
          details: { error: (error as Error).message ?? 'Unknown error' },
        });

        await this.updateStatus(sourceId, 'error', {
          audit,
          logger,
          errorMeta: { message: (error as Error).message ?? 'Failed to trigger metadata crawl' },
        });
      }

      logger.info('Source provisioned', { sourceId });
      
      // Automatically create a canvas block for the new source
      if (this.deps.canvasService) {
        try {
          await this.createCanvasBlockForSource(sourceId, request.name);
          audit({
            action: 'sources.add.canvas_block_created',
            sourceId,
            status: 'success',
            details: { sourceName: request.name },
          });
        } catch (canvasError) {
          logger.warn('Failed to create canvas block for source', { 
            error: canvasError, 
            sourceId, 
            sourceName: request.name 
          });
          audit({
            action: 'sources.add.canvas_block_failed',
            sourceId,
            status: 'failure',
            details: { 
              error: (canvasError as Error).message ?? 'Unknown error',
              sourceName: request.name 
            },
          });
          // Don't fail the entire source creation if canvas block creation fails
        }
      }
      
      return { sourceId };
    } catch (error) {
      const errorMessage = (error as Error).message ?? 'Unknown error';
      
      // Check if this is a duplicate connection error
      if (errorMessage.includes('source with the same connection already exists')) {
        logger.warn('Duplicate connection error during creation', { error: errorMessage });
        audit({
          action: 'sources.add.duplicate_error',
          status: 'failure',
          details: { error: errorMessage, kind: request.kind },
        });
        
        return {
          code: 'VALIDATION_ERROR',
          message: errorMessage,
        } satisfies SemantiqaError;
      }
      
      logger.error('Failed to provision source', { error });
      audit({
        action: 'sources.add.failed',
        status: 'failure',
        details: { error: errorMessage, kind: request.kind },
      });

      if (created) {
        this.safeRemoveSource(sourceService, created.sourceId, audit, logger);
        await this.updateStatus(created.sourceId, 'error', {
          audit,
          logger,
          errorMeta: { message: errorMessage },
        });
        await this.updateConnectionStatus(created.sourceId, 'error', {
          audit,
          logger,
          errorMessage: errorMessage,
        });
      }

      return {
        code: 'VALIDATION_ERROR',
        message: 'Unable to add source. Check inputs and try again.',
        details: { error: errorMessage },
      } satisfies SemantiqaError;
    }
  }

  private safeRemoveSource(
    service: SourceService,
    sourceId: string,
    audit: SourceProvisioningDeps['audit'],
    logger: SourceProvisioningDeps['logger'],
  ) {
    try {
      service.removeSource(sourceId);
      audit({
        action: 'sources.add.rollback',
        sourceId,
        status: 'success',
      });
    } catch (cleanupError) {
      logger.warn('Failed to rollback source after provisioning error', {
        error: cleanupError,
        sourceId,
      });
      audit({
        action: 'sources.add.rollback_failed',
        sourceId,
        status: 'failure',
        details: { error: (cleanupError as Error).message ?? 'Unknown error' },
      });
    }
  }

  private async persistSecrets(params: {
    request: SourcesAddRequest;
    sourceId: string;
    secureStore: SourceProvisioningDeps['secureStore'];
  }) {
    const { request, sourceId, secureStore } = params;

    if (!('connection' in request)) {
      return;
    }

    const secretEntries: Array<{ key: string; value: string }> = [];
    const { connection } = request;

    if ('password' in connection && connection.password) {
      secretEntries.push({ key: 'password', value: connection.password });
    }

    if ('uri' in connection && connection.uri) {
      secretEntries.push({ key: 'uri', value: connection.uri });
    }

    for (const entry of secretEntries) {
      await secureStore({ sourceId, key: entry.key }, entry.value);
    }
  }

  private async updateStatus(
    sourceId: string,
    status: 'not_crawled' | 'crawling' | 'crawled' | 'error',
    opts: {
      audit: SourceProvisioningDeps['audit'];
      logger: SourceProvisioningDeps['logger'];
      errorMeta?: { message: string; meta?: Record<string, unknown> };
    },
  ) {
    const service = this.ensureSourceService();
    service.setCrawlStatus(sourceId, status, opts.errorMeta);
    await this.deps.updateCrawlStatus(sourceId, status, opts.errorMeta);
  }

  private async updateConnectionStatus(
    sourceId: string,
    status: 'unknown' | 'checking' | 'connected' | 'error',
    opts: {
      audit: SourceProvisioningDeps['audit'];
      logger: SourceProvisioningDeps['logger'];
      errorMessage?: string;
    },
  ) {
    const service = this.ensureSourceService();
    service.setConnectionStatus(sourceId, status, opts.errorMessage);
    await this.deps.updateConnectionStatus(
      sourceId,
      status,
      opts.errorMessage ? { message: opts.errorMessage } : undefined,
    );
  }

  /**
   * Create a canvas block for a newly created source
   */
  private async createCanvasBlockForSource(sourceId: string, sourceName: string): Promise<void> {
    console.log('🎨 Starting canvas block creation for source:', { sourceId, sourceName });
    
    if (!this.deps.canvasService) {
      console.error('🎨 Canvas service not available');
      throw new Error('Canvas service not available');
    }

    // Generate a unique block ID
    const blockId = `block-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    console.log('🎨 Generated block ID:', blockId);
    
    // Calculate position for the new block
    // For now, use a simple grid layout
    const spacingX = 260;
    const spacingY = 180;
    const perRow = 4;
    
    // Get existing blocks to calculate position
    console.log('🎨 Getting existing canvas data...');
    const canvasData = await this.deps.canvasService.getCanvas({ 
      canvasId: 'default',
      includeBlocks: true,
      includeRelationships: false,
      includeLevelData: false
    });
    const existingBlocks = canvasData.blocks || [];
    console.log('🎨 Existing blocks count:', existingBlocks.length);
    
    const index = existingBlocks.length;
    const row = Math.floor(index / perRow);
    const col = index % perRow;
    const x = 100 + col * spacingX;
    const y = 100 + row * spacingY;
    console.log('🎨 Calculated position:', { x, y, index, row, col });

    // Create the canvas block
    console.log('🎨 Creating canvas block...');
    const blockData = {
      id: blockId,
      canvasId: 'default',
      sourceId: sourceId,
      position: { x, y },
      size: { width: 200, height: 120 },
      zIndex: 0,
      colorTheme: 'auto' as const,
      isSelected: false,
      isMinimized: false,
      customTitle: sourceName,
    };
    console.log('🎨 Block data:', blockData);
    
    await this.deps.canvasService.updateCanvas({
      canvasId: 'default',
      blocks: [blockData],
    });
    console.log('🎨 Canvas block created successfully');

    this.deps.logger.info('Canvas block created for source', { 
      sourceId, 
      sourceName, 
      blockId, 
      position: { x, y } 
    });
  }
}

