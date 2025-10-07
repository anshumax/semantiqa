import { z } from 'zod';

import { NonEmptyString } from './common';

const baseSourceFields = z.object({
  name: NonEmptyString,
  description: z.string().optional(),
  owners: z.array(NonEmptyString).default([]),
  tags: z.array(NonEmptyString).default([]),
});

const PostgresConnectionSchema = z.object({
  host: NonEmptyString,
  port: z.number().int().min(1).max(65535),
  database: NonEmptyString,
  user: NonEmptyString,
  password: NonEmptyString,
  ssl: z.boolean().optional(),
});

const MySqlConnectionSchema = z.object({
  host: NonEmptyString,
  port: z.number().int().min(1).max(65535),
  database: NonEmptyString,
  user: NonEmptyString,
  password: NonEmptyString,
  ssl: z.boolean().optional(),
});

const MongoConnectionSchema = z.object({
  uri: NonEmptyString,
  database: NonEmptyString,
  replicaSet: NonEmptyString.optional(),
});

const DuckDbConnectionSchema = z.object({
  filePath: NonEmptyString,
});

export const SourceConnectionSchema = z.union([
  PostgresConnectionSchema,
  MySqlConnectionSchema,
  MongoConnectionSchema,
  DuckDbConnectionSchema,
]);

export type PostgresConnection = z.infer<typeof PostgresConnectionSchema>;
export type MySqlConnection = z.infer<typeof MySqlConnectionSchema>;
export type MongoConnection = z.infer<typeof MongoConnectionSchema>;
export type DuckDbConnection = z.infer<typeof DuckDbConnectionSchema>;
export type SourceConnection =
  | PostgresConnection
  | MySqlConnection
  | MongoConnection
  | DuckDbConnection;

const PostgresSourceSchema = z
  .object({
    kind: z.literal('postgres'),
    connection: PostgresConnectionSchema,
  })
  .merge(baseSourceFields);

const MySqlSourceSchema = z
  .object({
    kind: z.literal('mysql'),
    connection: MySqlConnectionSchema,
  })
  .merge(baseSourceFields);

const MongoSourceSchema = z
  .object({
    kind: z.literal('mongo'),
    connection: MongoConnectionSchema,
  })
  .merge(baseSourceFields);

const DuckDbSourceSchema = z
  .object({
    kind: z.literal('duckdb'),
    connection: DuckDbConnectionSchema,
  })
  .merge(baseSourceFields);

export const SourcesAddRequestSchema = z.discriminatedUnion('kind', [
  PostgresSourceSchema,
  MySqlSourceSchema,
  MongoSourceSchema,
  DuckDbSourceSchema,
]);

export type SourcesAddRequest = z.infer<typeof SourcesAddRequestSchema>;

export const MetadataCrawlRequestSchema = z.object({
  sourceId: NonEmptyString,
});

export type MetadataCrawlRequest = z.infer<typeof MetadataCrawlRequestSchema>;
