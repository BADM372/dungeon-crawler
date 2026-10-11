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
import { updateSpiders, drawSpiders, spiders } from './game/spiders.js';

const clock = new THREE.Clock();

function frame() {
  const dt = Math.min(clock.getDelta(), 1 / 30);
  state.time += dt;
  if (state.map && !state.transitioning) { updatePlayer(dt); updateSpiders(dt); }

  // smooth out small vertical snaps (steps), but not falls
  player.visY += (player.y - player.visY) * Math.min(1, dt * 25);
  if (Math.abs(player.y - player.visY) > 1.5 || player.ragdoll) player.visY = player.y;
  animateCharacter(dt, state.time);
  drawSpiders(dt);
  if (state.world) animateWorld(state.world, dt, state.time);
  updateHud(player, state.map, state.statusMsg);
  updateCamera(dt);
  updateCut(dt);   // after the camera: the cut depends on what the camera can see
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

loadCube();
setStatus('Find the golden portal on the far side of the cube');
// debug / test hooks
window.__game = {
  get map() { return state.map; }, player, generate, loadCube, updatePlayer, groundAt,
  get transitioning() { return state.transitioning; }, get spiders() { return spiders; }, updateSpiders,
};
frame();
