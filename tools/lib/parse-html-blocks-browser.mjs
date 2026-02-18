/**
 * parse-html-blocks-browser.mjs
 * Browser-compatible port of scripts/postman_cms/lib/parse_html_blocks.mjs
 *
 * Parses the five managed `const NAME = {...};` blocks from the HTML file.
 * Uses the brace-balanced scanner to locate each block, then strips the
 * `const NAME = ` prefix and trailing `;` and calls JSON.parse() on the
 * remainder.  This is safe because serializeConstObject always writes blocks
 * with JSON.stringify, so the block body is guaranteed to be valid JSON.
 *
 * Input HTML must be normalised to UTF-8 LF before calling (TextDecoder
 * normalises BOM and CRLF automatically in the browser).
 */

export const REQUIRED_BLOCKS = [
  'API_DATA',
  'EXAMPLES',
  'WELCOME_CONTENT',
  'ERROR_CODES_CONTENT',
  'RELEASE_NOTES_CONTENT'
];

/**
 * Find the character index of `const NAME =` in html.
 * Throws if the pattern is missing or appears more than once.
 */
function findConstStart(html, name) {
  const pattern = new RegExp(`\\bconst\\s+${name}\\s*=`, 'g');
  const matches = [...html.matchAll(pattern)];
  if (matches.length !== 1) {
    throw new Error(`Missing or ambiguous anchor for ${name} (found ${matches.length})`);
  }
  return matches[0].index;
}

/**
 * Brace-balanced scanner — identical logic to parse_html_blocks.mjs.
 * Locates the opening `{` after `startIndex`, scans to the matching `}`,
 * then advances to the trailing `;`.
 *
 * Returns { objectText, replaceStart, replaceEnd }
 *   objectText   — the raw `{ ... }` slice (may contain JS object syntax)
 *   replaceStart — index of `c` in `const` (where replacement begins)
 *   replaceEnd   — index after `;` (where replacement ends)
 */
function readJsObjectLiteral(html, startIndex) {
  const assignIndex = html.indexOf('=', startIndex);
  if (assignIndex < 0) throw new Error('Invalid const assignment');
  const openIndex = html.indexOf('{', assignIndex);
  if (openIndex < 0) throw new Error('Object block opening brace not found');

  let i = openIndex;
  let depth = 0;
  let quote = null;
  let escaped = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (; i < html.length; i += 1) {
    const ch = html[i];
    const next = html[i + 1];

    if (inLineComment) { if (ch === '\n') inLineComment = false; continue; }
    if (inBlockComment) {
      if (ch === '*' && next === '/') { inBlockComment = false; i += 1; }
      continue;
    }
    if (quote) {
      if (escaped) { escaped = false; }
      else if (ch === '\\') { escaped = true; }
      else if (ch === quote) { quote = null; }
      continue;
    }
    if (ch === '/' && next === '/') { inLineComment = true; i += 1; continue; }
    if (ch === '/' && next === '*') { inBlockComment = true; i += 1; continue; }
    if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue; }
    if (ch === '{') { depth += 1; continue; }
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        const endIndex = i;
        let semiIndex = endIndex + 1;
        while (semiIndex < html.length && /\s/.test(html[semiIndex])) semiIndex += 1;
        if (html[semiIndex] !== ';') throw new Error('Object block missing trailing semicolon');
        return { objectText: html.slice(openIndex, endIndex + 1), replaceStart: startIndex, replaceEnd: semiIndex + 1 };
      }
    }
  }
  throw new Error('Unbalanced object block');
}

/**
 * Parse objectText as JSON.
 * serializeConstObject always produces JSON.stringify output, so this is safe.
 * Throws a clear error if the block contains non-JSON syntax (hand-edited).
 */
function parseBlockValue(objectText, name) {
  try {
    return JSON.parse(objectText);
  } catch (err) {
    throw new Error(`${name}: block body is not valid JSON — ${err.message}. If the block was hand-edited with non-JSON syntax, it must be updated to strict JSON format first.`);
  }
}

/**
 * Parse all five managed const blocks from the HTML string.
 * @param {string} html  Full HTML file content (UTF-8, LF line endings)
 * @returns {Record<string, { value: object, replaceStart: number, replaceEnd: number, objectText: string }>}
 */
export function parseHtmlBlocks(html) {
  const blocks = {};
  for (const name of REQUIRED_BLOCKS) {
    const start = findConstStart(html, name);
    const literal = readJsObjectLiteral(html, start);
    blocks[name] = {
      ...literal,
      value: parseBlockValue(literal.objectText, name)
    };
  }
  return blocks;
}

export function requiredHtmlBlocks() {
  return [...REQUIRED_BLOCKS];
}
