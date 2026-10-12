import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_ZOOM, ZOOM_INTERVAL, stepZoom } from '../src/core/zoom.js';

test('default camera magnification is 23% larger', () => {
  assert.equal(1 / DEFAULT_ZOOM, 1.23);
});

test('zoom uses reversible fixed intervals anchored at the default', () => {
  assert.equal(stepZoom(DEFAULT_ZOOM, 1), DEFAULT_ZOOM * ZOOM_INTERVAL);
  assert.equal(stepZoom(DEFAULT_ZOOM, -1), DEFAULT_ZOOM / ZOOM_INTERVAL);
  for (const direction of [-1, 1]) {
    let zoom = DEFAULT_ZOOM;
    for (let i = 0; i < 2; i++) zoom = stepZoom(zoom, direction);
    for (let i = 0; i < 2; i++) zoom = stepZoom(zoom, -direction);
    assert.equal(zoom, DEFAULT_ZOOM);
  }
  assert.equal(stepZoom(DEFAULT_ZOOM, 0), DEFAULT_ZOOM);
});

test('zoom has exactly five levels with the default in the middle', () => {
  let zoom = DEFAULT_ZOOM;
  for (let i = 0; i < 100; i++) zoom = stepZoom(zoom, -1);
  const levels = [zoom];
  for (let i = 0; i < 100; i++) {
    const next = stepZoom(zoom, 1);
    if (next === zoom) break;
    levels.push(next);
    zoom = next;
  }
  assert.equal(levels.length, 5);
  assert.equal(levels[2], DEFAULT_ZOOM);
  assert.equal(levels[0], DEFAULT_ZOOM * ZOOM_INTERVAL ** -2);
  assert.equal(levels[4], DEFAULT_ZOOM * ZOOM_INTERVAL ** 2);
});

test('zoom stays bounded and steps away from either limit without drift', () => {
  for (const direction of [-1, 1]) {
    let zoom = DEFAULT_ZOOM;
    for (let i = 0; i < 100; i++) {
      zoom = stepZoom(zoom, direction);
      assert.ok(zoom >= DEFAULT_ZOOM * ZOOM_INTERVAL ** -2 && zoom <= DEFAULT_ZOOM * ZOOM_INTERVAL ** 2);
    }
    assert.equal(stepZoom(zoom, direction), zoom);
    const away = stepZoom(zoom, -direction);
    assert.notEqual(away, zoom);
    assert.equal(stepZoom(away, direction), zoom);
  }
});

test('off-grid targets snap to the shared grid', () => {
  assert.equal(stepZoom(DEFAULT_ZOOM * 1.01, 1), stepZoom(DEFAULT_ZOOM, 1));
  assert.equal(stepZoom(DEFAULT_ZOOM * 0.99, -1), stepZoom(DEFAULT_ZOOM, -1));
});
