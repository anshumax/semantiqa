import { app, BrowserWindow, protocol, session, dialog } from 'electron';
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
import { SourceDetailsService } from './services/SourceDetailsService';
import { TableDetailsService } from './services/TableDetailsService';
import { logIpcEvent } from './logging/audit';
import { SourceService, SnapshotRepository } from '@semantiqa/graph-service';
import { DatabaseService } from '@semantiqa/storage-sqlite';

let graphServices: {
  GraphSnapshotService: typeof import('./services/GraphSnapshotService').GraphSnapshotService;
} | null = null;

let databaseService: DatabaseService | null = null;

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

  // Initialize the centralized database service
  try {
    databaseService = DatabaseService.getInstance(dbPath);
  } catch (error: any) {
    console.error('Failed to initialize database', error);
    
    if (error.code === 'SQLITE_BUSY') {
      dialog.showErrorBox(
        'Database Locked',
        'The database is locked. Another instance of the application may be running.\n\nPlease close all instances and try again.'
      );
    } else {
      dialog.showErrorBox(
        'Database Error',
        `Failed to initialize database: ${error.message || 'Unknown error'}`
      );
    }
    
    app.quit();
    return;
  }

  // Create a factory that returns the singleton database connection
  const graphDbFactory = () => databaseService!.getConnection();
  
  const graphSnapshotService = new services.GraphSnapshotService({ openDatabase: graphDbFactory });

  // Shared dependencies for services
  const broadcastSourceStatus = (
    sourceId: string,
    payload: SourceStatusPayload,
  ) => {
    // Fetch source name from database
    const db = graphDbFactory();
    const source = db.prepare('SELECT name FROM sources WHERE id = ?').get(sourceId) as { name: string } | undefined;
    
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send('sources:status', {
        sourceId,
        sourceName: source?.name || sourceId, // Fallback to ID if name unavailable
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

  // Canvas service - use graphStore instance to ensure single connection
  const canvasService = new CanvasService(graphDbFactory());

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
    canvasService: canvasService,
  });

  // Tables service
  const tablesService = new TablesService({
    openSourcesDb: graphDbFactory,
  });

  // Source details service
  const sourceDetailsService = new SourceDetailsService({
    openSourcesDb: graphDbFactory,
  });

  // Table details service
  const tableDetailsService = new TableDetailsService({
    openSourcesDb: graphDbFactory,
  });

  // Database will be created by schema initialization if it doesn't exist
  // Canvas loading is handled by CanvasService.getCanvas() which reads existing data
  const databasePath = path.join(app.getPath('userData'), 'graph.db');
  console.log('🗄️ Database path:', databasePath);
  console.log('🗄️ Database exists:', fs.existsSync(databasePath));
  console.log('🗄️ Canvas will load existing blocks and relationships from database');

  const handlerMap: IpcHandlerMap = {
    [IPC_CHANNELS.GRAPH_GET]: (request) => graphSnapshotService.getSnapshot(request),
    [IPC_CHANNELS.SOURCES_ADD]: (request) => sourceProvisioningService.createSource(request),
    [IPC_CHANNELS.SOURCES_CHECK_DUPLICATE]: (request: { kind: string; connection: Record<string, unknown> }) => {
      // Check for duplicate connection without creating a source
      const sourceService = new SourceService({ openDatabase: graphDbFactory });
      const existing = sourceService.findExistingConnection(request as any);
      if (existing) {
        return {
          exists: true,
          existingSourceId: existing.id,
          existingSourceName: existing.name,
        };
      }
      return { exists: false };
    },
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
    [IPC_CHANNELS.CANVAS_DELETE_BLOCK]: (request) => canvasService.deleteBlock(request),
    [IPC_CHANNELS.TABLES_LIST]: async (request: { sourceId: string }) => tablesService.listTables(request.sourceId),
    [IPC_CHANNELS.SOURCES_GET_DETAILS]: async (request: { sourceId: string }) => sourceDetailsService.getSourceDetails(request.sourceId),
    [IPC_CHANNELS.TABLES_GET_DETAILS]: async (request: { sourceId: string; tableId: string }) => tableDetailsService.getTableDetails(request.sourceId, request.tableId),
  };

  registerIpcHandlers(handlerMap);

  await createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow();
    }
  });

  // Note: Auto-save on quit is handled by the debounced save in the renderer
  // The 5-second debounce ensures changes are saved before the user can quit
});

// Force database checkpoint before app quits to ensure data persistence
app.on('before-quit', async () => {
  console.log('🔄 App shutting down, forcing database checkpoint...');
  
  if (databaseService) {
    try {
      databaseService.checkpoint();
      console.log('✅ Database checkpoint completed');
    } catch (error) {
      console.error('❌ Database checkpoint failed:', error);
    }
  }
});

// Ensure database is properly closed on process exit
process.on('exit', () => {
  console.log('🔄 Process exiting, closing database...');
  if (databaseService) {
    try {
      databaseService.close();
      console.log('✅ Database closed successfully');
    } catch (error) {
      console.error('❌ Error closing database:', error);
    }
  }
});

process.on('SIGINT', () => {
  console.log('🔄 SIGINT received, closing database...');
  if (databaseService) {
    try {
      databaseService.close();
      console.log('✅ Database closed successfully');
    } catch (error) {
      console.error('❌ Error closing database:', error);
    }
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('🔄 SIGTERM received, closing database...');
  if (databaseService) {
    try {
      databaseService.close();
      console.log('✅ Database closed successfully');
    } catch (error) {
      console.error('❌ Error closing database:', error);
    }
  }
  process.exit(0);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

