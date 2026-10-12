# Music

Songs are plain-text [Scrimshaw](https://tools.simonwillison.net/scrimshaw-jukebox) scores in
`music/<name>.scrim`, played by a Web Audio synth in the browser. There is no build step: the
game fetches the score and compiles it when it is first needed. The parser and synth are
vendored in `vendor/scrimshaw/` (Apache-2.0, from Simon Willison's tools).

Music is off by default; M turns it on and off (remembered in `crawler.music`). Sound effects
are not affected.

| File | Role |
|---|---|
| `src/audio/context.js` | the AudioContext shared with the sound effects, made on the first key or click |
| `src/audio/score.js` | compiles a score and reads its intensity levels (pure, tested in node) |
| `src/audio/music.js` | the player: schedules notes ahead, loops, switches songs, fades levels |
| `src/game/music.js` | picks the song and the intensity from the game state |

## Editing

Paste a score into the jukebox page to hear it, see it as a piano roll and get errors per
line, then copy it back. Its "Read guide" section documents the format; in short, settings,
then `voice NAME INSTRUMENT [vol= pan= rev= ...]`, then `pattern` blocks with one line per
voice (`|` separates bars, a step per note plus one per `-`), then `play` (once) and `loop`
(forever). `npm test` compiles every score in `music/` and fails on any error.

## Intensity levels

Each voice has a level; the game fades voices in as the intensity rises. Levels are written
as comments, so a score still pastes into the jukebox unchanged:

```
# level 1: pulse timpani        # joins when an enemy is near
# level 2: brass horn           # joins while fighting
```

Voices not listed are level 0 and always play. A joining voice comes in on the next beat,
a leaving one fades out on the next bar line. Voices that are out are not scheduled at all.

| Level | When (`src/game/music.js`) |
|---|---|
| 0 | exploring |
| 1 | a live enemy within 8 cells |
| 2 | an enemy chasing or attacking you |

The music rises at once and steps down one level after 4 calm seconds.

## Songs

| Song | Where | Notes |
|---|---|---|
| `overworld` | above ground (themes without `cave`) | heroic quick march in C, 120 bpm, 32 bars in AABA |
| `caves` | below ground | dark, driving D minor in 5/4, 76 bpm, 24 bars in three sections |

Both were converted from the earlier MIDI scores, so they are verbose (velocities as `!`/`?`
marks, one voice per drum sound, chords spelled out). Off-grid snare rolls in the overworld
were quantized to sixteenths. Feel free to rewrite them by hand, with chord names (`[Dm]`),
`%` repeats and `pattern B from A`.
