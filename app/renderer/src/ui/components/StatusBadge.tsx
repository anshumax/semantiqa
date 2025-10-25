import type { PropsWithChildren } from 'react';
import { Badge, Group } from '@mantine/core';

type StatusTone = 'neutral' | 'positive' | 'negative';

interface StatusBadgeProps extends PropsWithChildren {
  tone?: StatusTone;
  icon?: React.ReactNode;
}

const toneColorMap: Record<StatusTone, string> = {
  neutral: 'gray',
  positive: 'teal',
  negative: 'red',
};

export function StatusBadge({ children, tone = 'neutral', icon }: StatusBadgeProps) {
  const color = toneColorMap[tone];
  
  return (
    <Badge
      size="lg"
      radius="xl"
      variant="light"
      color={color}
      leftSection={icon}
      styles={{
        root: {
          background: tone === 'neutral' 
            ? 'rgba(18, 20, 28, 0.75)' 
            : tone === 'positive'
            ? 'rgba(32, 48, 40, 0.62)'
            : 'rgba(48, 28, 32, 0.62)',
          border: tone === 'neutral'
            ? '1px solid rgba(214, 216, 224, 0.18)'
            : tone === 'positive'
            ? '1px solid rgba(138, 230, 184, 0.4)'
            : '1px solid rgba(224, 162, 168, 0.36)',
          textTransform: 'none',
          letterSpacing: '0.02em',
          fontSize: '13px',
          padding: '8px 14px',
          height: 'auto',
        },
        label: {
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
        },
      }}
    >
      <Group gap={4} wrap="nowrap">
        {children}
      </Group>
    </Badge>
  );
}

export function StatusBadgeLabel({ children }: PropsWithChildren) {
  return (
    <span style={{ 
      color: 'var(--color-text-muted)',
      fontWeight: 500,
      letterSpacing: '0.01em',
    }}>
      {children}
    </span>
  );
}

export function StatusBadgeValue({ children }: PropsWithChildren) {
  return (
    <span style={{ 
      fontWeight: 600,
      color: 'var(--color-text)',
    }}>
      {children}
    </span>
  );
}


