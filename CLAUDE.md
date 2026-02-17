# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This repository contains Postman collections and environments for the **SiliconExpert API**. It serves as comprehensive API documentation with embedded examples, test scripts, and executable requests.

**Key Files:**
- `SiliconExpert API Collection (Docs + Examples) [Full].postman_collection.json` - Complete API collection with all endpoints, descriptions, and test scripts
- `SiliconExpert API - Env [My].postman_environment.json` - Environment variables for testing (credentials, base URLs, sample parameters)

## Project Structure

The Postman collection is organized hierarchically:

1. **Authentication** - User login and session management
2. **API Endpoints** - Organized by functional area:
   - Product/part searches and lookups
   - Component information retrieval
   - BOM (Bill of Materials) operations
   - Lifecycle and PCN management
   - Cross-reference lookups
3. **Test Scripts** - Embedded in request definitions to validate responses and manage session state
4. **Documentation** - In-request descriptions with parameters, examples, and notes

## Common Tasks

### Setting Up for Local Use

1. Import both files into Postman (File > Import)
2. Configure the environment with your credentials:
   - Set `login` to your SiliconExpert username
   - Set `apiKey` to your SiliconExpert API key
3. Select the environment in Postman's environment dropdown
4. Run "Authenticate User (Login)" request first to establish session

### Testing an Endpoint

1. Select any request from the collection
2. Review the **Params** tab for required variables and their current values
3. Click **Send** to execute
4. Check the **Tests** tab results and **Response** for validation

### Modifying Variables

Environment variables are in the `values` array. Common ones:
- `base_url` - API endpoint base (typically `https://api.siliconexpert.com/ProductAPI`)
- `login` / `apiKey` - Credentials (keep empty in repo, set locally)
- `partNumber`, `MPN1`, `MPN2` - Sample component identifiers
- `comId`, `comIds` - Component IDs for lookup
- `manufacturerName`, `manufacturerId` - Manufacturer filters
- `bomId`, `aclId`, `pcnId` - Project/resource identifiers

### Adding New Requests

When expanding the collection:
1. Structure new requests under appropriate folder in the hierarchy
2. Include descriptive name and documentation in the request description
3. Add test scripts to validate critical responses
4. Use consistent variable names with existing requests
5. Document required parameters clearly

## API Session Management

- **Session Duration**: ~30 minutes of inactivity
- **Re-authentication**: Required when receiving authorization errors
- **Cookie Handling**: Postman automatically manages session cookies
- **Test Scripts**: Include logic to extract and store session tokens if API format changes

## Working with JSON Format

All requests default to JSON responses (`fmt: json` environment variable). Response structure typically includes:
- `Status` object with `Code`, `Message`, `Success` fields
- Data payload with results
- Pagination info for list endpoints (when applicable)

Test scripts check for both `Success` and `success` fields (case variations) to handle potential API inconsistencies.

## Testing Strategy

- Each request includes response validation in test scripts
- Tests check HTTP status codes and Success flags
- Session cookies are extracted and stored for subsequent requests
- Failed authentications should trigger a new login before retry

## Notes for Future Development

- This collection documents a third-party API; changes to SiliconExpert API may require updates
- Variable naming follows mixed conventions (camelCase and PascalCase) - maintain consistency when adding endpoints
- Test scripts handle JSON parsing gracefully with try-catch for compatibility
- Documentation is embedded in request descriptions, not in separate files
