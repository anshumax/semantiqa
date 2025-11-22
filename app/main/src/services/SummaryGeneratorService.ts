import type { Database } from 'better-sqlite3';
import type { SemantiqaError, SummaryMode } from '@semantiqa/contracts';
import type { GeneratorService } from './GeneratorService.js';

type BetterSqliteDatabase = Database;

export interface SummaryGeneratorServiceDeps {
  openSourcesDb: () => BetterSqliteDatabase;
  logger: Console;
  audit: (entry: { action: string; sourceId?: string; status: 'success' | 'failure'; details?: Record<string, unknown> }) => void;
  generatorService: GeneratorService;
}

export interface GenerateSummaryRequest {
  nodeId: string;
  force?: boolean; // Regenerate even if summary exists
  mode?: SummaryMode; // 'auto' (default), 'ai', or 'heuristic'
}

export interface GenerateSummaryResponse {
  nodeId: string;
  summary: string;
  summaryType: 'heuristic' | 'ai_generated' | 'user_edited';
  generatedAt: string;
}

/**
 * Generates human-readable summaries for database entities
 * without requiring AI models (heuristic generation)
 */
export class SummaryGeneratorService {
  constructor(private readonly deps: SummaryGeneratorServiceDeps) {}

  /**
   * Generate a summary for a table, collection, or other node
   */
  async generateSummary(request: GenerateSummaryRequest): Promise<GenerateSummaryResponse | SemantiqaError> {
    const { openSourcesDb, logger, audit } = this.deps;
    const { nodeId, force, mode = 'auto' } = request;

    try {
      const db = openSourcesDb();

      // Get node details
      const node = db.prepare(`
        SELECT id, type, props
        FROM nodes
        WHERE id = ?
      `).get(nodeId) as { id: string; type: string; props: string } | undefined;

      if (!node) {
        return {
          code: 'NOT_FOUND',
          message: 'Node not found',
          details: { nodeId },
        };
      }

      const props = JSON.parse(node.props);

      // Check if summary already exists (unless force regeneration)
      if (!force && props.summary) {
        logger.info('Summary already exists', { nodeId });
        return {
          nodeId,
          summary: props.summary,
          summaryType: props.summaryType || 'heuristic',
          generatedAt: props.summaryGeneratedAt || new Date().toISOString(),
        };
      }

      // Determine generation method
      if (mode === 'heuristic') {
        return this.generateHeuristicSummaryForNode(db, node, props);
      }

      // For 'ai' or 'auto' modes, check model availability
      const modelAvailable = await this.isGeneratorModelAvailable(db);

      if (!modelAvailable) {
        if (mode === 'ai') {
          return {
            code: 'VALIDATION_ERROR',
            message: 'AI generation requested but no generator model available',
            details: { 
              nodeId,
              suggestion: 'Install a generator model or use heuristic mode' 
            },
          };
        }
        // Auto mode falls back to heuristic
        logger.info('No model available, using heuristic', { nodeId, mode });
        return this.generateHeuristicSummaryForNode(db, node, props);
      }

      // Try AI generation
      try {
        logger.info('Attempting AI generation', { nodeId, mode });
        return await this.generateAISummaryForNode(db, node, props);
      } catch (error) {
        logger.error('AI generation failed', { error, nodeId });
        
        if (mode === 'ai') {
          // Explicit AI mode should return error
          return {
            code: 'INTERNAL_ERROR',
            message: 'AI generation failed',
            details: { error: (error as Error).message },
          };
        }
        
        // Auto mode falls back to heuristic
        logger.info('Falling back to heuristic', { nodeId });
        return this.generateHeuristicSummaryForNode(db, node, props);
      }
    } catch (error) {
      logger.error('Failed to generate summary', { error, nodeId });
      return {
        code: 'INTERNAL_ERROR',
        message: 'Failed to generate summary',
        details: { error: (error as Error).message },
      };
    }
  }

  /**
   * Check if a generator model is available and has summaries task enabled
   */
  private async isGeneratorModelAvailable(db: BetterSqliteDatabase): Promise<boolean> {
    const model = db.prepare(`
      SELECT id FROM models
      WHERE kind = 'generator'
      AND path IS NOT NULL
      AND (
        enabled_tasks LIKE '%summaries%'
        OR json_array_length(enabled_tasks) > 0
      )
    `).get() as { id: string } | undefined;

    return !!model;
  }

  /**
   * Generate heuristic summary for a node (original implementation)
   */
  private async generateHeuristicSummaryForNode(
    db: BetterSqliteDatabase,
    node: { id: string; type: string; props: string },
    props: any
  ): Promise<GenerateSummaryResponse | SemantiqaError> {
    const { logger, audit } = this.deps;

    // Generate summary based on node type
    let summary: string;
    switch (node.type) {
      case 'table':
        summary = await this.generateTableSummary(db, node.id, props);
        break;
      case 'collection':
        summary = await this.generateCollectionSummary(db, node.id, props);
        break;
      default:
        return {
          code: 'VALIDATION_ERROR',
          message: `Summary generation not supported for node type: ${node.type}`,
          details: { nodeId: node.id, type: node.type },
        };
    }

    // Store summary in node props
    const now = new Date().toISOString();
    const updatedProps = {
      ...props,
      summary,
      summaryType: 'heuristic' as const,
      summaryGeneratedAt: now,
    };

    db.prepare(`
      UPDATE nodes
      SET props = ?, updated_at = ?
      WHERE id = ?
    `).run(JSON.stringify(updatedProps), now, node.id);

    logger.info('Generated heuristic summary', { nodeId: node.id, length: summary.length });
    audit({
      action: 'summary.generated',
      status: 'success',
      details: { nodeId: node.id, type: node.type, summaryType: 'heuristic' },
    });

    return {
      nodeId: node.id,
      summary,
      summaryType: 'heuristic',
      generatedAt: now,
    };
  }

  /**
   * Generate AI-enhanced summary for a node
   */
  private async generateAISummaryForNode(
    db: BetterSqliteDatabase,
    node: { id: string; type: string; props: string },
    props: any
  ): Promise<GenerateSummaryResponse | SemantiqaError> {
    const { logger, audit, generatorService } = this.deps;

    // Build prompt based on node type
    let prompt: string;
    switch (node.type) {
      case 'table':
        prompt = await this.buildTablePrompt(db, node.id, props);
        break;
      case 'collection':
        prompt = await this.buildCollectionPrompt(db, node.id, props);
        break;
      default:
        return {
          code: 'VALIDATION_ERROR',
          message: `AI summary generation not supported for node type: ${node.type}`,
          details: { nodeId: node.id, type: node.type },
        };
    }

    // Call generator service
    logger.info('Calling AI model for summary', { nodeId: node.id, promptLength: prompt.length });
    const result = await generatorService.summarize({ text: prompt });

    if ('code' in result) {
      throw new Error(result.message);
    }

    const summary = result.summary.trim();

    // Store summary in node props
    const now = new Date().toISOString();
    const updatedProps = {
      ...props,
      summary,
      summaryType: 'ai_generated' as const,
      summaryGeneratedAt: now,
    };

    db.prepare(`
      UPDATE nodes
      SET props = ?, updated_at = ?
      WHERE id = ?
    `).run(JSON.stringify(updatedProps), now, node.id);

    logger.info('Generated AI summary', { nodeId: node.id, length: summary.length });
    audit({
      action: 'summary.generated',
      status: 'success',
      details: { nodeId: node.id, type: node.type, summaryType: 'ai_generated' },
    });

    return {
      nodeId: node.id,
      summary,
      summaryType: 'ai_generated',
      generatedAt: now,
    };
  }

  /**
   * Generate heuristic summary for a relational table
   */
  private async generateTableSummary(
    db: BetterSqliteDatabase,
    tableId: string,
    tableProps: any
  ): Promise<string> {
    const { name, schema, tableType, comment, sourceId } = tableProps;

    // Get columns for this table
    const columnRows = db.prepare(`
      SELECT props
      FROM nodes
      WHERE type = 'column'
      AND json_extract(props, '$.tableId') = ?
      ORDER BY json_extract(props, '$.ordinalPosition')
    `).all(tableId) as Array<{ props: string }>;

    const columns = columnRows.map(row => JSON.parse(row.props));

    // Get row count (if available)
    const sourceRow = db.prepare(`
      SELECT props
      FROM nodes
      WHERE id = ?
    `).get(sourceId) as { props: string } | undefined;

    // Analyze columns
    const primaryKeys = columns.filter(c => c.isPrimaryKey);
    const foreignKeys = columns.filter(c => c.isForeignKey);
    const nullable = columns.filter(c => c.nullable);
    const highNullPercent = columns.filter(c => c.nullPercent && c.nullPercent > 0.5);

    // Infer purpose from table name and column names
    const purpose = this.inferTablePurpose(name, columns);

    // Build summary
    const parts: string[] = [];

    // Opening sentence
    const typeDesc = tableType === 'VIEW' ? 'view' : 'table';
    const schemaDesc = schema && schema !== 'public' ? ` in the ${schema} schema` : '';
    parts.push(`**${name}** is a ${typeDesc}${schemaDesc}.`);

    // Add comment if available
    if (comment) {
      parts.push(comment);
    } else if (purpose) {
      parts.push(purpose);
    }

    // Column count
    parts.push(`\nIt contains ${columns.length} column${columns.length !== 1 ? 's' : ''}.`);

    // Key columns
    if (primaryKeys.length > 0) {
      const pkNames = primaryKeys.map(pk => `\`${pk.name}\``).join(', ');
      parts.push(`\nPrimary key: ${pkNames}`);
    }

    // Important columns (first few non-PK columns)
    const importantColumns = this.identifyImportantColumns(columns, primaryKeys);
    if (importantColumns.length > 0) {
      parts.push('\n\n**Key columns:**');
      for (const col of importantColumns.slice(0, 5)) {
        const desc = this.describeColumn(col);
        parts.push(`\n- \`${col.name}\` (${col.dataType}): ${desc}`);
      }
    }

    // Relationships
    if (foreignKeys.length > 0) {
      parts.push(`\n\nThe table has ${foreignKeys.length} foreign key relationship${foreignKeys.length !== 1 ? 's' : ''}.`);
    }

    // Data quality notes
    if (highNullPercent.length > 0) {
      const colNames = highNullPercent.map(c => `\`${c.name}\``).join(', ');
      parts.push(`\n\n*Note: High null percentage in: ${colNames}*`);
    }

    parts.push('\n\n*Auto-generated description*');

    return parts.join('');
  }

  /**
   * Generate heuristic summary for a MongoDB collection
   */
  private async generateCollectionSummary(
    db: BetterSqliteDatabase,
    collectionId: string,
    collectionProps: any
  ): Promise<string> {
    const { name, sourceId } = collectionProps;

    // Get fields for this collection
    const fieldRows = db.prepare(`
      SELECT props
      FROM nodes
      WHERE type = 'field'
      AND json_extract(props, '$.collectionId') = ?
      ORDER BY json_extract(props, '$.name')
    `).all(collectionId) as Array<{ props: string }>;

    const fields = fieldRows.map(row => JSON.parse(row.props));

    // Infer purpose from collection name and field names
    const purpose = this.inferCollectionPurpose(name, fields);

    // Build summary
    const parts: string[] = [];

    // Opening sentence
    parts.push(`**${name}** is a MongoDB collection.`);

    if (purpose) {
      parts.push(purpose);
    }

    // Field count
    parts.push(`\nIt contains ${fields.length} field${fields.length !== 1 ? 's' : ''}.`);

    // Important fields
    const importantFields = this.identifyImportantFields(fields);
    if (importantFields.length > 0) {
      parts.push('\n\n**Key fields:**');
      for (const field of importantFields.slice(0, 5)) {
        const desc = this.describeField(field);
        parts.push(`\n- \`${field.name}\` (${field.type}): ${desc}`);
      }
    }

    // Nested structures
    const nestedFields = fields.filter(f => f.name.includes('.'));
    if (nestedFields.length > 0) {
      parts.push(`\n\nContains nested structures with ${nestedFields.length} nested field${nestedFields.length !== 1 ? 's' : ''}.`);
    }

    parts.push('\n\n*Auto-generated description*');

    return parts.join('');
  }

  /**
   * Infer table purpose from name and columns
   */
  private inferTablePurpose(tableName: string, columns: any[]): string | null {
    const name = tableName.toLowerCase();
    const columnNames = columns.map(c => c.name.toLowerCase());

    // Transaction tables
    if (name.includes('order') || name.includes('purchase') || name.includes('transaction')) {
      return 'It tracks transactional data.';
    }

    // User/Entity tables
    if (name.includes('user') || name.includes('customer') || name.includes('account')) {
      return 'It stores user account information.';
    }

    // Product/Item tables
    if (name.includes('product') || name.includes('item') || name.includes('inventory')) {
      return 'It manages product or inventory data.';
    }

    // Log/History tables
    if (name.includes('log') || name.includes('history') || name.includes('audit')) {
      return 'It maintains audit or historical records.';
    }

    // Payment tables
    if (name.includes('payment') || name.includes('invoice')) {
      return 'It handles payment and billing information.';
    }

    // Check for common column patterns
    if (columnNames.includes('email') && columnNames.includes('password')) {
      return 'It stores user authentication data.';
    }

    if (columnNames.includes('amount') || columnNames.includes('price') || columnNames.includes('total')) {
      return 'It tracks financial data.';
    }

    return null;
  }

  /**
   * Infer collection purpose from name and fields
   */
  private inferCollectionPurpose(collectionName: string, fields: any[]): string | null {
    return this.inferTablePurpose(collectionName, fields);
  }

  /**
   * Identify important columns (non-PK, meaningful names)
   */
  private identifyImportantColumns(columns: any[], primaryKeys: any[]): any[] {
    const pkIds = new Set(primaryKeys.map(pk => pk.name));

    return columns
      .filter(col => !pkIds.has(col.name))
      .filter(col => {
        const name = col.name.toLowerCase();
        // Exclude audit columns
        return !['created_at', 'updated_at', 'deleted_at', 'created_by', 'updated_by'].includes(name);
      })
      .sort((a, b) => {
        // Sort by "importance" - non-null first, then alphabetically
        if (a.nullable !== b.nullable) {
          return a.nullable ? 1 : -1;
        }
        return a.name.localeCompare(b.name);
      });
  }

  /**
   * Identify important fields in a collection
   */
  private identifyImportantFields(fields: any[]): any[] {
    return fields
      .filter(field => field.name !== '_id') // Exclude _id
      .filter(field => !field.name.startsWith('__')) // Exclude internal fields
      .sort((a, b) => {
        // Sort by importance
        const aDepth = (a.name.match(/\./g) || []).length;
        const bDepth = (b.name.match(/\./g) || []).length;
        if (aDepth !== bDepth) {
          return aDepth - bDepth; // Prefer top-level fields
        }
        return a.name.localeCompare(b.name);
      });
  }

  /**
   * Describe a column based on its properties
   */
  private describeColumn(column: any): string {
    const name = column.name.toLowerCase();
    const type = column.dataType?.toLowerCase() || '';

    // Timestamps
    if (name.includes('created') || name.includes('timestamp') || type.includes('timestamp')) {
      return 'Timestamp field';
    }

    // IDs/References
    if (name.endsWith('_id') || column.isForeignKey) {
      return 'Reference to another entity';
    }

    // Booleans
    if (type.includes('bool') || name.startsWith('is_') || name.startsWith('has_')) {
      return 'Boolean flag';
    }

    // Emails
    if (name.includes('email')) {
      return 'Email address';
    }

    // Names
    if (name.includes('name') || name.includes('title')) {
      return 'Name or title';
    }

    // Descriptions
    if (name.includes('desc') || name.includes('note') || name.includes('comment')) {
      return 'Descriptive text';
    }

    // Amounts/Prices
    if (name.includes('amount') || name.includes('price') || name.includes('cost')) {
      return 'Monetary value';
    }

    // Status
    if (name.includes('status') || name.includes('state')) {
      return 'Status indicator';
    }

    return 'Data field';
  }

  /**
   * Describe a field based on its properties
   */
  private describeField(field: any): string {
    return this.describeColumn(field);
  }

  /**
   * Sanitize sensitive data values
   */
  private sanitizeValue(value: unknown, columnName: string): string {
    if (value === null || value === undefined) return 'NULL';
    
    const lowerName = columnName.toLowerCase();
    
    // Sanitize emails
    if (lowerName.includes('email') && typeof value === 'string' && value.includes('@')) {
      const [, domain] = value.split('@');
      return `***@${domain}`;
    }
    
    // Sanitize passwords/tokens
    if (lowerName.includes('password') || lowerName.includes('token') || lowerName.includes('secret')) {
      return '[REDACTED]';
    }
    
    // Sanitize SSN/credit cards
    if (lowerName.includes('ssn') || lowerName.includes('credit') || lowerName.includes('card')) {
      return '[REDACTED]';
    }
    
    // Sanitize names (partial)
    if ((lowerName.includes('first') || lowerName.includes('last') || lowerName.includes('full')) && lowerName.includes('name')) {
      if (typeof value === 'string' && value.length > 0) {
        return `${value[0]}***`;
      }
    }
    
    // Truncate long strings
    if (typeof value === 'string' && value.length > 100) {
      return `${value.substring(0, 100)}...`;
    }
    
    return String(value);
  }

  /**
   * Query sample data from source database
   */
  private async querySampleData(
    sourceId: string,
    schema: string | undefined,
    tableName: string,
    columns: Array<{ name: string; dataType: string }>,
    limit = 50
  ): Promise<Record<string, unknown>[]> {
    const { openSourcesDb, logger } = this.deps;
    const db = openSourcesDb();

    try {
      // Get source connection info
      const sourceRow = db.prepare('SELECT kind, config FROM sources WHERE id = ?')
        .get(sourceId) as { kind: string; config: string } | undefined;
      
      if (!sourceRow) {
        logger.warn('Source not found for sample data', { sourceId });
        return [];
      }

      const config = JSON.parse(sourceRow.config);
      const columnNames = columns.slice(0, 15).map(c => c.name); // Limit columns

      // Build query based on database type
      let query: string;
      if (sourceRow.kind === 'postgres' || sourceRow.kind === 'mysql') {
        const fullTableName = schema ? `${schema}.${tableName}` : tableName;
        const quotedColumns = columnNames.map(c => `"${c}"`).join(', ');
        query = `SELECT ${quotedColumns} FROM ${fullTableName} LIMIT ${limit}`;
      } else if (sourceRow.kind === 'mongo') {
        // MongoDB doesn't support SQL queries in this way
        logger.info('MongoDB sampling not yet supported');
        return [];
      } else {
        logger.info('Unsupported database type for sampling', { kind: sourceRow.kind });
        return [];
      }

      // Create adapter and query
      if (sourceRow.kind === 'postgres') {
        const { PostgresAdapter } = await import('@semantiqa/adapter-postgres');
        const adapter = new PostgresAdapter({ connection: config });
        const rows = await adapter.query(query);
        await adapter.close();
        return rows;
      } else if (sourceRow.kind === 'mysql') {
        const { MysqlAdapter } = await import('@semantiqa/adapter-mysql');
        const adapter = new MysqlAdapter({ connection: config });
        const rows = await adapter.query(query);
        await adapter.close();
        return rows as Record<string, unknown>[];
      }

      return [];
    } catch (error) {
      logger.warn('Failed to query sample data', { error: (error as Error).message, sourceId, tableName });
      return [];
    }
  }

  /**
   * Build AI prompt for table summary
   */
  private async buildTablePrompt(
    db: BetterSqliteDatabase,
    tableId: string,
    tableProps: any
  ): Promise<string> {
    const { name, schema, tableType, comment, sourceId } = tableProps;

    // Get columns with more detail
    const columnRows = db.prepare(`
      SELECT props
      FROM nodes
      WHERE type = 'column'
      AND json_extract(props, '$.tableId') = ?
      ORDER BY json_extract(props, '$.ordinalPosition')
      LIMIT 20
    `).all(tableId) as Array<{ props: string }>;

    const columns = columnRows.map(row => JSON.parse(row.props));

    // Identify key column types
    const primaryKeys = columns.filter(c => c.isPrimaryKey);
    const foreignKeys = columns.filter(c => c.isForeignKey);
    const timestamps = columns.filter(c => 
      c.name.includes('_at') || 
      c.name.includes('date') || 
      c.dataType?.toLowerCase().includes('timestamp')
    );
    const flags = columns.filter(c => 
      c.dataType?.toLowerCase().includes('bool') || 
      c.name.startsWith('is_') || 
      c.name.startsWith('has_')
    );

    // Build rich column descriptions
    const columnDesc = columns.slice(0, 12).map(c => {
      const parts = [`- \`${c.name}\` (${c.dataType})`];
      const attributes = [];
      
      if (c.isPrimaryKey) attributes.push('PRIMARY KEY');
      if (c.isForeignKey) attributes.push('FOREIGN KEY');
      if (!c.nullable) attributes.push('REQUIRED');
      
      if (attributes.length > 0) {
        parts.push(`[${attributes.join(', ')}]`);
      }
      
      // Add context based on name patterns
      if (c.name.includes('email')) parts.push('- Email address field');
      else if (c.name.includes('name') || c.name.includes('title')) parts.push('- Identifier/label');
      else if (c.name.includes('status') || c.name.includes('state')) parts.push('- Status indicator');
      else if (c.name.includes('count') || c.name.includes('total')) parts.push('- Numeric metric');
      else if (c.name.includes('_at') || c.name.includes('date')) parts.push('- Timestamp field');
      else if (c.name.startsWith('is_') || c.name.startsWith('has_')) parts.push('- Boolean flag');
      
      return parts.join(' ');
    }).join('\n');

    // Query sample data (async)
    const sampleRows = await this.querySampleData(
      sourceId,
      schema,
      name,
      columns,
      50
    );

    // Build sample data section
    let sampleDataSection = '';
    if (sampleRows.length > 0) {
      const sanitizedSamples = sampleRows.slice(0, 10).map(row => {
        const sanitized: Record<string, string> = {};
        for (const [key, value] of Object.entries(row)) {
          sanitized[key] = this.sanitizeValue(value, key);
        }
        return sanitized;
      });

      sampleDataSection = `
**Sample Data (${sampleRows.length} rows queried, showing first 10):**
\`\`\`json
${JSON.stringify(sanitizedSamples, null, 2)}
\`\`\`
`;
    }

    const prompt = `You are a data analyst writing documentation. Generate a rich, insightful description for this database table.

**Table:** ${schema ? `${schema}.` : ''}${name}
**Type:** ${tableType || 'TABLE'}
${comment ? `**Database Comment:** ${comment}\n` : ''}
**Total Columns:** ${columns.length}

**Schema Structure:**
${columnDesc}

**Additional Context:**
- Primary Keys: ${primaryKeys.map(c => c.name).join(', ') || 'None'}
- Foreign Keys: ${foreignKeys.length} relationship${foreignKeys.length !== 1 ? 's' : ''}
- Timestamp Fields: ${timestamps.map(c => c.name).join(', ') || 'None'}
- Boolean Flags: ${flags.map(c => c.name).join(', ') || 'None'}
${sampleDataSection}
Write a detailed description (3-4 paragraphs) covering:

1. **Business Purpose**: What real-world entity or process does this table represent? What problem does it solve? ${sampleRows.length > 0 ? 'Reference the actual data examples to infer the business domain.' : ''}

2. **Key Data Points**: Explain the most critical columns and what insights they provide. ${sampleRows.length > 0 ? 'Use the sample data to illustrate typical values and patterns.' : ''} Go beyond just listing - explain WHY these fields matter.

3. **Data Relationships**: How does this table connect to other parts of the system? What workflows or business processes does it support?

4. **Usage Patterns**: Based on the schema${sampleRows.length > 0 ? ' and actual data examples' : ''}, what typical queries or operations would users perform? What questions can this data answer?

Write naturally and conversationally. ${sampleRows.length > 0 ? 'Use concrete examples from the sample data to make your description specific and actionable.' : 'Use specific examples when the column names suggest clear use cases.'} Focus on VALUE and INSIGHTS, not just technical structure.`;

    return prompt;
  }

  /**
   * Build AI prompt for collection summary
   */
  private async buildCollectionPrompt(
    db: BetterSqliteDatabase,
    collectionId: string,
    collectionProps: any
  ): Promise<string> {
    const { name } = collectionProps;

    // Get fields
    const fieldRows = db.prepare(`
      SELECT props
      FROM nodes
      WHERE type = 'field'
      AND json_extract(props, '$.collectionId') = ?
      ORDER BY json_extract(props, '$.name')
      LIMIT 15
    `).all(collectionId) as Array<{ props: string }>;

    const fields = fieldRows.map(row => JSON.parse(row.props));

    // Build field descriptions
    const fieldDesc = fields.map(f => {
      const parts = [`- ${f.name} (${f.type})`];
      if (f.name.includes('.')) parts.push('[nested]');
      return parts.join(' ');
    }).join('\n');

    const prompt = `Generate a professional, concise description for this MongoDB collection.

**Collection:** ${name}
**Fields:** ${fields.length}

**Key Fields:**
${fieldDesc}

Write 2-3 short paragraphs describing:
1. What this collection stores (its business purpose)
2. The most important fields and what they represent
3. Notable characteristics (nested structures, array fields)

Use clear, professional language. Focus on what the data means to a business user, not just technical details.
Avoid speculation - only describe what you can infer from the structure.`;

    return prompt;
  }

  /**
   * Batch generate summaries for multiple nodes
   */
  async generateBatchSummaries(nodeIds: string[]): Promise<Map<string, GenerateSummaryResponse | SemantiqaError>> {
    const results = new Map<string, GenerateSummaryResponse | SemantiqaError>();

    for (const nodeId of nodeIds) {
      const result = await this.generateSummary({ nodeId });
      results.set(nodeId, result);
    }

    return results;
  }
}

