/**
 * Tests for map rendering performance optimizations (issue #930).
 *
 * Covers:
 * - GlobeMap: flushMarkers uses requestAnimationFrame coalescing
 * - GlobeMap: Three.js renderer configured with powerPreference + antialias:false
 * - DeckGLMap: MapLibre canvas uses powerPreference: 'high-performance'
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const readSrc = (relPath) => readFileSync(resolve(root, relPath), 'utf-8');

// ========================================================================
// 1. GlobeMap render coalescing
// ========================================================================

describe('GlobeMap flushMarkers render coalescing', () => {
  const src = readSrc('src/components/GlobeMap.ts');

  it('flushMarkers uses requestAnimationFrame instead of flushing synchronously', () => {
    // flushMarkers should schedule via RAF, not call htmlElementsData directly
    const flushMethod = src.match(/private flushMarkers\(\)[^{]*\{[\s\S]*?^\s{2}\}/m);
    assert.ok(flushMethod, 'flushMarkers method must exist');
    assert.ok(flushMethod[0].includes('requestAnimationFrame'),
      'flushMarkers must use requestAnimationFrame for coalescing');
    assert.ok(flushMethod[0].includes('flushScheduled'),
      'flushMarkers must use flushScheduled flag to batch calls');
  });

  it('flushMarkersNow performs the actual marker rebuild', () => {
    assert.match(src, /private flushMarkersNow\(\)/,
      'flushMarkersNow method must exist for synchronous marker rebuild');
    // The actual globe.htmlElementsData call should be in flushMarkersNow
    const flushNowMethod = src.match(/private flushMarkersNow\(\)[^{]*\{[\s\S]*?this\.globe\.htmlElementsData\(markers\)/);
    assert.ok(flushNowMethod,
      'flushMarkersNow must call globe.htmlElementsData(markers)');
  });

  it('declares flushScheduled flag for render batching', () => {
    assert.match(src, /private flushScheduled\s*=\s*false/,
      'flushScheduled flag must be declared for render coalescing');
  });
});

// ========================================================================
// 2. GlobeMap renderer optimizations
// ========================================================================

describe('GlobeMap Three.js renderer performance', () => {
  const src = readSrc('src/components/GlobeMap.ts');

  it('sets powerPreference to high-performance in rendererConfig', () => {
    assert.match(src, /powerPreference:\s*'high-performance'/,
      'rendererConfig must request high-performance GPU');
  });

  it('disables antialiasing for better performance on integrated GPUs', () => {
    assert.match(src, /antialias:\s*false/,
      'rendererConfig must disable antialias for performance');
  });
});

// ========================================================================
// 3. DeckGLMap MapLibre GPU preference
// ========================================================================

describe('DeckGLMap MapLibre GPU preference', () => {
  const src = readSrc('src/components/DeckGLMap.ts');

  it('sets canvasContextAttributes with powerPreference high-performance', () => {
    assert.match(src, /canvasContextAttributes:\s*\{\s*powerPreference:\s*'high-performance'\s*\}/,
      'MapLibre Map must request high-performance GPU via canvasContextAttributes');
  });
});
