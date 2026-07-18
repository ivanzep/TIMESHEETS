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
  - **Detail View**: entries grouped by date → project → tag, with per-tag/day hour rounding,
    copy-to-clipboard on any hour total, and notes shown as paragraphs or a bullet list.
  - **Table View**: a project×tag (rows) by date (columns) pivot matrix with sticky project
    column, per-cell hover tooltips (underlying notes), collapse/expand per project, and
    per-day totals when collapsed.
  - **Summary View**: rendered when a Summary-format CSV is detected (project/description/duration
    columns only) — grouped by project, no date/tag breakdown.
  - **Print Preview**: a modal that frames the current view at a chosen page size/orientation
    (Letter/A4/Legal, portrait/landscape) with an optional "scale to fit" transform, then hands
    off to the browser's native print-to-PDF.
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

1. Edit the relevant `.html` file directly.
2. Open it in a browser to check the change (`file:///path/to/toggl-report-v0.2.html`, or serve
   the directory with any static file server if you need to test `fetch`-based behavior).
3. For `toggl-report-v0.2.html`, test with a real Toggl CSV export (web Detail, desktop, or web
   Summary format — `detectFormat()` distinguishes them by header row) to exercise the
   format-specific code paths.
4. For `toggl-api.html`, testing the live-fetch paths requires a deployed `worker.js` proxy and a
   valid Toggl API token.
5. Update the version-log comment in the file's `<script>` block when the change is user-visible.

## Conventions inside the HTML files

- Each file is self-contained: no external JS/CSS libraries, no CDN links, no imports.
- Shared color/theme tokens are declared once as CSS custom properties in `:root` at the top of
  `<style>` (`--accent`, `--bg`, `--card`, `--border`, `--text`, `--muted`, etc.) — reuse these
  rather than hard-coding colors.
- Common helper-function names are reused across files with the same behavior: `escHtml`/`escAttr`
  (HTML-escaping before inserting into markup), `fmtH`/`fmtDate` (hour/date formatting),
  `roundQ` (round hours to nearest quarter), `copyStored`/`storeText`/`fallbackCopy`/`flashCopied`
  (clipboard-copy-on-click plumbing used throughout the report views), `showError`/`hideError`,
  `renderEmpty`. When adding similar UI, match these existing helpers instead of introducing new
  ones.
- State that should survive a page reload uses `localStorage` (e.g. `qualifierTags`,
  `toggl_proxy`); state scoped to the current tab session (e.g. the Toggl API token) uses
  `sessionStorage`. Never persist the API token to `localStorage`.
- User-supplied CSV/API text is rendered via `escHtml`/`escAttr` before being inserted into the
  DOM as HTML — preserve this when touching rendering code to avoid introducing XSS via crafted
  entry descriptions/notes.
