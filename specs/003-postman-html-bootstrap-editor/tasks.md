# Tasks: Postman–HTML Bootstrap Content Editor

**Branch**: `003-postman-html-bootstrap-editor`
**Spec**: `specs/003-postman-html-bootstrap-editor/spec.md`
**Plan**: `specs/003-postman-html-bootstrap-editor/plan.md`

---

## Phase 0 — Foundations

- [ ] T001 Create `tools/` directory and `tools/lib/` subdirectory
- [ ] T002 Create `tests/bootstrap_editor/` directory
- [ ] T003 Create `tools/postman-html-bootstrap-editor.html` skeleton (DOCTYPE, empty `<head>`, empty `<body>`, empty `<script>`)
- [ ] T004 Add `tests/bootstrap_editor/` to `package.json` test glob (extend `tests/postman_cms/*.test.mjs` → `tests/**/*.test.mjs`)

---

## Phase 1 — Browser-Ported Parsers (US2 foundation)

### Parse Collection

- [ ] T005 [P] Create `tools/lib/parse-collection-browser.mjs` — port of `scripts/postman_cms/lib/parse_collection.mjs`
  - Remove `crypto` / `path` Node imports; replace hash with inline djb2 function
  - Keep: slugify, folder→category, params extraction, example extraction, `buildErrorCatalog`, `buildWelcomeContent`
  - Export: `parseCollection(collectionJson)` returning `PostmanSnapshot`
- [ ] T006 [P] Create `tests/bootstrap_editor/parse-collection.test.mjs`
  - Test: slug generation matches original (same inputs → same IDs)
  - Test: folder nesting produces correct `categoryId` on endpoints
  - Test: `buildErrorCatalog` extracts HTTP + app-level codes
  - Test: `buildWelcomeContent` extracts title, subtitle, guidelines
  - Test: dedup behaviour for same-slug endpoints (suffix `-2`, `-3` etc.)
  - Target: ≥ 8 passing assertions

### Parse HTML Blocks

- [ ] T007 [P] Create `tools/lib/parse-html-blocks-browser.mjs` — port of `scripts/postman_cms/lib/parse_html_blocks.mjs`
  - Brace-balanced scanner identical to original
  - After locating block text: strip `const NAME = ` prefix and trailing `;`, then call `JSON.parse()`
  - No code evaluation — `JSON.parse` only
  - Export: `parseHtmlBlocks(htmlString)` returning `HtmlBlocks`; `requiredHtmlBlocks()` list
  - Normalise CRLF → LF before any index arithmetic
- [ ] T008 [P] Create `tests/bootstrap_editor/parse-html-blocks.test.mjs`
  - Test: parses all five required blocks from a minimal fixture HTML
  - Test: `replaceStart` / `replaceEnd` positions are correct (splice test)
  - Test: throws on missing anchor
  - Test: throws on ambiguous anchor (two `const API_DATA`)
  - Test: CRLF input normalised without offset errors
  - Target: ≥ 6 passing assertions

### Serialise HTML Blocks

- [ ] T009 [P] Create `tools/lib/serialize-html-blocks-browser.mjs` — port of fixed `serializeConstObject`
  - First line of JSON body (opening `{`) is NOT prefixed with indent (fixes double-indent bug)
  - All subsequent lines prefixed with 12-space indent
  - Export: `serializeConstObject(name, value, indent?)` → string
- [ ] T010 [P] Create `tests/bootstrap_editor/serialize.test.mjs`
  - Test: `const NAME = {\n            "key": "val"\n            };` — correct format
  - Test: round-trip — parse then serialise produces identical string for all five blocks
  - Test: nested objects indented correctly
  - Target: ≥ 5 passing assertions

---

## Phase 2 — Merge Engine (US1, US2, US3)

- [ ] T011 Create `tools/lib/merge-engine.mjs`
  - `buildUnifiedRegistry(postmanSnapshot, htmlBlocks)` → `UnifiedRow[]`
    - Merge endpoint slugs from both sources; null-fill missing side
    - Produce rows for: apiData fields (title, description, method, path, params), examples array,
      welcomeContent fields, errorCodes entries
  - `classifyRow(postmanValue, htmlValue)` → `'match'|'conflict'|'postman-only'|'html-only'|'null-both'`
    - Deep-equality check using `JSON.stringify` on both sides (order-normalised)
  - `applyResolutions(unifiedRegistry, resolutions, originalPostmanObj, originalHtmlText)` →
    `{ postmanJson: string, htmlString: string }`
    - For each resolved field: write into cloned Postman object at correct path; write into cloned
      HTML block values at correct path
    - Serialise Postman with `JSON.stringify(obj, null, 2)`
    - Serialise each HTML block with `serializeConstObject`, splice back at `replaceStart`/`replaceEnd`
    - Fields with `source: 'unchanged'` are NOT touched in either output
- [ ] T012 Create `tests/bootstrap_editor/merge-engine.test.mjs`
  - Test: `buildUnifiedRegistry` — endpoint in Postman only → `postman-only` state
  - Test: `buildUnifiedRegistry` — endpoint in HTML only → `html-only` state
  - Test: `buildUnifiedRegistry` — identical values → `match` state
  - Test: `buildUnifiedRegistry` — different values → `conflict` state
  - Test: `classifyRow(null, null)` → `null-both`
  - Test: `applyResolutions` with `source: 'postman'` writes correct value into HTML output
  - Test: `applyResolutions` with `source: 'html'` writes correct value into Postman output
  - Test: `applyResolutions` with `source: 'unchanged'` leaves both files bit-for-bit identical
  - Test: `applyResolutions` — loading outputs back into `buildUnifiedRegistry` shows all resolved
    rows as `match`
  - Target: ≥ 9 passing assertions

---

## Phase 3 — UI Shell (US1, US2, US3, US4, US5)

### Load Screen

- [ ] T013 [US5] Implement load screen in `postman-html-bootstrap-editor.html`
  - Two drag-and-drop zones + file-picker fallback (Postman JSON / HTML doc)
  - On file drop: read with `FileReader.readAsText`, normalise encoding, attempt parse, show inline
    success/error status without `alert()`
  - "Compare →" button enabled only when both files parse successfully
  - No network calls at any point — verify with inline CSP header `default-src 'none'; script-src 'self'`

### Comparison View

- [ ] T014 [P] [US1] Implement tab bar: `Endpoints` | `Examples` | `Welcome` | `Error Codes`
  - Pure CSS tab switching (`:checked` radio trick or JS `classList` toggle)
  - Active tab visually distinct; keyboard accessible (`role="tab"`, `aria-selected`)
- [ ] T015 [P] [US1] Implement Endpoints tab — `API_DATA` comparison table
  - One row per unified endpoint slug
  - Columns: `ID` | `Postman value` | state badge | `HTML value` | `Resolved` | `Actions`
  - State badge chip: amber=conflict, green=match, blue=postman-only, orange=html-only, grey=null-both
  - Postman and HTML value panels: render key fields (title, description, method, path) as read-only
    formatted text blocks; truncate at 120 chars with "show more" toggle
- [ ] T016 [P] [US2] Implement Examples tab — `EXAMPLES` comparison table
  - One row per `endpointId` (may contain multiple examples; show count in row header)
  - Expand row to show per-example sub-rows (title, request, response, note)
  - Each sub-row has same Actions as endpoint rows
- [ ] T017 [P] [US4] Implement Welcome tab — `WELCOME_CONTENT` field-by-field table
  - Rows: title, subtitle, baseUrl, guidelinesLeft (array), guidelinesRight (array), supportCards (array)
  - Array fields show item count; expand to show per-item sub-rows
- [ ] T018 [P] [US4] Implement Error Codes tab — `ERROR_CODES_CONTENT` tables
  - Two sub-tables: statusCodes / httpCodes
  - One row per code entry; columns same as endpoint rows

### Resolution Actions

- [ ] T019 [US2] Implement "← Use Postman" and "Use HTML →" action buttons per row
  - On click: copy the respective side's value to `Resolution[rowKey]`, set `source`
  - Row instantly updates Resolved column and state badge transitions to `match`
- [ ] T020 [US2] Implement inline "Edit" mode per row
  - Toggle shows a `<textarea>` pre-filled with current Resolved value (or empty string)
  - "Save" commits custom value with `source: 'custom'`; "Cancel" reverts
  - Textarea is a plain `<textarea>` — no rich-text editor, no external library

### Pending Changes Panel

- [ ] T021 [US2] Implement pending changes sidebar/drawer
  - Lists every row where `source !== 'unchanged'`
  - Shows: `rowKey`, `source`, before value (left source), after value (resolved)
  - Live-updates on every resolution action
  - "Clear All" button resets all resolutions to `unchanged`
- [ ] T022 [US3] Implement "Apply & Download" button
  - Disabled state when no resolutions pending
  - On click: calls `applyResolutions(...)`, creates two `Blob` objects, triggers two `<a download>`
    clicks (browser downloads both files)
  - Filenames: `[original-basename]-bootstrapped.postman_collection.json` and
    `[original-basename]-bootstrapped.html`
  - Shows success banner: "Both files downloaded. Load them back here to confirm zero conflicts."

---

## Phase 4 — Polish & Hardening

- [ ] T023 Inline all `tools/lib/*.mjs` content into `postman-html-bootstrap-editor.html` `<script>` block
  - Remove ES module syntax (`import`/`export`) — convert to IIFE or global namespace pattern
  - Verify the standalone HTML works via `file://` URL (no server)
- [ ] T024 Accessibility pass
  - All buttons have visible focus rings
  - State badges have `aria-label` (not colour-only)
  - Tab panels use `role="tabpanel"` with `aria-labelledby`
  - `<textarea>` elements have associated `<label>`
- [ ] T025 Edge-case hardening
  - Empty Postman collection (`item: []`) → load succeeds, shows zero endpoint rows
  - HTML with one block missing → parse error shown inline, no comparison rendered
  - Non-ASCII chars in descriptions (e.g. Japanese, Arabic) → verify round-trip identical
  - Very long description (>5000 chars) → truncated in view, full value preserved in resolution
- [ ] T026 Run full test suite (`npm test`) — all tests in `tests/postman_cms/` and `tests/bootstrap_editor/` pass
- [ ] T027 Manual end-to-end verification
  - Load real collection + `docs/SE_API_Docs_v18.5.html`
  - Resolve at least one conflict in each tab (Endpoints, Examples, Welcome, Error Codes)
  - Apply → download both files
  - Load output files back → confirm all resolved rows show `match`
  - Commit both output files, run `002-postman-html-sync` dry-run → confirm zero structural diff

---

## Test Count Summary

| File | Tests |
|------|-------|
| `tests/bootstrap_editor/parse-collection.test.mjs` | ≥ 8 |
| `tests/bootstrap_editor/parse-html-blocks.test.mjs` | ≥ 6 |
| `tests/bootstrap_editor/serialize.test.mjs` | ≥ 5 |
| `tests/bootstrap_editor/merge-engine.test.mjs` | ≥ 9 |
| **New total** | **≥ 28** |
| Existing `tests/postman_cms/` | 52 |
| **Grand total** | **≥ 80** |

---

## Dependencies

```
T001 → T003
T004 (independent)
T005 → T006
T007 → T008
T009 → T010
T005, T007, T009 → T011 → T012
T003, T011 → T013 → T014
T014 → T015, T016, T017, T018
T015, T016, T017, T018 → T019, T020
T019, T020 → T021 → T022
T005–T012, T022 → T023
T023 → T024, T025
T024, T025 → T026 → T027
```

T005, T006, T007, T008, T009, T010 are all parallelisable (independent files).
T015, T016, T017, T018 are parallelisable once T014 is complete.
