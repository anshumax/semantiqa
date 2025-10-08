import type { IpcChannel, IpcRequest, IpcResponse } from '@semantiqa/app-config';

const { contextBridge, ipcRenderer } = require('electron') as typeof import('electron');

const allowedChannels: readonly IpcChannel[] = [
  'health:ping',
  'sources:add',
  'metadata:crawl',
  'search:semantic',
  'query:run-read-only',
  'models:list',
  'models:download',
  'models:enable',
  'nlsql:generate',
  'audit:list',
  'graph:get',
];

function assertChannel(channel: IpcChannel): IpcChannel {
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
  ping(): Promise<IpcResponse<'health:ping'>> {
    return api.invoke('health:ping', undefined as IpcRequest<'health:ping'>);
  },
};

contextBridge.exposeInMainWorld('semantiqa', Object.freeze({ api }));

