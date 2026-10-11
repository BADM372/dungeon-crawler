// Depth (0 at the surface, MAX_DEPTH at the bottom) and its theme. Plain data, so the world
// worker can use it too. depthOf(cube key) = -Y.
import { THEMES } from './themes.js';
import { parse } from './coords.js';

export const MAX_DEPTH = 20;
export const depthOf = k => -parse(k)[1];

export function themeAt(depth) {
  let t = THEMES[0];
  for (const x of THEMES) if (depth >= x.at) t = x;
  return t;
}

// the themes around a (fractional) depth and how far we are between their starts: light is
// blended between them so every step down gets a little darker
export function lightAt(depth) {
  let i = 0;
  while (i + 1 < THEMES.length && depth >= THEMES[i + 1].at) i++;
  const a = THEMES[i], b = THEMES[i + 1] || a;
  const t = b === a ? 0 : Math.min(1, Math.max(0, (depth - a.at) / (b.at - a.at)));
  return { a: a.light, b: b.light, t };
}
