import { hashObject } from './utils.mjs';

function diffLists(before = [], after = [], keyFn = (v) => v) {
  const beforeMap = new Map(before.map((item) => [keyFn(item), item]));
  const afterMap = new Map(after.map((item) => [keyFn(item), item]));

  const added = [];
  const removed = [];
  const changed = [];

  for (const [key, value] of afterMap.entries()) {
    if (!beforeMap.has(key)) {
      added.push(value);
      continue;
    }
    const oldValue = beforeMap.get(key);
    if (JSON.stringify(oldValue) !== JSON.stringify(value)) {
      changed.push({ before: oldValue, after: value });
    }
  }

  for (const [key, value] of beforeMap.entries()) {
    if (!afterMap.has(key)) removed.push(value);
  }

  return { added, removed, changed };
}

function endpointChangeTypes(beforeEndpoint, afterEndpoint) {
  const types = [];
  if (beforeEndpoint.method !== afterEndpoint.method) types.push('method');
  if (beforeEndpoint.path !== afterEndpoint.path) types.push('path');
  if (JSON.stringify(beforeEndpoint.params) !== JSON.stringify(afterEndpoint.params)) types.push('params');
  if ((beforeEndpoint.description || '') !== (afterEndpoint.description || '')) types.push('description');
  if (JSON.stringify(beforeEndpoint.examples) !== JSON.stringify(afterEndpoint.examples)) types.push('examples');
  if ((beforeEndpoint.categoryId || '') !== (afterEndpoint.categoryId || '')) types.push('category');
  return types;
}

function indexByCode(entries = []) {
  const map = new Map();
  for (const entry of entries) {
    map.set(String(entry.code), entry);
  }
  return map;
}

export function diffSnapshots({ baseline, current, metadata }) {
  const categoryDiff = diffLists(baseline.categories, current.categories, (item) => item.id);

  const baselineEndpoints = new Map(baseline.endpoints.map((endpoint) => [endpoint.id, endpoint]));
  const currentEndpoints = new Map(current.endpoints.map((endpoint) => [endpoint.id, endpoint]));

  const endpointAdded = [];
  const endpointRemoved = [];
  const endpointChanged = [];

  for (const [id, endpoint] of currentEndpoints.entries()) {
    if (!baselineEndpoints.has(id)) {
      endpointAdded.push(id);
      continue;
    }
    const beforeEndpoint = baselineEndpoints.get(id);
    const changeTypes = endpointChangeTypes(beforeEndpoint, endpoint);
    if (changeTypes.length) {
      endpointChanged.push({ id, changeTypes });
    }
  }

  for (const id of baselineEndpoints.keys()) {
    if (!currentEndpoints.has(id)) endpointRemoved.push(id);
  }

  const baselineStatusMap = indexByCode(baseline.errorCodes?.statusCodes || []);
  const currentStatusMap = indexByCode(current.errorCodes?.statusCodes || []);

  const errorAdded = [];
  const errorRemoved = [];
  const errorChanged = [];

  for (const [code, item] of currentStatusMap.entries()) {
    if (!baselineStatusMap.has(code)) {
      errorAdded.push(item);
      continue;
    }
    const previous = baselineStatusMap.get(code);
    if (JSON.stringify(previous) !== JSON.stringify(item)) {
      errorChanged.push({ code, before: previous, after: item });
    }
  }
  for (const [code, item] of baselineStatusMap.entries()) {
    if (!currentStatusMap.has(code)) errorRemoved.push(item);
  }

  const welcomeChangedSections = [];
  const baselineWelcome = baseline.welcomeContent || {};
  const currentWelcome = current.welcomeContent || {};
  for (const section of ['title', 'subtitle', 'guidelinesLeft', 'guidelinesRight', 'supportCards', 'baseUrl']) {
    if (JSON.stringify(baselineWelcome[section]) !== JSON.stringify(currentWelcome[section])) {
      welcomeChangedSections.push(section);
    }
  }

  const htmlBlocksChanged = [];
  if (JSON.stringify(baseline.apiData) !== JSON.stringify(current.apiData)) htmlBlocksChanged.push('API_DATA');
  if (JSON.stringify(baseline.examples) !== JSON.stringify(current.examples)) htmlBlocksChanged.push('EXAMPLES');
  if (JSON.stringify(baseline.errorCodes) !== JSON.stringify(current.errorCodes)) htmlBlocksChanged.push('ERROR_CODES_CONTENT');
  if (JSON.stringify(baseline.welcomeContent) !== JSON.stringify(current.welcomeContent)) htmlBlocksChanged.push('WELCOME_CONTENT');
  htmlBlocksChanged.push('RELEASE_NOTES_CONTENT');

  const summary = {
    categoriesAdded: categoryDiff.added.length,
    categoriesRemoved: categoryDiff.removed.length,
    categoriesChanged: categoryDiff.changed.length,
    endpointsAdded: endpointAdded.length,
    endpointsRemoved: endpointRemoved.length,
    endpointsChanged: endpointChanged.length,
    errorCodesAdded: errorAdded.length,
    errorCodesRemoved: errorRemoved.length,
    errorCodesChanged: errorChanged.length,
    welcomeSectionsChanged: welcomeChangedSections.length
  };

  return {
    baseline: metadata.baseline,
    current: metadata.current,
    summary,
    categories: {
      added: categoryDiff.added.map((item) => item.id),
      removed: categoryDiff.removed.map((item) => item.id),
      changed: categoryDiff.changed.map((entry) => entry.after.id)
    },
    endpoints: {
      added: endpointAdded.sort(),
      removed: endpointRemoved.sort(),
      changed: endpointChanged.sort((a, b) => a.id.localeCompare(b.id))
    },
    errorCodes: {
      added: errorAdded,
      removed: errorRemoved,
      changed: errorChanged
    },
    welcome: {
      changedSections: welcomeChangedSections
    },
    htmlBlocksChanged,
    hashes: {
      baseline: hashObject({
        apiData: baseline.apiData,
        examples: baseline.examples,
        errorCodes: baseline.errorCodes,
        welcomeContent: baseline.welcomeContent
      }),
      current: hashObject({
        apiData: current.apiData,
        examples: current.examples,
        errorCodes: current.errorCodes,
        welcomeContent: current.welcomeContent
      })
    }
  };
}
