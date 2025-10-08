import crypto from 'node:crypto';

import { AuditLogger } from './auditLogger';

let currentLogger: AuditLogger = new AuditLogger();

export function setAuditLogger(logger: AuditLogger) {
  currentLogger = logger;
}

export function getAuditLogger() {
  return currentLogger;
}

function checksum(value: unknown) {
  try {
    const json = JSON.stringify(value);
    return crypto.createHash('sha256').update(json).digest('hex');
  } catch {
    return undefined;
  }
}

export interface LogEventInput {
  channel: string;
  direction: 'renderer->main' | 'main->renderer';
  status: 'ok' | 'validation_error' | 'error';
  request?: unknown;
  response?: unknown;
  error?: unknown;
}

export function logIpcEvent(event: LogEventInput) {
  const entry = {
    channel: event.channel,
    direction: event.direction,
    status: event.status,
    ts: new Date().toISOString(),
    requestHash: checksum(event.request),
    responseHash: checksum(event.response),
    error: event.error,
  };

  currentLogger.write(entry);
}

