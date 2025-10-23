import { app, BrowserWindow, protocol, session } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import keytar from 'keytar';
import { IPC_CHANNELS } from '@semantiqa/app-config';
import { registerIpcHandlers, type IpcHandlerMap } from './ipc/registry';
import { SourceProvisioningService } from './application/SourceProvisioningService';
import { MetadataCrawlService } from './application/MetadataCrawlService';
import { ConnectivityQueue, ConnectivityService } from './application/ConnectivityService';
import { CrawlQueue } from './application/CrawlQueue';
import { ModelManagerService } from './services/ModelManagerService';
import { CanvasService } from './services/CanvasService';
import { TablesService } from './services/TablesService';
import { logIpcEvent } from './logging/audit';
import { SourceService, SnapshotRepository } from '@semantiqa/graph-service';
import { createSqliteFactory, initializeSchema } from '@semantiqa/storage-sqlite';

let graphServices: {
  GraphSnapshotService: typeof import('./services/GraphSnapshotService').GraphSnapshotService;
} | null = null;

type UiStatus = 'queued' | 'running' | 'connecting' | 'ready' | 'error' | 'warning' | 'needs_attention';

type CrawlStage = 'queued' | 'running' | 'completed' | 'failed';

type SourceStatusPayload =
  | {
      kind: 'crawl';
      status: UiStatus;
      crawlStatus: 'not_crawled' | 'crawling' | 'crawled' | 'error';
      stage?: CrawlStage;
      error?: { message: string; meta?: Record<string, unknown> };
      updatedAt: number;
    }
  | {
      kind: 'connection';
      status: UiStatus;
      connectionStatus: 'unknown' | 'checking' | 'connected' | 'error';
      error?: { message: string; meta?: Record<string, unknown> };
      updatedAt: number;
    };

function mapCrawlStatusToUi(
  status: 'not_crawled' | 'crawling' | 'crawled' | 'error',
  stage?: CrawlStage,
  error?: { message: string; meta?: Record<string, unknown> },
): SourceStatusPayload {
  switch (status) {
    case 'crawling':
      return { kind: 'crawl', status: 'running', crawlStatus: status, stage: stage ?? 'running', updatedAt: Date.now() };
    case 'crawled':
      return { kind: 'crawl', status: 'ready', crawlStatus: status, stage: stage ?? 'completed', updatedAt: Date.now() };
    case 'error':
      return {
        kind: 'crawl',
        status: 'error',
        crawlStatus: status,
        stage: stage ?? 'failed',
        error,
        updatedAt: Date.now(),
      };
    case 'not_crawled':
    default:
      return { kind: 'crawl', status: 'queued', crawlStatus: status, stage: stage ?? 'queued', updatedAt: Date.now() };
  }
}

type ConnectionStage = 'queued' | 'running' | 'completed' | 'failed';

const connectionStatusToStage = (
  status: 'unknown' | 'checking' | 'connected' | 'error',
): ConnectionStage => {
  switch (status) {
    case 'checking':
      return 'running';
    case 'connected':
      return 'completed';
    case 'error':
      return 'failed';
    case 'unknown':
    default:
      return 'queued';
  }
};

function mapConnectionStatusToUi(
  status: 'unknown' | 'checking' | 'connected' | 'error',
  error?: { message: string },
): { status: 'connecting' | 'queued' | 'ready' | 'error' | 'needs_attention'; error?: { message: string; meta?: Record<string, unknown> } } {
  return {
    status: status === 'connected' ? 'ready' : status === 'checking' ? 'connecting' : status === 'error' ? 'error' : 'queued',
    error: error ? { message: error.message } : undefined,
  };
}

function mapConnectionStatusToPayload(
  status: 'unknown' | 'checking' | 'connected' | 'error',
  error?: { message: string; meta?: Record<string, unknown> },
): SourceStatusPayload {
  const uiStatus = mapConnectionStatusToUi(status, error);
  return {
    kind: 'connection',
    status: uiStatus.status,
    connectionStatus: status,
    error,
    updatedAt: Date.now(),
  } satisfies SourceStatusPayload;
}

async function ensureGraphServices() {
  if (!graphServices) {
    const serviceModule = await import('./services/GraphSnapshotService');
    graphServices = {
      GraphSnapshotService: serviceModule.GraphSnapshotService,
    };
  }

  return graphServices;
}

const isDev = process.env.NODE_ENV === 'development';

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      secure: true,
      standard: true,
      bypassCSP: false,
      supportFetchAPI: true,
      corsEnabled: false,
    },
  },
]);

const preloadPath = path.join(__dirname, '..', '..', 'preload', 'dist', 'preload.js');
const rendererDist = path.join(__dirname, '..', '..', 'renderer', 'dist');

function resolveRendererUrl() {
  const devServer = process.env.VITE_DEV_SERVER_URL;
  if (isDev && devServer) {
    return devServer;
  }

  return url.pathToFileURL(path.join(rendererDist, 'index.html')).toString();
}

async function createWindow() {
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#141414',
    webPreferences: {
      contextIsolation: true,
      preload: preloadPath,
      nodeIntegration: false,
      sandbox: false,
      defaultEncoding: 'utf-8',
      devTools: isDev,
      spellcheck: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  });

  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  window.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error('Renderer failed to load', { errorCode, errorDescription, validatedURL });
  });

  window.webContents.on('will-navigate', (event, navigationUrl) => {
    const allowedOrigins = new Set<string>([
      'app:',
      'file:',
      isDev ? 'http://localhost:5173' : '',
    ]);

    const isAllowed = Array.from(allowedOrigins)
      .filter(Boolean)
      .some((origin) => navigationUrl.startsWith(origin));

    if (!isAllowed) {
      event.preventDefault();
    }
  });

  window.once('ready-to-show', () => {
    window.show();
    if (isDev) {
      window.webContents.openDevTools({ mode: 'detach' });
    }
  });

  await window.loadURL(resolveRendererUrl());
}

app.on('web-contents-created', (event, contents) => {
  contents.on('will-attach-webview', (attachEvent) => {
    attachEvent.preventDefault();
  });
});

app.whenReady().then(async () => {
  session.defaultSession.setPermissionRequestHandler((_, __, callback) => {
    callback(false);
  });

  const services = await ensureGraphServices();
  const dbPath = path.join(app.getPath('userData'), 'graph.db');

  try {
    initializeSchema(dbPath);
  } catch (error) {
    console.error('Failed to initialize database schema', error);
    throw error;
  }

  const graphDbFactory = createSqliteFactory({ dbPath });
  const graphSnapshotService = new (await ensureGraphServices()).GraphSnapshotService({ openDatabase: graphDbFactory });

  // Shared dependencies for services
  const broadcastSourceStatus = (
    sourceId: string,
    payload: SourceStatusPayload,
  ) => {
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send('sources:status', {
        sourceId,
        ...payload,
      });
    }
  };

const audit = ({ action, sourceId, status, details }: { action: string; sourceId?: string; status: 'success' | 'failure'; details?: Record<string, unknown> }) => {
    logIpcEvent({
      channel: action,
      direction: 'renderer->main',
      status: status === 'success' ? 'ok' : 'error',
      request: { sourceId, ...details },
    });
  };

  const retrieveSecret = async ({ sourceId, key }: { sourceId: string; key: string }) => {
    return await keytar.getPassword('semantiqa', `${sourceId}:${key}`);
  };

  const secureStore = async ({ sourceId, key }: { sourceId: string; key: string }, secret: string) => {
    await keytar.setPassword('semantiqa', `${sourceId}:${key}`, secret);
  };

  // Metadata crawl service
  const metadataCrawlService = new MetadataCrawlService({
    openSourcesDb: graphDbFactory,
    retrieveSecret,
    persistSnapshot: async ({ sourceId, kind, snapshot, stats }) => {
      const db = graphDbFactory();
      const repo = new SnapshotRepository(db);
      repo.persistSnapshot({ sourceId, kind, snapshot: snapshot as any, stats });
    },
    updateCrawlStatus: async (sourceId, status, error) => {
      broadcastSourceStatus(sourceId, mapCrawlStatusToUi(status, undefined, error));
    },
    updateConnectionStatus: async (sourceId, status, error) => {
      broadcastSourceStatus(sourceId, mapConnectionStatusToPayload(status, error));
    },
    audit,
    logger: console,
  });

  const crawlQueue = new CrawlQueue({
    crawlService: metadataCrawlService,
    notifyStatus: (sourceId, status) => {
      switch (status.status) {
        case 'queued':
          broadcastSourceStatus(sourceId, mapCrawlStatusToUi('not_crawled', 'queued'));
          break;
        case 'running':
          broadcastSourceStatus(sourceId, mapCrawlStatusToUi('crawling', 'running'));
          break;
        case 'completed':
          broadcastSourceStatus(sourceId, mapCrawlStatusToUi('crawled', 'completed'));
          break;
        case 'failed':
          broadcastSourceStatus(sourceId, mapCrawlStatusToUi('error', 'failed', { message: status.error.message }));
          break;
        default:
          break;
      }
    },
    logger: console,
  });

  const connectivityService = new ConnectivityService({
    openSourcesDb: graphDbFactory,
    retrieveSecret,
    audit,
    logger: console,
  });

  const connectivityQueue = new ConnectivityQueue({
    service: connectivityService,
    broadcastStatus: (sourceId, payload) => {
      const connectionStatus = 
        payload.status === 'ready' ? 'connected' :
        payload.status === 'connecting' ? 'checking' :
        payload.status === 'error' ? 'error' : 'unknown';
      
      broadcastSourceStatus(sourceId, {
        kind: 'connection',
        status: payload.status,
        connectionStatus,
        error: payload.error,
        updatedAt: Date.now(),
      });
    },
    mapStatus: (status, error) => mapConnectionStatusToUi(status, error),
    logger: console,
  });

  // Run connectivity checks on startup (async) - DISABLED: No demo sources
  // void connectivityQueue.queueStartupSweep();

  // Model manager service
  const modelManagerService = new ModelManagerService({
    openSourcesDb: graphDbFactory,
    audit,
    logger: console,
  });

  // Source provisioning service
  const sourceProvisioningService = new SourceProvisioningService({
    openSourcesDb: graphDbFactory,
    triggerMetadataCrawl: async (sourceId: string) => {
      crawlQueue.enqueue(sourceId);
    },
    secureStore,
    updateCrawlStatus: async (sourceId, status, error) => {
      broadcastSourceStatus(sourceId, mapCrawlStatusToUi(status, undefined, error));
    },
    updateConnectionStatus: async (sourceId, status, error) => {
      broadcastSourceStatus(sourceId, mapConnectionStatusToPayload(status, error));
    },
    audit,
    logger: console,
    createSourceService: () => new SourceService({ openDatabase: graphDbFactory }),
  });

  // Canvas service
  const canvasService = new CanvasService(graphDbFactory());

  // Tables service
  const tablesService = new TablesService({
    openSourcesDb: graphDbFactory,
  });

  // Ensure canvas has blocks for existing sources (one-time seeding on startup)
  try {
    const db = graphDbFactory();
    const existingBlocksStmt = db.prepare(
      "SELECT source_id FROM canvas_blocks WHERE canvas_id = 'default'"
    );
    const existingBlockSourceIds = new Set(
      (existingBlocksStmt.all() as Array<{ source_id: string }>).map((r) => r.source_id),
    );

    const sourcesStmt = db.prepare("SELECT id FROM sources");
    const sources = sourcesStmt.all() as Array<{ id: string }>;

    const insertBlockStmt = db.prepare(
      `INSERT OR IGNORE INTO canvas_blocks (
        id, canvas_id, source_id, position_x, position_y, width, height, z_index,
        color_theme, is_selected, is_minimized, created_at, updated_at
      ) VALUES (
        @id, 'default', @source_id, @x, @y, 200, 120, 0,
        'auto', 0, 0, @ts, @ts
      )`,
    );

    let index = 0;
    const spacingX = 260;
    const spacingY = 180;
    const perRow = 4;
    const now = new Date().toISOString();

    for (const { id: sourceId } of sources) {
      if (existingBlockSourceIds.has(sourceId)) continue;
      const row = Math.floor(index / perRow);
      const col = index % perRow;
      const x = 100 + col * spacingX;
      const y = 100 + row * spacingY;
      const blockId = `block-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

      insertBlockStmt.run({ id: blockId, source_id: sourceId, x, y, ts: now });
      index++;
    }
  } catch (seedErr) {
    console.warn('Canvas seeding skipped/failed:', seedErr);
  }

  const handlerMap: IpcHandlerMap = {
    [IPC_CHANNELS.GRAPH_GET]: (request) => graphSnapshotService.getSnapshot(request),
    [IPC_CHANNELS.SOURCES_ADD]: (request) => sourceProvisioningService.createSource(request),
    [IPC_CHANNELS.METADATA_CRAWL]: async (request) => crawlQueue.enqueue(request.sourceId),
    [IPC_CHANNELS.SOURCES_TEST_CONNECTION]: (request) => connectivityQueue.queueCheck(request.sourceId),
    [IPC_CHANNELS.SOURCES_CRAWL_ALL]: async () => {
      const db = graphDbFactory();
      const rows = db.prepare('SELECT id FROM sources').all() as Array<{ id: string }>;
      const queued = crawlQueue.enqueueAll(rows.map((row) => row.id));
      return { queued };
    },
    [IPC_CHANNELS.SOURCES_RETRY_CRAWL]: async (request) => {
      const result = crawlQueue.enqueue(request.sourceId);
      return { queued: result.queued };
    },
    [IPC_CHANNELS.MODELS_LIST]: async () => {
      return modelManagerService.listModels();
    },
    [IPC_CHANNELS.MODELS_DOWNLOAD]: async (request) => {
      return modelManagerService.downloadModel(request);
    },
    [IPC_CHANNELS.MODELS_ENABLE]: async (request) => {
      return modelManagerService.enableModel(request);
    },
    [IPC_CHANNELS.CANVAS_GET]: (request) => canvasService.getCanvas(request),
    [IPC_CHANNELS.CANVAS_UPDATE]: (request) => canvasService.updateCanvas(request),
    [IPC_CHANNELS.CANVAS_SAVE]: (request) => canvasService.saveCanvas(request),
    [IPC_CHANNELS.TABLES_LIST]: (request: { sourceId: string }) => tablesService.listTables(request.sourceId),
  };

  registerIpcHandlers(handlerMap);

  await createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

