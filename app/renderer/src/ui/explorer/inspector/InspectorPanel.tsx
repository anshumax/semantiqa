import { Fragment, useMemo } from 'react';

import type { TableProfile } from '@semantiqa/contracts';

import { StatusBadge, StatusBadgeLabel, StatusBadgeValue } from '../../components';

import './InspectorPanel.css';

interface InspectorPanelProps {
  node: {
    id: string;
    label: string;
    kind: 'schema' | 'table' | 'view' | 'collection' | 'field';
  };
  breadcrumbs: Array<{ id: string; label: string }>;
  metadata: {
    owners: string[];
    tags: string[];
    sensitivity?: string;
    status?: string;
    description?: string;
    kind?: 'postgres' | 'mysql' | 'mongo' | 'duckdb';
  } | null;
  stats: {
    rowCount?: number;
    columnCount?: number;
    profile?: TableProfile;
  } | null;
  lastCrawledAt: string | null;
  lastError: string | null;
}

const numberFormatter = new Intl.NumberFormat('en-US');

export function InspectorPanel({
  node,
  breadcrumbs,
  metadata,
  stats,
  lastCrawledAt,
  lastError,
}: InspectorPanelProps) {
  const formattedRowCount = useMemo(() => {
    if (!stats?.rowCount && stats?.rowCount !== 0) {
      return null;
    }
    return numberFormatter.format(stats.rowCount);
  }, [stats?.rowCount]);

  const formattedColumnCount = useMemo(() => {
    if (!stats?.columnCount && stats?.columnCount !== 0) {
      return null;
    }
    return numberFormatter.format(stats.columnCount);
  }, [stats?.columnCount]);

  return (
    <section className="inspector">
      <header className="inspector__header">
        <Breadcrumbs items={breadcrumbs} activeId={node.id} />
        <div>
          <h3 className="inspector__title">{node.label}</h3>
          <p className="inspector__subtitle">{formatKind(node.kind, metadata?.kind)}</p>
        </div>
      </header>

      <div className="inspector__grid">
        <section className="inspector__panel inspector__panel--metadata">
          <h4>Metadata</h4>
          {metadata ? (
            <dl className="inspector__dl">
              <DetailItem label="Owners" value={metadata.owners.join(', ') || '—'} />
              <DetailItem label="Tags" value={metadata.tags.join(', ') || '—'} />
              <DetailItem label="Sensitivity" value={metadata.sensitivity ?? 'Internal'} />
              <DetailItem label="Status" value={metadata.status ?? 'Draft'} />
              <DetailItem label="Description" value={metadata.description ?? '—'} isDescription />
            </dl>
          ) : (
            <EmptyHint message="No metadata yet. Add owners, tags, or descriptions from the inspector." />
          )}
        </section>

        <section className="inspector__panel inspector__panel--stats">
          <h4>Profile</h4>
          {formattedRowCount || formattedColumnCount || stats?.profile ? (
            <div className="inspector__badges">
              {formattedRowCount ? (
                <StatusBadge tone="neutral">
                  <StatusBadgeLabel>Rows</StatusBadgeLabel>
                  <StatusBadgeValue>{formattedRowCount}</StatusBadgeValue>
                </StatusBadge>
              ) : null}
              {formattedColumnCount ? (
                <StatusBadge tone="neutral">
                  <StatusBadgeLabel>Columns</StatusBadgeLabel>
                  <StatusBadgeValue>{formattedColumnCount}</StatusBadgeValue>
                </StatusBadge>
              ) : null}
            </div>
          ) : (
            <EmptyHint message="Run a metadata crawl to populate profiling stats." />
          )}
          {stats?.profile ? <ProfileTable profile={stats.profile} /> : null}
        </section>
      </div>

      <footer className="inspector__footer">
        <StatusBadge tone={lastError ? 'negative' : 'positive'}>
          <StatusBadgeLabel>{lastError ? 'Last error' : 'Last crawled'}</StatusBadgeLabel>
          <StatusBadgeValue>{lastError ?? formatDate(lastCrawledAt) ?? 'Never crawled'}</StatusBadgeValue>
        </StatusBadge>
      </footer>
    </section>
  );
}

function Breadcrumbs({
  items,
  activeId,
}: {
  items: Array<{ id: string; label: string }>;
  activeId: string;
}) {
  if (items.length <= 1) {
    return null;
  }

  return (
    <nav className="inspector__breadcrumbs" aria-label="Selected entity path">
      {items.map((item, index) => (
        <Fragment key={item.id}>
          <span className={item.id === activeId ? 'inspector__breadcrumb inspector__breadcrumb--active' : 'inspector__breadcrumb'}>
            {item.label}
          </span>
          {index < items.length - 1 ? <span aria-hidden className="inspector__breadcrumb-separator">/</span> : null}
        </Fragment>
      ))}
    </nav>
  );
}

function DetailItem({ label, value, isDescription = false }: { label: string; value: string; isDescription?: boolean }) {
  return (
    <div className={isDescription ? 'inspector__detail inspector__detail--wide' : 'inspector__detail'}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function EmptyHint({ message }: { message: string }) {
  return <p className="inspector__empty">{message}</p>;
}

function ProfileTable({ profile }: { profile: TableProfile }) {
  return (
    <table className="inspector__profile">
      <thead>
        <tr>
          <th>Column</th>
          <th>Type</th>
          <th>Null %</th>
          <th>Distinct %</th>
        </tr>
      </thead>
      <tbody>
        {profile.columns.slice(0, 8).map((column) => (
          <tr key={column.name}>
            <td>{column.name}</td>
            <td>{column.type}</td>
            <td>{formatPercent(column.nullPercent)}</td>
            <td>{formatPercent(column.distinctPercent)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function formatPercent(value?: number) {
  if (typeof value !== 'number') {
    return '—';
  }
  return `${value.toFixed(1)}%`;
}

function formatDate(value: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

function formatKind(
  kind: InspectorPanelProps['node']['kind'],
  sourceKind?: 'postgres' | 'mysql' | 'mongo' | 'duckdb',
) {
  const kindLabel = (() => {
    switch (kind) {
      case 'schema':
        return 'Schema';
      case 'table':
        return 'Table';
      case 'view':
        return 'View';
      case 'collection':
        return 'Collection';
      case 'field':
        return 'Field';
      default:
        return 'Entity';
    }
  })();

  if (!sourceKind) {
    return kindLabel;
  }

  return `${kindLabel} • ${sourceKind.toUpperCase()}`;
}


