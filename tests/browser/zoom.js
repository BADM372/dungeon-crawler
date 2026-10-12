// Run in the game console: (await import('/tests/browser/zoom.js')).runZoomChecks()
import { player, state, view } from '../../src/game/state.js';
import { DEFAULT_ZOOM, stepZoom } from '../../src/core/zoom.js';
import { setInventoryOpen } from '../../src/game/inventory.js';
import '../../src/game/input.js';

const check = (condition, message) => { if (!condition) throw Error(message); };
const press = (code, options = {}) => {
  dispatchEvent(new KeyboardEvent('keydown', { code, ...options }));
  dispatchEvent(new KeyboardEvent('keyup', { code }));
};
const wheel = deltaY => dispatchEvent(new WheelEvent('wheel', { deltaY }));

export function runZoomChecks() {
  const original = view.zoomTarget, inventoryOpen = state.inventoryOpen, ragdoll = player.ragdoll;
  try {
    setInventoryOpen(false);
    view.zoomTarget = DEFAULT_ZOOM;
    press('KeyK');
    const closer = stepZoom(DEFAULT_ZOOM, -1);
    check(view.zoomTarget === closer && player.ragdoll === ragdoll, 'K must zoom in, not knock over');
    press('KeyL');
    check(view.zoomTarget === DEFAULT_ZOOM, 'L must undo K exactly');
    wheel(-100);
    check(view.zoomTarget === closer, 'Wheel up must match K');
    wheel(100);
    check(view.zoomTarget === DEFAULT_ZOOM, 'Wheel down must match L');
    wheel(0);
    press('KeyK', { repeat: true });
    press('KeyL', { ctrlKey: true });
    check(view.zoomTarget === DEFAULT_ZOOM, 'Zero wheel, repeats and modified shortcuts must not zoom');
    setInventoryOpen(true);
    for (const input of [() => press('KeyK'), () => press('KeyL'), () => wheel(-100), () => wheel(100)]) {
      input();
      check(view.zoomTarget === DEFAULT_ZOOM, 'Inventory must suppress keyboard and wheel zoom');
    }
    return ['K/L zoom without knockdown', 'wheel matches reversible keyboard steps', 'input guards / inventory isolation'];
  } finally {
    view.zoomTarget = original;
    setInventoryOpen(inventoryOpen);
  }
}
