/**
 * merge-engine.mjs
 * Conflict detection, resolution state machine, and apply logic for the
 * Postman–HTML Bootstrap Content Editor.
 */

import { serializeConstObject, applyBlockUpdates } from './serialize-html-blocks-browser.mjs';

// ---------------------------------------------------------------------------
// Deep equality (JSON-based, order-normalised for objects)
// ---------------------------------------------------------------------------

function deepEqual(a, b) {
  if (a === b) return true;
  if (a === null || b === null || a === undefined || b === undefined) return a === b;
  return JSON.stringify(sortDeep(a)) === JSON.stringify(sortDeep(b));
}

function sortDeep(value) {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (!value || typeof value !== 'object') return value;
  const sorted = {};
  for (const key of Object.keys(value).sort()) sorted[key] = sortDeep(value[key]);
  return sorted;
}

// ---------------------------------------------------------------------------
// Row state classification
// ---------------------------------------------------------------------------

/**
 * Classify the relationship between two values.
 * @param {unknown} postmanValue
 * @param {unknown} htmlValue
 * @returns {'match'|'conflict'|'postman-only'|'html-only'|'null-both'}
 */
export function classifyRow(postmanValue, htmlValue) {
  const pNull = postmanValue === null || postmanValue === undefined;
  const hNull = htmlValue === null || htmlValue === undefined;
  if (pNull && hNull) return 'null-both';
  if (pNull) return 'html-only';
  if (hNull) return 'postman-only';
  return deepEqual(postmanValue, htmlValue) ? 'match' : 'conflict';
}

// ---------------------------------------------------------------------------
// Unified registry builder
// ---------------------------------------------------------------------------

/**
 * Build a flat list of UnifiedRows from both sources.
 * Covers: apiData (per endpoint, key fields), examples (per endpoint),
 *         welcomeContent (per field), errorCodes (per code entry).
 *
 * @param {PostmanSnapshot} postmanSnapshot  Output of parseCollection()
 * @param {HtmlBlocks}      htmlBlocks       Output of parseHtmlBlocks()
 * @returns {UnifiedRow[]}
 */
export function buildUnifiedRegistry(postmanSnapshot, htmlBlocks) {
  const rows = [];

  // ---- API_DATA: per-endpoint key fields ----
  const pApiData = postmanSnapshot.apiData || {};
  const hApiData = htmlBlocks.API_DATA?.value || {};
  const allEndpointIds = new Set([...Object.keys(pApiData), ...Object.keys(hApiData)]);

  // Exclude static page stubs ('welcome', 'postman', 'error-codes', 'release-notes')
  const staticPages = new Set(['welcome', 'postman', 'error-codes', 'release-notes']);
  const endpointFields = ['title', 'description', 'method', 'path', 'breadcrumb', 'params', 'getStarted'];

  for (const id of [...allEndpointIds].filter((id) => !staticPages.has(id)).sort()) {
    const p = pApiData[id] || null;
    const h = hApiData[id] || null;
    for (const field of endpointFields) {
      const pVal = p ? (p[field] ?? null) : null;
      const hVal = h ? (h[field] ?? null) : null;
      rows.push({
        id,
        block: 'apiData',
        field,
        postman: pVal,
        html: hVal,
        state: classifyRow(pVal, hVal)
      });
    }
  }

  // ---- EXAMPLES: per-endpoint array ----
  const pExamples = postmanSnapshot.examples || {};
  const hExamples = htmlBlocks.EXAMPLES?.value || {};
  const allExampleIds = new Set([...Object.keys(pExamples), ...Object.keys(hExamples)]);

  for (const id of [...allExampleIds].sort()) {
    const pVal = pExamples[id] ?? null;
    const hVal = hExamples[id] ?? null;
    rows.push({
      id,
      block: 'examples',
      field: 'examples',
      postman: pVal,
      html: hVal,
      state: classifyRow(pVal, hVal)
    });
  }

  // ---- WELCOME_CONTENT: per-field ----
  const pWelcome = postmanSnapshot.welcomeContent || {};
  const hWelcome = htmlBlocks.WELCOME_CONTENT?.value || {};
  const welcomeFields = ['title', 'subtitle', 'baseUrl', 'guidelinesLeft', 'guidelinesRight', 'supportCards'];
  for (const field of welcomeFields) {
    const pVal = pWelcome[field] ?? null;
    const hVal = hWelcome[field] ?? null;
    rows.push({
      id: 'welcome',
      block: 'welcome',
      field,
      postman: pVal,
      html: hVal,
      state: classifyRow(pVal, hVal)
    });
  }

  // ---- ERROR_CODES_CONTENT: statusCodes array + httpCodes array ----
  const pErrors = postmanSnapshot.errorCodes || {};
  const hErrors = htmlBlocks.ERROR_CODES_CONTENT?.value || {};

  rows.push({
    id: 'error-codes',
    block: 'errorCodes',
    field: 'statusCodes',
    postman: pErrors.statusCodes ?? null,
    html: hErrors.statusCodes ?? null,
    state: classifyRow(pErrors.statusCodes ?? null, hErrors.statusCodes ?? null)
  });
  rows.push({
    id: 'error-codes',
    block: 'errorCodes',
    field: 'httpCodes',
    postman: pErrors.httpCodes ?? null,
    html: hErrors.httpCodes ?? null,
    state: classifyRow(pErrors.httpCodes ?? null, hErrors.httpCodes ?? null)
  });

  return rows;
}

/**
 * Unique row key used as the key in the Resolution map.
 * @param {UnifiedRow} row
 * @returns {string}
 */
export function rowKey(row) {
  return `${row.block}::${row.id}::${row.field}`;
}

// ---------------------------------------------------------------------------
// Apply resolutions to both files
// ---------------------------------------------------------------------------

/**
 * Deep-clone a JSON-serialisable value.
 */
function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

/**
 * Set a value at a dotted path in an object (mutates the object).
 */
function setAtPath(obj, path, value) {
  const parts = path.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (cur[part] === undefined) cur[part] = {};
    cur = cur[part];
  }
  cur[parts[parts.length - 1]] = value;
}

/**
 * Apply all resolutions to produce updated Postman JSON and updated HTML string.
 *
 * Rules:
 * - source 'unchanged': leave both files as-is for this field.
 * - source 'postman': resolved value (from Postman) written to HTML block.
 * - source 'html':    resolved value (from HTML) written to Postman collection.
 * - source 'custom':  resolved value written to BOTH files.
 *
 * @param {UnifiedRow[]}      registry         Output of buildUnifiedRegistry
 * @param {Resolution}        resolutions      Map of rowKey → { resolved, source }
 * @param {object}            originalPostmanObj  Parsed Postman collection object
 * @param {string}            originalHtmlText    Raw HTML string
 * @param {HtmlBlocks}        htmlBlocks          Output of parseHtmlBlocks (for replaceStart/End)
 * @returns {{ postmanJson: string, htmlString: string }}
 */
export function applyResolutions(registry, resolutions, originalPostmanObj, originalHtmlText, htmlBlocks) {
  const postman = clone(originalPostmanObj);

  // Accumulate new values for each HTML block
  const htmlUpdates = {
    API_DATA: clone(htmlBlocks.API_DATA?.value || {}),
    EXAMPLES: clone(htmlBlocks.EXAMPLES?.value || {}),
    WELCOME_CONTENT: clone(htmlBlocks.WELCOME_CONTENT?.value || {}),
    ERROR_CODES_CONTENT: clone(htmlBlocks.ERROR_CODES_CONTENT?.value || {})
  };

  for (const row of registry) {
    const key = rowKey(row);
    const resolution = resolutions[key];
    if (!resolution || resolution.source === 'unchanged') continue;

    const { resolved, source } = resolution;

    // --- Update HTML blocks ---
    const shouldUpdateHtml = source === 'postman' || source === 'custom';
    if (shouldUpdateHtml) {
      if (row.block === 'apiData') {
        if (!htmlUpdates.API_DATA[row.id]) htmlUpdates.API_DATA[row.id] = {};
        setAtPath(htmlUpdates.API_DATA[row.id], row.field, resolved);
      } else if (row.block === 'examples') {
        htmlUpdates.EXAMPLES[row.id] = resolved;
      } else if (row.block === 'welcome') {
        setAtPath(htmlUpdates.WELCOME_CONTENT, row.field, resolved);
      } else if (row.block === 'errorCodes') {
        setAtPath(htmlUpdates.ERROR_CODES_CONTENT, row.field, resolved);
      }
    }

    // --- Update Postman collection ---
    const shouldUpdatePostman = source === 'html' || source === 'custom';
    if (shouldUpdatePostman) {
      if (row.block === 'apiData' || row.block === 'examples') {
        _writeToPostmanRequest(postman, row, resolved);
      } else if (row.block === 'welcome') {
        // Write welcome fields back to collection info.description (best effort)
        if (row.field === 'title' && postman.info) postman.info.name = String(resolved || '');
        if (row.field === 'subtitle' && postman.info) {
          postman.info.description = String(resolved || '');
        }
      }
      // errorCodes in Postman are derived from response bodies — no direct write target
    }
  }

  // Splice updated HTML blocks
  const htmlString = applyBlockUpdates(originalHtmlText, htmlBlocks, htmlUpdates);
  const postmanJson = JSON.stringify(postman, null, 2);

  return { postmanJson, htmlString };
}

/**
 * Write a resolved value back to the matching Postman request item.
 * Locates the request by matching the endpoint id to the request's method+path slug.
 */
function _writeToPostmanRequest(postman, row, resolved) {
  const target = _findRequestItem(postman.item || [], row.id);
  if (!target) return; // endpoint not found in collection — skip silently

  if (row.block === 'apiData') {
    if (row.field === 'description') {
      target.request.description = String(resolved || '');
    }
    // method, path, params are structural — editing them would break the request; skip.
  } else if (row.block === 'examples') {
    // resolved is an array of example objects; write them back to response[].body
    if (Array.isArray(resolved) && Array.isArray(target.response)) {
      resolved.forEach((example, i) => {
        if (target.response[i]) {
          target.response[i].body = String(example.response || '');
          if (example.title) target.response[i].name = String(example.title);
        }
      });
    }
  }
}

/**
 * Find a Postman request item by matching its generated slug ID.
 * Traverses nested folders.
 */
function _findRequestItem(items, targetId) {
  for (const item of items) {
    if (Array.isArray(item.item)) {
      const found = _findRequestItem(item.item, targetId);
      if (found) return found;
      continue;
    }
    if (!item.request) continue;
    // Generate the same slug the parser would assign
    const method = String(item.request.method || 'GET').toUpperCase();
    const rawUrl = item.request.url?.raw || '';
    const slug = _slugify(item.name || `${method}-${rawUrl}`);
    if (slug === targetId) return item;
  }
  return null;
}

function _slugify(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'item';
}
