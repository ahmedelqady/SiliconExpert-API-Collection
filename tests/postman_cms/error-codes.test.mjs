import test from 'node:test';
import assert from 'node:assert/strict';

import { buildErrorCatalog } from '../../scripts/postman_cms/lib/parse_collection.mjs';

test('buildErrorCatalog extracts HTTP status codes', () => {
  const entries = [
    {
      method: 'POST',
      path: '/auth',
      description: 'Authenticate user',
      responses: [
        { code: 200, status: 'OK', body: '{}' },
        { code: 401, status: 'Unauthorized', body: '{}' }
      ]
    }
  ];

  const result = buildErrorCatalog(entries);
  const codes = result.httpCodes.map((e) => e.code).sort();
  assert.deepEqual(codes, [200, 401]);
});

test('buildErrorCatalog extracts application-level status codes from JSON responses', () => {
  const entries = [
    {
      method: 'POST',
      path: '/search',
      description: 'Search parts',
      responses: [
        {
          code: 200,
          status: 'OK',
          body: '{"Status":{"Code":"0","Message":"Success"}}'
        },
        {
          code: 200,
          status: 'OK',
          body: '{"Status":{"Code":"5","Message":"Authentication Required"}}'
        }
      ]
    }
  ];

  const result = buildErrorCatalog(entries);
  const statusCodes = result.statusCodes.map((e) => e.code).sort();
  assert.deepEqual(statusCodes, ['0', '5']);
});

test('buildErrorCatalog classifies errors by severity', () => {
  const entries = [
    {
      method: 'POST',
      path: '/auth',
      description: 'Authentication endpoint',
      responses: [
        {
          code: 401,
          status: 'Unauthorized',
          body: '{"Status":{"Code":"401","Message":"Invalid credentials"}}'
        }
      ]
    },
    {
      method: 'GET',
      path: '/search',
      description: 'Search with rate limits',
      responses: [
        {
          code: 429,
          status: 'Too Many Requests',
          body: '{"Status":{"Code":"429","Message":"Rate limit exceeded"}}'
        }
      ]
    },
    {
      method: 'POST',
      path: '/bom',
      description: 'Create BOM',
      responses: [
        {
          code: 400,
          status: 'Bad Request',
          body: '{"Status":{"Code":"400","Message":"Invalid parameters"}}'
        }
      ]
    }
  ];

  const result = buildErrorCatalog(entries);

  const auth = result.statusCodes.find((e) => e.code === '401');
  assert.equal(auth.severity, 'auth');

  const quota = result.statusCodes.find((e) => e.code === '429');
  assert.equal(quota.severity, 'quota');

  const validation = result.statusCodes.find((e) => e.code === '400');
  assert.equal(validation.severity, 'validation');
});

test('buildErrorCatalog extracts XML status codes', () => {
  const entries = [
    {
      method: 'POST',
      path: '/auth',
      description: 'Authenticate',
      responses: [
        {
          code: 200,
          status: 'OK',
          body: '<ServiceResult><Code>10</Code><Message>XML Auth Success</Message></ServiceResult>'
        }
      ]
    }
  ];

  const result = buildErrorCatalog(entries);
  const statusCodes = result.statusCodes.map((e) => e.code);
  assert.ok(statusCodes.includes('10'));
});

test('buildErrorCatalog generates deterministic recommendations', () => {
  const entries = [
    {
      method: 'GET',
      path: '/quota',
      description: 'Quota check',
      responses: [
        {
          code: 429,
          status: 'Too Many Requests',
          body: '{"Status":{"Code":"429","Message":"Rate limit exceeded"}}'
        }
      ]
    }
  ];

  const result = buildErrorCatalog(entries);
  const quotaError = result.statusCodes.find((e) => e.code === '429');
  assert.ok(quotaError.action.toLowerCase().includes('backoff'));
});

test('buildErrorCatalog tracks error sources', () => {
  const entries = [
    {
      method: 'GET',
      path: '/endpoint1',
      description: 'First endpoint',
      responses: [
        {
          code: 200,
          status: 'OK',
          body: '{"Status":{"Code":"5","Message":"Error"}}'
        }
      ]
    },
    {
      method: 'POST',
      path: '/endpoint2',
      description: 'Second endpoint',
      responses: [
        {
          code: 200,
          status: 'OK',
          body: '{"Status":{"Code":"5","Message":"Error"}}'
        }
      ]
    }
  ];

  const result = buildErrorCatalog(entries);
  const error5 = result.statusCodes.find((e) => e.code === '5');
  assert.ok(error5.sources.includes('GET /endpoint1'));
  assert.ok(error5.sources.includes('POST /endpoint2'));
});

test('buildErrorCatalog ignores malformed JSON responses gracefully', () => {
  const entries = [
    {
      method: 'GET',
      path: '/bad',
      description: 'Bad response',
      responses: [
        {
          code: 500,
          status: 'Internal Server Error',
          body: 'not valid json at all {'
        }
      ]
    }
  ];

  const result = buildErrorCatalog(entries);
  const httpCodes = result.httpCodes.map((e) => e.code);
  assert.ok(httpCodes.includes(500));
});

test('buildErrorCatalog deduplicates error codes', () => {
  const entries = [
    {
      method: 'GET',
      path: '/ep1',
      description: '',
      responses: [
        {
          code: 200,
          status: 'OK',
          body: '{"Status":{"Code":"42","Message":"First occurrence"}}'
        }
      ]
    },
    {
      method: 'POST',
      path: '/ep2',
      description: '',
      responses: [
        {
          code: 200,
          status: 'OK',
          body: '{"Status":{"Code":"42","Message":"Second occurrence"}}'
        }
      ]
    }
  ];

  const result = buildErrorCatalog(entries);
  const code42Entries = result.statusCodes.filter((e) => e.code === '42');
  assert.equal(code42Entries.length, 1);
  assert.equal(code42Entries[0].sources.length, 2);
});

test('buildErrorCatalog includes help notes', () => {
  const entries = [];
  const result = buildErrorCatalog(entries);
  assert.ok(Array.isArray(result.notes));
  assert.ok(result.notes.length > 0);
  assert.ok(result.notes.some((n) => n.toLowerCase().includes('retry')));
});
