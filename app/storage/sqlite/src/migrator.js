"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sqliteAvailable = void 0;
exports.loadMigrations = loadMigrations;
exports.runMigrations = runMigrations;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
let Sqlite = null;
try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Candidate = require('better-sqlite3');
    const probe = new Candidate(':memory:');
    probe.close();
    Sqlite = Candidate;
}
catch {
    Sqlite = null;
}
exports.sqliteAvailable = Sqlite !== null;
const MIGRATIONS_TABLE = `CREATE TABLE IF NOT EXISTS migrations (
  id TEXT PRIMARY KEY,
  checksum TEXT NOT NULL,
  applied_at TEXT NOT NULL
)`;
function calculateChecksum(sql) {
    return require('node:crypto').createHash('sha256').update(sql).digest('hex');
}
function loadMigrations(dir) {
    const filenames = node_fs_1.default
        .readdirSync(dir)
        .filter((file) => file.endsWith('.sql'))
        .sort();
    return filenames.map((filename) => {
        const filepath = node_path_1.default.join(dir, filename);
        const sql = node_fs_1.default.readFileSync(filepath, 'utf8');
        const checksum = calculateChecksum(sql);
        return {
            id: filename,
            filepath,
            checksum,
            sql,
        };
    });
}
function runMigrations(dbPath, migrationsDir) {
    if (!Sqlite) {
        return { applied: [] };
    }
    const db = new Sqlite(dbPath);
    db.pragma('journal_mode = WAL');
    db.exec(MIGRATIONS_TABLE);
    const appliedStmt = db.prepare('SELECT id, checksum FROM migrations ORDER BY id');
    const appliedRows = appliedStmt.all();
    const appliedMap = new Map(appliedRows.map((row) => [row.id, row.checksum]));
    const migrations = loadMigrations(migrationsDir);
    const applied = [];
    const insertMigration = db.prepare('INSERT INTO migrations (id, checksum, applied_at) VALUES (@id, @checksum, @applied_at)');
    const applyMigration = db.transaction((migration) => {
        db.exec(migration.sql);
        insertMigration.run({
            id: migration.id,
            checksum: migration.checksum,
            applied_at: new Date().toISOString(),
        });
    });
    for (const migration of migrations) {
        const existingChecksum = appliedMap.get(migration.id);
        if (existingChecksum === migration.checksum) {
            continue;
        }
        if (existingChecksum && existingChecksum !== migration.checksum) {
            throw new Error(`Checksum mismatch for migration ${migration.id}. Expected ${existingChecksum}, found ${migration.checksum}.`);
        }
        applyMigration(migration);
        applied.push(migration.id);
    }
    db.close();
    return { applied };
}
//# sourceMappingURL=migrator.js.map