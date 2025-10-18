import React, { useRef, useCallback } from 'react';
import './CanvasMiniMap.css';
import { CanvasViewport } from './types';

export interface CanvasMiniMapProps {
  viewport: CanvasViewport;
  contentBounds?: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
  onViewportChange: (newViewport: CanvasViewport) => void;
  className?: string;
  width?: number;
  height?: number;
}

export function CanvasMiniMap({
  viewport,
  contentBounds,
  onViewportChange,
  className = '',
  width = 120,
  height = 80
}: CanvasMiniMapProps) {
  const miniMapRef = useRef<HTMLDivElement>(null);

  // Calculate content bounds with defaults
  const bounds = contentBounds || {
    minX: -500,
    minY: -300,
    maxX: 500,
    maxY: 300
  };

  const contentWidth = bounds.maxX - bounds.minX;
  const contentHeight = bounds.maxY - bounds.minY;

  // Calculate scale to fit content in mini-map
  const scaleX = width / contentWidth;
  const scaleY = height / contentHeight;
  const scale = Math.min(scaleX, scaleY);

  // Calculate viewport indicator position and size
  const viewportWidth = Math.min((width / viewport.zoom) * scale, width);
  const viewportHeight = Math.min((height / viewport.zoom) * scale, height);
  
  const viewportX = ((viewport.centerX - bounds.minX) * scale) - (viewportWidth / 2);
  const viewportY = ((viewport.centerY - bounds.minY) * scale) - (viewportHeight / 2);

  // Constrain viewport indicator within mini-map bounds
  const constrainedX = Math.max(0, Math.min(width - viewportWidth, viewportX));
  const constrainedY = Math.max(0, Math.min(height - viewportHeight, viewportY));

  const handleClick = useCallback((e: React.MouseEvent) => {
    const rect = miniMapRef.current?.getBoundingClientRect();
    if (!rect) return;

    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Convert click position to world coordinates
    const worldX = bounds.minX + (clickX / scale);
    const worldY = bounds.minY + (clickY / scale);

    // Update viewport to center on clicked position
    onViewportChange({
      ...viewport,
      centerX: worldX,
      centerY: worldY
    });
  }, [bounds, scale, viewport, onViewportChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const step = 50;
    let newCenterX = viewport.centerX;
    let newCenterY = viewport.centerY;

    switch (e.key) {
      case 'ArrowLeft':
        newCenterX -= step;
        break;
      case 'ArrowRight':
        newCenterX += step;
        break;
      case 'ArrowUp':
        newCenterY -= step;
        break;
      case 'ArrowDown':
        newCenterY += step;
        break;
      default:
        return;
    }

    e.preventDefault();
    onViewportChange({
      ...viewport,
      centerX: newCenterX,
      centerY: newCenterY
    });
  }, [viewport, onViewportChange]);

  // Don't show mini-map if content bounds are not meaningful
  const shouldShowMiniMap = contentWidth > 0 && contentHeight > 0 && (contentWidth > 1000 || contentHeight > 600);

  if (!shouldShowMiniMap) {
    return null;
  }

  return (
    <div 
      ref={miniMapRef}
      className={`canvas-mini-map ${className}`}
      style={{ width: `${width}px`, height: `${height}px` }}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-label="Canvas mini-map - click to navigate"
      title="Click to navigate to a different area of the canvas"
    >
      {/* Mini-map background */}
      <div className="canvas-mini-map__background" />

      {/* Content area indicator */}
      <div 
        className="canvas-mini-map__content"
        style={{
          width: `${Math.max(contentWidth * scale, 1)}px`,
          height: `${Math.max(contentHeight * scale, 1)}px`,
          left: `${(bounds.minX < 0 ? Math.abs(bounds.minX) : 0) * scale}px`,
          top: `${(bounds.minY < 0 ? Math.abs(bounds.minY) : 0) * scale}px`
        }}
      />

      {/* Viewport indicator */}
      <div
        className="canvas-mini-map__viewport"
        style={{
          width: `${viewportWidth}px`,
          height: `${viewportHeight}px`,
          left: `${constrainedX}px`,
          top: `${constrainedY}px`
        }}
      />

      {/* Zoom level indicator */}
      <div className="canvas-mini-map__zoom">
        {Math.round(viewport.zoom * 100)}%
      </div>
    </div>
  );
}