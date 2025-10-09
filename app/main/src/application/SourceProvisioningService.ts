import type { SemantiqaError, SourcesAddRequest } from '@semantiqa/contracts';
import { SourceService } from '@semantiqa/graph-service';

export interface SourceProvisioningDeps {
  openSourcesDb: () => any;
  triggerMetadataCrawl: (sourceId: string) => Promise<void>;
  secureStore: (scope: { sourceId: string; key: string }, secret: string) => Promise<void>;
  updateSourceStatus: (sourceId: string, status: 'connecting' | 'queued' | 'ready' | 'error' | 'needs_attention') => Promise<void> | void;
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
}

export class SourceProvisioningService {
  private sourceService: SourceService | null = null;

  constructor(private readonly deps: SourceProvisioningDeps) {}

  private ensureSourceService() {
    if (!this.sourceService) {
      this.sourceService = new SourceService({ openDatabase: this.deps.openSourcesDb });
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

    let created: { sourceId: string } | null = null;

    try {
      created = await sourceService.addSource(request);
      const { sourceId } = created;

      await this.updateStatus(sourceId, 'connecting');

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

        try {
          sourceService.removeSource(sourceId);
          audit({
            action: 'sources.add.rollback',
            sourceId,
            status: 'success',
          });
        } catch (cleanupError) {
          logger.warn('Failed to rollback source after secret persistence error', {
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

        await this.updateStatus(sourceId, 'error');

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

      await this.updateStatus(sourceId, 'queued');

      try {
        await triggerMetadataCrawl(sourceId);
        audit({
          action: 'sources.add.crawl_triggered',
          sourceId,
          status: 'success',
        });

        await this.updateStatus(sourceId, 'ready');
      } catch (error) {
        logger.warn('Failed to trigger metadata crawl', { error, sourceId });
        audit({
          action: 'sources.add.crawl_failed',
          sourceId,
          status: 'failure',
          details: { error: (error as Error).message ?? 'Unknown error' },
        });

        await this.updateStatus(sourceId, 'needs_attention');
      }

      logger.info('Source provisioned', { sourceId });
      return { sourceId };
    } catch (error) {
      logger.error('Failed to provision source', { error });
      audit({
        action: 'sources.add.failed',
        status: 'failure',
        details: { error: (error as Error).message ?? 'Unknown error', kind: request.kind },
      });

      if (created) {
        try {
          sourceService.removeSource(created.sourceId);
          audit({
            action: 'sources.add.rollback',
            sourceId: created.sourceId,
            status: 'success',
          });
        } catch (cleanupError) {
          logger.warn('Failed to rollback source after provisioning error', {
            error: cleanupError,
            sourceId: created.sourceId,
          });
          audit({
            action: 'sources.add.rollback_failed',
            sourceId: created.sourceId,
            status: 'failure',
            details: { error: (cleanupError as Error).message ?? 'Unknown error' },
          });
        }

        await this.updateStatus(created.sourceId, 'error');
      }

      return {
        code: 'VALIDATION_ERROR',
        message: 'Unable to add source. Check inputs and try again.',
        details: { error: (error as Error).message ?? 'Unknown error' },
      } satisfies SemantiqaError;
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
    status: 'connecting' | 'queued' | 'ready' | 'error' | 'needs_attention',
  ) {
    await this.deps.updateSourceStatus(sourceId, status);
  }
}

