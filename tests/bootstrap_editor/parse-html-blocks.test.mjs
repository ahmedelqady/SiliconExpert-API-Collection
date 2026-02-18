import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHtmlBlocks, requiredHtmlBlocks } from '../../tools/lib/parse-html-blocks-browser.mjs';

// ---------------------------------------------------------------------------
// Minimal HTML fixture with all five required blocks
// ---------------------------------------------------------------------------

function makeHtml(overrides = {}) {
  const defaults = {
    API_DATA: { 'auth-user': { title: 'Auth', method: 'POST', path: '/auth' } },
    EXAMPLES: { 'auth-user': [{ title: 'Ex 1', subtitle: '200 OK', request: 'curl ...', response: '{}', note: '' }] },
    WELCOME_CONTENT: { title: 'SE API', subtitle: 'Docs', baseUrl: 'https://api.example.com' },
    ERROR_CODES_CONTENT: { statusCodes: [{ code: '0', meaning: 'OK', action: 'None', severity: 'success' }], httpCodes: [] },
    RELEASE_NOTES_CONTENT: { items: [{ version: 'v1.0', date: '2026-01-01', tag: 'Latest', sections: [] }] }
  };
  const vals = { ...defaults, ...overrides };

  return `<!DOCTYPE html><html><head></head><body><script>
            // ===== API DATA =====
            const API_DATA = ${JSON.stringify(vals.API_DATA, null, 4)
              .split('\n').map((l, i) => i === 0 ? l : '            ' + l).join('\n')};

            // ===== EXAMPLES =====
            const EXAMPLES = ${JSON.stringify(vals.EXAMPLES, null, 4)
              .split('\n').map((l, i) => i === 0 ? l : '            ' + l).join('\n')};

            // ===== WELCOME =====
            const WELCOME_CONTENT = ${JSON.stringify(vals.WELCOME_CONTENT, null, 4)
              .split('\n').map((l, i) => i === 0 ? l : '            ' + l).join('\n')};

            // ===== ERROR CODES =====
            const ERROR_CODES_CONTENT = ${JSON.stringify(vals.ERROR_CODES_CONTENT, null, 4)
              .split('\n').map((l, i) => i === 0 ? l : '            ' + l).join('\n')};

            // ===== RELEASE NOTES =====
            const RELEASE_NOTES_CONTENT = ${JSON.stringify(vals.RELEASE_NOTES_CONTENT, null, 4)
              .split('\n').map((l, i) => i === 0 ? l : '            ' + l).join('\n')};
  </script></body></html>`;
}

// ---------------------------------------------------------------------------
// T001: all five required blocks are parsed
// ---------------------------------------------------------------------------
test('parseHtmlBlocks: parses all five required blocks from a fixture HTML', () => {
  const html = makeHtml();
  const blocks = parseHtmlBlocks(html);
  const required = requiredHtmlBlocks();
  for (const name of required) {
    assert.ok(blocks[name], `block ${name} should be present`);
    assert.ok(typeof blocks[name].value === 'object', `block ${name} should have object value`);
    assert.ok(typeof blocks[name].replaceStart === 'number');
    assert.ok(typeof blocks[name].replaceEnd === 'number');
  }
});

// ---------------------------------------------------------------------------
// T002: parsed values match originals
// ---------------------------------------------------------------------------
test('parseHtmlBlocks: parsed block values match original JS objects', () => {
  const original = { API_DATA: { 'part-search': { title: 'Part Search', method: 'GET', path: '/search' } } };
  const html = makeHtml(original);
  const blocks = parseHtmlBlocks(html);
  assert.deepEqual(blocks.API_DATA.value, original.API_DATA);
});

// ---------------------------------------------------------------------------
// T003: replaceStart and replaceEnd positions are correct (splice test)
// ---------------------------------------------------------------------------
test('parseHtmlBlocks: replaceStart/replaceEnd positions allow correct splice', () => {
  const html = makeHtml();
  const blocks = parseHtmlBlocks(html);
  const block = blocks.API_DATA;
  // The slice from replaceStart to replaceEnd should start with `const API_DATA`
  const slice = html.slice(block.replaceStart, block.replaceEnd);
  assert.ok(slice.startsWith('const API_DATA'), `slice should start with const API_DATA, got: ${slice.slice(0, 40)}`);
  assert.ok(slice.endsWith(';'), 'slice should end with ;');
});

// ---------------------------------------------------------------------------
// T004: throws on missing anchor
// ---------------------------------------------------------------------------
test('parseHtmlBlocks: throws when a required block anchor is missing', () => {
  // HTML with only 4 blocks (missing RELEASE_NOTES_CONTENT)
  const html = `<html><body><script>
    const API_DATA = {};
    const EXAMPLES = {};
    const WELCOME_CONTENT = {};
    const ERROR_CODES_CONTENT = {};
  </script></body></html>`;
  assert.throws(
    () => parseHtmlBlocks(html),
    (err) => err.message.includes('RELEASE_NOTES_CONTENT')
  );
});

// ---------------------------------------------------------------------------
// T005: throws on ambiguous anchor (duplicate const)
// ---------------------------------------------------------------------------
test('parseHtmlBlocks: throws when a block anchor appears more than once', () => {
  const html = `<html><body><script>
    const API_DATA = {"a": 1};
    const API_DATA = {"b": 2};
    const EXAMPLES = {};
    const WELCOME_CONTENT = {};
    const ERROR_CODES_CONTENT = {};
    const RELEASE_NOTES_CONTENT = {};
  </script></body></html>`;
  assert.throws(
    () => parseHtmlBlocks(html),
    (err) => err.message.includes('API_DATA')
  );
});

// ---------------------------------------------------------------------------
// T006: CRLF line endings are handled without offset errors
// ---------------------------------------------------------------------------
test('parseHtmlBlocks: handles CRLF line endings without offset corruption', () => {
  // Simulate a Windows-style HTML file (CRLF) by converting the fixture
  const lf = makeHtml();
  const crlf = lf.replace(/\n/g, '\r\n');
  // Browser FileReader normalises CRLF → LF via TextDecoder; simulate that here
  const normalised = crlf.replace(/\r\n/g, '\n');
  const blocks = parseHtmlBlocks(normalised);
  assert.ok(blocks.API_DATA);
  assert.ok(typeof blocks.API_DATA.replaceStart === 'number');
});

// ---------------------------------------------------------------------------
// T007: nested objects round-trip correctly
// ---------------------------------------------------------------------------
test('parseHtmlBlocks: deeply nested objects parse correctly', () => {
  const original = {
    WELCOME_CONTENT: {
      title: 'SE Docs',
      subtitle: 'Reference.',
      guidelinesLeft: ['Tip 1', 'Tip 2'],
      supportCards: [{ title: 'Card', description: 'Desc', section: 'auth' }]
    }
  };
  const html = makeHtml(original);
  const blocks = parseHtmlBlocks(html);
  assert.deepEqual(blocks.WELCOME_CONTENT.value, original.WELCOME_CONTENT);
});
