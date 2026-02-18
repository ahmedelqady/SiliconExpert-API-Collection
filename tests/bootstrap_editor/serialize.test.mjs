import { test } from 'node:test';
import assert from 'node:assert/strict';
import { serializeConstObject, applyBlockUpdates } from '../../tools/lib/serialize-html-blocks-browser.mjs';
import { parseHtmlBlocks } from '../../tools/lib/parse-html-blocks-browser.mjs';

// ---------------------------------------------------------------------------
// Helper: build minimal fixture HTML (same as parse-html-blocks test)
// ---------------------------------------------------------------------------
function makeHtml(overrides = {}) {
  const defaults = {
    API_DATA: { 'auth-user': { title: 'Auth', method: 'POST', path: '/auth' } },
    EXAMPLES: {},
    WELCOME_CONTENT: { title: 'SE API', subtitle: 'Docs.' },
    ERROR_CODES_CONTENT: { statusCodes: [], httpCodes: [] },
    RELEASE_NOTES_CONTENT: { items: [] }
  };
  const vals = { ...defaults, ...overrides };
  return `<!DOCTYPE html><html><body><script>
            const API_DATA = ${JSON.stringify(vals.API_DATA, null, 4).split('\n').map((l, i) => i === 0 ? l : '            ' + l).join('\n')};
            const EXAMPLES = ${JSON.stringify(vals.EXAMPLES, null, 4).split('\n').map((l, i) => i === 0 ? l : '            ' + l).join('\n')};
            const WELCOME_CONTENT = ${JSON.stringify(vals.WELCOME_CONTENT, null, 4).split('\n').map((l, i) => i === 0 ? l : '            ' + l).join('\n')};
            const ERROR_CODES_CONTENT = ${JSON.stringify(vals.ERROR_CODES_CONTENT, null, 4).split('\n').map((l, i) => i === 0 ? l : '            ' + l).join('\n')};
            const RELEASE_NOTES_CONTENT = ${JSON.stringify(vals.RELEASE_NOTES_CONTENT, null, 4).split('\n').map((l, i) => i === 0 ? l : '            ' + l).join('\n')};
  </script></body></html>`;
}

// ---------------------------------------------------------------------------
// T001: correct output format — no double indent on const line
// ---------------------------------------------------------------------------
test('serializeConstObject: const declaration line has no extra indent prefix', () => {
  const result = serializeConstObject('API_DATA', { key: 'val' });
  assert.ok(result.startsWith('const API_DATA = {'), `should start with 'const API_DATA = {', got: ${result.slice(0, 50)}`);
  assert.ok(!result.startsWith(' '), 'result should not start with a space');
});

// ---------------------------------------------------------------------------
// T002: body lines are indented with 12 spaces
// ---------------------------------------------------------------------------
test('serializeConstObject: body lines are indented with 12 spaces', () => {
  const result = serializeConstObject('API_DATA', { key: 'val' });
  const lines = result.split('\n');
  // Line 2 (index 1) should be `            "key": "val"`
  assert.ok(lines[1].startsWith('            '), `body line should start with 12 spaces, got: "${lines[1]}"`);
});

// ---------------------------------------------------------------------------
// T003: output is parseable by parseHtmlBlocks when spliced into HTML
// ---------------------------------------------------------------------------
test('serializeConstObject: output can be round-tripped via parseHtmlBlocks', () => {
  const value = { 'auth-user': { title: 'Auth', method: 'POST' } };
  const html = makeHtml({ API_DATA: value });
  const blocks = parseHtmlBlocks(html);
  // Serialise again and splice
  const serialized = serializeConstObject('API_DATA', value);
  const newHtml = html.slice(0, blocks.API_DATA.replaceStart) + serialized + html.slice(blocks.API_DATA.replaceEnd);
  const blocks2 = parseHtmlBlocks(newHtml);
  assert.deepEqual(blocks2.API_DATA.value, value);
});

// ---------------------------------------------------------------------------
// T004: nested objects are indented correctly
// ---------------------------------------------------------------------------
test('serializeConstObject: nested objects produce correct multi-level indentation', () => {
  const value = { outer: { inner: 'deep' } };
  const result = serializeConstObject('WELCOME_CONTENT', value);
  assert.ok(result.includes('"outer"'), 'should contain outer key');
  assert.ok(result.includes('"inner"'), 'should contain inner key');
  // Verify parseable by JSON.parse after stripping the const wrapper
  const jsonPart = result.replace(/^const \w+ = /, '').replace(/;$/, '');
  const parsed = JSON.parse(jsonPart);
  assert.deepEqual(parsed, value);
});

// ---------------------------------------------------------------------------
// T005: custom indent parameter is respected
// ---------------------------------------------------------------------------
test('serializeConstObject: respects custom indent parameter', () => {
  const result = serializeConstObject('API_DATA', { key: 'val' }, '  '); // 2-space outer indent
  const lines = result.split('\n');
  // JSON.stringify uses 4-space JSON indent + 2-space outer prefix = 6 spaces on body lines
  assert.ok(lines[1].startsWith('      "key"'), `line should start with 6 spaces (2 outer + 4 JSON), got: "${lines[1]}"`);
});

// ---------------------------------------------------------------------------
// T006: applyBlockUpdates splices correct block and leaves others untouched
// ---------------------------------------------------------------------------
test('applyBlockUpdates: patches one block and leaves others untouched', () => {
  const original = { API_DATA: { 'old-key': { title: 'Old' } } };
  const html = makeHtml(original);
  const blocks = parseHtmlBlocks(html);

  const updated = applyBlockUpdates(html, blocks, {
    API_DATA: { 'new-key': { title: 'New' } }
  });

  const blocks2 = parseHtmlBlocks(updated);
  assert.deepEqual(blocks2.API_DATA.value, { 'new-key': { title: 'New' } });
  // EXAMPLES should be unchanged
  assert.deepEqual(blocks2.EXAMPLES.value, {});
});

// ---------------------------------------------------------------------------
// T007: full round-trip — parse → serialize all five blocks → parse again
// ---------------------------------------------------------------------------
test('applyBlockUpdates: full round-trip preserves all five blocks', () => {
  const originalData = {
    API_DATA: { 'ep-1': { title: 'Endpoint 1', method: 'GET', path: '/ep1' } },
    EXAMPLES: { 'ep-1': [{ title: 'Ex', subtitle: '200 OK', request: 'curl ...', response: '{}', note: '' }] },
    WELCOME_CONTENT: { title: 'Test', subtitle: 'Sub.', baseUrl: 'https://example.com', guidelinesLeft: [], guidelinesRight: [], supportCards: [] },
    ERROR_CODES_CONTENT: { statusCodes: [{ code: '0', meaning: 'OK', action: 'None', severity: 'success' }], httpCodes: [] },
    RELEASE_NOTES_CONTENT: { items: [{ version: 'v1', date: '2026-01-01', tag: 'Latest', sections: [] }] }
  };
  const html = makeHtml(originalData);
  const blocks = parseHtmlBlocks(html);

  // Apply all five blocks back (no-op value-wise)
  const updated = applyBlockUpdates(html, blocks, {
    API_DATA: originalData.API_DATA,
    EXAMPLES: originalData.EXAMPLES,
    WELCOME_CONTENT: originalData.WELCOME_CONTENT,
    ERROR_CODES_CONTENT: originalData.ERROR_CODES_CONTENT,
    RELEASE_NOTES_CONTENT: originalData.RELEASE_NOTES_CONTENT
  });

  const blocks2 = parseHtmlBlocks(updated);
  for (const name of Object.keys(originalData)) {
    assert.deepEqual(blocks2[name].value, originalData[name], `block ${name} should round-trip cleanly`);
  }
});
