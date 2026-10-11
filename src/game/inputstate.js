// Shared input memory lets the modal clear held/queued input without an input/UI cycle.
import { player } from './state.js';
export const controls = { keys: new Set(), lastTap: {}, running: false, jumpPressed: false };
export function clearInput() {
  controls.keys.clear(); controls.running = false; controls.jumpPressed = false;
  player.sword.requested = false; player.autoDir = null; player.autoRun = false;
  for (const key of Object.keys(controls.lastTap)) delete controls.lastTap[key];
}
