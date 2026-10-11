// Web worker that owns the world: WFC, faces, cube generation and the cube geometry run here,
// off the main thread.
// Requests are answered in order; a cube comes back as its map (structured clone keeps the
// object graph) plus what the minimap needs to know about its tile and faces.
import { World } from './world.js';
import { faceKey } from './coords.js';
import { buildCubeGeometry, buffers } from '../render/cubegeo.js';

let world = null;

function info(k) {
  const t = world.wfc.tiles.get(k);
  const faces = [0, 1, 2, 3, 4, 5].map(d => {
    const f = world.faces.get(faceKey(k, d));
    return f ? { portal: f.portal, river: f.river } : null;
  });
  return { kind: t.kind, sock: t.sock, K: t.K, faces };
}

onmessage = ({ data }) => {
  if (data.type === 'init') { world = new World(data.seed, data.opts); return; }
  if (data.type === 'cube') {
    try {
      const c = world.cube(data.key);
      const geo = buildCubeGeometry(c.map);
      postMessage({ type: 'cube', key: data.key, map: c.map, geo, info: info(data.key) }, buffers(geo));
    } catch (e) {
      postMessage({ type: 'error', key: data.key, message: String(e.message || e) });
    }
  }
};
