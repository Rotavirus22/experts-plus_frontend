# Prompt for Claude Design — Xperts Camps

> Paste everything below this line into Claude Design, then attach the Xperts logo.

---

I need a complete, professional UI design for **Xperts Camps**, an internal web app for **Xperts Recruitment (UAE)**, a manpower outsourcing company. I have attached our logo: please derive the brand colours, mood and typography pairing from it, and use the logo in the sidebar, login screen and favicon.

The app is already built and working. I want you to redesign every screen listed below so it looks like a polished, modern, trustworthy enterprise product. Keep every feature, field and action described here. You can improve layout, hierarchy, spacing, iconography and micro-interactions, but do not remove functionality.

## 1. Product context

- **Who uses it:** only internal Xperts staff (admins, HR/operations, camp supervisors). Clients never log in.
- **What it does:** Xperts employs workers and outsources them to client companies. Workers live in company **camps** across the UAE emirates. Each camp has **rooms** (room numbers are text like "101", "2B", "G-12", "301 Sup.") and each room has individual **beds** (e.g. B1, B2; types: single, bunk lower, bunk upper). Staff add workers, build camps/rooms/beds, put workers into beds, move them, mark them on leave, and exit them.
- **Key rules the UI must communicate clearly:**
  - Nothing is ever deleted. "Remove" means **Invalidate** (with a reason). Invalidated camps/rooms/beds stay visible, greyed out, with who/when/why.
  - **Leave never frees a bed.** A worker on leave keeps their bed; the bed shows as **Held** and nobody can be put into it.
  - A bed is freed **only** when a worker **exits** (Resigned, Terminated, Absconded, Visa Cancelled, Transferred Out).
  - Every bed has a full history of everyone who has stayed in it.
- **Where it's used:** mostly desktop/laptop in offices (1366–1920 px wide), sometimes tablets/phones by camp supervisors walking the camp. Must work well on mobile (sidebar collapses to a drawer, tables scroll or become cards).
- **Locale:** English, UAE. Dates are shown as calendar dates (Asia/Dubai). Data is dense (hundreds of workers, ~300 beds per camp group), so the design must stay readable at high density.

## 2. Tech constraints (so the design can be implemented 1:1)

- Next.js + **Tailwind CSS v4** + **shadcn/ui** (style "base-nova", Base UI primitives), **lucide** icons, **motion** for animation, TanStack Table for tables.
- Please deliver the visual system as **design tokens that map to shadcn CSS variables**: `--background, --foreground, --card, --popover, --primary, --primary-foreground, --secondary, --muted, --muted-foreground, --accent, --destructive, --border, --input, --ring, --radius, --sidebar-*`, plus chart colours. Provide **light and dark** themes.
- Font: suggest a pairing that fits the logo (currently Geist Sans / Geist Mono; Emp No codes use mono).
- Use standard shadcn components where possible: Button, Input, Select, Checkbox, Switch, Radio group, Textarea, Dialog, Sheet (side drawer), Dropdown menu, Tooltip, Badge, Card, Table, Separator, Avatar, Sonner toasts.

## 3. Semantic colours (must stay distinct and accessible in light and dark)

Please keep these meanings and make them harmonise with the brand palette:

**Bed status** (shown on bed tiles, badges, bars, legends):
- **Occupied** — currently blue/sky
- **Held** (occupant on leave, bed reserved) — currently amber
- **Vacant** — currently green/emerald
- **Invalidated** — grey, dashed border, label struck through

**Worker accommodation status** (employee table rows and badges; mirrors our Excel occupancy sheet):
- **Occupied** — neutral/white row
- **On leave** — green row tint
- **No bed** — orange row tint
- **Exited** — grey, muted text

Also: destructive (Exit, Invalidate), warning (room over capacity), success toasts.

## 4. App shell

- **Left sidebar** (collapsible; drawer on mobile) with the logo + "Xperts Camps", and navigation grouped:
  - Main: **Dashboard, Workers, Camps, Reports**
  - Administration: **Custom fields, Users, Roles & permissions, Audit log**
  - Items appear only if the user's role allows them (roles are dynamic; e.g. a Camp Supervisor sees only Dashboard, Workers, Camps). Active item has an animated highlight.
- **Top bar:** page context/breadcrumb, signed-in user's name + role, Sign out. Room for a future global search.
- Toast notifications bottom-right. Consistent page header pattern: title, short description, primary action on the right.

## 5. Screens to design (everything that exists today)

### 5.1 Login
- Logo, "Sign in", subtitle "Staff accounts only. Ask an administrator if you need access."
- Email, password, Sign in button, inline error ("Incorrect email or password"). No sign-up, no social login.

### 5.2 Dashboard (currently minimal — please design a proper one)
- Today: welcome message, today's date in Dubai, the user's role, camp access (all camps / N assigned) and list of permissions.
- Please design the real dashboard we will build next: KPI cards (total workers, housed, on leave, without a bed, exited this month; total beds, occupied, held, vacant, occupancy %), occupancy per camp (stacked bars occupied/held/vacant), workers on leave list, recent exits, rooms over capacity, recent activity.

### 5.3 Workers — employee table (`/workers`)
- Header: "Workers", "N matching", buttons **Export to Excel** and **Add worker**.
- Filters row: search (Emp No, name, phone), **Client**, **Division** (depends on client), **Camp**, **Status** (Active, Exited any reason, Resigned, Terminated, Absconded, Visa Cancelled, Transferred Out, Any), **Leave** (All, Present, On leave), **Bed** (All, Has a bed, No bed), Clear filters. Filters live in the URL.
- Columns: **Emp No** (mono), **Name** (link) + nationality, **Position**, **Division / Client**, **Camp · Room · Bed**, **Status** badge (+ "Since <date>" when on leave, or exit type + date), actions.
- Row actions: **Assign bed** (only if no bed), **On leave** / **Returned** toggle, **Edit** (icon), **Exit** (destructive).
- Row tints by accommodation status (see §3). Sortable headers (Emp No, Name, Position). Pagination with 25/50/100/200 per page.
- Dialogs: **Start leave** (starts today, optional note, explains the bed stays reserved), **Mark returned** (confirm), **Exit worker** (reason type select, exit date, details; warns which bed will be freed and that open leave closes).

### 5.4 Worker detail (`/workers/[id]`)
- Header: back link, name, Emp No · position, status badge. Actions: **Assign bed / Move**, **On leave / Returned**, **Edit**, **Exit**.
- Cards: **Details** (all built-in fields: Position, Division, Client, Sponsor, UAE Contact No, Home Country Contact No, Email ID, Nationality, Join Date, Employment Status, Exit Date, Exit Reason, Passport No and Emirates ID No only for permitted roles, Remarks, plus custom fields), **Current bed** (camp, room, bed, since; or "on leave, bed held"; or "no bed"), **Bed history** table (camp · room · bed, from, to, ended: moved/exited), **Leave history** table (went on leave, returned / closed on exit, note).

### 5.5 Add / edit worker (`/workers/new`, `/workers/[id]/edit`)
- Sectioned form in cards: **Worker** (Emp No*, Name*, Position, Nationality), **Employment** (Sponsor, Join date, Client, Division – disabled until client chosen), **Contact** (UAE Contact No, Home Country Contact No, Email ID), **Identity documents** (Passport No, Emirates ID No — only for permitted roles), **Additional fields** (admin-defined custom fields rendered by type: text, number, date, dropdown, phone, email, yes/no switch; required marked *), **Remarks**. Cancel / Save. Inline validation errors.

### 5.6 Camps overview (`/camps`)
- Header with **New camp**, switch "Show invalidated (N)".
- Grid of camp cards: name, emirate · address, animated stacked occupancy bar (occupied/held/vacant), "N beds · X% in use", stats: Rooms, Occupied, Held, Vacant. Invalidated camps greyed with badge.
- **New/Edit camp dialog:** name, emirate (7 emirates), address, square metres per worker (empty = default 3.7 Dubai / 3.0 elsewhere; used only to warn about crowded rooms).

### 5.7 Camp detail (`/camps/[id]`) — the most important operational screen
- Header: back link, camp name (+ Invalidated badge), emirate · address · m² per worker, invalidation note if any. Actions: **Edit camp**, **Invalidate camp** (disabled until all rooms invalidated), **Add room**.
- Occupancy bar; search box ("Room number, worker name or Emp No"); **bed status legend**; switch "Invalidated rooms (N)".
- Grid of **room cards** in natural order (1A, 1B, 2, 10, 101…). Each room card:
  - Title "Room 101", "7 occupied · 1 held · 1 vacant · 35 m²", amber **capacity warning** ("10 beds; area fits about 7") when crowded.
  - "…" menu: Add beds, Edit room, Reorder beds, Invalidate room (disabled while beds are in use).
  - **Bed map**: grid with the room's configured number of columns; each bed tile shows label (B1), type (Lower/Upper/Single) and occupant name or status, coloured by bed status.
- Dialogs: **Add room** (room number text, bed map columns, area m² with "fits about N beds" hint, notes), **Add beds** (how many, label prefix "B" → B7, B8…, type: single / bunk pairs / unspecified), **Reorder beds** (drag-and-drop list), **Invalidate** (requires a reason).

### 5.8 Bed side drawer (opens when a bed tile is clicked)
- Title "Room 101 · B1", status badge, type, camp.
- **Current occupant** card (name link, Emp No, since date, "on leave — bed held") + **Move to another bed**.
- For vacant beds: **Put a worker in this bed** — search, candidate list (workers without a bed first; housed workers show "Now in Room X · B2" → becomes a move), date, **Assign** / **Move here**.
- Edit label/type, **Invalidate bed** (only when vacant).
- **"Everyone who stayed in this bed"** vertical timeline: name, Emp No, from → to/now, moved out/exited, "In by … · out by …", Current badge.

### 5.9 Bed picker dialog (assign or move a worker)
- Camp select, room filter, "N vacant beds", rooms listed with bed chips; only vacant beds selectable (held/occupied/current bed disabled), selected bed highlighted, date, summary of the selection, **Assign bed / Move worker**.

### 5.10 Users (`/admin/users`)
- Table: name + email (+ "(you)"), role, camps (all camps / list), status (Active / Deactivated), actions: Edit, Password, Deactivate/Activate. Search, **New user**.
- Dialogs: create/edit user (name, email, temporary password, role select, camp checklist shown only when the role is limited to assigned camps), set new password, deactivate/activate confirmation (explains sign-out everywhere).

### 5.11 Roles & permissions (`/admin/roles`)
- Table: role (+ lock icon for Administrator, description), permissions "N of 14", camps (all / assigned only), active users, status (Locked / Active / Invalidated with reason tooltip), actions Edit / Invalidate (disabled with tooltip while users have the role).
- **Role editor dialog**: name, description, camp access radio (all camps / only camps assigned to each user), **permission matrix** grouped (Camps, Workers, Reports, Administration) with "Select all" per group. Permissions: view camps; manage camps/rooms/beds; assign & move beds; view workers; add/edit workers; mark leave; exit workers; see passport & Emirates ID; export workers; view/export reports; manage custom fields; view audit log; manage users; manage roles.

### 5.12 Worker fields (`/admin/fields`)
- **Custom fields** table: field (label + storage key), type, options (chips), workers with data, status (Visible/Hidden), actions Edit, Hide/Show, Delete (disabled with tooltip "N workers have data — can only be hidden"). **Add field** dialog: label, type, options (one per line, for dropdowns), required switch.
- **Built-in fields** panel: locked list (Camp, Room No, Bed, Status, Emp No, Name, Position, Division, Client, Sponsor, UAE Contact No, Home Country Contact No, Email ID, Nationality, Join Date, Employment Status, Exit Date, Exit Reason, Passport No, Emirates ID No, Remarks) with badges "Automatic", "Restricted", type. Message: cannot be deleted or hidden, always available in reports.

### 5.13 Placeholders to design properly (built in upcoming phases)
- **Reports** (`/reports`): pick report type (camp occupancy sheet grouped by room like our Excel, workers by client/division, on-leave list, exits in a period, vacancy list), choose columns from built-in + custom fields, filters, preview table, **Export to Excel**.
- **Audit log** (`/admin/audit`): filterable timeline/table of who changed what (action, entity, before/after diff), date range.
- **Camp explorer** (animated, interactive visual of camps → rooms → beds; I will describe it separately — leave a hero area for it on the camp screen).

## 6. States to include for every screen

Loading (skeletons), empty states with a helpful next action, error state, permission-denied redirect message, disabled actions with tooltip explaining why, success/error toasts, confirmation dialogs for consequential actions (exit, invalidate, deactivate), and reason-required dialogs for invalidations.

## 7. Motion

Subtle and purposeful: animated sidebar active indicator, cards fading in on load, occupancy bars growing, drawer sliding in, timeline items staggering in, drag-to-reorder feedback. Respect reduced-motion.

## 8. Deliverables

1. Design system: colour tokens (light + dark) mapped to shadcn variables, typography scale, spacing, radius, shadows, icon style, status colours.
2. Component sheet: buttons, inputs, selects, badges (all statuses), bed tile (4 states + types), room card, camp card, occupancy bar, stat/KPI card, data table (with tinted rows), filter bar, dialogs, drawer, timeline, toasts, empty states.
3. All screens in §5 at desktop (1440 px) and mobile (390 px), light and dark.
4. Short notes on anything you changed in layout or flow and why.
