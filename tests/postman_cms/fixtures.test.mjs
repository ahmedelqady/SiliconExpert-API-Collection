/**
 * Fixture-based regression test.
 *
 * Runs the full parse → diff pipeline against the committed
 * collection.before.json / collection.after.json fixtures and asserts
 * that the output matches expected.diff.json exactly.
 *
 * Purpose: catch any silent behavioural regression in parse_collection or
 * diff_snapshots without requiring the full 11 MB collection file.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseCollection } from '../../scripts/postman_cms/lib/parse_collection.mjs';
import { diffSnapshots } from '../../scripts/postman_cms/lib/diff_snapshots.mjs';
import { hashString } from '../../scripts/postman_cms/lib/utils.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.resolve(__dirname, '../../scripts/postman_cms/fixtures');

function loadFixture(name) {
  const raw = fs.readFileSync(path.join(fixturesDir, name), 'utf8');
  return { raw, parsed: JSON.parse(raw) };
}

const { raw: beforeRaw, parsed: before } = loadFixture('collection.before.json');
const { raw: afterRaw,  parsed: after  } = loadFixture('collection.after.json');
const expected = JSON.parse(fs.readFileSync(path.join(fixturesDir, 'expected.diff.json'), 'utf8'));

function buildDiff() {
  const baselineSnapshot = parseCollection(before, { currentApiData: {}, currentExamples: {} });
  const currentSnapshot  = parseCollection(after,  {
    currentApiData: baselineSnapshot.apiData,
    currentExamples: baselineSnapshot.examples
  });
  const metadata = {
    baseline: { commit: 'fixture-before', fileHash: hashString(beforeRaw), collectionPath: 'collection.before.json' },
    current:  { commit: 'fixture-after',  fileHash: hashString(afterRaw),  collectionPath: 'collection.after.json' }
  };
  return diffSnapshots({ baseline: baselineSnapshot, current: currentSnapshot, metadata });
}

// ─── Summary counts ──────────────────────────────────────────────────────────

test('fixtures: summary counts match expected', () => {
  const diff = buildDiff();
  assert.deepEqual(diff.summary, expected.summary);
});

// ─── Endpoints ───────────────────────────────────────────────────────────────

test('fixtures: new endpoint detected (get-part-details added)', () => {
  const diff = buildDiff();
  assert.ok(diff.endpoints.added.includes('get-part-details'),
    `expected get-part-details in added, got: ${diff.endpoints.added}`);
});

test('fixtures: no endpoints removed', () => {
  const diff = buildDiff();
  assert.deepEqual(diff.endpoints.removed, []);
});

test('fixtures: changed endpoints match expected ids and change types', () => {
  const diff = buildDiff();
  const changedIds = diff.endpoints.changed.map(e => e.id).sort();
  const expectedIds = expected.endpoints.changed.map(e => e.id).sort();
  assert.deepEqual(changedIds, expectedIds);

  // keyword-part-search gained a param (pageSize) and updated description
  const kps = diff.endpoints.changed.find(e => e.id === 'keyword-part-search');
  assert.ok(kps, 'keyword-part-search should be in changed');
  assert.ok(kps.changeTypes.includes('params'), `changeTypes: ${kps.changeTypes}`);
  assert.ok(kps.changeTypes.includes('description'), `changeTypes: ${kps.changeTypes}`);
});

// ─── Error codes ─────────────────────────────────────────────────────────────

test('fixtures: new HTTP error codes detected (401, 404, 429)', () => {
  const diff = buildDiff();
  const addedCodes = diff.errorCodes.added.map(e => e.code).sort();
  assert.deepEqual(addedCodes, ['401', '404', '429']);
});

test('fixtures: no error codes removed', () => {
  const diff = buildDiff();
  assert.deepEqual(diff.errorCodes.removed, []);
});

test('fixtures: 401 classified as auth severity', () => {
  const diff = buildDiff();
  const code401 = diff.errorCodes.added.find(e => e.code === '401');
  assert.ok(code401, '401 should be in added');
  assert.equal(code401.severity, 'auth');
});

test('fixtures: 429 classified as quota severity', () => {
  const diff = buildDiff();
  const code429 = diff.errorCodes.added.find(e => e.code === '429');
  assert.ok(code429, '429 should be in added');
  assert.equal(code429.severity, 'quota');
});

test('fixtures: 404 classified as server or unknown severity', () => {
  const diff = buildDiff();
  const code404 = diff.errorCodes.added.find(e => e.code === '404');
  assert.ok(code404, '404 should be in added');
  // 404 contains "not found" which doesn't match auth/quota/validation/server patterns — unknown
  assert.ok(['server', 'unknown'].includes(code404.severity),
    `unexpected severity: ${code404.severity}`);
});

// ─── Welcome ─────────────────────────────────────────────────────────────────

test('fixtures: welcome sections unchanged (only description changed, not name/folders)', () => {
  const diff = buildDiff();
  // collection description changed but firstSentence is same; folders unchanged
  assert.equal(diff.summary.welcomeSectionsChanged, 0);
});

// ─── HTML blocks ─────────────────────────────────────────────────────────────

test('fixtures: htmlBlocksChanged includes API_DATA and EXAMPLES', () => {
  const diff = buildDiff();
  assert.ok(diff.htmlBlocksChanged.includes('API_DATA'));
  assert.ok(diff.htmlBlocksChanged.includes('EXAMPLES'));
});

test('fixtures: htmlBlocksChanged includes ERROR_CODES_CONTENT', () => {
  const diff = buildDiff();
  assert.ok(diff.htmlBlocksChanged.includes('ERROR_CODES_CONTENT'));
});

test('fixtures: RELEASE_NOTES_CONTENT always included in htmlBlocksChanged', () => {
  const diff = buildDiff();
  assert.ok(diff.htmlBlocksChanged.includes('RELEASE_NOTES_CONTENT'));
});

// ─── Idempotency ─────────────────────────────────────────────────────────────

test('fixtures: idempotent — running after→after produces zero structural diff', () => {
  const afterSnapshot1 = parseCollection(after, { currentApiData: {}, currentExamples: {} });
  const afterSnapshot2 = parseCollection(after, {
    currentApiData: afterSnapshot1.apiData,
    currentExamples: afterSnapshot1.examples
  });
  const metadata = {
    baseline: { commit: 'a', fileHash: '1', collectionPath: 'x' },
    current:  { commit: 'b', fileHash: '2', collectionPath: 'x' }
  };
  const diff = diffSnapshots({ baseline: afterSnapshot1, current: afterSnapshot2, metadata });
  assert.equal(diff.summary.endpointsAdded,   0);
  assert.equal(diff.summary.endpointsRemoved, 0);
  assert.equal(diff.summary.endpointsChanged, 0);
  assert.equal(diff.summary.errorCodesAdded,  0);
  assert.equal(diff.summary.errorCodesChanged,0);
});

// ─── Full diff shape matches expected.diff.json ───────────────────────────────

test('fixtures: full diff shape matches expected.diff.json (summary + endpoints + errorCodes + welcome)', () => {
  const diff = buildDiff();
  // Compare only the deterministic, fixture-stable fields (not hashes or metadata commits)
  assert.deepEqual(diff.summary,           expected.summary);
  assert.deepEqual(diff.endpoints.added.sort(),   expected.endpoints.added.sort());
  assert.deepEqual(diff.endpoints.removed.sort(), expected.endpoints.removed.sort());
  assert.deepEqual(
    diff.endpoints.changed.map(e => e.id).sort(),
    expected.endpoints.changed.map(e => e.id).sort()
  );
  assert.deepEqual(
    diff.errorCodes.added.map(e => e.code).sort(),
    expected.errorCodes.added.map(e => e.code).sort()
  );
  assert.deepEqual(diff.welcome.changedSections, expected.welcome.changedSections);
});
