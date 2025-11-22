import React, { useEffect, useState } from 'react';
import './HealthcheckModal.css';

interface HealthcheckModalProps {
  modelName: string;
  onCancel?: () => void;
}

export function HealthcheckModal({ modelName, onCancel }: HealthcheckModalProps) {
  const [elapsedMs, setElapsedMs] = useState(0);
  const startTimeRef = React.useRef(Date.now());

  useEffect(() => {
    startTimeRef.current = Date.now();
    
    const interval = setInterval(() => {
      setElapsedMs(Date.now() - startTimeRef.current);
    }, 100); // Update every 100ms for smooth UI

    return () => clearInterval(interval);
  }, []);

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const milliseconds = Math.floor((ms % 1000) / 100);
    return `${seconds}.${milliseconds}s`;
  };

  return (
    <div className="healthcheck-modal-backdrop" onClick={onCancel}>
      <div className="healthcheck-modal" onClick={(e) => e.stopPropagation()}>
        <div className="healthcheck-modal__header">
          <h3>Running Healthcheck</h3>
        </div>

        <div className="healthcheck-modal__content">
          <div className="healthcheck-modal__model-name">{modelName}</div>
          
          <div className="healthcheck-modal__spinner">
            <div className="spinner" />
          </div>

          <div className="healthcheck-modal__status">
            <p className="healthcheck-modal__message">
              Generating test prompt...
            </p>
            <p className="healthcheck-modal__elapsed">
              Elapsed: <span className="healthcheck-modal__time">{formatTime(elapsedMs)}</span>
            </p>
          </div>

          <div className="healthcheck-modal__info">
            <p>First generation may take longer as the model loads into memory.</p>
            <p>Large models on CPU can take 30-60 seconds.</p>
          </div>
        </div>

        {onCancel && (
          <div className="healthcheck-modal__actions">
            <button
              type="button"
              className="healthcheck-modal__cancel-btn"
              onClick={onCancel}
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

