# Xperts Camps — design handoff for Claude Code

This folder is the complete UI redesign of **Xperts Camps** (Next.js + Tailwind v4 + shadcn/ui base-nova + lucide + motion + TanStack Table).
Implement it **1:1** in the existing app. Keep every existing feature, field and action; this is a visual/layout redesign only.

## What's here
- `screens/*.png` — **rendered screenshot of every artboard** (desktop at 1440 px, mobile at 390 px @2x). This is the visual source of truth; open these first.
- `static/*.html` — the same screens as plain, self-contained HTML (no runtime, no build step). Open any file directly in a browser; inspect it with DevTools to read exact sizes, spacing and colours. Links between screens work.
- `globals.tokens.css` — all colour tokens (light `:root`, dark `.dark`) mapped to shadcn variables + custom status tokens + `@theme inline` mapping. Paste into `app/globals.css`, replacing the current theme variables.
- `design/*.dc.html` — the editable design-tool source for each artboard (needs the design tool's viewer to render; use `static/` to view). Each is HTML where **markup + inline styles are the spec** (exact px sizes, radii, gaps, colours as `var(--token)`). Sample data lives in the `renderVals()` script at the bottom of each file. Ignore the `<x-dc>`, `<sc-for>`, `<sc-if>`, `<dc-import>` wrappers — they are the design tool's templating (loop / conditional / child component).
- `design/canvas.json` — artboard list and titles.
- `public/xperts-logo.jpg` — logo (content box is x 8–196, y 73–130 of the 200×200 image; crop it as the sidebar/login do).

## Foundations
- Fonts: **Plus Jakarta Sans** (400–800) for UI, **JetBrains Mono** for Emp No, phones, IDs, timestamps (`next/font/google`).
- Radius `--radius: 0.625rem`; inputs/buttons 8px, cards 14–16px, bed tiles 8px, badges full.
- Spacing on 4px. Page padding 28px 32px desktop, 16px mobile. Cards padding 20px.
- Shadows: `--shadow-sm` cards, `--shadow-md` popovers/menus, `--shadow-lg` dialogs/drawer.
- Icons: lucide, stroke 1.75; 16px in tables/buttons, 18px nav, 20px headers. Leave = `Plane`, Returned = `House`, Exit = `UserX`, Move = `ArrowRightLeft`, Invalidate = `Ban`, Bed = `Bed`.
- Orange (`--brand`) is ONLY for the sidebar active marker, logo and small highlights — never for statuses.
- Motion (motion/react): ease `[0.2,0.8,0.2,1]`; micro 120ms, fade-in 320ms with 40ms stagger (max 8), drawer 280ms slide, occupancy bars grow scaleX 600ms, sidebar active indicator uses `layoutId`. Respect `useReducedMotion` (opacity only).

## Semantic colours (use the tokens, never raw hex)
| Meaning | bg | border | text | solid (bars/dots) |
|---|---|---|---|---|
| Bed Occupied | `--status-occupied-bg` | `--status-occupied-border` | `--status-occupied-fg` | `--status-occupied` |
| Bed Held (on leave) | `--status-held-bg` | `--status-held-border` | `--status-held-fg` | `--status-held` |
| Bed Vacant | `--status-vacant-bg` | `--status-vacant-border` | `--status-vacant-fg` | `--status-vacant` |
| Bed Invalidated | `--status-invalid-bg` | **dashed** `--status-invalid-border` | `--status-invalid-fg`, label struck through | — |
| Worker row: occupied / on leave / no bed / exited | `--card` / `--row-leave` / `--row-nobed` / `--row-exited` (+ muted text) | | | |
| Over capacity | `--warning-bg` | `--warning-border` | `--warning-fg` | `--warning` |

Worker status badges: Occupied → occupied colours; On leave → vacant (green) colours; No bed → warning colours; Exited → muted.

## Artboard → route map
| Artboard | Route / component |
|---|---|
| `Main.dc.html` | Design system reference (tokens, type scale, motion) |
| `Components.dc.html` | Component sheet: Button variants, Badge variants, inputs, BedTile (4 states × 4 types + hover/focus/selected/disabled), RoomCard, CampCard, KpiCard, OccupancyBar, tinted DataTable, FilterBar, Timeline, Toast |
| `Sidebar.dc.html` / `Topbar.dc.html` | App shell (`AppSidebar`, `AppTopbar`). Sidebar 248px navy, grouped Main / Administration, items filtered by permission (`supervisor` tweak shows the reduced version). Top bar: breadcrumb, global search placeholder (⌘K), user name + role, Sign out |
| `Login.dc.html` | `/login` (shown in error state) |
| `Dashboard.dc.html` (+`DashboardDark`) | `/` |
| `Workers.dc.html` (+`WorkersDark`) | `/workers` |
| `WorkerDialogs.dc.html` | Start leave / Mark returned / Exit worker dialogs |
| `WorkerDetail.dc.html` | `/workers/[id]` |
| `WorkerForm.dc.html` | `/workers/new`, `/workers/[id]/edit` (shown with validation errors) |
| `Camps.dc.html` | `/camps` |
| `CampDetail.dc.html` (+`CampDetailDark`) | `/camps/[id]` — includes the reserved Camp explorer hero area and an open room "…" menu |
| `BedDrawer.dc.html` / `BedDrawerVacant.dc.html` | Bed Sheet (480px right drawer): held-bed and vacant-bed variants |
| `BedPicker.dc.html` | Assign / move bed dialog |
| `CampDialogs.dc.html` | New camp, Add room, Add beds, Reorder beds (drag state), Invalidate (reason required), Edit room |
| `Users.dc.html` | `/admin/users` |
| `Roles.dc.html` | `/admin/roles` |
| `RoleEditor.dc.html` | Role editor (permission matrix), New user, Set password, Deactivate, Add custom field dialogs |
| `Fields.dc.html` | `/admin/fields` |
| `Reports.dc.html` | `/reports` |
| `Audit.dc.html` | `/admin/audit` |
| `States.dc.html` | Skeletons, empty states, error, permission-denied banner, disabled-with-tooltip, toasts (Sonner bottom-right) |
| `Mobile*.dc.html` | 390px: dashboard, workers as cards, camp detail (3-col bed grid), bed bottom sheet, nav drawer (dark) |

## Rules to preserve
- Nothing is deleted: "Remove" = Invalidate with a required reason; invalidated items stay visible, greyed, dashed, with who/when/why.
- Leave never frees a bed — show "Held · on leave" everywhere leave appears.
- Disabled consequential actions always get a tooltip explaining why (e.g. "7 beds in use — move or exit first").
- Mobile: sidebar → Sheet drawer; tables → cards; hit targets ≥ 44px; bed drawer → bottom sheet.
- Every screen must work in `.dark` using the same tokens.

## Suggested implementation order
1. Tokens + fonts → 2. shell (sidebar/topbar) → 3. shared components from `Components.dc.html` → 4. Camp detail + bed drawer + bed picker → 5. Workers + dialogs → 6. remaining screens → 7. states + motion → 8. mobile pass.
