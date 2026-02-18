# Postman CMS Sync: Automated Documentation Updates

Welcome to the Postman-to-HTML automation system! This tool automatically synchronizes your Postman API collection to HTML documentation, including API endpoints, error codes, examples, and welcome content.

## 🚀 Quick Start

**First time?** Start here: [SYNC_QUICKSTART.md](./SYNC_QUICKSTART.md)

**Want details?** Read: [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md)

**Need validation proof?** See: [VALIDATION_REPORT.md](./VALIDATION_REPORT.md)

## ⚡ 30-Second Overview

1. **You have:** Postman collection with endpoints, responses, examples
2. **We provide:** Automated sync to HTML documentation
3. **Gets synced:**
   - API endpoints and parameters
   - Response examples
   - Error codes (HTTP + app-level)
   - Welcome/home page
   - Release notes
4. **How often:** Whenever you trigger it (manual via GitHub Actions)
5. **Safety:** Dry-run mode lets you preview before committing

## 📋 What This Does

### Error Codes Section
Automatically builds an error catalog from your Postman responses:

```
Error Code: 401 (Authentication Failed)
├─ Severity: auth
├─ Action: Authenticate again or verify credentials/permissions
├─ Sources: POST /auth, GET /search
└─ HTTP Status: 401 Unauthorized
```

**Extracts:**
- HTTP status codes (200, 401, 429, 500, etc.)
- Application-level codes from JSON/XML responses
- Severity classification
- Endpoint sources

### Welcome/Home Page
Generates home page content from collection metadata:

```
Title: SiliconExpert API
Subtitle: Access electronic component data and manage BOMs

Service Areas:
├─ Authentication (user authentication endpoints)
├─ Part Search (search for parts by various criteria)
└─ BOM Operations (manage bills of materials)

Getting Started:
├─ Run authentication first and reuse session cookies
├─ Use Postman examples to validate request shape
├─ Handle non-success status codes with retry logic
└─ Track release notes for integration-impacting changes
```

**Generates:**
- Title and subtitle from collection info
- Service cards from top-level folders
- Best practices guidelines
- Base URL

## 🎯 Core Features

| Feature | Status | Details |
|---------|--------|---------|
| Error Extraction | ✅ | HTTP + app-level codes, classifications, actions |
| Welcome Generation | ✅ | Collection metadata, service cards, guidelines |
| API Endpoints | ✅ | Methods, paths, parameters, examples |
| Response Examples | ✅ | Request/response pairs from Postman |
| Release Notes | ✅ | Version, date, title, change summary |
| Diff Reporting | ✅ | JSON and Markdown artifacts |
| Dry-Run Mode | ✅ | Test without committing |
| Safe-Fail | ✅ | Missing anchors → fail, no partial updates |
| Idempotency | ✅ | Second run with same input = zero diff |

## 📊 Test Coverage

✅ **35 tests, 100% passing**

- 10 error code extraction tests
- 12 welcome content tests
- 8 integration scenario tests
- 5 additional parser/diff tests

```bash
npm test
# ✔ 35 tests passing
```

## 📚 Documentation

| Document | Purpose |
|----------|---------|
| [SYNC_QUICKSTART.md](./SYNC_QUICKSTART.md) | How to use (for humans) |
| [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md) | Architecture details (for developers) |
| [VALIDATION_REPORT.md](./VALIDATION_REPORT.md) | Proof of completion (for stakeholders) |

## 🔄 Workflow

### Step 1: Make Postman Changes
Update your collection with:
- New endpoints
- Better descriptions
- Response examples (especially errors!)
- Updated metadata

### Step 2: Run Sync (Dry-Run)
```bash
gh workflow run postman-cms-sync.yml \
  -f release_version=v18.6.0 \
  -f release_date=2025-02-18 \
  -f release_title="Q1 2025 Release" \
  -f dry_run=true
```

### Step 3: Review Artifacts
Check what would change:
- `postman_html_diff.md` - Markdown summary
- `postman_html_diff.json` - Complete diff
- `postman_html_content_snapshot.json` - Generated content

### Step 4: Commit Changes
```bash
gh workflow run postman-cms-sync.yml \
  -f release_version=v18.6.0 \
  -f release_date=2025-02-18 \
  -f release_title="Q1 2025 Release" \
  -f dry_run=false
```

## 💾 What Gets Updated

The sync patches these blocks in your HTML:

```javascript
const API_DATA = { ... }              // Endpoints, methods, paths
const EXAMPLES = { ... }              // Request/response examples
const ERROR_CODES_CONTENT = { ... }   // Error catalog ✨ NEW
const WELCOME_CONTENT = { ... }       // Home page ✨ NEW
const RELEASE_NOTES_CONTENT = { ... } // Release history
```

Everything else stays untouched!

## ⚙️ Configuration

### Required Inputs
- `release_version` - Version label (e.g., `v18.6.0`)
- `release_date` - Release date (e.g., `2025-02-18`)
- `release_title` - Release title (e.g., `Q1 2025 Release`)
- `dry_run` - `true` (test only) or `false` (commit)

### Optional Inputs
- `baseline_ref` - Git ref for comparison (default: `HEAD~1`)

## 🧪 Test Scenarios

All passing ✅

1. **New error codes** - Added to error catalog
2. **Folder renames** - Welcome section updates
3. **Collection changes** - Welcome updates appropriately
4. **Missing anchors** - Fails hard, no commit
5. **HTML patches** - All blocks update correctly
6. **Idempotency** - Second run = zero diff
7. **Error changes only** - Other blocks unaffected
8. **Multiple sources** - Error codes deduplicated

## 🚦 Safety Features

- ✅ **Dry-run mode** - Preview before commit
- ✅ **Anchor validation** - Fails if required blocks missing
- ✅ **No partial updates** - All or nothing
- ✅ **Idempotent** - Safe to run multiple times
- ✅ **Git integration** - Clean commits with descriptions
- ✅ **Graceful degradation** - Handles edge cases

## 🆘 Troubleshooting

**Q: Sync failed with "Missing anchor for ERROR_CODES_CONTENT"**
A: Your HTML file doesn't have the required block. Add it:
```javascript
const ERROR_CODES_CONTENT = { statusCodes: [], httpCodes: [], notes: [] };
```

**Q: Error codes are empty**
A: Your Postman responses don't have examples. Add response examples to requests!

**Q: Nothing changed but I expected updates**
A: The automation is working correctly - there were no actual changes to sync.

**Q: Can I customize error classifications?**
A: Yes! Edit `classifyErrorKind()` in `scripts/postman_cms/lib/parse_collection.mjs`

## 📖 Learn More

1. **5-minute read**: [SYNC_QUICKSTART.md](./SYNC_QUICKSTART.md)
2. **20-minute read**: [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md)
3. **Test code**: [tests/postman_cms/](./tests/postman_cms/)
4. **Source code**: [scripts/postman_cms/lib/](./scripts/postman_cms/lib/)

## 🎯 Common Workflows

### Workflow 1: Regular Release
```bash
# 1. Update Postman collection
# 2. Dry-run to preview
gh workflow run postman-cms-sync.yml \
  -f release_version=v18.6.0 \
  -f release_date=2025-02-18 \
  -f release_title="Q1 2025 Release" \
  -f dry_run=true

# 3. Review artifacts
# 4. Production sync
gh workflow run postman-cms-sync.yml \
  -f release_version=v18.6.0 \
  -f release_date=2025-02-18 \
  -f release_title="Q1 2025 Release" \
  -f dry_run=false
```

### Workflow 2: Compare Against Specific Release
```bash
gh workflow run postman-cms-sync.yml \
  -f release_version=v18.6.0 \
  -f release_date=2025-02-18 \
  -f release_title="Q1 2025 Release" \
  -f baseline_ref=v18.5.0 \
  -f dry_run=false
```

### Workflow 3: Local Development Testing
```bash
node scripts/postman_cms/sync_postman_to_html.mjs \
  --collection "Collection.postman_collection.json" \
  --html "docs/SE_API_Docs_v18.5.html" \
  --release-version v18.6.0 \
  --release-date 2025-02-18 \
  --release-title "Q1 2025 Release" \
  --dry-run true
```

## ✨ Features at a Glance

**Error Codes:**
- ✅ HTTP status extraction
- ✅ App-level code extraction
- ✅ JSON/XML parsing
- ✅ Severity classification (auth, validation, quota, server, unknown)
- ✅ Action recommendations
- ✅ Source tracking
- ✅ Deduplication
- ✅ Deterministic ordering

**Welcome Content:**
- ✅ Title/subtitle extraction
- ✅ Markdown stripping
- ✅ Service card generation
- ✅ Deterministic guidelines
- ✅ Auth-first guidance
- ✅ Best practices
- ✅ Base URL inclusion
- ✅ Graceful error handling

**Reliability:**
- ✅ 35 automated tests (100% passing)
- ✅ Safe-fail behavior
- ✅ Dry-run mode
- ✅ Idempotent operation
- ✅ Clean git history

## 🎉 Production Ready

- ✅ All requirements implemented
- ✅ All tests passing
- ✅ Documentation complete
- ✅ Safe-fail behavior verified
- ✅ Committed to GitHub

Ready to use! Start with [SYNC_QUICKSTART.md](./SYNC_QUICKSTART.md)

---

**Status:** ✅ Complete and Production Ready

For questions, see the detailed guides or review the test code for implementation examples.
