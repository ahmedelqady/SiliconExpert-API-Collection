# HTML Block Contract

## Required Editable Blocks

The sync engine may edit **only** these JavaScript constant blocks inside the HTML file:

| Block name | Purpose |
|---|---|
| `const API_DATA = { ... };` | Endpoint catalog: methods, paths, params, descriptions, response schemas |
| `const EXAMPLES = { ... };` | Request/response example pairs keyed by endpoint id |
| `const ERROR_CODES_CONTENT = { ... };` | Error catalog: HTTP codes, app-level status codes, severity, actions |
| `const WELCOME_CONTENT = { ... };` | Home/get-started page: title, subtitle, service cards, guidelines |
| `const RELEASE_NOTES_CONTENT = { ... };` | Release history entries with version, date, title, and API delta summary |

All other HTML content is **read-only** and must not be modified by automation.

## Safety Rules

- If any required block is **missing**, **duplicated**, or **unparsable**, sync fails with a non-zero exit code and no commit is made.
- No fallback free-form string replacement is permitted outside the defined blocks.
- Updated output must preserve valid JavaScript object syntax with a trailing semicolon.
- The parser validates all five blocks are present before applying any write.

## Determinism Rules

- Stable key ordering for all generated objects (keys sorted alphabetically).
- Stable ordering for categories, endpoints, and examples in output.
- No timestamps injected into content blocks except explicit release-note metadata fields (`date`).
- Running the sync twice with the same collection input produces byte-identical output on the second run (idempotency guarantee).

## Block Shape Reference

### `API_DATA`
```js
const API_DATA = {
  "<endpoint-id>": {
    id: "string",
    title: "string",
    method: "GET|POST|PUT|DELETE|...",
    path: "/ProductAPI/...",
    category: "string",          // slug of parent folder
    breadcrumb: "string",        // human-readable folder name
    description: "string",
    params: [{ name, type, required, paramType, desc }],
    responseSchema: [{ path, type, example }],
    hasExamples: true,
    getStarted: { title, content }
  }
};
```

### `EXAMPLES`
```js
const EXAMPLES = {
  "<endpoint-id>": [
    {
      title: "string",
      subtitle: "string",   // e.g. "200 OK"
      request: "curl ...",
      response: "string",   // raw response body
      note: "string"
    }
  ]
};
```

### `ERROR_CODES_CONTENT`
```js
const ERROR_CODES_CONTENT = {
  statusCodes: [
    {
      code: "string",         // app-level code, e.g. "5", "401"
      meaning: "string",
      severity: "auth|validation|quota|server|unknown",
      action: "string",       // recommended remediation
      sources: ["string"]     // endpoint paths that return this code
    }
  ],
  httpCodes: [
    {
      code: 200,              // numeric HTTP status
      meaning: "string",
      description: "string",
      severity: "auth|validation|quota|server|unknown"
    }
  ],
  notes: ["string"]           // general guidance notes
};
```

### `WELCOME_CONTENT`
```js
const WELCOME_CONTENT = {
  title: "string",
  subtitle: "string",
  baseUrl: "string",
  guidelinesLeft: ["string"],   // 3 items
  guidelinesRight: ["string"],  // 3 items
  supportCards: [
    {
      title: "string",
      description: "string",
      routeType: "category",
      section: "string"         // category slug
    }
  ]
};
```

### `RELEASE_NOTES_CONTENT`
```js
const RELEASE_NOTES_CONTENT = {
  items: [
    {
      version: "string",
      date: "string",
      tag: "Latest|No API Changes",
      sections: [{ title: "string", items: ["string"] }]
    }
  ]
};
```
