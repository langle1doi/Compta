---
name: COMPTE
description: The intelligent operating system for quotes, invoices, and cash.
colors:
  globe: "#044ce2"
  wordmark: "#063586"
  globe-soft: "#e7efff"
  globe-wash: "#f2f6ff"
  globe-line: "#d7e4ff"
  globe-border: "#b9d0fb"
  canvas: "#f2f6fd"
  surface: "#ffffff"
  line: "#e1e7f1"
  frame: "#e0e6ef"
  field-border: "#dfe6f1"
  field-fill: "#f7f9fd"
  muted: "#66758d"
  quiet: "#7b8798"
  control: "#405069"
  nav-hover: "#f5f7fb"
  nav-ink: "#24334c"
  on-navy: "#c4cee0"
  status-draft: "#314158"
  status-draft-bg: "#eef2f7"
  status-sent: "#0436a3"
  status-sent-bg: "#e7efff"
  status-review: "#7a430c"
  status-review-bg: "#fff4e6"
  status-accepted: "#0d6848"
  status-accepted-bg: "#e7f6ee"
  status-rejected: "#8e2a26"
  status-rejected-bg: "#fdeceb"
  alert: "#e9764f"
  dashboard-success: "#238567"
  dashboard-success-bg: "#e8f7f0"
  dashboard-warning: "#b96d24"
  dashboard-warning-bg: "#fff4e6"
  dashboard-danger: "#c9564f"
  dashboard-danger-bg: "#fff0ed"
  dashboard-notice: "#7b61c8"
  dashboard-notice-bg: "#f2edff"
typography:
  display:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "38px"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "26px"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.025em"
  metric:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "26px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.03em"
    fontVariantNumeric: "tabular-nums"
  money:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "-0.02em"
    fontVariantNumeric: "tabular-nums"
  title:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "normal"
  eyebrow:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "11px"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "0.12em"
rounded:
  badge: "7px"
  control: "10px"
  field: "12px"
  tile: "11px"
  card: "15px"
  panel: "18px"
  pill: "999px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "20px"
  xl: "24px"
motion:
  button: "80–120ms"
  dropdown: "100–160ms"
  table: "120–180ms"
  bulk-toolbar: "160–180ms"
  side-panel: "180–220ms"
  modal: "160–220ms"
components:
  button-primary:
    backgroundColor: "{colors.globe}"
    textColor: "{colors.surface}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "40px"
  button-primary-hover:
    backgroundColor: "{colors.wordmark}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
    height: "40px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.control}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "40px"
  button-secondary-hover:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.control}"
    rounded: "{rounded.control}"
    height: "40px"
  button-inverse:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.wordmark}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "44px"
  chip-filter:
    textColor: "{colors.globe}"
    backgroundColor: "{colors.globe-soft}"
    typography: "{typography.label}"
    rounded: "{rounded.badge}"
    padding: "0 8px"
    height: "28px"
  nav-item:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.muted}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "44px"
  nav-item-active:
    backgroundColor: "{colors.globe-soft}"
    textColor: "{colors.globe}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "44px"
  nav-item-hover:
    backgroundColor: "{colors.nav-hover}"
    textColor: "{colors.nav-ink}"
    rounded: "{rounded.control}"
    height: "44px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.wordmark}"
    rounded: "{rounded.card}"
    padding: "20px"
  hero:
    backgroundColor: "{colors.wordmark}"
    textColor: "{colors.surface}"
    rounded: "{rounded.panel}"
    padding: "24px"
  field:
    backgroundColor: "{colors.field-fill}"
    textColor: "{colors.wordmark}"
    typography: "{typography.body}"
    rounded: "{rounded.field}"
    padding: "8px 12px"
    height: "40px"
  ledger-row-hover:
    backgroundColor: "#f7faff"
  ledger-row-selected:
    backgroundColor: "#eaf1ff"
  ledger-row-active:
    backgroundColor: "#e7efff"
---

# Design System: COMPTE

This file is the only design-system source of truth. Shared primitives come first. The Quotes register (`/devis`) is the reference screen that proves them. Dashboard is frozen in this phase.

## Overview

**Creative North Star: The Operating Desk + Premium SaaS Experience**

COMPTE is the intelligent operating system for quotes, invoices, and cash. The desk stays dense and quiet so an operator can scan money and take the next step. White surfaces sit on a cool canvas. The only brand colors are the two colors in the COMPTE mark: the globe and the wordmark.

The product is operational, fast, calm, trustworthy, premium, modern, and highly usable. It is also marketing-quality: a working screen should be polished enough to screenshot for the website, a demo, a sales deck, Product Hunt, or an investor review. Marketing quality does not turn an operational screen into a landing page.

> Beautiful enough to market. Fast enough to operate every day.

The mark itself is the logo. Use `public/logo.svg` for the full lockup and the cropped globe in `src/app/icon.svg` for the favicon. Do not redraw the wordmark as live text beside a letter tile.

**Key characteristics**

- Two brand colors from the logo, plus a cool neutral canvas.
- Operational collections are ledgers, not card grids.
- Money uses tabular numerals and a stronger weight than metadata.
- Status is label + semantic color + optional icon, never color alone.
- Compact controls, hairline separators, and soft shadows only on chrome and dashboard cards.
- Motion explains a state change. It does not decorate a page load.

## Colors

The palette is the COMPTE logo, the neutrals that keep the desk readable, and semantic status pairs that pass WCAG AA at the real text size.

### Brand

- **Globe Blue** (`{colors.globe}` — `#044CE2`): Action, selection, links, the active navigation item, and the current place.
- **Wordmark Navy** (`{colors.wordmark}` — `#063586`): Typography, money, metrics, primary-button hover, and large brand fills such as the priority hero.

There is no third brand blue. Do not bring back periwinkle `#315ce9`.

- **Globe Soft** (`{colors.globe-soft}`): Selected navigation and selected filter chips.
- **Globe Wash** (`{colors.globe-wash}`): Quiet brand panels, such as the company switcher.
- **Globe Line** (`{colors.globe-line}`): Hairline around wash panels.
- **Globe Border** (`{colors.globe-border}`): Hover border on fields and secondary controls.

### Neutral

- **Ledger Canvas** (`{colors.canvas}`): Page background.
- **Paper** (`{colors.surface}`): Working surfaces, header, sidebar, and inverse buttons.
- **Hairline** (`{colors.line}`): Ledger separators and card rings.
- **Frame** (`{colors.frame}`): Sidebar and header dividers.
- **Field Border** (`{colors.field-border}`): Fields and secondary controls at rest.
- **Field Fill** (`{colors.field-fill}`): Field background.
- **Muted** (`{colors.muted}`): Idle navigation labels.
- **Quiet** (`{colors.quiet}`): Metadata, placeholders, and dates.
- **Control Ink** (`{colors.control}`): Secondary labels and idle icons.
- **Nav Hover** (`{colors.nav-hover}`): Idle navigation hover fill.
- **Nav Ink** (`{colors.nav-ink}`): Idle navigation hover text.
- **On Navy** (`{colors.on-navy}`): Supporting copy on wordmark fills.

### Document status

These pairs are the status system for new operational screens. Each pair is label + color + optional icon, and each foreground/background pair meets WCAG AA at 12px medium text. Expired shares the draft colors and is distinguished by its icon.

| Status | Foreground | Background | Icon role |
| --- | --- | --- | --- |
| Draft | `{colors.status-draft}` | `{colors.status-draft-bg}` | Edit |
| Envoyé | `{colors.status-sent}` | `{colors.status-sent-bg}` | Send |
| À approuver | `{colors.status-review}` | `{colors.status-review-bg}` | Review |
| Accepté | `{colors.status-accepted}` | `{colors.status-accepted-bg}` | Confirm |
| Refusé | `{colors.status-rejected}` | `{colors.status-rejected-bg}` | Decline |
| Expiré | `{colors.status-draft}` | `{colors.status-draft-bg}` | Time |

Invoice status uses the same foundation later: Draft, Validated, Partial, Paid, Overdue, Credited. Map those states onto the same semantic pairs. Do not invent a second status language.

**The Semantic Status Rule.** Color reports a semantic state. It is not decoration, and it is never the only signal.

**The Logo Pair Rule.** Globe blue and wordmark navy are the only brand colors.

**The Action Rule.** Globe blue marks an action, a link, or the current place. Wordmark navy carries text, money, and large brand fields. Do not fill a content region with globe blue.

Dashboard chips still use the frozen pairs `dashboard-success`, `dashboard-warning`, `dashboard-danger`, and `dashboard-notice`. Do not restyle them in this phase. New ledgers use the document-status pairs above. **Alert Dot** (`{colors.alert}`) is the notification pip only.

## Typography

**Face:** Segoe UI, then Arial, Helvetica, sans-serif. One utilitarian sans. No display serif and no loaded webfont inside the workspace.

**The One Face Rule.** Do not add a second type family for marketing emphasis inside the workspace.

### Hierarchy

Weight is a signal. Not every line is semibold.

1. **Money / key financial result** — semibold, wordmark navy, `tabular-nums`.
2. **Primary entity** — quote number, customer, invoice number.
3. **Status / next action** — medium or semibold only when the record needs attention.
4. **Metadata** — regular weight, quiet color: work label, owner, dates.

- **Display** (600, 38px, tracking -0.035em): Hero statement on the navy panel. 30px below the small breakpoint.
- **Headline** (600, 26px, tracking -0.025em): Page title. 22px below the small breakpoint.
- **Metric** (600, 26px, tracking -0.03em, tabular numerals): KPI values. The open-pipeline total may use 28px.
- **Money** (600, 14px, tracking -0.02em, tabular numerals): Amounts inside a ledger. Stronger than the column label, never a display heading. Format: `12 840,00 €` (space as the thousands separator, comma as the decimal, euro suffix).
- **Title** (600, 16px): Section headings.
- **Body** (400, 14px): Controls, table cells, navigation.
- **Label** (500, 12px): Status, chips, column headers, meta.
- **Eyebrow** (700, 11px, tracking 0.12em): Sidebar group labels, in muted gray.

**The Financial Scan Rule.** A financial column must be scannable vertically and horizontally. Amounts share one alignment, one weight, and one currency format. Right-align money. Do not put an amount in a badge.

## Layout

Desktop is the primary experience. The desk is a fixed sidebar and one scrolling work column. From the large breakpoint the sidebar is 268px, with 16px outer padding and the logo inset by 12px. The header is sticky, at least 76px, with a hairline and a light blur. Dashboard content stays centered to a maximum of 1540px. Operational registers use the full work column; the ledger is the page.

Below the large breakpoint the sidebar is hidden. The header shows a menu button and the logo at 32px. Search in the header appears from the medium breakpoint.

Spacing rhythm is 8, 12, 16, 20, and 24px.

**The Desk Rule.** Keep the sidebar, the sticky header, and one work column. Do not turn the workspace into a centered marketing column.

**The Operating Ledger Rule.** An operational collection is a ledger. Do not turn it into a card grid when a table can carry the scan.

## Elevation

Dashboard cards may keep their resting shadow and a small hover lift. That behavior is frozen with the Dashboard and is not the ledger pattern.

Ledger rows do not lift and do not cast a shadow. Depth in a register comes from the paper surface, a 1px separator, and a quiet background change.

- **Resting dashboard card:** `0 14px 45px rgb(29 43 68 / 0.07)`.
- **Header:** `0 8px 30px rgb(24 36 58 / 0.05)`.
- **Primary action:** `0 10px 24px rgb(4 76 226 / 0.22)`.
- **Hero:** `0 22px 60px rgb(6 53 134 / 0.18)`.
- **Ledger row hover:** `{components.ledger-row-hover}` only.
- **Ledger row selected:** `{components.ledger-row-selected}`.
- **Ledger row active (preview):** `{components.ledger-row-active}`.

## Shapes

Controls, navigation rows, and icon buttons use a 10px radius. Fields are 12px. Status chips are 7px. Dashboard cards are 15px. The hero and the largest panels are 18px. Icon tiles are 11px. Dividers inside a ledger are 1px horizontal separators, not a grid of vertical rules.

**The Shared Corner Rule.** A control the user can press uses the 10px radius. Do not mix pill buttons into the desk.

## Motion

Motion explains a state change, keeps spatial context, opens or closes contextual UI, or confirms an action. It is not decoration.

| Interaction | Duration |
| --- | --- |
| Button | 80–120ms |
| Dropdown, tooltip | 100–160ms |
| Table or other state change | 120–180ms |
| Bulk toolbar | 160–180ms |
| Side panel | 180–220ms |
| Modal, command palette | 160–220ms |

Operational screens do not play a page entrance. Do not use scroll reveal, parallax, a stagger across the table, bounce, elastic easing, or a per-card animation when a route loads.

Use CSS transitions when they can express the change. Use GSAP only when the interaction needs sequencing that a CSS transition cannot carry cleanly.

**The Motion With Purpose Rule.** If the animation does not explain state or spatial relationship, remove it.

### Reduced motion

Honor `prefers-reduced-motion: reduce`.

- Remove translate, scale, blur, and decorative animation.
- State changes are nearly instant.
- Opacity may remain when it is required to show or hide a layer.

## DataTable / Operational Ledger

The table is the core primitive. A list of quotes, invoices, payments, or similar records is a full-width working surface, not a stack of cards.

- Sticky header.
- Very light horizontal separators.
- Almost no vertical borders.
- No card-per-row treatment.
- No shadow on a row.
- Hover changes the background only.
- Selected and preview states are clear and not loud.
- One sticky toolbar above the rows.
- Amounts set for vertical scanning.

A DataTable supports sorting, search, filtering, filter chips, Saved Views, column visibility, density, a sticky header, pagination, row selection, multi-selection, bulk actions, keyboard navigation, contextual actions, export, a true empty state, a filtered-empty state, a loading state, and an error state.

Density changes row padding. Compact is tighter than comfortable. It does not change the column set by itself.

Long text truncates with an ellipsis inside the cell. The column count stays. Do not grow the table until the page scrolls horizontally.

## Saved Views

A Saved View stores the working set:

- filters
- sort
- visible columns
- column order, when the table supports it
- density, when that choice belongs to the view

Quote defaults:

- Tous les devis
- Mes devis
- À approuver
- À relancer
- Expirent bientôt

The user can save the current combination as a custom view. The same primitive serves customers, invoices, payments, and reconciliation. Only the default views change.

## Filter Bar

Desktop toolbar order:

1. Search
2. Saved View
3. Filters
4. Primary action (Nouveau devis, and the equivalent on later screens)

Secondary utilities — Columns, Density, Export — sit in an overflow menu when the row is tight. On a wide desktop they may stay as one compact overflow control so the primary row stays light.

Active filters render as removable chips under the toolbar. The current view name plus those chips must explain the rows on screen.

**The Visible Filter Rule.** No hidden filter may remove records without telling the user why.

On small screens, Filters open in a sheet. The sheet is the same filter set, not a second filter model.

## Bulk Action Toolbar

When one or more rows are selected, the current toolbar morphs into the bulk toolbar. Do not mount a second bar. The layout must not jump.

Example: `3 sélectionnés · 28 450 € TTC`

Actions: Relancer, Exporter, More, Annuler. The summed amount uses the money style. Transition: 160–180ms.

**The One Toolbar Rule.** Selection mode replaces the toolbar. It does not stack on top of it.

Reuse the same morph on Devis, Factures, Contacts, and Payments.

## Status

Status is a component, not a color class copied per screen.

Each status has a text label, a semantic color pair from the document-status table, and an optional icon. Expired and Draft share a palette and use different icons. Do not rely on color alone.

Quote statuses: Draft, Envoyé, À approuver, Accepté, Refusé, Expiré.

Invoice statuses, on the same component: Draft, Validated, Partial, Paid, Overdue, Credited.

## Contextual Next Action

A record may expose one next action: Envoyer, Approuver, Relancer, or Convertir on a quote.

The default treatment is text. Strengthen it only when the record needs attention, such as a follow-up inside the validity window. Do not place a globe-blue button on every row.

**The Contextual Action Rule.** A row action is not a primary button.

The preview panel may show that same action as the single primary button, because the user is already focused on one record.

## Record Preview Panel

On a wide desktop the ledger and the preview exist together. Preview width is 380–440px and may be resizable inside that range. Opening it must not cover or remove the primary money column (Total TTC on quotes).

The preview holds enough to decide the next step without opening the full record. For a quote: number, customer, status, total HT, TVA, total TTC, valid until, owner, recent activity, and the next action.

Keyboard while the list is focused:

- ↑ ↓ move the record
- Enter opens the preview
- Esc closes the preview

Below the wide breakpoint the preview may cover the list as a panel. It still must not be the only way to read Total TTC on desktop.

**The Preview Before Navigate Rule.** If the user only needs to judge a record, open the preview before navigating to the full page.

Reuse the panel for customers, quotes, invoices, and payments. The fields change. The behavior does not.

## Keyboard Interaction

COMPTE is a desktop-first operational product. Keyboard use is first-class on the main lists.

| Key | Quotes list |
| --- | --- |
| ↑ ↓ | Move between records. With the preview open, change the previewed record. |
| x | Select the current row |
| Enter | Open the preview |
| Esc | Close the preview, a menu, or a modal |
| Ctrl/Cmd + K | Open the command palette |

Focus is always visible: a 3px globe ring at 35% opacity, offset 3px. Do not steal a shortcut while the user is typing in a field, except Ctrl/Cmd+K, which stays global.

**The Keyboard First Rule.** A primary operational list must be usable without a pointer.

## Command Palette

Ctrl+K and Cmd+K open one global palette, including from the Dashboard. The Dashboard layout does not change to host it. The existing search control may open the palette. It does not gain a new visual treatment.

Groups: Actions, Clients, Devis, Factures.

Examples: Créer un devis, Créer un client, Ouvrir DEV20260148.

↑ ↓ moves, Enter runs, Esc closes. Duration: 160–220ms. This primitive belongs to the product, not to Quotes.

## Forms

Every field has a designed state. Do not leave error or disabled as undefined.

- **Default:** field fill, field border, 40px, 12px radius.
- **Hover:** paper fill, globe border.
- **Focus:** the shared 3px globe ring.
- **Filled:** wordmark value, quiet label.
- **Required:** visible required marker. The label states the requirement.
- **Optional:** omit the marker. Do not add a second color.
- **Error:** message directly under the field. Border uses the rejected foreground (`{colors.status-rejected}`). No toast for a single-field validation error.
- **Warning:** same placement as an error, using the review palette, only when the value is allowed but risky.
- **Disabled:** muted text, no pointer, no focus ring.
- **Read-only:** paper or canvas fill, wordmark text, no editing affordance.
- **Loading:** the field stays in place. Do not replace the form with a toast.
- **Locked:** visible lock, value readable, not editable.

### Combobox

A searchable combobox supports typed search, keyboard highlight, an empty result, and a create-new row when the user has permission. Create-new is absent when they do not. Selection fills the field. Validation stays inline.

## Quick Create

Frequent creates do not open the full editor first. Nouveau devis asks for Client, Validité, and Responsable. Client is the combobox. Errors sit on the fields. After a successful submit, open the full Quote editor.

The same short-create shape can serve Customer, Invoice, and Product when a full editor would slow the first step. The fields change. The rhythm does not: a few required inputs, inline errors, then the full record.

## Empty States

### True empty

The system has no records.

Example: Aucun devis pour le moment.

Actions: Créer un devis, Importer.

### Filtered empty

Records exist, and the current filters match none.

Example: Aucun devis ne correspond à ces filtres.

Action: Effacer les filtres.

Do not offer Import or an unrelated create action in the filtered-empty state.

Loading is a skeleton of the toolbar and the ledger, inside the same chrome. An error state keeps the chrome and tells the user what failed, with a retry. It does not look like an empty ledger.

## Responsive Data

- **Desktop:** full ledger, all priority columns, preview beside the table on a wide viewport.
- **Tablet:** hide or collapse low-priority columns. Keep the money column and the identifier.
- **Mobile:** do not shrink the desktop table. Use a compact record row: identifier, customer or entity, amount, status, next action. Filters open in a sheet.

Desktop remains the primary design.

## Buttons, chips, cards, navigation, brand

### Buttons

- **Shape:** 10px radius. Standard height 40px. Hero actions on the Dashboard are 44px.
- **Primary:** globe fill, white semibold label, primary-action shadow. Hover fills with wordmark navy. Use a primary button for the screen's main create action and for the single action inside a preview. Not for every table row.
- **Secondary:** white, field border, control ink. Hover shifts the border to globe border.
- **Inverse:** white fill and wordmark text, on the navy hero only.
- **Icon:** 40px square in chrome. Inside a dense ledger row the overflow control may be smaller so the column stays narrow.

### Chips

Filter chips are removable, 7px radius, globe blue on globe soft. They are not status. Status uses the document-status component. Dashboard filter tabs stay as they are: idle gray, selected globe soft.

### Cards

Working dashboard cards are paper, 15px, 20px padding, resting shadow. The hero and the assistant card are wordmark navy at 18px. Ledger screens do not wrap each record in a card.

### Navigation

Rows are 44px, 10px radius, 14px text, 18px icons. Idle text is muted. Hover washes the row. Active is globe soft, globe text, semibold. A count sits in a white chip. Devis links to `/devis`.

### Brand mark

The logo is the supplied vector. Sidebar lockup is 48px tall. Mobile header lockup is 32px tall. The favicon is the globe crop. Leave the artwork's globe blue and wordmark navy intact.

## Quotes Register — `/devis`

This is the reference implementation of the DataTable system. Sidebar Devis goes to `/devis`. The Dashboard layout does not change. The page is a quote register, not a card grid.

### Sticky region

Show the count of quotes in the current result and the Total TTC of that filtered set, using tabular numerals. Then Search, Saved View, Filters, and Nouveau devis. Columns, Density, and Export live in the overflow menu when space is tight.

When the selection is not empty, that same bar morphs into the Bulk Toolbar.

### Columns

Selection, quote number, customer, owner, Total TTC, status, valid until, next action.

Total TTC is the strongest scanning column: right aligned, tabular numerals, semibold, wordmark navy, format `12 840,00 €`. It is not a badge. Owner and valid until are the first columns to collapse on a narrower desktop. Quote number, customer, Total TTC, status, and next action stay as long as the layout is still a table.

### Row

Hover changes the background only. Click opens the preview on the right. Keyboard follows the table in Keyboard Interaction. The next action in the row is text. The preview carries the primary action.

### Quote behavior

Statuses and next actions are the shared components above. Quick create is Client, Validité, Responsable, then the Quote editor. True empty offers create and import. Filtered empty offers clear filters only.

### Motion on this screen

No page entrance. Animate the bulk toolbar, the preview, the command palette, and state changes, inside the duration table.

## After `/devis`

`/devis` is the screen that sets the shared primitives. Once it meets the quality bar, extract and reuse:

- DataTable
- Filter Bar and filter chips
- Saved Views
- Status
- Bulk Toolbar
- Preview Panel
- Form fields and Combobox
- Command Palette
- Empty states

`/factures` does not get a second design system. Invoices reuse the primitives. The hierarchy becomes: invoice number, customer, Total TTC, paid, remaining, due date, payment status, next action. Remaining and Total TTC follow the Financial Scan Rule.

## Dashboard

The Dashboard stays as it is. Do not redesign its layout, hero, KPI row, or cards in this phase. The command palette may be opened from the Dashboard search control without changing that screen's visual hierarchy. Dashboard upgrades are a separate task. Its older status-chip colors and card hover lift are frozen, not the pattern for new ledgers.

## Product Quality Bar

Before a new screen is done, check hierarchy, spacing, alignment, typography, financial scanning, contrast, icon consistency, keyboard navigation, focus, hover, selected state, loading, empty, error, responsive behavior, and reduced motion.

shadcn and Tailwind may be implementation primitives. The result must not look like a generic default admin table. It must look like COMPTE.

Study the feeling, not the chrome: Attio for speed and record interaction, Linear for keyboard and density, Stripe for financial hierarchy, Mercury and Ramp for financial clarity. Do not copy their UI.

**The Marketing Quality Rule.** The interface is polished enough to market, and it does not give up density or speed to get there.

## Do's and Don'ts

### Do

- **Do** use globe blue (`{colors.globe}`) for action and selection, and wordmark navy (`{colors.wordmark}`) for text, money, and large brand fills.
- **Do** set money in tabular numerals, right aligned, in the form `12 840,00 €`.
- **Do** build operational collections as ledgers with one toolbar, removable filter chips, and a preview beside the table on a wide desktop.
- **Do** render status as label, semantic color, and an icon when it helps, at AA contrast.
- **Do** keep row actions as text, and reserve the primary button for the real next step.
- **Do** validate fields inline, and design default, hover, focus, filled, required, error, disabled, read-only, loading, and locked.
- **Do** support ↑ ↓, Enter, Esc, and Ctrl/Cmd+K, and keep a visible focus ring.
- **Do** honor reduced motion by dropping translate, scale, blur, and decorative motion.
- **Do** use `logo.svg` in the sidebar and the smaller lockup in the mobile header.
- **Do** reuse the Quotes primitives for invoices. Change the columns, not the system.
- **Do** leave the Dashboard visually unchanged until its own task.

### Don't

- **Don't** reintroduce periwinkle (`#315ce9`), a third brand blue, or a letter-tile wordmark.
- **Don't** fill a content region with globe blue, or use status color as a brand accent.
- **Don't** turn a ledger into a card grid, a page of primary row buttons, or a centered marketing layout.
- **Don't** lift or shadow a ledger row, or badge an amount.
- **Don't** hide a filter, stack a second toolbar, or cover Total TTC with the preview.
- **Don't** toast a simple field error, or ship a field without an error and disabled state.
- **Don't** play a page entrance, a table stagger, scroll reveal, parallax, bounce, or an elastic animation on an operational screen.
- **Don't** shrink the desktop table into an unreadable mobile grid. Use compact records and a filter sheet.
- **Don't** give Factures a separate visual system.
- **Don't** redesign the Dashboard as part of the ledger work.
