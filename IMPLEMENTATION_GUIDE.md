# Postman CMS Sync: Expanded Plan Implementation Guide

## Overview

This guide documents the expanded Postman-to-HTML automation system that extends the existing sync workflow to include:
- **Error Codes section** generation from collection responses
- **Home/Get Started section** generation from collection metadata
- Existing: API endpoints, examples, and release notes

The automation remains **manually triggered** via GitHub Actions with **safe-fail** behavior and Postman collection as the primary source of truth.

## Architecture

### Core Components

#### 1. **Parse Collection** (`scripts/postman_cms/lib/parse_collection.mjs`)
Transforms Postman collection into normalized snapshot with:
- API endpoint catalog
- Error code catalog (HTTP + application-level)
- Welcome/home content (title, subtitle, guidance, service cards)
- Examples and response schemas

**Key Functions:**
- `parseCollection(collection, options)` - Main parser
- `buildErrorCatalog(entries)` - Extract and classify errors
- `buildWelcomeContent(collection, folders, hasAuthEndpoint)` - Generate home page content

#### 2. **Diff Snapshots** (`scripts/postman_cms/lib/diff_snapshots.mjs`)
Compares baseline vs current snapshots across all domains:
- API structure changes (added/removed/changed endpoints)
- Error code changes (added/removed/changed codes)
- Welcome content changes (title, subtitle, cards, guidelines)

**Output:**
```javascript
{
  summary: {
    endpointsAdded: 0,
    endpointsRemoved: 0,
    endpointsChanged: 0,
    errorCodesAdded: 0,
    errorCodesRemoved: 0,
    errorCodesChanged: 0,
    welcomeSectionsChanged: 0
  },
  endpoints: { added, removed, changed },
  errorCodes: { added, removed, changed },
  welcome: { changedSections },
  htmlBlocksChanged: ['API_DATA', 'EXAMPLES', 'ERROR_CODES_CONTENT', 'WELCOME_CONTENT', 'RELEASE_NOTES_CONTENT']
}
```

#### 3. **Parse HTML Blocks** (`scripts/postman_cms/lib/parse_html_blocks.mjs`)
Extracts editable JavaScript constants from HTML:
- `const API_DATA = { ... };`
- `const EXAMPLES = { ... };`
- `const ERROR_CODES_CONTENT = { ... };`
- `const WELCOME_CONTENT = { ... };`
- `const RELEASE_NOTES_CONTENT = { ... };`

**Robustness:**
- Handles nested braces, strings, comments
- Validates all required blocks exist
- Fails hard if any anchor is missing/ambiguous

#### 4. **Update HTML Blocks** (`scripts/postman_cms/lib/update_html_blocks.mjs`)
Patches only approved HTML sections with new data:
- Preserves formatting and surrounding code
- Replaces entire `const` definition blocks
- Fails if required anchors not found

## Data Models

### Error Codes Model

```javascript
{
  statusCodes: [
    {
      code: "401",                    // String code from response
      meaning: "Authentication Failed",
      severity: "auth",               // auth|validation|quota|server|unknown
      action: "Authenticate again or verify credentials/permissions.",
      sources: ["POST /auth", "GET /search"]  // Endpoints where error appears
    }
  ],
  httpCodes: [
    {
      code: 401,                      // Numeric HTTP status
      meaning: "Unauthorized",
      description: "Observed in POST /auth",
      severity: "auth"
    }
  ],
  notes: [
    "Always evaluate both HTTP status and payload status code fields.",
    "Retry logic should include backoff for quota or transient failures.",
    "Authentication/session errors should trigger a fresh authenticate call."
  ]
}
```

### Welcome Content Model

```javascript
{
  title: "SiliconExpert API",
  subtitle: "Access electronic component data and manage BOMs.",
  baseUrl: "https://api.siliconexpert.com/ProductAPI",
  guidelinesLeft: [
    "Run authentication first and reuse session cookies...",
    "Use Postman examples to validate request shape...",
    "Handle non-success status codes with deterministic retry/error handling."
  ],
  guidelinesRight: [
    "Track release notes for integration-impacting changes.",
    "Use endpoint examples in docs for quick troubleshooting.",
    "Keep environment secrets in secure variables, never in committed files."
  ],
  supportCards: [
    {
      title: "Authentication",
      description: "User authentication endpoints",
      routeType: "category",
      section: "auth"
    },
    {
      title: "Part Search",
      description: "Search for parts by various criteria",
      routeType: "category",
      section: "search"
    }
  ]
}
```

## Workflow Execution

### GitHub Actions Input Parameters

```yaml
inputs:
  release_version:    # e.g., "v18.6.0"
  release_date:       # e.g., "2025-02-18"
  release_title:      # e.g., "Q1 2025 Release"
  dry_run:            # boolean: true = artifacts only, false = commit/push
  baseline_ref:       # optional: git ref for comparison (default: HEAD~1)
```

### Execution Flow

```
1. Parse Postman collection
   ↓
2. Build snapshots:
   - Categories
   - Endpoints (with params, examples, responses)
   - Error codes (HTTP + app-level, classified by severity)
   - Welcome content (title, cards, guidelines)
   ↓
3. Load baseline snapshot from baseline_ref
   ↓
4. Diff all domains
   - API structure/content
   - Error codes
   - Welcome content
   ↓
5. Generate artifacts:
   - postman_html_diff.json (full diff)
   - postman_html_diff.md (markdown summary)
   - postman_html_content_snapshot.json (current snapshot)
   ↓
6. Patch HTML blocks (if not dry-run)
   - API_DATA
   - EXAMPLES
   - ERROR_CODES_CONTENT
   - WELCOME_CONTENT
   - RELEASE_NOTES_CONTENT
   ↓
7. Commit and push (if not dry-run and changes detected)
```

### Artifact Structure

#### `postman_html_diff.json`
Complete diff object with metadata:
```javascript
{
  baseline: { commit, fileHash, collectionPath },
  current: { commit, fileHash, collectionPath },
  summary: { endpointsAdded, ..., welcomeSectionsChanged },
  endpoints: { added, removed, changed },
  errorCodes: { added, removed, changed },
  welcome: { changedSections },
  htmlBlocksChanged: ['API_DATA', 'ERROR_CODES_CONTENT', 'WELCOME_CONTENT', ...]
}
```

#### `postman_html_diff.md`
Markdown summary for pull request/release notes:
```markdown
## Postman CMS Sync: v18.6.0

### API Delta
- Endpoints Added: 2
- Endpoints Removed: 0
- Endpoints Changed: 3

### Error Codes
- Added: 3 (new HTTP 429, 401, 400)
- Removed: 1 (deprecated 503)
- Changed: 2

### Welcome/Home
- Sections Changed: 2 (title, supportCards)

### HTML Blocks Updated
- API_DATA
- ERROR_CODES_CONTENT
- WELCOME_CONTENT
- RELEASE_NOTES_CONTENT
```

#### `postman_html_content_snapshot.json`
Snapshot of current generated content:
```javascript
{
  api_data: { ... },
  examples: { ... },
  error_codes: { ... },
  welcome_content: { ... }
}
```

## Error Classification Rules

| Pattern | Severity | Recommended Action |
|---------|----------|-------------------|
| `auth\|unauthor\|forbidden\|denied\|session\|login\|credential` | `auth` | Authenticate again or verify credentials/permissions |
| `quota\|limit\|rate\|throttle` | `quota` | Reduce request frequency and retry with backoff |
| `invalid\|missing\|required\|bad request\|format\|parse\|validation` | `validation` | Validate required parameters and input formats |
| `server\|internal\|timeout\|unavailable\|error` | `server` | Retry later; escalate if issue persists |
| (default) | `unknown` | Inspect message and endpoint documentation |

## Extension Points

### Add New Error Classification Rule

**File:** `scripts/postman_cms/lib/parse_collection.mjs`

```javascript
function classifyErrorKind(code, message, context = '') {
  const text = `${code} ${message} ${context}`.toLowerCase();
  
  // Add new pattern here:
  if (/new-pattern/.test(text)) return 'new_severity';
  
  // ... existing rules
  return 'unknown';
}
```

### Add New Welcome Guideline

**File:** `scripts/postman_cms/lib/parse_collection.mjs`

```javascript
export function buildWelcomeContent(collection, topFolders, hasAuthEndpoint) {
  // ... existing code
  
  const checklistLeft = [
    // Add new guideline here
    'New guidance item.',
    // ... existing
  ];
  
  // ... existing code
}
```

## Testing

### Unit Tests (35 passing)

#### Error Codes Tests
- `error-codes.test.mjs` (10 tests)
- Verify HTTP code extraction
- Verify app-level status code extraction from JSON/XML
- Verify error classification and recommendations
- Verify source tracking and deduplication

#### Welcome Content Tests
- `welcome-content.test.mjs` (12 tests)
- Verify title/subtitle extraction
- Verify markdown stripping
- Verify service card generation
- Verify deterministic guidelines
- Verify auth-first guidance inclusion

#### Integration Tests
- `integration.test.mjs` (8 tests)
- **Scenario 1**: New HTTP 401/403 triggers error block update
- **Scenario 2**: Folder rename triggers welcome update
- **Scenario 3**: Collection description change updates welcome only
- **Scenario 4**: Missing anchor causes hard fail
- **Scenario 5**: Error block patches correctly
- **Scenario 6**: Idempotency - second run produces no diff
- **Scenario 7**: Error block updates only on actual changes
- **Scenario 8**: Multiple endpoints with same error consolidate

### Run Tests

```bash
npm test
```

Output should show:
```
✔ 35 tests passing
ℹ duration_ms 96.834167
```

## Validation Against Requirements

### Phase A: Foundations ✅
- ✅ Docs file exists at `/docs/SE_API_Docs_v18.5.html`
- ✅ Parser anchors verified for error-codes and welcome blocks
- ✅ All 5 required `const` blocks present in HTML

### Phase B: Models ✅
- ✅ `buildErrorCatalog()` - Extract HTTP codes, app-level codes, classify
- ✅ `buildWelcomeContent()` - Generate title, cards, guidelines

### Phase C: Diff + Update ✅
- ✅ Extended diff schema with `errorCodes` and `welcome` domains
- ✅ Extended updater to patch error-codes and welcome blocks
- ✅ Preserves existing API_DATA, EXAMPLES, RELEASE_NOTES patches

### Phase D: Reporting + Publish ✅
- ✅ Error/home deltas included in Markdown summary
- ✅ Delta counts in release note entry
- ✅ Dry-run and fail-safe commit rules preserved

### Phase E: Validation ✅
- ✅ Unit tests: error extraction, welcome generation, ordering
- ✅ Integration tests: all 8 scenarios passing
- ✅ Negative tests: missing anchor → fail, no commit
- ✅ Idempotency: second run with same input yields zero diff

## Safe-Fail Behavior

### Conditions for No Commit

1. **Dry-run mode enabled** (`--dry-run true`)
   - Artifacts generated and uploaded
   - No changes committed to repo

2. **No HTML changes detected**
   - HTML content is identical before/after patch
   - Artifacts still generated showing diff

3. **Required HTML block missing**
   - Script fails with descriptive error
   - Diagnostics uploaded to artifacts
   - No commit attempted

4. **Collection parsing fails**
   - Graceful error handling with line context
   - Diagnostics artifact created
   - No commit attempted

### Error Recovery

If sync fails:
1. Check artifacts for diagnostics
2. Verify Postman collection JSON is valid
3. Verify HTML file contains all 5 required blocks
4. Re-run with `dry_run=true` to test without committing
5. Address issues and retry

## Usage Examples

### Example 1: Dry-run with new error codes

```bash
# No changes committed, artifacts show what would update
gh workflow run postman-cms-sync.yml \
  -f release_version=v18.6.0 \
  -f release_date=2025-02-18 \
  -f release_title="Q1 2025 Release" \
  -f dry_run=true
```

### Example 2: Production sync with specific baseline

```bash
# Compare against specific git commit
gh workflow run postman-cms-sync.yml \
  -f release_version=v18.6.0 \
  -f release_date=2025-02-18 \
  -f release_title="Q1 2025 Release" \
  -f baseline_ref=v18.5.0 \
  -f dry_run=false
```

### Example 3: Quick validation

```bash
# Run locally to validate before commit
node scripts/postman_cms/sync_postman_to_html.mjs \
  --collection "SiliconExpert API Collection (Docs + Examples) [Full].postman_collection.json" \
  --html "docs/SE_API_Docs_v18.5.html" \
  --release-version v18.6.0 \
  --release-date 2025-02-18 \
  --release-title "Q1 2025 Release" \
  --dry-run true
```

## Troubleshooting

### Issue: "Missing or ambiguous anchor for ERROR_CODES_CONTENT"

**Cause:** HTML file doesn't contain the required block.

**Solution:** 
1. Verify HTML file location is correct
2. Search for `const ERROR_CODES_CONTENT` in HTML
3. If missing, add placeholder:
```javascript
const ERROR_CODES_CONTENT = { statusCodes: [], httpCodes: [], notes: [] };
```

### Issue: Error codes showing as empty

**Cause:** Collection responses don't contain status code examples.

**Solution:**
1. Add response examples to Postman requests
2. Include JSON payloads with `Status.Code` or `status.code` fields
3. Re-run sync

### Issue: Welcome content not updating

**Cause:** Collection metadata hasn't changed (title/description same).

**Solution:**
1. Check diff artifact to see what changed
2. Welcome updates only when collection info or top-level folders change
3. This is expected behavior (idempotency)

## Performance Considerations

- **Collection parsing**: ~1-2 seconds (depends on endpoint count)
- **Diff generation**: ~100ms
- **HTML patching**: ~50ms
- **Total workflow**: ~30-60 seconds (includes GitHub Actions overhead)

## Future Enhancements

1. **Custom error mappings** - Allow user-defined error classification rules
2. **Changelog auto-generation** - Extract breaking changes from error diffs
3. **SDK generation** - Generate TypeScript/Python SDK from API data
4. **API schema export** - Generate OpenAPI/GraphQL schemas from collection
5. **Postman integration** - Bi-directional sync with Postman workspace

## References

- Postman Collection Format: https://schema.getpostman.com/json/collection/v2.1.0/collection.json
- GitHub Actions: https://docs.github.com/en/actions
- Node.js fs API: https://nodejs.org/api/fs.html
