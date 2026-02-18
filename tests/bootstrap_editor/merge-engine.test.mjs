import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyRow, buildUnifiedRegistry, rowKey, applyResolutions } from '../../tools/lib/merge-engine.mjs';
import { parseHtmlBlocks } from '../../tools/lib/parse-html-blocks-browser.mjs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeHtmlBlocks(overrides = {}) {
  const defaults = {
    API_DATA: { 'auth-user': { title: 'Auth', method: 'POST', path: '/auth', breadcrumb: 'Auth', description: 'Old desc', params: [], getStarted: { title: 'Start', content: '<p>Go</p>' } } },
    EXAMPLES: { 'auth-user': [{ title: 'Ex 1', subtitle: '200', request: 'curl ...', response: '{}', note: '' }] },
    WELCOME_CONTENT: { title: 'SE API', subtitle: 'Docs.', baseUrl: 'https://api.example.com', guidelinesLeft: ['Tip 1'], guidelinesRight: ['Tip 2'], supportCards: [] },
    ERROR_CODES_CONTENT: { statusCodes: [{ code: '0', meaning: 'OK', action: 'None', severity: 'success' }], httpCodes: [{ code: 200, meaning: 'OK', description: 'Success', severity: 'success' }] },
    RELEASE_NOTES_CONTENT: { items: [] }
  };
  const vals = { ...defaults, ...overrides };

  // Build minimal HTML and parse it to get proper block structure
  const html = `<!DOCTYPE html><html><body><script>
            const API_DATA = ${JSON.stringify(vals.API_DATA, null, 4).split('\n').map((l, i) => i === 0 ? l : '            ' + l).join('\n')};
            const EXAMPLES = ${JSON.stringify(vals.EXAMPLES, null, 4).split('\n').map((l, i) => i === 0 ? l : '            ' + l).join('\n')};
            const WELCOME_CONTENT = ${JSON.stringify(vals.WELCOME_CONTENT, null, 4).split('\n').map((l, i) => i === 0 ? l : '            ' + l).join('\n')};
            const ERROR_CODES_CONTENT = ${JSON.stringify(vals.ERROR_CODES_CONTENT, null, 4).split('\n').map((l, i) => i === 0 ? l : '            ' + l).join('\n')};
            const RELEASE_NOTES_CONTENT = ${JSON.stringify(vals.RELEASE_NOTES_CONTENT, null, 4).split('\n').map((l, i) => i === 0 ? l : '            ' + l).join('\n')};
  </script></body></html>`;
  return { blocks: parseHtmlBlocks(html), html };
}

function makePostmanSnapshot(overrides = {}) {
  return {
    categories: [{ id: 'auth', name: 'Authentication', parentId: null, order: 0 }],
    endpoints: [],
    apiData: {
      'auth-user': { id: 'auth-user', title: 'Auth', method: 'POST', path: '/auth', breadcrumb: 'Authentication', description: 'New desc from Postman', params: [], hasExamples: true, getStarted: { title: 'Start', content: '<p>Go</p>' } },
      ...overrides.apiData
    },
    examples: {
      'auth-user': [{ title: 'Postman Ex', subtitle: '200 OK', request: 'curl -X POST ...', response: '{"ok":true}', note: 'From Postman' }],
      ...overrides.examples
    },
    errorCodes: {
      statusCodes: [{ code: '0', meaning: 'OK', action: 'None', severity: 'success' }],
      httpCodes: [{ code: 200, meaning: 'OK', description: 'Success', severity: 'success' }],
      notes: [],
      ...overrides.errorCodes
    },
    welcomeContent: {
      title: 'SE API', subtitle: 'Postman subtitle.', baseUrl: 'https://api.example.com',
      guidelinesLeft: ['Tip 1'], guidelinesRight: ['Tip 2'], supportCards: [],
      ...overrides.welcomeContent
    },
    hash: 'abc123'
  };
}

// ---------------------------------------------------------------------------
// classifyRow tests
// ---------------------------------------------------------------------------

test('classifyRow: null + null → null-both', () => {
  assert.equal(classifyRow(null, null), 'null-both');
  assert.equal(classifyRow(undefined, undefined), 'null-both');
  assert.equal(classifyRow(null, undefined), 'null-both');
});

test('classifyRow: value + null → postman-only', () => {
  assert.equal(classifyRow('hello', null), 'postman-only');
  assert.equal(classifyRow({ a: 1 }, undefined), 'postman-only');
});

test('classifyRow: null + value → html-only', () => {
  assert.equal(classifyRow(null, 'world'), 'html-only');
  assert.equal(classifyRow(undefined, [1, 2, 3]), 'html-only');
});

test('classifyRow: identical values → match', () => {
  assert.equal(classifyRow('same', 'same'), 'match');
  assert.equal(classifyRow({ a: 1, b: 2 }, { b: 2, a: 1 }), 'match'); // order-normalised
  assert.equal(classifyRow([1, 2], [1, 2]), 'match');
});

test('classifyRow: different values → conflict', () => {
  assert.equal(classifyRow('old', 'new'), 'conflict');
  assert.equal(classifyRow({ a: 1 }, { a: 2 }), 'conflict');
});

// ---------------------------------------------------------------------------
// buildUnifiedRegistry tests
// ---------------------------------------------------------------------------

test('buildUnifiedRegistry: endpoint only in Postman → postman-only row for description', () => {
  const { blocks } = makeHtmlBlocks({ API_DATA: {} }); // empty HTML
  const snapshot = makePostmanSnapshot();
  const registry = buildUnifiedRegistry(snapshot, blocks);
  const descRow = registry.find((r) => r.id === 'auth-user' && r.block === 'apiData' && r.field === 'description');
  assert.ok(descRow, 'should have description row');
  assert.equal(descRow.state, 'postman-only');
  assert.ok(descRow.postman !== null, 'Postman side should be populated');
  assert.equal(descRow.html, null);
});

test('buildUnifiedRegistry: endpoint only in HTML → html-only row', () => {
  // Build a snapshot with NO endpoints at all in apiData or examples
  const emptySnapshot = {
    categories: [],
    endpoints: [],
    apiData: {},
    examples: {},
    errorCodes: { statusCodes: [], httpCodes: [], notes: [] },
    welcomeContent: { title: 'SE API', subtitle: 'Docs.', baseUrl: 'https://api.example.com', guidelinesLeft: ['Tip 1'], guidelinesRight: ['Tip 2'], supportCards: [] },
    hash: 'x'
  };
  const { blocks } = makeHtmlBlocks(); // has auth-user in HTML
  const registry = buildUnifiedRegistry(emptySnapshot, blocks);
  const descRow = registry.find((r) => r.id === 'auth-user' && r.block === 'apiData' && r.field === 'description');
  assert.ok(descRow, 'should have description row for HTML-only endpoint');
  assert.equal(descRow.state, 'html-only');
  assert.equal(descRow.postman, null);
});

test('buildUnifiedRegistry: matching description → match state', () => {
  const desc = 'Shared description';
  const { blocks } = makeHtmlBlocks({ API_DATA: { 'auth-user': { title: 'Auth', method: 'POST', path: '/auth', breadcrumb: 'Auth', description: desc, params: [], getStarted: {} } } });
  const snapshot = makePostmanSnapshot({ apiData: { 'auth-user': { title: 'Auth', method: 'POST', path: '/auth', breadcrumb: 'Auth', description: desc, params: [], getStarted: {} } } });
  const registry = buildUnifiedRegistry(snapshot, blocks);
  const descRow = registry.find((r) => r.id === 'auth-user' && r.field === 'description');
  assert.equal(descRow.state, 'match');
});

test('buildUnifiedRegistry: different descriptions → conflict state', () => {
  const { blocks } = makeHtmlBlocks(); // description = 'Old desc'
  const snapshot = makePostmanSnapshot(); // description = 'New desc from Postman'
  const registry = buildUnifiedRegistry(snapshot, blocks);
  const descRow = registry.find((r) => r.id === 'auth-user' && r.field === 'description');
  assert.equal(descRow.state, 'conflict');
});

test('buildUnifiedRegistry: includes welcome fields as rows', () => {
  const { blocks } = makeHtmlBlocks();
  const snapshot = makePostmanSnapshot();
  const registry = buildUnifiedRegistry(snapshot, blocks);
  const welcomeFields = registry.filter((r) => r.block === 'welcome');
  assert.ok(welcomeFields.length >= 5, `should have at least 5 welcome rows, got ${welcomeFields.length}`);
  const titleRow = welcomeFields.find((r) => r.field === 'title');
  assert.ok(titleRow, 'should have title row');
});

test('buildUnifiedRegistry: includes errorCodes statusCodes and httpCodes rows', () => {
  const { blocks } = makeHtmlBlocks();
  const snapshot = makePostmanSnapshot();
  const registry = buildUnifiedRegistry(snapshot, blocks);
  const errorRows = registry.filter((r) => r.block === 'errorCodes');
  const statusRow = errorRows.find((r) => r.field === 'statusCodes');
  const httpRow = errorRows.find((r) => r.field === 'httpCodes');
  assert.ok(statusRow, 'should have statusCodes row');
  assert.ok(httpRow, 'should have httpCodes row');
});

// ---------------------------------------------------------------------------
// applyResolutions tests
// ---------------------------------------------------------------------------

test('applyResolutions: source=postman writes resolved value into HTML output', () => {
  const { blocks, html } = makeHtmlBlocks();
  const snapshot = makePostmanSnapshot();
  const registry = buildUnifiedRegistry(snapshot, blocks);

  const descRow = registry.find((r) => r.id === 'auth-user' && r.field === 'description');
  const resolutions = { [rowKey(descRow)]: { resolved: 'Postman description', source: 'postman' } };

  const postman = { info: { name: 'Test API', description: '' }, item: [] };
  const { htmlString } = applyResolutions(registry, resolutions, postman, html, blocks);

  // Parse the output HTML and verify
  const newBlocks = parseHtmlBlocks(htmlString);
  assert.equal(newBlocks.API_DATA.value['auth-user'].description, 'Postman description');
});

test('applyResolutions: source=unchanged leaves both files identical', () => {
  const { blocks, html } = makeHtmlBlocks();
  const snapshot = makePostmanSnapshot();
  const registry = buildUnifiedRegistry(snapshot, blocks);

  // All resolutions are 'unchanged'
  const resolutions = {};
  for (const row of registry) {
    resolutions[rowKey(row)] = { resolved: row.html, source: 'unchanged' };
  }

  const postman = { info: { name: 'Test', description: '' }, item: [] };
  const originalPostmanJson = JSON.stringify(postman, null, 2);
  const { postmanJson, htmlString } = applyResolutions(registry, resolutions, postman, html, blocks);

  assert.equal(postmanJson, originalPostmanJson, 'postman JSON should be unchanged');
  assert.equal(htmlString, html, 'HTML should be unchanged');
});

test('applyResolutions: resolved rows show match state when loaded back', () => {
  const { blocks, html } = makeHtmlBlocks();
  const snapshot = makePostmanSnapshot();
  const registry = buildUnifiedRegistry(snapshot, blocks);

  // Resolve all conflicts with the postman value
  const resolutions = {};
  for (const row of registry) {
    if (row.state === 'conflict' || row.state === 'postman-only') {
      resolutions[rowKey(row)] = { resolved: row.postman, source: 'postman' };
    }
  }

  const postman = { info: { name: 'Test', description: '' }, item: [] };
  const { htmlString } = applyResolutions(registry, resolutions, postman, html, blocks);

  // Re-parse the updated HTML and re-build registry
  const newBlocks = parseHtmlBlocks(htmlString);
  // For the description row specifically, check it now matches
  const newDescValue = newBlocks.API_DATA.value['auth-user']?.description;
  const expectedDesc = snapshot.apiData['auth-user'].description;
  assert.equal(newDescValue, expectedDesc, 'description should match after applying Postman resolution');
});
