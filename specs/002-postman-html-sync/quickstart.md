# Quickstart: Postman CMS to HTML Sync Automation

## Prerequisites

- Repo contains:
- Postman collection JSON at root.
- HTML target file at `docs/SE_API_Docs_v18.5.html`.
- Node.js 20+.
- GitHub Actions permissions to push to `main`.

## 1. Trigger Manual Sync in GitHub

- Open workflow: `postman-cms-sync`.
- Set inputs:
- `release_version`: e.g., `v18.6`.
- `release_date`: e.g., `2026-02-17`.
- `release_title`: concise changelog title.
- `dry_run`: `true` for verification, `false` to publish.

## 2. Review Outputs

- Download and inspect artifacts:
- `postman_html_diff.json`
- `postman_html_diff.md`
- Validate endpoint/category deltas and HTML block change list.

## 3. Publish

- Re-run with `dry_run=false` after validation.
- Confirm a single sync commit appears on `main`.

## 4. Local Debug Run (optional)

```bash
node scripts/postman_cms/sync_postman_to_html.mjs \
  --collection "SiliconExpert API Collection (Docs + Examples) [Full].postman_collection.json" \
  --html "docs/SE_API_Docs_v18.5.html" \
  --baseline-ref "HEAD~1" \
  --release-version "v18.6" \
  --release-date "2026-02-17" \
  --release-title "Postman sync" \
  --artifacts-dir "artifacts" \
  --dry-run
```

## 5. Failure Handling

- If run fails with parse safety error:
- Inspect workflow logs for missing/ambiguous HTML anchors.
- Fix target HTML structure or parser anchors.
- Re-run in `dry_run=true` first.
