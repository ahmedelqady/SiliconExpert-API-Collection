import crypto from 'node:crypto';

export function stableStringify(value) {
  return JSON.stringify(sortDeep(value), null, 2);
}

export function sortDeep(value) {
  if (Array.isArray(value)) {
    return value.map(sortDeep);
  }
  if (!value || typeof value !== 'object') {
    return value;
  }

  const sorted = {};
  for (const key of Object.keys(value).sort()) {
    sorted[key] = sortDeep(value[key]);
  }
  return sorted;
}

export function hashObject(value) {
  const str = stableStringify(value);
  return crypto.createHash('sha256').update(str).digest('hex');
}

export function hashString(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

export function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'item';
}

export function toBool(value) {
  if (typeof value === 'boolean') return value;
  if (value === undefined || value === null) return false;
  const normalized = String(value).trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes';
}

export function cleanText(value) {
  return String(value || '')
    .replace(/\r/g, '')
    .trim();
}

export function stripMarkdown(value) {
  return cleanText(value)
    .replace(/^#+\s+/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[(.*?)\]\([^)]*\)/g, '$1');
}

export function firstSentence(value) {
  const text = stripMarkdown(value).replace(/\s+/g, ' ').trim();
  if (!text) return '';
  const match = text.match(/^(.+?[.!?])(?:\s|$)/);
  return match ? match[1].trim() : text;
}

export function uniqueBy(items, keyFn) {
  const seen = new Set();
  const output = [];
  for (const item of items) {
    const key = keyFn(item);
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(item);
  }
  return output;
}

export function compareArrays(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}
