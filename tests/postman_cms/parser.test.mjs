import test from 'node:test';
import assert from 'node:assert/strict';

import { parseCollection } from '../../scripts/postman_cms/lib/parse_collection.mjs';

function sampleCollection() {
  return {
    info: {
      name: 'Sample API',
      description: '# Intro\nAuthenticate first. Then call APIs.'
    },
    item: [
      {
        name: 'Authentication',
        description: 'Authentication endpoints',
        item: [
          {
            name: 'Authenticate User',
            request: {
              method: 'POST',
              url: { raw: 'https://api.example.com/ProductAPI/search/authenticateUser' }
            },
            response: [
              {
                name: 'Success JSON',
                code: 200,
                status: 'OK',
                body: '{"Status":{"Code":"0","Message":"Successful Operation"}}'
              },
              {
                name: 'Auth Fail XML',
                code: 401,
                status: 'Unauthorized',
                body: '<ServiceResult><Code>5</Code><Message>Authentication Failed</Message></ServiceResult>'
              }
            ]
          }
        ]
      },
      {
        name: 'Part Search Operations',
        description: 'Search endpoints',
        item: [
          {
            name: 'Part Search',
            request: {
              method: 'POST',
              url: { raw: 'https://api.example.com/ProductAPI/search/partsearch', query: [{ key: 'partNumber', value: 'lm317' }] },
              body: { mode: 'raw', raw: '{"partNumber":"lm317"}' }
            },
            response: [
              {
                name: 'Validation',
                code: 400,
                status: 'Bad Request',
                body: '{"status":{"code":"3","message":"Invalid Parameters"}}'
              }
            ]
          }
        ]
      }
    ]
  };
}

test('parseCollection builds deterministic welcome and error catalog', () => {
  const snapshot = parseCollection(sampleCollection(), { currentApiData: {}, currentExamples: {} });

  assert.equal(snapshot.welcomeContent.title, 'Sample API');
  assert.equal(snapshot.welcomeContent.supportCards.length, 2);
  assert.equal(snapshot.welcomeContent.supportCards[0].routeType, 'category');

  const statusCodes = snapshot.errorCodes.statusCodes.map((entry) => entry.code);
  assert.deepEqual(statusCodes, ['0', '3', '5']);

  const auth = snapshot.errorCodes.statusCodes.find((entry) => entry.code === '5');
  assert.equal(auth.severity, 'auth');

  const validation = snapshot.errorCodes.statusCodes.find((entry) => entry.code === '3');
  assert.equal(validation.severity, 'validation');

  const httpCodes = snapshot.errorCodes.httpCodes.map((entry) => entry.code);
  assert.deepEqual(httpCodes, [200, 400, 401]);
});

test('parseCollection keeps deterministic ordering of categories', () => {
  const snapshot = parseCollection(sampleCollection(), { currentApiData: {}, currentExamples: {} });
  assert.deepEqual(snapshot.categories.map((entry) => entry.id), ['auth', 'search']);
});
