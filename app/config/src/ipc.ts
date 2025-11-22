import type {
  AuditListRequest,
  GraphGetRequest,
  GraphGetResponse,
  MetadataCrawlRequest,
  MetadataCrawlResponse,
  ModelsDownloadRequest,
  ModelsEnableRequest,
  ModelsHealthcheckRequest,
  ModelsHealthcheckResponse,
  ModelsListResponse,
  ModelsSelectRequest,
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
  | 'sources:get-details'
  | 'sources:delete'
  | 'metadata:crawl'
  | 'sources:test-connection'
  | 'sources:crawl-all'
  | 'sources:retry-crawl'
  | 'search:semantic'
  | 'query:run-read-only'
  | 'models:list'
  | 'models:download'
  | 'models:enable'
  | 'models:healthcheck'
  | 'models:select'
  | 'nlsql:generate'
  | 'audit:list'
  | 'graph:get'
  | 'canvas:get'
  | 'canvas:update'
  | 'canvas:save'
  | 'canvas:deleteBlock'
  | 'tables:list'
  | 'tables:get-details'
  | 'app:before-quit'
  | 'app:save-complete';

type HandlerMap = {
  /** IPC health check - verifies main process is responsive */
  'health:ping': {
    request: void;
    response: { ok: true; ts: number };
  };
  /** Adds a new data source connection (Postgres, MySQL, Mongo, or DuckDB) */
  'sources:add': {
    request: SourcesAddRequest;
    response: { sourceId: string } | SemantiqaError;
  };
  /** Checks if a data source with the same connection details already exists */
  'sources:check-duplicate': {
    request: { kind: string; connection: Record<string, unknown> };
    response: { exists: boolean; existingSourceId?: string; existingSourceName?: string } | SemantiqaError;
  };
  /** 
   * Fetches detailed statistics and metadata for a specific data source.
   * Returns comprehensive information including table counts, row counts,
   * column statistics, and schema details. Used by the data source inspector panel.
   */
  'sources:get-details': {
    request: { sourceId: string };
    response: {
      sourceId: string;
      name: string;
      kind: 'postgres' | 'mysql' | 'mongo' | 'duckdb';
      databaseName?: string;
      connectionStatus: 'unknown' | 'checking' | 'connected' | 'error';
      crawlStatus: 'not_crawled' | 'crawling' | 'crawled' | 'error';
      lastConnectedAt?: string;
      lastCrawlAt?: string;
      lastError?: string;
      statistics: {
        tableCount: number;
        totalColumns: number;
        schemas?: Array<{ name: string; tableCount: number }>;
      };
    } | SemantiqaError;
  };
  /** Permanently deletes a data source and all associated metadata, canvas blocks, and relationships */
  'sources:delete': {
    request: { sourceId: string };
    response: { success: boolean; deletedCounts: Record<string, number> } | SemantiqaError;
  };
  /** Triggers metadata crawl for a data source to introspect schema, tables, and columns */
  'metadata:crawl': {
    request: MetadataCrawlRequest;
    response: MetadataCrawlResponse | SemantiqaError;
  };
  /** Tests connection to a data source and queues health check */
  'sources:test-connection': {
    request: { sourceId: string };
    response: { queued: boolean };
  };
  /** Queues crawl for all connected data sources */
  'sources:crawl-all': {
    request: void;
    response: { queued: number } | SemantiqaError;
  };
  /** Retries crawl for a specific data source (used after errors) */
  'sources:retry-crawl': {
    request: { sourceId: string };
    response: { queued: boolean } | SemantiqaError;
  };
  /** Performs semantic search across schema metadata using hybrid keyword + vector search */
  'search:semantic': {
    request: SearchSemanticRequest;
    response: SearchResults | SemantiqaError;
  };
  /** Executes read-only SQL query with policy enforcement and auto-LIMIT */
  'query:run-read-only': {
    request: QueryRunReadOnlyRequest;
    response: QueryResult | SemantiqaError;
  };
  /** Lists available AI models for optional enrichment features */
  'models:list': {
    request: void;
    response: ModelsListResponse | SemantiqaError;
  };
  /** Downloads AI model for local inference (optional enrichment) */
  'models:download': {
    request: ModelsDownloadRequest;
    response: { ok: true } | SemantiqaError;
  };
  /** Enables specific AI model tasks (summarization, NL→SQL, etc.) */
  'models:enable': {
    request: ModelsEnableRequest;
    response: { ok: true } | SemantiqaError;
  };
  /** Runs local model healthcheck and returns latency/tokens info */
  'models:healthcheck': {
    request: ModelsHealthcheckRequest;
    response: ModelsHealthcheckResponse | SemantiqaError;
  };
  /** Selects a specific model as the active model for a given kind */
  'models:select': {
    request: ModelsSelectRequest;
    response: { ok: true } | SemantiqaError;
  };
  /** Generates SQL from natural language query (requires model enabled) */
  'nlsql:generate': {
    request: NlSqlGenerateRequest;
    response: NlSqlGenerateResponse | SemantiqaError;
  };
  /** Retrieves audit log entries for compliance and debugging */
  'audit:list': {
    request: AuditListRequest;
    response: { entries: unknown[] } | SemantiqaError;
  };
  /** Fetches graph nodes and edges for schema explorer */
  'graph:get': {
    request: GraphGetRequest;
    response: GraphGetResponse | SemantiqaError;
  };
  /** Fetches canvas state including blocks, relationships, and layout settings */
  'canvas:get': {
    request: CanvasGetRequest;
    response: CanvasGetResponse | SemantiqaError;
  };
  /** Updates canvas state, block positions, or relationship properties */
  'canvas:update': {
    request: CanvasUpdateRequest;
    response: CanvasUpdateResponse | SemantiqaError;
  };
  /** Manually saves canvas changes to SQLite (auto-save also available) */
  'canvas:save': {
    request: CanvasSaveRequest;
    response: CanvasSaveResponse | SemantiqaError;
  };
  /** Deletes a data source block from canvas and associated relationships */
  'canvas:deleteBlock': {
    request: { canvasId: string; blockId: string; sourceId: string };
    response: { success: boolean } | SemantiqaError;
  };
  /** Lists all tables/collections for a data source (used in drill-down view) */
  'tables:list': {
    request: { sourceId: string };
    response: { tables: Array<{ id: string; name: string; type: string; schema: string }> } | SemantiqaError;
  };
  /** 
   * Fetches detailed statistics and metadata for a specific table/collection.
   * Returns column information, data types, statistics, and sample values.
   * Used by the table inspector panel in drill-down view.
   */
  'tables:get-details': {
    request: { sourceId: string; tableId: string };
    response: {
      tableId: string;
      sourceId: string;
      name: string;
      type: string;
      schema?: string;
      columnCount: number;
      description?: string;
      columns: Array<{
        name: string;
        type: string;
        nullable: boolean;
        isPrimaryKey: boolean;
        isForeignKey: boolean;
        nullPercent?: number;
        sampleValues?: Array<string | number | boolean>;
      }>;
      indexes?: Array<{ name: string; columns: string[]; unique: boolean }>;
      foreignKeys?: Array<{ name: string; column: string; referencedTable: string; referencedColumn: string }>;
    } | SemantiqaError;
  };
  /** Notifies main process that app is about to quit (cleanup hook) */
  'app:before-quit': {
    request: void;
    response: void;
  };
  /** Notifies renderer that save operation completed (for UI feedback) */
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
  SOURCES_GET_DETAILS: 'sources:get-details' as const,
  SOURCES_DELETE: 'sources:delete' as const,
  METADATA_CRAWL: 'metadata:crawl' as const,
  SOURCES_TEST_CONNECTION: 'sources:test-connection' as const,
  SOURCES_CRAWL_ALL: 'sources:crawl-all' as const,
  SOURCES_RETRY_CRAWL: 'sources:retry-crawl' as const,
  SEARCH_SEMANTIC: 'search:semantic' as const,
  QUERY_RUN_READ_ONLY: 'query:run-read-only' as const,
  MODELS_LIST: 'models:list' as const,
  MODELS_DOWNLOAD: 'models:download' as const,
  MODELS_ENABLE: 'models:enable' as const,
  MODELS_HEALTHCHECK: 'models:healthcheck' as const,
  MODELS_SELECT: 'models:select' as const,
  NLSQL_GENERATE: 'nlsql:generate' as const,
  AUDIT_LIST: 'audit:list' as const,
  GRAPH_GET: 'graph:get' as const,
  CANVAS_GET: 'canvas:get' as const,
  CANVAS_UPDATE: 'canvas:update' as const,
  CANVAS_SAVE: 'canvas:save' as const,
  CANVAS_DELETE_BLOCK: 'canvas:deleteBlock' as const,
  TABLES_LIST: 'tables:list' as const,
  TABLES_GET_DETAILS: 'tables:get-details' as const,
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
  | 'MODELS_HEALTHCHECK'
  | 'MODELS_SELECT'
  | 'AUDIT_LIST'
  | 'GRAPH_GET'
  | 'SOURCES_ADD'
  | 'SOURCES_CHECK_DUPLICATE'
  | 'SOURCES_GET_DETAILS'
  | 'SOURCES_DELETE'
  | 'METADATA_CRAWL'
  | 'SOURCES_RETRY_CRAWL'
  | 'SOURCES_CRAWL_ALL'
  | 'SOURCES_TEST_CONNECTION'
  | 'CANVAS_GET'
  | 'CANVAS_UPDATE'
  | 'CANVAS_SAVE'
  | 'CANVAS_DELETE_BLOCK'
  | 'TABLES_LIST'
  | 'TABLES_GET_DETAILS'
>;

export const RENDERER_CHANNELS = Object.freeze({
  ...IPC_CHANNELS,
}) as SafeRendererChannels;

// Export channel values as array for preload whitelist
export const SAFE_RENDERER_CHANNEL_VALUES = Object.values({
  HEALTH_PING: IPC_CHANNELS.HEALTH_PING,
  SEARCH_SEMANTIC: IPC_CHANNELS.SEARCH_SEMANTIC,
  QUERY_RUN_READ_ONLY: IPC_CHANNELS.QUERY_RUN_READ_ONLY,
  NLSQL_GENERATE: IPC_CHANNELS.NLSQL_GENERATE,
  MODELS_LIST: IPC_CHANNELS.MODELS_LIST,
  MODELS_DOWNLOAD: IPC_CHANNELS.MODELS_DOWNLOAD,
  MODELS_ENABLE: IPC_CHANNELS.MODELS_ENABLE,
  MODELS_HEALTHCHECK: IPC_CHANNELS.MODELS_HEALTHCHECK,
  MODELS_SELECT: IPC_CHANNELS.MODELS_SELECT,
  AUDIT_LIST: IPC_CHANNELS.AUDIT_LIST,
  GRAPH_GET: IPC_CHANNELS.GRAPH_GET,
  SOURCES_ADD: IPC_CHANNELS.SOURCES_ADD,
  SOURCES_CHECK_DUPLICATE: IPC_CHANNELS.SOURCES_CHECK_DUPLICATE,
  SOURCES_GET_DETAILS: IPC_CHANNELS.SOURCES_GET_DETAILS,
  SOURCES_DELETE: IPC_CHANNELS.SOURCES_DELETE,
  METADATA_CRAWL: IPC_CHANNELS.METADATA_CRAWL,
  SOURCES_RETRY_CRAWL: IPC_CHANNELS.SOURCES_RETRY_CRAWL,
  SOURCES_CRAWL_ALL: IPC_CHANNELS.SOURCES_CRAWL_ALL,
  SOURCES_TEST_CONNECTION: IPC_CHANNELS.SOURCES_TEST_CONNECTION,
  CANVAS_GET: IPC_CHANNELS.CANVAS_GET,
  CANVAS_UPDATE: IPC_CHANNELS.CANVAS_UPDATE,
  CANVAS_SAVE: IPC_CHANNELS.CANVAS_SAVE,
  CANVAS_DELETE_BLOCK: IPC_CHANNELS.CANVAS_DELETE_BLOCK,
  TABLES_LIST: IPC_CHANNELS.TABLES_LIST,
  TABLES_GET_DETAILS: IPC_CHANNELS.TABLES_GET_DETAILS,
} as const) as readonly string[];

