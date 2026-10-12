// Camera distance scales: smaller means closer. Start at 1.23x the old magnification.
export const DEFAULT_ZOOM = 1 / 1.23;
export const ZOOM_INTERVAL = 1.1;
const zoomLevels = [-2, -1, 0, 1, 2].map(step => DEFAULT_ZOOM * ZOOM_INTERVAL ** step);
zoomLevels[0] /= 1.25;   // closest preset: 25% more magnification, other presets unchanged

// Keyboard and wheel share five reversible presets, with the default in the middle.
// direction: -1 zooms in, +1 zooms out, 0 leaves the target unchanged.
export function stepZoom(target, direction) {
  if (!direction) return target;
  const step = zoomLevels.reduce((best, zoom, i) =>
    Math.abs(target - zoom) < Math.abs(target - zoomLevels[best]) ? i : best, 0);
  const next = Math.max(0, Math.min(zoomLevels.length - 1, step + Math.sign(direction)));
  return zoomLevels[next];
}
