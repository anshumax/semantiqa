import { ipcMain } from 'electron';
import { z } from 'zod';

import {
  IPC_CHANNELS,
  type IpcChannel,
  type IpcRequest,
  type IpcResponse,
} from '@semantiqa/app-config';
import {
  AuditListRequestSchema,
  GraphGetRequestSchema,
  GraphGetResponseSchema,
  GraphUpsertNodeRequestSchema,
  MetadataCrawlRequestSchema,
  MetadataCrawlResponseSchema,
  ModelsDownloadRequestSchema,
  ModelsEnableRequestSchema,
  ModelsHealthcheckRequestSchema,
  ModelsHealthcheckResponseSchema,
  ModelsListResponseSchema,
  NlSqlGenerateRequestSchema,
  NlSqlGenerateResponseSchema,
  QueryResultSchema,
  QueryRunReadOnlyRequestSchema,
  SearchResultsSchema,
  SearchSemanticRequestSchema,
  SemantiqaErrorSchema,
  SourcesAddRequestSchema,
} from '@semantiqa/contracts';
import {
  CanvasGetRequestSchema,
  CanvasGetResponseSchema,
  CanvasUpdateRequestSchema,
  CanvasUpdateResponseSchema,
  CanvasSaveRequestSchema,
  CanvasSaveResponseSchema,
} from '@semantiqa/contracts';

import { logIpcEvent } from '../logging/audit';

const channelToSchema: Partial<Record<IpcChannel, z.ZodTypeAny>> = {
  'health:ping': z.undefined(),
  'sources:add': SourcesAddRequestSchema,
  'sources:check-duplicate': z.object({ 
    kind: z.string(), 
    connection: z.record(z.unknown()) 
  }),
  'sources:get-details': z.object({ sourceId: z.string() }),
  'sources:delete': z.object({ sourceId: z.string() }),
  'metadata:crawl': MetadataCrawlRequestSchema,
  'sources:test-connection': z.object({ sourceId: z.string() }),
  'sources:crawl-all': z.undefined(),
  'sources:retry-crawl': z.object({ sourceId: z.string() }),
  'search:semantic': SearchSemanticRequestSchema,
  'query:run-read-only': QueryRunReadOnlyRequestSchema,
  'models:list': z.undefined(),
  'models:download': ModelsDownloadRequestSchema,
  'models:enable': ModelsEnableRequestSchema,
  'models:healthcheck': ModelsHealthcheckRequestSchema,
  'nlsql:generate': NlSqlGenerateRequestSchema,
  'audit:list': AuditListRequestSchema,
  'graph:get': GraphGetRequestSchema,
  'canvas:get': CanvasGetRequestSchema,
  'canvas:update': CanvasUpdateRequestSchema,
  'canvas:save': CanvasSaveRequestSchema,
  'canvas:deleteBlock': z.object({ 
    canvasId: z.string(), 
    blockId: z.string(), 
    sourceId: z.string() 
  }),
  'tables:list': z.object({ sourceId: z.string() }),
  'tables:get-details': z.object({ sourceId: z.string(), tableId: z.string() }),
};

const okResponse = z.object({ ok: z.literal(true) });
const auditResponse = z.object({ entries: z.array(z.unknown()) });

const responseSchemas: Partial<Record<IpcChannel, z.ZodTypeAny>> = {
  'sources:add': z.union([z.object({ sourceId: z.string() }), SemantiqaErrorSchema]),
  'sources:check-duplicate': z.union([
    z.object({ 
      exists: z.boolean(), 
      existingSourceId: z.string().optional(), 
      existingSourceName: z.string().optional() 
    }),
    SemantiqaErrorSchema
  ]),
  'sources:get-details': z.union([
    z.object({
      sourceId: z.string(),
      name: z.string(),
      kind: z.enum(['postgres', 'mysql', 'mongo', 'duckdb']),
      databaseName: z.string().optional(),
      connectionStatus: z.enum(['unknown', 'checking', 'connected', 'error']),
      crawlStatus: z.enum(['not_crawled', 'crawling', 'crawled', 'error']),
      lastConnectedAt: z.string().optional(),
      lastCrawlAt: z.string().optional(),
      lastError: z.string().optional(),
      statistics: z.object({
        tableCount: z.number(),
        totalColumns: z.number(),
        schemas: z.array(z.object({ name: z.string(), tableCount: z.number() })).optional(),
      }),
    }),
    SemantiqaErrorSchema
  ]),
  'sources:delete': z.union([
    z.object({ 
      success: z.boolean(),
      deletedCounts: z.record(z.number())
    }), 
    SemantiqaErrorSchema
  ]),
  'metadata:crawl': z.union([MetadataCrawlResponseSchema, SemantiqaErrorSchema]),
  'sources:test-connection': z.object({ queued: z.boolean() }),
  'sources:crawl-all': z.union([okResponse, SemantiqaErrorSchema]),
  'sources:retry-crawl': z.object({ queued: z.boolean() }),
  'search:semantic': z.union([SearchResultsSchema, SemantiqaErrorSchema]),
  'query:run-read-only': z.union([QueryResultSchema, SemantiqaErrorSchema]),
  'models:list': z.union([ModelsListResponseSchema, SemantiqaErrorSchema]),
  'models:download': z.union([okResponse, SemantiqaErrorSchema]),
  'models:enable': z.union([okResponse, SemantiqaErrorSchema]),
  'models:healthcheck': z.union([ModelsHealthcheckResponseSchema, SemantiqaErrorSchema]),
  'nlsql:generate': z.union([NlSqlGenerateResponseSchema, SemantiqaErrorSchema]),
  'audit:list': z.union([auditResponse, SemantiqaErrorSchema]),
  'graph:get': z.union([GraphGetResponseSchema, SemantiqaErrorSchema]),
  'canvas:get': z.union([CanvasGetResponseSchema, SemantiqaErrorSchema]),
  'canvas:update': z.union([CanvasUpdateResponseSchema, SemantiqaErrorSchema]),
  'canvas:save': z.union([CanvasSaveResponseSchema, SemantiqaErrorSchema]),
  'canvas:deleteBlock': z.union([
    z.object({ success: z.boolean() }), 
    SemantiqaErrorSchema
  ]),
  'tables:list': z.union([
    z.object({ 
      tables: z.array(z.object({ 
        id: z.string(), 
        name: z.string(), 
        type: z.string(), 
        sourceId: z.string(),
        schema: z.string()
      })) 
    }), 
    SemantiqaErrorSchema
  ]),
  'tables:get-details': z.union([
    z.object({
      tableId: z.string(),
      sourceId: z.string(),
      name: z.string(),
      type: z.string(),
      schema: z.string().optional(),
      columnCount: z.number(),
      description: z.string().optional(),
      columns: z.array(z.object({
        name: z.string(),
        type: z.string(),
        nullable: z.boolean(),
        isPrimaryKey: z.boolean(),
        isForeignKey: z.boolean(),
        nullPercent: z.number().optional(),
        sampleValues: z.array(z.union([z.string(), z.number(), z.boolean()])).optional(),
      })),
      indexes: z.array(z.object({ name: z.string(), columns: z.array(z.string()), unique: z.boolean() })).optional(),
      foreignKeys: z.array(z.object({ name: z.string(), column: z.string(), referencedTable: z.string(), referencedColumn: z.string() })).optional(),
    }),
    SemantiqaErrorSchema
  ]),
};

export type IpcHandlerMap = {
  [K in IpcChannel]?: (
    payload: IpcRequest<K>,
  ) => Promise<IpcResponse<K>> | IpcResponse<K>;
};

export function registerIpcHandlers(handlerMap: IpcHandlerMap) {
  // Helper function to maintain type safety
  function registerHandler<K extends IpcChannel>(channel: K) {
    const handler = handlerMap[channel];
    if (!handler) {
      return;
    }

    const payloadSchema = channelToSchema[channel];
    if (!payloadSchema) {
      return;
    }

    ipcMain.handle(channel, async (event, rawPayload) => {
      const payloadLength = rawPayload && typeof rawPayload === 'object'
        ? Object.keys(rawPayload).length
        : 0;
      console.log(`🔌 IPC Handler called for ${channel} with length ${payloadLength}`);
      const parseResult = payloadSchema.safeParse(rawPayload);
      if (!parseResult.success) {
        console.error(`❌ Validation failed for ${channel}:`, parseResult.error.flatten());
        logIpcEvent({
          channel,
          direction: 'renderer->main',
          status: 'validation_error',
          request: rawPayload,
          error: parseResult.error.flatten(),
        });
        throw parseResult.error;
      }
      console.log(`✅ Validation passed for ${channel}`);

      // Type assertion to tell TypeScript the types align
      const result = await handler(parseResult.data as IpcRequest<K>);

      const responseSchema = responseSchemas[channel];
      if (responseSchema) {
        const validation = responseSchema.safeParse(result);
        if (!validation.success) {
          logIpcEvent({
            channel,
            direction: 'main->renderer',
            status: 'validation_error',
            response: result,
            error: validation.error.flatten(),
          });
          throw validation.error;
        }
      }

      logIpcEvent({
        channel,
        direction: 'renderer->main',
        status: 'ok',
        request: parseResult.data,
        response: result,
      });

      return result;
    });
  }

  // Register all handlers
  (Object.keys(channelToSchema) as Array<IpcChannel>).forEach((channel) => {
    registerHandler(channel);
  });

  ipcMain.handle(IPC_CHANNELS.HEALTH_PING, () => ({ ok: true, ts: Date.now() }));
}

