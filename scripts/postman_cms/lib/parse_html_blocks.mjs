import vm from 'node:vm';

const REQUIRED_BLOCKS = [
  'API_DATA',
  'EXAMPLES',
  'WELCOME_CONTENT',
  'ERROR_CODES_CONTENT',
  'RELEASE_NOTES_CONTENT'
];

function findConstStart(html, name) {
  const pattern = new RegExp(`\\bconst\\s+${name}\\s*=`, 'g');
  const matches = [...html.matchAll(pattern)];
  if (matches.length !== 1) {
    throw new Error(`Missing or ambiguous anchor for ${name}`);
  }
  return matches[0].index;
}

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

    if (inLineComment) {
      if (ch === '\n') inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      if (ch === '*' && next === '/') {
        inBlockComment = false;
        i += 1;
      }
      continue;
    }

    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === quote) {
        quote = null;
      }
      continue;
    }

    if (ch === '/' && next === '/') {
      inLineComment = true;
      i += 1;
      continue;
    }
    if (ch === '/' && next === '*') {
      inBlockComment = true;
      i += 1;
      continue;
    }

    if (ch === '"' || ch === '\'' || ch === '`') {
      quote = ch;
      continue;
    }

    if (ch === '{') {
      depth += 1;
      continue;
    }
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        const endIndex = i;
        let semicolonIndex = endIndex + 1;
        while (semicolonIndex < html.length && /\s/.test(html[semicolonIndex])) semicolonIndex += 1;
        if (html[semicolonIndex] !== ';') {
          throw new Error('Object block missing trailing semicolon');
        }
        return {
          objectText: html.slice(openIndex, endIndex + 1),
          replaceStart: startIndex,
          replaceEnd: semicolonIndex + 1
        };
      }
    }
  }

  throw new Error('Unbalanced object block');
}

function parseObject(objectText, name) {
  try {
    return vm.runInNewContext(`(${objectText})`, Object.create(null), { timeout: 1000 });
  } catch (error) {
    throw new Error(`Failed to parse ${name}: ${error.message}`);
  }
}

export function parseHtmlBlocks(html) {
  const blocks = {};

  for (const name of REQUIRED_BLOCKS) {
    const start = findConstStart(html, name);
    const literal = readJsObjectLiteral(html, start);
    blocks[name] = {
      ...literal,
      value: parseObject(literal.objectText, name)
    };
  }

  return blocks;
}

export function serializeConstObject(name, value, indent = '            ') {
  const body = JSON.stringify(value, null, 4)
    .split('\n')
    .map((line) => `${indent}${line}`)
    .join('\n');
  return `${indent}const ${name} = ${body};`;
}

export function requiredHtmlBlocks() {
  return [...REQUIRED_BLOCKS];
}
