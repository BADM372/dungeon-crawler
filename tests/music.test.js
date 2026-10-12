import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { repo } from './paths.js';
import { loadScore } from '../src/audio/score.js';

const dir = resolve(repo, 'music');
const files = readdirSync(dir).filter(f => f.endsWith('.scrim'));

test('the game finds its songs', () => {
  for (const name of ['overworld', 'caves']) assert.ok(files.includes(`${name}.scrim`), name);
});

for (const file of files) {
  test(`music/${file} compiles and loops`, () => {
    const { song, levels, errors } = loadScore(readFileSync(resolve(dir, file), 'utf8'));
    assert.deepEqual(errors, []);
    assert.ok(song.loop.dur > 0, 'has a loop');
    for (const lv of [0, 1, 2]) assert.ok(levels.includes(lv), `has level ${lv} voices`);
    // every voice plays somewhere
    const used = new Set([...song.intro.events, ...song.loop.events].map(e => e.v));
    for (const [i, v] of song.voices.entries()) assert.ok(used.has(i), `voice ${v.name} plays`);
  });
}

test('level comments name voices', () => {
  const text = 'beats 1\nvoice a sine\nvoice b kick\n# level 2: b c\npattern A\na | C4--- |\nb | x... |\nloop A\n';
  const { levels, errors } = loadScore(text);
  assert.deepEqual(levels, [0, 2]);
  assert.deepEqual(errors, ['line 4: level 2 names "c", which is not a voice']);
});
