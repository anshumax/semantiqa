export interface CrawlWarning {
  level: 'info' | 'warning' | 'error';
  feature: string;
  message: string;
  suggestion?: string;
}

export interface AvailableFeatures {
  hasRowCounts: boolean;
  hasStatistics: boolean;
  hasComments: boolean;
  hasPermissionErrors: boolean;
}

export interface EnhancedCrawlResult<T> {
  data: T;
  warnings: CrawlWarning[];
  availableFeatures: AvailableFeatures;
}

