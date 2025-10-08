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

const channelToSchema: Record<IpcChannel, z.ZodTypeAny> = {
  'health:ping': z.undefined(),
  'sources:add': SourcesAddRequestSchema,
  'metadata:crawl': MetadataCrawlRequestSchema,
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
  'metadata:crawl': z.union([z.object({ snapshotId: z.string() }), SemantiqaErrorSchema]),
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
  (Object.keys(IPC_CHANNELS) as Array<keyof typeof IPC_CHANNELS>).forEach((key) => {
    const channel = IPC_CHANNELS[key];
    const handler = handlerMap[channel];

    if (!handler) {
      return;
    }

    const payloadSchema = channelToSchema[channel];

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

      const result = await handler(parseResult.data);

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
  });

  ipcMain.handle(IPC_CHANNELS.HEALTH_PING, () => ({ ok: true, ts: Date.now() }));
}

