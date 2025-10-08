import { app, BrowserWindow, protocol, session } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { IPC_CHANNELS } from '@semantiqa/app-config';
import { registerIpcHandlers, type IpcHandlerMap } from './ipc/registry';

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

  const handlerMap: IpcHandlerMap = {
    [IPC_CHANNELS.GRAPH_GET]: (request) => graphSnapshotService.getSnapshot(request),
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

