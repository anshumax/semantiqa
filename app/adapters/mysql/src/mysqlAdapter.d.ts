import { type Pool, type PoolOptions } from 'mysql2/promise';
import type { RowDataPacket } from 'mysql2';
import { z } from 'zod';
export declare const MysqlConnectionSchema: z.ZodObject<{
    host: z.ZodString;
    port: z.ZodNumber;
    database: z.ZodString;
    user: z.ZodString;
    password: z.ZodString;
    ssl: z.ZodOptional<z.ZodUnion<[z.ZodLiteral<true>, z.ZodLiteral<false>, z.ZodObject<{
        rejectUnauthorized: z.ZodOptional<z.ZodBoolean>;
        minVersion: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        rejectUnauthorized?: boolean | undefined;
        minVersion?: string | undefined;
    }, {
        rejectUnauthorized?: boolean | undefined;
        minVersion?: string | undefined;
    }>]>>;
}, "strip", z.ZodTypeAny, {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
    ssl?: boolean | {
        rejectUnauthorized?: boolean | undefined;
        minVersion?: string | undefined;
    } | undefined;
}, {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
    ssl?: boolean | {
        rejectUnauthorized?: boolean | undefined;
        minVersion?: string | undefined;
    } | undefined;
}>;
export type MysqlConnectionConfig = z.infer<typeof MysqlConnectionSchema>;
export interface MysqlAdapterOptions {
    connection: MysqlConnectionConfig;
    connectionTimeoutMs?: number;
    poolFactory?: (config: PoolOptions) => Pool;
}
export declare class MysqlAdapter {
    private readonly pool;
    constructor(options: MysqlAdapterOptions);
    healthCheck(): Promise<boolean>;
    private ensureReadOnly;
    query<T = RowDataPacket[]>(sql: string, params?: unknown[]): Promise<T>;
    close(): Promise<void>;
}
//# sourceMappingURL=mysqlAdapter.d.ts.map