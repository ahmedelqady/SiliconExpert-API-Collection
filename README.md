# SiliconExpert API Collection Workspace

This repository uses [GitHub Spec Kit](https://github.com/github/spec-kit) to organize feature work with a spec-first workflow.

## Spec Kit Setup (Codex)

Use `uvx` with a pinned release tag for reproducible setup:

```bash
uvx --from 'git+https://github.com/github/spec-kit.git@v0.0.96' specify init --here --ai codex --script sh --force
```

If Codex should load prompts from this repo, export:

```bash
export CODEX_HOME="/Users/ahmedel-qady/Library/CloudStorage/OneDrive-Personal/Postman-Repo/.codex"
```

## Daily Workflow

1. `/speckit.constitution` to maintain project principles.
2. `/speckit.specify` for feature requirements (what/why).
3. `/speckit.clarify` for requirement gaps.
4. `/speckit.plan` for technical design.
5. `/speckit.tasks` for actionable implementation steps.
6. `/speckit.analyze` for consistency checks.
7. `/speckit.implement` for execution.

## Team Policy

Spec-first is required for major changes that touch:

- `*.postman_collection.json`
- `docs/**`
- `scripts/**`
- `.github/workflows/**`

Major-change pull requests must include updated spec artifacts:

- `specs/<feature>/spec.md`
- `specs/<feature>/plan.md`
- `specs/<feature>/tasks.md`

A PR label named `spec-exempt` can bypass the guardrail for urgent fixes.

## Repository Artifacts Added by Spec Kit

- `/.specify` - templates, scripts, constitution memory.
- `/.codex/prompts` - Spec Kit prompt commands for Codex.
