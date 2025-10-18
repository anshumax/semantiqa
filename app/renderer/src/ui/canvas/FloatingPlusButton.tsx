import React from 'react';
import './FloatingPlusButton.css';

export interface FloatingPlusButtonProps {
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  tooltip?: string;
}

export function FloatingPlusButton({ 
  onClick, 
  disabled = false, 
  loading = false, 
  className = '',
  tooltip = 'Add new data source'
}: FloatingPlusButtonProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && !loading) {
      onClick();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick(e as any);
    }
  };

  return (
    <button
      className={`floating-plus-button ${disabled ? 'floating-plus-button--disabled' : ''} ${loading ? 'floating-plus-button--loading' : ''} ${className}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      disabled={disabled || loading}
      title={tooltip}
      aria-label={tooltip}
      type="button"
    >
      {loading ? (
        <div className="floating-plus-button__spinner" aria-hidden="true">
          <div className="spinner"></div>
        </div>
      ) : (
        <div className="floating-plus-button__icon" aria-hidden="true">
          +
        </div>
      )}
      
      {/* Ripple effect container */}
      <div className="floating-plus-button__ripple" aria-hidden="true"></div>
    </button>
  );
}