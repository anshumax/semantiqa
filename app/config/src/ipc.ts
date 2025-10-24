import type {
  AuditListRequest,
  GraphGetRequest,
  GraphGetResponse,
  MetadataCrawlRequest,
  MetadataCrawlResponse,
  ModelsDownloadRequest,
  ModelsEnableRequest,
  ModelsListResponse,
  NlSqlGenerateRequest,
  NlSqlGenerateResponse,
  QueryResult,
  QueryRunReadOnlyRequest,
  SearchResults,
  SearchSemanticRequest,
  SemantiqaError,
  SourcesAddRequest,
} from '@semantiqa/contracts';
import type {
  CanvasGetRequest,
  CanvasGetResponse,
  CanvasUpdateRequest,
  CanvasUpdateResponse,
  CanvasSaveRequest,
  CanvasSaveResponse,
} from '@semantiqa/contracts';

export type IpcChannel =
  | 'health:ping'
  | 'sources:add'
  | 'sources:add:secure'
  | 'sources:check-duplicate'
  | 'metadata:crawl'
  | 'sources:test-connection'
  | 'sources:crawl-all'
  | 'sources:retry-crawl'
  | 'search:semantic'
  | 'query:run-read-only'
  | 'models:list'
  | 'models:download'
  | 'models:enable'
  | 'nlsql:generate'
  | 'audit:list'
  | 'graph:get'
  | 'canvas:get'
  | 'canvas:update'
  | 'canvas:save'
  | 'canvas:deleteBlock'
  | 'tables:list'
  | 'app:before-quit'
  | 'app:save-complete';

type HandlerMap = {
  'health:ping': {
    request: void;
    response: { ok: true; ts: number };
  };
  'sources:add': {
    request: SourcesAddRequest;
    response: { sourceId: string } | SemantiqaError;
  };
  'sources:check-duplicate': {
    request: { kind: string; connection: Record<string, unknown> };
    response: { exists: boolean; existingSourceId?: string; existingSourceName?: string } | SemantiqaError;
  };
  'metadata:crawl': {
    request: MetadataCrawlRequest;
    response: MetadataCrawlResponse | SemantiqaError;
  };
  'sources:test-connection': {
    request: { sourceId: string };
    response: { queued: boolean };
  };
  'sources:crawl-all': {
    request: void;
    response: { queued: number } | SemantiqaError;
  };
  'sources:retry-crawl': {
    request: { sourceId: string };
    response: { queued: boolean } | SemantiqaError;
  };
  'search:semantic': {
    request: SearchSemanticRequest;
    response: SearchResults | SemantiqaError;
  };
  'query:run-read-only': {
    request: QueryRunReadOnlyRequest;
    response: QueryResult | SemantiqaError;
  };
  'models:list': {
    request: void;
    response: ModelsListResponse | SemantiqaError;
  };
  'models:download': {
    request: ModelsDownloadRequest;
    response: { ok: true } | SemantiqaError;
  };
  'models:enable': {
    request: ModelsEnableRequest;
    response: { ok: true } | SemantiqaError;
  };
  'nlsql:generate': {
    request: NlSqlGenerateRequest;
    response: NlSqlGenerateResponse | SemantiqaError;
  };
  'audit:list': {
    request: AuditListRequest;
    response: { entries: unknown[] } | SemantiqaError;
  };
  'graph:get': {
    request: GraphGetRequest;
    response: GraphGetResponse | SemantiqaError;
  };
  'canvas:get': {
    request: CanvasGetRequest;
    response: CanvasGetResponse | SemantiqaError;
  };
  'canvas:update': {
    request: CanvasUpdateRequest;
    response: CanvasUpdateResponse | SemantiqaError;
  };
  'canvas:save': {
    request: CanvasSaveRequest;
    response: CanvasSaveResponse | SemantiqaError;
  };
  'canvas:deleteBlock': {
    request: { canvasId: string; blockId: string; sourceId: string };
    response: { success: boolean } | SemantiqaError;
  };
  'tables:list': {
    request: { sourceId: string };
    response: { tables: Array<{ id: string; name: string; type: string; schema: string; rowCount: number }> } | SemantiqaError;
  };
  'app:before-quit': {
    request: void;
    response: void;
  };
  'app:save-complete': {
    request: void;
    response: void;
  };
};

export type IpcRequest<T extends IpcChannel> = T extends keyof HandlerMap
  ? HandlerMap[T]['request']
  : never;
export type IpcResponse<T extends IpcChannel> = T extends keyof HandlerMap
  ? HandlerMap[T]['response']
  : never;

export const IPC_CHANNELS = {
  HEALTH_PING: 'health:ping' as const,
  SOURCES_ADD: 'sources:add' as const,
  SOURCES_CHECK_DUPLICATE: 'sources:check-duplicate' as const,
  METADATA_CRAWL: 'metadata:crawl' as const,
  SOURCES_TEST_CONNECTION: 'sources:test-connection' as const,
  SOURCES_CRAWL_ALL: 'sources:crawl-all' as const,
  SOURCES_RETRY_CRAWL: 'sources:retry-crawl' as const,
  SEARCH_SEMANTIC: 'search:semantic' as const,
  QUERY_RUN_READ_ONLY: 'query:run-read-only' as const,
  MODELS_LIST: 'models:list' as const,
  MODELS_DOWNLOAD: 'models:download' as const,
  MODELS_ENABLE: 'models:enable' as const,
  NLSQL_GENERATE: 'nlsql:generate' as const,
  AUDIT_LIST: 'audit:list' as const,
  GRAPH_GET: 'graph:get' as const,
  CANVAS_GET: 'canvas:get' as const,
  CANVAS_UPDATE: 'canvas:update' as const,
  CANVAS_SAVE: 'canvas:save' as const,
  CANVAS_DELETE_BLOCK: 'canvas:deleteBlock' as const,
  TABLES_LIST: 'tables:list' as const,
} satisfies Record<string, IpcChannel>;

export type SafeRendererChannels = Pick<
  typeof IPC_CHANNELS,
  | 'HEALTH_PING'
  | 'SEARCH_SEMANTIC'
  | 'QUERY_RUN_READ_ONLY'
  | 'NLSQL_GENERATE'
  | 'MODELS_LIST'
  | 'MODELS_DOWNLOAD'
  | 'MODELS_ENABLE'
  | 'AUDIT_LIST'
  | 'GRAPH_GET'
  | 'SOURCES_ADD'
  | 'SOURCES_CHECK_DUPLICATE'
  | 'METADATA_CRAWL'
  | 'SOURCES_RETRY_CRAWL'
  | 'SOURCES_CRAWL_ALL'
  | 'SOURCES_TEST_CONNECTION'
  | 'CANVAS_GET'
  | 'CANVAS_UPDATE'
  | 'CANVAS_SAVE'
  | 'CANVAS_DELETE_BLOCK'
  | 'TABLES_LIST'
>;

export const RENDERER_CHANNELS = Object.freeze({
  ...IPC_CHANNELS,
}) as SafeRendererChannels;

