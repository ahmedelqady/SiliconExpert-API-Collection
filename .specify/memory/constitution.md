# SiliconExpert API Workspace Constitution

## Core Principles

### I. Spec-First for Major Changes
All major repository changes must start with Spec Kit artifacts before implementation. For guarded paths (`*.postman_collection.json`, `docs/**`, `scripts/**`, `.github/workflows/**`), feature work must include `spec.md`, `plan.md`, and `tasks.md` in the same pull request.

### II. Postman Is Source of Truth
The Postman collection is the canonical definition of API-facing content. Any generated documentation, endpoint metadata, examples, and release-note API deltas must be derived from the collection, not hand-maintained independently.

### III. Deterministic Automation and Safe Failure
Automation must be deterministic and reproducible from repository state plus explicit workflow inputs. If required source blocks cannot be parsed safely, automation must fail hard and must not commit partial or ambiguous output.

### IV. Verifiable Changes and Auditability
Every automation run must emit human-readable and machine-readable change artifacts. Diffs must clearly identify endpoint/category/parameter/content changes and the baseline commit used for comparison.

### V. Security and Secret Hygiene
No credentials, tokens, or session artifacts may be committed. Generated tools and workflows must avoid leaking cookies or local agent state. `.gitignore` and review checks must protect secret-bearing paths by default.

## Technical Constraints

- Primary automation environment: GitHub Actions (manual `workflow_dispatch` unless explicitly expanded).
- Preferred scripting: shell + Node.js for parsing and transformation.
- HTML updates must be scoped to defined data blocks (e.g., `API_DATA`, `EXAMPLES`, release-note sections), not free-form edits.
- Collection and docs changes must remain reviewable; avoid opaque binary transformations.

## Development Workflow and Quality Gates

- Use feature branches with numeric prefix (`###-name`) via Spec Kit scripts.
- Follow sequence: `/speckit.constitution` -> `/speckit.specify` -> `/speckit.clarify` (when needed) -> `/speckit.plan` -> `/speckit.tasks` -> `/speckit.analyze` -> `/speckit.implement`.
- CI guardrails enforce spec artifacts for major changes; emergency bypass requires explicit PR label (`spec-exempt`) for auditability.
- Any rule changes to guardrails, source-of-truth mapping, or release process require constitution amendment in the same PR.

## Governance

This constitution supersedes local conventions and ad-hoc implementation habits for scoped repository work. Pull requests affecting guarded paths must demonstrate compliance. Amendments require:

1. Updated constitution text.
2. A matching spec entry describing rationale and impact.
3. Confirmation that related guardrails/docs were updated when applicable.

**Version**: 1.0.0 | **Ratified**: 2026-02-17 | **Last Amended**: 2026-02-17
