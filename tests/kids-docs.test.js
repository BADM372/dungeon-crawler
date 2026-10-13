// The kids' guide (kids-docs/) links to game files, runs game modules in its demos and points
// at slides by id. These checks fail when the game changes under it: a renamed export, a moved
// file, a slide id that went away.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { DECKS } from '../kids-docs/decks.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const KIDS = join(ROOT, 'kids-docs');
const pages = readdirSync(KIDS).filter(f => f.endsWith('.html'));
const read = f => readFileSync(join(KIDS, f), 'utf8');
const ids = f => new Set([...read(f).matchAll(/\bid="([^"]+)"/g)].map(m => m[1]));

test('every room in decks.js exists and every room page is in decks.js', () => {
  for (const d of DECKS) {
    assert.ok(pages.includes(d.file), `${d.file} is listed but missing`);
    assert.ok(existsSync(resolve(KIDS, d.icon)), `${d.file}: icon ${d.icon}`);
  }
  for (const p of pages.filter(p => read(p).includes('<main class="deck">')))
    assert.ok(DECKS.some(d => d.file === p), `${p} is a room but not in decks.js`);
});

test('links, images and anchors in the guide resolve', () => {
  for (const page of pages) {
    const html = read(page);
    for (const [, url] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
      if (/^(https?:|mailto:|data:)/.test(url) || url.includes('${')) continue;   // external, or built by a script
      const [path, hash] = url.split('#'), file = path.split('?')[0] || page;
      const abs = resolve(KIDS, file);
      assert.ok(existsSync(abs), `${page}: ${url} does not exist`);
      if (hash && file.endsWith('.html') && abs.startsWith(KIDS)) assert.ok(ids(file).has(hash), `${page}: ${url} has no #${hash}`);
    }
  }
});

test('every demo has its module and every quoted file exists', () => {
  for (const page of pages) {
    const html = read(page);
    for (const [, name] of html.matchAll(/data-demo="([^"]+)"/g))
      assert.ok(existsSync(join(KIDS, 'demos', name + '.js')), `${page}: demo ${name}`);
    // <pre data-file="src/x.js (shortened)"> and "a.py and b.py" name game files
    for (const [, label] of html.matchAll(/data-file="([^"]+)"/g))
      for (const [file] of label.matchAll(/[\w./-]+\.(?:js|py|scrim|md)\b/g))
        assert.ok(existsSync(join(ROOT, file)), `${page}: data-file ${file}`);
  }
});

test('the game modules the demos import still export what they use', async () => {
  for (const demo of readdirSync(join(KIDS, 'demos'))) {
    const src = readFileSync(join(KIDS, 'demos', demo), 'utf8');
    for (const [, names, from] of src.matchAll(/import\s*\{([^}]+)\}\s*from\s*'(\.\.\/\.\.\/[^']+)'/g)) {
      const file = resolve(KIDS, 'demos', from);
      assert.ok(existsSync(file), `${demo}: ${from} does not exist`);
      // the audio player needs a browser; check its exports by reading the source
      const text = readFileSync(file, 'utf8');
      const mod = /\bwindow\b|\blocalStorage\b|addEventListener/.test(text) ? null : await import(pathToFileURL(file));
      for (const name of names.split(',').map(n => n.trim().split(/\s+as\s+/)[0]).filter(Boolean)) {
        const ok = mod ? name in mod : new RegExp(`export\\s+(?:const|let|function|class|async function)\\s+${name}\\b`).test(text);
        assert.ok(ok, `${demo}: ${from} does not export ${name}`);
      }
    }
  }
});
