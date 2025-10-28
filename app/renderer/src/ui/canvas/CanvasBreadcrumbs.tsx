import React from 'react';
import { Breadcrumbs, Anchor, Text, ActionIcon, Group, Badge } from '@mantine/core';
import { IconArrowLeft, IconHelp } from '@tabler/icons-react';
import { CanvasBreadcrumb } from './navigationTypes';

export interface CanvasBreadcrumbsProps {
  breadcrumbs: CanvasBreadcrumb[];
  onNavigate: (level: string, path: string[]) => void;
  onHelpClick?: () => void;
  className?: string;
}

export function CanvasBreadcrumbs({ 
  breadcrumbs, 
  onNavigate,
  onHelpClick,
  className = '' 
}: CanvasBreadcrumbsProps) {
  const handleBreadcrumbClick = (breadcrumb: CanvasBreadcrumb, index: number) => {
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

  const breadcrumbItems = breadcrumbs.map((breadcrumb, index) => {
    const isLast = index === breadcrumbs.length - 1;

    if (isLast) {
      return (
        <Text 
          key={`${breadcrumb.level}-${index}`}
          fw={600}
          c="dimmed"
        >
          {breadcrumb.label}
        </Text>
      );
    }

    return (
      <Anchor
        key={`${breadcrumb.level}-${index}`}
        onClick={() => handleBreadcrumbClick(breadcrumb, index)}
        style={{ cursor: 'pointer' }}
      >
        {breadcrumb.label}
      </Anchor>
    );
  });

  return (
    <Group 
      className={className}
      gap="md"
      p="xs"
      style={{
        borderBottom: '1px solid rgba(214, 216, 224, 0.12)',
        minHeight: 40,
      }}
    >
      {/* Back button - only show when not at root level */}
      {breadcrumbs.length > 1 && (
        <ActionIcon
          variant="subtle"
          color="gray"
          onClick={handleBackClick}
          title="Go back to previous level"
          aria-label="Go back"
        >
          <IconArrowLeft size={18} />
        </ActionIcon>
      )}

      <Breadcrumbs separator="→" separatorMargin="xs">
        {breadcrumbItems}
      </Breadcrumbs>

      {/* Level indicator badge */}
      <Badge 
        variant="light" 
        size="sm"
        style={{ 
          textTransform: 'uppercase', 
          letterSpacing: '0.5px',
          marginLeft: 'auto',
        }}
      >
        {breadcrumbs[breadcrumbs.length - 1]?.level === 'sources' 
          ? 'Data Sources' 
          : 'Tables & Collections'}
      </Badge>

      {/* Help button */}
      {onHelpClick && (
        <ActionIcon
          variant="subtle"
          color="blue"
          onClick={onHelpClick}
          title="Show help"
          aria-label="Show canvas controls help"
        >
          <IconHelp size={18} />
        </ActionIcon>
      )}
    </Group>
  );
}