# Implementation Plan: Postman–HTML Bootstrap Content Editor

**Branch**: `003-postman-html-bootstrap-editor` | **Date**: 2026-02-18
**Spec**: `specs/003-postman-html-bootstrap-editor/spec.md`

---

## Summary

Build a single self-contained HTML file (`tools/postman-html-bootstrap-editor.html`) that a maintainer opens in a browser to compare, reconcile, and export both the Postman collection and the HTML documentation file in one pass. No server, no install, no network. Parsing and serialisation logic is ported from the existing Node.js CMS sync library (`scripts/postman_cms/lib/`) into browser-compatible inline JavaScript.

---

## Technical Context

**Language/Runtime**: Vanilla JavaScript (ES2022 class syntax, browser-native APIs only)
**Delivery**: Single `.html` file — all CSS and JS inlined, no CDN, no module bundler required
**File I/O**: Browser File API (FileReader / drag-and-drop for input; Blob + `<a download>` for output)
**Parsing**: Port of `parse_collection.mjs` + `parse_html_blocks.mjs` logic into inline `<script>` blocks
**HTML block parsing strategy**: Extract const-block text with the brace-balanced scanner, then strip the
  `const NAME = ` prefix so the remainder is a valid JSON literal, and parse with `JSON.parse()`. This is
  safe because `serializeConstObject` already serialises blocks with `JSON.stringify`, so the output is
  always valid JSON — no dynamic code evaluation is required.
**Serialisation**: Port of `serializeConstObject` (correct 12-space indent, no double-indent bug)
**State**: In-memory JS objects; no localStorage, no IndexedDB
**UI Framework**: None — semantic HTML + CSS custom properties + vanilla DOM
**Testing**: `node --test` unit tests for the ported parser/serialiser functions (extracted into a shared
  `tools/lib/` module that the HTML file inlines at build/copy time)
**Target Browsers**: Chrome 110+, Firefox 115+, Edge 110+, Safari 16.4+
**Performance**: Parse + render for a 15 MB collection and 5-block HTML file must complete in under 3
  seconds on a modern laptop

---

## Constitution Check

- Gate 1: Spec-first. PASS — `spec.md` written and reviewed before this plan.
- Gate 2: Postman as long-term master. PASS — tool is a bootstrap bridge; Postman remains master post-bootstrap.
- Gate 3: Deterministic + safe failure. PASS — no file is modified until explicit Apply; parse errors are surfaced without writing.
- Gate 4: Auditability. PASS — pending-changes summary shown before Apply; maintainer reviews every resolved field.
- Gate 5: Secret hygiene. PASS — no network calls; credentials in collection env vars are not extracted or displayed.

---

## Project Structure

```text
specs/003-postman-html-bootstrap-editor/
├── spec.md
├── plan.md
└── tasks.md

tools/
├── postman-html-bootstrap-editor.html   ← single deliverable (self-contained)
└── lib/
    ├── parse-collection-browser.mjs     ← port of parse_collection.mjs (ES module, no Node built-ins)
    ├── parse-html-blocks-browser.mjs    ← port of parse_html_blocks.mjs (JSON.parse-based, no eval)
    ├── serialize-html-blocks-browser.mjs← port of serializeConstObject
    └── merge-engine.mjs                 ← conflict detection, resolution state machine, apply logic

tests/
└── bootstrap_editor/
    ├── parse-collection.test.mjs        ← unit tests for browser parser port
    ├── parse-html-blocks.test.mjs       ← unit tests for browser HTML parser port
    ├── serialize.test.mjs               ← round-trip serialisation tests
    └── merge-engine.test.mjs            ← conflict classification + apply logic tests
```

**Inlining strategy**: The four `tools/lib/*.mjs` files are the authoritative source during development.
The HTML file's `<script>` section is kept in sync with them. No build tool is required — the files are
small enough to copy-paste inline.

---

## Implementation Phases

### Phase 0 — Foundations

- Create `tools/` directory and empty `postman-html-bootstrap-editor.html` skeleton.
- Create `tests/bootstrap_editor/` directory.
- Define the shared in-memory data model (see Data Model section below).

### Phase 1 — Browser-Ported Parsers

- Port `parse_collection.mjs` → `tools/lib/parse-collection-browser.mjs`.
  - Remove Node.js imports (`crypto`, `path`). Use a simple djb2 hash inline instead of `crypto`.
  - Keep: slug generation, folder→category mapping, params extraction, example extraction, error-code
    catalog, welcome content.
- Port `parse_html_blocks.mjs` → `tools/lib/parse-html-blocks-browser.mjs`.
  - Use the brace-balanced scanner to locate each `const NAME = { ... };` block.
  - Strip the `const NAME = ` prefix, trim the trailing `;`, then call `JSON.parse()` on the remainder.
  - This is safe because the CMS sync always writes blocks with `JSON.stringify` — the content is
    guaranteed to be valid JSON. No code evaluation is needed.
- Port `serializeConstObject` → `tools/lib/serialize-html-blocks-browser.mjs`.
  - Same logic as the fixed version (first line of JSON body is NOT re-indented).
- Write unit tests for all three modules under `tests/bootstrap_editor/`.

### Phase 2 — Merge Engine

- Implement `tools/lib/merge-engine.mjs`:
  - `buildUnifiedRegistry(postmanSnapshot, htmlBlocks)` → unified endpoint/block list with conflict state.
  - `classifyRow(postmanValue, htmlValue)` → `match | conflict | postman-only | html-only | null-both`.
  - `Resolution` state: per-field map of `{ resolved, source: 'postman'|'html'|'custom'|'unchanged' }`.
  - `applyResolutions(unifiedRegistry, resolutions, originalPostman, originalHtmlText)` →
    `{ postmanJson: string, htmlString: string }`.
- Write unit tests for all exported functions.

### Phase 3 — UI Shell

Build the single-page UI inside `postman-html-bootstrap-editor.html`:

**Load Screen**
- Two file-drop zones (Postman JSON, HTML doc).
- Validation: parse both on drop; show error inline if parse fails (no alert() — inline error message).
- "Compare" button activates only when both files are loaded successfully.

**Comparison View — Tabs**
- Tab bar: `Endpoints (API_DATA)` | `Examples` | `Welcome` | `Error Codes`.
- Each tab shows a scrollable table of rows.

**Endpoint/Example Table Row**
- Columns: `ID` | `Postman` | `HTML` | `Resolved` | `Actions`.
- Actions: `← Use Postman` | `Use HTML →` | `Edit` (inline textarea for Resolved).
- State badge on the row: coloured chip for `match`, `conflict`, `postman-only`, `html-only`, `null-both`.

**Welcome Tab**
- Field-by-field rows for `title`, `subtitle`, `baseUrl`, `guidelinesLeft`, `guidelinesRight`,
  `supportCards`.

**Error Codes Tab**
- Two sub-tables: `statusCodes` and `httpCodes`. Each row is one code entry.

**Pending Changes Panel**
- Fixed sidebar or collapsible drawer listing every resolved field with before/after values.
- "Apply & Download" button — disabled until at least one resolution exists.

**Apply Flow**
- Serialise resolved content into updated Postman JSON and updated HTML const blocks.
- Trigger two `<a download>` clicks with `Blob` URLs pointing to in-memory strings.
- Show a success banner with the idempotency hint: "Load both outputs back to confirm zero conflicts."

### Phase 4 — Hardening & Tests

- All four unit test files complete and passing under `npm test`.
- Manual end-to-end test: load real collection + HTML, resolve one conflict, apply, load outputs back,
  confirm all rows show `match`.
- Accessibility: keyboard navigation for all interactive elements, focus rings, ARIA labels on conflict
  badges.
- Edge cases: empty collection, HTML with missing block, non-ASCII characters in descriptions,
  Windows CRLF line endings (normalise to LF on load via `TextDecoder`).

---

## Data Model

### `PostmanSnapshot` (output of `parse-collection-browser.mjs`)

```js
{
  categories:     [{ id, name, parentId, order }],
  endpoints:      [{ id, name, method, path, categoryId, description, params, examples }],
  apiData:        { [endpointId]: { title, method, path, breadcrumb, description, params,
                                    hasExamples, getStarted, anatomy } },
  examples:       { [endpointId]: [{ title, subtitle, request, response, note }] },
  errorCodes:     { statusCodes: [...], httpCodes: [...], notes: [...] },
  welcomeContent: { title, subtitle, baseUrl, guidelinesLeft, guidelinesRight, supportCards }
}
```

### `HtmlBlocks` (output of `parse-html-blocks-browser.mjs`)

```js
{
  API_DATA:              { value: {...}, replaceStart, replaceEnd },
  EXAMPLES:              { value: {...}, replaceStart, replaceEnd },
  WELCOME_CONTENT:       { value: {...}, replaceStart, replaceEnd },
  ERROR_CODES_CONTENT:   { value: {...}, replaceStart, replaceEnd },
  RELEASE_NOTES_CONTENT: { value: {...}, replaceStart, replaceEnd }  // read-only
}
```

### `UnifiedRow`

```js
{
  id:      string,                       // endpoint slug or section key
  block:   'apiData'|'examples'|'welcome'|'errorCodes',
  field:   string,                       // dotted path, e.g. 'description', 'params', 'examples[0].request'
  postman: any | null,
  html:    any | null,
  state:   'match'|'conflict'|'postman-only'|'html-only'|'null-both'
}
```

### `Resolution`

```js
{
  [rowKey]: {
    resolved: any,
    source:   'postman' | 'html' | 'custom' | 'unchanged'
  }
}
```

---

## Aesthetic Direction

The tool is a **precision instrument for technical maintainers**. Design direction: **utilitarian
editorial** — monospace data, clear hierarchy, zero decoration. Palette: near-black background
(`#0f1117`), off-white text, amber accent (`#f5a623`) for conflicts, green (`#3ecf8e`) for matches,
muted slate for unchanged/null. Typography: `JetBrains Mono` for all data fields; `IBM Plex Sans` (or
system `ui-sans-serif`) for labels and UI chrome. The diff table uses a fixed-width left/right split
with a center gutter showing the state badge. Sharp grid lines, no rounded corners on data cells.

---

## Risk Register

- Risk: `JSON.parse` fails on blocks that contain JavaScript expressions (computed keys, template
  literals, comments).
  Mitigation: All blocks are written by `serializeConstObject` which uses `JSON.stringify`, so content
  is guaranteed valid JSON. If a hand-edited block contains non-JSON syntax, the parser reports a
  clear error at load time without any write occurring.

- Risk: Large collection (>10 MB) causes UI jank during parse.
  Mitigation: Parse on `setTimeout(0)` with a loading spinner; virtualise the endpoint table if row
  count exceeds 200.

- Risk: Postman collection structure differs from v2.1.0 schema.
  Mitigation: Validate `info.schema` field at load time; show a clear error if schema is unexpected.

- Risk: HTML file encoding issues (BOM, Windows CRLF) corrupt replaceStart/replaceEnd offsets.
  Mitigation: Normalise to UTF-8 LF via `TextDecoder` on load before any character-index arithmetic.

---

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| Port parse_collection.mjs to browser JS | Tool must be standalone, no Node runtime | Could ship a Node CLI — rejected because user wants browser/offline UX with zero install |
| Brace-balanced scanner + JSON.parse | `const` blocks are not valid JSON on their own | Could require blocks to be pure JSON arrays — rejected because existing HTML uses object literals |
| Inline all JS in one HTML file | No CDN, no server, offline-first | Could use a bundler (Vite/esbuild) — rejected because adds tooling overhead for a one-time tool |
