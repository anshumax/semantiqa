import { useMemo } from 'react';
import type { ExplorerSource, ExplorerTreeNode } from '@semantiqa/contracts';
import './ExplorerTree.css';

interface ExplorerTreeProps {
  sources: ExplorerSource[];
  nodes: ExplorerTreeNode[];
  expandedNodeIds: Set<string>;
  selectedNodeId: string | null;
  onToggle: (nodeId: string) => void;
  onSelect: (nodeId: string) => void;
}

export function ExplorerTree({
  sources,
  nodes,
  expandedNodeIds,
  selectedNodeId,
  onToggle,
  onSelect,
}: ExplorerTreeProps) {
  const groupedNodes = useMemo(() => groupNodesByParent(nodes), [nodes]);

  return (
    <div className="explorer-tree">
      {sources.length === 0 ? (
        <EmptyState />
      ) : (
        sources.map((source) => (
          <SourceSection
            key={source.id}
            source={source}
            nodes={groupedNodes}
            expandedNodeIds={expandedNodeIds}
            selectedNodeId={selectedNodeId}
            onToggle={onToggle}
            onSelect={onSelect}
          />
        ))
      )}
    </div>
  );
}

function groupNodesByParent(nodes: ExplorerTreeNode[]) {
  const map = new Map<string | undefined, ExplorerTreeNode[]>();
  nodes.forEach((node) => {
    const group = map.get(node.parentId) ?? [];
    group.push(node);
    map.set(node.parentId, group);
  });
  return map;
}

function SourceSection({
  source,
  nodes,
  expandedNodeIds,
  selectedNodeId,
  onToggle,
  onSelect,
}: {
  source: ExplorerSource;
  nodes: Map<string | undefined, ExplorerTreeNode[]>;
  expandedNodeIds: Set<string>;
  selectedNodeId: string | null;
  onToggle: (nodeId: string) => void;
  onSelect: (nodeId: string) => void;
}) {
  const topLevelNodes = nodes.get(source.id) ?? [];
  const isExpanded = expandedNodeIds.has(source.id);

  return (
    <div className="explorer-tree__section">
      <button type="button" className="explorer-tree__source" onClick={() => onToggle(source.id)}>
        <span className={`chevron ${isExpanded ? 'chevron--open' : ''}`} aria-hidden />
        <span className="explorer-tree__source-name">{source.name}</span>
        <span className={`status-dot status-dot--${source.status}`} aria-label={source.status} />
      </button>
      {isExpanded ? (
        <div className="explorer-tree__children">
          {topLevelNodes.length > 0 ? (
            topLevelNodes.map((node) => (
              <TreeNode
                key={node.id}
                node={node}
                nodes={nodes}
                depth={0}
                expandedNodeIds={expandedNodeIds}
                selectedNodeId={selectedNodeId}
                onToggle={onToggle}
                onSelect={onSelect}
              />
            ))
          ) : (
            <p className="explorer-tree__empty">No schemas yet. Run a metadata crawl.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

function TreeNode({
  node,
  nodes,
  depth,
  expandedNodeIds,
  selectedNodeId,
  onToggle,
  onSelect,
}: {
  node: ExplorerTreeNode;
  nodes: Map<string | undefined, ExplorerTreeNode[]>;
  depth: number;
  expandedNodeIds: Set<string>;
  selectedNodeId: string | null;
  onToggle: (nodeId: string) => void;
  onSelect: (nodeId: string) => void;
}) {
  const childNodes = nodes.get(node.id) ?? [];
  const isExpanded = expandedNodeIds.has(node.id);
  const isSelected = selectedNodeId === node.id;
  const isLeaf = !node.hasChildren;

  return (
    <div className="explorer-tree__node" style={{ paddingLeft: `${16 + depth * 16}px` }}>
      <button
        type="button"
        className={`explorer-tree__item${isSelected ? ' explorer-tree__item--selected' : ''}`}
        onClick={() => (isLeaf ? onSelect(node.id) : onToggle(node.id))}
      >
        {!isLeaf ? <span className={`chevron ${isExpanded ? 'chevron--open' : ''}`} aria-hidden /> : <span className="bullet" aria-hidden />}
        <span className="explorer-tree__label">{node.label}</span>
      </button>
      {!isLeaf && isExpanded ? (
        <div className="explorer-tree__children">
          {childNodes.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              nodes={nodes}
              depth={depth + 1}
              expandedNodeIds={expandedNodeIds}
              selectedNodeId={selectedNodeId}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="explorer-tree__empty">
      <p>No sources connected yet. Add a source to begin exploring.</p>
    </div>
  );
}


