// Reading a Scrimshaw score (vendor/scrimshaw, docs/music.md) plus the game's intensity
// levels. Levels ride in comments, so a score still pastes into the Scrimshaw Jukebox as is:
//   # level 1: pulse timpani        voices that join when an enemy is near
//   # level 2: brass horn           voices that join while fighting
// Voices not listed are level 0 and always play.
import { compile } from '../../vendor/scrimshaw/score.js';

const LEVEL = /^\s*#\s*level\s+(\d+)\s*:(.*)$/i;

export function loadScore(text) {
  const song = compile(text);
  const errors = song.errors.map(e => `line ${e.line}: ${e.msg}`);
  const byName = new Map(song.voices.map((v, i) => [v.name, i]));
  const levels = song.voices.map(() => 0);
  String(text).split(/\r?\n/).forEach((line, i) => {
    const m = LEVEL.exec(line);
    if (!m) return;
    for (const name of m[2].trim().split(/\s+/).filter(Boolean)) {
      if (byName.has(name)) levels[byName.get(name)] = +m[1];
      else errors.push(`line ${i + 1}: level ${m[1]} names "${name}", which is not a voice`);
    }
  });
  return { song, levels, errors };
}
