import type { Pool } from 'mysql2/promise';
export interface ColumnProfile {
    column: string;
    nullFraction: number | null;
    distinctFraction: number | null;
    min?: string | number | null;
    max?: string | number | null;
}
export interface TableProfile {
    schema: string;
    name: string;
    columns: ColumnProfile[];
    sampledRows: number;
}
export interface MysqlProfileOptions {
    sampleSize?: number;
}
export declare function profileTables(pool: Pool, options?: MysqlProfileOptions): Promise<TableProfile[]>;
//# sourceMappingURL=profiler.d.ts.map