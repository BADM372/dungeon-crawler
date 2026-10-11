// Entry point: load the first cube and run the frame loop.
import * as THREE from 'three';
import { renderer, scene, camera } from './render/scene.js';
import { animateWorld } from './render/world.js';
import { updateBall } from './render/ball.js';
import { generate } from './gen/index.js';
import { groundAt } from './physics/collide.js';
import { player, state, setStatus } from './game/state.js';
import { loadCube } from './game/flow.js';
import { updatePlayer } from './game/update.js';
import { updateCamera } from './game/camera.js';
import { updateHud } from './game/hud.js';

const clock = new THREE.Clock();

function frame() {
  const dt = Math.min(clock.getDelta(), 1 / 30);
  state.time += dt;
  const ox = player.x, oz = player.z;
  if (state.map && !state.transitioning) updatePlayer(dt);

  player.visY += (player.y - player.visY) * Math.min(1, dt * 25);
  if (Math.abs(player.y - player.visY) > 1.5) player.visY = player.y;
  updateBall(player.x, player.visY, player.z, player.x - ox, player.z - oz);
  if (state.world) animateWorld(state.world, dt, state.time, player.layer);
  updateHud(player, state.map, state.statusMsg);
  updateCamera(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

loadCube();
setStatus('Find the golden portal on the far side of the cube');
// debug / test hooks
window.__game = {
  get map() { return state.map; }, player, generate, loadCube, updatePlayer, groundAt,
  get transitioning() { return state.transitioning; },
};
frame();
