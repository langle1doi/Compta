<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Agent workflow for frontend work

Before writing or changing any frontend code, every agent MUST:

1. Read this `AGENTS.md`, especially `COMPTE Frontend Responsive Rules` below.
2. Read any applicable `.cursor/rules/*.mdc` (at minimum `.cursor/rules/compte-responsive.mdc`).
3. Inspect the current responsive implementation of the area being changed.
4. Implement without breaking existing viewport behavior.
5. Run responsive visual QA before reporting completion.

Every final implementation report MUST contain:

```
Responsive rules read: YES / NO
```

If the answer is NO, the task is not complete.

# COMPTE Frontend Responsive Rules

These rules are mandatory for every frontend change in this repository.

## 1. Responsive is a requirement, not a follow-up task

Every new page, component, table, form, dialog, card, chart, navigation item,
and dashboard section MUST be implemented responsively in the same task.

A frontend task is NOT complete if it only works on the developer's current
desktop resolution.

Do not leave responsive work for a later task unless explicitly requested.

## 2. Required viewport validation

Every UI change must be checked at minimum at:

- 1920 x 1080
- 1600 x 900
- 1440 x 900
- 1366 x 768
- 1280 x 800
- 1024 x 768
- 768 x 1024
- 390 x 844

A component does not need to look identical at all sizes.

It must remain:
- usable
- readable
- navigable
- visually balanced
- free from unintended overflow

## 3. Never use CSS scaling for responsive layouts

Never solve responsive problems using:

- `transform: scale(...)`
- `zoom`
- Tailwind `scale-*`
- browser zoom assumptions

Responsive behavior must be achieved using:

- CSS Grid
- Flexbox
- minmax()
- min-width / max-width
- responsive padding
- responsive gap
- responsive typography
- wrapping
- stacking
- scroll containers
- breakpoint-specific visibility

## 4. No horizontal page overflow

The document/body must never receive accidental horizontal scrolling.

Use:

- `min-w-0` on flex/grid children
- `max-w-full`
- proper width constraints
- `overflow-x-auto` only on components that actually need horizontal scrolling

Tables may scroll horizontally inside their own containers.

The entire page must not.

## 5. App Shell responsive contract

Desktop:

SIDEBAR = stationary
TOPBAR = stationary
MAIN = scrollable

Recommended architecture:

```
AppShell
├── Sidebar
└── RightColumn
    ├── Topbar
    └── MainScrollArea
```

The root application should use a viewport-bounded layout such as:

`h-screen overflow-hidden`

The main content area should use:

`min-h-0 min-w-0 flex-1 overflow-y-auto`

Do not allow the browser body to become the primary dashboard scroll container
on desktop.

## 6. Sidebar responsive behavior

Desktop >= 1280px:
- full sidebar visible
- current desktop width preserved
- sidebar does not scroll with main content

1024–1279px:
- use compact sidebar or project-approved intermediate behavior
- do not shrink text/components until unreadable

Below 1024px:
- sidebar becomes drawer/sheet
- open using hamburger/menu button
- must not permanently consume screen width

Mobile:
- sidebar is off-canvas
- overlay when opened
- keyboard accessible
- ESC closes
- focus management preserved

Do not solve small screens by scaling down the entire sidebar.

## 7. Topbar responsive behavior

Desktop:
- keep current desktop design
- stationary while main content scrolls

Tablet:
- search may reduce width
- secondary controls may collapse
- buttons may switch to icon + tooltip where appropriate

Mobile:
- retain essential actions
- allow non-critical controls to move to overflow menu/dropdown
- avoid multi-line broken headers

Primary CTA must remain discoverable.

## 8. Dashboard grid contract

Do not use fixed desktop pixel layouts that cannot reflow.

Use Grid/Flex with:

`minmax(0, 1fr)`

where appropriate.

Wide desktop:
preserve approved COMPTE dashboard composition.

Large desktop:
same visual hierarchy with slightly reduced gaps.

Tablet:
2-column areas may become 1 column when content becomes cramped.

Mobile:
stack cards vertically.

Do NOT shrink a complex 2-column dashboard to fit mobile.

Reflow it.

## 9. Dashboard source-of-truth hierarchy

Maintain this information priority:

1. Hero / critical operational summary
2. Main financial summary / receivables
3. KPI
4. Revenue / business health
5. Receivables / payments / annual target
6. Recent quotes / pipeline
7. Needs attention / invoices
8. Activity

Responsive reflow must preserve this hierarchy.

## 10. Card responsive contract

Cards must use:

- `min-w-0`
- responsive padding
- responsive gap
- bounded internal lists where appropriate

Do not allow content length to expand dashboard cards indefinitely.

Scrollable business lists should keep bounded card dimensions on desktop/tablet.

On narrow mobile layouts, card height may become natural if that creates better UX,
but do not render dozens of records without pagination/collapse/scroll strategy.

## 11. Long content

Long customer/company/document names must never break layout.

Use:

- `min-w-0`
- `truncate`
- `text-overflow: ellipsis`
- `whitespace-nowrap`

where appropriate.

Provide full text with tooltip/title where loss of content matters.

Do not let one customer name determine the width of an entire table.

## 12. Tables

Desktop:
- preserve readable columns
- sticky table header where currently implemented
- internal vertical scroll for dashboard tables

Narrow viewport:
- use horizontal scrolling inside table container
- do not compress all columns until unreadable
- use reasonable table `min-width`

Never create page-level horizontal scrolling because of a table.

Do not hide important financial values just to avoid horizontal scroll.

## 13. Charts

Charts must use responsive containers.

Never use a hard-coded canvas width tied to one viewport.

Charts must:
- fit their parent
- keep readable labels
- reduce non-essential axis detail on small screens if necessary
- never overflow cards

Do not make charts tiny by scaling the complete card.

## 14. Typography

Desktop typography already approved should remain visually consistent.

Use responsive type sizing only where necessary.

Do not globally shrink fonts to fix layout.

Minimum readable body text should generally remain around 12–14px depending on context.

Do not use 8–9px text for important business information on small screens.

## 15. Spacing

Desktop visual density is approved.

Use breakpoint-based adjustments.

Example direction:

Wide desktop:
24px page padding

Desktop:
20px

Tablet:
16px

Mobile:
12–16px

Reduce gaps progressively.

Do not remove all whitespace on small screens.

## 16. Soft UI / Neumorphism

Current COMPTE visual identity must be preserved.

Responsive work must not remove:

- soft surfaces
- subtle dual shadows
- translucent light cards
- background imagery
- semantic status colors

However, shadows/effects may be reduced on small screens if they hurt clarity or performance.

Do not create different design systems per breakpoint.

## 17. Background images

Sidebar and main content backgrounds must:

- use `cover` / appropriate sizing
- not create horizontal overflow
- not make text unreadable
- remain subtle
- preserve contrast

Avoid fixed background behavior on mobile if it causes browser rendering issues.

Desktop may use fixed attachment if already approved.

Mobile should prefer normal scroll attachment.

## 18. Scroll architecture

There are two valid scroll levels:

1. Main application content scroll
2. Internal list/table scroll

Avoid unnecessary nested scroll containers.

Desktop:
- Sidebar stationary
- Topbar stationary
- Main scrolls
- long dashboard lists may scroll internally

Mobile:
prioritize natural document scrolling unless an internal scroll region is clearly useful.

## 19. Touch targets

Interactive controls must remain usable on touch devices.

On tablet/mobile, interactive targets should normally be at least around 40–44px
where appropriate.

Do not keep tiny desktop icon targets on mobile.

## 20. Hover is enhancement only

Do not make features depend on hover.

Every action available through hover must remain usable through:

- click/tap
- focus
- visible controls

Tooltips may supplement information but cannot be the only way to perform an action.

## 21. Navigation and accessibility

Responsive navigation must support:

- keyboard navigation
- focus-visible states
- semantic buttons/links
- aria labels for icon-only buttons
- ESC close for mobile drawers/dialogs

Do not create clickable `<div>` elements.

## 22. Motion

Responsive design must respect:

`prefers-reduced-motion`

Do not introduce motion that causes layout shift.

Animations should primarily use:

- transform
- opacity

Do not use animation to compensate for broken responsive layout.

### Animated Selection

Navigation, tabs, and segmented filters SHOULD reuse the COMPTE
animated active-selection pattern where a moving active surface
improves continuity.

Use a shared moving indicator rather than independent active
backgrounds.

Animation must be subtle, accessible, responsive, and respect
prefers-reduced-motion.

Do not introduce a different active-selection animation per feature.

Shared pieces live in `src/components/compte/animated-selection.tsx`
with motion tokens in `src/lib/motion.ts`. Use unique `layoutId`s per
selection group (sidebar, top tabs, quote filters).

## 23. No duplicated mobile page

Do not create a separate duplicate implementation such as:

DesktopDashboard.tsx
MobileDashboard.tsx

unless architecture absolutely requires it.

Prefer one component tree with responsive composition.

Avoid business logic duplication.

## 24. Breakpoint philosophy

Use content-driven responsive decisions, not device-name assumptions.

Suggested project breakpoints:

< 640px
Mobile

640–767px
Large mobile

768–1023px
Tablet

1024–1279px
Compact desktop / tablet landscape

1280–1535px
Desktop

>= 1536px
Wide desktop

Use Tailwind breakpoints consistently.

If project Tailwind breakpoints already exist, use them rather than creating conflicting ones.

## 25. Definition of Done

A frontend task is not complete until:

- no unintended horizontal page overflow
- content remains readable
- controls remain usable
- navigation works
- tables are handled correctly
- long text is handled
- scroll behavior is correct
- tested at required representative viewports
- TypeScript passes
- lint passes
- production build passes

Always include responsive validation in the final implementation report.

## 26. Current COMPTE implementation contract

Reuse these building blocks instead of inventing new ones:

- Breakpoints: Tailwind v4 defaults (`sm` 640, `md` 768, `lg` 1024, `xl` 1280, `2xl` 1536). No custom breakpoints.
- Navigation drawer: `src/components/shell/nav-drawer.tsx` (`NavDrawerProvider`, `NavDrawer`, `NavDrawerTrigger`, `NavDrawerSearch`).
  The same `<aside>` is a static rail above its breakpoint and an off-canvas dialog below it
  (Esc closes, focus is trapped and returned to the trigger, links close the drawer).
  Dashboard shell (`src/app/[locale]/page.tsx`) uses `breakpoint="xl"`; `WorkspaceChrome` uses `breakpoint="lg"`.
- Header search: `CommandSearchTrigger` (full field, `xl+`), `CommandSearchIconTrigger` (icon, 480px–1279px), `NavDrawerSearch` (inside the drawer below 480px).
- Dashboard grids: `.dashboard-grid-hero`, `.dashboard-grid-2` (`--kpi`: 4 columns from `xl`), `.dashboard-grid-main`, `.dashboard-grid-3` (2 columns from `md`, 3 from `xl`), `.dashboard-grid-half` in `src/app/globals.css`.
- Page padding: `.dashboard-page` (12px mobile, 16px from `md`, 20px from 1440px, 24px from 1600px; 1280–1439px is 16px).
- Lists: `.dashboard-list__*` contract and `DashboardScroll` for bounded internal scroll; tables scroll horizontally inside `DashboardScroll` with a `min-w-[...]` table.
- Mobile (< 768px): lighter `--shadow-surface` / `--shadow-kpi` and a type floor (8/9/10px utilities render as 10/11/12px inside `.dashboard-page`).
  New small text should prefer readable sizes directly instead of relying on this floor.
- Visual QA helper: `node .layout-check/qa.mjs <label> [route] [WxH ...]` writes full-page screenshots and an overflow audit for the required viewports (dev server on `localhost:3000`).
