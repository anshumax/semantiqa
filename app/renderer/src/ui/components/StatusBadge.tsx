import type { PropsWithChildren } from 'react';

type StatusTone = 'neutral' | 'positive' | 'negative';

interface StatusBadgeProps extends PropsWithChildren {
  tone?: StatusTone;
  icon?: React.ReactNode;
}

export function StatusBadge({ children, tone = 'neutral', icon }: StatusBadgeProps) {
  return (
    <span className={`status-badge status-badge--${tone}`}>
      {icon ? <span className="status-badge__icon">{icon}</span> : null}
      {children}
    </span>
  );
}

export function StatusBadgeLabel({ children }: PropsWithChildren) {
  return <span className="status-badge__label">{children}</span>;
}

export function StatusBadgeValue({ children }: PropsWithChildren) {
  return <span className="status-badge__value">{children}</span>;
}


