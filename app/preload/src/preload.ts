const { contextBridge, ipcRenderer } = require('electron') as typeof import('electron');

const safeChannels = new Set(['health:ping']);

const api = {
  ping(): string {
    return 'semantiqa-preload-ok';
  },
  getEnv(): Record<string, string | undefined> {
    return {
      NODE_ENV: process.env.NODE_ENV,
      SEMANTIQA_VERSION: process.env.SEMANTIQA_VERSION,
    };
  },
  send(channel: string, ...args: unknown[]) {
    if (!safeChannels.has(channel)) {
      throw new Error(`Blocked attempt to send on unsafe channel: ${channel}`);
    }

    ipcRenderer.send(channel, ...args);
  },
  on(channel: string, listener: (...args: unknown[]) => void) {
    if (!safeChannels.has(channel)) {
      throw new Error(`Blocked attempt to listen on unsafe channel: ${channel}`);
    }

    const wrappedListener = (_event: unknown, ...payload: unknown[]) => {
      listener(...payload);
    };

    ipcRenderer.on(channel, wrappedListener);

    return () => {
      ipcRenderer.removeListener(channel, wrappedListener);
    };
  },
};

contextBridge.exposeInMainWorld('semantiqa', Object.freeze({ api }));

