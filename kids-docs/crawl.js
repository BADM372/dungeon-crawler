// Reads the game's code the way the browser does: starts at src/main.js, follows every import,
// and starts again at the web worker it finds (new Worker(new URL(...))). Used by the guide's
// architecture demos, so their pictures always match the code (needs the game's server).
//
// crawl() resolves to { files, edges, parts }:
//   files: Map path -> { path, part, text, lines, threads: Set('main' | 'worker'), imports: [path] }
//   edges: Map 'from>to' -> number of import lines from one part (folder) into another
//   parts: Map part -> { part, files: [path], lines, threads: Set }
// A part is the folder under src/ (src/core/gear/x.js is "core"), "main" for src/main.js and
// "vendor" for the borrowed libraries (three.js, Scrimshaw), which are not read.

const ROOT = new URL('../', import.meta.url);
const ENTRY = 'src/main.js';

export const partOf = path => path.startsWith('vendor/') ? 'vendor' : path === ENTRY ? 'main' : path.split('/')[1];

// the import specifiers in a file, and the workers it starts
function scan(text) {
  const imports = [], workers = [];
  const code = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
  for (const m of code.matchAll(/^\s*(?:import|export)\b[^;'"`]*?\bfrom\s*['"]([^'"]+)['"]/gm)) imports.push(m[1]);
  for (const m of code.matchAll(/^\s*import\s*['"]([^'"]+)['"]/gm)) imports.push(m[1]);
  for (const m of code.matchAll(/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g)) imports.push(m[1]);
  for (const m of code.matchAll(/new\s+Worker\(\s*new\s+URL\(\s*['"]([^'"]+)['"]/g)) workers.push(m[1]);
  return { imports, workers };
}
// a specifier as a path from the game's folder ('three' is mapped like index.html's import map)
function resolve(spec, from) {
  if (spec === 'three' || spec.startsWith('three/')) return 'vendor/three';
  if (!spec.startsWith('.')) return null;
  return new URL(spec, new URL(from, ROOT)).href.slice(ROOT.href.length);
}

let result = null;
export function crawl() {
  return result ??= run();
}

async function run() {
  const files = new Map(), roots = [[ENTRY, 'main']];
  const load = async (path, thread) => {
    let f = files.get(path);
    if (f) { if (f.threads.has(thread)) return; f.threads.add(thread); await f.ready; return Promise.all(f.imports.filter(p => partOf(p) !== 'vendor').map(p => load(p, thread))); }
    f = { path, part: partOf(path), threads: new Set([thread]), imports: [], text: '', lines: 0 };
    files.set(path, f);
    f.ready = fetch(new URL(path, ROOT)).then(r => {
      if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
      return r.text();
    });
    f.text = await f.ready;
    f.lines = f.text.split('\n').length;
    const { imports, workers } = scan(f.text);
    f.imports = imports.map(s => resolve(s, path)).filter(Boolean);
    for (const w of workers) roots.push([resolve(w, path), 'worker']);
    await Promise.all(f.imports.filter(p => partOf(p) !== 'vendor').map(p => load(p, thread)));
  };
  for (let i = 0; i < roots.length; i++) await load(...roots[i]);   // the worker shows up while crawling main

  const edges = new Map(), parts = new Map();
  const part = p => parts.get(p) ?? parts.set(p, { part: p, files: [], lines: 0, threads: new Set() }).get(p);
  for (const f of files.values()) {
    const P = part(f.part);
    P.files.push(f.path); P.lines += f.lines;
    for (const t of f.threads) P.threads.add(t);
    for (const to of f.imports) {
      const b = partOf(to);
      if (b === 'vendor') { const V = part('vendor'); for (const t of f.threads) V.threads.add(t); }
      if (b !== f.part) edges.set(`${f.part}>${b}`, (edges.get(`${f.part}>${b}`) ?? 0) + 1);
    }
  }
  for (const P of parts.values()) P.files.sort();
  return { files, edges, parts };
}

// the first comment line of a file (what it is for)
export const purpose = text => (text.match(/^\s*\/\/\s*(.+)/) ?? [])[1] ?? '';
