# Feature Specification: Postman CMS to HTML Sync Automation

**Feature Branch**: `002-postman-html-sync`
**Created**: 2026-02-17
**Status**: Implemented
**Input**: User description: "Manually triggered automation that treats Postman collection as CMS, captures API structure/content changes, updates HTML docs sections, and commits changes to GitHub"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Manual Sync Run Updates Docs from Postman (Priority: P1)

As a maintainer, I want to manually trigger a workflow that reads the Postman collection as source of truth and updates relevant HTML documentation sections so docs stay aligned with API content.

**Why this priority**: This is the core value of the feature and eliminates manual drift between collection and docs.

**Independent Test**: Trigger workflow with a known collection change and verify only relevant HTML sections are updated (`API_DATA`, `EXAMPLES`, release-note API delta section) with deterministic output.

**Acceptance Scenarios**:

1. **Given** a collection change in endpoint metadata or docs, **When** the workflow is manually triggered, **Then** the corresponding HTML blocks are updated to match collection content.
2. **Given** no collection API content change, **When** the workflow runs, **Then** no endpoint/content edits are applied outside optional release-note summary policy.

---

### User Story 2 - Run Produces Actionable Change Report (Priority: P1)

As a maintainer, I want each run to produce structured and readable diff artifacts so I can review what changed before or after commit.

**Why this priority**: Without audit artifacts, automated updates are hard to trust and review.

**Independent Test**: Run workflow and verify artifacts include machine-readable JSON diff and human-readable Markdown summary with counts and endpoint-level deltas.

**Acceptance Scenarios**:

1. **Given** a sync run completes, **When** artifacts are inspected, **Then** they include baseline commit identity plus added/removed/changed category/endpoint details.
2. **Given** parameter or method changes in collection endpoints, **When** the run completes, **Then** the change report explicitly flags those contract-relevant changes.

---

### User Story 3 - Safe Failure and Controlled Publishing (Priority: P1)

As a maintainer, I want the workflow to fail safely on parse/mapping errors and avoid partial commits so documentation integrity is preserved.

**Why this priority**: Partial or corrupted docs updates are worse than delayed updates.

**Independent Test**: Force parsing failure (missing/changed HTML block anchors) and verify workflow exits non-zero with no commit, while emitting diagnostics.

**Acceptance Scenarios**:

1. **Given** required HTML anchors are missing or ambiguous, **When** sync runs, **Then** it fails and does not push any commit.
2. **Given** run is in dry-run mode, **When** sync runs successfully, **Then** artifacts are generated but no commit/push is performed.

---

### User Story 4 - Maintainer-Controlled Release Note Metadata (Priority: P2)

As a maintainer, I want to provide release metadata at trigger time so release-note entries are explicit and human-meaningful.

**Why this priority**: Release context should be deliberate rather than inferred.

**Independent Test**: Trigger workflow with `release_version`, `release_date`, and `release_title` inputs and verify release note entry format and content.

**Acceptance Scenarios**:

1. **Given** workflow inputs for release metadata, **When** sync completes, **Then** a release-note entry is added with those values plus computed API delta summary.
2. **Given** empty endpoint delta and configured policy allows no-op notes, **When** run completes, **Then** entry states no API content change.

---

### Edge Cases

- **Same `METHOD + PATH` key**: When two requests normalize to the same key, the first occurrence reuses the stable id from `existingByMethodPath`; subsequent requests with identical key receive a deduplicated slug suffixed `-2`, `-3`, etc. Covered by unit tests in `parser.test.mjs`.
- **Rename vs remove+add**: Identity is based on stable `METHOD + PATH` lookup. Renames with changed path are treated as remove+add and surface as separate entries in the diff. No rename-inference is attempted.
- **Malformed HTML blocks**: If any required `const` block cannot be brace-balanced parsed, the workflow throws and exits non-zero before any write. Covered by `html-update.test.mjs` and integration tests.
- **First-run / baseline missing** *(resolved by FR-003a)*: Workflow falls back to self-comparison (zero structural diff) and marks metadata `baseline.commit = 'fallback-current'`.
- **No content changes with release metadata provided**: A release-note entry is still written with `tag: 'No API Changes'` and the delta summary shows all zeros. HTML is updated only for the `RELEASE_NOTES_CONTENT` block.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Workflow MUST be manually triggerable via GitHub Actions `workflow_dispatch`.
- **FR-002**: Workflow MUST read the Postman collection file in repo as the canonical source for API docs sync.
- **FR-003**: Workflow MUST use `HEAD~1` on `main` as the default baseline for diffing. An optional `baseline_ref` workflow input MUST allow override to any resolvable git ref (branch, tag, or SHA).
- **FR-003a**: When the baseline ref cannot be resolved, or the collection file is absent at that ref (first-run edge), workflow MUST fall back to comparing the current collection against itself (producing zero structural diff) and MUST mark the baseline commit as `fallback-current` in artifact metadata — no error, no partial commit.
- **FR-004**: Workflow MUST detect and classify category-level changes (added, removed, renamed where inferable).
- **FR-005**: Workflow MUST detect and classify endpoint-level changes (added, removed, method/path/params/content changes).
- **FR-006**: Workflow MUST update only the five declared HTML sections: `API_DATA`, `EXAMPLES`, `ERROR_CODES_CONTENT`, `WELCOME_CONTENT`, and `RELEASE_NOTES_CONTENT`. All other HTML content is read-only.
- **FR-007**: Workflow MUST fail if required HTML anchor blocks cannot be safely parsed.
- **FR-008**: On failure, workflow MUST NOT commit or push partial HTML updates.
- **FR-009**: Workflow MUST generate a machine-readable diff artifact (`postman_html_diff.json`).
- **FR-010**: Workflow MUST generate a human-readable summary artifact (`postman_html_diff.md`).
- **FR-011**: Workflow MUST support `dry_run` input that disables commit/push while still generating artifacts.
- **FR-012**: Workflow MUST support run-time release metadata inputs (`release_version`, `release_date`, `release_title`).
- **FR-013**: In non-dry runs with successful updates, workflow MUST auto-commit and push to `main`.
- **FR-014**: Commit message format MUST include release context and indicate docs sync automation.
- **FR-015**: Workflow MUST preserve deterministic output ordering to reduce diff noise. Ordering is defined as: endpoint keys and category keys sorted alphabetically by slug; params preserved in collection order; error codes sorted by code string ascending.
- **FR-016**: Workflow MUST avoid including cookies/tokens/session artifacts in generated outputs.

### Key Entities *(include if feature involves data)*

- **Collection Snapshot**: Normalized representation of folders, requests, methods, paths, params, descriptions, and examples extracted from Postman JSON.
- **Baseline Snapshot**: Same normalized model extracted from baseline commit collection file.
- **Change Report**: Structured delta document summarizing category, endpoint, parameter, and content changes between snapshots.
- **Sync Run Config**: Workflow inputs controlling behavior (`release_*`, `dry_run`, optional baseline override).
- **HTML Target Blocks**: Explicit editable sections in docs HTML that map to generated API content.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Maintainer can run one manual workflow and complete collection-to-HTML sync without local scripting.
- **SC-002**: For controlled fixture changes, generated endpoint/category deltas match expected results in 100% of validation runs.
- **SC-003**: Workflow produces both JSON and Markdown artifacts in every run (success and failure diagnostics where applicable).
- **SC-004**: In parse-failure scenarios, workflow performs zero commits and exits non-zero consistently.
- **SC-005**: In successful non-dry runs with content changes, exactly one automation commit is pushed to `main`.
