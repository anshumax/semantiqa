import { promises as fs } from 'node:fs';
import { resolve } from 'node:path';

import { zodToJsonSchema } from 'zod-to-json-schema';
import { type ZodTypeAny } from 'zod';

import * as Contracts from '../contracts';

const OUTPUT_DIR = resolve(process.cwd(), 'json-schemas');

const schemaMap: Record<string, ZodTypeAny> = {
  'audit.list.request': Contracts.AuditListRequestSchema,
  'audit.list.response': Contracts.AuditListResponseSchema,
  error: Contracts.SemantiqaErrorSchema,
  'graph.get.response': Contracts.GraphGetResponseSchema,
  'graph.upsertNode.request': Contracts.GraphUpsertNodeRequestSchema,
  'metadata.crawl.request': Contracts.MetadataCrawlRequestSchema,
  'models.download.request': Contracts.ModelsDownloadRequestSchema,
  'models.enable.request': Contracts.ModelsEnableRequestSchema,
  'models.healthcheck.response': Contracts.ModelsHealthcheckResponseSchema,
  'models.list.response': Contracts.ModelsListResponseSchema,
  'models.manifest.entry': Contracts.ModelManifestEntrySchema,
  'nlsql.generate.request': Contracts.NlSqlGenerateRequestSchema,
  'nlsql.generate.response': Contracts.NlSqlGenerateResponseSchema,
  'query.runReadOnly.request': Contracts.QueryRunReadOnlyRequestSchema,
  'query.runReadOnly.response': Contracts.QueryResultSchema,
  'search.semantic.request': Contracts.SearchSemanticRequestSchema,
  'search.semantic.response': Contracts.SearchResultsSchema,
  'sources.add.request': Contracts.SourcesAddRequestSchema,
};

async function ensureOutputDir() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
}

async function writeSchema(fileName: string, schema: unknown) {
  const filePath = resolve(OUTPUT_DIR, `${fileName}.json`);
  const json = `${JSON.stringify(schema, null, 2)}\n`;
  await fs.writeFile(filePath, json, 'utf8');
}

async function run() {
  await ensureOutputDir();

  for (const [name, zodSchema] of Object.entries(schemaMap)) {
    const jsonSchema = zodToJsonSchema(zodSchema, {
      target: 'jsonSchema7',
      definitions: {},
      $refStrategy: 'none',
    });
    await writeSchema(name, jsonSchema);
  }

  console.log(`Generated ${Object.keys(schemaMap).length} JSON Schemas in ${OUTPUT_DIR}`);
}

run().catch((error) => {
  console.error('Failed to generate schemas', error);
  process.exitCode = 1;
});
