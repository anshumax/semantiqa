# Semantiqa — UI Design Specification (v1.0)

**Purpose:** Define the user interface architecture, navigation patterns, screen layouts, and interaction models for Semantiqa desktop application.

**Design Principles:**
- **Minimalist aesthetic**: Thin fonts, pastel colors, minimal borders and shadows
- **Search-first**: Primary interface is the ask/search experience
- **Progressive disclosure**: Complex features revealed when needed
- **Visual clarity**: Clean status indicators, obvious next actions
- **Keyboard-friendly**: All primary actions accessible via keyboard

---

## Design Tokens

### Typography
- **Headings**: System sans-serif, 300-400 weight
- **Body**: System sans-serif, 300 weight
- **Code/Data**: Monospace, 400 weight
- **Sizes**: 
  - H1: 28px
  - H2: 20px
  - H3: 16px
  - Body: 14px
  - Small: 12px

### Colors (Pastel Palette)
- **Background**: 
  - Primary: `#1a1a1e` (dark mode) / `#fafafa` (light mode)
  - Secondary: `#2a2a2e` / `#f0f0f0`
- **Text**:
  - Primary: `#e0e0e0` / `#2a2a2e`
  - Secondary: `#a0a0a0` / `#606060`
- **Accent Colors** (pastel):
  - Blue: `#8bb4f7` (info, links)
  - Green: `#b4e7b4` (success, healthy)
  - Yellow: `#f7e7a4` (warning, pending)
  - Red: `#f7b4b4` (error, failed)
  - Purple: `#d4b4f7` (AI/enrichment)
- **Borders**: `1px solid rgba(255, 255, 255, 0.1)` (dark) / `rgba(0, 0, 0, 0.1)` (light)
- **Shadows**: Minimal; use `0 2px 8px rgba(0, 0, 0, 0.1)` only for modals/dropdowns

### Spacing
- Base unit: 8px
- Scale: 4px, 8px, 12px, 16px, 24px, 32px, 48px, 64px

---

## Application Shell

### Top-Level Layout
```
┌────────────────────────────────────────────────────────────┐
│  [Logo] Semantiqa              Environment: development    │ Title Bar
│                                    IPC: ok @ 8:43:53 PM    │
├────────────────────────────────────────────────────────────┤
│  ┌────────────┬──────────────────────────────────────────┐ │
│  │            │                                          │ │
│  │  Main      │  Screen Content                          │ │
│  │  Nav       │                                          │ │
│  │            │                                          │ │
│  │            │                                          │ │
│  │            │                                          │ │
│  └────────────┴──────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────┘
    ↑ 200px      ↑ Remaining width
```

### Main Navigation (Left Sidebar)
```
┌──────────────────┐
│  🔍  Search & Ask │ ← Default home
│  📊  Sources      │
│  🔗  Relationships│
│  📈  Reports      │
│                  │
│  ⚙️   Settings   │ ← Bottom
└──────────────────┘
```

**States:**
- Active: Highlighted background, accent color border-left
- Hover: Subtle background change
- Icons: 16px, aligned left
- Labels: 14px, thin weight

---

## Screen 1: Search & Ask (Home)

**Purpose:** Primary interface for asking questions and getting answers from connected data sources.

### Empty State (First Run)
```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│            Welcome to Semantiqa                          │
│                                                          │
│   Connect your first data source to get started          │
│                                                          │
│   ┌──────────────┐  ┌──────────────┐                    │
│   │ Connect      │  │ Connect      │                    │
│   │ PostgreSQL   │  │ MySQL        │                    │
│   └──────────────┘  └──────────────┘                    │
│                                                          │
│   ┌──────────────┐  ┌──────────────┐                    │
│   │ Connect      │  │ Load CSV/    │                    │
│   │ MongoDB      │  │ Parquet      │                    │
│   └──────────────┘  └──────────────┘                    │
│                                                          │
│   All connections are read-only and secure               │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### Active State (Sources Connected)
```
┌──────────────────────────────────────────────────────────┐
│  Ask a question about your data...                       │
│  ┌────────────────────────────────────────────────────┐  │
│  │ Show me all transactions over $1000 for customers  │  │
│  │ who signed up in the last 30 days                  │  │
│  └────────────────────────────────────────────────────┘  │
│                                            [Ask ✨]       │
├──────────────────────────────────────────────────────────┤
│  💡 Semantiqa understands:                               │
│    • Cross-source queries (Postgres + MongoDB)           │
│    • Time filters and aggregations                       │
│    • Saved reports and metrics                           │
├──────────────────────────────────────────────────────────┤
│  Recent Queries                            [View All]    │
│  • Customer lifetime value by region                     │
│  • Active users with incomplete profiles                 │
│  • Weekly revenue trends                                 │
│                                                          │
│  Saved Reports                             [View All]    │
│  • Weekly Revenue Dashboard                              │
│  • User Activity Summary                                 │
│  • Transaction Analysis                                  │
└──────────────────────────────────────────────────────────┘
```

### Query Execution State
```
┌──────────────────────────────────────────────────────────┐
│  Show me all transactions over $1000...                  │
│                                                          │
│  Query Plan (3 steps):                    [View Details] │
│  ─────────────────────────────────────────               │
│  ① PostgreSQL: callnex_backend                           │
│     SELECT user_id, created_at FROM users                │
│     WHERE created_at > NOW() - INTERVAL '30 days'        │
│                                                          │
│  ② MongoDB: callnex_analytics                            │
│     db.transactions.find({ amount: { $gt: 1000 } })      │
│                                                          │
│  ③ Join on: user_id ↔ userId (semantic link)            │
│     Filter, aggregate, return unified dataset            │
│                                                          │
│  [View SQL/Pipelines] [Save as Report] [Export]          │
├──────────────────────────────────────────────────────────┤
│  Results (1,247 rows)           [Mask PII] [Visualize]   │
│  ┌────────────────────────────────────────────────────┐  │
│  │ user_id │ name       │ amount  │ date              │  │
│  ├─────────┼────────────┼─────────┼───────────────────┤  │
│  │ 12345   │ John D.    │ $1,500  │ 2025-10-01 14:23 │  │
│  │ 12346   │ Jane S.    │ $2,100  │ 2025-10-02 09:15 │  │
│  │ ...                                                 │  │
│  └────────────────────────────────────────────────────┘  │
│                                      Page 1 of 25   [→]  │
└──────────────────────────────────────────────────────────┘
```

---

## Screen 2: Sources

**Purpose:** Manage data source connections, view schemas, monitor crawl status.

### Layout
```
┌─────────────────┬────────────────────────────────────────┐
│ SIDEBAR (280px) │ DETAILS PANEL                          │
├─────────────────┼────────────────────────────────────────┤
│                 │                                        │
│ ◐ Status Panel  │  [Selected Source Details]             │
│                 │                                        │
│ ▼ Sources       │  Schema Tree / Inspector               │
│   ▼ callnex     │                                        │
│     • postgres  │                                        │
│     ○ Crawled   │                                        │
│                 │                                        │
│   ▼ analytics   │                                        │
│     • mongo     │                                        │
│     ○ Crawled   │                                        │
│                 │                                        │
│ ⊕ Connect...    │                                        │
│                 │                                        │
└─────────────────┴────────────────────────────────────────┘
```

### Status Panel (Collapsible)
```
┌─────────────────────────────────────────────────────────┐
│  Status Overview                              [Collapse] │
├─────────────────────────────────────────────────────────┤
│  callnex (PostgreSQL)                  ● Crawled 2h ago │
│  Connection: ● Healthy                                  │
│                                        [Retry Crawl]    │
│                                                         │
│  analytics (MongoDB)                   ● Crawled 2h ago │
│  Connection: ● Healthy                                  │
│                                        [Retry Crawl]    │
├─────────────────────────────────────────────────────────┤
│  [Crawl All]                                            │
└─────────────────────────────────────────────────────────┘
```

### Source Tree
```
▼ CALLNEX (PostgreSQL)                    ● Crawled
  ▼ public                               (24 tables)
    • users                              (12 columns)
    • transactions                       (8 columns)
    • billing_accounts                   (15 columns)
    ▶ campaigns                          (9 columns)
  ▶ analytics                            (6 tables)

▼ ANALYTICS (MongoDB)                     ● Crawled
  ▶ transactions                         (8 fields)
  ▶ user_events                          (6 fields)
```

### Detail Panel (Table Selected)
```
┌─────────────────────────────────────────────────────────┐
│  users                                                   │
│  Table • callnex.public                                  │
├─────────────────────────────────────────────────────────┤
│  METADATA                                                │
│  No metadata yet. Add owners, tags, or descriptions      │
│  from the inspector.                                     │
│                                                          │
│  [Edit Metadata]                                         │
├─────────────────────────────────────────────────────────┤
│  PROFILE                                                 │
│  Rows: ~1,247,832                                        │
│  Columns: 12                                             │
│                                                          │
│  [Run Profile]                                           │
├─────────────────────────────────────────────────────────┤
│  COLUMNS (12)                                            │
│  • id              bigint      PK                        │
│  • email           varchar     ∅ 0%                      │
│  • created_at      timestamp                             │
│  • updated_at      timestamp                             │
│  ...                                                     │
├─────────────────────────────────────────────────────────┤
│  RELATIONSHIPS                                           │
│  → transactions.user_id (FK)                             │
│  ↔ analytics.transactions.userId (semantic)              │
│                                                          │
│  [View Graph]                                            │
├─────────────────────────────────────────────────────────┤
│  Last crawled: Never crawled                             │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## Screen 3: Relationships

**Purpose:** Define and manage semantic mappings between fields across different sources.

### Layout
```
┌──────────────────────────────────────────────────────────┐
│  Semantic Relationships              [+ Add Relationship] │
├──────────────────────────────────────────────────────────┤
│  [List View] [Graph View]                                │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Cross-Source Mappings (12)                              │
│  ┌────────────────────────────────────────────────────┐  │
│  │  User Identity                          ● Confirmed │  │
│  │  ─────────────────────────────────────────────────  │  │
│  │  PostgreSQL: callnex.public.users.id                │  │
│  │       ↕ maps to (1:N)                               │  │
│  │  MongoDB: analytics.transactions.userId             │  │
│  │                                                     │  │
│  │  Confidence: ● High (auto-detected)                 │  │
│  │  [Edit] [Remove] [View Graph]                       │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │  Account Reference                   ◐ Suggested    │  │
│  │  ─────────────────────────────────────────────────  │  │
│  │  PostgreSQL: callnex.public.billing.account_id      │  │
│  │       ↕ maps to (1:1)                               │  │
│  │  MongoDB: analytics.usage.accountRef                │  │
│  │                                                     │  │
│  │  Confidence: ◐ Medium (name similarity, type match) │  │
│  │  [Confirm] [Edit] [Dismiss]                         │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  Suggestions (3)                          [Review All]   │
│  • campaigns.id ↔ calls.campId (High confidence)         │
│  • agents.id ↔ voices.agentRef (Medium confidence)       │
└──────────────────────────────────────────────────────────┘
```

### Graph View
```
┌──────────────────────────────────────────────────────────┐
│  [List View] [Graph View] ✓                              │
├──────────────────────────────────────────────────────────┤
│                                                          │
│      PostgreSQL: callnex                                 │
│      ┌──────────┐                                        │
│      │  users   │─────────┐                              │
│      │  (PG)    │         │                              │
│      └──────────┘         │ id ↔ userId                  │
│           │               │ (semantic)                   │
│           │ user_id (FK)  │                              │
│           ▼               ▼                              │
│      ┌──────────┐   ┌──────────────┐  MongoDB           │
│      │  trans-  │   │ transactions │  analytics         │
│      │  actions │   │   (Mongo)    │                    │
│      │  (PG)    │   └──────────────┘                    │
│      └──────────┘         │                              │
│           │               │ accountRef ↔ account_id      │
│           │               │ (semantic)                   │
│           ▼               ▼                              │
│      ┌──────────┐   ┌──────────────┐                    │
│      │ billing  │   │    usage     │                    │
│      │  (PG)    │   │   (Mongo)    │                    │
│      └──────────┘   └──────────────┘                    │
│                                                          │
│  Legend: ─── FK  ┄┄┄ Semantic Link                      │
└──────────────────────────────────────────────────────────┘
```

### Add/Edit Relationship Modal
```
┌──────────────────────────────────────────────────────────┐
│  Add Semantic Relationship                         [✕]   │
├──────────────────────────────────────────────────────────┤
│  Source Field                                            │
│  ┌────────────────────────────────────────────────────┐  │
│  │ callnex (PostgreSQL) ▼                             │  │
│  └────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────┐  │
│  │ public.users.id (bigint) ▼                         │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  Target Field                                            │
│  ┌────────────────────────────────────────────────────┐  │
│  │ analytics (MongoDB) ▼                              │  │
│  └────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────┐  │
│  │ transactions.userId (string) ▼                     │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  Cardinality                                             │
│  ┌────────────────────────────────────────────────────┐  │
│  │ One to Many (1:N) ▼                                │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  ⚠️  Type mismatch: bigint vs string                    │
│      Automatic coercion will be applied during joins.    │
│                                                          │
│                                  [Cancel]  [Create Link] │
└──────────────────────────────────────────────────────────┘
```

---

## Screen 4: Reports & Dashboards

**Purpose:** View saved queries as reports, compose reports into dashboards with visualizations.

### Layout
```
┌─────────────────┬────────────────────────────────────────┐
│ SIDEBAR (240px) │ CONTENT PANEL                          │
├─────────────────┼────────────────────────────────────────┤
│ MY REPORTS      │                                        │
│                 │  [Selected Report/Dashboard]           │
│ ▼ Dashboards    │                                        │
│   • Weekly      │                                        │
│     Revenue     │                                        │
│   • User        │                                        │
│     Activity    │                                        │
│                 │                                        │
│ ▼ Saved Queries │                                        │
│   • Customer    │                                        │
│     LTV         │                                        │
│   • Active      │                                        │
│     Users       │                                        │
│   • Revenue     │                                        │
│     Trends      │                                        │
│                 │                                        │
│ [+ New Report]  │                                        │
│ [+ New Dash]    │                                        │
└─────────────────┴────────────────────────────────────────┘
```

### Report Detail View
```
┌──────────────────────────────────────────────────────────┐
│  Customer Lifetime Value by Region                       │
│  Last run: 2 hours ago                   [Edit] [Delete] │
├──────────────────────────────────────────────────────────┤
│  Query Plan                                [View Details] │
│  Sources: callnex (PostgreSQL), analytics (MongoDB)       │
│  Relationships: 2 semantic links used                    │
│                                                          │
│  [Refresh] [Export] [Add to Dashboard]                   │
├──────────────────────────────────────────────────────────┤
│  Results (324 rows)                          [Visualize] │
│  ┌────────────────────────────────────────────────────┐  │
│  │ region   │ customers │ total_value │ avg_value    │  │
│  ├──────────┼───────────┼─────────────┼──────────────┤  │
│  │ North    │ 1,247     │ $847,234    │ $679.23      │  │
│  │ South    │ 892       │ $623,891    │ $699.43      │  │
│  │ East     │ 1,034     │ $721,456    │ $697.72      │  │
│  │ West     │ 1,129     │ $789,123    │ $698.95      │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

### Dashboard View
```
┌──────────────────────────────────────────────────────────┐
│  Weekly Revenue Dashboard                                │
│  Last refreshed: 2 hours ago        [Refresh] [Settings] │
├──────────────────────────────────────────────────────────┤
│  ┌─────────────────────────┬──────────────────────────┐  │
│  │  Revenue Trend          │  Top Customers           │  │
│  │  ─────────────────────  │  ──────────────────────  │  │
│  │  [Line chart showing    │  [Table showing top 10   │  │
│  │   weekly revenue over   │   customers by revenue]  │  │
│  │   last 6 months]        │                          │  │
│  │                         │  1. John D.   $24,532    │  │
│  │  ▲ 12% vs last period   │  2. Jane S.   $22,189    │  │
│  │                         │  3. ...                  │  │
│  └─────────────────────────┴──────────────────────────┘  │
│                                                          │
│  ┌─────────────────────────┬──────────────────────────┐  │
│  │  Revenue by Region      │  Active vs Churned       │  │
│  │  ─────────────────────  │  ──────────────────────  │  │
│  │  [Bar chart showing     │  [Pie chart showing      │  │
│  │   revenue breakdown]    │   customer status]       │  │
│  │                         │                          │  │
│  │                         │  ● Active: 3,247 (87%)   │  │
│  │                         │  ○ Churned: 485 (13%)    │  │
│  └─────────────────────────┴──────────────────────────┘  │
│                                                          │
│  [Edit Layout] [Add Report] [Export as PDF]              │
└──────────────────────────────────────────────────────────┘
```

---

## Modals & Dialogs

### Connect Source Wizard
```
┌──────────────────────────────────────────────────────────┐
│  Connect a data source                             [✕]   │
│  Provide read-only details to connect a database         │
├──────────────────────────────────────────────────────────┤
│  ● Choose source    ○ Configure    ○ Review              │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Choose a source type:                                   │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │ PostgreSQL   │  │ MySQL        │  │ MongoDB      │   │
│  │              │  │              │  │              │   │
│  │ [Select]     │  │ [Select]     │  │ [Select]     │   │
│  └──────────────┘  └──────────────┘  └──────────────┘   │
│                                                          │
│  ┌──────────────┐                                        │
│  │ CSV/Parquet  │                                        │
│  │              │                                        │
│  │ [Select]     │                                        │
│  └──────────────┘                                        │
│                                                          │
│                                           [Cancel] [Next]│
└──────────────────────────────────────────────────────────┘
```

---

## Component Patterns

### Status Badges
```
● Crawled       (Green)
◐ Crawling      (Yellow, animated)
○ Not Crawled   (Gray)
✕ Error         (Red)
```

### Buttons
- **Primary**: Filled background, accent color
- **Secondary**: Outlined, subtle border
- **Ghost**: Text only, no border
- **Icon**: Square, 32px, icon centered

### Cards
```
┌─────────────────────────────────────┐
│  Card Title                         │
│  ─────────────────────────────────  │
│  Content area with subtle padding   │
│  and minimal border                 │
│                                     │
│  [Action]                           │
└─────────────────────────────────────┘
```

### Data Grid
- Fixed header with sort indicators
- Alternating row backgrounds (subtle)
- Hover highlight
- Pagination controls at bottom-right
- Cell padding: 8px 12px

---

## Interaction Patterns

### Search/Ask Input
- Auto-expand textarea (max 5 lines)
- ⌘K / Ctrl+K to focus from anywhere
- Enter to submit, Shift+Enter for newline
- Recent queries dropdown appears on focus

### Tree Navigation
- Click label to select, arrow to expand/collapse
- Keyboard: ↑↓ to navigate, →← to expand/collapse
- Double-click to open in detail panel
- Right-click for context menu

### Query Execution
1. User submits query
2. Loading state with animated indicator
3. Query plan preview (collapsible)
4. Results grid appears with action bar
5. Save/Export options enabled

### Relationship Management
1. Auto-suggestions appear on Sources screen
2. Review in Relationships screen
3. Confirm/Edit/Dismiss actions
4. Changes immediately reflected in graph

---

## Responsive Behavior

**Minimum Window Size:** 1024x768

**Breakpoints:**
- Small: 1024-1280px (compact sidebar)
- Medium: 1280-1600px (standard layout)
- Large: 1600px+ (expanded panels)

**Collapsible Panels:**
- Status panel can collapse to icon-only
- Sidebar can collapse to 60px (icons only)
- Inspector panel can be hidden

---

## Accessibility

- All interactive elements keyboard accessible
- Focus indicators visible
- Color not sole indicator (use icons/text)
- ARIA labels on icon-only buttons
- Semantic HTML throughout
- Screen reader tested

---

---

## Canvas-Based Architecture Update (v2.1)

**Date:** October 18, 2025  
**Status:** Replaces tree-based Sources and separate Relationships screens

### Overview

Major UI architecture change inspired by n8n and modern visual workflow tools. The Sources and Relationships screens are merged into a unified infinite canvas workspace where users can:

- Visualize data sources as draggable blocks
- Create relationships using visual Bezier curve connections
- Drill down into table/collection views within the canvas
- Save and export complete canvas layouts

### Navigation Update

**New 3-Tab Structure:**
```
┌──────────────────┐
│  🔍  Search & Ask │ ← Unchanged
│  🎨  Sources      │ ← Canvas workspace (was Sources + Relationships)
│  📈  Reports      │ ← Unchanged
│                  │
│  ⚙️   Settings   │ ← Bottom
└──────────────────┘
```

### Canvas Workspace Layout

```
┌────────────────────────────────────────────────────────────┐
│  Sources                                    [Save Canvas] │ Header
├────────────────────────────────────────────────────────────┤
│  Canvas > PostgreSQL DB > public schema      [← Back]     │ Breadcrumb
├────────────────────────────────────────────────────────────┤
│  ┌─────────────┐        ┌─────────────┐                  │
│  │             │~~~~~~~~│             │                  │
│  │ PostgreSQL  │        │  MongoDB    │   ┌──────────┐   │
│  │ callnex     │~~~~~~~~│ analytics   │   │ Suggested│   │
│  │ ● Crawled   │        │ ● Crawled   │   │ Relations│   │
│  │    [+]      │        │    [+]      │   │          │   │
│  └─────────────┘        └─────────────┘   │ • user_id│   │
│                                           │   ↔ userId│   │
│     ┌─────────────┐                       │ [Accept] │   │
│     │   DuckDB    │                       │          │   │
│     │ sales.csv   │       ⊙ Connecting... │ [Dismiss]│   │
│     │ ◐ Crawling  │                       └──────────┘   │
│     │    [+]      │                                      │
│     └─────────────┘                                      │
│                                                          │
│  ∴ ∴ ∴ ∴ ∴ ∴ ∴ ∴ ∴ ∴ ∴ ∴ ∴ ∴ ∴ ∴ ∴ ∴ ∴ ∴ ∴ ∴ ∴ ∴   │ Dotted BG
│                                                     [⊕] │ Floating +
│  [🔍] Mini-map              [−] [□] [+] Zoom Controls    │ Floating UI
└────────────────────────────────────────────────────────────┘
```

### Canvas Elements

**Data Source Blocks:**
```
┌─────────────────┐
│ PostgreSQL      │ ← Connection type
│ callnex         │ ← Database name  
│ ● Crawled       │ ← Status badge
│        [+]      │ ← Connection point
└─────────────────┘
```

**Visual Relationship Styles:**
- **Intra-source** (same data source): Dashed lines, same color family
- **Cross-source** (different sources): Solid lines, distinct colors
- **Suggested**: Dotted lines with lower opacity

**Drill-down Navigation:**
- Double-click data source block → Table canvas view
- Breadcrumb: `Canvas > PostgreSQL DB > public schema`
- Table blocks show: table name, row count, column count

### Connection Creation Flow

1. **Initiate**: Hover over block → Plus icon appears
2. **Connect**: Click Plus → Bezier curve follows mouse cursor
3. **Target**: Hover over target block → Strong outline highlight
4. **Complete**: Click target → Relationship definition modal opens
5. **Define**: Dual-column modal for table/column selection
6. **Save**: Relationship persisted with visual properties

**Relationship Definition Modal:**
```
┌──────────────────────────────────────────────────────────┐
│  Create Relationship                             [✕]     │
├──────────────────────────────────────────────────────────┤
│  Source                    Target                        │
│  ──────────────            ──────────────                │
│  PostgreSQL callnex        MongoDB analytics             │
│                                                          │
│  Table/Collection:         Table/Collection:             │
│  ┌──────────────────┐      ┌──────────────────┐         │
│  │ users         ▼ │      │ transactions  ▼ │         │
│  └──────────────────┘      └──────────────────┘         │
│                                                          │
│  Column/Field:             Column/Field:                 │
│  ┌──────────────────┐      ┌──────────────────┐         │
│  │ id            ▼ │      │ userId        ▼ │         │
│  └──────────────────┘      └──────────────────┘         │
│                                                          │
│  ✓ users.id (bigint)       ✓ transactions.userId (string)│
│                                                          │
│                                     [Cancel] [Create]   │
└──────────────────────────────────────────────────────────┘
```

### Canvas State Persistence

**Database Schema:**
- `canvas_state`: Canvas metadata (zoom, viewport, settings)
- `canvas_blocks`: Block positions and visual properties
- `canvas_relationships`: Connection visual styling

**Save Controls:**
```
[Save Canvas*]  [Auto-save: ON ▼]  [Canvas Settings ⚙️]
     ↑ Asterisk indicates unsaved changes
```

**Export Format (JSON):**
```json
{
  "canvas": {
    "version": "2.1",
    "name": "Production Data Sources",
    "viewport": { "zoom": 1.0, "centerX": 0, "centerY": 0 },
    "blocks": [
      {
        "id": "postgres-callnex",
        "type": "postgresql",
        "position": { "x": 100, "y": 150 },
        "size": { "width": 200, "height": 120 },
        "connection": {
          "name": "callnex",
          "host": "prod-pg.company.com",
          "database": "callnex"
        }
      }
    ],
    "relationships": [
      {
        "id": "rel-1",
        "source": "postgres-callnex:users.id",
        "target": "mongo-analytics:transactions.userId",
        "visual": {
          "style": "solid",
          "color": "#8bb4f7",
          "path": "M100,150 C150,150 200,200 250,200"
        }
      }
    ]
  }
}
```

### Multi-Database Selection

When connecting to a server with multiple databases:

```
┌──────────────────────────────────────────────────────────┐
│  Multiple Databases Found                                │
├──────────────────────────────────────────────────────────┤
│  Select databases to add to canvas:                      │
│                                                          │
│  ☑ callnex_production    (247 tables)                   │
│  ☑ callnex_analytics     (18 tables)                    │
│  ☐ callnex_staging       (247 tables)                   │
│  ☐ callnex_test          (15 tables)                    │
│                                                          │
│  Each database will appear as a separate block          │
│  on the canvas.                                          │
│                                                          │
│                                   [Cancel] [Add Selected]│
└──────────────────────────────────────────────────────────┘
```

### Canvas Floating UI Elements

**Bottom Right - Add Connection:**
```
         [⊕]
    Large circular
   floating button
```

**Top Right - Mini-map:**
```
┌────────────┐
│ [▪] [▪]    │ ← Blocks
│       [▫]  │ ← Viewport
│   [▪]      │
└────────────┘
```

**Bottom Left - Zoom Controls:**
```
[−] [□] [+]
 ↑   ↑   ↑
 Zoom Reset Zoom
 Out  View  In
```

**Left Side - Suggestions Panel (Slide-out):**
```
┌──────────────────┐
│ Suggested Links  │
│ ──────────────── │
│ • users.id       │
│   ↔ userId       │
│   Confidence: 95%│
│   [Accept] [Skip]│
│                  │
│ • account_id     │
│   ↔ accountRef   │
│   Confidence: 78%│
│   [Accept] [Skip]│
└──────────────────┘
```

### Technical Implementation Notes

**Canvas Rendering:**
- SVG-based for crisp scaling at all zoom levels
- Viewport culling for performance with large canvases
- CSS transforms for smooth animations
- Spatial indexing for collision detection

**Relationship Curves:**
- Bezier curves calculated between block connection points
- Dynamic recalculation when blocks move
- Hover states with relationship details tooltip
- Click selection for editing

**State Management:**
- Debounced save operations (500ms delay)
- Dirty state tracking for unsaved changes indicator
- Undo/redo support for canvas operations
- Auto-save preference in user settings

### Cross-Instance Portability

**Export includes:**
- Complete visual layout (block positions, zoom, viewport)
- Data source definitions (connection details, no credentials)
- Relationship mappings with visual properties
- Canvas metadata (name, description, creation date)

**Import process:**
1. Load canvas JSON file
2. Validate schema compatibility
3. Create data source blocks (requires credential re-entry)
4. Restore visual layout and relationships
5. Trigger metadata crawls for new connections

**Security:**
- Credentials never exported (connection host/port only)
- Import requires re-authentication for all data sources
- Audit log entries for all import/export operations

---

**This canvas-based UI design replaces the tree-based Sources screen and separate Relationships screen, providing a unified visual workflow for data source management and relationship definition.**

