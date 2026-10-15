// The tutor's tools: what it can look at (slides, demos, the game's code, the design notes, the
// glossary) and the two things it can do (show the reader a slide, write a note). They all only
// read, or are harmless to repeat, so they are "replay: safe": if the page closes in the middle
// of one, the next page runs it again.
//
// A conversation belongs to one room. The reader may have walked on to another room when a tool
// runs (pi-durable finishes interrupted work on the next page), so tools ask `roomOf` which room
// the conversation is about and only touch the live page when the reader is still there.
import { Type, defineTool } from '../../vendor/pi-durable/pi-durable.js';
import { DECKS, local } from '../decks.js';
import { parseRefs, extract } from '../refs.js';
import { crawl, purpose } from '../crawl.js';
import * as page from './page.js';

const MAX_OUTPUT = 24000;
const text = (s, details) => ({ output: [{ type: 'text', text: s.length > MAX_OUTPUT ? s.slice(0, MAX_OUTPUT) + '\n[... cut here, ask for less]' : s }], ...(details ? { details } : {}) });
const numbered = (lines, from) => lines.map((l, i) => `${String(from + i + 1).padStart(4)}| ${l}`).join('\n');

// the folders of the game the tutor may read, and which files in them are text
const READABLE = /^(src|docs|music|blender|tools|tests|learn|vendor\/scrimshaw)\/|^(README\.md|index\.html|style\.css|TODO\.txt)$/;
const TEXT = /\.(js|mjs|py|md|html|css|json|txt|score)$/;
const cleanPath = p => String(p).trim().replace(/^\.?\//, '').replace(/^\/+/, '');

// a folder as the dev server lists it (tools/serve.py serves directory listings)
async function listFolder(path) {
  const html = await page.fetchText(path.endsWith('/') ? path : path + '/');
  return [...html.matchAll(/href="([^"?#]+)"/g)].map(m => decodeURIComponent(m[1])).filter(n => !n.startsWith('/') && !n.startsWith('.') && !n.includes('..'));
}
async function gameFiles() {
  const { files } = await crawl();
  return [...files.keys()].filter(p => !p.startsWith('vendor/')).sort();
}

export function createTools({ roomOf, addNote, lang = page.pageLang() }) {
  const live = room => room === page.here();
  const slideIn = async (room, id) => {
    const doc = await page.roomDoc(room), slides = page.slidesOf(doc);
    const s = id ? slides.find(x => x.id === String(id).replace(/^#/, '')) : null;
    return { doc, slides, s };
  };

  const readSlide = defineTool({
    name: 'read_slide',
    description: 'Read a slide of the guide as text, in the reader\'s language, with its code and (in the reader\'s room) the state of its demo. Without arguments: the slide the reader is looking at now. Use slide "all" for the whole room (long).',
    parameters: Type.Object({
      slide: Type.Optional(Type.String({ description: 'slide id, like "arc-code" (no #), or "all"' })),
      room: Type.Optional(Type.String({ description: 'room file, like "combat.html"; default: this conversation\'s room' })),
    }),
    replay: 'safe',
    execute: async (args, api, context) => {
      const room = args.room ? cleanPath(args.room).replace(/^learn\//, '') : await roomOf(api, context);
      if (!DECKS.some(d => d.file === room)) return text(`There is no room "${room}". Rooms: ${DECKS.map(d => d.file).join(', ')}`);
      const isLive = live(room);
      if (!args.slide && !isLive) return text(`The reader is not in ${room} right now; name a slide. Slides: ${page.outline(await page.roomDoc(room), lang).map(s => s.id).join(', ')}`);
      const { slides, s } = await slideIn(room, args.slide);
      if (args.slide === 'all') return text(slides.map(x => `=== #${x.id} (Lv ${x.dataset.lv}) ===\n${page.slideText(x, lang, { live: isLive })}`).join('\n\n'), { room, slide: 'all' });
      const slide = args.slide ? s : page.currentSlide();
      if (!slide) return text(`No slide "${args.slide}" in ${room}. Slides: ${slides.map(x => x.id).join(', ')}`);
      return text(`Slide ${slides.indexOf(slide) + 1}/${slides.length} of ${room}, #${slide.id} (Lv ${slide.dataset.lv}):\n\n${page.slideText(slide, lang, { live: isLive })}`, { room, slide: slide.id });
    },
  });

  const lookAtDemo = defineTool({
    name: 'look_at_demo',
    description: 'Take a picture of a demo in the reader\'s room as it is right now, with its controls. Without arguments: the demo on the slide the reader is looking at.',
    parameters: Type.Object({ slide: Type.Optional(Type.String({ description: 'slide id (no #)' })) }),
    replay: 'safe',
    execute: async (args, api, context) => {
      const room = await roomOf(api, context);
      if (!live(room)) return text(`The reader has left ${room}, so its demos are not on screen.`);
      const { s } = await slideIn(room, args.slide);
      const slide = args.slide ? s : page.currentSlide();
      const demo = slide?.querySelector('[data-demo]');
      if (!demo) return text(`There is no demo on ${slide ? '#' + slide.id : 'that slide'}.`);
      if (!demo.dataset.mounted) return text(`The demo "${demo.dataset.demo}" has not been opened yet: it starts when the reader looks at its slide. Use show_slide first.`);
      const state = page.demoState(demo), out = [{ type: 'text', text: `Demo "${demo.dataset.demo}" on #${slide.id}${state ? `. Controls and text: ${state}` : ''}` }];
      const shot = snapshot(demo);
      out.push(shot ? { type: 'image', data: shot, mimeType: 'image/jpeg' } : { type: 'text', text: '(This demo draws in 3D, which cannot be photographed; describe it from the slide and its controls.)' });
      return { output: out, details: { room, slide: slide.id, demo: demo.dataset.demo } };
    },
  });

  const readCode = defineTool({
    name: 'read_code',
    description: 'Read the game\'s code or design notes. "src/core/combat.js#inSwordArc" reads one definition (function, class, const, method; "a,b" for several), "src/core/combat.js" the whole file with line numbers, "src/core/" lists a folder with what each file is for. "docs/" has the grown-ups\' design notes (Markdown).',
    parameters: Type.Object({
      ref: Type.String({ description: 'path, path#name or folder/' }),
      lines: Type.Optional(Type.String({ description: 'for a whole file: a line range like "40-90"' })),
    }),
    replay: 'safe',
    execute: async args => {
      const ref = cleanPath(args.ref);
      const [path] = ref.split('#');
      if (!READABLE.test(path)) return text(`Only the game's own files can be read: src/, docs/, music/, blender/, tools/, tests/, learn/ and README.md.`);
      if (path.endsWith('/')) {
        const names = await listFolder(path).catch(() => null);
        if (!names) return text(`There is no folder ${path}.`);
        const rows = await Promise.all(names.map(async n => n.endsWith('/') || !/\.(js|mjs|py)$/.test(n) ? n : `${n}: ${purpose(await page.fetchText(path + n).catch(() => '')) || ''}`));
        return text(`${path}\n${rows.map(r => '  ' + r).join('\n')}`);
      }
      if (!TEXT.test(path)) return text(`${path} is not a text file.`);
      let source;
      try { source = await page.fetchText(path); } catch { return text(`There is no file ${path}.`); }
      const refs = parseRefs(ref);
      if (refs.some(r => r.name)) {
        const parts = refs.map(r => {
          const e = extract(source, path, r.name);
          return e.error ? `(${e.error})` : `${path} lines ${e.start + 1}-${e.end + 1}:\n${numbered(e.text.split('\n'), e.start)}`;
        });
        return text(parts.join('\n\n'), { ref });
      }
      const lines = source.split('\n');
      const [a, b] = (args.lines ?? '').split('-').map(n => parseInt(n, 10));
      const from = Number.isFinite(a) ? Math.max(1, a) - 1 : 0, to = Number.isFinite(b) ? b : Math.min(lines.length, from + 400);
      const more = to < lines.length ? `\n[${lines.length} lines in all; ask for lines "${to + 1}-${Math.min(lines.length, to + 400)}" for more]` : '';
      return text(`${path} (${lines.length} lines):\n${numbered(lines.slice(from, to), from)}${more}`, { ref: path });
    },
  });

  const searchCode = defineTool({
    name: 'search_code',
    description: 'Search the game\'s code (every file the game loads) and the design notes in docs/ for a word or regular expression. Returns file:line matches.',
    parameters: Type.Object({
      query: Type.String({ description: 'text to find (case-insensitive), or a JavaScript regular expression with regex: true' }),
      regex: Type.Optional(Type.Boolean()),
      folder: Type.Optional(Type.String({ description: 'only files under this folder, like "src/core/" or "blender/"' })),
    }),
    replay: 'safe',
    execute: async args => {
      let re;
      try { re = args.regex ? new RegExp(args.query, 'i') : new RegExp(args.query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'); }
      catch (e) { return text(`Not a regular expression: ${e.message}`); }
      const folder = args.folder ? cleanPath(args.folder).replace(/\/?$/, '/') : null;
      let paths = [...await gameFiles(), ...(await listFolder('docs/').catch(() => [])).filter(n => n.endsWith('.md')).map(n => 'docs/' + n)];
      if (folder) {
        paths = paths.filter(p => p.startsWith(folder));
        if (!paths.length && READABLE.test(folder)) paths = (await listFolder(folder).catch(() => [])).filter(n => TEXT.test(n)).map(n => folder + n);
      }
      const hits = [];
      for (const p of paths) {
        const lines = (await page.fetchText(p).catch(() => '')).split('\n');
        lines.forEach((l, i) => { if (re.test(l)) hits.push(`${p}:${i + 1}: ${l.trim().slice(0, 160)}`); });
        if (hits.length > 80) break;
      }
      return text(hits.length ? hits.slice(0, 80).join('\n') + (hits.length > 80 ? '\n[more matches; search for something narrower]' : '') : `No matches for ${args.query} in ${paths.length} files.`);
    },
  });

  const searchGuide = defineTool({
    name: 'search_guide',
    description: 'Search all rooms of the guide (in the reader\'s language) for a word, to find which room and slide explain something.',
    parameters: Type.Object({ query: Type.String() }),
    replay: 'safe',
    execute: async args => {
      const q = args.query.toLowerCase(), hits = [];
      for (const d of DECKS) {
        const doc = await page.roomDoc(d.file).catch(() => null);
        if (!doc) continue;
        for (const s of page.slidesOf(doc)) {
          const t = page.slideText(s, lang), at = t.toLowerCase().indexOf(q);
          if (at >= 0) hits.push(`${d.file}#${s.id} (${local(d, lang).title}): ...${t.slice(Math.max(0, at - 80), at + 120).replace(/\s+/g, ' ')}...`);
        }
      }
      return text(hits.length ? hits.slice(0, 20).join('\n') : `"${args.query}" is not in any room.`);
    },
  });

  const lookUpWord = defineTool({
    name: 'look_up_word',
    description: 'Look up a word in the guide\'s glossary (the Word Book), as the reader sees it.',
    parameters: Type.Object({ word: Type.String() }),
    replay: 'safe',
    execute: async args => {
      const q = args.word.toLowerCase().trim(), words = await page.glossary(lang);
      const found = words.filter(w => w.id === q || w.names.some(n => n.toLowerCase().includes(q)));
      if (!found.length) return text(`"${args.word}" is not in the glossary. Words: ${words.map(w => w.id).join(', ')}`);
      return text(found.slice(0, 5).map(w => `${w.title} (words.html#${w.id}): ${w.text}`).join('\n'));
    },
  });

  const showSlide = defineTool({
    name: 'show_slide',
    description: 'Turn the reader\'s page to a slide of their room, for example to point at a demo or a picture.',
    parameters: Type.Object({ slide: Type.String({ description: 'slide id (no #)' }) }),
    replay: 'safe',
    execute: async (args, api, context) => {
      const room = await roomOf(api, context);
      if (!live(room)) return text(`The reader has left ${room}; link to the slide instead: [title](${room}#${args.slide}).`);
      const { slides, s } = await slideIn(room, args.slide);
      if (!s) return text(`No slide "${args.slide}" here. Slides: ${slides.map(x => x.id).join(', ')}`);
      if (location.hash.slice(1) !== s.id) location.hash = s.id;
      return text(`The reader now sees slide ${slides.indexOf(s) + 1}: #${s.id}.`, { room, slide: s.id });
    },
  });

  const note = defineTool({
    name: 'note',
    description: 'Write a short note in your notebook about the reader, kept across all rooms: something they understood, found hard, or mixed up. One sentence.',
    parameters: Type.Object({ text: Type.String() }),
    replay: 'safe',
    execute: async (args, api, context) => {
      await addNote(api, await roomOf(api, context), args.text.slice(0, 300), context);
      return text('Noted.');
    },
  });

  return [readSlide, lookAtDemo, readCode, searchCode, searchGuide, lookUpWord, showSlide, note];
}

// a picture of the biggest canvas of a demo as a JPEG (base64), or null when it is blank (3D)
function snapshot(demo) {
  const c = [...demo.querySelectorAll('canvas')].sort((a, b) => b.width * b.height - a.width * a.height)[0];
  if (!c || !c.width) return null;
  const scale = Math.min(1, 900 / c.width), out = document.createElement('canvas');
  out.width = Math.round(c.width * scale); out.height = Math.round(c.height * scale);
  const g = out.getContext('2d');
  g.fillStyle = '#0b0d12'; g.fillRect(0, 0, out.width, out.height);
  try { g.drawImage(c, 0, 0, out.width, out.height); } catch { return null; }
  const px = g.getImageData(0, 0, out.width, out.height).data;
  let lit = 0;
  for (let i = 0; i < px.length; i += 4 * 97) if (px[i] + px[i + 1] + px[i + 2] > 60) lit++;
  if (!lit) return null;
  return out.toDataURL('image/jpeg', 0.82).split(',')[1];
}
