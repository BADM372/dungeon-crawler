// Camera distance scales: smaller means closer. Start at 1.23x the old magnification.
export const DEFAULT_ZOOM = 1 / 1.23;
export const ZOOM_INTERVAL = 1.1;
const minStep = -2, maxStep = 2;

// Keyboard and wheel share five reversible 10% levels, with the default in the middle.
// direction: -1 zooms in, +1 zooms out, 0 leaves the target unchanged.
export function stepZoom(target, direction) {
  if (!direction) return target;
  const step = Math.round(Math.log(target / DEFAULT_ZOOM) / Math.log(ZOOM_INTERVAL));
  const next = Math.max(minStep, Math.min(maxStep, step + Math.sign(direction)));
  return DEFAULT_ZOOM * ZOOM_INTERVAL ** next;
}
