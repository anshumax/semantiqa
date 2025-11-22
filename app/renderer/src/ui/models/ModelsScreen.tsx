import { useState, useEffect } from 'react';
import type { ModelsHealthcheckResponse, ModelsListResponse, ModelManifestEntry } from '@semantiqa/contracts';
import { IPC_CHANNELS } from '@semantiqa/app-config';
import { notifications } from '@mantine/notifications';
import { DownloadProgressModal } from './DownloadProgressModal';
import { HealthcheckModal } from './HealthcheckModal';
import './ModelsScreen.css';

interface InstalledModel extends ModelManifestEntry {
  installedAt: string;
  enabledTasks: string[];
  path?: string;
}

export function ModelsScreen() {
  const [models, setModels] = useState<ModelsListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingModel, setDownloadingModel] = useState<{ id: string; name: string } | null>(null);
  const [healthcheckModel, setHealthcheckModel] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    loadModels();
  }, []);

  const loadModels = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await window.semantiqa?.api.invoke(IPC_CHANNELS.MODELS_LIST, undefined as never);
      
      if (result && 'code' in result) {
        setError(result.message || 'Failed to load models');
      } else {
        setModels(result as ModelsListResponse);
      }
    } catch (err) {
      setError((err as Error).message || 'Failed to load models');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (modelId: string, modelName: string) => {
    try {
      // Set downloading state to show modal
      setDownloadingModel({ id: modelId, name: modelName });
      
      const result = await window.semantiqa?.api.invoke(IPC_CHANNELS.MODELS_DOWNLOAD, { id: modelId });
      
      if (result && 'code' in result) {
        notifications.show({
          title: 'Download Failed',
          message: result.message,
          color: 'red',
        });
        setDownloadingModel(null);
      } else {
        // Modal will auto-close on completion
        // Refresh the list after a short delay
        setTimeout(async () => {
          await loadModels();
          setDownloadingModel(null);
        }, 1500);
      }
    } catch (err) {
      notifications.show({
        title: 'Download Failed',
        message: (err as Error).message,
        color: 'red',
      });
      setDownloadingModel(null);
    }
  };

  const handleToggleTask = async (modelId: string, task: string, currentTasks: string[]) => {
    try {
      const newTasks = currentTasks.includes(task)
        ? currentTasks.filter(t => t !== task)
        : [...currentTasks, task];

      if (newTasks.length === 0) {
        notifications.show({
          title: 'Validation Error',
          message: 'At least one task must be enabled',
          color: 'yellow',
        });
        return;
      }

      const result = await window.semantiqa?.api.invoke(IPC_CHANNELS.MODELS_ENABLE, {
        id: modelId,
        tasks: newTasks
      });
      
      if (result && 'code' in result) {
        notifications.show({
          title: 'Failed to Update Tasks',
          message: result.message,
          color: 'red',
        });
      } else {
        notifications.show({
          title: 'Tasks Updated',
          message: 'Model tasks updated successfully',
          color: 'green',
        });
        await loadModels(); // Refresh the list
      }
    } catch (err) {
      notifications.show({
        title: 'Failed to Update Tasks',
        message: (err as Error).message,
        color: 'red',
      });
    }
  };

  const handleHealthcheck = async (modelId: string, modelName: string) => {
    setHealthcheckModel({ id: modelId, name: modelName });
    
    try {
      const result = await window.semantiqa?.api.invoke(IPC_CHANNELS.MODELS_HEALTHCHECK, { id: modelId });
      setHealthcheckModel(null);
      
      if (result && 'code' in result) {
        notifications.show({
          title: 'Healthcheck Failed',
          message: result.message,
          color: 'red',
        });
        return;
      }
      const data = result as ModelsHealthcheckResponse;
      notifications.show({
        title: data.ok ? `Model ${modelName} is healthy` : `Model ${modelName} is unavailable`,
        message: (
          `Latency: ${data.latencyMs} ms\n` +
          `Tokens/sec: ${data.tokensPerSec || 'N/A'}\n` +
          (data.errors.length ? `Notes: ${data.errors.join(', ')}` : '')
        ),
        color: data.ok ? 'green' : 'yellow',
        autoClose: 5000,
      });
    } catch (err) {
      setHealthcheckModel(null);
      notifications.show({
        title: 'Healthcheck Failed',
        message: (err as Error).message,
        color: 'red',
      });
    }
  };

  if (loading) {
    return (
      <div className="models-screen">
        <div className="models-screen__loading">
          <p>Loading models...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="models-screen">
        <div className="models-screen__error">
          <p>Error: {error}</p>
          <button onClick={loadModels} type="button">
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!models) {
    return (
      <div className="models-screen">
        <p>No model data available</p>
      </div>
    );
  }

  return (
    <>
      <div className="models-screen">
        <header className="models-screen__header">
          <h1>Model Manager</h1>
          <p>Manage AI models for enhanced functionality. Models are optional and run locally on your device.</p>
        </header>

        <div className="models-screen__content">
          {models.installed.length > 0 && (
            <section className="models-section">
              <h2>Installed Models</h2>
              <div className="models-grid">
                {models.installed.map((model) => (
                  <ModelCard 
                    key={model.id}
                    model={model}
                    installed={true}
                    onToggleTask={handleToggleTask}
                    onHealthcheck={() => handleHealthcheck(model.id, model.name)}
                  />
                ))}
              </div>
            </section>
          )}

          {models.available.length > 0 && (
            <section className="models-section">
              <h2>Available Models</h2>
              <div className="models-grid">
                {models.available.map((model) => {
                  const isInstalled = models.installed.some(installed => installed.id === model.id);
                  return (
                    <ModelCard 
                      key={model.id}
                      model={model}
                      installed={isInstalled}
                      onDownload={isInstalled ? undefined : () => handleDownload(model.id, model.name)}
                      onHealthcheck={isInstalled ? () => handleHealthcheck(model.id, model.name) : undefined}
                    />
                  );
                })}
              </div>
            </section>
          )}
        </div>
      </div>

      {downloadingModel && (
        <DownloadProgressModal modelName={downloadingModel.name} />
      )}

      {healthcheckModel && (
        <HealthcheckModal 
          modelName={healthcheckModel.name}
          onCancel={() => setHealthcheckModel(null)}
        />
      )}
    </>
  );
}

interface ModelCardProps {
  model: ModelManifestEntry | InstalledModel;
  installed: boolean;
  onDownload?: () => void;
  onToggleTask?: (modelId: string, task: string, currentTasks: string[]) => void;
  onHealthcheck?: () => void;
}

function ModelCard({ model, installed, onDownload, onToggleTask, onHealthcheck }: ModelCardProps) {
  const installedModel = installed ? model as InstalledModel : null;

  return (
    <div className={`model-card ${installed ? 'model-card--installed' : ''}`}>
      <div className="model-card__header">
        <div className="model-card__info">
          <h3 className="model-card__name">{model.name}</h3>
          <div className="model-card__meta">
            <span className="model-card__kind">{model.kind.toUpperCase()}</span>
            <span className="model-card__size">{model.sizeMb} MB</span>
          </div>
        </div>
        {installed && (
          <div className="model-card__status">
            <span className="model-card__badge model-card__badge--installed">Installed</span>
          </div>
        )}
      </div>

      <div className="model-card__body">
        <p className="model-card__license">License: {model.license}</p>
        
        {model.description && (
          <p className="model-card__description">{model.description}</p>
        )}

        <div className="model-card__tasks">
          <h4>Available Tasks:</h4>
          <div className="model-card__task-list">
            {model.tasks.map((task) => (
              <div key={task} className="model-card__task">
                {installed && onToggleTask ? (
                  <label className="model-card__task-toggle">
                    <input
                      type="checkbox"
                      checked={installedModel?.enabledTasks?.includes(task) || false}
                      onChange={() => onToggleTask(model.id, task, installedModel?.enabledTasks || [])}
                    />
                    <span>{task}</span>
                  </label>
                ) : (
                  <span>{task}</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {installedModel?.installedAt && (
          <p className="model-card__installed-date">
            Installed: {new Date(installedModel.installedAt).toLocaleDateString()}
          </p>
        )}
      </div>

      <div className="model-card__actions">
        {!installed && onDownload && (
          <button 
            className="model-card__download-btn"
            onClick={onDownload}
            type="button"
          >
            Download
          </button>
        )}
        {installed && (
          <div className="model-card__enabled-tasks">
            <span>
              {installedModel?.enabledTasks?.length || 0} of {model.tasks.length} tasks enabled
            </span>
          </div>
        )}
        {installed && onHealthcheck && (
          <button
            className="model-card__healthcheck-btn"
            onClick={onHealthcheck}
            type="button"
          >
            Run Healthcheck
          </button>
        )}
      </div>
    </div>
  );
}