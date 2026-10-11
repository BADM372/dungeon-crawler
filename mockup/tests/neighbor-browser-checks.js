// await (await import('./tests/neighbor-browser-checks.js')).runNeighborChecks()
// await (await import('./tests/neighbor-browser-checks.js')).runExpandedTravelChecks()
import * as THREE from 'three';
import { N, WATER } from '../src/core/constants.js';
import { camera, scene, renderer } from '../src/render/scene.js';
import { GeoBuilder } from '../src/render/builder.js';
import { setFade } from '../src/render/fade.js';
import { U } from '../src/render/cutshader.js';
import { buildNeighbors, disposeNeighbors, detachNeighbors, adoptNeighbors, showNeighbors,
  clearNeighbors, clearNeighborCache, cullNeighbors, tickNeighbors, neighborStats } from '../src/render/neighbors.js';
import { paused } from './browser-checks.js';

const check = (condition, message) => { if (!condition) throw Error(message); };

// Real travel in a fully explored stratum, not just the immediate portal pair.
export async function runExpandedTravelChecks() {
  return paused(async () => {
    const { state, player } = await import('../src/game/state.js');
    const { newWorld, enterCube, visitedNeighbors, updateNeighbors } = await import('../src/game/flow.js');
    const { startTravel, travelling, updateTravel } = await import('../src/game/travel.js');
    const { step } = await import('../src/world/coords.js');
    const seed = state.cubes.seed, show = state.showNeighbors;
    const finish = () => { for (let i = 0; i < 180 && travelling(); i++) updateTravel(1 / 60); };
    try {
      state.showNeighbors = true;
      await newWorld(3);
      const cubes = await Promise.all([...state.cubes.layout(1).exists].map(k => state.cubes.get(k)));
      cubes.forEach(c => c.visits = 1);
      const source = cubes[Math.floor(cubes.length / 2)];
      enterCube(source, source.map.portals.find(p => p.kind === 'side').dir);
      tickNeighbors(1);
      const before = detachNeighbors(), originals = new Map(before.map(g => [g.key, g]));
      adoptNeighbors(before);
      const portal = state.map.portals.find(p => p.kind === 'side');
      const common = visitedNeighbors(step(state.cubeKey, portal.dir)).map(g => g.key).filter(k => originals.has(k));
      check(common.length > 4, 'Test must cover more than immediate neighbors');
      startTravel(portal);
      for (let i = 0; i < 100 && !travelling(); i++) await new Promise(r => setTimeout(r, 20));
      check(travelling(), 'Expanded travel must start');
      const live = neighborStats().live;
      state.showNeighbors = false; updateNeighbors(); cullNeighbors(player.x, player.z, false, false);
      check(neighborStats().live === live && neighborStats().visible === 0, 'Travel toggle must hide without building a third set');
      state.showNeighbors = true; updateNeighbors();
      check(neighborStats().live === live, 'Re-enabling during travel must not duplicate proxies');
      for (let i = 0; i < 180 && travelling(); i++) {
        updateTravel(1 / 60); cullNeighbors(player.x, player.z, false);
        for (const k of common) check(originals.get(k).group.userData.fade === 1, 'Common surroundings must not fade out');
      }
      check(!travelling(), 'Expanded travel must finish');
      const after = detachNeighbors(); adoptNeighbors(after);
      for (const k of common) check(after.find(g => g.key === k) === originals.get(k), 'Travel must retain common proxy identity');
      check(new Set(after.map(g => g.key)).size === after.length, 'Travel must not duplicate proxies');
      check(neighborStats().live === after.length, 'Departing proxies must be released');
      return { discovered: cubes.length, reused: common.length, ...neighborStats() };
    } finally { finish(); state.showNeighbors = show; await newWorld(seed); }
  });
}
function fixture() {
  const b = new GeoBuilder(), col = new THREE.Color('gray');
  b.box(0, 0, 0, N, 2, N, col, col);
  return [{ terrain: b.arrays(), wood: null, fluids: { [WATER]: b.arrays() } }];
}

export async function runNeighborChecks() {
  return paused(async () => {
    const original = detachNeighbors(), position = camera.position.clone(), rotation = camera.quaternion.clone();
    const aspect = camera.aspect, geo = fixture(), open = [true, false, true, false];
    const entry = (key, dx, dz = 0, source = geo) => ({ key, geo: source, dx, dz, open });
    let travelling = [];
    try {
      showNeighbors([entry('east', 1), entry('far-east', 2), entry('west', -2), entry('outside', 5)]);
      tickNeighbors(1);
      let list = detachNeighbors(); adoptNeighbors(list);
      check(list[0].geometry === list[1].geometry, 'Worker geometry must be cached/shared');
      check(list[0].group.children[0].material !== list[1].group.children[0].material, 'Fades need independent materials');
      const east = list[0], cached = east.geometry;
      showNeighbors([entry('east', 1), entry('far-east', 2), entry('west', -2), entry('outside', 5)]);
      list = detachNeighbors(); adoptNeighbors(list);
      check(list[0] === east && list[0].group.userData.fade === 1, 'Refresh must preserve proxy and fade');
      check(east.glass.userData.panes.every((p, i) => p.visible === !open[i]), 'Open faces must survive refresh');

      camera.aspect = 1; camera.updateProjectionMatrix();
      camera.position.set(8, 8, 8); camera.lookAt(80, 8, 8);
      cullNeighbors(8, 8, false);
      check(east.cull.visible && list[1].cull.visible, 'Cubes farther than one neighbor must draw');
      check(!list[2].cull.visible, 'Behind-camera cube must be culled');
      check(!list[3].cull.visible, 'Beyond-distance cube must be culled');
      setFade(east.group, 0); cullNeighbors(8, 8, false);
      check(!east.group.visible, 'Culling must not resurrect travel-faded geometry');
      setFade(east.group, 1);
      camera.lookAt(-80, 8, 8); cullNeighbors(8, 8, false);
      check(list[2].cull.visible && !east.cull.visible, 'Turning must reveal cached cubes without rebuilding');
      camera.lookAt(80, 8, 8);
      // Compile/render every material with range/reveal/fade shader patches enabled.
      U.uRes.value.set(renderer.domElement.width, renderer.domElement.height);
      cullNeighbors(8, 8); renderer.render(scene, camera);
      check(!renderer.info.programs.some(p => p.diagnostics && !p.diagnostics.runnable), 'Proxy shaders must compile');
      const fogFar = scene.fog.far;
      try {
        scene.fog.far = 0; cullNeighbors(8, 8);
        check(!list[1].cull.visible, 'Wholly fogged cubes must be culled');
      } finally { scene.fog.far = fogFar; }
      cullNeighbors(-30, 8);
      check(east.group.userData.rangeFadeU.value > 0 && east.group.userData.rangeFadeU.value < 1,
        'Distance boundary must fade, not pop');
      cullNeighbors(8, 8);
      cullNeighbors(8, 8, true, false);
      check(list.every(g => !g.cull.visible), 'V toggle must hide all proxies, including detached travel sets');
      cullNeighbors(8, 8);

      const old = detachNeighbors();
      travelling = buildNeighbors([entry('east', 0), entry('far-east', 1), entry('new', 2)], old);
      check(travelling[0] === east && east.continuing, 'Travel must reuse common proxies');
      check(!old.includes(east) && old.length === 2, 'Common proxies must leave the departing set');
      check(east.base.x === 0 && travelling[1].base.x === N, 'Reused proxies must rebase');
      disposeNeighbors(old); adoptNeighbors(travelling); travelling = [];
      clearNeighbors();
      showNeighbors([entry('east', 1)]);
      list = detachNeighbors(); adoptNeighbors(list);
      check(list[0].geometry === cached, 'Revisits must reuse released cached geometry');
      clearNeighbors();
      for (let i = 0; i < 70; i++) {
        const proxies = buildNeighbors([entry('cache-' + i, 1, 0, fixture())]);
        disposeNeighbors(proxies);
      }
      check(neighborStats().cached <= 64 && neighborStats().bytes <= 32 * 1024 * 1024, 'Unused cache must be bounded');
      clearNeighborCache();
      check(neighborStats().live === original.length, 'Disposed proxies must not remain in culling set');
      return ['distant proxies / shared geometry / independent fades', 'refresh and revisit reuse / opened panes',
        'frustum rotation / distance / fade isolation / shader compilation', 'travel overlap reuse / rebase / bounded cache'];
    } finally {
      disposeNeighbors(travelling); clearNeighbors(); clearNeighborCache(); adoptNeighbors(original);
      camera.position.copy(position); camera.quaternion.copy(rotation); camera.aspect = aspect;
      camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    }
  });
}
