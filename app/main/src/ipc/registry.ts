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

import { logIpcEvent } from '../logging/audit';

const channelToSchema: Partial<Record<IpcChannel, z.ZodTypeAny>> = {
  'health:ping': z.undefined(),
  'sources:add': SourcesAddRequestSchema,
  'metadata:crawl': MetadataCrawlRequestSchema,
  'sources:test-connection': z.object({ sourceId: z.string() }),
  'sources:crawl-all': z.undefined(),
  'search:semantic': SearchSemanticRequestSchema,
  'query:run-read-only': QueryRunReadOnlyRequestSchema,
  'models:list': z.undefined(),
  'models:download': ModelsDownloadRequestSchema,
  'models:enable': ModelsEnableRequestSchema,
  'nlsql:generate': NlSqlGenerateRequestSchema,
  'audit:list': AuditListRequestSchema,
  'graph:get': GraphGetRequestSchema,
};

const okResponse = z.object({ ok: z.literal(true) });
const auditResponse = z.object({ entries: z.array(z.unknown()) });

const responseSchemas: Partial<Record<IpcChannel, z.ZodTypeAny>> = {
  'sources:add': z.union([z.object({ sourceId: z.string() }), SemantiqaErrorSchema]),
  'metadata:crawl': z.union([MetadataCrawlResponseSchema, SemantiqaErrorSchema]),
  'sources:test-connection': z.object({ queued: z.boolean() }),
  'sources:crawl-all': z.union([okResponse, SemantiqaErrorSchema]),
  'search:semantic': z.union([SearchResultsSchema, SemantiqaErrorSchema]),
  'query:run-read-only': z.union([QueryResultSchema, SemantiqaErrorSchema]),
  'models:list': z.union([ModelsListResponseSchema, SemantiqaErrorSchema]),
  'models:download': z.union([okResponse, SemantiqaErrorSchema]),
  'models:enable': z.union([okResponse, SemantiqaErrorSchema]),
  'nlsql:generate': z.union([NlSqlGenerateResponseSchema, SemantiqaErrorSchema]),
  'audit:list': z.union([auditResponse, SemantiqaErrorSchema]),
  'graph:get': z.union([GraphGetResponseSchema, SemantiqaErrorSchema]),
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
      const parseResult = payloadSchema.safeParse(rawPayload);
      if (!parseResult.success) {
        logIpcEvent({
          channel,
          direction: 'renderer->main',
          status: 'validation_error',
          request: rawPayload,
          error: parseResult.error.flatten(),
        });
        throw parseResult.error;
      }

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
  (Object.keys(channelToSchema) as IpcChannel[]).forEach(channel => {
    registerHandler(channel);
  });

  ipcMain.handle(IPC_CHANNELS.HEALTH_PING, () => ({ ok: true, ts: Date.now() }));
}

