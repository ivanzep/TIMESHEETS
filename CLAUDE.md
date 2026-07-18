# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

TIMESHEETS is a set of standalone, single-file HTML tools that turn Toggl Track time entries
into human-readable timesheet reports (grouped by date/project/tag, or a project/task summary,
plus a print-friendly Table View with PDF export). There is no build system, package manager,
or test suite — every tool is one `.html` file with inline `<style>` and `<script>`, meant to be
opened directly in a browser (double-click, or `file://`) or hosted as a static file.

## Files

- **`toggl-report-v0.2.html`** — the actively developed app. This is the one to edit for new
  features or fixes. It ingests a Toggl **CSV export** (both the Toggl web "Detail" export and
  the desktop-app export, plus the web "Summary" export format) and renders:
  - **Detail View**: entries grouped by date → project → tag, with per-tag/day hour rounding
    (bottom-up: tag rounds first, then sums to project, then to day — so visible numbers always
    add up), copy-to-clipboard on any hour total, and notes shown as paragraphs or a bullet list.
    Day blocks can be individually collapsed/expanded.
  - **Table View**: a project×tag (rows) by date (columns) pivot matrix with:
    - Sticky project-name column (stays visible when scrolling horizontally)
    - Per-cell hover tooltips showing the underlying entry notes/descriptions
    - Per-project collapse/expand toggle (▼ button on the project header row)
    - Global **Expand All / Collapse All** buttons above the table
    - When a project is collapsed, per-day hour totals for that project are shown in the header row
    - **Qualifier tags** (MEETING, OFFICE, CALL — configurable, persisted to localStorage as
      `qualifierTags`) are sorted to the end of multi-tag display labels while the matrix key
      stays alphabetical; the qualifier input is in the Filters panel
    - Total row pinned just below the column header
    - 10px spacer rows between the total row and the first project, and after each project section
  - **Summary View**: rendered when a Summary-format CSV is detected (project/description/duration
    columns only) — grouped by project, no date/tag breakdown.
  - **Print Preview**: a modal with:
    - Page size selector (Letter / A4 / Legal) and orientation (Portrait / Landscape)
    - **Scale to fit**: scales the content to fit within both the width AND height of the selected
      page — `applyScaleToFit()` computes `scaleW` and `scaleH` and applies `min(scaleW, scaleH)`
    - The page frame uses `aspect-ratio` (set in `updatePageFrame()`) to always maintain correct
      paper proportions regardless of the modal or viewport width — this is what makes landscape
      look right on small screens; `minHeight` was replaced by `aspect-ratio` for this reason
    - Interactive elements (collapse buttons, copy buttons, tooltips) are stripped from the
      preview scaler; collapsed projects are expanded; `cross-tab-wrap` overflow is made visible
    - Export PDF hands off to the browser's native `window.print()` with an injected `@page` rule
  - **Color themes**: 5 accent-color themes (Default/purple, Ocean/blue, Forest/green, Warm/amber,
    Slate/indigo) as colored dot buttons in the app header. Each theme is a `body.theme-X` CSS class
    that overrides only `--accent`, `--accent-dark`, `--date-bg`, `--tag-bg`, `--tag-text`,
    `--project-bg`, `--project-border` — all page backgrounds stay neutral white so reports are
    legible and print-friendly. Selection persisted to `localStorage` as `toggl-theme`.
  - **Upload UX**: the upload zone hides automatically after a file is successfully parsed.
    A hamburger `☰` button in the header top-right re-opens it (toggles to `✕` while open) so
    a different file can be loaded without refreshing.
  - A version-log comment at the top of the `<script>` block (search for `Version log:`) records
    what changed release to release — **update it when you make a user-facing change**, following
    the existing format (date + bullet, newest first).

- **`toggl-api.html`** ("Toggl Live Report") — a separate tool that talks to the **Toggl API
  directly** (v9, via a personal API token) instead of a CSV file, so reports can be generated
  without exporting anything first. Because Toggl's API blocks direct browser CORS requests, it
  requires the Cloudflare Worker proxy (`worker.js`) to be deployed and its URL pasted into the
  page; the token is kept in `sessionStorage`, the proxy URL in `localStorage` — both client-side
  only, never sent anywhere but Toggl.

- **`worker.js`** — a minimal Cloudflare Worker that proxies `GET` requests to
  `api.track.toggl.com`, adding CORS headers so `toggl-api.html` can call the Toggl API from the
  browser. Deploy steps are documented in the file's header comment (paste into a new Worker on
  the Cloudflare dashboard, no CLI/build step). It only forwards GET requests and requires an
  `Authorization` header to be present; it does not log or store the token.

- **`index-web.html`**, **`toggl-report.html`**, **`toggl-report-v0.1.html`** — earlier
  iterations, unchanged since the initial commit. `index-web.html` and `toggl-report.html` are
  byte-identical. Treat these as historical/reference snapshots, not places to add new work —
  active development happens in `toggl-report-v0.2.html`.

## Development workflow

There is no install, build, lint, or test command — this is intentional (zero-dependency static
HTML/CSS/JS). To work on a change:

1. Edit `toggl-report-v0.2.html` directly.
2. Open it in a browser to check the change (`file:///path/to/toggl-report-v0.2.html`).
3. Test with a real Toggl CSV export (web Detail, desktop, or web Summary format —
   `detectFormat()` distinguishes them by header row) to exercise format-specific code paths.
4. Update the version-log comment in the `<script>` block when the change is user-visible.

### Git workflow — important: squash-merge divergence

This repo uses **squash merges** into `main`. After every squash merge, the feature branch history
diverges from `main` (the squash commit has a different hash). Pushing to the old remote branch
will always fail with a conflict.

**Always reset the branch to `origin/main` before starting new work after a merge:**

```bash
git fetch origin main
git checkout -B claude/toggl-csv-report-generator-WzheJ origin/main
# make changes, commit
git push --force-with-lease origin claude/toggl-csv-report-generator-WzheJ
```

If a push is rejected as non-fast-forward after a merge, do not `git pull` — that would create a
merge commit. Instead: copy the working file to `/tmp`, reset the branch to `origin/main`, restore
the file, create a fresh commit, and force-with-lease push.

## Key architecture — `toggl-report-v0.2.html`

### CSS custom properties (`:root`)

All colors are CSS variables: `--accent`, `--accent-dark`, `--bg`, `--card`, `--border`,
`--text`, `--muted`, `--tag-bg`, `--tag-text`, `--date-bg`, `--date-text`, `--project-bg`,
`--project-border`, `--total-bg`, `--shadow`. Themes override a subset of these via
`body.theme-X` classes — never hard-code colors that should follow the theme.

### Data flow

1. CSV parsed by `parseCSV()` → `allEntries[]`
2. `detectFormat()` identifies web/desktop/summary by inspecting header keys
3. `processRawCSV()` populates project/tag filter checkboxes and calls `generateReport()`
4. `generateReport()` / `generateSummaryReport()` filters `allEntries` → builds Detail View HTML
5. `buildTableView(filtered)` / `buildSummaryTableView(filtered)` builds Table View HTML

### Hour rounding

`roundQ(h)` = `Math.round(h * 4) / 4` (nearest 0.25 h). Applied **bottom-up**: tag-level hours
rounded first, then summed to project totals, then to day totals — so the displayed numbers
always add up correctly.

### Copy store

`_copyStore` / `_copyId` — a simple integer-keyed map reset at the start of each
`generateReport()` call. Hour cells embed `onclick="copyCellHours(this, id)"` at build time;
the id maps to the formatted text. Provides reliable copy-to-clipboard without re-computing
values on click.

### Table View matrix

Keyed as `date\x00proj\x00tagKey` where `tagKey` is the alphabetically-normalised tag string
(`normTags()`). A parallel `notesMap` object holds `Set<string>` of descriptions per key for
hover tooltips. `displayTags()` reorders tag labels for display (qualifier tags sorted last)
without affecting the matrix key.

### Print preview

State: `printPageSize` ('letter'|'A4'|'legal'), `printOrientation` ('portrait'|'landscape'),
`printScaleToFit` (bool).

Page dimensions at 96 dpi are in `PAGE_PX = { letter: {w:816,h:1056}, A4: {w:794,h:1123}, legal: {w:816,h:1344} }`.

`updatePageFrame()` sets `frame.style.maxWidth` and `frame.style.aspectRatio` (as `"W / H"`)
so the white page box always shows correct paper proportions. The modal must be **open and
visible** before `updatePageFrame`/`applyScaleToFit` are called — `frame.clientWidth` is 0
when `display:none`. Use double `requestAnimationFrame` to let layout settle.

`applyScaleToFit()` reads `frame.clientWidth`, `frame.clientHeight`, `scaler.scrollWidth`,
`scaler.scrollHeight`, computes `scale = min(innerW/naturalW, innerH/naturalH, 1)`, applies
`transform: scale(scale)` to `#page-content-scaler`, and collapses `#page-content-outer`
height to the visually scaled height.

Print CSS (`body.printing-preview`) resets `aspect-ratio: auto`, `min-height: 0`,
`overflow: visible`, `transform: none`, and `padding: 0` on the page frame so the full content
renders in the PDF regardless of what was visible in the preview.

### Mobile / iOS

`@media (max-width: 600px)` reduces `.print-modal` padding, wraps the toolbar, reduces
`.page-frame` padding from 72px to 20px, and stacks `.report-header-row`.

iOS-specific: `.table-proj-collapse` and `.proj-header-row td:first-child` carry
`-webkit-appearance: none`, `touch-action: manipulation`, `-webkit-tap-highlight-color: transparent`.
`.print-modal` uses `overflow-y: scroll`, `-webkit-overflow-scrolling: touch`, and
`overscroll-behavior: contain` for proper modal scrolling on iOS.

## Conventions inside the HTML files

- Each file is self-contained: no external JS/CSS libraries, no CDN links, no imports.
- CSS custom properties in `:root` — reuse these rather than hard-coding colors.
- Common helper-function names are reused: `escHtml`/`escAttr` (HTML-escaping before inserting
  into markup), `fmtH`/`fmtDate`/`fmtDateShort` (hour/date formatting), `roundQ` (round to
  nearest quarter hour), `copyStored`/`storeText`/`fallbackCopy`/`flashCopied` (clipboard
  plumbing), `showError`/`hideError`, `renderEmpty`. Match these when adding similar UI.
- State that survives page reload: `localStorage` — `qualifierTags` (qualifier tag list),
  `toggl-theme` (active color theme), `toggl_proxy` (Cloudflare Worker URL in toggl-api.html).
  State scoped to the tab session: `sessionStorage` (API token in toggl-api.html). Never persist
  the API token to `localStorage`.
- User-supplied CSV text is rendered via `escHtml`/`escAttr` before DOM insertion — preserve
  this to avoid XSS via crafted entry descriptions/notes.
