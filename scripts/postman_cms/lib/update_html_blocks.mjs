import { parseHtmlBlocks, requiredHtmlBlocks, serializeConstObject } from './parse_html_blocks.mjs';

function replaceRange(content, start, end, replacement) {
  return `${content.slice(0, start)}${replacement}${content.slice(end)}`;
}

export function updateHtmlBlocks(html, payload) {
  const parsed = parseHtmlBlocks(html);
  const missing = requiredHtmlBlocks().filter((name) => !parsed[name]);
  if (missing.length > 0) {
    throw new Error(`Missing required HTML anchors: ${missing.join(', ')}`);
  }

  const updates = {
    API_DATA: payload.apiData,
    EXAMPLES: payload.examples,
    WELCOME_CONTENT: payload.welcomeContent,
    ERROR_CODES_CONTENT: payload.errorCodes,
    RELEASE_NOTES_CONTENT: payload.releaseNotesContent
  };

  const replacements = Object.entries(updates)
    .map(([name, value]) => {
      if (value === undefined) return null;
      const block = parsed[name];
      return {
        name,
        start: block.replaceStart,
        end: block.replaceEnd,
        text: serializeConstObject(name, value)
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.start - a.start);

  let nextHtml = html;
  for (const patch of replacements) {
    nextHtml = replaceRange(nextHtml, patch.start, patch.end, patch.text);
  }

  return {
    html: nextHtml,
    parsed
  };
}
