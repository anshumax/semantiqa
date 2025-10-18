import React from 'react';
import './ZoomControls.css';

export interface ZoomControlsProps {
  zoom: number;
  minZoom?: number;
  maxZoom?: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  className?: string;
}

export function ZoomControls({
  zoom,
  minZoom = 0.1,
  maxZoom = 3.0,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  className = ''
}: ZoomControlsProps) {
  const zoomPercentage = Math.round(zoom * 100);
  const canZoomIn = zoom < maxZoom;
  const canZoomOut = zoom > minZoom;

  const handleZoomIn = () => {
    if (canZoomIn) {
      onZoomIn();
    }
  };

  const handleZoomOut = () => {
    if (canZoomOut) {
      onZoomOut();
    }
  };

  const handleZoomReset = () => {
    onZoomReset();
  };

  const handleKeyDown = (e: React.KeyboardEvent, action: () => void) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      action();
    }
  };

  return (
    <div className={`zoom-controls ${className}`}>
      {/* Zoom level display */}
      <div className="zoom-controls__level" title={`Current zoom: ${zoomPercentage}%`}>
        {zoomPercentage}%
      </div>

      {/* Control buttons */}
      <div className="zoom-controls__buttons">
        {/* Zoom Out */}
        <button
          className={`zoom-controls__button zoom-controls__button--out ${!canZoomOut ? 'zoom-controls__button--disabled' : ''}`}
          onClick={handleZoomOut}
          onKeyDown={(e) => handleKeyDown(e, handleZoomOut)}
          disabled={!canZoomOut}
          title={`Zoom out (${Math.round(minZoom * 100)}% min)`}
          aria-label="Zoom out"
        >
          <span className="zoom-controls__icon">−</span>
        </button>

        {/* Reset Zoom */}
        <button
          className="zoom-controls__button zoom-controls__button--reset"
          onClick={handleZoomReset}
          onKeyDown={(e) => handleKeyDown(e, handleZoomReset)}
          title="Reset zoom to 100% (0)"
          aria-label="Reset zoom to 100%"
        >
          <span className="zoom-controls__icon">⌂</span>
        </button>

        {/* Zoom In */}
        <button
          className={`zoom-controls__button zoom-controls__button--in ${!canZoomIn ? 'zoom-controls__button--disabled' : ''}`}
          onClick={handleZoomIn}
          onKeyDown={(e) => handleKeyDown(e, handleZoomIn)}
          disabled={!canZoomIn}
          title={`Zoom in (${Math.round(maxZoom * 100)}% max)`}
          aria-label="Zoom in"
        >
          <span className="zoom-controls__icon">+</span>
        </button>
      </div>

      {/* Zoom range indicator */}
      <div className="zoom-controls__range">
        <div 
          className="zoom-controls__range-fill"
          style={{
            width: `${((zoom - minZoom) / (maxZoom - minZoom)) * 100}%`
          }}
        />
      </div>
    </div>
  );
}