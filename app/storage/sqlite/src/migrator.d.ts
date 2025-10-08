export declare const sqliteAvailable: boolean;
export interface Migration {
    id: string;
    filepath: string;
    checksum: string;
    sql: string;
}
export interface MigrationResult {
    applied: string[];
}
export declare function loadMigrations(dir: string): Migration[];
export declare function runMigrations(dbPath: string, migrationsDir: string): MigrationResult;
//# sourceMappingURL=migrator.d.ts.map