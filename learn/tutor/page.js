// The guide's rooms as the tutor reads them: a room's slides, one slide as text in the reader's
// language, where the reader is right now, and the glossary. The room the reader is in is read
// from the live page (with its demos as they are now); other rooms are fetched and parsed.
import { DECKS, local } from '../decks.js';
import { parseRefs, extract } from '../refs.js';

const LEARN = new URL('../', import.meta.url);
const ROOT = new URL('../../', import.meta.url);

export const here = () => location.pathname.split('/').pop() || 'index.html';
export const pageLang = () => document.documentElement.dataset.lang === 'de' ? 'de' : 'en';
export const pickedLevel = () => { try { return +(localStorage.getItem('kids.lv') ?? 3); } catch { return 3; } };
export const roomInfo = (file, lang) => {
  const i = DECKS.findIndex(d => d.file === file);
  return i < 0 ? null : { ...local(DECKS[i], lang), index: i + 1, count: DECKS.length };
};

const texts = new Map();
export function fetchText(path, base = ROOT) {
  const url = new URL(path, base).href;
  if (!texts.has(url)) texts.set(url, fetch(url).then(r => {
    if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
    return r.text();
  }).catch(e => { texts.delete(url); throw e; }));
  return texts.get(url);
}

// ---- rooms --------------------------------------------------------------------------------------
const parsed = new Map();
// the document of a room: this page itself, or the room's page fetched (live code filled in)
export function roomDoc(file) {
  if (file === here()) return Promise.resolve(document);
  if (!parsed.has(file)) parsed.set(file, (async () => {
    const doc = new DOMParser().parseFromString(await fetchText(file, LEARN), 'text/html');
    for (const pre of doc.querySelectorAll('pre[data-code]')) {
      try {
        const parts = await Promise.all(parseRefs(pre.dataset.code).map(async r => extract(await fetchText(r.path), r.path, r.name).text ?? ''));
        pre.textContent = parts.join('\n\n');
      } catch { pre.textContent = `(code from ${pre.dataset.code})`; }
    }
    return doc;
  })().catch(e => { parsed.delete(file); throw e; }));
  return parsed.get(file);
}
export function slidesOf(doc) {
  const slides = [...doc.querySelectorAll('main.deck section.slide')];
  slides.forEach((s, i) => { s.id ||= 'slide-' + (i + 1); });   // as deck.js names them
  return slides;
}
const titleOf = (s, lang) => (s.querySelector(`h2[lang=${lang}]`) ?? s.querySelector('h2'))?.textContent.trim() ?? s.id;
export const outline = (doc, lang) => slidesOf(doc).map((s, i) => ({ n: i + 1, id: s.id, lv: +(s.dataset.lv || 1), title: titleOf(s, lang), demo: s.querySelector('[data-demo]')?.dataset.demo }));

// the slide the reader looks at on this page: the current one, or in the long page the one in view
export function currentSlide() {
  const slides = slidesOf(document);
  if (!slides.length) return null;
  const cur = slides.find(s => s.classList.contains('current'));
  if (cur && !document.body.classList.contains('scroll')) return cur;
  const seen = slides.filter(s => s.offsetParent !== null).map(s => [s, s.getBoundingClientRect()]);
  return (seen.find(([, r]) => r.bottom > innerHeight * 0.35) ?? seen.at(-1) ?? [slides[0]])[0];
}
export function whereText(lang) {
  const file = here(), info = roomInfo(file, lang), s = currentSlide();
  const all = slidesOf(document), n = s ? all.indexOf(s) + 1 : 0;
  return [`Room ${info ? `${info.index}/${info.count} "${info.title}"` : ''} (${file})`,
    s ? `slide ${n}/${all.length} #${s.id} "${titleOf(s, lang)}" (Lv ${s.dataset.lv})` : 'the map',
    `detail picker: Lv ${pickedLevel()}`, `page language: ${lang === 'de' ? 'German' : 'English'}`].join(', ');
}

// ---- a slide as text -------------------------------------------------------------------------------
const SKIP = new Set(['SCRIPT', 'STYLE', 'CANVAS', 'SVG', 'svg', 'TEMPLATE', 'NAV']);
const BLOCK = new Set(['P', 'DIV', 'SECTION', 'UL', 'OL', 'LI', 'H1', 'H2', 'H3', 'H4', 'PRE', 'FIGURE', 'FIGCAPTION', 'TABLE', 'TR', 'BLOCKQUOTE', 'DL', 'DT', 'DD', 'Q']);
const squash = s => s.replace(/[ \t\n]+/g, ' ');

// the demo's controls and readouts as they are right now (only on the live page)
export function demoState(el) {
  const parts = [];
  const own = n => { const c = n.cloneNode(true); c.querySelectorAll('input, select, button').forEach(x => x.remove()); return squash(c.textContent).trim(); };
  for (const c of el.querySelectorAll('input, select')) {
    const name = (c.closest('label') && own(c.closest('label'))) || c.getAttribute('aria-label') || c.name || c.type;
    const value = c.type === 'checkbox' || c.type === 'radio' ? (c.checked ? 'on' : 'off') : c.tagName === 'SELECT' ? c.selectedOptions[0]?.textContent : c.value;
    parts.push(`${name.slice(0, 60)} = ${value}`);
  }
  const on = [...el.querySelectorAll('button.on')].map(b => b.textContent.trim()).filter(Boolean);
  if (on.length) parts.push(`selected: ${on.join(', ')}`);
  const shown = own(el);
  if (shown) parts.push(`text shown: ${shown.slice(0, 600)}`);
  return parts.join('; ');
}

export function slideText(section, lang, { live = false } = {}) {
  const words = new Set();
  const inline = node => {
    let out = '';
    for (const n of node.childNodes) {
      if (n.nodeType === 3) { out += n.textContent; continue; }
      if (n.nodeType !== 1 || SKIP.has(n.tagName)) continue;
      if (n.lang && n.lang !== lang) continue;
      if (n.classList.contains('tag') || n.classList.contains('file')) continue;
      if (BLOCK.has(n.tagName)) { out += '\n' + block(n) + '\n'; continue; }
      const inner = inline(n);
      if (n.tagName === 'B' || n.tagName === 'STRONG') out += `**${inner.trim()}**`;
      else if (n.tagName === 'CODE' || n.tagName === 'KBD') out += '`' + inner + '`';
      else if (n.tagName === 'IMG') out += n.alt ? `[picture: ${n.getAttribute(lang === 'de' && n.dataset.deAlt ? 'data-de-alt' : 'alt')}]` : '';
      else if (n.tagName === 'A' && n.classList.contains('w')) { words.add(n.hash.slice(1)); out += inner; }
      else if (n.tagName === 'A' && n.getAttribute('href')) out += `[${inner.trim()}](${n.getAttribute('href')})`;
      else out += inner;
    }
    return out;
  };
  const block = n => {
    if (n.lang && n.lang !== lang) return '';
    if (SKIP.has(n.tagName) || n.classList.contains('tag') || n.classList.contains('roomend')) return '';
    if (n.dataset?.demo) {
      const state = live && n.dataset.mounted ? demoState(n) : '';
      return `[interactive demo "${n.dataset.demo}"${n.classList.contains('real') ? ', runs the real game code' : ''}${live && !n.dataset.mounted ? ', not opened yet' : ''}${state ? `; now: ${state}` : ''}]`;
    }
    if (n.tagName === 'PRE') {
      const label = n.dataset.code ?? n.dataset.src ?? n.dataset.label ?? n.dataset.file ?? '';
      const code = [...n.childNodes].filter(c => !(c.classList?.contains('file'))).map(c => c.textContent).join('').replace(/^\n/, '').trimEnd();
      return (label ? `code (${label}${n.dataset.code ? ', live from the game' : ''}):\n` : '') + '```\n' + code + '\n```';
    }
    if (n.tagName === 'TABLE') return [...n.querySelectorAll('tr')].map(tr => '| ' + [...tr.children].filter(c => !c.lang || c.lang === lang).map(c => squash(inline(c)).trim()).join(' | ') + ' |').join('\n');
    if (/^H\d$/.test(n.tagName)) return '#'.repeat(+n.tagName[1]) + ' ' + squash(inline(n)).trim();
    if (n.tagName === 'UL' || n.tagName === 'OL') return [...n.children].filter(li => !li.lang || li.lang === lang)
      .map((li, i) => (n.tagName === 'OL' ? `${i + 1}. ` : '- ') + squash(inline(li)).trim()).join('\n');
    const hasBlocks = [...n.children].some(c => BLOCK.has(c.tagName) || c.dataset?.demo);
    if (!hasBlocks) {
      const t = squash(inline(n)).trim();
      return n.classList?.contains('note') && t ? `> ${t}` : t;
    }
    return [...n.childNodes].map(c => c.nodeType === 1 ? block(c) : squash(c.textContent).trim()).filter(Boolean).join('\n\n');
  };
  let text = block(section).replace(/\n{3,}/g, '\n\n').trim();
  if (section.dataset.src) text += `\n\n(This slide explains: ${section.dataset.src})`;
  if (words.size) text += `\n(Glossary words on this slide: ${[...words].join(', ')})`;
  return text;
}

// ---- the glossary --------------------------------------------------------------------------------
export async function glossary(lang) {
  const doc = await roomDoc('words.html');
  return [...doc.querySelectorAll('[id]')].filter(el => el.querySelector('dt')).map(el => ({
    id: el.id,
    names: [...el.querySelectorAll('dt')].map(d => d.textContent.trim()),
    text: squash((el.querySelector(`dd[lang=${lang}]`) ?? el.querySelector('dd'))?.textContent ?? '').trim(),
    title: (el.querySelector(`dt[lang=${lang}]`) ?? el.querySelector('dt'))?.textContent.trim(),
  }));
}
