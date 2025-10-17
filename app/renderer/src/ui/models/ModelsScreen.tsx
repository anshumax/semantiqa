import { useState, useEffect } from 'react';
import type { ModelsListResponse, ModelManifestEntry } from '@semantiqa/contracts';
import { IPC_CHANNELS } from '@semantiqa/app-config';
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

  const handleDownload = async (modelId: string) => {
    try {
      const result = await window.semantiqa?.api.invoke(IPC_CHANNELS.MODELS_DOWNLOAD, { id: modelId });
      
      if (result && 'code' in result) {
        alert(`Download failed: ${result.message}`);
      } else {
        alert('Download started (placeholder)');
        // In a real implementation, this would show download progress
        await loadModels(); // Refresh the list
      }
    } catch (err) {
      alert(`Download failed: ${(err as Error).message}`);
    }
  };

  const handleToggleTask = async (modelId: string, task: string, currentTasks: string[]) => {
    try {
      const newTasks = currentTasks.includes(task)
        ? currentTasks.filter(t => t !== task)
        : [...currentTasks, task];

      if (newTasks.length === 0) {
        alert('At least one task must be enabled');
        return;
      }

      const result = await window.semantiqa?.api.invoke(IPC_CHANNELS.MODELS_ENABLE, {
        id: modelId,
        tasks: newTasks
      });
      
      if (result && 'code' in result) {
        alert(`Failed to update tasks: ${result.message}`);
      } else {
        await loadModels(); // Refresh the list
      }
    } catch (err) {
      alert(`Failed to update tasks: ${(err as Error).message}`);
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
                />
              ))}
            </div>
          </section>
        )}

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
                  onDownload={isInstalled ? undefined : () => handleDownload(model.id)}
                />
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

interface ModelCardProps {
  model: ModelManifestEntry | InstalledModel;
  installed: boolean;
  onDownload?: () => void;
  onToggleTask?: (modelId: string, task: string, currentTasks: string[]) => void;
}

function ModelCard({ model, installed, onDownload, onToggleTask }: ModelCardProps) {
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
      </div>
    </div>
  );
}