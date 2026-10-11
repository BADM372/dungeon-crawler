// Real worker/asset/render checks, run from game.html's devtools:
// await (await import('./tests/town-browser-checks.js')).runTownChecks()
// Resets the world before/after testing.
import { state } from '../src/game/state.js';
import { newWorld, enterCube } from '../src/game/flow.js';
import { clearInput } from '../src/game/input.js';
import { step } from '../src/world/coords.js';
import { BUILDINGS, MERCHANTS } from '../src/world/town.js';
import { props } from '../src/render/props.js';
import { paused } from './browser-checks.js';

const check = (condition, message) => { if (!condition) throw Error(message); };
function rendered(name) {
  const asset = props.byName.get(name);
  check(asset, 'Missing asset: ' + name);
  let count = 0;
  state.world.group.traverse(o => {
    if (o.isInstancedMesh && o.material.userData?.ghost && asset.parts.some(p => p.geometry === o.geometry)) count += o.count;
  });
  return count / asset.parts.length;
}

export async function runTownChecks() {
  check(!state.transitioning && !state.inventoryOpen, 'Finish travel and close inventory first');
  const originalSeed = state.cubes.seed;
  return paused(async () => {
    const results = [];
    try {
      for (const seed of [0, 1, 2, 3]) {
        await newWorld(seed); clearInput();
        const town = state.cubes.cubes.get(state.cubeKey), dir = town.map.exit;
        for (const b of BUILDINGS) check(rendered(b.name) === 1, 'Town building not rendered once: ' + b.name);
        for (const b of MERCHANTS) check(rendered(b.name) === 0, 'Tent still rendered inside town');
        const camp = await state.cubes.get(step(town.key, dir));
        check(camp.map.merchantCamp && !camp.map.town, 'Worker lost camp metadata');
        enterCube(camp, dir ^ 1);
        for (const b of MERCHANTS) check(rendered(b.name) === 1, 'Camp tent not rendered once: ' + b.name);
        for (const b of BUILDINGS) check(rendered(b.name) === 0, 'Permanent building rendered in camp');
        check(document.getElementById('depth').textContent.includes('Merchant camp'), 'Camp mislabeled in HUD');
        for (const box of camp.map.occluders.filter(b => b.shape === 'box'))
          check(camp.map.blockers.some(list => list.includes(box)), 'Rendering discarded static tent collision');
        const outside = await state.cubes.get(step(camp.key, dir));
        enterCube(outside, dir ^ 1);
        for (const b of MERCHANTS) check(rendered(b.name) === 0, 'Tents rendered beyond the first road cube');
        enterCube(camp, dir);
        for (const b of MERCHANTS) check(rendered(b.name) === 1, 'Revisit duplicated or lost a tent');
        enterCube(town);
        for (const b of MERCHANTS) check(rendered(b.name) === 0, 'Return restored tents inside town');
        results.push('side ' + dir + ': town / worker camp / rendered tents / static collision / onward road / revisits');
      }
      return results;
    } finally { clearInput(); await newWorld(originalSeed); }
  });
}
