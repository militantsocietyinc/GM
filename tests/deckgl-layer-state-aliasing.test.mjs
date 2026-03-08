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
      'constructor must shallow-copy initialState to prevent caller aliasing',
    );
  });

  it('setLayers does not assign the layers argument directly', () => {
    assert.ok(
      !src.includes('this.state.layers = layers;'),
      'setLayers must shallow-copy the layers argument to prevent caller aliasing',
    );
  });

  it('getState returns a deep-enough copy of layers and pan', () => {
    const getStateMatch = src.match(/public getState\(\): DeckMapState \{([\s\S]*?)\n  \}/);
    assert.ok(getStateMatch, 'getState method must exist');
    const body = getStateMatch[1];
    assert.ok(
      body.includes('layers: { ...this.state.layers }'),
      'getState must shallow-copy layers to prevent external mutation',
    );
    assert.ok(
      body.includes('pan: { ...this.state.pan }'),
      'getState must shallow-copy pan to prevent external mutation',
    );
  });

  it('onStateChange callbacks never pass this.state directly', () => {
    assert.ok(
      !src.includes('this.onStateChange?.(this.state)'),
      'onStateChange must pass a copy (via this.getState()) not the raw reference',
    );
  });
});
