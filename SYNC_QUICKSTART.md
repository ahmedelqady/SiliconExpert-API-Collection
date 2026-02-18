# Postman CMS Sync: Quick Start Guide

## What It Does

Automatically synchronizes your Postman collection to the HTML documentation (`docs/SE_API_Docs_v18.5.html`):
- ✅ Extracts API endpoints and examples from requests
- ✅ Generates error catalog from response examples
- ✅ Creates home/welcome page from collection metadata
- ✅ Updates release notes
- ✅ Commits changes to git

## Running the Sync

### Via GitHub Actions (Recommended)

1. Go to **Actions** tab in your GitHub repository
2. Select **postman-cms-sync** workflow
3. Click **Run workflow**
4. Fill in the required inputs:
   - **Release version** (e.g., `v18.6.0`)
   - **Release date** (e.g., `2025-02-18`)
   - **Release title** (e.g., `Q1 2025 Release`)
   - **Dry run** (choose `true` to test, `false` to commit)
   - **Baseline ref** (optional, defaults to `HEAD~1`)
5. Click **Run workflow**

### Via Command Line

```bash
# Test run (no commits)
node scripts/postman_cms/sync_postman_to_html.mjs \
  --collection "SiliconExpert API Collection (Docs + Examples) [Full].postman_collection.json" \
  --html "docs/SE_API_Docs_v18.5.html" \
  --release-version v18.6.0 \
  --release-date 2025-02-18 \
  --release-title "Q1 2025 Release" \
  --dry-run true

# Production run (will commit and push)
node scripts/postman_cms/sync_postman_to_html.mjs \
  --collection "SiliconExpert API Collection (Docs + Examples) [Full].postman_collection.json" \
  --html "docs/SE_API_Docs_v18.5.html" \
  --release-version v18.6.0 \
  --release-date 2025-02-18 \
  --release-title "Q1 2025 Release" \
  --dry-run false
```

## Workflow Inputs Explained

| Input | Required | Example | Notes |
|-------|----------|---------|-------|
| `release_version` | Yes | `v18.6.0` | Used in release notes |
| `release_date` | Yes | `2025-02-18` | ISO 8601 format |
| `release_title` | Yes | `Q1 2025 Release` | Descriptive title |
| `dry_run` | Yes | `true` / `false` | `true` = test only, `false` = commit |
| `baseline_ref` | No | `v18.5.0` or `HEAD~2` | Git ref for comparison (default: `HEAD~1`) |

## What Gets Updated

When the sync runs, it updates these HTML blocks:
- `const API_DATA = { ... }` - All endpoints with methods, paths, params
- `const EXAMPLES = { ... }` - Response examples for each endpoint
- `const ERROR_CODES_CONTENT = { ... }` - Error catalog (HTTP + app-level codes)
- `const WELCOME_CONTENT = { ... }` - Home page: title, guidelines, service cards
- `const RELEASE_NOTES_CONTENT = { ... }` - Release history

## Understanding the Output

### Dry Run Output

When you run with `--dry-run true`, you'll get:

```json
{
  "dryRun": true,
  "htmlChanged": true,
  "baselineRef": "HEAD~1",
  "artifacts": [
    "artifacts/postman_html_diff.json",
    "artifacts/postman_html_diff.md",
    "artifacts/postman_html_content_snapshot.json"
  ],
  "summary": {
    "categoriesAdded": 0,
    "categoriesRemoved": 0,
    "categoriesChanged": 0,
    "endpointsAdded": 2,
    "endpointsRemoved": 0,
    "endpointsChanged": 3,
    "errorCodesAdded": 3,
    "errorCodesRemoved": 1,
    "errorCodesChanged": 0,
    "welcomeSectionsChanged": 1
  },
  "htmlBlocksChanged": [
    "API_DATA",
    "EXAMPLES",
    "ERROR_CODES_CONTENT",
    "WELCOME_CONTENT",
    "RELEASE_NOTES_CONTENT"
  ]
}
```

### Artifacts

Check the artifacts after sync:

1. **postman_html_diff.md** - Markdown summary (good for pull requests)
2. **postman_html_diff.json** - Complete diff with all details
3. **postman_html_content_snapshot.json** - Current generated content
4. **sync_output.json** - Sync job summary

## Common Workflows

### Workflow 1: Test Changes Before Committing

```bash
# 1. Make changes to Postman collection
# 2. Run dry test
gh workflow run postman-cms-sync.yml \
  -f release_version=v18.6.0 \
  -f release_date=2025-02-18 \
  -f release_title="Q1 2025 Release" \
  -f dry_run=true

# 3. Review artifacts (download from Actions)
# 4. If good, run production sync
gh workflow run postman-cms-sync.yml \
  -f release_version=v18.6.0 \
  -f release_date=2025-02-18 \
  -f release_title="Q1 2025 Release" \
  -f dry_run=false
```

### Workflow 2: Sync Against Specific Release

```bash
gh workflow run postman-cms-sync.yml \
  -f release_version=v18.6.0 \
  -f release_date=2025-02-18 \
  -f release_title="Q1 2025 Release" \
  -f baseline_ref=v18.5.0 \
  -f dry_run=false
```

### Workflow 3: Local Testing

```bash
# No git required, just generate artifacts
npm run test  # Verify tests pass first

# Run sync locally
node scripts/postman_cms/sync_postman_to_html.mjs \
  --collection "SiliconExpert API Collection (Docs + Examples) [Full].postman_collection.json" \
  --html "docs/SE_API_Docs_v18.5.html" \
  --release-version v18.6.0 \
  --release-date 2025-02-18 \
  --release-title "Q1 2025 Release" \
  --dry-run true
```

## Error Codes: What's Included

The sync automatically extracts error codes from your Postman response examples:

**HTTP Status Codes** (200, 401, 429, 500, etc.)
- Extracted from response code field
- Sorted numerically
- Classified by severity

**Application Status Codes** (0, 5, 10, etc.)
- Extracted from JSON `Status.Code` fields
- Extracted from XML `<Code>` elements
- Deduplicated across endpoints
- Tracked by source endpoints

**Classification** (Severity)
- `auth` - Authentication/authorization errors
- `validation` - Invalid parameters or format errors
- `quota` - Rate limits and usage quotas
- `server` - Server errors and timeouts
- `unknown` - Uncategorized errors

Each error includes:
- **Code** - The error code
- **Meaning** - Description from response
- **Severity** - Classification
- **Action** - Recommended fix
- **Sources** - Which endpoints return this error

## Welcome/Home Page: What's Included

The sync generates home page content from collection metadata:

**From Collection Info:**
- Title (e.g., "SiliconExpert API")
- Subtitle (e.g., "Access electronic component data...")

**From Top-Level Folders:**
- Service area cards (Authentication, Part Search, BOM Operations, etc.)
- Each card includes name and description

**Automatic Guidelines:**
- "Run authentication first..." (if auth endpoint exists)
- "Use Postman examples to validate..."
- "Handle non-success status codes..."
- "Track release notes..."
- "Use endpoint examples..."
- "Keep secrets in secure variables..."

**Base URL:**
- https://api.siliconexpert.com/ProductAPI

## FAQ

**Q: Can I manually edit the HTML after sync?**
A: Yes! The sync only replaces the JavaScript `const` blocks. Other HTML is untouched.

**Q: What if I edit `const API_DATA` manually?**
A: Next sync will overwrite your changes. Manual edits should go outside the const blocks.

**Q: How often should I run sync?**
A: After any significant Postman collection changes (new endpoints, new error examples, updated metadata).

**Q: Can I skip the commit and just get artifacts?**
A: Yes! Use `--dry-run true` to generate artifacts without committing.

**Q: What if the sync fails?**
A: Check the error message, review the diagnostics artifact, and retry. Common issues:
- Missing HTML blocks - verify file exists
- Invalid Postman JSON - validate collection structure
- Git errors - ensure git is configured

**Q: Can I customize error classifications?**
A: Yes! Edit the `classifyErrorKind()` function in `parse_collection.mjs`.

**Q: Can I customize welcome guidelines?**
A: Yes! Edit the `buildWelcomeContent()` function in `parse_collection.mjs`.

## Next Steps

1. ✅ Add response examples to Postman requests (especially error cases)
2. ✅ Update collection `info.name` and `info.description` with good metadata
3. ✅ Organize endpoints into meaningful top-level folders
4. ✅ Run sync with `--dry-run true` to preview changes
5. ✅ Review artifacts to verify everything looks good
6. ✅ Run sync with `--dry-run false` to commit and push

## Learn More

- [Full Implementation Guide](./IMPLEMENTATION_GUIDE.md) - Detailed architecture and data models
- [Test Coverage](./tests/postman_cms/) - 35 automated tests verifying behavior
- [GitHub Actions Docs](https://docs.github.com/en/actions) - Workflow automation
