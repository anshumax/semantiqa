import React from 'react';
import './CanvasFloatingUI.css';

export interface CanvasFloatingUIProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Container for floating UI elements that overlay the canvas
 * Manages z-index layering and ensures elements don't interfere with canvas interactions
 */
export function CanvasFloatingUI({ children, className = '' }: CanvasFloatingUIProps) {
  return (
    <div className={`canvas-floating-ui ${className}`}>
      {children}
    </div>
  );
}

export interface FloatingElementProps {
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Individual floating UI element with predefined positioning
 */
export function FloatingElement({ 
  position, 
  children, 
  className = '', 
  style = {} 
}: FloatingElementProps) {
  return (
    <div 
      className={`floating-element floating-element--${position} ${className}`}
      style={style}
    >
      {children}
    </div>
  );
}