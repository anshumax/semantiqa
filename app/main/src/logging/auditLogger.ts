import fs from 'node:fs';
import path from 'node:path';

import { app } from 'electron';

const DEFAULT_MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const DEFAULT_MAX_FILES = 5;

export interface AuditLoggerOptions {
  logDir?: string;
  fileName?: string;
  maxFileSizeBytes?: number;
  maxFiles?: number;
}

export interface AuditLogEntry {
  channel: string;
  direction: 'renderer->main' | 'main->renderer';
  status: 'ok' | 'validation_error' | 'error';
  ts: string;
  requestHash?: string;
  responseHash?: string;
  error?: unknown;
}

export class AuditLogger {
  private readonly logDir: string;
  private readonly fileName: string;
  private readonly maxFileSizeBytes: number;
  private readonly maxFiles: number;

  constructor(options: AuditLoggerOptions = {}) {
    const userData = app?.getPath('userData') ?? process.cwd();
    this.logDir = options.logDir ?? path.join(userData, 'logs');
    this.fileName = options.fileName ?? 'audit.log';
    this.maxFileSizeBytes = options.maxFileSizeBytes ?? DEFAULT_MAX_SIZE_BYTES;
    this.maxFiles = options.maxFiles ?? DEFAULT_MAX_FILES;

    fs.mkdirSync(this.logDir, { recursive: true });
  }

  private get logPath() {
    return path.join(this.logDir, this.fileName);
  }

  private rotateLogs() {
    if (!fs.existsSync(this.logPath)) {
      return;
    }

    const { size } = fs.statSync(this.logPath);
    if (size < this.maxFileSizeBytes) {
      return;
    }

    for (let i = this.maxFiles - 1; i >= 0; i -= 1) {
      const source = i === 0 ? this.logPath : `${this.logPath}.${i}`;
      if (!fs.existsSync(source)) {
        continue;
      }

      const destination = `${this.logPath}.${i + 1}`;
      fs.renameSync(source, destination);
    }
  }

  write(entry: AuditLogEntry) {
    this.rotateLogs();

    const line = `${JSON.stringify(entry)}\n`;
    fs.appendFileSync(this.logPath, line, 'utf8');
  }
}

