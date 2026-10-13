# The kids' guide

An interactive guide to how Cube Crawler works, written for children around 12, in English and
German. It goes from the big ideas down to the real code. The grown-up design notes are in
`docs/`; this is the friendly version of the same knowledge.

```sh
npm run serve        # then http://localhost:8000/kids-docs/
```

The guide reads the game's code and modules, so it needs the server (not `file://`).

## When you change the game

Slides say which code they explain, and `kids-docs/stamps.json` remembers what that code
looked like when the slides were last checked. Above every definition a slide explains, the
game's code carries a marker:

```js
// kids-docs: combat.html#arc-code #hit-test (see kids-docs/README.md)
export function inSwordArc(p, enemy) {
```

When you change such a definition, finish the game change first, then:

1. `npm run kids-docs` (or `npm test`) lists the slides that explain code that changed.
2. Read those slides in both languages and fix what no longer matches. Code shown with
   `data-code` and numbers shown with `data-val` update themselves; the words around them
   do not.
3. `npm run kids-docs -- --stamp` accepts the code as it is now. It also rewrites the markers and
   the written fallbacks of `data-val` numbers. If you reviewed only some of the slides, name
   them: `--stamp combat.html#arc-code`; slides that explain the same code are noted as outdated.

If the slides should wait, `npm run kids-docs -- --defer` (or `--defer page.html#slide ...`)
accepts the code but notes the slides as outdated in `stamps.json`, with the commit the change
was made on (`git diff <commit>` shows it); the guide then shows a "may be out of date" note on
them. A note stays until that slide is reviewed: `--stamp page.html#slide` clears it, a plain
`--stamp` for other code does not. Either way `npm test` passes again, so the guide never blocks
a game change, and nothing goes stale silently: `npm run kids-docs` lists the noted slides.

Small fixes to the words belong in the same change as the code. A bigger rewrite can wait:
defer it, and catch up on the noted slides later, on their own.

Never edit markers or `stamps.json` by hand; the tool owns them.

## How it is built

Plain HTML, CSS and ES modules, no build step, like the game.

| File | What |
|---|---|
| `index.html` | the map: the rooms, the detail level picker (`map.js`) |
| `decks.js` | the list of rooms in order, their titles in both languages, the game depth (theme) each borrows its look from |
| `lang.js` | picks the language before the page is drawn: the reader's choice, else the browser's |
| `deck.js` | the engine every page loads: slides, quick bar, levels, scroll mode, language switch, glossary tips, live code and values, demo loading |
| `refs.js` | finds a definition in a source file, and fingerprints it (used by `deck.js` and the tool) |
| `crawl.js` | reads the game's import graph from `src/main.js` and its worker, for demos that show the code's structure |
| `stamps.json` | fingerprints of the code the slides explain; slides noted as outdated |
| `kids.css` | the look, taken from the game's `style.css` |
| `<room>.html` | one room: `<main class="deck">` with `<section class="slide">` slides |
| `words.html` | the glossary; `<a class="w" href="words.html#seed">` anywhere shows its entry on hover |
| `demos/*.js` | interactive demos, loaded when they scroll into view |
| `img/` | screenshots of the game |
| `../tools/kids-docs.mjs` | the check / `--stamp` / `--defer` tool |

## Two languages in one file

Every piece of text is a pair, English first:

```html
<p lang="en">Every cube is a room of <b>16 by 16</b> squares.</p>
<p lang="de">Jeder Würfel ist ein Raum aus <b>16 mal 16</b> Feldern.</p>
```

Pair whole blocks (`p`, `li`, `h2`, `td`, `figcaption`, `q` ...), or `<span lang>` pairs inside a
shared element. Everything else (slides, demos, code, images) exists once. Attributes take a
`data-de-` twin: `alt="..." data-de-alt="..."`; the title is `<title data-de="...">`. Demos use
`tr('English', 'Deutsch')` from `deck.js`. The tests fail on a text without its partner.

Names that the game shows in English (Rare, Stunder, Blood viper) stay English in the German
text. Code and its comments stay as they are.

## What belongs in the guide

Teach ideas that would survive a rewrite of the game (the game loop, seeds, search, state
machines, how the parts fit together), and show this game's code as the example. Leave out
clever fixes for this game's own problems (a rendering workaround, a single tuning trick); the
grown-up notes in `docs/` are the place for those. The guide teaches; it does not teach
prompting. Specific numbers come live from the code (`data-val`, `data-code`), not from the text.

## Writing slides

- Every slide has a detail level: `data-lv="1"` the big idea, `2` how it works, `3` the real code.
  Within a room, go from 1 to 3. The last slide of a room is level 1 (a short summary or the
  room's big takeaway), since `deck.js` puts the room's end card there: the way on to the next
  room and back to the map. The quick bar also leads on: doors to the previous and the next
  room on either side of the slides; on the last slide the next arrow (and the right arrow key)
  goes into the next room, on the first slide the back arrow (and the left arrow key) into the
  previous room, at its last slide (`room.html#end`).
- Link down with `<a class="deeper" data-lv="3" href="#slide-id">`, across rooms with
  `<a class="portal" href="room.html#slide-id">`, and words with `<a class="w" href="words.html#id">`.
- Say what a slide explains: `data-src="src/core/enemies.js#SPIDER src/game/enemyai.js#decide,act"`
  on the `<section>`. A reference is `path#name`, `path#a,b` or a whole file `path`; a name is a
  function, class, const, method or Python def (`#header` is the comment a file starts with).
- Real code: `<pre data-code="src/core/combat.js#inSwordArc"></pre>` shows the definition, read
  from the game when the page opens, so it is never out of date. Prefer it over copying code.
  A shortened excerpt is `<pre data-src="path#name"><code>...</code></pre>` (escape `<` and `&`);
  other code is `<pre data-label="...">`. In a narrow column, `class="wrap"` wraps long lines.
- Numbers: `<b data-val="src/core/constants.js#RUN_SPEED">2.8</b>` shows the game's value,
  formatted for the language (`data-fmt="pct"`: 0.17 as 17%). The written text is the fallback;
  `--stamp` keeps it right. Use it for values the code exports.
- A journey: `<ol class="steps journey">` with `<li data-at="game" lang="en">` pairs next to a
  `<div class="demo real" data-demo="parts">`; the parts demo lights up the part (folder of `src/`)
  of each step.
- Short sentences, the reader's own words, one idea per paragraph. Explain a term the first
  time, or link it to the glossary.

## Writing demos

A demo is a module with a default export `mount(el)`; a slide asks for it with
`<div class="demo" data-demo="name">`. Add `class="real"` when the demo runs the game's own code
(it is labelled "REAL GAME CODE"). `deck.js` exports `canvas(el, w, h)`, `loop(el, fn)` (runs
only while visible), `html(el, s)`, `t` (as `tr` in demos) and `lang`. A demo that takes keys
sets `el.dataset.keys`, so the arrow keys do not turn the slide. Load files relative to the
module (`new URL('../img/x.jpg', import.meta.url)`), not the page.

Demos that show the code's structure (which files import which, who uses a field) read it live
with `crawl.js` instead of listing it, so they cannot go out of date.

Prefer importing the game's pure modules (`src/core/`, `src/world/`, `src/cubegen/`,
`src/themes/`) over copying them. When a demo has to copy game logic (it needs the game state,
or it is 2D), say where it comes from in its first comment.

## Tests

`tests/kids-docs.test.js` checks the rooms, that every text has both languages, links, anchors,
images and demo modules, that every name a demo imports from the game is still exported, and
`tools/kids-docs.mjs`'s check: references resolve, fingerprints, markers and written values
are current.
