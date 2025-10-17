import type { SemantiqaError, SourcesAddRequest } from '@semantiqa/contracts';
import { SourceService } from '@semantiqa/graph-service';

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
      const errorMessage = `A source with the same connection already exists: "${existing.name}" (ID: ${existing.id})`;
      logger.warn('Duplicate connection detected', { existing, request: { kind: request.kind, name: request.name } });
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
}

