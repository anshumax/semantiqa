import './InspectorHeader.css';

export interface InspectorHeaderProps {
  icon: string;
  title: string;
  subtitle?: string;
  badge?: {
    text: string;
    status: 'success' | 'warning' | 'error' | 'info';
  };
  onClose: () => void;
}

export function InspectorHeader({ icon, title, subtitle, badge, onClose }: InspectorHeaderProps) {
  return (
    <header className="inspector-header">
      <div className="inspector-header__main">
        <div className="inspector-header__icon" aria-hidden="true">{icon}</div>
        <div className="inspector-header__text">
          <h2 className="inspector-header__title">{title}</h2>
          {subtitle && <p className="inspector-header__subtitle">{subtitle}</p>}
        </div>
      </div>
      <div className="inspector-header__actions">
        {badge && (
          <span className={`inspector-header__badge inspector-header__badge--${badge.status}`}>
            {badge.text}
          </span>
        )}
        <button
          type="button"
          className="inspector-header__close"
          onClick={onClose}
          aria-label="Close inspector"
          title="Close inspector (Esc)"
        >
          ×
        </button>
      </div>
    </header>
  );
}

