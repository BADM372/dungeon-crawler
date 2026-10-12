// Reading a Scrimshaw score (vendor/scrimshaw, docs/music.md) plus the game's moods. Moods ride
// in comments, so a score still pastes into the Scrimshaw Jukebox as is. Each mood names the
// voices that play in it; a mood name pulls in that (earlier) mood's voices, -NAME drops one:
//   # mood explore: lead harp strings bass
//   # mood sense:   strings bass pulse          not additive: the tune drops out
//   # mood rise:    sense lead kick snare
// A mood a score leaves out falls back along FALLBACK; every score needs explore.
import { compile } from '../../vendor/scrimshaw/score.js';

export const MOODS = ['explore', 'treasure', 'sense', 'rise', 'fight', 'boss'];
export const FALLBACK = { treasure: 'explore', sense: 'explore', rise: 'sense', fight: 'rise', boss: 'fight' };

const MOOD = /^\s*#\s*mood\s+(\w+)\s*:(.*)$/i;

export function loadScore(text) {
  const song = compile(text);
  const errors = song.errors.map(e => `line ${e.line}: ${e.msg}`);
  const byName = new Map(song.voices.map((v, i) => [v.name, i]));
  const given = new Map();                  // mood -> Set of voice indices, as written
  String(text).split(/\r?\n/).forEach((line, i) => {
    const m = MOOD.exec(line);
    if (!m) return;
    const err = msg => errors.push(`line ${i + 1}: ${msg}`);
    const mood = m[1].toLowerCase();
    if (!MOODS.includes(mood)) return err(`unknown mood "${m[1]}" (moods: ${MOODS.join(' ')})`);
    if (given.has(mood)) return err(`mood ${mood} is defined twice`);
    const set = new Set();
    for (const word of m[2].trim().split(/\s+/).filter(Boolean)) {
      const drop = word.startsWith('-'), name = drop ? word.slice(1) : word;
      const add = given.get(name) ?? (byName.has(name) ? [byName.get(name)] : null);
      if (!add) { err(`mood ${mood} names "${name}", which is neither a voice nor an earlier mood`); continue; }
      for (const v of add) drop ? set.delete(v) : set.add(v);
    }
    given.set(mood, set);
  });
  for (const name of byName.keys()) if (MOODS.includes(name)) errors.push(`voice "${name}" is named like a mood`);
  if (!given.has('explore')) errors.push('the score has no "# mood explore:" line');
  const moods = {};
  for (const mood of MOODS) {
    let from = mood;
    while (!given.has(from) && FALLBACK[from]) from = FALLBACK[from];
    moods[mood] = given.get(from) ?? new Set();
  }
  return { song, moods, given: [...given.keys()], errors };
}
