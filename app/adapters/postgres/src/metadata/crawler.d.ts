import type { Pool } from 'pg';
export interface SchemaColumn {
    name: string;
    type: string;
    nullable: boolean;
    defaultValue?: string | null;
    comment?: string | null;
}
export interface SchemaTable {
    schema: string;
    name: string;
    type: 'BASE TABLE' | 'VIEW';
    comment?: string | null;
    columns: SchemaColumn[];
}
export interface SchemaSnapshot {
    tables: SchemaTable[];
}
export declare function crawlSchema(pool: Pool): Promise<SchemaSnapshot>;
//# sourceMappingURL=crawler.d.ts.map