/**
 * parse-collection-browser.mjs
 * Browser-compatible port of scripts/postman_cms/lib/parse_collection.mjs
 * No Node.js built-ins — uses djb2 hash instead of crypto.
 */

// ---------------------------------------------------------------------------
// Utils (inlined from utils.mjs, browser-safe)
// ---------------------------------------------------------------------------

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'item';
}

function cleanText(value) {
  return String(value || '').replace(/\r/g, '').trim();
}

function stripMarkdown(value) {
  return cleanText(value)
    .replace(/^#+\s+/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[(.*?)\]\([^)]*\)/g, '$1');
}

function firstSentence(value) {
  const text = stripMarkdown(value).replace(/\s+/g, ' ').trim();
  if (!text) return '';
  const match = text.match(/^(.+?[.!?])(?:\s|$)/);
  return match ? match[1].trim() : text;
}

function uniqueBy(items, keyFn) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const key = keyFn(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

/** djb2 hash — deterministic, no crypto needed */
function djb2(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

function sortDeep(value) {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (!value || typeof value !== 'object') return value;
  const sorted = {};
  for (const key of Object.keys(value).sort()) {
    sorted[key] = sortDeep(value[key]);
  }
  return sorted;
}

function hashObject(value) {
  return djb2(JSON.stringify(sortDeep(value), null, 2));
}

// ---------------------------------------------------------------------------
// Category aliases
// ---------------------------------------------------------------------------

const CATEGORY_ALIAS = [
  ['Authentication', 'auth'],
  ['User Status & Quota', 'auth'],
  ['Part Search Operations', 'search'],
  ['Parametric Search Operations', 'parametric'],
  ['BOM Operations', 'bom'],
  ['ACL & Alert & PCN Operations', 'acl'],
  ['Supply Chain Risk Management (SCRM) Operations', 'scrm'],
  ['Manufacturer/Supplier Search', 'mfr'],
  ['Reports', 'reports'],
  ['IPC', 'ipc']
];

function mapCategoryKey(folderName = '') {
  const normalized = String(folderName).toLowerCase();
  for (const [source, key] of CATEGORY_ALIAS) {
    if (normalized.includes(source.toLowerCase())) return key;
  }
  return slugify(folderName);
}

// ---------------------------------------------------------------------------
// URL / param helpers
// ---------------------------------------------------------------------------

function toPath(url) {
  if (!url) return '/';
  if (Array.isArray(url.path)) {
    const clean = url.path
      .map((part) => String(part || '').trim())
      .filter(Boolean)
      .join('/');
    return `/${clean}`;
  }
  const raw = String(url.raw || '').trim();
  if (!raw) return '/';
  try {
    const parsed = new URL(raw.startsWith('http') ? raw : `https://placeholder.local${raw.startsWith('/') ? '' : '/'}${raw}`);
    return parsed.pathname || '/';
  } catch {
    const withoutQuery = raw.split('?')[0] || '/';
    const noHost = withoutQuery.replace(/^https?:\/\/[^/]+/i, '');
    return noHost.startsWith('/') ? noHost : `/${noHost}`;
  }
}

function extractQueryParams(url) {
  const list = Array.isArray(url?.query) ? url.query : [];
  return list
    .filter((q) => q && !q.disabled)
    .map((q) => ({
      name: String(q.key || '').trim(),
      type: 'string',
      required: false,
      paramType: 'query',
      desc: String(q.description || '').trim()
    }))
    .filter((p) => p.name);
}

function extractBodyParams(request) {
  const out = [];
  const body = request?.body;
  if (!body) return out;

  if (body.mode === 'urlencoded' && Array.isArray(body.urlencoded)) {
    for (const field of body.urlencoded) {
      if (!field || field.disabled) continue;
      out.push({ name: String(field.key || '').trim(), type: 'string', required: false, paramType: 'body', desc: String(field.description || '').trim() });
    }
  }
  if (body.mode === 'formdata' && Array.isArray(body.formdata)) {
    for (const field of body.formdata) {
      if (!field || field.disabled) continue;
      out.push({ name: String(field.key || '').trim(), type: field.type === 'file' ? 'file' : 'string', required: false, paramType: 'body', desc: String(field.description || '').trim() });
    }
  }
  if (body.mode === 'raw' && typeof body.raw === 'string') {
    const raw = body.raw.trim();
    if (raw.startsWith('{') || raw.startsWith('[')) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          for (const key of Object.keys(parsed)) {
            out.push({ name: key, type: typeof parsed[key], required: false, paramType: 'body', desc: '' });
          }
        }
      } catch { /* ignore */ }
    }
  }
  return out.filter((p) => p.name);
}

// ---------------------------------------------------------------------------
// Response schema flattening
// ---------------------------------------------------------------------------

function flattenJsonSchema(obj, basePath = '') {
  const fields = [];
  if (!obj || typeof obj !== 'object') return fields;
  const entries = Array.isArray(obj)
    ? obj.map((v, i) => [String(i), v])
    : Object.entries(obj);
  for (const [key, value] of entries) {
    const path = basePath ? `${basePath}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      fields.push({ path, type: 'object', example: '' });
      fields.push(...flattenJsonSchema(value, path));
    } else if (Array.isArray(value)) {
      const ap = `${path}[]`;
      fields.push({ path: ap, type: 'array', example: '' });
      if (value.length > 0 && value[0] && typeof value[0] === 'object') {
        fields.push(...flattenJsonSchema(value[0], ap));
      }
    } else {
      fields.push({ path, type: typeof value, example: value === undefined ? '' : String(value) });
    }
  }
  return fields;
}

function normalizeResponseSchema(responses) {
  const fields = [];
  for (const r of responses) {
    const body = String(r.body || '').trim();
    if (!body) continue;
    if (body.startsWith('{') || body.startsWith('[')) {
      try { fields.push(...flattenJsonSchema(JSON.parse(body))); } catch { /* skip */ }
    }
    if (fields.length > 0) break;
  }
  return uniqueBy(fields, (f) => `${f.path}:${f.type}`).sort((a, b) => a.path.localeCompare(b.path));
}

// ---------------------------------------------------------------------------
// Error catalog
// ---------------------------------------------------------------------------

function extractXmlStatus(body) {
  const codeRegex = /<Code>\s*([^<]+?)\s*<\/Code>/gi;
  const msgRegex = /<Message>\s*([^<]+?)\s*<\/Message>/gi;
  const codes = [...body.matchAll(codeRegex)].map((m) => m[1].trim());
  const messages = [...body.matchAll(msgRegex)].map((m) => m[1].trim());
  return codes.map((code, i) => ({ code, message: messages[i] || '', source: 'xml' }));
}

function readStatusSignals(jsonValue) {
  const signals = [];
  const visit = (value) => {
    if (!value || typeof value !== 'object') return;
    if (!Array.isArray(value)) {
      const keys = Object.keys(value);
      const lower = new Map(keys.map((k) => [k.toLowerCase(), k]));
      const codeKey = lower.get('code') || lower.get('statuscode');
      const statusObjKey = lower.get('status');
      const messageKey = lower.get('message');
      if (statusObjKey && value[statusObjKey] && typeof value[statusObjKey] === 'object') {
        const s = value[statusObjKey];
        const sCode = s.Code ?? s.code ?? s.StatusCode ?? s.statusCode;
        if (sCode !== undefined) signals.push({ code: String(sCode), message: String(s.Message ?? s.message ?? ''), source: 'json.status' });
      }
      if (codeKey && (messageKey || lower.get('status') || lower.get('success'))) {
        signals.push({ code: String(value[codeKey]), message: String(value[messageKey] ?? ''), source: 'json.code' });
      }
    }
    if (Array.isArray(value)) { for (const item of value) visit(item); }
    else { for (const nested of Object.values(value)) visit(nested); }
  };
  visit(jsonValue);
  return signals;
}

function classifyErrorKind(code, message, context = '') {
  const text = `${code} ${message} ${context}`.toLowerCase();
  if (/auth|unauthor|forbidden|denied|session|login|credential/.test(text)) return 'auth';
  if (/quota|limit|rate|throttle/.test(text)) return 'quota';
  if (/invalid|missing|required|bad request|format|parse|validation/.test(text)) return 'validation';
  if (/server|internal|timeout|unavailable|error/.test(text)) return 'server';
  return 'unknown';
}

export function buildErrorCatalog(entries) {
  const statusSignals = [];
  const httpCodes = new Map();

  for (const entry of entries) {
    for (const response of entry.responses) {
      if (response.code !== null && response.code !== undefined) {
        const numeric = Number(response.code);
        const code = Number.isFinite(numeric) ? numeric : String(response.code);
        if (!httpCodes.has(code)) {
          httpCodes.set(code, {
            code,
            meaning: response.status || 'HTTP Response',
            description: `Observed in ${entry.method.toUpperCase()} ${entry.path}`,
            severity: classifyErrorKind(code, response.status || '', entry.description)
          });
        }
      }
      const body = String(response.body || '').trim();
      if (!body) continue;
      if (body.startsWith('{') || body.startsWith('[')) {
        try {
          const parsed = JSON.parse(body);
          statusSignals.push(...readStatusSignals(parsed).map((s) => ({ ...s, endpoint: `${entry.method.toUpperCase()} ${entry.path}`, context: entry.description })));
        } catch { /* skip */ }
      } else if (body.startsWith('<')) {
        statusSignals.push(...extractXmlStatus(body).map((s) => ({ ...s, endpoint: `${entry.method.toUpperCase()} ${entry.path}`, context: entry.description })));
      }
    }
  }

  const byCode = new Map();
  for (const signal of statusSignals) {
    const code = String(signal.code || '').trim();
    if (!code) continue;
    if (!byCode.has(code)) {
      byCode.set(code, { code, meaning: signal.message || 'Status response', action: 'Review request payload and endpoint usage.', severity: classifyErrorKind(code, signal.message || '', signal.context || ''), sources: [] });
    }
    const target = byCode.get(code);
    if (!target.meaning && signal.message) target.meaning = signal.message;
    if (signal.endpoint) target.sources.push(signal.endpoint);
  }

  const mergedStatus = [];
  for (const [, item] of [...byCode.entries()].sort((a, b) => String(a[0]).localeCompare(String(b[0]), 'en', { numeric: true }))) {
    const kind = item.severity;
    if (kind === 'auth') item.action = 'Authenticate again or verify credentials/permissions.';
    if (kind === 'validation') item.action = 'Validate required parameters and input formats.';
    if (kind === 'quota') item.action = 'Reduce request frequency and retry with backoff.';
    if (kind === 'server') item.action = 'Retry later; escalate if issue persists.';
    if (kind === 'unknown') item.action = 'Inspect message and endpoint documentation for guidance.';
    item.sources = uniqueBy(item.sources.sort(), (x) => x).slice(0, 5);
    mergedStatus.push(item);
  }

  const sortedHttp = [...httpCodes.values()].sort((a, b) => String(a.code).localeCompare(String(b.code), 'en', { numeric: true }));
  return {
    statusCodes: mergedStatus,
    httpCodes: sortedHttp,
    notes: [
      'Always evaluate both HTTP status and payload status code fields.',
      'Retry logic should include backoff for quota or transient failures.',
      'Authentication/session errors should trigger a fresh authenticate call.'
    ]
  };
}

// ---------------------------------------------------------------------------
// Welcome content
// ---------------------------------------------------------------------------

export function buildWelcomeContent(collection, topFolders, hasAuthEndpoint) {
  const title = stripMarkdown(collection?.info?.name || 'SE API Documentation') || 'SE API Documentation';
  const subtitle = firstSentence(collection?.info?.description || 'API documentation generated from Postman collection.');
  const cards = topFolders.map((folder) => ({
    title: folder.name,
    description: firstSentence(folder.description || `Endpoints for ${folder.name}.`),
    routeType: 'category',
    section: folder.key
  }));
  const guidelinesLeft = [
    hasAuthEndpoint
      ? 'Run authentication first and reuse session cookies in subsequent requests.'
      : 'Confirm required credentials and headers before invoking endpoints.',
    'Use Postman examples to validate request shape before coding integration.',
    'Handle non-success status codes with deterministic retry/error handling.'
  ];
  const guidelinesRight = [
    'Track release notes for integration-impacting changes.',
    'Use endpoint examples in docs for quick troubleshooting.',
    'Keep environment secrets in secure variables, never in committed files.'
  ];
  return { title, subtitle, baseUrl: 'https://api.siliconexpert.com/ProductAPI', guidelinesLeft, guidelinesRight, supportCards: cards };
}

// ---------------------------------------------------------------------------
// Collection traversal
// ---------------------------------------------------------------------------

function collectRequests(items, stack = [], output = []) {
  for (const item of items || []) {
    if (Array.isArray(item.item)) { collectRequests(item.item, [...stack, item], output); continue; }
    if (!item?.request) continue;
    output.push({ item, stack });
  }
  return output;
}

function describeTopFolders(collection) {
  return (collection?.item || [])
    .filter((item) => Array.isArray(item.item))
    .map((folder, index) => ({
      id: `${index + 1}`,
      key: mapCategoryKey(folder.name),
      name: String(folder.name || '').trim() || `Category ${index + 1}`,
      description: String(folder.description || folder.request?.description || '').trim(),
      order: index
    }));
}

function normalizeDescription(item) {
  return stripMarkdown(item?.request?.description || item?.description || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildCurl(urlPath, method, queryParams = [], bodyParams = []) {
  const query = queryParams.length
    ? `?${queryParams.map((p) => `${encodeURIComponent(p.name)}={{${p.name}}}`).join('&')}`
    : '';
  const endpoint = `https://api.siliconexpert.com${urlPath}${query}`;
  const lines = [`curl -X ${method.toUpperCase()} "${endpoint}"`];
  if (bodyParams.length) lines.push('  -H "Content-Type: application/json"');
  return lines.join(' \\\n');
}

function pickEndpointId(existingByMethodPath, requestName, method, path, usedIds) {
  const key = `${method.toUpperCase()} ${path}`;
  if (existingByMethodPath.has(key)) {
    const existingId = existingByMethodPath.get(key);
    usedIds.add(existingId);
    return existingId;
  }
  let candidate = slugify(requestName || `${method}-${path}`);
  if (!candidate || candidate === 'item') candidate = slugify(`${method}-${path.replace(/\W+/g, '-')}`);
  let serial = 2;
  const base = candidate;
  while (usedIds.has(candidate)) { candidate = `${base}-${serial}`; serial += 1; }
  usedIds.add(candidate);
  return candidate;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Parse a Postman collection object into a PostmanSnapshot.
 * @param {object} collection  Parsed Postman v2.1.0 collection JSON
 * @param {object} [options]   { currentApiData, currentExamples } from existing HTML blocks
 * @returns {PostmanSnapshot}
 */
export function parseCollection(collection, options = {}) {
  const currentApiData = options.currentApiData || {};
  const existingByMethodPath = new Map();
  for (const [id, endpoint] of Object.entries(currentApiData)) {
    if (!endpoint || typeof endpoint !== 'object') continue;
    const method = String(endpoint.method || '').toUpperCase();
    const path = String(endpoint.path || '');
    if (!method || !path) continue;
    existingByMethodPath.set(`${method} ${path}`, id);
  }

  const topFolders = describeTopFolders(collection);
  const topFolderByName = new Map(topFolders.map((f) => [f.name, f]));
  const requestEntries = collectRequests(collection?.item || []);
  const usedIds = new Set(Object.keys(currentApiData));

  const apiData = {};
  const examples = {};
  const endpoints = [];

  const staticPages = ['welcome', 'postman', 'error-codes', 'release-notes'];
  for (const page of staticPages) {
    if (currentApiData[page]) apiData[page] = currentApiData[page];
  }

  for (const entry of requestEntries) {
    const request = entry.item.request;
    const method = String(request.method || 'GET').toUpperCase();
    const path = toPath(request.url);
    const queryParams = extractQueryParams(request.url);
    const bodyParams = extractBodyParams(request);
    const description = normalizeDescription(entry.item);
    const params = [...queryParams, ...bodyParams];
    const topFolder = entry.stack[0] ? topFolderByName.get(entry.stack[0].name) : null;
    const categoryKey = topFolder?.key || 'misc';
    const breadcrumb = topFolder?.name || 'API Reference';
    const endpointId = pickEndpointId(existingByMethodPath, entry.item.name, method, path, usedIds);
    const current = currentApiData[endpointId] && typeof currentApiData[endpointId] === 'object' ? { ...currentApiData[endpointId] } : {};

    const responses = Array.isArray(entry.item.response) ? entry.item.response : [];
    const normalizedResponses = responses.map((r) => ({
      name: String(r.name || '').trim(),
      code: r.code ?? null,
      status: String(r.status || '').trim(),
      body: String(r.body || '')
    }));

    const endpointExamples = normalizedResponses.slice(0, 6).map((r, index) => ({
      title: r.name || `Example ${index + 1}`,
      subtitle: r.code ? `${r.code} ${r.status || ''}`.trim() : r.status || '',
      request: buildCurl(path, method, queryParams, bodyParams),
      response: r.body,
      note: description ? `Derived from: ${description}` : ''
    }));

    const responseSchema = normalizeResponseSchema(normalizedResponses);

    apiData[endpointId] = {
      ...current,
      id: endpointId,
      title: String(entry.item.name || current.title || endpointId),
      method,
      path,
      category: categoryKey,
      breadcrumb,
      description: description || String(current.description || ''),
      params,
      responseSchema,
      hasExamples: endpointExamples.length > 0,
      getStarted: {
        ...(current.getStarted || {}),
        title: (current.getStarted && current.getStarted.title) || 'Get Started',
        content: (current.getStarted && current.getStarted.content) || '<ul><li>Authenticate first.</li><li>Validate required request fields.</li><li>Inspect response status fields.</li></ul>'
      }
    };

    if (endpointExamples.length > 0) examples[endpointId] = endpointExamples;

    endpoints.push({ id: endpointId, name: entry.item.name, method, path, categoryId: categoryKey, description, params, examples: endpointExamples, responses: normalizedResponses });
  }

  for (const [key, value] of Object.entries(options.currentExamples || {})) {
    if (!examples[key] && !apiData[key]?.method) examples[key] = value;
  }

  const categories = topFolders
    .map((f) => ({ id: f.key, name: f.name, parentId: null, order: f.order }))
    .sort((a, b) => a.order - b.order);

  const hasAuthEndpoint = endpoints.some((e) => /auth|authenticate/i.test(e.path) || /auth/i.test(e.name));
  const welcomeContent = buildWelcomeContent(collection, topFolders, hasAuthEndpoint);
  const errorCodes = buildErrorCatalog(endpoints);

  return { categories, endpoints, apiData, examples, errorCodes, welcomeContent, hash: hashObject({ categories, endpoints }) };
}
