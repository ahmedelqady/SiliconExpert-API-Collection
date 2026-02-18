import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCollection, buildWelcomeContent, buildErrorCatalog } from '../../tools/lib/parse-collection-browser.mjs';

// ---------------------------------------------------------------------------
// Minimal collection fixture
// ---------------------------------------------------------------------------

function makeCollection(overrides = {}) {
  return {
    info: {
      name: 'Test API',
      description: 'Test description. More text here.',
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
    },
    item: [
      {
        name: 'Authentication',
        item: [
          {
            name: 'Authenticate User (Login)',
            request: {
              method: 'POST',
              url: { raw: 'https://api.example.com/ProductAPI/search/authenticateUser', path: ['ProductAPI', 'search', 'authenticateUser'] },
              body: { mode: 'urlencoded', urlencoded: [{ key: 'login', value: '{{login}}', type: 'text' }, { key: 'apiKey', value: '{{apiKey}}', type: 'text' }] }
            },
            response: [{ name: 'Example 200', code: 200, status: 'OK', body: '{"Status":{"Code":"2","Message":"Auth OK","Success":"true"}}' }]
          }
        ]
      },
      {
        name: 'Part Search Operations',
        item: [
          {
            name: 'Part Search',
            request: {
              method: 'GET',
              url: { raw: 'https://api.example.com/ProductAPI/search/partsearch', path: ['ProductAPI', 'search', 'partsearch'], query: [{ key: 'MPN', value: '{{MPN}}', description: 'Part number' }] }
            },
            response: [{ name: 'Example 200', code: 200, status: 'OK', body: '{"Status":{"Code":"0","Message":"Success"}}' }]
          }
        ]
      }
    ],
    ...overrides
  };
}

// ---------------------------------------------------------------------------
// T001: slug generation is stable
// ---------------------------------------------------------------------------
test('parseCollection: slug generation is stable and deterministic', () => {
  const snapshot = parseCollection(makeCollection());
  const ids = snapshot.endpoints.map((e) => e.id);
  // Second parse of same collection should produce same IDs
  const snapshot2 = parseCollection(makeCollection());
  const ids2 = snapshot2.endpoints.map((e) => e.id);
  assert.deepEqual(ids, ids2);
});

// ---------------------------------------------------------------------------
// T002: slug preservation via currentApiData
// ---------------------------------------------------------------------------
test('parseCollection: preserves existing endpoint IDs from currentApiData via method+path lookup', () => {
  const customApiData = { 'my-custom-auth': { method: 'POST', path: '/ProductAPI/search/authenticateUser' } };
  const snapshot = parseCollection(makeCollection(), { currentApiData: customApiData });
  const authEndpoint = snapshot.endpoints.find((e) => e.path.includes('authenticateUser'));
  assert.ok(authEndpoint, 'auth endpoint should be found');
  assert.equal(authEndpoint.id, 'my-custom-auth');
});

// ---------------------------------------------------------------------------
// T003: folder → categoryId mapping
// ---------------------------------------------------------------------------
test('parseCollection: folder name maps to correct categoryId', () => {
  const snapshot = parseCollection(makeCollection());
  const authEndpoint = snapshot.endpoints.find((e) => e.name === 'Authenticate User (Login)');
  const searchEndpoint = snapshot.endpoints.find((e) => e.name === 'Part Search');
  assert.ok(authEndpoint);
  assert.ok(searchEndpoint);
  assert.equal(authEndpoint.categoryId, 'auth');
  assert.equal(searchEndpoint.categoryId, 'search');
});

// ---------------------------------------------------------------------------
// T004: buildErrorCatalog extracts HTTP codes
// ---------------------------------------------------------------------------
test('buildErrorCatalog: extracts HTTP 200 code from response', () => {
  const snapshot = parseCollection(makeCollection());
  const httpCodes = snapshot.errorCodes.httpCodes.map((c) => c.code);
  assert.ok(httpCodes.includes(200), 'should include 200');
});

// ---------------------------------------------------------------------------
// T005: buildErrorCatalog extracts app-level status codes from JSON
// ---------------------------------------------------------------------------
test('buildErrorCatalog: extracts app-level status codes from JSON response body', () => {
  const snapshot = parseCollection(makeCollection());
  const statusCodes = snapshot.errorCodes.statusCodes.map((c) => c.code);
  assert.ok(statusCodes.includes('2') || statusCodes.includes('0'), 'should include status code 0 or 2');
});

// ---------------------------------------------------------------------------
// T006: buildWelcomeContent extracts title and subtitle
// ---------------------------------------------------------------------------
test('buildWelcomeContent: extracts collection title and first-sentence subtitle', () => {
  const collection = makeCollection();
  const topFolders = [{ name: 'Authentication', key: 'auth', description: '', order: 0 }];
  const welcome = buildWelcomeContent(collection, topFolders, true);
  assert.equal(welcome.title, 'Test API');
  assert.ok(welcome.subtitle.includes('Test description'), `subtitle should start with description text, got: ${welcome.subtitle}`);
});

// ---------------------------------------------------------------------------
// T007: buildWelcomeContent includes auth guidance when auth endpoint exists
// ---------------------------------------------------------------------------
test('buildWelcomeContent: includes auth guidance when hasAuthEndpoint is true', () => {
  const welcome = buildWelcomeContent(makeCollection(), [], true);
  const allGuidelines = [...welcome.guidelinesLeft, ...welcome.guidelinesRight].join(' ');
  assert.ok(/auth/i.test(allGuidelines), 'auth guidance should be included');
});

// ---------------------------------------------------------------------------
// T008: dedup — same slug generated twice gets suffix
// ---------------------------------------------------------------------------
test('parseCollection: deduplicates endpoint IDs when two requests produce the same slug', () => {
  const collection = {
    info: { name: 'Dedup Test', description: '' },
    item: [{
      name: 'Search',
      item: [
        { name: 'Part Search', request: { method: 'GET', url: { raw: 'https://api.example.com/partsearch', path: ['partsearch'] } }, response: [] },
        { name: 'Part Search', request: { method: 'POST', url: { raw: 'https://api.example.com/partsearch2', path: ['partsearch2'] } }, response: [] }
      ]
    }]
  };
  const snapshot = parseCollection(collection);
  const ids = snapshot.endpoints.map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length, 'all endpoint IDs must be unique');
});

// ---------------------------------------------------------------------------
// T009: empty collection produces no endpoints
// ---------------------------------------------------------------------------
test('parseCollection: empty collection produces zero endpoints', () => {
  const snapshot = parseCollection({ info: { name: 'Empty', description: '' }, item: [] });
  assert.equal(snapshot.endpoints.length, 0);
  assert.equal(Object.keys(snapshot.apiData).length, 0);
});
