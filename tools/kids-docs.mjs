// Keeps the kids' guide (kids-docs/) in step with the game's code. See kids-docs/README.md.
//
// Slides say what code they describe: data-src="path#name" on a slide or a code excerpt,
// data-code="path#name" (live code) and data-val="path#NAME.field" (live values). The
// fingerprint of every referenced definition is kept in kids-docs/stamps.json. When the code
// changes, the slides that describe it may need updating:
//
//   node tools/kids-docs.mjs            check: which slides describe code that changed
//   node tools/kids-docs.mjs --stamp    after reviewing / updating them: accept the code as it is
//   node tools/kids-docs.mjs --defer    not now: note the slides as outdated (the guide shows a
//                                       note on them) and accept the code; --stamp clears notes
//
// Stamping also rewrites the markers in the game's code (a "kids-docs:" comment above every
// referenced definition, naming the slides) and the written fallbacks of data-val values.
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseRefs, refKey, extract, fingerprint, MARKER, readValue, formatValue } from '../kids-docs/refs.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const KIDS = join(ROOT, 'kids-docs'), STAMPS = join(KIDS, 'stamps.json');
const read = p => readFileSync(join(ROOT, p), 'utf8');
const pages = () => readdirSync(KIDS).filter(f => f.endsWith('.html')).sort();

// every slide and the references it makes: Map 'page#slide' -> [ref]
export function slideRefs() {
  const out = new Map();
  for (const page of pages()) {
    for (const [, attrs, body] of read(join('kids-docs', page)).matchAll(/<section class="slide"([^>]*)>([\s\S]*?)<\/section>/g)) {
      const id = attrs.match(/\bid="([^"]+)"/)[1], refs = [];
      for (const [, kind, list] of (attrs + body).matchAll(/\bdata-(src|code|val)="([^"]+)"/g))
        refs.push(...(kind === 'val' ? parseRefs(list.replace(/#([\w$]+).*/, '#$1')) : parseRefs(list)));
      if (refs.length) out.set(`${page}#${id}`, refs);
    }
  }
  return out;
}

// Map refKey -> { ref, slides: [...], hash | error }
export function references() {
  const refs = new Map();
  for (const [slide, list] of slideRefs()) for (const ref of list) {
    const k = refKey(ref);
    if (!refs.has(k)) refs.set(k, { ref, slides: [] });
    if (!refs.get(k).slides.includes(slide)) refs.get(k).slides.push(slide);
  }
  for (const r of refs.values()) {
    if (!existsSync(join(ROOT, r.ref.path)) || !statSync(join(ROOT, r.ref.path)).isFile()) { r.error = `${r.ref.path} does not exist`; continue; }
    const e = extract(read(r.ref.path), r.ref.path, r.ref.name);
    if (e.error) r.error = e.error; else { r.hash = fingerprint(e.text); r.line = e.line; }
  }
  return refs;
}

const loadStamps = () => existsSync(STAMPS) ? JSON.parse(readFileSync(STAMPS, 'utf8')) : { refs: {}, outdated: {} };
function saveStamps(s) {
  const sort = o => Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(STAMPS, JSON.stringify({ refs: sort(s.refs), outdated: sort(s.outdated ?? {}) }, null, 2) + '\n');
}

// ---- markers in the game's code ---------------------------------------------------------------
// "// kids-docs: combat.html#arc-code #hit-test, start.html#parts (see kids-docs/README.md)"
const slideList = slides => {
  const byPage = new Map();
  for (const s of [...slides].sort()) { const [p, id] = s.split('#'); byPage.set(p, [...(byPage.get(p) ?? []), id]); }
  return [...byPage].map(([p, ids]) => `${p}#${ids.join(' #')}`).join(', ');
};
function walk(dir, ext, out = []) {
  for (const f of readdirSync(join(ROOT, dir))) {
    const p = join(dir, f);
    if (f.startsWith('.') || f === 'node_modules' || f === '__pycache__') continue;
    if (statSync(join(ROOT, p)).isDirectory()) walk(p, ext, out); else if (ext.some(e => f.endsWith(e))) out.push(p);
  }
  return out;
}
// file -> its text with the markers it should have
export function markedFiles(refs = references()) {
  const want = new Map();   // file -> Map(definition line in the unmarked text -> Set(slides))
  const files = new Set([...walk('src', ['.js']), ...walk('blender', ['.py']), ...walk('tools', ['.mjs'])]
    .filter(f => read(f).split('\n').some(l => MARKER.test(l))));
  for (const r of refs.values()) {
    if (r.error || !r.ref.name || r.ref.name === 'header') continue;
    files.add(r.ref.path);
  }
  const out = new Map();
  for (const file of files) {
    const clean = read(file).split('\n').filter(l => !MARKER.test(l)), text = clean.join('\n'), lines = new Map();
    for (const r of refs.values()) {
      if (r.error || r.ref.path !== file || !r.ref.name || r.ref.name === 'header') continue;
      const at = extract(text, file, r.ref.name).line;
      lines.set(at, new Set([...(lines.get(at) ?? []), ...r.slides]));
    }
    const res = [...clean], py = file.endsWith('.py');
    for (const [at, slides] of [...lines].sort(([a], [b]) => b - a)) {
      const indent = clean[at].match(/^\s*/)[0];
      res.splice(at, 0, `${indent}${py ? '#' : '//'} kids-docs: ${slideList(slides)} (see kids-docs/README.md)`);
    }
    out.set(file, res.join('\n'));
  }
  return out;
}

// ---- live values: the written fallbacks match the game ----------------------------------------
const VOID = new Set(['img', 'br', 'meta', 'link', 'input', 'hr', 'source', 'wbr']);
async function valueFixes() {
  const fixes = [];
  for (const page of pages()) {
    const html = read(join('kids-docs', page)), stack = [];
    for (const m of html.matchAll(/<(\/?)(\w+)([^>]*)>/g)) {
      const [, close, tag, attrs] = m;
      if (close) { while (stack.length && stack.pop().tag !== tag); continue; }
      const lang = attrs.match(/\blang="(\w+)"/)?.[1];
      const val = attrs.match(/\bdata-val="([^"#]+)#([^"]+)"/);
      if (val) {
        const end = html.indexOf(`</${tag}>`, m.index), inner = html.slice(m.index + m[0].length, end);
        const mod = await import(pathToFileURL(join(ROOT, val[1])).href), v = readValue(mod, val[2]);
        const l = lang ?? [...stack].reverse().find(s => s.lang)?.lang ?? 'en', fmt = attrs.match(/\bdata-fmt="(\w+)"/)?.[1];
        const want = v === undefined ? null : formatValue(v, fmt, l);
        if (want === null) fixes.push({ page, error: `${val[1]}#${val[2]} is not a value` });
        else if (inner !== want) fixes.push({ page, at: m.index + m[0].length, end, have: inner, want, ref: `${val[1]}#${val[2]}` });
      }
      if (!VOID.has(tag) && !attrs.endsWith('/')) stack.push({ tag, lang });
    }
  }
  return fixes;
}

// ---- the check ---------------------------------------------------------------------------------
export async function check() {
  const refs = references(), stamps = loadStamps(), problems = { errors: [], stale: [], markers: [], values: [] };
  for (const [k, r] of refs) {
    if (r.error) problems.errors.push(`${r.error} (used by ${r.slides.join(', ')})`);
    else if (stamps.refs[k] !== r.hash) problems.stale.push({ key: k, slides: r.slides, isNew: !stamps.refs[k] });
  }
  for (const [file, text] of markedFiles(refs)) if (read(file) !== text) problems.markers.push(file);
  for (const f of await valueFixes()) problems.values.push(f.error ? `${f.page}: ${f.error}` : `${f.page}: ${f.ref} is ${f.want}, the page says ${f.have}`);
  return problems;
}
export function describe(p) {
  const lines = [];
  if (p.errors.length) lines.push('Broken references in kids-docs (fix the data-src / data-code / data-val):', ...p.errors.map(e => '  ' + e));
  if (p.stale.length) {
    const bySlide = new Map();
    for (const s of p.stale) for (const slide of s.slides) bySlide.set(slide, [...(bySlide.get(slide) ?? []), s.key + (s.isNew ? ' (new)' : '')]);
    lines.push('Game code that the kids\' guide explains has changed. Review these slides (both languages)',
      'and update what no longer matches, then run "npm run kids-docs -- --stamp". To leave it for',
      'later, "npm run kids-docs -- --defer" notes the slides as outdated instead:',
      ...[...bySlide].map(([slide, keys]) => `  kids-docs/${slide}: ${keys.join(', ')}`));
  }
  if (p.markers.length) lines.push('kids-docs markers out of date (npm run kids-docs -- --stamp rewrites them):', ...p.markers.map(f => '  ' + f));
  if (p.values.length) lines.push('Written values differ from the game (npm run kids-docs -- --stamp fixes them):', ...p.values.map(v => '  ' + v));
  return lines.join('\n');
}

async function stamp(defer) {
  const refs = references(), stamps = loadStamps();
  stamps.outdated ??= {};
  const errors = [...refs.values()].filter(r => r.error);
  if (errors.length) { console.error(describe({ errors: errors.map(r => r.error), stale: [], markers: [], values: [] })); process.exit(1); }
  for (const [k, r] of refs) {
    const changed = stamps.refs[k] && stamps.refs[k] !== r.hash;
    for (const slide of r.slides) {
      if (defer && changed) stamps.outdated[slide] = [stamps.outdated[slide], `${k} changed`].filter(Boolean).join('; ');
      else if (!defer) delete stamps.outdated[slide];
    }
  }
  stamps.refs = Object.fromEntries([...refs].map(([k, r]) => [k, r.hash]));
  for (const slide of Object.keys(stamps.outdated)) if (![...refs.values()].some(r => r.slides.includes(slide))) delete stamps.outdated[slide];
  saveStamps(stamps);
  for (const [file, text] of markedFiles(refs)) if (read(file) !== text) { writeFileSync(join(ROOT, file), text); console.log('markers:', file); }
  const fixes = await valueFixes();
  for (const page of new Set(fixes.map(f => f.page))) {
    let html = read(join('kids-docs', page));
    for (const f of fixes.filter(f => f.page === page && !f.error).sort((a, b) => b.at - a.at)) html = html.slice(0, f.at) + f.want + html.slice(f.end);
    writeFileSync(join(KIDS, page), html);
    console.log('values:', page);
  }
  const notes = Object.keys(stamps.outdated);
  console.log(`stamped ${refs.size} references` + (notes.length ? `; ${notes.length} slide(s) noted as outdated: ${notes.join(', ')}` : ''));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = process.argv[2];
  if (arg === '--stamp' || arg === '--defer') await stamp(arg === '--defer');
  else {
    const p = await check(), text = describe(p);
    console.log(text || 'kids-docs: up to date with the game');
    if (text) process.exit(1);
  }
}
