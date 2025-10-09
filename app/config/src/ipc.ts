import type {
  AuditListRequest,
  GraphGetRequest,
  GraphGetResponse,
  MetadataCrawlRequest,
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

export type IpcChannel =
  | 'health:ping'
  | 'sources:add'
  | 'sources:add:secure'
  | 'metadata:crawl'
  | 'sources:test-connection'
  | 'sources:crawl-all'
  | 'search:semantic'
  | 'query:run-read-only'
  | 'models:list'
  | 'models:download'
  | 'models:enable'
  | 'nlsql:generate'
  | 'audit:list'
  | 'graph:get';

type HandlerMap = {
  'health:ping': {
    request: void;
    response: { ok: true; ts: number };
  };
  'sources:add': {
    request: SourcesAddRequest;
    response: { sourceId: string } | SemantiqaError;
  };
  'metadata:crawl': {
    request: MetadataCrawlRequest;
    response: { snapshotId: string } | SemantiqaError;
  };
  'sources:test-connection': {
    request: { sourceId: string };
    response: 'connected' | 'error';
  };
  'sources:crawl-all': {
    request: void;
    response: { ok: true } | SemantiqaError;
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
};

export type IpcRequest<T extends IpcChannel> = HandlerMap[T]['request'];
export type IpcResponse<T extends IpcChannel> = HandlerMap[T]['response'];

export const IPC_CHANNELS = {
  HEALTH_PING: 'health:ping' as const,
  SOURCES_ADD: 'sources:add' as const,
  METADATA_CRAWL: 'metadata:crawl' as const,
  SOURCES_TEST_CONNECTION: 'sources:test-connection' as const,
  SOURCES_CRAWL_ALL: 'sources:crawl-all' as const,
  SEARCH_SEMANTIC: 'search:semantic' as const,
  QUERY_RUN_READ_ONLY: 'query:run-read-only' as const,
  MODELS_LIST: 'models:list' as const,
  MODELS_DOWNLOAD: 'models:download' as const,
  MODELS_ENABLE: 'models:enable' as const,
  NLSQL_GENERATE: 'nlsql:generate' as const,
  AUDIT_LIST: 'audit:list' as const,
  GRAPH_GET: 'graph:get' as const,
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
  | 'METADATA_CRAWL'
>;

export const RENDERER_CHANNELS = Object.freeze({
  ...IPC_CHANNELS,
}) as SafeRendererChannels;

