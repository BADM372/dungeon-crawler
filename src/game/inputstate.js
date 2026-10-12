// Shared input memory lets the modal clear held/queued input without an input/UI cycle.
import { player } from './state.js';
export const controls = { keys: new Set(), jumpPressed: false };
export function clearInput() {
  controls.keys.clear(); controls.jumpPressed = false;
  player.sword.requested = false; player.autoDir = null;
}
