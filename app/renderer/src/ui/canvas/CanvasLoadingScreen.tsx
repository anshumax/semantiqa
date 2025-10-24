import React from 'react';
import './CanvasLoadingScreen.css';

export interface CanvasLoadingScreenProps {
  visible: boolean;
  message?: string;
}

export function CanvasLoadingScreen({ visible, message = 'Creating map...' }: CanvasLoadingScreenProps) {
  if (!visible) return null;

  return (
    <div className="canvas-loading-screen">
      <div className="canvas-loading-screen__content">
        <div className="canvas-loading-screen__spinner"></div>
        <h2 className="canvas-loading-screen__message">{message}</h2>
      </div>
    </div>
  );
}
