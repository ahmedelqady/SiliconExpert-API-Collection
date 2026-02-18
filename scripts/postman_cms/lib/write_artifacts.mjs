import fs from 'node:fs';
import path from 'node:path';

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

export function buildMarkdownDiff(diff) {
  const lines = [];
  lines.push('# Postman to HTML Sync Diff');
  lines.push('');
  lines.push(`- Baseline: ${diff.baseline.commit}`);
  lines.push(`- Current: ${diff.current.commit}`);
  lines.push('');
  lines.push('## Summary');
  lines.push(`- Categories: +${diff.summary.categoriesAdded} / -${diff.summary.categoriesRemoved} / ~${diff.summary.categoriesChanged}`);
  lines.push(`- Endpoints: +${diff.summary.endpointsAdded} / -${diff.summary.endpointsRemoved} / ~${diff.summary.endpointsChanged}`);
  lines.push(`- Error Codes: +${diff.summary.errorCodesAdded} / -${diff.summary.errorCodesRemoved} / ~${diff.summary.errorCodesChanged}`);
  lines.push(`- Welcome Sections Changed: ${diff.summary.welcomeSectionsChanged}`);
  lines.push('');

  lines.push('## Endpoint Changes');
  lines.push(`- Added: ${diff.endpoints.added.length ? diff.endpoints.added.join(', ') : 'None'}`);
  lines.push(`- Removed: ${diff.endpoints.removed.length ? diff.endpoints.removed.join(', ') : 'None'}`);
  lines.push(`- Changed: ${diff.endpoints.changed.length ? diff.endpoints.changed.map((item) => `${item.id} [${item.changeTypes.join(', ')}]`).join('; ') : 'None'}`);
  lines.push('');

  lines.push('## Error Code Changes');
  lines.push(`- Added: ${diff.errorCodes.added.length ? diff.errorCodes.added.map((item) => item.code).join(', ') : 'None'}`);
  lines.push(`- Removed: ${diff.errorCodes.removed.length ? diff.errorCodes.removed.map((item) => item.code).join(', ') : 'None'}`);
  lines.push(`- Changed: ${diff.errorCodes.changed.length ? diff.errorCodes.changed.map((item) => item.code).join(', ') : 'None'}`);
  lines.push('');

  lines.push('## Welcome Changes');
  lines.push(`- Sections: ${diff.welcome.changedSections.length ? diff.welcome.changedSections.join(', ') : 'None'}`);
  lines.push('');

  lines.push('## HTML Blocks Changed');
  lines.push(`- ${diff.htmlBlocksChanged.join(', ')}`);

  return `${lines.join('\n')}\n`;
}

export function writeArtifacts({ artifactsDir, diff, contentSnapshot }) {
  ensureDir(artifactsDir);

  const jsonPath = path.join(artifactsDir, 'postman_html_diff.json');
  const mdPath = path.join(artifactsDir, 'postman_html_diff.md');
  const snapshotPath = path.join(artifactsDir, 'postman_html_content_snapshot.json');

  fs.writeFileSync(jsonPath, `${JSON.stringify(diff, null, 2)}\n`, 'utf8');
  fs.writeFileSync(mdPath, buildMarkdownDiff(diff), 'utf8');
  fs.writeFileSync(snapshotPath, `${JSON.stringify(contentSnapshot, null, 2)}\n`, 'utf8');

  return { jsonPath, mdPath, snapshotPath };
}
