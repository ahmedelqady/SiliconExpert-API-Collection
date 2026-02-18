# Tasks: Postman CMS to HTML Sync Automation

**Branch**: `002-postman-html-sync`
**Spec**: `specs/002-postman-html-sync/spec.md`
**Plan**: `specs/002-postman-html-sync/plan.md`

---

## Phase 0 — Foundations ✅

- [x] Add `docs/SE_API_Docs_v18.5.html` to repository as sync target
- [x] Add `.github/workflows/postman-cms-sync.yml` skeleton with `workflow_dispatch` inputs
  (`release_version`, `release_date`, `release_title`, `dry_run`, `baseline_ref`)
- [x] Add `scripts/postman_cms/sync_postman_to_html.mjs` entrypoint with git baseline resolution
- [x] Add `artifacts/.gitkeep` and ignore `artifacts/` contents in `.gitignore`

## Phase 1 — Core Sync Engine ✅

- [x] `lib/parse_collection.mjs` — normalise Postman collection into snapshot
  - Folders → categories, requests → endpoints with method/path/params/description
  - Extract and normalise response examples (JSON + XML)
  - Stable endpoint id assignment (slug, dedup, preserve across reruns)
  - `buildErrorCatalog()` — HTTP status codes + app-level status codes from JSON/XML examples
  - `buildWelcomeContent()` — title, subtitle, service cards, guidelines from collection root + folders
- [x] `lib/parse_html_blocks.mjs` — extract and parse all five managed `const` blocks
  - Brace-balanced parser with string/comment awareness
  - Hard fail on missing or ambiguous anchor
- [x] `lib/diff_snapshots.mjs` — compute delta across all domains
  - Category and endpoint diffs (added / removed / changed with change-type list)
  - Error code diffs (`errorCodes.added`, `errorCodes.removed`, `errorCodes.changed`)
  - Welcome section diffs (`welcome.changedSections`)
  - `htmlBlocksChanged` list derived from actual content equality
- [x] `lib/update_html_blocks.mjs` — apply minimal deterministic patches to HTML
  - Patch `API_DATA`, `EXAMPLES`, `ERROR_CODES_CONTENT`, `WELCOME_CONTENT`, `RELEASE_NOTES_CONTENT`
  - Fail before any write if any required anchor is missing

## Phase 2 — Reporting and Publishing ✅

- [x] `lib/write_artifacts.mjs` — emit `postman_html_diff.json`, `postman_html_diff.md`, `postman_html_content_snapshot.json`
  - Markdown diff includes endpoint, error-code, and welcome-section deltas
  - JSON diff includes all summary counts and per-item details
- [x] Release notes entry builder in `sync_postman_to_html.mjs`
  - Entry includes `version`, `date`, `title`, status tag, and API delta line
  - Keeps rolling 30-entry history; dedupes by version
- [x] Workflow commit/push behaviour
  - Skip commit on `dry_run=true`
  - Skip commit when HTML is unchanged
  - Commit message includes `release_version` and `release_title`
- [x] Upload all four artifacts via `actions/upload-artifact@v4`

## Phase 3 — Validation and Hardening ✅

- [x] `tests/postman_cms/parser.test.mjs` — unit tests for `parseCollection`
  - Welcome content extraction
  - Error catalog extraction (JSON + XML)
  - Category ordering
- [x] `tests/postman_cms/diff.test.mjs` — unit tests for `diffSnapshots`
  - Error and welcome deltas surface correctly
- [x] `tests/postman_cms/html-update.test.mjs` — unit tests for `updateHtmlBlocks`
  - All five blocks patched
  - Missing anchor throws
  - Idempotency
- [x] `tests/postman_cms/error-codes.test.mjs` — targeted error catalog tests (9 cases)
- [x] `tests/postman_cms/welcome-content.test.mjs` — targeted welcome builder tests (12 cases)
- [x] `tests/postman_cms/integration.test.mjs` — end-to-end scenario tests (8 cases)
  - New 401/403 triggers error block update
  - Folder rename triggers welcome update
  - Collection description change updates welcome only
  - Missing anchor → hard fail, no commit
  - HTML blocks patch correctly
  - Idempotency (after→after = zero diff)
  - Error block skipped when codes unchanged
  - Multi-source error deduplication
- [x] `tests/postman_cms/fixtures.test.mjs` — fixture-based regression tests (15 cases)
  - `scripts/postman_cms/fixtures/collection.before.json`
  - `scripts/postman_cms/fixtures/collection.after.json`
  - `scripts/postman_cms/fixtures/expected.diff.json` (committed, generated from real parser)
- [x] `tests/postman_cms/parser.test.mjs` — duplicate `METHOD + PATH` dedup (added in post-analysis gap closure)
  - Two requests sharing same method+path get stable id on first, suffixed id on second
- [x] `tests/postman_cms/integration.test.mjs` — release-notes entry format (added in post-analysis gap closure)
  - Version, date, title, tag, and delta line present in `RELEASE_NOTES_CONTENT` block

## Phase 4 — Contracts and Documentation ✅

- [x] `specs/002-postman-html-sync/contracts/html-block-contract.md`
  — updated to cover all five blocks with shape reference
- [x] `specs/002-postman-html-sync/contracts/postman-html-diff.schema.json`
  — updated schema with `errorCodes`, `welcome`, and `summary.errorCodes*` / `summary.welcomeSectionsChanged` fields
- [x] `specs/002-postman-html-sync/contracts/workflow-dispatch-inputs.schema.json`
- [x] `IMPLEMENTATION_GUIDE.md` — full architecture, data models, extension points
- [x] `SYNC_QUICKSTART.md` — user-facing usage guide with examples
- [x] `VALIDATION_REPORT.md` — phase-by-phase completion evidence

---

## Total Test Count

| File | Tests |
|---|---|
| `parser.test.mjs` | 3 |
| `diff.test.mjs` | 1 |
| `html-update.test.mjs` | 3 |
| `error-codes.test.mjs` | 9 |
| `welcome-content.test.mjs` | 12 |
| `integration.test.mjs` | 9 |
| `fixtures.test.mjs` | 15 |
| **Total** | **52** |

All tests pass (`npm test`).

---

## Completion Checklist

- [x] All spec FRs (FR-001 through FR-016 + FR-003a) satisfied
- [x] All spec success criteria (SC-001 through SC-005) met
- [x] Constitution gates 1–5 all PASS
- [x] Edge cases from spec covered in tests
- [x] No partial commits possible (fail-safe verified)
- [x] Deterministic + idempotent output verified
- [x] Artifacts directory ignored in git; placeholder committed
