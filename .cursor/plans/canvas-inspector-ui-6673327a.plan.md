<!-- 6673327a-5303-4d02-bcdb-138208658ca9 71030149-37e0-49e9-8037-85ece6278bdf -->
# Canvas Inspector UI Implementation

## Overview

Implement context-aware inspector panels on the right side of the canvas with different views for data sources (sources level) and tables (tables level). Add collapsible left navigation and new IPC channels for fetching detailed statistics. The inspector adapts its content and visual style based on the current canvas navigation level.

## 1. Update Roadmap Documentation

**File:** `semantiqa-roadmap.md`

Update T-04-13 DoD (line 362) to remove relationship mapping editing:

- Remove: "can edit relationship mappings"
- Keep: Shows source metadata, connection status, table count, last crawl time; relationship selection shows join details; panel slides in/out smoothly

## 2. Create New IPC Channel for Detailed Statistics

**File:** `app/config/src/ipc.ts`

Add new channel `sources:get-details` with comprehensive JSDoc:

```typescript
/**
 * Fetches detailed statistics and metadata for a specific data source.
 * Returns comprehensive information including table counts, row counts,
 * column statistics, and schema details.
 */
'sources:get-details': {
  request: { sourceId: string };
  response: {
    sourceId: string;
    name: string;
    kind: 'postgres' | 'mysql' | 'mongo' | 'duckdb';
    databaseName?: string;
    connectionStatus: 'unknown' | 'checking' | 'connected' | 'error';
    crawlStatus: 'not_crawled' | 'crawling' | 'crawled' | 'error';
    lastConnectedAt?: string;
    lastCrawlAt?: string;
    lastError?: string;
    statistics: {
      tableCount: number;
      totalColumns: number;
      totalRows?: number;
      schemas?: Array<{ name: string; tableCount: number }>;
      topTables?: Array<{ name: string; rowCount: number; columnCount: number }>;
    };
  } | SemantiqaError;
}
```

Add JSDoc comments to ALL existing IPC channels following this pattern:

- Health/Ping: "IPC health check..."
- Sources: "Adds/tests/crawls data sources..."
- Canvas: "Canvas state management..."
- etc.

Update `IPC_CHANNELS` constant and `SafeRendererChannels` type to include new channel.

## 3. Implement Backend Handler

**File:** `app/main/src/ipc/handlers/sourceDetailsHandler.ts` (NEW)

Create handler that:

- Queries `sources` table for basic metadata
- Queries `nodes` table for table/column counts (WHERE type IN ('table', 'collection'))
- Aggregates statistics from node properties JSON
- Returns formatted response matching contract

**File:** `app/main/src/ipc/registry.ts`

Register the new handler:

```typescript
import { handleSourceDetails } from './handlers/sourceDetailsHandler';
// ... in registration
ipcMain.handle('sources:get-details', handleSourceDetails);
```

## 4. Add Collapsible Navigation Panel

**File:** `app/renderer/src/ui/navigation/NavigationShell.tsx`

Add state and toggle button:

```typescript
const [isNavCollapsed, setIsNavCollapsed] = useState(false);
```

Add collapse toggle button to nav element with icon (chevron left/right).

**File:** `app/renderer/src/ui/navigation/NavigationShell.css`

Add transition styles:

```css
.navigation-shell__nav {
  width: 220px; /* or 60px when collapsed */
  transition: width 200ms ease;
}

.navigation-shell__nav--collapsed {
  width: 60px;
}

.navigation-shell__nav--collapsed .nav-item__label {
  display: none;
}
```

## 5. Create Inspector Component Structure

**File:** `app/renderer/src/ui/canvas/inspector/CanvasInspector.tsx` (NEW)

Main container component:

- Props: `selectedItem: { type: 'node' | 'edge' | null, id: string } | null`, `onClose: () => void`
- Conditional rendering: `<InspectorSourcePanel>` or `<InspectorRelationshipPanel>` or `<InspectorEmptyState>`
- Slide animation using CSS transform

**File:** `app/renderer/src/ui/canvas/inspector/CanvasInspector.css` (NEW)

```css
.canvas-inspector {
  position: fixed;
  right: 0;
  top: 0;
  bottom: 0;
  width: 320px;
  background: rgba(11, 12, 18, 0.84);
  backdrop-filter: blur(26px);
  border-left: 1px solid rgba(170, 176, 190, 0.16);
  transform: translateX(100%);
  transition: transform 250ms ease;
  z-index: 100;
}

.canvas-inspector--open {
  transform: translateX(0);
}
```

**File:** `app/renderer/src/ui/canvas/inspector/InspectorHeader.tsx` (NEW)

Header section with:

- Icon + source name
- Kind badge
- Close button (X icon)
- Connection status indicator dot

**File:** `app/renderer/src/ui/canvas/inspector/InspectorEmptyState.tsx` (NEW)

Placeholder message: "Select a data source or relationship to view details"

## 6. Implement Source Panel

**File:** `app/renderer/src/ui/canvas/inspector/InspectorSourcePanel.tsx` (NEW)

Component structure:

1. Use `useEffect` to fetch detailed stats when panel opens via `window.semantiqa.api.invoke('sources:get-details', { sourceId })`
2. Display loading state while fetching
3. Sections:

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Metadata section (database name, owners, tags)
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Connection section (status, last connected time, error if any)
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Crawl section (status, last crawl time, error if any)
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Statistics section (table count, column count, row count, top tables)
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Actions section (Retry Crawl button, Remove Source button with confirmation)

Reference `SourceStatusPanel.tsx` for styling patterns.

**File:** `app/renderer/src/ui/canvas/inspector/InspectorSourcePanel.css` (NEW)

Styled sections with:

- Section headers (uppercase, letter-spacing)
- Metadata rows (dt/dd pairs)
- Status badges (color-coded dots)
- Action buttons (matching existing button styles)

## 7. Implement Relationship Panel

**File:** `app/renderer/src/ui/canvas/inspector/InspectorRelationshipPanel.tsx` (NEW)

Component structure:

1. Props: `relationshipId: string`
2. Fetch relationship from canvas data (already loaded)
3. Sections:

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Header (Source → Target names)
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Relationship type badge
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Table/column mapping
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Confidence score (progress bar or visual indicator)
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Actions (Delete button with confirmation)

Note: Edit functionality removed per requirement change.

## 8. Integrate Inspector with Canvas

**File:** `app/renderer/src/ui/canvas/CanvasWorkspace.tsx`

Add state:

```typescript
const [selectedItem, setSelectedItem] = useState<{
  type: 'node' | 'edge';
  id: string;
} | null>(null);
```

Wire up ReactFlow events:

```typescript
const onNodeClick = useCallback((event, node) => {
  setSelectedItem({ type: 'node', id: node.data.id });
}, []);

const onEdgeClick = useCallback((event, edge) => {
  setSelectedItem({ type: 'edge', id: edge.id });
}, []);

const onPaneClick = useCallback(() => {
  setSelectedItem(null); // Close inspector
}, []);
```

Add inspector component:

```tsx
<CanvasInspector 
  selectedItem={selectedItem}
  onClose={() => setSelectedItem(null)}
/>
```

Add to ReactFlow props: `onNodeClick`, `onEdgeClick`, update `onPaneClick`.

## 9. Add Keyboard Support

**File:** `app/renderer/src/ui/canvas/inspector/CanvasInspector.tsx`

Add `useEffect` with keyboard listener:

```typescript
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && selectedItem) {
      onClose();
    }
  };
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [selectedItem, onClose]);
```

## 10. Add Real-time Status Updates

**File:** `app/renderer/src/ui/canvas/inspector/InspectorSourcePanel.tsx`

Subscribe to `sources:status` events:

```typescript
useEffect(() => {
  const handleStatusUpdate = (event: Event) => {
    const detail = (event as CustomEvent).detail;
    if (detail.sourceId === sourceId) {
      // Update displayed status
      setSourceDetails(prev => ({ ...prev, ...detail }));
    }
  };
  window.addEventListener('sources:status', handleStatusUpdate);
  return () => window.removeEventListener('sources:status', handleStatusUpdate);
}, [sourceId]);
```

## Key Files Changed

- `semantiqa-roadmap.md` - Update T-04-13 DoD
- `app/config/src/ipc.ts` - Add channel, JSDoc all channels
- `app/main/src/ipc/handlers/sourceDetailsHandler.ts` - NEW handler
- `app/main/src/ipc/registry.ts` - Register handler
- `app/renderer/src/ui/navigation/NavigationShell.tsx` - Add collapse
- `app/renderer/src/ui/navigation/NavigationShell.css` - Collapse styles
- `app/renderer/src/ui/canvas/inspector/` - NEW directory with 6 components
- `app/renderer/src/ui/canvas/CanvasWorkspace.tsx` - Integrate inspector

## Testing Checklist

1. Inspector opens when clicking data source node
2. Inspector opens when clicking relationship edge
3. Inspector closes when clicking canvas background
4. Inspector closes when pressing Escape key
5. Detailed statistics load correctly
6. Navigation panel collapses/expands smoothly
7. Retry crawl action works from inspector
8. Real-time status updates appear in inspector
9. All IPC channels have JSDoc documentation
10. Loading states display during data fetch

### To-dos

- [ ] Update T-04-13 in roadmap to remove relationship mapping editing from DoD
- [ ] Add sources:get-details IPC channel with comprehensive statistics response
- [ ] Add JSDoc comments to all existing IPC channels in ipc.ts
- [ ] Implement sourceDetailsHandler with statistics aggregation
- [ ] Register new handler in IPC registry
- [ ] Add collapsible functionality to left navigation panel
- [ ] Create CanvasInspector component with slide-out animation
- [ ] Create InspectorHeader with close button and status indicator
- [ ] Create InspectorEmptyState placeholder component
- [ ] Implement InspectorSourcePanel with metadata, stats, and actions
- [ ] Implement InspectorRelationshipPanel with join details
- [ ] Wire up inspector to canvas node/edge click events
- [ ] Add Escape key handler to close inspector
- [ ] Subscribe to sources:status events for real-time updates
- [ ] Test all inspector interactions and data loading