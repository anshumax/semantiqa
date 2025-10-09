import { useMemo, useState } from 'react';
import type { SourcesAddRequest } from '@semantiqa/contracts';
import { useExplorerState } from '../state/useExplorerState';
import './ConnectSourceWizard.css';

type SourceKind = 'postgres' | 'mysql' | 'mongo' | 'duckdb';

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

const FIELD_DEFINITIONS: Record<SourceKind, Array<{ key: string; label: string; type?: string }>> = {
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
    { key: 'replicaSet', label: 'Replica set (optional)' },
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
  };

  const handleBasicChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    setFormState((prev) => ({ ...prev, [name]: value }));
  };

  const handleConnectionChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setFormState((prev) => ({ ...prev, connection: { ...prev.connection, [name]: value } }));
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

    setSubmitting(true);
    setError(null);

    const payload: SourcesAddRequest = {
      kind: selectedKind,
      name: formState.name,
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
    <div className="connect-wizard">
      {wizardStep === 'choose-kind' ? (
        <KindPicker onSelect={handleKindSelect} />
      ) : null}

      {wizardStep === 'configure' && selectedKind ? (
        <ConfigureForm
          kind={selectedKind}
          formState={formState}
          onBasicChange={handleBasicChange}
          onConnectionChange={handleConnectionChange}
          onBack={actions.resetConnectWizard}
          onContinue={actions.advanceToReview}
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
          onBack={() => actions.selectSourceKind(selectedKind)}
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
          <button key={kind} type="button" className="connect-wizard__kind" onClick={() => onSelect(kind)}>
            <span className="connect-wizard__kind-name">{kind.toUpperCase()}</span>
            <span className="connect-wizard__kind-meta">Secure, read-only connection</span>
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
  onContinue,
}: {
  kind: SourceKind;
  formState: FormState;
  onBasicChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onConnectionChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
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
        <button type="button" className="connect-wizard__link" onClick={onBack}>
          Change type
        </button>
      </header>

      <div className="connect-wizard__grid">
        <label>
          Name
          <input name="name" value={formState.name} onChange={onBasicChange} required />
        </label>
        <label>
          Owners (comma separated)
          <input name="owners" value={formState.owners} onChange={onBasicChange} />
        </label>
        <label className="connect-wizard__full">
          Description
          <textarea name="description" rows={3} value={formState.description} onChange={onBasicChange} />
        </label>
        <label className="connect-wizard__full">
          Tags (comma separated)
          <input name="tags" value={formState.tags} onChange={onBasicChange} />
        </label>
      </div>

      <section className="connect-wizard__section">
        <h4>Connection</h4>
        <div className="connect-wizard__grid">
          {fields.map((field) => (
            <label key={field.key} className={field.key === 'uri' ? 'connect-wizard__full' : ''}>
              {field.label}
              <input
                name={field.key}
                type={field.type ?? 'text'}
                value={(formState.connection[field.key] as string) ?? ''}
                onChange={onConnectionChange}
                required={field.key !== 'replicaSet'}
              />
            </label>
          ))}
        </div>
      </section>

      <footer className="connect-wizard__actions">
        <button type="button" onClick={onContinue}>
          Review details
        </button>
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
        <button type="button" className="connect-wizard__link" onClick={onBack}>
          Edit configuration
        </button>
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

      {error ? <div className="connect-wizard__error">{error}</div> : null}

      <footer className="connect-wizard__actions">
        <button type="button" onClick={onSubmit} disabled={submitting}>
          {submitting ? 'Connecting…' : 'Connect source'}
        </button>
      </footer>
    </div>
  );
}

