# The kids' guide

An interactive guide to how Cube Crawler works, written for children around 12. It goes from the
big ideas down to the real code, and teaches how to change the game by prompting a coding agent.
The grown-up design notes are in `docs/`; this is the friendly version of the same knowledge.

Run the game's server and open the map:

```sh
npm run serve        # then http://localhost:8000/kids-docs/
```

The demos import the game's modules, so they need the server (not `file://`).

## How it is built

Plain HTML, CSS and ES modules, no build step, like the game.

| File | What |
|---|---|
| `index.html` | the map: the rooms, the detail level picker |
| `decks.js` | the list of rooms in order, each with the game depth (theme) it borrows its look from |
| `deck.js` | the engine every page loads: slides, quick bar, levels, scroll mode, glossary tips, quest cards, demo loading |
| `kids.css` | the look, taken from the game's `style.css` (panels, keys, quick bar, rarity colours) |
| `<room>.html` | one room: `<main class="deck">` with `<section class="slide">` slides |
| `words.html` | the glossary; `<a class="w" href="words.html#seed">` anywhere shows its entry on hover |
| `demos/*.js` | interactive demos, loaded when they scroll into view |
| `img/` | screenshots of the game |

## Writing slides

- Every slide has a detail level: `data-lv="1"` the big idea, `2` how it works, `3` the real code.
  Within a room, go from 1 to 3. The last slide of a room is level 1 (the prompt quests), since
  `deck.js` puts the portal to the next room there.
- Link down with `<a class="deeper" data-lv="3" href="#slide-id">`, across rooms with
  `<a class="portal" href="room.html#slide-id">`, and words with `<a class="w" href="words.html#id">`.
- Code excerpts: `<pre data-file="src/path.js (shortened)"><code>...</code></pre>`. Escape `<` and `&`.
  Shorten, but never change what the code does.
- Prompt quests: `<div class="prompt" data-title="NAME" data-stars="1..3"><q>the prompt</q><span class="why">why it is a good prompt</span></div>`.
- Short sentences, the reader's own words, one idea per paragraph. Explain a term the first
  time, or link it to the glossary. Facts and numbers must match the code.

## Writing demos

A demo is a module with a default export `mount(el)`; a slide asks for it with
`<div class="demo" data-demo="name">`. Add `class="real"` when the demo runs the game's own code
(it is labelled "REAL GAME CODE"). `deck.js` exports `canvas(el, w, h)`, `loop(el, fn)` (runs
only while visible) and `html(el, s)`. A demo that takes keys sets `el.dataset.keys`, so the
arrow keys do not turn the slide.

Prefer importing the game's pure modules (`src/core/`, `src/world/`, `src/cubegen/`,
`src/themes/`) over copying them. When a demo has to copy game logic (it needs the game state,
or it is 2D), say where it comes from in its first comment.

## Keeping it true

`tests/kids-docs.test.js` checks that rooms, links, anchors, images, demo modules and quoted
files exist, and that every name a demo imports from the game is still exported. It cannot
check the words: when you change how something in the game works, search this folder for it.
