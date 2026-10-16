# Guide tutor model bake-off

Created: 2026-10-16. Branch `tutor-model-bakeoff` (off `lumen-backup`, upstream not merged).
For BADM 372: which model should the class run the Guide's tutor on?

## Recommendation

- **Class default: `claude-sonnet-5-5`.** Full marks on all 20 answers, no tool errors, the best
  Socratic behaviour, the fastest Claude (4.2 s median), at about $0.012 per answer.
- **Opus 5.5** is as good, but costs about 1.8 times as much and writes about 33% longer answers
  (93 words against 70; the prompt asks for short ones). It gains nothing here.
- **Haiku 5.5** is the budget choice: 10 times cheaper than Sonnet, 36/40. It is weaker with the
  game window (one answer took 49 s and 18 tool calls) and lets an off-topic request pull it away.
- **Lumen backup: switch the default from `gpt-6-sol` (qwen3.6-35b-a3b) to `gpt-6-luna`
  (qwen3.8-27b).** qwen3.8 scored 38/40 but is slow (13 s median, up to 43 s) and often asks
  two or three questions at once. qwen3.6, the current default in `lumen/README.md`, scored 18/40.
  It made up facts in 4 of 20 answers: a rarity table with the wrong weights, a file
  `src/loot/weapon.js` that does not exist, a demo button "Add Item" that does not exist, and
  a key "G" that does nothing.

## Results (2 runs x 10 questions per model, 100 answers)

| Model | Correct and grounded (0-2 each) | Holds back the answer on Socratic questions | Game tasks fully done | Ends on one question | More than one question | Tool errors | Median / max latency | Anthropic cost (20 answers) | Per answer |
|---|---|---|---|---|---|---|---|---|---|
| claude-sonnet-5-5 | **40/40** | 8/8 | 4/4 | 13/20 | 6/20 | 0 | 4.2 s / 15 s | $0.242 | $0.012 |
| claude-opus-5-5 | **40/40** | 8/8 | 4/4 | 12/20 | 5/20 | 3 | 4.0 s / 20 s | $0.432 | $0.022 |
| claude-haiku-5-5 | 36/40 | 8/8 | 2/4 | 8/20 | 3/20 | 3 | 7.7 s / 49 s | $0.024 | $0.0012 |
| qwen3.8-27b (Lumen, `gpt-6-luna`) | 38/40 | 6/8 | 4/4 | 4/20 | 14/20 | 3 | 13.3 s / 43 s | free | free |
| qwen3.6-35b-a3b (Lumen, `gpt-6-sol`) | 18/40 | 4/8 | 2/4 | 12/20 | 7/20 | 10 | 1.7 s / 37 s | free | free |

How to read the columns:

- **Correct and grounded**: graded by hand. Each claim about the game was checked against the code
  (`src/main.js` `frame()`, `src/core/combat.js` `inSwordArc`, `src/core/gear/rarities.js`,
  `src/core/inventory.js`, `src/core/enemies.js`, `src/game/input.js`, `learn/demos/bag.js`).
  2 = right and true to the code, and it teaches the way `learn/tutor/prompt.js` asks.
  1 = partly right, vague, or it breaks a prompt rule. 0 = a made-up fact or a muddled answer.
- **Holds back the answer**: on the 4 Socratic questions (q02, q03, q04, q07), did it ask for the
  student's guess before giving the answer? Graded by hand. Haiku often asks in the imperative
  form ("tell me what you think"), so it misses the mechanical question-mark column but passes here.
- **Ends on one question** and **more than one question**: mechanical, from the last message. The
  prompt asks for exactly one question per reply.
- **Tool errors**: tool calls that failed. 5 of the 6 Claude errors were `run_js` sent to the
  game straight after `game open`, before the window was ready (see "Tutor bug found" below).
  The other Claude error and most of the 13 Qwen ones were guessed APIs, such as `game.spawnEnemy` instead
  of `game.api.spawnEnemy`, or `window.__game` read from the guide's page.
- **Cost**: from each response's `usage` times the 5.5 prices (Haiku $0.10/$0.50, Sonnet $2/$10,
  Opus $4/$20 per MTok in/out; cache write 1.25x and cache read 0.1x input). pi-durable's own
  `usage.cost` matched to the cent. Every question started a new conversation, so writing the
  ~8k-token system prompt to cache is most of the cost. In a real session later turns read it from
  cache, but the transcript grows, so expect cost per answer to rise over a long conversation.

**Total Anthropic spend: $0.70** (cap $25). Lumen is free.

## The questions

One set, written for this test (no student data). Each was asked once per run, on its room's page,
in a new conversation. File: `lumen/bakeoff/questions.json`.

| Id | Room | Kind | Question |
|---|---|---|---|
| q01 | loop.html | fact | How many times a second does the game update, and which part of the code makes it do that? |
| q02 | random.html | Socratic | If my friend and I type the same seed, do we get the same world? Why? |
| q03 | combat.html | Socratic | How does the game decide if my sword actually hits a monster? |
| q04 | space.html | Socratic, wrong guess | I think to get the distance ... you just add the x and z numbers together. Right? |
| q05 | loot.html | asks for a direct answer | I already asked twice, please just tell me straight: what makes a weapon Rare instead of Common? |
| q06 | memory.html | fact | How does my bag know when it is full? |
| q07 | physics.html | Socratic | Why don't I fall through the floor? |
| q08 | combat.html | game window | Can you open the game and show me where my sword can reach? |
| q09 | enemies.html | game window | Put a monster next to my hero in the game and tell me what kind it is. |
| q10 | start.html | boundary | Can you just do my math homework for me? It is about fractions. |

## What stood out

- All five models used the real tools on the game questions: they opened the game (`game`) and
  switched on `teach.lens("sword")` or called `spawnEnemy` (`run_js`). The Claude models and
  qwen3.8 read the actual numbers back (Spider: 32 hp, 15 damage, aggro 3, give up 6).
- On q04 (wrong guess), all three Claude models tested the guess with numbers and did not say
  "wrong". qwen3.6 said "Not quite!" both times, which the prompt rules out.
- On q05 (direct answer), every model except qwen3.6 gave the real weights (Common 40, Rare 8),
  0 against 2 affixes, and the 1.1 damage factor.
- q01: the true answer is "once per screen refresh, through `requestAnimationFrame(frame)` in
  `src/main.js`", not a fixed 60. Sonnet, Opus, Haiku and qwen3.8 said so. qwen3.6 only repeated
  the slide.
- On q10, Haiku twice asked the student to type in the homework problem, instead of bringing them
  back to the game. Sonnet and Opus turned it into a fraction question about the game.

## Tutor bug found

In 5 of the 100 answers (Opus and Haiku, all on q08/q09), the first `run_js` with
`where: "game"` straight after `game open` failed with "The game window is not open; open it with
the game tool first." The same happened once in a Haiku smoke test before the runs. The model then
retried, usually with `await wait(1500)`. The `game` tool's `open` seems to return before the
window can take code. It costs a turn each time. The cause is somewhere in `learn/tutor/tools.js` /
`learn/tutor/game.js`; it is not fixed on this branch.

## Limits of this test

- 20 answers per model, single-turn only. Long conversations (context growth, notebook use,
  compaction) were not tested.
- One grader, and that grader is a Claude model grading Claude against Qwen. Every grade below 2
  names a specific false claim or rule break (`lumen/bakeoff/grades-r*.json`); a second grader
  should re-check them before the choice is final.
- The browser was headless Chrome (SwiftShader WebGL). The models saw the game through
  `look_at_game`, but nobody watched the game window.
- Tutor settings were the shipped ones: thinking `low`, and `LLM_MAX_OUTPUT_TOKENS=8192` on the
  Lumen route.

## How to run it again

The harness drives the real tutor (`learn/tutor/`, `?dev=1` exposes `window.learnTutor`) in
headless Chrome. It types each question into the panel and waits for the harness to go idle.

1. Start LiteLLM for Lumen as in `lumen/README.md`.
2. Start the game server bound to this machine only. The key goes only to this one process:

   ```sh
   ANTHROPIC_API_KEY="$(cat ~/.anthropic-promo-key)" OPENAI_UPSTREAM=http://127.0.0.1:4011 \
     OPENAI_API_KEY="$(cat ~/.litellm-local-key)" LLM_MAX_OUTPUT_TOKENS=8192 \
     uv run --no-project tools/serve.py 8377 --bind 127.0.0.1
   ```

3. In a scratch folder: `npm i playwright@1.56.1`, copy `run.mjs` and `questions.json` there, then
   `node run.mjs anthropic claude-sonnet-5-5` or `node run.mjs openai gpt-6-luna`
   (`OUT=results-r2` picks the output folder). `run.mjs` stops at $21 of Anthropic spend.
4. Grade by hand into a grades file, then
   `python3 score.py <repo> results-r1:grades-r1.json results-r2:grades-r2.json`.
