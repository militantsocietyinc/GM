import test from 'node:test';
import assert from 'node:assert/strict';

import {
  parsePrePushLines,
  shouldGuardReleasePush,
  summarizeDirtyWorktree,
} from '../scripts/release-push-guard.mjs';

test('parsePrePushLines parses git pre-push stdin records', () => {
  const pushes = parsePrePushLines(`
refs/heads/main abc123 refs/heads/main def456
refs/heads/feature ghi789 refs/heads/feature 0000000000000000000000000000000000000000
`);

  assert.deepEqual(pushes, [
    {
      localRef: 'refs/heads/main',
      localSha: 'abc123',
      remoteRef: 'refs/heads/main',
      remoteSha: 'def456',
    },
    {
      localRef: 'refs/heads/feature',
      localSha: 'ghi789',
      remoteRef: 'refs/heads/feature',
      remoteSha: '0000000000000000000000000000000000000000',
    },
  ]);
});

test('shouldGuardReleasePush only enforces for pushes to macos main', () => {
  assert.equal(
    shouldGuardReleasePush('macos', [
      {
        localRef: 'refs/heads/main',
        localSha: 'abc123',
        remoteRef: 'refs/heads/main',
        remoteSha: 'def456',
      },
    ]),
    true,
  );

  assert.equal(
    shouldGuardReleasePush('upstream', [
      {
        localRef: 'refs/heads/main',
        localSha: 'abc123',
        remoteRef: 'refs/heads/main',
        remoteSha: 'def456',
      },
    ]),
    false,
  );

  assert.equal(
    shouldGuardReleasePush('macos', [
      {
        localRef: 'refs/heads/feature',
        localSha: 'abc123',
        remoteRef: 'refs/heads/feature',
        remoteSha: 'def456',
      },
    ]),
    false,
  );
});

test('summarizeDirtyWorktree reports the first few dirty paths', () => {
  assert.equal(
    summarizeDirtyWorktree([
      ' M src/app/biometric-gate.ts',
      'MM tests/biometric-gate.test.mjs',
      '?? tests/release-push-guard.test.mjs',
      ' M scripts/desktop-package.mjs',
    ]),
    'src/app/biometric-gate.ts, tests/biometric-gate.test.mjs, tests/release-push-guard.test.mjs, and 1 more',
  );
});
