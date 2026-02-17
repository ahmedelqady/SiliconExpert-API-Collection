# Tasks: Spec Kit Bootstrap for Postman Workspace

## Phase 1 - Bootstrap assets

- [x] T001 Initialize Spec Kit in-place with Codex profile.
- [x] T002 Verify generated `.specify/` and `.codex/prompts/` assets.

## Phase 2 - Policy enforcement

- [x] T003 Add `scripts/ci/spec_guard.sh` with guarded path checks.
- [x] T004 Add `.github/workflows/spec-guard.yml` to run guard on pull requests.
- [x] T005 Add bypass support via `spec-exempt` PR label.

## Phase 3 - Team usage and safety

- [x] T006 Add setup and daily workflow runbook in `README.md`.
- [x] T007 Add `.gitignore` rules to keep only `.codex/prompts/*.md` tracked.

## Validation

- [x] T008 Run local shell syntax validation (`bash -n`) for guard script.
- [x] T009 Dry-run guard behavior for both pass/fail scenarios.
