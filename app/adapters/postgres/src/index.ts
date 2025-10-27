export { crawlSchema, crawlSchemaWithForeignKeys } from './metadata/crawler';
export type {
  SchemaSnapshot as PostgresSchemaSnapshot,
  SchemaTable as PostgresSchemaTable,
  SchemaColumn as PostgresSchemaColumn,
} from './metadata/crawler';
export { getForeignKeys, type ForeignKeyConstraint } from './metadata/foreignKeys';
export { profileTables } from './metadata/profiler';
export { getRowCounts } from './metadata/rowCounts';
export type { CrawlWarning, AvailableFeatures, EnhancedCrawlResult } from './metadata/types';
export * from './postgresAdapter';

