# Feature Specification: Postman–HTML Bootstrap Content Editor

**Feature Branch**: `003-postman-html-bootstrap-editor`
**Created**: 2026-02-18
**Status**: Draft
**Input**: "Store doc contents of both postman and the html file. I can see both contents related to endpoint or category or example. It is ok to have null in both, then I can have window to edit both, copy paste contents, and apply to both files regardless of which source has been changed. The postman remains the main editor, and this step is to run for first time to sync both sides and then we can easily run it or edit manually if needed."

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Side-by-Side Content Comparison (Priority: P1)

As a maintainer, I want to load both the Postman collection and the HTML documentation file into a browser-based tool and see their content side by side for every endpoint, category, and example block so I can understand where the two sources diverge.

**Why this priority**: Without visibility into the current state of both sources, any merge decision is blind. This is the entry point of the entire bootstrap flow.

**Independent Test**: Load a known collection and HTML file into the tool. Verify that every endpoint ID present in either source appears as a row in the comparison view with both sides populated (or null-indicated when absent on one side).

**Acceptance Scenarios**:

1. **Given** a Postman collection and an HTML doc are loaded, **When** the comparison view renders, **Then** every endpoint slug appears once, with Postman content on the left and HTML content on the right, and null/missing content is visually distinguished.
2. **Given** an endpoint exists only in Postman but not in `API_DATA`, **When** the view renders, **Then** the HTML side shows an empty/null placeholder and the row is marked as "Postman only".
3. **Given** an endpoint exists only in `API_DATA` but not in the Postman collection, **When** the view renders, **Then** the Postman side shows an empty/null placeholder and the row is marked as "HTML only".
4. **Given** both sources have content for the same endpoint, **When** the content differs, **Then** the row is visually flagged as "Conflict" so the maintainer can review.

---

### User Story 2 — Per-Field Editing and Resolution (Priority: P1)

As a maintainer, I want to edit the content of either side (Postman or HTML) for any endpoint, category, or example, and choose which version to apply, so I can produce a single agreed-upon version without leaving the browser.

**Why this priority**: Read-only comparison is insufficient — the bootstrap requires manual human judgement to resolve conflicts and fill gaps. In-place editing avoids external round-trips.

**Independent Test**: Load mismatched content for one endpoint. Edit the HTML side's description field. Mark it as the "winner". Verify the pending-changes list reflects the edit and that neither file is modified until Apply is explicitly triggered.

**Acceptance Scenarios**:

1. **Given** a row is in Conflict or one-sided state, **When** the maintainer clicks "Use Postman" or "Use HTML", **Then** the chosen side's content is copied to a pending resolved state.
2. **Given** neither existing value is satisfactory, **When** the maintainer types in an editable field, **Then** the custom value is captured as the resolved value for that field.
3. **Given** an endpoint has a null value on either side, **When** the maintainer enters a value, **Then** the null placeholder is replaced and the field is marked as resolved.
4. **Given** several fields are resolved, **When** the maintainer reviews the pending-changes summary, **Then** every resolved field is listed with its before/after values before any write occurs.

---

### User Story 3 — Apply to Both Files (Priority: P1)

As a maintainer, I want to download the updated Postman collection and HTML documentation files with all resolved content applied, so I can replace both source files in the repository in a single step.

**Why this priority**: The bootstrap is only complete when both files are updated consistently. Partial updates (one file only) would re-introduce the divergence the tool is designed to eliminate.

**Independent Test**: Resolve all conflicts in a loaded session, click Apply, and verify that two downloadable files are produced — a modified `.postman_collection.json` and a modified `.html` — each reflecting only the resolved changes and leaving all other content untouched.

**Acceptance Scenarios**:

1. **Given** resolved changes are pending, **When** Apply is triggered, **Then** the tool produces an updated Postman collection JSON with the resolved content written into the correct request description / example response fields.
2. **Given** resolved changes are pending, **When** Apply is triggered, **Then** the tool produces an updated HTML file with `API_DATA`, `EXAMPLES`, `WELCOME_CONTENT`, and `ERROR_CODES_CONTENT` blocks reflecting the resolved content, with correct const formatting preserved.
3. **Given** a field was not resolved (left as-is), **When** Apply runs, **Then** the original value in each file is preserved unchanged.
4. **Given** Apply completes, **When** the maintainer replaces both files in the repository, **Then** the subsequent regular sync run (`002-postman-html-sync`) produces zero structural diff because both sources now agree.

---

### User Story 4 — Block-Level Coverage (Priority: P2)

As a maintainer, I want the comparison and editing to cover all four curated content blocks — endpoint metadata (`API_DATA`), code examples (`EXAMPLES`), welcome/intro content (`WELCOME_CONTENT`), and error codes (`ERROR_CODES_CONTENT`) — so the bootstrap is comprehensive.

**Why this priority**: Partial coverage would leave some blocks unsynchronised and degrade the value of the bootstrap.

**Independent Test**: Load files. Verify that WELCOME_CONTENT and ERROR_CODES_CONTENT are present in the comparison view alongside per-endpoint API_DATA and EXAMPLES.

**Acceptance Scenarios**:

1. **Given** the tool loads both files, **When** the maintainer selects the "Welcome" view, **Then** `WELCOME_CONTENT` fields (title, subtitle, guidelines, support cards) from both sources are displayed for comparison and editing.
2. **Given** the tool loads both files, **When** the maintainer selects the "Error Codes" view, **Then** `ERROR_CODES_CONTENT` status-code and HTTP-code tables from both sources are displayed for comparison and editing.
3. **Given** resolved changes to WELCOME_CONTENT or ERROR_CODES_CONTENT, **When** Apply runs, **Then** the correct const blocks in the HTML and the appropriate collection-level description fields in Postman are updated.

---

### User Story 5 — No-Install, Offline Operation (Priority: P2)

As a maintainer, I want the tool to run entirely in the browser with no server, no install step, and no network calls so it is safe to use with sensitive collection content and works in restricted environments.

**Why this priority**: The Postman collection may contain internal API paths. A server-based tool would require hosting, credentials, and network exposure. A standalone file eliminates all of these concerns.

**Independent Test**: Open the tool HTML file from the filesystem (file:// URL) with no network connection. Load both files via the browser File API. Verify all comparison, editing, and export functions work without any network request.

**Acceptance Scenarios**:

1. **Given** the tool HTML is opened via `file://` in a browser, **When** both files are loaded via drag-and-drop or file picker, **Then** the comparison view renders without any network calls.
2. **Given** Apply is triggered offline, **When** output files are generated, **Then** they are offered as browser downloads with no upload or external transmission.
3. **Given** the tool is a single `.html` file, **When** a new maintainer opens it, **Then** no installation, package manager, or server setup is required.

---

## Functional Requirements

### FR-001 — Dual-File Loading
The tool MUST accept both a Postman collection (`.json`) and the HTML documentation file (`.html`) via browser file picker or drag-and-drop on the same load screen. Both files MUST be required before the comparison view is shown.

### FR-002 — Postman Content Extraction
The tool MUST parse the Postman collection using the same normalisation logic as `parse_collection.mjs` (endpoint slug generation, folder → category mapping, example extraction, error code extraction, welcome content extraction) to produce a comparable in-memory snapshot.

### FR-003 — HTML Content Extraction
The tool MUST parse the five managed `const` blocks from the HTML file using the same brace-balanced parser as `parse_html_blocks.mjs` (`API_DATA`, `EXAMPLES`, `WELCOME_CONTENT`, `ERROR_CODES_CONTENT`, `RELEASE_NOTES_CONTENT`) into in-memory objects. `RELEASE_NOTES_CONTENT` is read-only (not editable in this tool).

### FR-004 — Unified Endpoint Registry
The tool MUST merge endpoint slugs from both sources into a single list. Endpoints present in only one source MUST appear with a null/empty placeholder on the missing side.

### FR-005 — Conflict Classification
For each endpoint and each block, the tool MUST classify the state as one of: `match` (both sides identical), `conflict` (both sides present but different), `postman-only` (absent in HTML), `html-only` (absent in Postman), or `null-both` (absent in both).

### FR-006 — Per-Block Navigation
The tool MUST provide separate views for: (a) endpoint metadata (`API_DATA`), (b) code examples (`EXAMPLES`), (c) welcome content (`WELCOME_CONTENT`), (d) error codes (`ERROR_CODES_CONTENT`). Each view MUST display all relevant rows and their conflict state.

### FR-007 — Resolution Actions
For any row, the tool MUST support: "Use Postman" (copy Postman value to resolved), "Use HTML" (copy HTML value to resolved), and free-form text editing of the resolved value. Resolution MUST be per-field, not per-endpoint-block.

### FR-008 — Pending Changes Summary
The tool MUST maintain a live pending-changes list showing every resolved field with its source-before and resolved-after values. No file write occurs until the maintainer explicitly triggers Apply.

### FR-009 — Apply — HTML Output
When Apply is triggered, the tool MUST produce a modified HTML file where the four editable `const` blocks (`API_DATA`, `EXAMPLES`, `WELCOME_CONTENT`, `ERROR_CODES_CONTENT`) are serialised with the correct 12-space indentation format (matching `serializeConstObject` behaviour). `RELEASE_NOTES_CONTENT` MUST remain untouched.

### FR-010 — Apply — Postman Output
When Apply is triggered, the tool MUST produce a modified Postman collection JSON where the resolved content is written into the correct fields: request `description` for endpoint metadata, `response[].body` for examples, and the collection-level `description` for welcome content. The collection structure (folders, IDs, auth, scripts) MUST be preserved unchanged.

### FR-011 — Download Only
Both output files MUST be offered as browser downloads. No server upload, no clipboard injection, no network call of any kind during Apply.

### FR-012 — Null-Safe Round-Trip
If a field was not resolved (maintainer took no action), the original value in each file MUST be preserved exactly, including whitespace and formatting.

### FR-013 — Idempotency Signal
After Apply, if both output files are loaded back into the tool, the comparison MUST show all rows as `match` (zero conflicts) for any fields that were resolved. This is the definition of a successful bootstrap.

### FR-014 — Standalone Delivery
The tool MUST be delivered as a single self-contained HTML file with no external CDN dependencies, embeddable fonts, or runtime module fetches. All parsing and serialisation logic MUST be inlined or bundled.

---

## Success Criteria

1. A maintainer with no prior knowledge of the tool can open it, load both files, review all conflicts, resolve them, and download both output files in a single browser session without any setup.
2. After the bootstrap outputs are committed, the `002-postman-html-sync` workflow run produces a diff report with zero endpoint, error-code, and welcome-section changes (only `RELEASE_NOTES_CONTENT` updated).
3. The tool correctly identifies all content blocks present in either source — no endpoint slug is silently dropped or duplicated.
4. Every resolved field appears verbatim in the downloaded output files — no silent truncation, encoding change, or structure loss.
5. The tool operates fully offline — zero outbound network requests during any operation (verified by browser DevTools Network panel).

---

## Assumptions

- The Postman collection follows the v2.1.0 schema (same as current collection).
- The HTML file contains exactly the five managed `const` blocks with the 12-space indent convention.
- The maintainer uses a modern desktop browser (Chrome, Firefox, Edge, Safari) with File API support.
- The bootstrap is a one-time or occasional operation; performance for collections up to 15 MB and up to 500 endpoints is sufficient.
- `RELEASE_NOTES_CONTENT` is excluded from editing because it is auto-generated by the `002-postman-html-sync` workflow and should not be hand-edited.
- The Postman collection is the intended long-term master; the HTML curated content is the initial source for descriptions and examples that have been hand-crafted but not yet reflected back in Postman.

---

## Out of Scope

- Real-time collaborative editing.
- Saving session state between browser loads.
- Editing `RELEASE_NOTES_CONTENT`.
- Automatic conflict resolution without human input.
- Writing directly to the filesystem (no server component).
- Integration with the GitHub Actions workflow (this is a local bootstrap tool only).
