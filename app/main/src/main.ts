import { app, BrowserWindow, protocol, session } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import keytar from 'keytar';
import { IPC_CHANNELS } from '@semantiqa/app-config';
import { registerIpcHandlers, type IpcHandlerMap } from './ipc/registry';
import { SourceProvisioningService } from './application/SourceProvisioningService';
import { MetadataCrawlService } from './application/MetadataCrawlService';
import { ConnectivityService } from './application/ConnectivityService';
import { logIpcEvent } from './logging/audit';

let graphServices: {
  GraphSnapshotService: typeof import('./services/GraphSnapshotService').GraphSnapshotService;
  createSqliteFactory: (options: { dbPath: string }) => unknown;
  runMigrations: (dbPath: string, migrationsDir: string) => { applied: string[] };
} | null = null;

async function ensureGraphServices() {
  if (!graphServices) {
    const [serviceModule, storageModule] = await Promise.all([
      import('./services/GraphSnapshotService'),
      import('../../storage/sqlite/dist/index.js'),
    ]);
    graphServices = {
      GraphSnapshotService: serviceModule.GraphSnapshotService,
      createSqliteFactory: storageModule.createSqliteFactory as (options: { dbPath: string }) => unknown,
      runMigrations: storageModule.runMigrations as (dbPath: string, migrationsDir: string) => { applied: string[] },
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
  if (isDev) {
    const devServer = process.env.VITE_DEV_SERVER_URL ?? 'http://localhost:5173';
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
      sandbox: true,
      defaultEncoding: 'utf-8',
      devTools: isDev,
      spellcheck: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  });

  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

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
  const migrationsDir = app.isPackaged
    ? path.join(process.resourcesPath, 'app', 'storage', 'sqlite', 'migrations')
    : path.join(__dirname, '..', '..', 'storage', 'sqlite', 'migrations');

  if (!fs.existsSync(migrationsDir)) {
    console.warn(`SQLite migrations directory not found at ${migrationsDir}; skipping migrations`);
  } else {
    try {
      services.runMigrations(dbPath, migrationsDir);
    } catch (error) {
      console.error('Failed to run SQLite migrations', error);
      throw error;
    }
  }

  const graphDbFactory = services.createSqliteFactory({ dbPath }) as () => any;
  const graphSnapshotService = new services.GraphSnapshotService({ openDatabase: graphDbFactory });

  // Shared dependencies for services
  const updateSourceStatus = (sourceId: string, status: 'connecting' | 'queued' | 'ready' | 'error' | 'needs_attention') => {
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send('sources:status', {
        sourceId,
        status,
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
      const { SnapshotRepository } = await import('@semantiqa/graph-service');
      const db = graphDbFactory();
      const repo = new SnapshotRepository(db);
      repo.persistSnapshot({ sourceId, kind, snapshot: snapshot as any, stats });
    },
    updateCrawlStatus: async (sourceId, status, error) => {
      await updateSourceStatus(sourceId, status, error);
    },
    updateConnectionStatus: async (sourceId, status, error) => {
      await updateSourceStatus(sourceId, status, error);
    },
    audit,
    logger: console,
  });

  const connectivityService = new ConnectivityService({
    openSourcesDb: graphDbFactory,
    retrieveSecret,
    audit,
    logger: console,
  });

  // Run connectivity checks on startup (async)
  void connectivityService.checkAllSources();

  // Source provisioning service
  const sourceProvisioningService = new SourceProvisioningService({
    openSourcesDb: graphDbFactory,
    triggerMetadataCrawl: async (sourceId: string) => {
      await metadataCrawlService.crawlSource(sourceId);
    },
    secureStore,
    updateSourceStatus: async (sourceId, status, error) => {
      await updateSourceStatus(sourceId, status, error);
    },
    audit,
    logger: console,
  });

  const handlerMap: IpcHandlerMap = {
    [IPC_CHANNELS.GRAPH_GET]: (request) => graphSnapshotService.getSnapshot(request),
    [IPC_CHANNELS.SOURCES_ADD]: (request) => sourceProvisioningService.createSource(request),
    [IPC_CHANNELS.METADATA_CRAWL]: (request) => metadataCrawlService.crawlSource(request.sourceId),
    [IPC_CHANNELS.SOURCES_TEST_CONNECTION]: (request) => connectivityService.checkSource(request.sourceId),
    [IPC_CHANNELS.SOURCES_CRAWL_ALL]: async () => {
      const db = graphDbFactory();
      const rows = db.prepare<{ id: string }>('SELECT id FROM sources').all();
      for (const row of rows) {
        void metadataCrawlService.crawlSource(row.id);
      }
      return { ok: true };
    },
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

