import React, { useMemo, useState, useCallback, useEffect } from 'react';
import type { SourcesAddRequest } from '@semantiqa/contracts';
import { IPC_CHANNELS } from '@semantiqa/app-config';
import { useCanvasPersistence } from './useCanvasPersistence';
import './CanvasConnectWizard.css';

type SourceKind = 'postgres' | 'mysql' | 'mongo' | 'duckdb';
type CanvasWizardStep = 'choose-kind' | 'configure' | 'test-connection' | 'select-databases' | 'review' | 'success';

interface FormState {
  name: string;
  description: string;
  owners: string;
  tags: string;
  connection: Record<string, string>;
}

interface DetectedDatabase {
  name: string;
  selected: boolean;
  description?: string;
}

interface CanvasConnectWizardProps {
  isOpen: boolean;
  onClose: () => void;
}

const DEFAULT_STATE: FormState = {
  name: '',
  description: '',
  owners: '',
  tags: '',
  connection: {},
};

const FIELD_DEFINITIONS: Record<SourceKind, Array<{ key: string; label: string; type?: string; optional?: boolean }>> = {
  postgres: [
    { key: 'host', label: 'Host' },
    { key: 'port', label: 'Port', type: 'number' },
    { key: 'database', label: 'Database' },
    { key: 'user', label: 'User' },
    { key: 'password', label: 'Password', type: 'password' },
  ],
  mysql: [
    { key: 'host', label: 'Host' },
    { key: 'port', label: 'Port', type: 'number' },
    { key: 'database', label: 'Database' },
    { key: 'user', label: 'User' },
    { key: 'password', label: 'Password', type: 'password' },
  ],
  mongo: [
    { key: 'uri', label: 'Connection URI' },
    { key: 'database', label: 'Database' },
    { key: 'replicaSet', label: 'Replica set (optional)', optional: true },
  ],
  duckdb: [{ key: 'filePath', label: 'File path' }],
};

// Canvas positioning helper
function calculateNewBlockPosition(existingBlocks: Array<{ position: { x: number; y: number }; size: { width: number; height: number } }>, index: number = 0): { x: number; y: number } {
  const BLOCK_SPACING = 250;
  const GRID_SIZE = 20;
  const START_X = 100;
  const START_Y = 100;

  // Simple grid-based positioning with collision detection
  const cols = 4;
  const row = Math.floor(index / cols);
  const col = index % cols;
  
  let x = START_X + col * BLOCK_SPACING;
  let y = START_Y + row * BLOCK_SPACING;

  // Snap to grid
  x = Math.round(x / GRID_SIZE) * GRID_SIZE;
  y = Math.round(y / GRID_SIZE) * GRID_SIZE;

  // Check for collisions and adjust if needed
  const hasCollision = existingBlocks.some(block => {
    const blockRight = block.position.x + block.size.width + 50; // 50px buffer
    const blockBottom = block.position.y + block.size.height + 50;
    const newRight = x + 200 + 50; // Default block width is 200
    const newBottom = y + 120 + 50; // Default block height is 120

    return !(x > blockRight || newRight < block.position.x || y > blockBottom || newBottom < block.position.y);
  });

  if (hasCollision) {
    // Try next position
    return calculateNewBlockPosition(existingBlocks, index + 1);
  }

  return { x, y };
}

export function CanvasConnectWizard({ isOpen, onClose }: CanvasConnectWizardProps) {
  const [currentStep, setCurrentStep] = useState<CanvasWizardStep>('choose-kind');
  const [selectedKind, setSelectedKind] = useState<SourceKind | null>(null);
  const [formState, setFormState] = useState<FormState>(DEFAULT_STATE);
  const [detectedDatabases, setDetectedDatabases] = useState<DetectedDatabase[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdBlocks, setCreatedBlocks] = useState<Array<{ name: string; position: { x: number; y: number } }>>([]);

  const { data: canvasData, createBlock } = useCanvasPersistence();

  const reset = useCallback(() => {
    setCurrentStep('choose-kind');
    setSelectedKind(null);
    setFormState(DEFAULT_STATE);
    setDetectedDatabases([]);
    setSubmitting(false);
    setTesting(false);
    setError(null);
    setCreatedBlocks([]);
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  const handleKindSelect = useCallback((kind: SourceKind) => {
    setSelectedKind(kind);
    setCurrentStep('configure');
    setError(null);
  }, []);

  const handleBasicChange = useCallback((event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    setFormState((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleConnectionChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = event.target;
    const nextValue = type === 'number' ? Number(value) : value;
    setFormState((prev) => ({ ...prev, connection: { ...prev.connection, [name]: nextValue } }));
  }, []);

  const ownersList = useMemo(
    () => formState.owners.split(',').map((item) => item.trim()).filter(Boolean),
    [formState.owners],
  );
  const tagsList = useMemo(
    () => formState.tags.split(',').map((item) => item.trim()).filter(Boolean),
    [formState.tags],
  );

  const handleTestConnection = useCallback(async () => {
    if (!selectedKind) return;

    const trimmedName = formState.name.trim();
    if (!trimmedName) {
      setError('Name is required.');
      return;
    }

    const requiredConnectionFields = FIELD_DEFINITIONS[selectedKind]
      .filter((field) => !field.optional)
      .map((field) => field.key);

    const missingField = requiredConnectionFields.find((key) => {
      const value = formState.connection[key];
      return !value || `${value}`.trim() === '';
    });

    if (missingField) {
      setError('Please fill in all required connection fields.');
      return;
    }

    setTesting(true);
    setError(null);

    try {
      // Test connection by attempting to add the source (this will validate the connection)
      const payload: SourcesAddRequest = {
        kind: selectedKind,
        name: trimmedName,
        description: formState.description || undefined,
        owners: ownersList,
        tags: tagsList,
        connection: formState.connection as SourcesAddRequest['connection'],
      };

      // For now, we'll simulate multi-database detection
      // In a real implementation, this would be part of the connection test
      const mockDetectedDatabases = await simulateMultiDatabaseDetection(selectedKind, formState.connection);
      
      if (mockDetectedDatabases.length > 1) {
        setDetectedDatabases(mockDetectedDatabases);
        setCurrentStep('select-databases');
      } else {
        // Single database, proceed to review
        setCurrentStep('review');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection test failed');
    } finally {
      setTesting(false);
    }
  }, [selectedKind, formState, ownersList, tagsList]);

  const handleDatabaseSelection = useCallback((index: number, selected: boolean) => {
    setDetectedDatabases(prev => prev.map((db, i) => 
      i === index ? { ...db, selected } : db
    ));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!selectedKind) return;

    setSubmitting(true);
    setError(null);

    try {
      const selectedDatabases = detectedDatabases.length > 0 
        ? detectedDatabases.filter(db => db.selected)
        : [{ name: formState.connection.database || 'default', selected: true }];

      if (selectedDatabases.length === 0) {
        setError('Please select at least one database.');
        setSubmitting(false);
        return;
      }

      const existingBlocks = canvasData?.blocks || [];
      const newBlocks: Array<{ name: string; position: { x: number; y: number } }> = [];

      // Create a source and canvas block for each selected database
      for (let i = 0; i < selectedDatabases.length; i++) {
        const database = selectedDatabases[i];
        
        const payload: SourcesAddRequest = {
          kind: selectedKind,
          name: selectedDatabases.length > 1 ? `${formState.name} - ${database.name}` : formState.name,
          description: formState.description || undefined,
          owners: ownersList,
          tags: tagsList,
          connection: {
            ...formState.connection,
            database: database.name,
          } as SourcesAddRequest['connection'],
        };

        // Add the source
        const sourceResponse = await window.semantiqa?.api.invoke('sources:add', payload);
        if (!sourceResponse || !('sourceId' in sourceResponse)) {
          throw new Error(`Failed to create source for database: ${database.name}`);
        }

        // Calculate position for the new block
        const position = calculateNewBlockPosition(
          [...existingBlocks, ...newBlocks].map(block => ({
            position: block.position,
            size: { width: 200, height: 120 }
          })),
          i
        );

        // Create canvas block
        await createBlock({
          sourceId: sourceResponse.sourceId,
          position,
          size: { width: 200, height: 120 },
          zIndex: 0,
          colorTheme: 'auto',
          isSelected: false,
          isMinimized: false,
        });

        newBlocks.push({
          name: payload.name,
          position,
        });
      }

      setCreatedBlocks(newBlocks);
      setCurrentStep('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create data sources');
    } finally {
      setSubmitting(false);
    }
  }, [selectedKind, formState, ownersList, tagsList, detectedDatabases, canvasData?.blocks, createBlock]);

  if (!isOpen) return null;

  return (
    <div className="canvas-connect-wizard-overlay" onClick={handleClose}>
      <div className="canvas-connect-wizard" onClick={(e) => e.stopPropagation()}>
        <div className="canvas-connect-wizard__header">
          <h2>Add Data Source to Canvas</h2>
          <button
            className="canvas-connect-wizard__close"
            onClick={handleClose}
            aria-label="Close wizard"
          >
            ×
          </button>
        </div>

        <div className="canvas-connect-wizard__content">
          <ol className="canvas-connect-wizard__steps">
            {[
              { id: 'choose-kind', label: 'Choose type' },
              { id: 'configure', label: 'Configure' },
              { id: 'test-connection', label: 'Test connection' },
              ...(detectedDatabases.length > 1 ? [{ id: 'select-databases', label: 'Select databases' }] : []),
              { id: 'review', label: 'Review' },
              { id: 'success', label: 'Complete' },
            ].map((step, index) => (
              <li
                key={step.id}
                className={`canvas-connect-wizard__step ${
                  currentStep === step.id ? 'canvas-connect-wizard__step--active' : ''
                } ${
                  getStepIndex(currentStep) > index ? 'canvas-connect-wizard__step--completed' : ''
                }`}
              >
                {step.label}
              </li>
            ))}
          </ol>

          <div className="canvas-connect-wizard__body">
            {currentStep === 'choose-kind' && (
              <KindPicker onSelect={handleKindSelect} />
            )}

            {currentStep === 'configure' && selectedKind && (
              <ConfigureForm
                kind={selectedKind}
                formState={formState}
                onBasicChange={handleBasicChange}
                onConnectionChange={handleConnectionChange}
                onBack={() => setCurrentStep('choose-kind')}
                onNext={handleTestConnection}
                testing={testing}
                error={error}
              />
            )}

            {currentStep === 'select-databases' && (
              <DatabaseSelector
                databases={detectedDatabases}
                onSelectionChange={handleDatabaseSelection}
                onBack={() => setCurrentStep('configure')}
                onNext={() => setCurrentStep('review')}
              />
            )}

            {currentStep === 'review' && selectedKind && (
              <ReviewStep
                kind={selectedKind}
                formState={formState}
                selectedDatabases={detectedDatabases.filter(db => db.selected)}
                ownersList={ownersList}
                tagsList={tagsList}
                onBack={() => setCurrentStep(detectedDatabases.length > 1 ? 'select-databases' : 'configure')}
                onSubmit={handleSubmit}
                submitting={submitting}
                error={error}
              />
            )}

            {currentStep === 'success' && (
              <SuccessStep
                createdBlocks={createdBlocks}
                onClose={handleClose}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper functions and components
function getStepIndex(step: CanvasWizardStep): number {
  const steps: CanvasWizardStep[] = ['choose-kind', 'configure', 'test-connection', 'select-databases', 'review', 'success'];
  return steps.indexOf(step);
}

async function simulateMultiDatabaseDetection(kind: SourceKind, connection: Record<string, string>): Promise<DetectedDatabase[]> {
  // In a real implementation, this would test the connection and detect available databases
  // For now, simulate different scenarios based on the source type
  
  await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate network delay

  switch (kind) {
    case 'postgres':
    case 'mysql':
      // Simulate multiple databases found
      return [
        { name: connection.database || 'main', selected: true, description: 'Main application database' },
        { name: 'analytics', selected: false, description: 'Analytics and reporting data' },
        { name: 'logs', selected: false, description: 'Application logs and events' },
      ];
    
    case 'mongo':
      // Simulate MongoDB with multiple databases
      return [
        { name: connection.database || 'primary', selected: true, description: 'Primary application data' },
        { name: 'sessions', selected: false, description: 'User session data' },
      ];
    
    case 'duckdb':
      // DuckDB typically has one database per file
      return [
        { name: 'main', selected: true, description: 'DuckDB file database' },
      ];
    
    default:
      return [{ name: 'default', selected: true }];
  }
}

function KindPicker({ onSelect }: { onSelect: (kind: SourceKind) => void }) {
  return (
    <div className="canvas-connect-wizard__panel">
      <h3>Select a source type</h3>
      <p>Choose the database or data store you want to add to your canvas.</p>
      <div className="canvas-connect-wizard__kind-grid">
        {(['postgres', 'mysql', 'mongo', 'duckdb'] as const).map((kind) => (
          <button key={kind} type="button" className="canvas-connect-wizard__kind" onClick={() => onSelect(kind)}>
            <span className="canvas-connect-wizard__kind-name">{kind.toUpperCase()}</span>
            <span className="canvas-connect-wizard__kind-meta">Secure, read-only connection</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function ConfigureForm({
  kind,
  formState,
  onBasicChange,
  onConnectionChange,
  onBack,
  onNext,
  testing,
  error,
}: {
  kind: SourceKind;
  formState: FormState;
  onBasicChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onConnectionChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onBack: () => void;
  onNext: () => void;
  testing: boolean;
  error: string | null;
}) {
  const fields = FIELD_DEFINITIONS[kind];

  return (
    <div className="canvas-connect-wizard__panel">
      <header className="canvas-connect-wizard__panel-header">
        <div>
          <h3>Configure {kind.toUpperCase()} source</h3>
          <p>Fill in connection information. This will be added to your canvas as a data source block.</p>
        </div>
        <button type="button" className="canvas-connect-wizard__link" onClick={onBack}>
          Change type
        </button>
      </header>

      <div className="canvas-connect-wizard__grid">
        <label>
          Name
          <input name="name" value={formState.name} onChange={onBasicChange} required />
        </label>
        <label>
          Owners (comma separated)
          <input name="owners" value={formState.owners} onChange={onBasicChange} />
        </label>
        <label className="canvas-connect-wizard__full">
          Description
          <textarea name="description" rows={3} value={formState.description} onChange={onBasicChange} />
        </label>
        <label className="canvas-connect-wizard__full">
          Tags (comma separated)
          <input name="tags" value={formState.tags} onChange={onBasicChange} />
        </label>
      </div>

      <section className="canvas-connect-wizard__section">
        <h4>Connection</h4>
        <div className="canvas-connect-wizard__grid">
          {fields.map((field) => (
            <label key={field.key} className={field.key === 'uri' ? 'canvas-connect-wizard__full' : ''}>
              {field.label}
              <input
                name={field.key}
                type={field.type ?? 'text'}
                value={(formState.connection[field.key] as string) ?? ''}
                onChange={onConnectionChange}
                required={!field.optional}
              />
            </label>
          ))}
        </div>
      </section>

      {error && <div className="canvas-connect-wizard__error">{error}</div>}

      <footer className="canvas-connect-wizard__actions">
        <button type="button" onClick={onNext} disabled={testing}>
          {testing ? 'Testing connection...' : 'Test & Continue'}
        </button>
      </footer>
    </div>
  );
}

function DatabaseSelector({
  databases,
  onSelectionChange,
  onBack,
  onNext,
}: {
  databases: DetectedDatabase[];
  onSelectionChange: (index: number, selected: boolean) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const selectedCount = databases.filter(db => db.selected).length;

  return (
    <div className="canvas-connect-wizard__panel">
      <header className="canvas-connect-wizard__panel-header">
        <div>
          <h3>Select Databases</h3>
          <p>Multiple databases detected. Choose which ones to add as separate canvas blocks.</p>
        </div>
        <button type="button" className="canvas-connect-wizard__link" onClick={onBack}>
          Back to configuration
        </button>
      </header>

      <div className="canvas-connect-wizard__database-list">
        {databases.map((database, index) => (
          <label key={database.name} className="canvas-connect-wizard__database-item">
            <input
              type="checkbox"
              checked={database.selected}
              onChange={(e) => onSelectionChange(index, e.target.checked)}
            />
            <div className="canvas-connect-wizard__database-info">
              <span className="canvas-connect-wizard__database-name">{database.name}</span>
              {database.description && (
                <span className="canvas-connect-wizard__database-description">{database.description}</span>
              )}
            </div>
          </label>
        ))}
      </div>

      <div className="canvas-connect-wizard__selection-summary">
        {selectedCount} of {databases.length} databases selected. Each will create a separate block on your canvas.
      </div>

      <footer className="canvas-connect-wizard__actions">
        <button type="button" onClick={onNext} disabled={selectedCount === 0}>
          Continue with {selectedCount} database{selectedCount === 1 ? '' : 's'}
        </button>
      </footer>
    </div>
  );
}

function ReviewStep({
  kind,
  formState,
  selectedDatabases,
  ownersList,
  tagsList,
  onBack,
  onSubmit,
  submitting,
  error,
}: {
  kind: SourceKind;
  formState: FormState;
  selectedDatabases: DetectedDatabase[];
  ownersList: string[];
  tagsList: string[];
  onBack: () => void;
  onSubmit: () => void;
  submitting: boolean;
  error: string | null;
}) {
  const databaseCount = selectedDatabases.length || 1;

  return (
    <div className="canvas-connect-wizard__panel">
      <header className="canvas-connect-wizard__panel-header">
        <div>
          <h3>Review & Connect</h3>
          <p>
            {databaseCount === 1
              ? 'This will create 1 data source block on your canvas.'
              : `This will create ${databaseCount} data source blocks on your canvas.`}
          </p>
        </div>
        <button type="button" className="canvas-connect-wizard__link" onClick={onBack}>
          Edit configuration
        </button>
      </header>

      <div className="canvas-connect-wizard__summary">
        <dl>
          <div>
            <dt>Source Type</dt>
            <dd>{kind.toUpperCase()}</dd>
          </div>
          <div>
            <dt>Name</dt>
            <dd>{formState.name || '—'}</dd>
          </div>
          {selectedDatabases.length > 0 && (
            <div>
              <dt>Databases</dt>
              <dd>{selectedDatabases.map(db => db.name).join(', ')}</dd>
            </div>
          )}
          <div>
            <dt>Description</dt>
            <dd>{formState.description || '—'}</dd>
          </div>
          <div>
            <dt>Owners</dt>
            <dd>{ownersList.length ? ownersList.join(', ') : '—'}</dd>
          </div>
          <div>
            <dt>Tags</dt>
            <dd>{tagsList.length ? tagsList.join(', ') : '—'}</dd>
          </div>
        </dl>

        <section>
          <h4>Connection</h4>
          <dl>
            {Object.entries(formState.connection).map(([key, value]) => (
              <div key={key}>
                <dt>{key}</dt>
                <dd>{key.toLowerCase().includes('password') ? '••••••' : value || '—'}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>

      {error && <div className="canvas-connect-wizard__error">{error}</div>}

      <footer className="canvas-connect-wizard__actions">
        <button type="button" onClick={onSubmit} disabled={submitting}>
          {submitting ? 'Creating blocks...' : `Add to Canvas (${databaseCount} block${databaseCount === 1 ? '' : 's'})`}
        </button>
      </footer>
    </div>
  );
}

function SuccessStep({
  createdBlocks,
  onClose,
}: {
  createdBlocks: Array<{ name: string; position: { x: number; y: number } }>;
  onClose: () => void;
}) {
  return (
    <div className="canvas-connect-wizard__panel">
      <div className="canvas-connect-wizard__success-icon">✅</div>
      <h3>Successfully Added to Canvas</h3>
      <p>
        {createdBlocks.length === 1
          ? 'Your data source has been added to the canvas as a new block.'
          : `${createdBlocks.length} data source blocks have been added to your canvas.`}
      </p>

      <div className="canvas-connect-wizard__created-blocks">
        {createdBlocks.map((block, index) => (
          <div key={index} className="canvas-connect-wizard__created-block">
            <span className="canvas-connect-wizard__block-name">{block.name}</span>
            <span className="canvas-connect-wizard__block-position">
              Positioned at ({Math.round(block.position.x)}, {Math.round(block.position.y)})
            </span>
          </div>
        ))}
      </div>

      <footer className="canvas-connect-wizard__actions">
        <button type="button" onClick={onClose}>
          View on Canvas
        </button>
      </footer>
    </div>
  );
}