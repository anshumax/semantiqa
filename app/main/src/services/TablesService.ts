import type { Database as BetterSqliteDatabase } from 'better-sqlite3';
import type { SemantiqaError } from '@semantiqa/contracts';

export interface TablesServiceDeps {
  openSourcesDb: () => BetterSqliteDatabase;
}

export class TablesService {
  constructor(private readonly deps: TablesServiceDeps) {}

  async listTables(sourceId: string): Promise<{ tables: Array<{ id: string; name: string; type: string; sourceId: string; schema: string }> } | SemantiqaError> {
    try {
      const db = this.deps.openSourcesDb();
      
      // Query for table nodes that belong to this source
      // Since we now only crawl the selected database, no filtering is needed
      const tableRows = db.prepare(`
        SELECT id, props
        FROM nodes 
        WHERE type = 'table' 
        AND json_extract(props, '$.sourceId') = ?
        ORDER BY json_extract(props, '$.name')
      `).all(sourceId) as Array<{ id: string; props: string }>;

      const tables = tableRows.map(row => {
        const props = JSON.parse(row.props);
        return {
          id: row.id,
          name: props.name,
          type: props.tableType || 'table',
          sourceId: sourceId,
          schema: props.schema || 'public',
        };
      });

      return { tables };
    } catch (error) {
      return {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve tables',
        details: { error: (error as Error).message ?? 'Unknown error' },
      } satisfies SemantiqaError;
    }
  }
}
