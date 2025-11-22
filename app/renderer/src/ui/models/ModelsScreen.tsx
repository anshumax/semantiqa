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
  isSelected?: boolean;
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

  const handleSelectModel = async (modelId: string, kind: 'generator' | 'embedding') => {
    try {
      const result = await window.semantiqa?.api.invoke(IPC_CHANNELS.MODELS_SELECT, { id: modelId, kind });
      
      if (result && 'code' in result) {
        notifications.show({
          title: 'Selection Failed',
          message: result.message,
          color: 'red',
        });
        return;
      }
      
      notifications.show({
        title: 'Model Selected',
        message: `${kind === 'generator' ? 'Generation' : 'Embedding'} model updated`,
        color: 'green',
      });
      
      // Reload models to reflect the change
      await loadModels();
      
    } catch (err) {
      notifications.show({
        title: 'Selection Failed',
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

  // Group models by kind
  const generatorModels = models.installed.filter(m => m.kind === 'generator');
  const embeddingModels = models.installed.filter(m => m.kind === 'embedding');
  
  const availableGenerators = models.available.filter(m => m.kind === 'generator');
  const availableEmbeddings = models.available.filter(m => m.kind === 'embedding');

  return (
    <>
      <div className="models-screen">
        <header className="models-screen__header">
          <h1>Model Manager</h1>
          <p>Manage AI models for enhanced functionality. Models are optional and run locally on your device.</p>
        </header>

        <div className="models-screen__content">
          {/* Generation Models Section */}
          {generatorModels.length > 0 && (
            <section className="models-section">
              <h2>Generation Models</h2>
              <p className="models-section__subtitle">
                For SQL generation and text summarization
              </p>
              <div className="models-grid">
                {generatorModels.map((model) => (
                  <ModelCard 
                    key={model.id}
                    model={model}
                    installed={true}
                    isSelected={model.isSelected}
                    onSelect={() => handleSelectModel(model.id, model.kind as 'generator')}
                    onToggleTask={handleToggleTask}
                    onHealthcheck={() => handleHealthcheck(model.id, model.name)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Embedding Models Section */}
          {embeddingModels.length > 0 && (
            <section className="models-section">
              <h2>Embedding Models</h2>
              <p className="models-section__subtitle">
                For semantic search and vector similarity
              </p>
              <div className="models-grid">
                {embeddingModels.map((model) => (
                  <ModelCard 
                    key={model.id}
                    model={model}
                    installed={true}
                    isSelected={model.isSelected}
                    onSelect={() => handleSelectModel(model.id, model.kind as 'embedding')}
                    onToggleTask={handleToggleTask}
                    onHealthcheck={() => handleHealthcheck(model.id, model.name)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Available Models */}
          {(availableGenerators.length > 0 || availableEmbeddings.length > 0) && (
            <>
              {availableGenerators.length > 0 && (
                <section className="models-section">
                  <h2>Available Generation Models</h2>
                  <div className="models-grid">
                    {availableGenerators.map((model) => (
                      <ModelCard 
                        key={model.id}
                        model={model}
                        installed={false}
                        onDownload={() => handleDownload(model.id, model.name)}
                      />
                    ))}
                  </div>
                </section>
              )}
              
              {availableEmbeddings.length > 0 && (
                <section className="models-section">
                  <h2>Available Embedding Models</h2>
                  <div className="models-grid">
                    {availableEmbeddings.map((model) => (
                      <ModelCard 
                        key={model.id}
                        model={model}
                        installed={false}
                        onDownload={() => handleDownload(model.id, model.name)}
                      />
                    ))}
                  </div>
                </section>
              )}
            </>
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
  isSelected?: boolean;
  onDownload?: () => void;
  onSelect?: () => void;
  onToggleTask?: (modelId: string, task: string, currentTasks: string[]) => void;
  onHealthcheck?: () => void;
}

function ModelCard({ model, installed, isSelected, onDownload, onSelect, onToggleTask, onHealthcheck }: ModelCardProps) {
  const installedModel = installed ? model as InstalledModel : null;
  
  return (
    <div className={`model-card ${installed ? 'model-card--installed' : ''} ${isSelected ? 'model-card--selected' : ''}`}>
      <div className="model-card__header">
        <div className="model-card__info">
          <div className="model-card__title-row">
            <h3 className="model-card__name">{model.name}</h3>
            {isSelected && (
              <span className="model-card__badge model-card__badge--active">Active</span>
            )}
          </div>
          <div className="model-card__meta">
            <span className="model-card__kind">{model.kind.toUpperCase()}</span>
            <span className="model-card__size">{model.sizeMb} MB</span>
          </div>
        </div>
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
          <>
            <div className="model-card__enabled-tasks">
              <span>
                {installedModel?.enabledTasks?.length || 0} of {model.tasks.length} tasks enabled
              </span>
            </div>
            {onHealthcheck && (
              <button
                className="model-card__healthcheck-btn"
                onClick={onHealthcheck}
                type="button"
              >
                Run Healthcheck
              </button>
            )}
            {!isSelected && onSelect && (
              <button
                className="model-card__select-btn"
                onClick={onSelect}
                type="button"
              >
                ✓ Use This Model
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}