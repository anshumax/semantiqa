import type { Database as BetterSqliteDatabase } from 'better-sqlite3';
import type { SemantiqaError } from '@semantiqa/contracts';

export interface TableDetailsServiceDeps {
  openSourcesDb: () => BetterSqliteDatabase;
}

export interface TableDetailsResponse {
  tableId: string;
  sourceId: string;
  name: string;
  type: string;
  schema?: string;
  rowCount: number;
  columnCount: number;
  description?: string;
  columns: Array<{
    name: string;
    type: string;
    nullable: boolean;
    isPrimaryKey: boolean;
    isForeignKey: boolean;
    nullPercent?: number;
    distinctCount?: number;
    sampleValues?: Array<string | number | boolean>;
  }>;
  indexes?: Array<{ name: string; columns: string[]; unique: boolean }>;
  foreignKeys?: Array<{ name: string; column: string; referencedTable: string; referencedColumn: string }>;
}

export class TableDetailsService {
  constructor(private readonly deps: TableDetailsServiceDeps) {}

  async getTableDetails(sourceId: string, tableId: string): Promise<TableDetailsResponse | SemantiqaError> {
    try {
      const db = this.deps.openSourcesDb();
      
      // Get table metadata
      const tableRow = db.prepare(`
        SELECT id, type, props
        FROM nodes 
        WHERE id = ?
        AND type IN ('table', 'collection')
        AND json_extract(props, '$.sourceId') = ?
      `).get(tableId, sourceId) as { id: string; type: string; props: string } | undefined;

      if (!tableRow) {
        return {
          code: 'NOT_FOUND',
          message: 'Table not found',
          details: { tableId, sourceId },
        } satisfies SemantiqaError;
      }

      const tableProps = JSON.parse(tableRow.props);

      // Get columns for this table
      const columnRows = db.prepare(`
        SELECT id, props
        FROM nodes 
        WHERE type IN ('column', 'field')
        AND json_extract(props, '$.tableId') = ?
        ORDER BY json_extract(props, '$.ordinalPosition'), json_extract(props, '$.name')
      `).all(tableId) as Array<{ id: string; props: string }>;

      const columns = columnRows.map(row => {
        const props = JSON.parse(row.props);
        return {
          name: props.name,
          type: props.dataType || props.type || 'unknown',
          nullable: props.nullable !== false, // Default to true if not specified
          isPrimaryKey: props.isPrimaryKey === true,
          isForeignKey: props.isForeignKey === true,
          nullPercent: props.nullPercent,
          distinctCount: props.distinctCount,
          sampleValues: props.sampleValues,
        };
      });

      // Get indexes (if stored)
      const indexRows = db.prepare(`
        SELECT props
        FROM nodes 
        WHERE type = 'index'
        AND json_extract(props, '$.tableId') = ?
      `).all(tableId) as Array<{ props: string }>;

      const indexes = indexRows.map(row => {
        const props = JSON.parse(row.props);
        return {
          name: props.name,
          columns: props.columns || [],
          unique: props.unique === true,
        };
      });

      // Get foreign keys (from edges)
      const fkRows = db.prepare(`
        SELECT src_id, dst_id, props
        FROM edges 
        WHERE type = 'FOREIGN_KEY'
        AND src_id IN (
          SELECT id FROM nodes 
          WHERE json_extract(props, '$.tableId') = ?
        )
      `).all(tableId) as Array<{ src_id: string; dst_id: string; props: string }>;

      const foreignKeys = await Promise.all(fkRows.map(async row => {
        const fkProps = JSON.parse(row.props || '{}');
        
        // Get source column name
        const srcCol = db.prepare(`
          SELECT json_extract(props, '$.name') as name
          FROM nodes WHERE id = ?
        `).get(row.src_id) as { name: string } | undefined;
        
        // Get target column and table
        const dstCol = db.prepare(`
          SELECT 
            json_extract(props, '$.name') as col_name,
            json_extract(props, '$.tableId') as table_id
          FROM nodes WHERE id = ?
        `).get(row.dst_id) as { col_name: string; table_id: string } | undefined;
        
        const refTable = dstCol ? db.prepare(`
          SELECT json_extract(props, '$.name') as name
          FROM nodes WHERE id = ?
        `).get(dstCol.table_id) as { name: string } | undefined : undefined;

        return {
          name: fkProps.constraintName || `fk_${srcCol?.name || 'unknown'}`,
          column: srcCol?.name || 'unknown',
          referencedTable: refTable?.name || 'unknown',
          referencedColumn: dstCol?.col_name || 'unknown',
        };
      }));

      return {
        tableId: tableRow.id,
        sourceId,
        name: tableProps.name,
        type: tableProps.tableType || tableRow.type,
        schema: tableProps.schema,
        rowCount: tableProps.rowCount || 0,
        columnCount: columns.length,
        description: tableProps.description,
        columns,
        indexes: indexes.length > 0 ? indexes : undefined,
        foreignKeys: foreignKeys.length > 0 ? foreignKeys : undefined,
      };
    } catch (error) {
      console.error('Error fetching table details:', error);
      return {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve table details',
        details: { error: (error as Error).message ?? 'Unknown error' },
      } satisfies SemantiqaError;
    }
  }
}

