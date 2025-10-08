import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { logIpcEvent, getAuditLogger, setAuditLogger } from '../src/logging/audit';
import { AuditLogger } from '../src/logging/auditLogger';

let originalLogger: AuditLogger;
let tempLogDir: string;

describe('logIpcEvent', () => {
  beforeEach(() => {
    tempLogDir = fs.mkdtempSync(path.join(os.tmpdir(), 'semantiqa-audit-test-'));
    originalLogger = getAuditLogger();
    setAuditLogger(new AuditLogger({ logDir: tempLogDir, maxFileSizeBytes: 1024 }));
  });

  afterEach(() => {
    setAuditLogger(originalLogger);
    fs.rmSync(tempLogDir, { recursive: true, force: true });
  });

  it('writes hashed entry to audit log', () => {
    logIpcEvent({
      channel: 'test',
      direction: 'renderer->main',
      status: 'ok',
      request: { foo: 'bar' },
      response: { ok: true },
    });

    const logfile = path.join(tempLogDir, 'audit.log');
    expect(fs.existsSync(logfile)).toBe(true);
    const contents = fs.readFileSync(logfile, 'utf8');
    expect(contents).toContain('"channel":"test"');
    expect(contents).toContain('requestHash');
  });
});

