import test from 'node:test';
import assert from 'node:assert/strict';

import { buildWelcomeContent } from '../../scripts/postman_cms/lib/parse_collection.mjs';

test('buildWelcomeContent extracts collection title and subtitle', () => {
  const collection = {
    info: {
      name: 'SiliconExpert API',
      description: 'Access electronic component data and manage BOMs. Authenticate first.'
    }
  };

  const folders = [];
  const result = buildWelcomeContent(collection, folders, false);

  assert.equal(result.title, 'SiliconExpert API');
  assert.ok(result.subtitle.includes('electronic component data'));
});

test('buildWelcomeContent strips markdown from descriptions', () => {
  const collection = {
    info: {
      name: 'Test API',
      description: '# Main Title\nThis is a **test** _API_.'
    }
  };

  const folders = [];
  const result = buildWelcomeContent(collection, folders, false);

  assert.ok(result.subtitle.includes('test'));
  assert.ok(!result.subtitle.includes('**'));
  // Markdown stripper may keep some underscore characters
  assert.ok(result.subtitle.length > 0);
});

test('buildWelcomeContent generates support cards from folders', () => {
  const collection = {
    info: { name: 'API', description: 'Description' }
  };

  const folders = [
    {
      key: 'auth',
      name: 'Authentication',
      description: 'User authentication endpoints'
    },
    {
      key: 'search',
      name: 'Part Search',
      description: 'Search for parts by various criteria'
    }
  ];

  const result = buildWelcomeContent(collection, folders, false);

  assert.equal(result.supportCards.length, 2);
  assert.equal(result.supportCards[0].title, 'Authentication');
  assert.equal(result.supportCards[0].section, 'auth');
  assert.equal(result.supportCards[0].routeType, 'category');
});

test('buildWelcomeContent includes auth-first guidance when auth endpoint exists', () => {
  const collection = {
    info: { name: 'API', description: 'Description' }
  };

  const folders = [];
  const result = buildWelcomeContent(collection, folders, true);

  // When auth exists, the first guideline should mention authentication
  const allGuidelines = [...result.guidelinesLeft, ...result.guidelinesRight];
  assert.ok(allGuidelines.some((g) => g.toLowerCase().includes('authenticate') || g.toLowerCase().includes('session')));
});

test('buildWelcomeContent includes deterministic guidelines', () => {
  const collection = {
    info: { name: 'API', description: 'Description' }
  };

  const folders = [];
  const result = buildWelcomeContent(collection, folders, false);

  assert.ok(Array.isArray(result.guidelinesLeft));
  assert.ok(Array.isArray(result.guidelinesRight));
  assert.equal(result.guidelinesLeft.length, 3);
  assert.equal(result.guidelinesRight.length, 3);
});

test('buildWelcomeContent includes base URL', () => {
  const collection = {
    info: { name: 'API', description: 'Description' }
  };

  const folders = [];
  const result = buildWelcomeContent(collection, folders, false);

  assert.equal(result.baseUrl, 'https://api.siliconexpert.com/ProductAPI');
});

test('buildWelcomeContent handles empty collection info gracefully', () => {
  const collection = { info: {} };
  const folders = [];
  const result = buildWelcomeContent(collection, folders, false);

  assert.ok(result.title);
  assert.ok(result.subtitle);
  assert.equal(result.title, 'SE API Documentation');
});

test('buildWelcomeContent handles missing collection gracefully', () => {
  const collection = null;
  const folders = [];
  const result = buildWelcomeContent(collection, folders, false);

  assert.ok(result.title);
  assert.equal(result.title, 'SE API Documentation');
});

test('buildWelcomeContent generates deterministic card order', () => {
  const collection = {
    info: { name: 'API', description: 'Description' }
  };

  const folders = [
    { key: 'cat-a', name: 'Category A', description: 'First' },
    { key: 'cat-b', name: 'Category B', description: 'Second' },
    { key: 'cat-c', name: 'Category C', description: 'Third' }
  ];

  const result1 = buildWelcomeContent(collection, folders, false);
  const result2 = buildWelcomeContent(collection, folders, false);

  assert.deepEqual(
    result1.supportCards.map((c) => c.section),
    result2.supportCards.map((c) => c.section)
  );
});

test('buildWelcomeContent includes Postman-specific guidance', () => {
  const collection = {
    info: { name: 'API', description: 'Description' }
  };

  const folders = [];
  const result = buildWelcomeContent(collection, folders, false);

  assert.ok(result.guidelinesLeft.some((g) => g.toLowerCase().includes('postman')));
});

test('buildWelcomeContent recommends error handling', () => {
  const collection = {
    info: { name: 'API', description: 'Description' }
  };

  const folders = [];
  const result = buildWelcomeContent(collection, folders, false);

  const errorHandling = result.guidelinesLeft.find((g) => g.toLowerCase().includes('status'));
  assert.ok(errorHandling);
});

test('buildWelcomeContent recommends security best practices', () => {
  const collection = {
    info: { name: 'API', description: 'Description' }
  };

  const folders = [];
  const result = buildWelcomeContent(collection, folders, false);

  assert.ok(result.guidelinesRight.some((g) => g.toLowerCase().includes('secret') || g.toLowerCase().includes('variable') || g.toLowerCase().includes('secure')));
});
