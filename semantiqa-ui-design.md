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

**This UI design serves as the foundation for Phase 4+ implementation tasks in the roadmap.**

