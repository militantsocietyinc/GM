#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');

export function parsePrePushLines(stdinText) {
  return stdinText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [localRef, localSha, remoteRef, remoteSha] = line.split(/\s+/);
      return { localRef, localSha, remoteRef, remoteSha };
    });
}

export function shouldGuardReleasePush(remoteName, pushes) {
  if (remoteName !== 'macos') return false;
  return pushes.some((push) => push.remoteRef === 'refs/heads/main');
}

export function summarizeDirtyWorktree(statusLines) {
  const paths = statusLines
    .map((line) => line.slice(3).trim())
    .filter(Boolean);
  if (paths.length === 0) return '';
  if (paths.length === 1) return paths[0];
  if (paths.length === 2) return `${paths[0]}, ${paths[1]}`;
  if (paths.length === 3) return `${paths[0]}, ${paths[1]}, ${paths[2]}`;
  return `${paths[0]}, ${paths[1]}, ${paths[2]}, and ${paths.length - 3} more`;
}

function parseArgs(argv) {
  const options = {
    remote: '',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--remote') {
      options.remote = argv[i + 1] ?? '';
      i += 1;
      continue;
    }
    if (arg.startsWith('--remote=')) {
      options.remote = arg.slice('--remote='.length);
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function runCommand(command, args) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  if ((result.status ?? 1) !== 0) {
    throw new Error(result.stderr?.trim() || `${command} ${args.join(' ')} failed`);
  }
  return result.stdout.trim();
}

async function resolveVariant() {
  const packageJson = JSON.parse(await readFile(path.join(repoRoot, 'package.json'), 'utf8'));
  const script = packageJson.scripts?.['desktop:build:full'] ?? '';
  if (script.includes('--variant finance')) return 'finance';
  if (script.includes('--variant tech')) return 'tech';
  return 'full';
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const stdin = await new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });

  const pushes = parsePrePushLines(stdin);
  if (!shouldGuardReleasePush(options.remote, pushes)) {
    process.exit(0);
  }

  const dirtyStatus = runCommand('git', ['status', '--short']);
  if (dirtyStatus) {
    const summary = summarizeDirtyWorktree(dirtyStatus.split('\n').filter(Boolean));
    console.error('[release-push-guard] Blocked push to macos/main because the worktree is dirty.');
    console.error(`[release-push-guard] Commit or stash local changes first: ${summary}`);
    process.exit(1);
  }

  const variant = await resolveVariant();
  const releaseDoctor = spawnSync(
    process.execPath,
    ['scripts/release-doctor.mjs', '--remote', options.remote, '--variant', variant],
    {
      cwd: repoRoot,
      stdio: 'inherit',
    },
  );

  process.exit(releaseDoctor.status ?? 1);
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isCli) {
  main().catch((error) => {
    console.error(`[release-push-guard] Failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
}
