import React from 'react';
import './CanvasBreadcrumbs.css';
import { CanvasBreadcrumb } from './navigationTypes';

export interface CanvasBreadcrumbsProps {
  breadcrumbs: CanvasBreadcrumb[];
  onNavigate: (level: string, path: string[]) => void;
  className?: string;
}

export function CanvasBreadcrumbs({ 
  breadcrumbs, 
  onNavigate, 
  className = '' 
}: CanvasBreadcrumbsProps) {
  const handleBreadcrumbClick = (breadcrumb: CanvasBreadcrumb, index: number) => {
    // Only allow navigation to previous levels, not the current one
    if (index < breadcrumbs.length - 1) {
      onNavigate(breadcrumb.level, breadcrumb.path);
    }
  };

  const handleBackClick = () => {
    if (breadcrumbs.length > 1) {
      const previousBreadcrumb = breadcrumbs[breadcrumbs.length - 2];
      onNavigate(previousBreadcrumb.level, previousBreadcrumb.path);
    }
  };

  return (
    <nav className={`canvas-breadcrumbs ${className}`} aria-label="Canvas navigation">
      {/* Back button - only show when not at root level */}
      {breadcrumbs.length > 1 && (
        <button
          className="canvas-breadcrumbs__back"
          onClick={handleBackClick}
          title="Go back to previous level"
          aria-label="Go back"
        >
          <span className="canvas-breadcrumbs__back-icon">←</span>
        </button>
      )}

      {/* Breadcrumb list */}
      <ol className="canvas-breadcrumbs__list">
        {breadcrumbs.map((breadcrumb, index) => {
          const isLast = index === breadcrumbs.length - 1;
          const isClickable = !isLast && index < breadcrumbs.length - 1;

          return (
            <li key={`${breadcrumb.level}-${index}`} className="canvas-breadcrumbs__item">
              {index > 0 && (
                <span 
                  className="canvas-breadcrumbs__separator" 
                  aria-hidden="true"
                >
                  →
                </span>
              )}
              
              {isClickable ? (
                <button
                  className="canvas-breadcrumbs__link"
                  onClick={() => handleBreadcrumbClick(breadcrumb, index)}
                  title={`Navigate to ${breadcrumb.label}`}
                >
                  {breadcrumb.label}
                </button>
              ) : (
                <span 
                  className={`canvas-breadcrumbs__current ${isLast ? 'canvas-breadcrumbs__current--active' : ''}`}
                  aria-current={isLast ? 'page' : undefined}
                >
                  {breadcrumb.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>

      {/* Level indicator */}
      <div className="canvas-breadcrumbs__level">
        <span className="canvas-breadcrumbs__level-text">
          {breadcrumbs[breadcrumbs.length - 1]?.level === 'sources' ? 'Data Sources' : 'Tables & Collections'}
        </span>
      </div>
    </nav>
  );
}