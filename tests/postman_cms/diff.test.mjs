import test from 'node:test';
import assert from 'node:assert/strict';

import { diffSnapshots } from '../../scripts/postman_cms/lib/diff_snapshots.mjs';

const metadata = {
  baseline: { commit: 'a', fileHash: '1', collectionPath: 'collection.json' },
  current: { commit: 'b', fileHash: '2', collectionPath: 'collection.json' }
};

test('diffSnapshots includes error and welcome deltas', () => {
  const baseline = {
    categories: [{ id: 'auth' }],
    endpoints: [{ id: 'auth-user', method: 'POST', path: '/auth', params: [], description: 'a', examples: [], categoryId: 'auth' }],
    apiData: { 'auth-user': { title: 'Auth' } },
    examples: {},
    errorCodes: { statusCodes: [{ code: '0', meaning: 'ok' }] },
    welcomeContent: { title: 'A', subtitle: 'A', supportCards: [] }
  };

  const current = {
    categories: [{ id: 'auth' }, { id: 'search' }],
    endpoints: [{ id: 'auth-user', method: 'POST', path: '/auth', params: [{ name: 'x' }], description: 'b', examples: [{ title: 'ex' }], categoryId: 'search' }],
    apiData: { 'auth-user': { title: 'Auth2' } },
    examples: { 'auth-user': [{ title: 'ex' }] },
    errorCodes: { statusCodes: [{ code: '0', meaning: 'ok' }, { code: '5', meaning: 'auth fail' }] },
    welcomeContent: { title: 'B', subtitle: 'A', supportCards: [{ title: 'x' }] }
  };

  const diff = diffSnapshots({ baseline, current, metadata });

  assert.equal(diff.summary.categoriesAdded, 1);
  assert.equal(diff.summary.endpointsChanged, 1);
  assert.equal(diff.summary.errorCodesAdded, 1);
  assert.ok(diff.welcome.changedSections.includes('title'));
  assert.ok(diff.welcome.changedSections.includes('supportCards'));
});
