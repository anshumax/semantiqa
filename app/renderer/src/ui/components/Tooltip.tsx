import React from 'react';
import { Tooltip as MantineTooltip } from '@mantine/core';

interface TooltipProps {
  content: string;
  children: React.ReactNode;
}

export function Tooltip({ content, children }: TooltipProps) {
  return (
    <MantineTooltip
      label={content}
      position="top"
      withArrow
      transitionProps={{ duration: 200 }}
      styles={{
        tooltip: {
          background: 'rgba(20, 22, 30, 0.98)',
          border: '1px solid rgba(170, 176, 190, 0.24)',
          fontSize: '0.75rem',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
        },
      }}
    >
      <span style={{ display: 'inline-block' }}>{children}</span>
    </MantineTooltip>
  );
}

