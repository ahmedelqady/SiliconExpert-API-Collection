#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

import { parseCollection } from './lib/parse_collection.mjs';
import { diffSnapshots } from './lib/diff_snapshots.mjs';
import { parseHtmlBlocks } from './lib/parse_html_blocks.mjs';
import { updateHtmlBlocks } from './lib/update_html_blocks.mjs';
import { writeArtifacts } from './lib/write_artifacts.mjs';
import { hashString, toBool } from './lib/utils.mjs';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[key] = 'true';
      continue;
    }
    args[key] = next;
    i += 1;
  }
  return args;
}

function getRequired(args, name) {
  if (!args[name] || !String(args[name]).trim()) {
    throw new Error(`Missing required argument --${name}`);
  }
  return String(args[name]).trim();
}

function readGitFile(ref, filePath) {
  try {
    return execSync(`git show ${ref}:${filePath}`, { stdio: ['ignore', 'pipe', 'pipe'] }).toString('utf8');
  } catch {
    return null;
  }
}

function gitCurrentCommit() {
  try {
    return execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'pipe'] }).toString('utf8').trim();
  } catch {
    return 'WORKTREE';
  }
}

function buildReleaseNotesEntry({ releaseVersion, releaseDate, releaseTitle, diff }) {
  const changed = diff.summary.endpointsAdded + diff.summary.endpointsRemoved + diff.summary.endpointsChanged;
  const status = changed > 0 ? 'changed' : 'no-change';
  const deltaLine = `API delta: +${diff.summary.endpointsAdded} / -${diff.summary.endpointsRemoved} / ~${diff.summary.endpointsChanged}, errors ~${diff.summary.errorCodesChanged}, welcome ~${diff.summary.welcomeSectionsChanged}`;

  return {
    version: releaseVersion,
    date: releaseDate,
    tag: status === 'changed' ? 'Latest' : 'No API Changes',
    sections: [
      {
        title: releaseTitle,
        items: [deltaLine]
      }
    ]
  };
}

function buildReleaseNotesContent(existing, entry) {
  const items = Array.isArray(existing?.items) ? existing.items : [];
  const withoutSameVersion = items.filter((item) => item.version !== entry.version);
  return {
    items: [entry, ...withoutSameVersion].slice(0, 30)
  };
}

function mustExist(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Required file not found: ${filePath}`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  const collectionPath = getRequired(args, 'collection');
  const htmlPath = getRequired(args, 'html');
  const baselineRef = args['baseline-ref'] || args.baseline_ref || 'HEAD~1';
  const releaseVersion = getRequired(args, 'release-version');
  const releaseDate = getRequired(args, 'release-date');
  const releaseTitle = getRequired(args, 'release-title');
  const artifactsDir = args['artifacts-dir'] || 'artifacts';
  const dryRun = toBool(args['dry-run'] ?? args.dry_run ?? false);

  mustExist(collectionPath);
  mustExist(htmlPath);

  const html = fs.readFileSync(htmlPath, 'utf8');
  const parsedHtml = parseHtmlBlocks(html);

  const collectionRaw = fs.readFileSync(collectionPath, 'utf8');
  const currentCollection = JSON.parse(collectionRaw);

  const baselineRaw = readGitFile(baselineRef, collectionPath);
  const baselineCollection = baselineRaw ? JSON.parse(baselineRaw) : currentCollection;

  const currentSnapshot = parseCollection(currentCollection, {
    currentApiData: parsedHtml.API_DATA.value,
    currentExamples: parsedHtml.EXAMPLES.value
  });

  const baselineSnapshot = parseCollection(baselineCollection, {
    currentApiData: parsedHtml.API_DATA.value,
    currentExamples: parsedHtml.EXAMPLES.value
  });

  const currentCommit = gitCurrentCommit();
  const metadata = {
    baseline: {
      commit: baselineRaw ? baselineRef : 'fallback-current',
      fileHash: hashString(baselineRaw || collectionRaw),
      collectionPath
    },
    current: {
      commit: currentCommit,
      fileHash: hashString(collectionRaw),
      collectionPath
    }
  };

  const diff = diffSnapshots({
    baseline: baselineSnapshot,
    current: currentSnapshot,
    metadata
  });

  const releaseEntry = buildReleaseNotesEntry({
    releaseVersion,
    releaseDate,
    releaseTitle,
    diff
  });

  diff.releaseNoteEntry = {
    version: releaseEntry.version,
    date: releaseEntry.date,
    title: releaseTitle,
    status: releaseEntry.tag === 'Latest' ? 'changed' : 'no-change'
  };

  const releaseNotesContent = buildReleaseNotesContent(parsedHtml.RELEASE_NOTES_CONTENT.value, releaseEntry);

  // Only update RELEASE_NOTES_CONTENT from the sync run.
  // API_DATA, EXAMPLES, WELCOME_CONTENT, and ERROR_CODES_CONTENT are curated
  // HTML documentation and must NOT be overwritten with raw Postman data.
  const updated = updateHtmlBlocks(html, {
    releaseNotesContent
  });

  const htmlChanged = updated.html !== html;
  if (htmlChanged && !dryRun) {
    fs.writeFileSync(htmlPath, updated.html, 'utf8');
  }

  const contentSnapshot = {
    api_data: currentSnapshot.apiData,
    examples: currentSnapshot.examples,
    error_codes: currentSnapshot.errorCodes,
    welcome_content: currentSnapshot.welcomeContent
  };

  const artifactPaths = writeArtifacts({
    artifactsDir,
    diff,
    contentSnapshot
  });

  const output = {
    dryRun,
    htmlChanged,
    baselineRef,
    artifacts: artifactPaths,
    summary: diff.summary,
    htmlBlocksChanged: diff.htmlBlocksChanged,
    releaseVersion,
    releaseDate,
    releaseTitle
  };

  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`[postman-cms-sync] ${error.message}\n`);
  process.exitCode = 1;
}
