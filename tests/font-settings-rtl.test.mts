import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { applyFont } from '../src/services/font-settings.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const mainCss = readFileSync(resolve(__dirname, '../src/styles/main.css'), 'utf-8');

function withMockDocument(run: (calls: { set: string[]; remove: string[] }) => void): void {
  const calls = { set: [] as string[], remove: [] as string[] };
  const originalDocument = globalThis.document;

  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      documentElement: {
        style: {
          setProperty: (name: string) => {
            calls.set.push(name);
          },
          removeProperty: (name: string) => {
            calls.remove.push(name);
          },
        },
      },
    },
  });

  try {
    run(calls);
  } finally {
    if (originalDocument === undefined) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (globalThis as any).document;
    } else {
      Object.defineProperty(globalThis, 'document', {
        configurable: true,
        value: originalDocument,
      });
    }
  }
}

describe('font settings RTL-safe contract', () => {
  it('applies the system preference through --font-body-base only', () => {
    withMockDocument((calls) => {
      applyFont('system');
      assert.deepEqual(calls.set, ['--font-body-base']);
      assert.deepEqual(calls.remove, []);
      assert.ok(!calls.set.includes('--font-body'), 'must not inline --font-body');
    });
  });

  it('removes the base override when switching back to mono', () => {
    withMockDocument((calls) => {
      applyFont('mono');
      assert.deepEqual(calls.set, []);
      assert.deepEqual(calls.remove, ['--font-body-base']);
      assert.ok(!calls.remove.includes('--font-body'), 'must not remove --font-body directly');
    });
  });

  it('lets RTL and CJK rules compose through --font-body-base', () => {
    assert.match(
      mainCss,
      /\[dir="rtl"\]\s*\{\s*--font-body:\s*'Tajawal', 'Geeza Pro', 'SF Arabic', 'Tahoma', var\(--font-body-base\);/s,
    );
    assert.match(
      mainCss,
      /:lang\(zh-CN\),\s*:lang\(zh\)\s*\{\s*--font-body:\s*'PingFang SC', 'Microsoft YaHei', 'Noto Sans SC', var\(--font-body-base\);/s,
    );
  });
});
