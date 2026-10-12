import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { repo } from './paths.js';
import { loadScore, MOODS } from '../src/audio/score.js';
import { SONGS } from '../src/themes/index.js';

const dir = resolve(repo, 'music');
// the game's songs, plus reference scores in subfolders (tools/player.html FOLDERS)
const files = readdirSync(dir, { recursive: true }).filter(f => f.endsWith('.scrim'));

test('the game finds its songs', () => {
  for (const name of SONGS) assert.ok(files.includes(`${name}.scrim`), name);
  // and plays every song in music/ (subfolders hold reference scores)
  assert.deepEqual(files.filter(f => !f.includes('/')).map(f => f.replace('.scrim', '')).sort(), [...SONGS].sort());
});

test('every reference score is listed for the player', () => {
  for (const sub of new Set(files.filter(f => f.includes('/')).map(f => f.split('/')[0]))) {
    const index = JSON.parse(readFileSync(resolve(dir, sub, 'index.json'), 'utf8')).map(e => `${sub}/${e.file}`);
    assert.deepEqual(index.sort(), files.filter(f => f.startsWith(`${sub}/`)).sort());
  }
});

for (const file of files) {
  test(`music/${file} compiles and loops`, () => {
    const { song, moods, errors } = loadScore(readFileSync(resolve(dir, file), 'utf8'));
    assert.deepEqual(errors, []);
    assert.ok(song.loop.dur > 0, 'has a loop');
    for (const mood of MOODS) assert.ok(moods[mood].size, `mood ${mood} plays something`);
    // every voice plays somewhere, and in some mood
    const used = new Set([...song.intro.events, ...song.loop.events].map(e => e.v));
    for (const [i, v] of song.voices.entries()) {
      assert.ok(used.has(i), `voice ${v.name} plays`);
      assert.ok(MOODS.some(m => moods[m].has(i)), `voice ${v.name} is in a mood`);
    }
  });
}

test('moods build on earlier moods and fall back', () => {
  const text = 'beats 1\nvoice a sine\nvoice b kick\nvoice c sine\n'
    + '# mood explore: a c\n# mood sense: explore b -a\n# mood boss: d\n'
    + 'pattern A\na | C4--- |\nb | x... |\nc | E4--- |\nloop A\n';
  const { moods, errors } = loadScore(text);
  assert.deepEqual([...moods.explore], [0, 2]);
  assert.deepEqual([...moods.sense].sort(), [1, 2]);
  assert.equal(moods.treasure, moods.explore);
  assert.equal(moods.fight, moods.sense);   // fight -> rise -> sense
  assert.deepEqual(errors, ['line 7: mood boss names "d", which is neither a voice nor an earlier mood']);
});

test('a score needs an explore mood', () => {
  const { errors } = loadScore('beats 1\nvoice a sine\n# mood calm: a\npattern A\na | C4--- |\nloop A\n');
  assert.deepEqual(errors, ['line 3: unknown mood "calm" (moods: explore treasure sense rise fight boss)',
    'the score has no "# mood explore:" line']);
});
