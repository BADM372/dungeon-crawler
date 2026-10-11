// Entry point: load the first cube and run the frame loop.
import * as THREE from 'three';
import { renderer, scene, camera } from './render/scene.js';
import { animateWorld } from './render/world.js';
import { animateCharacter } from './render/animator.js';
import { generate } from './gen/index.js';
import { groundAt } from './physics/collide.js';
import { player, state, setStatus } from './game/state.js';
import { loadCube } from './game/flow.js';
import { updatePlayer } from './game/update.js';
import { updateCamera } from './game/camera.js';
import { updateCut } from './game/cut.js';
import { updateHud } from './game/hud.js';
import { updateLightPool, focusPoint } from './render/lightpool.js';
import { tickNeighbors } from './render/neighbors.js';
import { tickProps } from './render/props.js';
import { applyLook } from './render/look.js';
import { depthOf } from './world/depth.js';
import './game/dev.js';
import { updateSpiders, spiders } from './game/spiders.js';
import { stunders } from './game/stunders.js';
import { updateEnemies, allEnemies } from './game/enemies.js';
import { travelling, updateTravel, drawTravelEnemies } from './game/travel.js';

const clock = new THREE.Clock();

function frame() {
  const dt = Math.min(clock.getDelta(), 1 / 30);
  state.time += dt;
  if (travelling()) updateTravel(dt);
  else if (state.map && !state.transitioning) { updatePlayer(dt); if (!state.transitioning) updateEnemies(dt); }

  // smooth out small vertical snaps (steps), but not falls
  player.visY += (player.y - player.visY) * Math.min(1, dt * 25);
  if (Math.abs(player.y - player.visY) > 1.5 || player.ragdoll) player.visY = player.y;
  animateCharacter(dt, state.time);
  drawTravelEnemies(dt);
  tickNeighbors(dt);
  tickProps(state.time);
  if (state.world) animateWorld(state.world, dt, state.time);
  updateHud(player, state.map, state.statusMsg);
  updateCamera(dt);
  if (!state.transitioning) updateCut(dt);   // after the camera: the cut depends on what the camera can see
  // the look follows the depth smoothly (also while sliding down / up)
  if (state.cubeKey) state.lookDepth += (depthOf(state.cubeKey) - state.lookDepth) * Math.min(1, dt * 2.5);
  applyLook(state.lookDepth, camera.position.distanceTo(focusPoint(player.x, player.visY, player.z)));
  updateLightPool(focusPoint(player.x, player.visY + 1, player.z));
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

loadCube();
setStatus('Welcome to town. Follow the path through the grove to leave.');
// debug / test hooks
window.__game = {
  get map() { return state.map; }, player, generate, loadCube, updatePlayer, groundAt,
  get transitioning() { return state.transitioning; }, get spiders() { return spiders; }, updateSpiders, state,
  get stunders() { return stunders; }, get enemies() { return allEnemies(); }, updateEnemies,
};
frame();
