import { Pool, type PoolConfig, type QueryResultRow } from 'pg';
import { z } from 'zod';
export declare const PostgresConnectionSchema: z.ZodObject<{
    host: z.ZodString;
    port: z.ZodNumber;
    database: z.ZodString;
    user: z.ZodString;
    password: z.ZodString;
    ssl: z.ZodOptional<z.ZodUnion<[z.ZodLiteral<true>, z.ZodLiteral<false>, z.ZodObject<{
        rejectUnauthorized: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        rejectUnauthorized?: boolean | undefined;
    }, {
        rejectUnauthorized?: boolean | undefined;
    }>]>>;
}, "strip", z.ZodTypeAny, {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
    ssl?: boolean | {
        rejectUnauthorized?: boolean | undefined;
    } | undefined;
}, {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
    ssl?: boolean | {
        rejectUnauthorized?: boolean | undefined;
    } | undefined;
}>;
export type PostgresConnectionConfig = z.infer<typeof PostgresConnectionSchema>;
export interface PostgresAdapterOptions {
    connection: PostgresConnectionConfig;
    connectionTimeoutMs?: number;
    poolFactory?: (config: PoolConfig) => Pool;
}
export declare class PostgresAdapter {
    private readonly pool;
    constructor(options: PostgresAdapterOptions);
    healthCheck(): Promise<boolean>;
    private ensureReadOnly;
    query<T extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]): Promise<T[]>;
    close(): Promise<void>;
}
//# sourceMappingURL=postgresAdapter.d.ts.map