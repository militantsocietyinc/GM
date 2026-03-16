#!/usr/bin/env node
/**
 * Detect suspicious invisible Unicode in executable repository files.
 *
 * Threat model:
 * - Trojan Source (bidi controls)
 * - Zero-width/invisible control chars
 * - Variation selector steganography / Unicode tags
 * - Private Use Area payload hiding
 *
 * Usage:
 *   node scripts/check-unicode-safety.mjs
 *   node scripts/check-unicode-safety.mjs --staged
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { execFileSync } from 'node:child_process';

const args = new Set(process.argv.slice(2));
const stagedOnly = args.has('--staged');

const ROOT = process.cwd();

const SCAN_ROOTS = [
  'src',
  'server',
  'api',
  'scripts',
  'tests',
  'e2e',
  '.github',
];

const INCLUDED_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.json', '.yml', '.yaml', '.sh',
]);

const EXCLUDED_PREFIXES = [
  '.git/',
  'node_modules/',
  'src/locales/',
  'src/generated/',
  'docs/',
  'blog-site/',
  'public/blog/',
];

const ZERO_WIDTH = new Set([0x200B, 0x200C, 0x200D, 0x2060, 0xFEFF]);

function isBidiControl(cp) {
  return (cp >= 0x202A && cp <= 0x202E) || (cp >= 0x2066 && cp <= 0x2069);
}

function isVariationSelectorSupplement(cp) {
  return cp >= 0xE0100 && cp <= 0xE01EF;
}

function isVariationSelectorSuspicious(cp, prevCp) {
  // FE0F is commonly used with emoji; only flag if chained after ASCII/control.
  if (cp === 0xFE0F) return prevCp === undefined || prevCp <= 0x7F;
  // FE00..FE0E are rare in app source and suspicious for steganography.
  return cp >= 0xFE00 && cp <= 0xFE0E;
}

function isPrivateUseArea(cp) {
  return cp >= 0xE000 && cp <= 0xF8FF;
}

function getExtension(path) {
  const idx = path.lastIndexOf('.');
  return idx === -1 ? '' : path.slice(idx);
}

function shouldScanFile(path) {
  if (EXCLUDED_PREFIXES.some(prefix => path.startsWith(prefix))) return false;
  const ext = getExtension(path);
  if (!INCLUDED_EXTENSIONS.has(ext)) return false;
  return true;
}

function walkDir(rootDir, out) {
  let entries;
  try {
    entries = readdirSync(rootDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const abs = join(rootDir, entry.name);
    const rel = relative(ROOT, abs).replace(/\\/g, '/');
    if (EXCLUDED_PREFIXES.some(prefix => rel.startsWith(prefix))) continue;
    if (entry.isDirectory()) {
      walkDir(abs, out);
      continue;
    }
    if (!entry.isFile()) continue;
    if (!shouldScanFile(rel)) continue;
    out.push(rel);
  }
}

function getRepoFiles() {
  const files = [];
  for (const root of SCAN_ROOTS) {
    const abs = join(ROOT, root);
    try {
      if (statSync(abs).isDirectory()) walkDir(abs, files);
    } catch {
      // ignore missing roots
    }
  }
  return files;
}

function getStagedFiles() {
  let out = '';
  try {
    out = execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR'], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch {
    return [];
  }
  return out
    .split('\n')
    .map(s => s.trim().replace(/\\/g, '/'))
    .filter(Boolean)
    .filter(shouldScanFile);
}

function formatCodePoint(cp) {
  return `U+${cp.toString(16).toUpperCase().padStart(cp > 0xFFFF ? 6 : 4, '0')}`;
}

function classify(cp, prevCp) {
  if (isBidiControl(cp)) return 'bidi-control';
  if (ZERO_WIDTH.has(cp)) return 'zero-width';
  if (isVariationSelectorSupplement(cp)) return 'variation-selector-supplement';
  if (isVariationSelectorSuspicious(cp, prevCp)) return 'variation-selector';
  if (isPrivateUseArea(cp)) return 'private-use-area';
  return null;
}

function scanFile(path) {
  const abs = join(ROOT, path);
  let text;
  try {
    text = readFileSync(abs, 'utf8');
  } catch {
    return [];
  }

  const findings = [];
  const lines = text.split('\n');
  let line = 1;
  let col = 1;
  let prevCp;

  for (const ch of text) {
    const cp = ch.codePointAt(0);
    const kind = classify(cp, prevCp);
    if (kind) {
      const lineText = lines[line - 1] ?? '';
      findings.push({
        path,
        line,
        col,
        kind,
        cp: formatCodePoint(cp),
        lineText,
      });
    }

    if (ch === '\n') {
      line += 1;
      col = 1;
    } else {
      col += 1;
    }
    prevCp = cp;
  }

  return findings;
}

function main() {
  const files = stagedOnly ? getStagedFiles() : getRepoFiles();
  if (files.length === 0) {
    console.log(stagedOnly ? 'Unicode safety: no staged executable files to scan.' : 'Unicode safety: no files matched scan scope.');
    return;
  }

  const findings = [];
  for (const file of files) {
    findings.push(...scanFile(file));
  }

  if (findings.length === 0) {
    console.log(`Unicode safety: scanned ${files.length} file(s), no suspicious hidden Unicode found.`);
    return;
  }

  console.error(`Unicode safety check failed: ${findings.length} suspicious character(s) found.`);
  for (const f of findings.slice(0, 200)) {
    console.error(`${f.path}:${f.line}:${f.col}  ${f.cp}  ${f.kind}`);
    if (f.lineText) console.error(`  ${f.lineText}`);
  }
  if (findings.length > 200) {
    console.error(`... ${findings.length - 200} more finding(s) omitted.`);
  }
  console.error('');
  console.error('If intentional, replace with visible escapes or remove from executable files.');
  process.exit(1);
}

main();
