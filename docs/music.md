# Music

Songs are plain-text [Scrimshaw](https://tools.simonwillison.net/scrimshaw-jukebox) scores in
`music/<name>.scrim`, played by a Web Audio synth in the browser. There is no build step: the
game fetches the score and compiles it when it is first needed. The parser and synth are
vendored in `vendor/scrimshaw/` (Apache-2.0, from Simon Willison's tools).

**Writing a song?** Start with `music/README.md`: the game's musical style, how to build the
layers, a format cheat sheet and a full example score.

Music is off by default; M turns it on and off (remembered in `crawler.music`). Sound effects
are not affected.

| File | Role |
|---|---|
| `src/audio/context.js` | the AudioContext shared with the sound effects, made on the first key or click |
| `src/audio/score.js` | compiles a score and reads its moods (pure, tested in node) |
| `src/audio/music.js` | the player: schedules notes ahead, loops, switches songs, fades voices between moods |
| `src/game/music.js` | picks the song and the mood from the game state; `forceMood` holds one (`__game.musicMood`) |

## Editing

Paste a score into the jukebox page to hear it, see it as a piano roll and get errors per
line, then copy it back. Its "Read guide" section documents the format; in short, settings,
then `voice NAME INSTRUMENT [vol= pan= rev= ...]`, then `pattern` blocks with one line per
voice (`|` separates bars, a step per note plus one per `-`), then `play` (once) and `loop`
(forever). `npm test` compiles every score in `music/` and fails on any error.

## Moods

The game picks one of six moods and each score names the voices that play in it, in
`# mood NAME: voices` comments (`music/README.md` explains the syntax and the fallbacks). Moods are not
levels: a calmer-sounding set can replace a fuller one, so a mood can take voices away.

| Mood | When (`src/game/music.js`) | Holds after its reason is gone |
|---|---|---|
| `explore` | nothing below applies | |
| `treasure` | a reward site's chest (`map.rewardSites[].anchor`) within 6 cells and 3 up or down | 1 s |
| `sense` | a live enemy within 8 cells and 3 up or down | 2 s |
| `rise` | an enemy in `chase` or `attack` | 3 s |
| `fight` | an enemy in `chase` or `attack` within 4 cells; or blows within the last 6 s (an enemy in `attack`, its hp dropping, yours dropping) while an enemy is after you or sensed | 4 s |
| `boss` | a guardian in `chase` or `attack`, or hurt and within 12 cells | 5 s |

The highest mood that applies wins and takes over at once; a calmer one takes over only
after the current one's hold time.

Voices that are out are not scheduled at all. A joining voice comes in on the first sixteenth
at least 40 ms away. Its notes from there up to what the scheduler has already done (0.3 s
ahead) are played at once, and a note already sounding plays its remainder from the join,
so a switch is heard within about 0.2 s. A leaving voice fades out from the next beat.

## Songs

| Song | Where | Notes |
|---|---|---|
| `overworld` | above ground (themes without `cave`) | E Dorian over a turning marimba ostinato (after Golden Sun's Sol Sanctum), 80 bpm, 32 bars in A B A2 C, all six moods |
| `caves` | below ground | dark, driving D minor in 5/4, 76 bpm, 24 bars in three sections; explore, sense and fight only |

`caves` was converted from an earlier MIDI score, so it is verbose (velocities as `!`/`?`
marks, one voice per drum sound, chords spelled out) and its moods only add voices. It
should be rewritten by hand, the way `overworld` is.
