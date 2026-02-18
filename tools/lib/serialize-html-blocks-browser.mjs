/**
 * serialize-html-blocks-browser.mjs
 * Browser-compatible port of the fixed serializeConstObject from
 * scripts/postman_cms/lib/parse_html_blocks.mjs
 *
 * Key invariant: replaceStart points to the `c` in `const NAME =`, i.e.
 * AFTER the HTML's own leading whitespace.  The `const` declaration line
 * must NOT receive an extra indent prefix — the HTML's whitespace before
 * replaceStart is preserved as-is.  Only the body lines (opening `{` onward)
 * receive the indent so they align with the surrounding script block.
 */

const DEFAULT_INDENT = '            '; // 12 spaces — matches SE_API_Docs HTML

/**
 * Serialise a const block back to a string ready to be spliced into HTML.
 *
 * @param {string} name    Const variable name, e.g. 'API_DATA'
 * @param {unknown} value  Value to serialise (must be JSON-serialisable)
 * @param {string} [indent] Indentation prefix for body lines (default 12 spaces)
 * @returns {string}       e.g. `const API_DATA = {\n            "key": "val"\n            };`
 */
export function serializeConstObject(name, value, indent = DEFAULT_INDENT) {
  // JSON.stringify produces the opening `{` on the first line.
  // The first line sits directly after `= ` on the const declaration, so it
  // must NOT be prefixed.  All subsequent lines (interior + closing `}`) need
  // the indent to stay aligned with the surrounding HTML script block.
  const lines = JSON.stringify(value, null, 4).split('\n');
  const [firstLine, ...restLines] = lines;
  const indentedRest = restLines.map((line) => `${indent}${line}`).join('\n');
  const body = restLines.length > 0 ? `${firstLine}\n${indentedRest}` : firstLine;
  return `const ${name} = ${body};`;
}

/**
 * Apply a set of updated block values to the HTML string.
 * Each key in `updates` must match a block name (e.g. 'API_DATA').
 * Blocks are spliced back using the replaceStart/replaceEnd positions from
 * parseHtmlBlocks.
 *
 * @param {string} html       Full HTML string
 * @param {object} blocks     Output of parseHtmlBlocks (contains replaceStart/replaceEnd per block)
 * @param {object} updates    { [blockName]: newValue } — only specified blocks are updated
 * @returns {string}          Modified HTML string
 */
export function applyBlockUpdates(html, blocks, updates) {
  // Process in reverse order so earlier offsets stay valid after each splice.
  const names = Object.keys(updates).sort((a, b) => {
    const posA = blocks[a]?.replaceStart ?? 0;
    const posB = blocks[b]?.replaceStart ?? 0;
    return posB - posA; // descending
  });

  let result = html;
  for (const name of names) {
    const block = blocks[name];
    if (!block) throw new Error(`applyBlockUpdates: block '${name}' not found in parsed blocks`);
    const serialized = serializeConstObject(name, updates[name]);
    result = result.slice(0, block.replaceStart) + serialized + result.slice(block.replaceEnd);
  }
  return result;
}
