<!-- ee9de9f9-8b0d-4e3f-8b63-0a1dbfe0bd6d b046f01b-6c06-4902-b043-6767c77a4d6d -->
# Mantine Migration Plan

## Phase 1: Setup & Configuration

### Install Mantine Dependencies

- Add to `app/renderer/package.json`:
- `@mantine/core@^7.x`
- `@mantine/hooks@^7.x`
- `@emotion/react@^11.x` (peer dependency)
- `@emotion/styled@^11.x` (peer dependency)
- Run `pnpm install` in `app/renderer`

### Create Theme Configuration

- Create `app/renderer/src/ui/theme.ts`
- Configure Mantine theme with dark color scheme
- Map spacing, radius, shadows to align with Mantine conventions
- Set font family to match existing (Inter)

### Wrap App with MantineProvider

- Modify `app/renderer/src/main.tsx`
- Import `@mantine/core/styles.css`
- Wrap `<App />` with `<MantineProvider theme={theme} defaultColorScheme="dark">`

## Phase 2: Simple Component Migration

### Migrate Tooltip Component

- Replace `app/renderer/src/ui/components/Tooltip.tsx` with Mantine `Tooltip`
- Update component to use `@mantine/core` Tooltip
- Delete `app/renderer/src/ui/components/Tooltip.css`
- Update all usages across the app

### Migrate StatusBadge Component

- Replace `app/renderer/src/ui/components/StatusBadge.tsx` with Mantine `Badge`
- Map tone variants (neutral, positive, negative) to Mantine color variants
- Update all usages in `App.tsx` and other files
- Remove related CSS from `App.css`

### Migrate Basic Buttons

- Update all `<button>` elements to use Mantine `Button` component
- Apply variant styles (filled, outline, subtle) as appropriate
- Focus on standalone buttons first (ConfirmDialog, ConnectionModal, etc.)

## Phase 3: Form Components Migration

### Migrate Input Fields

- Replace `<input>` elements with Mantine `TextInput`
- Update `ConnectSourceWizard.tsx` form fields
- Update `ConnectionModal.tsx` form fields

### Migrate Select/Dropdown Components

- Replace `<select>` elements with Mantine `Select` component
- Update `ConnectionModal.tsx` table/column selectors
- Update `ConnectSourceWizard.tsx` configuration forms
- Handle data format conversion (Mantine expects `{ value, label }[]`)

### Migrate Textarea Components

- Replace `<textarea>` with Mantine `Textarea`
- Update forms in wizard and modal components

## Phase 4: Modal/Dialog Migration

### Migrate Modal Component

- Replace `app/renderer/src/ui/components/Modal.tsx` with Mantine `Modal`
- Update props interface to match Mantine's API
- Delete `app/renderer/src/ui/components/Modal.css`
- Update all usages (keep compatibility layer if needed)

### Migrate ConfirmDialog

- Replace `app/renderer/src/ui/canvas/ConfirmDialog.tsx` with Mantine `Modal` + custom content
- Delete `app/renderer/src/ui/canvas/ConfirmDialog.css`
- Update all usages throughout canvas components

### Migrate ConnectionModal

- Refactor `app/renderer/src/ui/canvas/ConnectionModal.tsx` to use Mantine components
- Use `Modal`, `Select`, `Stack`, `Group`, `Text`, `Alert` (for warnings)
- Delete `app/renderer/src/ui/canvas/ConnectionModal.css`

## Phase 5: Layout & Container Components

### Migrate Panel/Card Components

- Use Mantine `Paper` and `Card` for panel containers
- Update Inspector panels (`InspectorSourcePanel`, `InspectorTablePanel`, etc.)
- Update Explorer panels (`ExplorerSidebar`, `InspectorPanel`)

### Migrate Layout Containers

- Use Mantine `Stack`, `Group`, `Flex` for layout primitives
- Replace flexbox CSS with Mantine layout components
- Update `ExplorerShell`, `CanvasWorkspace`, `NavigationShell`

### Migrate Context Menus

- Replace custom context menus with Mantine `Menu` component
- Update `TableContextMenu.tsx`, `DataSourceContextMenu.tsx`, `RelationshipContextMenu.tsx`
- Delete associated CSS files

## Phase 6: Navigation & Status Components

### Migrate Breadcrumbs

- Replace `CanvasBreadcrumbs.tsx` with Mantine `Breadcrumbs`
- Delete `CanvasBreadcrumbs.css`

### Migrate Status Components

- Update `GlobalStatusBar.tsx` to use Mantine `Indicator`, `Badge`, `Group`
- Update `StatusDrawer.tsx` to use Mantine `Drawer` component
- Delete associated CSS files

### Migrate Navigation

- Update `NavigationShell.tsx` to use Mantine `Tabs` or `NavLink`
- Delete `NavigationShell.css`

## Phase 7: Specialized Components

### Update ReactFlow Integration

- Preserve custom ReactFlow node styling where needed
- Use Mantine components within custom nodes (DataSourceNode, TableBlock)
- Ensure Mantine styles don't conflict with ReactFlow

### Migrate Wizard Component

- Update `ConnectSourceWizard.tsx` and `CanvasConnectWizard.tsx`
- Use Mantine `Stepper`, `Stack`, `Button`, `TextInput`, `Select`
- Delete wizard CSS files

### Migrate Floating UI Elements

- Update `FloatingPlusButton.tsx` to use Mantine `ActionIcon` or `Button`
- Update `ZoomControls.tsx` to use Mantine `ActionIcon` group
- Update `CanvasMiniMap.tsx` styling to use Mantine `Paper`

## Phase 8: CSS Cleanup & Organization

### Delete Obsolete CSS Files

- Remove all component-specific CSS files that have been replaced
- Keep only: `global.css` (for body, html, scrollbar customization)
- Update `global.css` to work harmoniously with Mantine styles

### Verify CSS Variable Usage

- Ensure any remaining custom CSS works with Mantine
- Remove duplicate/conflicting styles
- Keep special effects (glassmorphism, gradients) if still desired

## Phase 9: Testing & Polish

### Component Testing

- Test all forms (ConnectSourceWizard, ConnectionModal)
- Test all modals and dialogs
- Test context menus
- Test navigation and routing

### Visual Testing

- Verify dark theme consistency across all components
- Check responsive behavior
- Verify accessibility (focus states, keyboard navigation)

### Performance Check

- Verify bundle size impact
- Check for any performance regressions
- Ensure Electron app still performs well

### Bug Fixes

- Address any visual inconsistencies
- Fix any broken interactions
- Resolve TypeScript errors
- Fix linter issues

### To-dos

- [ ] Install Mantine packages and configure MantineProvider
- [ ] Create Mantine theme configuration with dark color scheme
- [ ] Replace Tooltip component with Mantine Tooltip
- [ ] Replace StatusBadge with Mantine Badge
- [ ] Replace button elements with Mantine Button component
- [ ] Replace input elements with Mantine TextInput
- [ ] Replace select elements with Mantine Select
- [ ] Replace Modal component with Mantine Modal
- [ ] Replace ConfirmDialog with Mantine Modal
- [ ] Refactor ConnectionModal to use Mantine components
- [ ] Update panel components to use Mantine Paper/Card
- [ ] Replace layout CSS with Mantine Stack/Group/Flex
- [ ] Replace context menus with Mantine Menu component
- [ ] Replace breadcrumbs with Mantine Breadcrumbs
- [ ] Update status bar and drawer with Mantine components
- [ ] Update navigation shell with Mantine Tabs/NavLink
- [ ] Integrate Mantine components into ReactFlow nodes
- [ ] Update wizard components with Mantine Stepper
- [ ] Update floating buttons and controls with Mantine components
- [ ] Delete obsolete CSS files and organize remaining styles
- [ ] Test all components and fix visual/interaction issues