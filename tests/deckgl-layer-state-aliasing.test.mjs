import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(resolve(__dirname, '..', 'src/components/DeckGLMap.ts'), 'utf-8');

describe('DeckGLMap layer state isolation', () => {
  it('constructor does not assign initialState directly to this.state', () => {
    assert.ok(
      !src.includes('this.state = initialState'),
      'DeckGLMap constructor must shallow-copy initialState to prevent caller aliasing',
    );
  });

  it('setLayers does not assign the layers argument directly', () => {
    assert.ok(
      !src.includes('this.state.layers = layers;'),
      'setLayers must shallow-copy the layers argument to prevent caller aliasing',
    );
  });
});
