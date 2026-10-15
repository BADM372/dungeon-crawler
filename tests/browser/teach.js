// The teaching helpers (src/game/teach.js), in the running game with ?dev=1:
// await (await import('/tests/browser/teach.js')).runTeachChecks()
// Spawns a spider next to the player and takes it away again; leaves nothing drawn, paused or tuned.
import { player, state } from '../../src/game/state.js';
import { teach } from '../../src/game/teach.js';
import { overlay } from '../../src/render/overlay.js';
import { spawnEnemies, clearEnemies } from '../../src/game/devspawn.js';
import { SPIDER } from '../../src/core/enemies.js';
import { ITEMS } from '../../src/core/items.js';

const check = (condition, message) => { if (!condition) throw Error(message); };
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const meshes = () => { let n = 0; overlay.traverse(o => { if (o.visible && (o.isMesh || o.isSprite || o.isLine)) n++; }); return n; };

export async function runTeachChecks() {
  check(state.dev, 'Open the game with ?dev=1');
  check(state.map && !state.transitioning, 'Wait for the cube to be ready');
  teach.reset();
  const results = [], aggro = SPIDER.aggro;
  const [spider] = spawnEnemies('spider', { level: 1, at: { x: player.x + 2.5, y: player.y, z: player.z } });
  check(spider, 'There must be room for a spider next to the player');
  try {
    // drawings: ids, replacing, following, ttl, clearing
    const before = meshes();
    const pin = teach.pin(spider, { label: 'a spider' });
    teach.label('player', 'you', { id: 'me' });
    teach.label('player', 'you again', { id: 'me' });
    teach.arrow('player', spider);
    teach.ring([player.x, player.z], 1);
    teach.sector(spider, 2, { angle: 90 });
    teach.cell(Math.floor(player.x), Math.floor(player.z), { label: 'here' });
    teach.path([[1, 1], [3, 1], [3, 3]], { ttl: 0.2 });
    await delay(100);
    check(meshes() > before, 'Drawings must show');
    check(/7 drawings/.test(teach.status()), 'The same id must replace a drawing: ' + teach.status());
    const s = teach.toScreen(spider);
    check(s && Number.isFinite(s.x) && Number.isFinite(s.y), 'toScreen must find the spider');
    await delay(300);
    check(/6 drawings/.test(teach.status()), 'A drawing must go when its ttl is over');
    teach.clear(pin);
    check(/5 drawings/.test(teach.status()), 'clear(id) takes one away');
    results.push('drawings');

    // lenses
    for (const name of ['sword', 'awareness', 'paths', 'grid', 'route']) teach.lens(name);
    await delay(100);
    check(teach.lenses().length === 5 && state.showPath && state.world.pathLine.visible, 'The lenses must be on');
    let threw = false;
    try { teach.lens('x-ray'); } catch { threw = true; }
    check(threw, 'An unknown lens must say so');
    results.push('lenses');

    // time
    teach.pause();
    await delay(100);
    const t0 = state.time, x0 = spider.x;
    await delay(200);
    check(state.time === t0 && spider.x === x0, 'Paused, nothing moves');
    await teach.step(12);
    check(Math.abs(state.time - t0 - 12 / 60) < 1e-9, 'Twelve steps are a fifth of a second: ' + (state.time - t0));
    teach.resume();
    teach.speed(0.5);
    check(/speed 0.5/.test(teach.status()), 'The status says the speed');
    teach.speed(1);
    results.push('pause / step / speed');

    // tuning, with a way back
    const said = await teach.tune('src/core/enemies.js#SPIDER.aggro', aggro * 2);
    check(SPIDER.aggro === aggro * 2 && spider.profile.aggro === aggro * 2, 'Tuning a kind changes it and its living enemies: ' + said);
    const range = ITEMS.weapon_sword_old.weapon.range;
    await teach.tune('src/core/items.js#ITEMS.weapon_sword_old.weapon.range', 3);
    await teach.tune('src/core/items.js#ITEMS.weapon_sword_old.weapon.range', 4);
    await teach.tune(player, 'maxHp', 999);
    check(teach.tuned().length === 4, 'Each value is remembered once: ' + JSON.stringify(teach.tuned()));
    let refused = '';
    try { await teach.tune('src/core/constants.js#RUN_SPEED', 9); } catch (e) { refused = e.message; }
    check(/plain value/.test(refused), 'A plain exported number cannot be tuned and says why');
    results.push('tuning');

    const maxHp = teach.tuned().find(c => c.label === 'maxHp').before;
    teach.reset();
    check(SPIDER.aggro === aggro && spider.profile.aggro === aggro && ITEMS.weapon_sword_old.weapon.range === range && player.maxHp === maxHp,
      'reset puts every tuned value back');
    check(!teach.paused && !teach.lenses().length && !state.showPath && teach.status() === '', 'reset undoes everything: ' + teach.status());
    await delay(100);
    check(meshes() === before, 'and nothing is drawn any more');
    results.push('reset');
  } finally {
    teach.reset();
    clearEnemies();
  }
  return results;
}
