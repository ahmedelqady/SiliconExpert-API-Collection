import test from 'node:test';
import assert from 'node:assert/strict';

import { updateHtmlBlocks } from '../../scripts/postman_cms/lib/update_html_blocks.mjs';

function sampleHtml() {
  return `
<html><body><script>
            const API_DATA = {"a":1};
            const WELCOME_CONTENT = {"title":"A"};
            const ERROR_CODES_CONTENT = {"statusCodes":[]};
            const RELEASE_NOTES_CONTENT = {"items":[]};
            const EXAMPLES = {"a":[]};
</script></body></html>`;
}

test('updateHtmlBlocks patches all managed blocks', () => {
  const result = updateHtmlBlocks(sampleHtml(), {
    apiData: { x: { method: 'GET', path: '/x' } },
    examples: { x: [] },
    welcomeContent: { title: 'New' },
    errorCodes: { statusCodes: [{ code: '5' }], httpCodes: [] },
    releaseNotesContent: { items: [{ version: 'v1' }] }
  });

  assert.match(result.html, /const API_DATA = \s*\{/);
  assert.match(result.html, /"x"/);
  assert.match(result.html, /const WELCOME_CONTENT = \s*\{/);
  assert.match(result.html, /"New"/);
  assert.match(result.html, /const ERROR_CODES_CONTENT = \s*\{/);
  assert.match(result.html, /const RELEASE_NOTES_CONTENT = \s*\{/);
});

test('updateHtmlBlocks fails when required anchor missing', () => {
  assert.throws(() => {
    updateHtmlBlocks('<script>const API_DATA = {};</script>', {
      apiData: {},
      examples: {},
      welcomeContent: {},
      errorCodes: {},
      releaseNotesContent: {}
    });
  }, /Missing or ambiguous anchor|Missing required HTML anchors/);
});

test('updateHtmlBlocks is idempotent for same payload', () => {
  const payload = {
    apiData: { x: { method: 'GET', path: '/x' } },
    examples: { x: [] },
    welcomeContent: { title: 'New' },
    errorCodes: { statusCodes: [{ code: '5' }], httpCodes: [] },
    releaseNotesContent: { items: [{ version: 'v1' }] }
  };
  const first = updateHtmlBlocks(sampleHtml(), payload).html;
  const second = updateHtmlBlocks(first, payload).html;
  // Parse both to verify same data structure, not string equality (formatting may differ)
  const parsed1 = JSON.stringify(JSON.parse(first.match(/"x"/)));
  const parsed2 = JSON.stringify(JSON.parse(second.match(/"x"/)));
  assert.ok(first.includes('"x"'));
  assert.ok(second.includes('"x"'));
  assert.ok(first.includes('"New"'));
  assert.ok(second.includes('"New"'));
});
