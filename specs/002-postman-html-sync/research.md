# Research Notes: Postman CMS to HTML Sync Automation

## Decision 1: Workflow Trigger Model

- Decision: Use GitHub Actions `workflow_dispatch` only.
- Rationale: Maintainer-controlled, low risk of unintended mass updates, matches stated requirement.
- Alternatives considered:
- Push trigger: rejected due to noisy/unintended runs.
- Schedule trigger: rejected because documentation updates are release-driven.

## Decision 2: Source of Truth Mapping

- Decision: Normalize collection requests by `METHOD + PATH`; map to HTML `API_DATA` and `EXAMPLES`.
- Rationale: Stable key for API identity, independent of display/request names.
- Alternatives considered:
- Name-based mapping: rejected because names change more often than endpoints.
- ID-based mapping from Postman UUIDs: rejected due to portability and readability.

## Decision 3: HTML Update Strategy

- Decision: Patch only known blocks (`API_DATA`, `EXAMPLES`, release notes).
- Rationale: Reduces accidental edits and keeps diffs minimal.
- Alternatives considered:
- Regenerate full HTML: rejected due to high diff noise and greater failure surface.

## Decision 4: Parser Safety Behavior

- Decision: Fail hard if required blocks are missing/ambiguous.
- Rationale: Prevents silent corruption or partial docs state.
- Alternatives considered:
- Best-effort updates: rejected due to integrity risk.

## Decision 5: Runtime Stack

- Decision: Node.js scripts with minimal dependencies.
- Rationale: Good JSON handling, available on GitHub-hosted runners, low setup overhead.
- Alternatives considered:
- Python scripts: acceptable but less aligned with existing JS-object HTML parsing style.
- Heavy framework: rejected for unnecessary complexity.

## Decision 6: Artifact Contract

- Decision: Emit both JSON and Markdown artifacts on every run.
- Rationale: JSON supports tooling; Markdown supports quick reviewer consumption.
- Alternatives considered:
- Markdown only: rejected because difficult to automate downstream checks.
- JSON only: rejected due to lower human readability in PR/workflow review.
