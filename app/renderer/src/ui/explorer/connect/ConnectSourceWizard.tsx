import { useMemo, useState } from 'react';
import type { SourcesAddRequest } from '@semantiqa/contracts';
import { useExplorerState } from '../state/useExplorerState';
import { TextInput, Textarea, Button, Stack, Group, Text, Title, Paper, Card } from '@mantine/core';
import './ConnectSourceWizard.css';

type SourceKind = 'postgres' | 'mysql' | 'mongo' | 'duckdb';
type WizardStep = 'choose-kind' | 'configure' | 'review';

interface FormState {
  name: string;
  description: string;
  owners: string;
  tags: string;
  connection: Record<string, string>;
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

export function ConnectSourceWizard() {
  const { wizardStep, selectedKind, actions } = useExplorerState();
  const [formState, setFormState] = useState<FormState>(DEFAULT_STATE);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleKindSelect = (kind: SourceKind) => {
    actions.selectSourceKind(kind);
    handleNavigate('configure');
  };

  const handleNavigate = (step: WizardStep) => {
    actions.advanceWizardTo(step);
  };

  const handleBackToTypes = () => {
    setFormState(DEFAULT_STATE);
    actions.resetConnectWizard();
    handleNavigate('choose-kind');
  };

  const handleAdvanceToReview = () => {
    handleNavigate('review');
  };

  const handleReturnToConfigure = () => {
    if (selectedKind) {
      handleNavigate('configure');
    }
  };

  const handleBasicChange = (field: string, value: string) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

  const handleConnectionChange = (field: string, value: string, type?: string) => {
    const nextValue = type === 'number' ? Number(value) : value;
    setFormState((prev) => ({ ...prev, connection: { ...prev.connection, [field]: nextValue } }));
  };

  const ownersList = useMemo(
    () => formState.owners.split(',').map((item) => item.trim()).filter(Boolean),
    [formState.owners],
  );
  const tagsList = useMemo(
    () => formState.tags.split(',').map((item) => item.trim()).filter(Boolean),
    [formState.tags],
  );

  const handleSubmit = async () => {
    if (!selectedKind) {
      return;
    }

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

    setSubmitting(true);
    setError(null);

    const payload: SourcesAddRequest = {
      kind: selectedKind,
      name: trimmedName,
      description: formState.description || undefined,
      owners: ownersList,
      tags: tagsList,
      connection: formState.connection as SourcesAddRequest['connection'],
    };

    try {
      await window.semantiqa?.api.invoke('sources:add', payload);
      actions.resetConnectWizard();
      actions.closeConnectSource();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect source');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="connect-wizard" role="region" aria-live="polite">
      <ol className="connect-wizard__steps">
        {[
          { id: 'choose-kind', label: 'Choose type' },
          { id: 'configure', label: 'Configure' },
          { id: 'review', label: 'Review' },
        ].map((step) => (
          <li
            key={step.id}
            className={wizardStep === step.id ? 'connect-wizard__step connect-wizard__step--active' : 'connect-wizard__step'}
          >
            {step.label}
          </li>
        ))}
      </ol>

      {wizardStep === 'choose-kind' ? (
        <KindPicker onSelect={handleKindSelect} />
      ) : null}

      {wizardStep === 'configure' && selectedKind ? (
        <ConfigureForm
          kind={selectedKind}
          formState={formState}
          onBasicChange={handleBasicChange}
          onConnectionChange={handleConnectionChange}
          onBack={handleBackToTypes}
          onContinue={handleAdvanceToReview}
        />
      ) : null}

      {wizardStep === 'review' && selectedKind ? (
        <ReviewStep
          kind={selectedKind}
          payload={{
            name: formState.name,
            description: formState.description,
            owners: ownersList,
            tags: tagsList,
            connection: formState.connection,
          }}
          onBack={handleReturnToConfigure}
          onSubmit={handleSubmit}
          submitting={submitting}
          error={error}
        />
      ) : null}
    </div>
  );
}

function KindPicker({ onSelect }: { onSelect: (kind: SourceKind) => void }) {
  return (
    <div className="connect-wizard__panel">
      <h3>Select a source type</h3>
      <p>Choose the database or data store you want to connect.</p>
      <div className="connect-wizard__kind-grid">
        {(['postgres', 'mysql', 'mongo', 'duckdb'] as const).map((kind) => (
          <Button 
            key={kind} 
            variant="light" 
            size="lg"
            className="connect-wizard__kind" 
            onClick={() => onSelect(kind)}
            styles={{
              root: {
                height: 'auto',
                padding: '20px',
                flexDirection: 'column',
                alignItems: 'flex-start',
              },
            }}
          >
            <span className="connect-wizard__kind-name">{kind.toUpperCase()}</span>
            <span className="connect-wizard__kind-meta">Secure, read-only connection</span>
          </Button>
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
  onContinue,
}: {
  kind: SourceKind;
  formState: FormState;
  onBasicChange: (field: string, value: string) => void;
  onConnectionChange: (field: string, value: string, type?: string) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  const fields = FIELD_DEFINITIONS[kind];

  return (
    <div className="connect-wizard__panel">
      <header className="connect-wizard__panel-header">
        <div>
          <h3>Configure {kind.toUpperCase()} source</h3>
          <p>Fill in connection information. Secrets are stored securely.</p>
        </div>
        <Button variant="subtle" onClick={onBack}>
          Change type
        </Button>
      </header>

      <Stack gap="md">
        <Group grow>
          <TextInput
            label="Name"
            name="name"
            value={formState.name}
            onChange={(e) => onBasicChange('name', e.target.value)}
            required
          />
          <TextInput
            label="Owners (comma separated)"
            name="owners"
            value={formState.owners}
            onChange={(e) => onBasicChange('owners', e.target.value)}
          />
        </Group>
        
        <Textarea
          label="Description"
          name="description"
          rows={3}
          value={formState.description}
          onChange={(e) => onBasicChange('description', e.target.value)}
        />
        
        <TextInput
          label="Tags (comma separated)"
          name="tags"
          value={formState.tags}
          onChange={(e) => onBasicChange('tags', e.target.value)}
        />
      </Stack>

      <section className="connect-wizard__section">
        <h4>Connection</h4>
        <Stack gap="md">
          {fields.map((field) => (
            <TextInput
              key={field.key}
              label={field.label}
              name={field.key}
              type={field.type ?? 'text'}
              value={(formState.connection[field.key] as string) ?? ''}
              onChange={(e) => onConnectionChange(field.key, e.target.value, field.type)}
              required={!field.optional}
            />
          ))}
        </Stack>
      </section>

      <footer className="connect-wizard__actions">
        <Button onClick={onContinue}>
          Review details
        </Button>
      </footer>
    </div>
  );
}

function ReviewStep({
  kind,
  payload,
  onBack,
  onSubmit,
  submitting,
  error,
}: {
  kind: SourceKind;
  payload: { name: string; description: string; owners: string[]; tags: string[]; connection: Record<string, string> };
  onBack: () => void;
  onSubmit: () => void;
  submitting: boolean;
  error: string | null;
}) {
  return (
    <div className="connect-wizard__panel">
      <header className="connect-wizard__panel-header">
        <div>
          <h3>Review & connect</h3>
          <p>Confirm the details before connecting to {kind.toUpperCase()}.</p>
        </div>
        <Button variant="subtle" onClick={onBack}>
          Edit configuration
        </Button>
      </header>

      <div className="connect-wizard__summary">
        <dl>
          <div>
            <dt>Name</dt>
            <dd>{payload.name || '—'}</dd>
          </div>
          <div>
            <dt>Description</dt>
            <dd>{payload.description || '—'}</dd>
          </div>
          <div>
            <dt>Owners</dt>
            <dd>{payload.owners.length ? payload.owners.join(', ') : '—'}</dd>
          </div>
          <div>
            <dt>Tags</dt>
            <dd>{payload.tags.length ? payload.tags.join(', ') : '—'}</dd>
          </div>
        </dl>
        <section>
          <h4>Connection</h4>
          <dl>
            {Object.entries(payload.connection).map(([key, value]) => (
              <div key={key}>
                <dt>{key}</dt>
                <dd>{key.toLowerCase().includes('password') ? '••••••' : value || '—'}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>

      {error ? <Text c="red" size="sm">{error}</Text> : null}

      <footer className="connect-wizard__actions">
        <Button onClick={onSubmit} disabled={submitting} loading={submitting}>
          {submitting ? 'Connecting…' : 'Connect source'}
        </Button>
      </footer>
    </div>
  );
}

