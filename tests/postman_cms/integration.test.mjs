import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseCollection } from '../../scripts/postman_cms/lib/parse_collection.mjs';
import { diffSnapshots } from '../../scripts/postman_cms/lib/diff_snapshots.mjs';
import { parseHtmlBlocks } from '../../scripts/postman_cms/lib/parse_html_blocks.mjs';
import { updateHtmlBlocks } from '../../scripts/postman_cms/lib/update_html_blocks.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Scenario 1: New HTTP 401/403 appears in collection examples
test('Integration: New HTTP 401/403 error in examples triggers error block update', () => {
  const baselineCollection = {
    info: { name: 'API', description: 'Test API' },
    item: [
      {
        name: 'Auth',
        item: [
          {
            name: 'Login',
            request: { method: 'POST', url: { raw: 'https://api.example.com/auth' } },
            response: [{ code: 200, status: 'OK', body: '{"Status":{"Code":"0"}}' }]
          }
        ]
      }
    ]
  };

  const currentCollection = {
    info: { name: 'API', description: 'Test API' },
    item: [
      {
        name: 'Auth',
        item: [
          {
            name: 'Login',
            request: { method: 'POST', url: { raw: 'https://api.example.com/auth' } },
            response: [
              { code: 200, status: 'OK', body: '{"Status":{"Code":"0"}}' },
              { code: 401, status: 'Unauthorized', body: '{"Status":{"Code":"401","Message":"Invalid credentials"}}' },
              { code: 403, status: 'Forbidden', body: '{"Status":{"Code":"403","Message":"Access denied"}}' }
            ]
          }
        ]
      }
    ]
  };

  const baselineSnapshot = parseCollection(baselineCollection, { currentApiData: {}, currentExamples: {} });
  const currentSnapshot = parseCollection(currentCollection, { currentApiData: {}, currentExamples: {} });

  const metadata = {
    baseline: { commit: 'a', fileHash: '1', collectionPath: 'test.json' },
    current: { commit: 'b', fileHash: '2', collectionPath: 'test.json' }
  };

  const diff = diffSnapshots({ baseline: baselineSnapshot, current: currentSnapshot, metadata });

  assert.equal(diff.errorCodes.added.length, 2);
  assert.ok(diff.errorCodes.added.some((e) => e.code === '401'));
  assert.ok(diff.errorCodes.added.some((e) => e.code === '403'));
  assert.ok(diff.htmlBlocksChanged.includes('ERROR_CODES_CONTENT'));
});

// Scenario 2: Top-level folder rename triggers welcome update
test('Integration: Folder rename at top level triggers welcome block update', () => {
  const baselineCollection = {
    info: { name: 'API', description: 'Description' },
    item: [
      {
        name: 'Authentication',
        description: 'Auth endpoints',
        item: [
          {
            name: 'Login',
            request: { method: 'POST', url: { raw: 'https://api.example.com/auth' } },
            response: []
          }
        ]
      }
    ]
  };

  const currentCollection = {
    info: { name: 'API', description: 'Description' },
    item: [
      {
        name: 'User Management',
        description: 'Auth endpoints',
        item: [
          {
            name: 'Login',
            request: { method: 'POST', url: { raw: 'https://api.example.com/auth' } },
            response: []
          }
        ]
      }
    ]
  };

  const baselineSnapshot = parseCollection(baselineCollection, { currentApiData: {}, currentExamples: {} });
  const currentSnapshot = parseCollection(currentCollection, { currentApiData: {}, currentExamples: {} });

  const metadata = {
    baseline: { commit: 'a', fileHash: '1', collectionPath: 'test.json' },
    current: { commit: 'b', fileHash: '2', collectionPath: 'test.json' }
  };

  const diff = diffSnapshots({ baseline: baselineSnapshot, current: currentSnapshot, metadata });

  assert.ok(diff.welcome.changedSections.includes('supportCards'));
  assert.ok(diff.htmlBlocksChanged.includes('WELCOME_CONTENT'));
});

// Scenario 3: Collection description change triggers welcome update only
test('Integration: Collection description change triggers welcome block update only', () => {
  const baselineCollection = {
    info: { name: 'SiliconExpert API', description: 'Old description' },
    item: [
      {
        name: 'Search',
        item: [
          {
            name: 'Search Parts',
            request: { method: 'POST', url: { raw: 'https://api.example.com/search' } },
            response: [{ code: 200, status: 'OK', body: '{}' }]
          }
        ]
      }
    ]
  };

  const currentCollection = {
    info: { name: 'SiliconExpert API', description: 'New enhanced description' },
    item: [
      {
        name: 'Search',
        item: [
          {
            name: 'Search Parts',
            request: { method: 'POST', url: { raw: 'https://api.example.com/search' } },
            response: [{ code: 200, status: 'OK', body: '{}' }]
          }
        ]
      }
    ]
  };

  const baselineSnapshot = parseCollection(baselineCollection, { currentApiData: {}, currentExamples: {} });
  const currentSnapshot = parseCollection(currentCollection, { currentApiData: {}, currentExamples: {} });

  const metadata = {
    baseline: { commit: 'a', fileHash: '1', collectionPath: 'test.json' },
    current: { commit: 'b', fileHash: '2', collectionPath: 'test.json' }
  };

  const diff = diffSnapshots({ baseline: baselineSnapshot, current: currentSnapshot, metadata });

  assert.ok(diff.welcome.changedSections.length > 0);
  assert.ok(diff.htmlBlocksChanged.includes('WELCOME_CONTENT'));
  assert.equal(diff.summary.endpointsAdded, 0);
  assert.equal(diff.summary.endpointsChanged, 0);
});

// Scenario 4: Missing error-codes anchor causes hard fail
test('Integration: Missing ERROR_CODES_CONTENT anchor throws error', () => {
  const htmlWithoutErrorCodes = `
    <!DOCTYPE html>
    <html>
    <script>
      const API_DATA = {};
      const EXAMPLES = {};
      const WELCOME_CONTENT = {};
      const RELEASE_NOTES_CONTENT = {};
    </script>
    </html>
  `;

  assert.throws(
    () => parseHtmlBlocks(htmlWithoutErrorCodes),
    (error) => error.message.includes('ERROR_CODES_CONTENT')
  );
});

// Scenario 5: Update HTML blocks with error codes
test('Integration: updateHtmlBlocks correctly patches error-codes block', () => {
  const minimalHtml = `
    <!DOCTYPE html>
    <html>
    <script>
      const API_DATA = {};
      const EXAMPLES = {};
      const WELCOME_CONTENT = {};
      const ERROR_CODES_CONTENT = { statusCodes: [] };
      const RELEASE_NOTES_CONTENT = { items: [] };
    </script>
    </html>
  `;

  const payload = {
    apiData: { test: 'data' },
    examples: { example: 'value' },
    welcomeContent: { title: 'Welcome' },
    errorCodes: { statusCodes: [{ code: '401', meaning: 'Unauthorized' }] },
    releaseNotesContent: { items: [] }
  };

  const result = updateHtmlBlocks(minimalHtml, payload);

  assert.ok(result.html.includes('Unauthorized'));
  assert.ok(result.html.includes('"code"') && result.html.includes('401'));
});

// Scenario 6: Idempotency test - second run produces no diff
test('Integration: Idempotent - second run with same input yields zero diff', () => {
  const collection = {
    info: { name: 'API', description: 'Test API' },
    item: [
      {
        name: 'Search',
        item: [
          {
            name: 'Get Data',
            request: { method: 'GET', url: { raw: 'https://api.example.com/data' } },
            response: [{ code: 200, status: 'OK', body: '{}' }]
          }
        ]
      }
    ]
  };

  const snapshot1 = parseCollection(collection, { currentApiData: {}, currentExamples: {} });
  const snapshot2 = parseCollection(collection, { currentApiData: snapshot1.apiData, currentExamples: snapshot1.examples });

  const metadata = {
    baseline: { commit: 'a', fileHash: '1', collectionPath: 'test.json' },
    current: { commit: 'b', fileHash: '2', collectionPath: 'test.json' }
  };

  const diff = diffSnapshots({ baseline: snapshot1, current: snapshot2, metadata });

  assert.equal(diff.summary.endpointsAdded, 0);
  assert.equal(diff.summary.endpointsRemoved, 0);
  assert.equal(diff.summary.endpointsChanged, 0);
  assert.equal(diff.summary.errorCodesChanged, 0);
});

// Scenario 7: Error codes only update when they actually change
test('Integration: Error block patch only on actual error changes', () => {
  const baselineSnapshot = {
    categories: [],
    endpoints: [
      {
        id: 'login',
        method: 'POST',
        path: '/auth',
        description: 'Login',
        params: [],
        examples: [],
        categoryId: 'auth',
        responses: [{ code: 200, status: 'OK', body: '{}' }]
      }
    ],
    apiData: {},
    examples: {},
    errorCodes: {
      statusCodes: [{ code: '0', meaning: 'Success' }],
      httpCodes: [{ code: 200, meaning: 'OK' }],
      notes: []
    },
    welcomeContent: { title: 'API' }
  };

  const currentSnapshot = {
    categories: [],
    endpoints: [
      {
        id: 'login',
        method: 'POST',
        path: '/auth',
        description: 'Login (updated)',
        params: [],
        examples: [],
        categoryId: 'auth',
        responses: [{ code: 200, status: 'OK', body: '{}' }]
      }
    ],
    apiData: {},
    examples: {},
    errorCodes: {
      statusCodes: [{ code: '0', meaning: 'Success' }],
      httpCodes: [{ code: 200, meaning: 'OK' }],
      notes: []
    },
    welcomeContent: { title: 'API' }
  };

  const metadata = {
    baseline: { commit: 'a', fileHash: '1', collectionPath: 'test.json' },
    current: { commit: 'b', fileHash: '2', collectionPath: 'test.json' }
  };

  const diff = diffSnapshots({ baseline: baselineSnapshot, current: currentSnapshot, metadata });

  assert.equal(diff.errorCodes.added.length, 0);
  assert.equal(diff.errorCodes.removed.length, 0);
  assert.equal(diff.errorCodes.changed.length, 0);
  assert.ok(!diff.htmlBlocksChanged.includes('ERROR_CODES_CONTENT'));
});

// Scenario 8: Multiple error sources consolidated into single entry
test('Integration: Multiple endpoints with same error code consolidate into one entry', () => {
  const collection = {
    info: { name: 'API', description: 'Test' },
    item: [
      {
        name: 'Search',
        item: [
          {
            name: 'Endpoint 1',
            request: { method: 'GET', url: { raw: 'https://api.example.com/ep1' } },
            response: [
              {
                code: 200,
                status: 'OK',
                body: '{"Status":{"Code":"5","Message":"Auth error"}}'
              }
            ]
          },
          {
            name: 'Endpoint 2',
            request: { method: 'GET', url: { raw: 'https://api.example.com/ep2' } },
            response: [
              {
                code: 200,
                status: 'OK',
                body: '{"Status":{"Code":"5","Message":"Auth error"}}'
              }
            ]
          }
        ]
      }
    ]
  };

  const snapshot = parseCollection(collection, { currentApiData: {}, currentExamples: {} });

  const error5Entries = snapshot.errorCodes.statusCodes.filter((e) => e.code === '5');
  assert.equal(error5Entries.length, 1);
  assert.equal(error5Entries[0].sources.length, 2);
});
