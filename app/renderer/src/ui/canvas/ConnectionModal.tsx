import React, { useState, useEffect, useMemo } from 'react';
import './ConnectionModal.css';
import { IPC_CHANNELS } from '@semantiqa/app-config';
import type { GraphGetRequest, GraphGetResponse, GraphNode } from '@semantiqa/contracts';

interface TableInfo {
  id: string;
  name: string;
  columns: ColumnInfo[];
}

interface ColumnInfo {
  id: string;
  name: string;
  type: string;
}

interface RelationshipDefinition {
  sourceTable: string;
  sourceColumn: string;
  targetTable: string;
  targetColumn: string;
}

export interface ConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceBlock?: {
    id: string;
    name: string;
    kind: string;
  };
  targetBlock?: {
    id: string;
    name: string;
    kind: string;
  };
  onSaveRelationship?: (relationship: RelationshipDefinition) => void;
}

export function ConnectionModal({ 
  isOpen, 
  onClose, 
  sourceBlock, 
  targetBlock,
  onSaveRelationship
}: ConnectionModalProps) {
  const [sourceTables, setSourceTables] = useState<TableInfo[]>([]);
  const [targetTables, setTargetTables] = useState<TableInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSourceTable, setSelectedSourceTable] = useState<string>('');
  const [selectedTargetTable, setSelectedTargetTable] = useState<string>('');
  const [selectedSourceColumn, setSelectedSourceColumn] = useState<string>('');
  const [selectedTargetColumn, setSelectedTargetColumn] = useState<string>('');

  // Load tables and columns when modal opens or blocks change
  useEffect(() => {
    if (isOpen && sourceBlock && targetBlock) {
      loadTablesAndColumns();
    }
  }, [isOpen, sourceBlock, targetBlock]);

  const loadTablesAndColumns = async () => {
    if (!sourceBlock || !targetBlock) return;
    
    setLoading(true);
    try {
      // Load source tables
      const sourceRequest: GraphGetRequest = { 
        filter: { 
          scope: 'schema',
          sourceIds: [sourceBlock.id]
        } 
      };
      const sourceResponse = await window.semantiqa?.api.invoke(IPC_CHANNELS.GRAPH_GET, sourceRequest) as GraphGetResponse;
      
      // Load target tables  
      const targetRequest: GraphGetRequest = { 
        filter: { 
          scope: 'schema',
          sourceIds: [targetBlock.id]
        } 
      };
      const targetResponse = await window.semantiqa?.api.invoke(IPC_CHANNELS.GRAPH_GET, targetRequest) as GraphGetResponse;
      
      // Process source tables and columns
      const sourceTables = extractTablesAndColumns(sourceResponse.nodes, sourceResponse.edges || []);
      const targetTables = extractTablesAndColumns(targetResponse.nodes, targetResponse.edges || []);
      
      setSourceTables(sourceTables);
      setTargetTables(targetTables);
    } catch (error) {
      console.error('Failed to load tables and columns:', error);
    } finally {
      setLoading(false);
    }
  };

  // Extract tables and their columns from graph data
  const extractTablesAndColumns = (nodes: GraphNode[], edges: any[]): TableInfo[] => {
    const tables = nodes.filter(node => node.type === 'table' || node.type === 'collection');
    const columns = nodes.filter(node => node.type === 'column' || node.type === 'field');
    
    // Build parent-child relationships
    const childToParent = new Map<string, string>();
    edges
      .filter(edge => edge.type === 'HAS_COLUMN' || edge.type === 'HAS_FIELD')
      .forEach(edge => {
        childToParent.set(edge.dstId || edge.dst_id, edge.srcId || edge.src_id);
      });
    
    return tables.map(table => ({
      id: table.id,
      name: table.props.displayName,
      columns: columns
        .filter(col => childToParent.get(col.id) === table.id)
        .map(col => ({
          id: col.id,
          name: col.props.displayName,
          type: (col.props as any).dataType || 'unknown'
        }))
    }));
  };

  // Get columns for selected table
  const sourceColumns = useMemo(() => {
    const table = sourceTables.find(t => t.id === selectedSourceTable);
    return table?.columns || [];
  }, [sourceTables, selectedSourceTable]);

  const targetColumns = useMemo(() => {
    const table = targetTables.find(t => t.id === selectedTargetTable);
    return table?.columns || [];
  }, [targetTables, selectedTargetTable]);

  // Reset column selections when table changes
  useEffect(() => {
    setSelectedSourceColumn('');
  }, [selectedSourceTable]);

  useEffect(() => {
    setSelectedTargetColumn('');
  }, [selectedTargetTable]);

  // Validate if relationship can be saved
  const canSave = selectedSourceTable && selectedTargetTable && 
                  selectedSourceColumn && selectedTargetColumn;
  
  // Get validation warnings
  const validationWarning = useMemo(() => {
    if (!canSave) return null;
    
    const sourceColumn = sourceColumns.find(c => c.id === selectedSourceColumn);
    const targetColumn = targetColumns.find(c => c.id === selectedTargetColumn);
    
    if (!sourceColumn || !targetColumn) return null;
    
    // Check for type compatibility
    const sourceType = sourceColumn.type.toLowerCase();
    const targetType = targetColumn.type.toLowerCase();
    
    // Simple type compatibility check (can be enhanced later)
    const numericTypes = ['int', 'integer', 'bigint', 'smallint', 'decimal', 'numeric', 'float', 'double', 'real', 'number'];
    const textTypes = ['varchar', 'text', 'char', 'string', 'nvarchar', 'ntext'];
    const dateTypes = ['date', 'datetime', 'timestamp', 'time'];
    
    const isSourceNumeric = numericTypes.some(type => sourceType.includes(type));
    const isTargetNumeric = numericTypes.some(type => targetType.includes(type));
    const isSourceText = textTypes.some(type => sourceType.includes(type));
    const isTargetText = textTypes.some(type => targetType.includes(type));
    const isSourceDate = dateTypes.some(type => sourceType.includes(type));
    const isTargetDate = dateTypes.some(type => targetType.includes(type));
    
    if (sourceType !== targetType) {
      if ((isSourceNumeric && isTargetText) || (isSourceText && isTargetNumeric)) {
        return {
          type: 'warning' as const,
          message: `Type mismatch: ${sourceType} → ${targetType}. This relationship may require data conversion.`
        };
      }
      
      if ((isSourceDate && !isTargetDate) || (!isSourceDate && isTargetDate)) {
        return {
          type: 'warning' as const,
          message: `Date/time type mismatch: ${sourceType} → ${targetType}. Verify compatibility.`
        };
      }
      
      // Different but potentially compatible types
      return {
        type: 'info' as const,
        message: `Different column types: ${sourceType} → ${targetType}. Verify this relationship makes sense.`
      };
    }
    
    return null;
  }, [canSave, sourceColumns, selectedSourceColumn, targetColumns, selectedTargetColumn]);

  const handleSave = () => {
    if (canSave && onSaveRelationship) {
      onSaveRelationship({
        sourceTable: selectedSourceTable,
        sourceColumn: selectedSourceColumn,
        targetTable: selectedTargetTable,
        targetColumn: selectedTargetColumn
      });
    }
    onClose();
  };

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedSourceTable('');
      setSelectedTargetTable('');
      setSelectedSourceColumn('');
      setSelectedTargetColumn('');
      setSourceTables([]);
      setTargetTables([]);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="connection-modal-overlay" onClick={onClose}>
      <div className="connection-modal" onClick={(e) => e.stopPropagation()}>
        <div className="connection-modal__header">
          <h2>Define Relationship</h2>
          <button 
            className="connection-modal__close"
            onClick={onClose}
            aria-label="Close modal"
          >
            ×
          </button>
        </div>
        
        <div className="connection-modal__body">
          {sourceBlock && targetBlock && (
            <div className="connection-info">
              <div className="connection-endpoint">
                <div className="connection-endpoint__label">Source</div>
                <div className="connection-endpoint__name">{sourceBlock.name}</div>
                <div className="connection-endpoint__type">{sourceBlock.kind.toUpperCase()}</div>
              </div>
              
              <div className="connection-arrow">→</div>
              
              <div className="connection-endpoint">
                <div className="connection-endpoint__label">Target</div>
                <div className="connection-endpoint__name">{targetBlock.name}</div>
                <div className="connection-endpoint__type">{targetBlock.kind.toUpperCase()}</div>
              </div>
            </div>
          )}
          
          {loading ? (
            <div className="connection-loading">
              <div className="connection-loading__spinner"></div>
              <p>Loading tables and columns...</p>
            </div>
          ) : (
            <div className="relationship-definition">
              <div className="relationship-columns">
                <div className="relationship-column">
                  <h4>Source Table & Column</h4>
                  
                  <div className="form-group">
                    <label htmlFor="source-table">Table/Collection</label>
                    <select 
                      id="source-table"
                      value={selectedSourceTable}
                      onChange={(e) => setSelectedSourceTable(e.target.value)}
                      className="form-select"
                    >
                      <option value="">Select table...</option>
                      {sourceTables.map(table => (
                        <option key={table.id} value={table.id}>{table.name}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="source-column">Column/Field</label>
                    <select 
                      id="source-column"
                      value={selectedSourceColumn}
                      onChange={(e) => setSelectedSourceColumn(e.target.value)}
                      className="form-select"
                      disabled={!selectedSourceTable}
                    >
                      <option value="">Select column...</option>
                      {sourceColumns.map(column => (
                        <option key={column.id} value={column.id}>
                          {column.name} ({column.type})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                
                <div className="relationship-column">
                  <h4>Target Table & Column</h4>
                  
                  <div className="form-group">
                    <label htmlFor="target-table">Table/Collection</label>
                    <select 
                      id="target-table"
                      value={selectedTargetTable}
                      onChange={(e) => setSelectedTargetTable(e.target.value)}
                      className="form-select"
                    >
                      <option value="">Select table...</option>
                      {targetTables.map(table => (
                        <option key={table.id} value={table.id}>{table.name}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="target-column">Column/Field</label>
                    <select 
                      id="target-column"
                      value={selectedTargetColumn}
                      onChange={(e) => setSelectedTargetColumn(e.target.value)}
                      className="form-select"
                      disabled={!selectedTargetTable}
                    >
                      <option value="">Select column...</option>
                      {targetColumns.map(column => (
                        <option key={column.id} value={column.id}>
                          {column.name} ({column.type})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              
              {canSave && (
                <>
                  <div className="relationship-preview">
                    <div className="relationship-preview__label">Relationship Preview:</div>
                    <div className="relationship-preview__text">
                      <strong>{sourceTables.find(t => t.id === selectedSourceTable)?.name}</strong>.
                      <em>{sourceColumns.find(c => c.id === selectedSourceColumn)?.name}</em>
                      {' → '}
                      <strong>{targetTables.find(t => t.id === selectedTargetTable)?.name}</strong>.
                      <em>{targetColumns.find(c => c.id === selectedTargetColumn)?.name}</em>
                    </div>
                  </div>
                  
                  {validationWarning && (
                    <div className={`validation-warning validation-warning--${validationWarning.type}`}>
                      <div className="validation-warning__icon">
                        {validationWarning.type === 'warning' ? '⚠️' : 'ℹ️'}
                      </div>
                      <div className="validation-warning__message">
                        {validationWarning.message}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
        
        <div className="connection-modal__footer">
          <button 
            className="connection-modal__button connection-modal__button--secondary"
            onClick={onClose}
          >
            Cancel
          </button>
          <button 
            className="connection-modal__button connection-modal__button--primary"
            onClick={handleSave}
            disabled={!canSave || loading}
          >
            Create Relationship
          </button>
        </div>
      </div>
    </div>
  );
}
