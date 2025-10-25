import { useState, useEffect } from 'react';
import { InspectorHeader } from './InspectorHeader';
import { Tooltip } from '../../components/Tooltip';
import { IPC_CHANNELS } from '@semantiqa/app-config';
import './InspectorTablePanel.css';

interface TableDetails {
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

export interface InspectorTablePanelProps {
  sourceId: string;
  tableId: string;
  onClose: () => void;
}

export function InspectorTablePanel({ sourceId, tableId, onClose }: InspectorTablePanelProps) {
  const [details, setDetails] = useState<TableDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDetails = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const response = await window.semantiqa?.api.invoke(
          IPC_CHANNELS.TABLES_GET_DETAILS,
          { sourceId, tableId }
        );
        
        if ('code' in response) {
          setError(response.message || 'Failed to load table details');
          setDetails(null);
        } else {
          setDetails(response);
        }
      } catch (err) {
        console.error('Error fetching table details:', err);
        setError('Failed to load table details');
        setDetails(null);
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [sourceId, tableId]);

  const formatNumber = (num?: number) => {
    if (num === undefined || num === null) return '—';
    return num.toLocaleString();
  };

  const getTypeIcon = (type: string) => {
    if (type === 'view') return '👁️';
    if (type === 'collection') return '📦';
    return '📋';
  };

  if (loading) {
    return (
      <div className="inspector-table-panel">
        <InspectorHeader 
          icon="📋" 
          title="Loading..." 
          onClose={onClose}
        />
        <div className="inspector-table-panel__loading">
          <div className="spinner"></div>
          <p>Loading table details...</p>
        </div>
      </div>
    );
  }

  if (error || !details) {
    return (
      <div className="inspector-table-panel">
        <InspectorHeader 
          icon="⚠️" 
          title="Error" 
          onClose={onClose}
        />
        <div className="inspector-table-panel__error">
          <p>{error || 'Table not found'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="inspector-table-panel">
      <InspectorHeader
        icon={getTypeIcon(details.type)}
        title={details.name}
        subtitle={details.schema ? `${details.schema} · ${details.type}` : details.type}
        onClose={onClose}
      />

      <div className="inspector-table-panel__content">
        {/* Overview Section */}
        <section className="inspector-section">
          <h3 className="inspector-section__title">Overview</h3>
          <dl className="inspector-section__list">
            <div className="inspector-section__row">
              <dt>Rows</dt>
              <dd className="inspector-section__value--large">{formatNumber(details.rowCount)}</dd>
            </div>
            <div className="inspector-section__row">
              <dt>Columns</dt>
              <dd className="inspector-section__value--large">{details.columnCount}</dd>
            </div>
            {details.schema && (
              <div className="inspector-section__row">
                <dt>Schema</dt>
                <dd>{details.schema}</dd>
              </div>
            )}
            {details.description && (
              <div className="inspector-section__row">
                <dt>Description</dt>
                <dd>{details.description}</dd>
              </div>
            )}
          </dl>
        </section>

        {/* Columns Section */}
        <section className="inspector-section">
          <h3 className="inspector-section__title">Columns ({details.columns.length})</h3>
          <div className="inspector-table-panel__columns">
            {details.columns.map((column) => (
              <div key={column.name} className="column-item">
                <div className="column-item__header">
                  <span className="column-item__name">{column.name}</span>
                  <span className="column-item__type">{column.type}</span>
                </div>
                <div className="column-item__badges">
                  {column.isPrimaryKey && (
                    <span className="column-badge column-badge--pk">PK</span>
                  )}
                  {column.isForeignKey && (
                    <span className="column-badge column-badge--fk">FK</span>
                  )}
                  {!column.nullable && (
                    <span className="column-badge column-badge--required">Required</span>
                  )}
                </div>
                <div className="column-item__stats">
                  {column.nullPercent !== undefined && column.nullPercent !== null ? (
                    <span>{column.nullPercent.toFixed(1)}% null</span>
                  ) : (
                    <Tooltip content="Null percentage unavailable. Database user may need permissions to profile this column.">
                      <span className="unavailable-stat">
                        <span>Null: N/A</span>
                        <span className="info-icon">ⓘ</span>
                      </span>
                    </Tooltip>
                  )}
                  {column.distinctCount !== undefined && column.distinctCount !== null ? (
                    <span>{formatNumber(column.distinctCount)} distinct</span>
                  ) : (
                    <Tooltip content="Distinct count unavailable. Database user may need permissions to profile this column.">
                      <span className="unavailable-stat">
                        <span>Distinct: N/A</span>
                        <span className="info-icon">ⓘ</span>
                      </span>
                    </Tooltip>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Foreign Keys Section */}
        {details.foreignKeys && details.foreignKeys.length > 0 && (
          <section className="inspector-section">
            <h3 className="inspector-section__title">Foreign Keys ({details.foreignKeys.length})</h3>
            <div className="inspector-table-panel__fks">
              {details.foreignKeys.map((fk, idx) => (
                <div key={idx} className="fk-item">
                  <div className="fk-item__constraint">{fk.name}</div>
                  <div className="fk-item__mapping">
                    <span className="fk-item__column">{fk.column}</span>
                    <span className="fk-item__arrow">→</span>
                    <span className="fk-item__reference">
                      {fk.referencedTable}.{fk.referencedColumn}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Indexes Section */}
        {details.indexes && details.indexes.length > 0 && (
          <section className="inspector-section">
            <h3 className="inspector-section__title">Indexes ({details.indexes.length})</h3>
            <div className="inspector-table-panel__indexes">
              {details.indexes.map((index, idx) => (
                <div key={idx} className="index-item">
                  <div className="index-item__name">
                    {index.name}
                    {index.unique && (
                      <span className="index-item__badge">Unique</span>
                    )}
                  </div>
                  <div className="index-item__columns">
                    {index.columns.join(', ')}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

