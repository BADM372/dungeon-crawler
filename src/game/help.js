// The controls overlay (? or /). It does not pause the game.
import { state } from './state.js';

const overlay = document.getElementById('help-overlay');
if (state.dev) for (const el of overlay.querySelectorAll('.dev-only')) el.hidden = false;

export const helpOpen = () => !overlay.hidden;
export function setHelpOpen(open) { overlay.hidden = !open; }
export const toggleHelp = () => setHelpOpen(overlay.hidden);
