// OKLCH colour math for recolouring enemies (Oklab: https://bottosson.github.io/posts/oklab/).
// Colours are linear sRGB triples [r, g, b] in 0..1, the space three.js keeps material
// colours in. OKLCH is { l: 0..1, c: chroma (0..~0.37), h: degrees }: lightness and hue
// can change without the perceived brightness drifting the way it does in HSL.
const DEG = Math.PI / 180;
const clamp01 = v => Math.min(1, Math.max(0, v));

export function linearToOklab([r, g, b]) {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s];
}
export function oklabToLinear([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3;
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s];
}
export function toOklch(rgb) {
  const [l, a, b] = linearToOklab(rgb);
  return { l, c: Math.hypot(a, b), h: ((Math.atan2(b, a) / DEG) % 360 + 360) % 360 };
}
const inGamut = rgb => rgb.every(v => v >= -1e-5 && v <= 1 + 1e-5);
// Back to linear sRGB. A colour outside sRGB keeps its lightness and hue and gives up
// chroma until it fits (the CSS Color 4 approach, minus the JND shortcut).
export function fromOklch({ l, c, h }) {
  l = clamp01(l); c = Math.max(0, c);
  const at = c => oklabToLinear([l, c * Math.cos(h * DEG), c * Math.sin(h * DEG)]);
  let rgb = at(c);
  if (!inGamut(rgb)) {
    let lo = 0, hi = c;
    for (let i = 0; i < 24; i++) { const mid = (lo + hi) / 2; if (inGamut(at(mid))) lo = mid; else hi = mid; }
    rgb = at(lo);
  }
  return rgb.map(clamp01);
}

export const srgbToLinear = v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
export const linearToSrgb = v => v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055;
// '#rgb', '#rrggbb' or 'oklch(L C H)' (L in 0..1 or as a percentage) to OKLCH
export function parseColor(s) {
  const ok = /^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)(?:deg)?\s*\)$/i.exec(s.trim());
  if (ok) return { l: +ok[1] / (ok[2] ? 100 : 1), c: +ok[3], h: +ok[4] % 360 };
  let hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(s.trim())?.[1];
  if (!hex) throw new SyntaxError('Unknown colour: ' + s);
  if (hex.length === 3) hex = [...hex].map(d => d + d).join('');
  return toOklch([0, 2, 4].map(i => srgbToLinear(parseInt(hex.slice(i, i + 2), 16) / 255)));
}
export const toLinear = s => fromOklch(parseColor(s));
export const toHex = rgb => '#' + rgb.map(v => Math.round(clamp01(linearToSrgb(v)) * 255).toString(16).padStart(2, '0')).join('');

// A recolour op, turned into a function from linear rgb to linear rgb:
//   a colour string: the anchor becomes exactly that colour, and every other colour moves
//     with it: its lightness and chroma scale by the anchor's ratios, its hue turns as far.
//     So a darker belly stays as much darker. A near-grey anchor has no hue to turn from:
//     then the hue is set outright and chroma shifts rather than scales.
//   an object: { l, c, h } set, then { ls, cs } scale, then { dl, dc, dh } shift.
const GREY = 0.02;
export function recolorFn(op, anchor) {
  if (typeof op === 'string') {
    const to = parseColor(op), from = toOklch(anchor), grey = from.c < GREY;
    const ls = from.l > 1e-3 ? to.l / from.l : 1, cs = to.c / Math.max(from.c, 1e-6), turn = to.h - from.h;
    return rgb => {
      const c = toOklch(rgb);
      return fromOklch({ l: c.l * ls, c: grey ? c.c - from.c + to.c : c.c * cs, h: grey ? to.h : c.h + turn });
    };
  }
  return rgb => {
    const c = toOklch(rgb);
    let { l = c.l, c: chroma = c.c, h = c.h } = op;
    l = l * (op.ls ?? 1) + (op.dl ?? 0);
    chroma = chroma * (op.cs ?? 1) + (op.dc ?? 0);
    return fromOklch({ l, c: chroma, h: h + (op.dh ?? 0) });
  };
}

// The recoloured materials of a model. `materials`: name -> { color, emissive? } (linear rgb);
// `parts`: role -> material names, the first is the role's anchor; `colors`: role or
// material name -> op. A role moves all of its materials (emissive too) from its anchor;
// a material name moves just that one, and is applied after the roles.
// Returns name -> { color, emissive? } for the materials that change.
export function recolorTable(materials, parts = {}, colors = {}) {
  const out = {}, keys = Object.keys(colors);
  for (const key of [...keys.filter(k => parts[k]), ...keys.filter(k => !parts[k])]) {
    const names = parts[key] ?? [key], anchor = materials[names[0]];
    if (!anchor) continue;
    const f = recolorFn(colors[key], anchor.color);
    for (const name of names) {
      const m = materials[name];
      if (!m) continue;
      out[name] = { color: f(m.color), ...(m.emissive && m.emissive.some(v => v > 0) ? { emissive: f(m.emissive) } : {}) };
    }
  }
  return out;
}
