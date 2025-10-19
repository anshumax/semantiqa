import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { CanvasViewport } from './types';
import './Canvas.css';

export interface CanvasProps {
  children?: React.ReactNode;
  viewport: CanvasViewport;
  onViewportChange: (viewport: CanvasViewport) => void;
  gridSize?: number;
  minZoom?: number;
  maxZoom?: number;
  className?: string;
}

export function Canvas({ 
  children, 
  viewport, 
  onViewportChange, 
  gridSize = 20,
  minZoom = 0.1, 
  maxZoom = 3.0,
  className = ''
}: CanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [lastPanPoint, setLastPanPoint] = useState({ x: 0, y: 0 });

  // Calculate transform for canvas content
  const contentTransform = useMemo(() => {
    return `translate(${viewport.centerX}px, ${viewport.centerY}px) scale(${viewport.zoom})`;
  }, [viewport.centerX, viewport.centerY, viewport.zoom]);

  // Handle mouse wheel zoom
  const handleWheel = useCallback((event: React.WheelEvent) => {
    event.preventDefault();
    
    if (!canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = event.clientX - rect.left - rect.width / 2;
    const mouseY = event.clientY - rect.top - rect.height / 2;

    // Calculate zoom delta
    const zoomDelta = event.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.min(maxZoom, Math.max(minZoom, viewport.zoom * zoomDelta));
    
    if (newZoom === viewport.zoom) return;

    // Zoom towards mouse position
    const zoomRatio = newZoom / viewport.zoom;
    const newCenterX = viewport.centerX - (mouseX - viewport.centerX) * (zoomRatio - 1);
    const newCenterY = viewport.centerY - (mouseY - viewport.centerY) * (zoomRatio - 1);

    onViewportChange({
      zoom: newZoom,
      centerX: newCenterX,
      centerY: newCenterY,
    });
  }, [viewport, onViewportChange, minZoom, maxZoom]);

  // Handle pan start (Ctrl/Cmd + left mouse button)
  const handleMouseDown = useCallback((event: React.MouseEvent) => {
    // Only pan with Ctrl/Cmd + left mouse button
    if (event.button === 0 && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      setIsDragging(true);
      setDragStart({ x: event.clientX, y: event.clientY });
      setLastPanPoint({ x: viewport.centerX, y: viewport.centerY });
      
      if (canvasRef.current) {
        canvasRef.current.style.cursor = 'grabbing';
      }
    }
  }, [viewport.centerX, viewport.centerY]);

  // Handle pan during drag
  const handleMouseMove = useCallback((event: React.MouseEvent) => {
    if (!isDragging) return;

    event.preventDefault();
    const deltaX = event.clientX - dragStart.x;
    const deltaY = event.clientY - dragStart.y;

    onViewportChange({
      ...viewport,
      centerX: lastPanPoint.x + deltaX,
      centerY: lastPanPoint.y + deltaY,
    });
  }, [isDragging, dragStart, lastPanPoint, viewport, onViewportChange]);

  // Handle pan end
  const handleMouseUp = useCallback((event: React.MouseEvent) => {
    if (isDragging) {
      event.preventDefault();
      setIsDragging(false);
      
      if (canvasRef.current) {
        canvasRef.current.style.cursor = '';
      }
    }
  }, [isDragging]);

  // Handle wheel events with proper preventDefault
  useEffect(() => {
    const handleWheelEvent = (event: WheelEvent) => {
      if (!canvasRef.current) return;
      
      const rect = canvasRef.current.getBoundingClientRect();
      const mouseX = event.clientX - rect.left - rect.width / 2;
      const mouseY = event.clientY - rect.top - rect.height / 2;

      // Calculate zoom delta
      const zoomDelta = event.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.min(maxZoom, Math.max(minZoom, viewport.zoom * zoomDelta));
      
      if (newZoom === viewport.zoom) return;

      // Zoom towards mouse position
      const zoomRatio = newZoom / viewport.zoom;
      const newCenterX = viewport.centerX - (mouseX - viewport.centerX) * (zoomRatio - 1);
      const newCenterY = viewport.centerY - (mouseY - viewport.centerY) * (zoomRatio - 1);

      onViewportChange({
        zoom: newZoom,
        centerX: newCenterX,
        centerY: newCenterY,
      });
      
      event.preventDefault();
    };
    
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.addEventListener('wheel', handleWheelEvent, { passive: false });
    }
    
    return () => {
      if (canvas) {
        canvas.removeEventListener('wheel', handleWheelEvent);
      }
    };
  }, [viewport, onViewportChange, minZoom, maxZoom]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Zoom with + and - keys
      if (event.key === '+' || event.key === '=') {
        event.preventDefault();
        const newZoom = Math.min(maxZoom, viewport.zoom * 1.1);
        onViewportChange({ ...viewport, zoom: newZoom });
      } else if (event.key === '-') {
        event.preventDefault();
        const newZoom = Math.max(minZoom, viewport.zoom * 0.9);
        onViewportChange({ ...viewport, zoom: newZoom });
      } else if (event.key === '0') {
        // Reset zoom to 1.0
        event.preventDefault();
        onViewportChange({ ...viewport, zoom: 1.0 });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewport, onViewportChange, minZoom, maxZoom]);

  // Calculate dotted background pattern offset based on viewport
  const backgroundOffset = useMemo(() => {
    const offsetX = (viewport.centerX % (gridSize * viewport.zoom)) / viewport.zoom;
    const offsetY = (viewport.centerY % (gridSize * viewport.zoom)) / viewport.zoom;
    return { x: offsetX, y: offsetY };
  }, [viewport.centerX, viewport.centerY, viewport.zoom, gridSize]);

  return (
    <div 
      className={`canvas ${className}`}
      ref={canvasRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Dotted background pattern */}
      <div 
        className="canvas__background"
        style={{
          backgroundImage: `radial-gradient(circle, rgba(150, 150, 150, 0.3) 1px, transparent 1px)`,
          backgroundSize: `${gridSize}px ${gridSize}px`,
          backgroundPosition: `${backgroundOffset.x}px ${backgroundOffset.y}px`,
        }}
      />
      
      {/* Canvas content with zoom and pan transform */}
      <div 
        className="canvas__content"
        ref={contentRef}
        style={{
          transform: contentTransform,
          transformOrigin: '0 0',
        }}
      >
        {children}
      </div>
      
      {/* Zoom level indicator */}
      <div className="canvas__zoom-indicator">
        {Math.round(viewport.zoom * 100)}%
      </div>
    </div>
  );
}