# Implementation Plan: Postman CMS to HTML Sync Automation

**Branch**: `002-postman-html-sync` | **Date**: 2026-02-17 | **Spec**: `/Users/ahmedel-qady/Library/CloudStorage/OneDrive-Personal/Postman-Repo/specs/002-postman-html-sync/spec.md`
**Input**: Feature specification from `/Users/ahmedel-qady/Library/CloudStorage/OneDrive-Personal/Postman-Repo/specs/002-postman-html-sync/spec.md`

## Summary

Build a manually triggered GitHub Actions workflow that treats the Postman collection as the source of truth, computes API structure/content deltas against previous `main`, updates only approved HTML data blocks (`API_DATA`, `EXAMPLES`, release notes), produces JSON + Markdown diff artifacts, and auto-commits changes on successful non-dry runs.

## Technical Context

**Language/Version**: Node.js 20+ (local Node 24 compatible), Bash (POSIX shell)
**Primary Dependencies**: Node built-ins (`fs`, `path`, `crypto`, `child_process`), GitHub Actions, `jq` in CI shell steps
**Storage**: Git-tracked files (`.postman_collection.json`, HTML doc), workflow artifacts, git history baseline
**Testing**: `bash` smoke tests, `node --test` for parser/diff unit tests, workflow dry-run validation
**Target Platform**: GitHub Actions (`ubuntu-latest`) and local macOS/Linux execution
**Project Type**: Repository automation/documentation sync
**Performance Goals**: End-to-end run under 2 minutes for current collection size (~11.6 MB)
**Constraints**: Manual trigger only, deterministic outputs, fail-fast on unsafe parse, no partial commits
**Scale/Scope**: Current 36 endpoints with headroom to at least 500 endpoints and multi-folder collections

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- Gate 1: Spec-first for major changes.
Status: PASS. Feature includes `spec.md`, `plan.md`; next step will generate `tasks.md`.
- Gate 2: Postman as source of truth.
Status: PASS. All generated docs derive from collection snapshot/diff.
- Gate 3: Deterministic + safe failure.
Status: PASS. Parser requires strict anchors and aborts without commit on ambiguity.
- Gate 4: Auditability.
Status: PASS. JSON + Markdown artifacts are mandatory outputs.
- Gate 5: Secret hygiene.
Status: PASS. Script excludes cookies/tokens and does not read/write credential stores.

## Project Structure

### Documentation (this feature)

```text
specs/002-postman-html-sync/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── workflow-dispatch-inputs.schema.json
│   ├── postman-html-diff.schema.json
│   └── html-block-contract.md
└── tasks.md
```

### Source Code (repository root)

```text
.github/
└── workflows/
    └── postman-cms-sync.yml

docs/
└── SE_API_Docs_v18.5.html

scripts/
└── postman_cms/
    ├── sync_postman_to_html.mjs
    ├── lib/
    │   ├── parse_collection.mjs
    │   ├── parse_html_blocks.mjs
    │   ├── diff_snapshots.mjs
    │   ├── update_html_blocks.mjs
    │   ├── write_artifacts.mjs
    │   └── utils.mjs
    └── fixtures/
        ├── collection.before.json
        ├── collection.after.json
        └── expected.diff.json

tests/
└── postman_cms/
    ├── parser.test.mjs
    ├── diff.test.mjs
    ├── html-update.test.mjs
    ├── error-codes.test.mjs
    ├── welcome-content.test.mjs
    ├── integration.test.mjs
    └── fixtures.test.mjs
```

**Structure Decision**: Single-repo automation structure using one workflow, one entrypoint script, focused library modules, and targeted tests.

## Implementation Phases

### Phase 0 - Foundations

- Add docs HTML file into repo (`docs/SE_API_Docs_v18.5.html`) as authoritative sync target.
- Add workflow skeleton with `workflow_dispatch` inputs (`release_version`, `release_date`, `release_title`, `dry_run`).
- Add script entrypoint and baseline git resolution (`HEAD~1` on `main`).

### Phase 1 - Core Sync Engine

- Parse Postman collection into normalized snapshot (`folders`, `requests`, params, examples).
- Parse HTML `API_DATA` and `EXAMPLES` JavaScript object blocks safely.
- Compute delta model (added/removed/changed categories/endpoints/params/content).
- Apply minimal deterministic HTML updates for changed blocks only.

### Phase 2 - Reporting and Publishing

- Emit `artifacts/postman_html_diff.json` and `artifacts/postman_html_diff.md`.
- Update release notes block using workflow metadata and computed deltas.
- Wire workflow commit/push behavior (skip on `dry_run`, abort on no changes or parse failure).

### Phase 3 - Validation and Hardening

- Unit tests for parser/diff/update behavior.
- Negative tests for missing/ambiguous HTML anchors.
- Dry-run and non-dry workflow validation paths.
- Ensure idempotency: running twice with same input produces zero file changes on second run.

## Risk Register

- Risk: HTML script block format changes and parser breaks.
Mitigation: strict anchor checks + explicit failure message + no-commit safety.

- Risk: False rename detection for endpoints/folders.
Mitigation: treat uncertain rename as remove+add and surface clearly in diff report.

- Risk: Git baseline missing on first run.
Mitigation: fallback strategy to compare against current file and mark baseline mode in artifact metadata.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | N/A |
