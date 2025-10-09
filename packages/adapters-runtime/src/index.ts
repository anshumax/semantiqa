export {
  PostgresAdapter,
  crawlSchema as crawlPostgres,
  profileTables as profilePostgres,
} from '@semantiqa/adapter-postgres';
export {
  MysqlAdapter,
  crawlSchema as crawlMysql,
  profileTables as profileMysql,
} from '@semantiqa/adapter-mysql';
export {
  MongoAdapter,
  crawlMongoSchema,
  profileMongoCollections,
} from '@semantiqa/adapter-mongo';
export {
  DuckDbAdapter,
  crawlDuckDbSchema,
  profileDuckDbTables,
} from '@semantiqa/adapter-duckdb';

