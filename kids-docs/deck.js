// The kids' guide engine. Every page imports this. On a room page (<main class="deck">) it turns
// the <section class="slide"> elements into slides:
//   - arrow keys / the quick bar at the bottom move between slides, the URL hash names the slide
//   - each slide has a detail level (data-lv 1..3); the level picker hides deeper slides
//   - S switches between slides and one long scrolling report
//   - [data-demo="name"] loads demos/name.js when it comes into view and calls its default export
//   - <a class="w" href="words.html#seed"> shows the glossary entry when hovered
//   - <div class="prompt"> becomes a quest card with a copy button
//   - <pre data-file="..."> gets light syntax colours and a file label
import { DECKS, LEVELS, THEME_NAMES } from './decks.js';

const store = {
  get: (k, d) => { try { return localStorage.getItem('kids.' + k) ?? d; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem('kids.' + k, v); } catch { /* private mode */ } },
};
const here = location.pathname.split('/').pop() || 'index.html';
export const level = () => +store.get('lv', 3);
export const visited = () => new Set(JSON.parse(store.get('visited', '[]')));

// ---- the night sky behind everything (like the game's backdrop and glass cube) ---------------
function stars() {
  const c = document.createElement('canvas');
  c.id = 'stars';
  document.body.prepend(c);
  const draw = () => {
    const w = c.width = innerWidth * devicePixelRatio, h = c.height = innerHeight * devicePixelRatio, g = c.getContext('2d');
    let s = 1234567;
    const r = () => ((s = Math.imul(s ^ s >>> 15, 0x2c1b3c6d) + 0x6d2b79f5 | 0) >>> 0) / 4294967296;
    for (let i = 0; i < 260; i++) {
      g.fillStyle = `rgba(255,255,255,${0.15 + r() * 0.6})`;
      const z = (r() < 0.9 ? 1 : 2) * devicePixelRatio;
      g.fillRect(r() * w, r() * h, z, z);
    }
    // a faint glass cube, as the game draws around every cube
    const cx = w / 2, cy = h * 0.52, a = Math.min(w, h) * 0.42, b = a * 0.5, hh = a * 0.95;
    const top = [[cx, cy - b - hh / 2], [cx + a, cy - hh / 2], [cx, cy + b - hh / 2], [cx - a, cy - hh / 2]];
    const bot = top.map(([x, y]) => [x, y + hh]);
    g.strokeStyle = 'rgba(200,215,235,0.07)'; g.lineWidth = devicePixelRatio;
    g.beginPath();
    for (const ring of [top, bot]) { g.moveTo(...ring[3]); for (const p of ring) g.lineTo(...p); }
    for (let i = 0; i < 4; i++) { g.moveTo(...top[i]); g.lineTo(...bot[i]); }
    g.stroke();
  };
  draw();
  addEventListener('resize', draw);
}

// ---- small helpers ---------------------------------------------------------------------
const esc = s => s.replace(/[&<>]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch]));
// a tiny highlighter: comments, strings, keywords and numbers (good enough for short excerpts)
function highlight(pre) {
  const code = pre.querySelector('code') || pre;
  const src = code.textContent.replace(/^\n/, '').replace(/\s+$/, '');
  const re = /(\/\/[^\n]*|#[^\n{]*$)|('(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`[^`]*`)|\b(const|let|var|function|return|if|else|for|while|new|export|import|from|of|in|class|this|true|false|null|continue|break|def|await|async)\b|(\b\d+(?:\.\d+)?\b)/gm;
  let out = '', last = 0;
  for (const m of src.matchAll(re)) {
    out += esc(src.slice(last, m.index));
    const cls = m[1] ? 'c' : m[2] ? 's' : m[3] ? 'k' : 'n';
    out += `<span class="${cls}">${esc(m[0])}</span>`;
    last = m.index + m[0].length;
  }
  out += esc(src.slice(last));
  code.innerHTML = (pre.dataset.file ? `<span class="file">${esc(pre.dataset.file)}</span>` : '') + out;
}

function prompts(root) {
  for (const p of root.querySelectorAll('.prompt')) {
    const n = +(p.dataset.stars || 1);
    p.insertAdjacentHTML('afterbegin', `<span class="stars" title="Quest difficulty">${'\u2605'.repeat(n)}${'\u2606'.repeat(3 - n)}</span>`);
    const btn = document.createElement('button');
    btn.className = 'copy'; btn.textContent = 'copy';
    btn.onclick = async () => {
      try { await navigator.clipboard.writeText(p.querySelector('q').textContent.trim()); btn.textContent = 'copied!'; }
      catch { btn.textContent = 'select & copy'; }
      setTimeout(() => { btn.textContent = 'copy'; }, 1500);
    };
    p.append(btn);
  }
}

// ---- glossary tooltips -----------------------------------------------------------------------
let words = null;
async function loadWords() {
  if (!words) words = fetch('words.html').then(r => r.text()).then(t => new DOMParser().parseFromString(t, 'text/html')).catch(() => null);
  return words;
}
function wordTips() {
  const tip = document.createElement('div');
  tip.id = 'wordtip'; tip.hidden = true;
  document.body.append(tip);
  let active = null;
  const place = e => {
    const x = Math.min(e.clientX + 14, innerWidth - 360), y = e.clientY + 18;
    tip.style.left = x + 'px'; tip.style.top = (y + tip.offsetHeight > innerHeight ? e.clientY - tip.offsetHeight - 10 : y) + 'px';
  };
  document.addEventListener('mouseover', async e => {
    const a = e.target.closest?.('a.w');
    if (!a || a === active) return;
    active = a;
    const doc = await loadWords(), id = a.hash.slice(1), el = doc?.getElementById(id);
    if (active !== a || !el) return;
    tip.innerHTML = `<b>${esc(el.querySelector('dt').textContent)}</b>${esc(el.querySelector('dd').firstChild.textContent.trim())}`;
    tip.hidden = false; place(e);
  });
  document.addEventListener('mousemove', e => { if (active && !tip.hidden) place(e); });
  document.addEventListener('mouseout', e => {
    if (active && !active.contains(e.relatedTarget)) { active = null; tip.hidden = true; }
  });
}

// ---- demos: loaded when they come into view ----------------------------------------------------
function demos(root) {
  const io = new IntersectionObserver(entries => {
    for (const { target, isIntersecting } of entries) {
      if (!isIntersecting || target.dataset.mounted) continue;
      target.dataset.mounted = '1';
      io.unobserve(target);
      const box = document.createElement('div');
      box.className = 'loading'; box.textContent = 'loading\u2026';
      target.append(box);
      import(`./demos/${target.dataset.demo}.js`)
        .then(m => { box.remove(); return m.default(target); })
        .catch(err => {
          console.error(err);
          target.append(box);
          box.className = 'err';
          box.textContent = location.protocol === 'file:'
            ? 'This demo needs the game\'s web server: run "npm run serve" and open http://localhost:8000/kids-docs/'
            : 'This demo did not load: ' + err.message;
        });
    }
  }, { rootMargin: '200px' });
  for (const el of root.querySelectorAll('[data-demo]')) io.observe(el);
}
// a demo's animation loop: runs while the demo is on screen
export function loop(el, fn) {
  let last = performance.now();
  const tick = now => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (el.offsetParent !== null) fn(dt, now / 1000);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
// a canvas with a fixed drawing size that scales with its box
export function canvas(el, w, h) {
  const c = document.createElement('canvas');
  c.width = w * 2; c.height = h * 2;
  c.style.aspectRatio = `${w} / ${h}`;
  el.append(c);
  const g = c.getContext('2d');
  g.scale(2, 2);
  // pointer position in drawing units
  const at = e => { const r = c.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * w, (e.clientY - r.top) / r.height * h]; };
  return { c, g, w, h, at };
}
// html helper for demo controls
export function html(el, s) { el.insertAdjacentHTML('beforeend', s); return el.lastElementChild; }

// ---- the room page ---------------------------------------------------------------------------------
function deck(main) {
  const slides = [...main.querySelectorAll('section.slide')];
  const deckIdx = DECKS.findIndex(d => d.file === here), info = DECKS[deckIdx];
  slides.forEach((s, i) => {
    s.id ||= 'slide-' + (i + 1);
    s.dataset.lv ||= '1';
    const L = LEVELS[s.dataset.lv];
    s.insertAdjacentHTML('afterbegin', `<span class="tag" title="Detail level">${L.short} \u00B7 ${L.name}</span>`);
  });
  // the last slide gets the portal to the next room
  const next = DECKS[deckIdx + 1];
  if (slides.length) slides.at(-1).insertAdjacentHTML('beforeend', `<div class="links">${next
    ? `<a class="portal" href="${next.file}">Next room: ${next.title}</a>` : ''}<a class="portal" href="index.html">Back to the map</a></div>
    <p class="endnote">You reached the end of this room.</p>`);

  // top bar
  const bar = document.createElement('div');
  bar.className = 'bar';
  bar.innerHTML = `<a href="index.html" title="The map (M)">\u25C2 Map</a>
    <div class="where">${info ? `Room ${deckIdx + 1}/${DECKS.length} \u00B7 <b>${info.title}</b> \u00B7 <i>depth ${info.depth} \u00B7 ${THEME_NAMES[info.theme]}</i>` : ''}</div>
    <div class="tools"><span class="lvpick" title="How much detail do you want?">${[1, 2, 3].map(l =>
      `<button data-lv="${l}" style="--c:${LEVELS[l].color}" title="${LEVELS[l].name}">${LEVELS[l].short}</button>`).join('')}</span>
    <button class="mode" title="Slides or one long page (S)">scroll</button><button class="helpbtn" title="Keys (?)">?</button></div>`;
  document.body.prepend(bar);

  // quick bar
  const qbar = document.createElement('nav');
  qbar.className = 'qbar';
  qbar.innerHTML = `<button class="arrow prev" title="Previous (\u2190)">\u25C2</button><div class="slots">${slides.map((s, i) =>
    `<a class="slot lv${s.dataset.lv}" href="#${s.id}" title="${esc(s.querySelector('h2')?.textContent ?? '')}"><span>${i + 1}</span></a>`).join('')}</div>
    <button class="arrow next" title="Next (\u2192)">\u25B8</button>`;
  document.body.append(qbar);
  const slots = [...qbar.querySelectorAll('.slot')];

  let cur = 0;
  const allowed = i => +slides[i].dataset.lv <= level();
  function show(i, scroll = true) {
    cur = Math.max(0, Math.min(slides.length - 1, i));
    slides.forEach((s, j) => s.classList.toggle('current', j === cur));
    slots.forEach((s, j) => s.classList.toggle('current', j === cur));
    slots[cur].scrollIntoView({ block: 'nearest', inline: 'nearest' });
    if (location.hash.slice(1) !== slides[cur].id) history.replaceState(null, '', '#' + slides[cur].id);
    if (scroll && document.body.classList.contains('slides')) scrollTo(0, 0);
  }
  const step = d => { for (let i = cur + d; i >= 0 && i < slides.length; i += d) if (allowed(i)) return show(i); };
  function applyLevel() {
    const lv = level();
    bar.querySelectorAll('.lvpick button').forEach(b => b.classList.toggle('on', +b.dataset.lv === lv));
    slides.forEach((s, j) => { const deep = +s.dataset.lv > lv; s.classList.toggle('too-deep', deep); slots[j].classList.toggle('too-deep', deep); });
  }
  function setMode(m) {
    document.body.classList.toggle('scroll', m === 'scroll');
    document.body.classList.toggle('slides', m !== 'scroll');
    bar.querySelector('.mode').textContent = m === 'scroll' ? 'slides' : 'scroll';
    store.set('mode', m);
    if (m === 'scroll') slides[cur].scrollIntoView(); else show(cur);
  }
  bar.querySelectorAll('.lvpick button').forEach(b => b.onclick = () => { store.set('lv', b.dataset.lv); applyLevel(); });
  bar.querySelector('.mode').onclick = () => setMode(document.body.classList.contains('scroll') ? 'slides' : 'scroll');
  bar.querySelector('.helpbtn').onclick = () => help();
  qbar.querySelector('.prev').onclick = () => step(-1);
  qbar.querySelector('.next').onclick = () => step(1);
  const fromHash = () => {
    const i = slides.findIndex(s => s.id === decodeURIComponent(location.hash.slice(1)));
    if (i < 0) return false;
    if (document.body.classList.contains('scroll')) slides[i].scrollIntoView(); else show(i);
    return true;
  };
  addEventListener('hashchange', fromHash);
  addEventListener('keydown', e => {
    const t = e.target;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (t.closest?.('input, select, textarea, [contenteditable], [data-keys]')) return;
    if (e.key === '?') { help(); return; }
    if (e.key === 'Escape') { document.getElementById('help')?.remove(); return; }
    if (e.key === 's' || e.key === 'S') { bar.querySelector('.mode').click(); return; }
    if (e.key === 'm' || e.key === 'M') { location.href = 'index.html'; return; }
    if (document.body.classList.contains('scroll')) return;
    if (t.closest?.('button') && (e.key === ' ' || e.key === 'Enter')) return;
    const go = { ArrowRight: 1, PageDown: 1, ' ': e.shiftKey ? -1 : 1, ArrowLeft: -1, PageUp: -1 }[e.key];
    if (go) { e.preventDefault(); step(go); }
    if (e.key === 'Home') show(slides.findIndex((_, i) => allowed(i)));
    if (e.key === 'End') show(slides.findLastIndex((_, i) => allowed(i)));
  });

  applyLevel();
  if (!fromHash()) show(0, false);
  setMode(store.get('mode', 'slides'));
  // the browser jumps to the #slide anchor after loading; a slide starts at the top instead
  if (document.body.classList.contains('slides')) addEventListener('load', () => setTimeout(() => scrollTo(0, 0)));
  if (info) { const v = visited(); v.add(info.file); store.set('visited', JSON.stringify([...v])); }
}

function help() {
  if (document.getElementById('help')) { document.getElementById('help').remove(); return; }
  const h = document.createElement('div');
  h.id = 'help';
  h.innerHTML = `<section><h1>Keys</h1><dl>
    <dt><kbd>\u2192</kbd> <kbd>Space</kbd></dt><dd>next slide</dd><dt><kbd>\u2190</kbd></dt><dd>previous slide</dd>
    <dt><kbd>S</kbd></dt><dd>slides or one long page</dd><dt><kbd>M</kbd></dt><dd>back to the map</dd>
    <dt>Lv 1 / 2 / 3</dt><dd>how much detail: Lv 1 is the big idea, Lv 3 shows the real code</dd>
    <dt>dotted words</dt><dd>point at them to see what they mean</dd><dt><kbd>?</kbd> <kbd>Esc</kbd></dt><dd>close this</dd></dl></section>`;
  h.onclick = () => h.remove();
  document.body.append(h);
}

stars();
wordTips();
for (const pre of document.querySelectorAll('pre')) highlight(pre);
prompts(document);
const main = document.querySelector('main.deck');
if (main) deck(main);
demos(document);
