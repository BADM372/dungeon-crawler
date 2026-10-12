// Camera distance scales: smaller means closer. Start at 1.23x the old magnification.
export const DEFAULT_ZOOM = 1 / 1.23;
export const ZOOM_INTERVAL = 1.1;
const minStep = Math.ceil(Math.log(0.15 / DEFAULT_ZOOM) / Math.log(ZOOM_INTERVAL));
const maxStep = Math.floor(Math.log(1.4 / DEFAULT_ZOOM) / Math.log(ZOOM_INTERVAL));

// Keyboard and wheel share a reversible grid of 10% steps, anchored at the default.
// direction: -1 zooms in, +1 zooms out, 0 leaves the target unchanged.
export function stepZoom(target, direction) {
  if (!direction) return target;
  const step = Math.round(Math.log(target / DEFAULT_ZOOM) / Math.log(ZOOM_INTERVAL));
  const next = Math.max(minStep, Math.min(maxStep, step + Math.sign(direction)));
  return DEFAULT_ZOOM * ZOOM_INTERVAL ** next;
}
