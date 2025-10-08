import type { Pool } from 'pg';
export interface ColumnProfile {
    column: string;
    nullFraction: number;
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
export declare function profileTables(pool: Pool): Promise<TableProfile[]>;
//# sourceMappingURL=profiler.d.ts.map