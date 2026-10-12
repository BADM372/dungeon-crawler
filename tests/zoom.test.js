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
    for (let i = 0; i < 5; i++) zoom = stepZoom(zoom, direction);
    for (let i = 0; i < 5; i++) zoom = stepZoom(zoom, -direction);
    assert.equal(zoom, DEFAULT_ZOOM);
  }
  assert.equal(stepZoom(DEFAULT_ZOOM, 0), DEFAULT_ZOOM);
});

test('zoom stays bounded and steps away from either limit without drift', () => {
  for (const direction of [-1, 1]) {
    let zoom = DEFAULT_ZOOM;
    for (let i = 0; i < 100; i++) {
      zoom = stepZoom(zoom, direction);
      assert.ok(zoom >= 0.15 && zoom <= 1.4);
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
