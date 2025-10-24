/**
 * Types and interfaces for canvas navigation and drill-down functionality
 */

export type CanvasLevel = 'sources' | 'tables';

export interface CanvasBreadcrumb {
  level: CanvasLevel;
  label: string;
  path: string[];
}

export interface NavigationState {
  currentLevel: CanvasLevel;
  breadcrumbs: CanvasBreadcrumb[];
  sourceId?: string;
  sourceName?: string;
  sourceKind?: string;
  database?: string;
  schema?: string;
}

export interface DrillDownContext {
  sourceId: string;
  sourceName: string;
  sourceKind: 'postgres' | 'mysql' | 'mongo' | 'duckdb';
  database: string;
  schema?: string; // For relational databases
  tables: TableInfo[];
}

export interface TableInfo {
  id: string;
  name: string;
  type: 'table' | 'view' | 'collection';
  sourceId: string;
  rowCount?: number;
  schema?: string;
  description?: string;
}

export interface NavigationTransition {
  type: 'drill-down' | 'drill-up';
  fromLevel: CanvasLevel;
  toLevel: CanvasLevel;
  duration: number;
  easing: 'ease-in-out' | 'ease-in' | 'ease-out';
}

export interface CanvasNavigationEvent {
  type: 'navigate-to-tables' | 'navigate-to-sources';
  payload: {
    context?: DrillDownContext;
    animation?: NavigationTransition;
  };
}

export interface NavigationHistory {
  entries: NavigationState[];
  currentIndex: number;
}

// Navigation utility functions
export const createBreadcrumb = (level: CanvasLevel, label: string, path: string[] = []): CanvasBreadcrumb => ({
  level,
  label,
  path,
});

export const createSourcesBreadcrumb = (): CanvasBreadcrumb => 
  createBreadcrumb('sources', 'Canvas', []);

export const createTablesBreadcrumb = (sourceName: string, database?: string): CanvasBreadcrumb => {
  const label = database ? `${sourceName} • ${database}` : sourceName;
  return createBreadcrumb('tables', label, ['sources', sourceName]);
};

export const getDefaultNavigationState = (): NavigationState => ({
  currentLevel: 'sources',
  breadcrumbs: [createSourcesBreadcrumb()],
});

export const createDrillDownState = (context: DrillDownContext): NavigationState => ({
  currentLevel: 'tables',
  sourceId: context.sourceId,
  sourceName: context.sourceName,
  sourceKind: context.sourceKind,
  database: context.database,
  schema: context.schema,
  breadcrumbs: [
    createSourcesBreadcrumb(),
    createTablesBreadcrumb(context.sourceName, context.database),
  ],
});

export const createDefaultTransition = (type: NavigationTransition['type']): NavigationTransition => ({
  type,
  fromLevel: type === 'drill-down' ? 'sources' : 'tables',
  toLevel: type === 'drill-down' ? 'tables' : 'sources',
  duration: 300,
  easing: 'ease-in-out',
});