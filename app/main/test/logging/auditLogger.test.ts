import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { AuditLogger } from '../../src/logging/auditLogger';

const tempDirs: string[] = [];

function createTempDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'semantiqa-audit-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length) {
    const dir = tempDirs.pop();
    if (dir) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe('AuditLogger', () => {
  it('appends entries to JSONL log', () => {
    const dir = createTempDir();
    const logger = new AuditLogger({ logDir: dir, maxFileSizeBytes: 1024 });

    logger.write({
      channel: 'test',
      direction: 'renderer->main',
      status: 'ok',
      ts: new Date().toISOString(),
    });

    const contents = fs.readFileSync(path.join(dir, 'audit.log'), 'utf8');
    expect(contents.trim()).toContain('"channel":"test"');
  });

  it('rotates files when size exceeds limit', () => {
    const dir = createTempDir();
    const logger = new AuditLogger({ logDir: dir, maxFileSizeBytes: 50, maxFiles: 2 });

    for (let i = 0; i < 10; i += 1) {
      logger.write({
        channel: `test-${i}`,
        direction: 'renderer->main',
        status: 'ok',
        ts: new Date().toISOString(),
      });
    }

    const files = fs.readdirSync(dir).filter((file) => file.startsWith('audit.log'));
    expect(files.length).toBeLessThanOrEqual(3); // current + rotations
    expect(files).toContain('audit.log');
    expect(fs.existsSync(path.join(dir, 'audit.log.1'))).toBe(true);
  });
});

