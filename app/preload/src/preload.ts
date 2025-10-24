import type { IpcChannel, IpcRequest, IpcResponse } from '@semantiqa/app-config';

interface CustomEventInit<T = unknown> {
  detail?: T;
}

declare class CustomEvent<T = unknown> {
  constructor(type: string, eventInitDict?: CustomEventInit<T>);
}

declare const window: {
  dispatchEvent(event: CustomEvent): boolean;
};

const { contextBridge, ipcRenderer } = require('electron') as typeof import('electron');

const allowedChannels: readonly string[] = [
  'health:ping',
  'sources:add',
  'sources:check-duplicate',
  'metadata:crawl',
  'sources:test-connection',
  'sources:crawl-all',
  'sources:retry-crawl',
  'search:semantic',
  'query:run-read-only',
  'models:list',
  'models:download',
  'models:enable',
  'nlsql:generate',
  'audit:list',
  'graph:get',
  'canvas:get',
  'canvas:update',
  'canvas:save',
  'canvas:deleteBlock',
  'tables:list',
  'app:before-quit',
  'app:save-complete',
];

function assertChannel(channel: string): string {
  if (!allowedChannels.includes(channel)) {
    throw new Error(`Blocked attempt to access channel: ${channel}`);
  }

  return channel;
}

const api = {
  invoke<T extends IpcChannel>(channel: T, payload: IpcRequest<T>) {
    const safeChannel = assertChannel(channel);
    return ipcRenderer.invoke(safeChannel, payload) as Promise<IpcResponse<T>>;
  },
  send(channel: string, payload?: unknown) {
    const safeChannel = assertChannel(channel);
    ipcRenderer.send(safeChannel, payload);
  },
  on(channel: string, func: (...args: unknown[]) => void) {
    const safeChannel = assertChannel(channel);
    ipcRenderer.on(safeChannel, func);
  },
  ping(): Promise<IpcResponse<'health:ping'>> {
    return api.invoke('health:ping', undefined as IpcRequest<'health:ping'>);
  },
};

const bridge = {
  publish(event: 'sources:status', payload: unknown) {
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent(event, { detail: payload }));
    }
  },
};

ipcRenderer.on('sources:status', (_event, payload: unknown) => {
  bridge.publish('sources:status', payload);
});

contextBridge.exposeInMainWorld('semantiqa', Object.freeze({ api, bridge }));

