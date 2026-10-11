// What the cutaway removes is drawn again as faint glass: every cut solid (terrain, structures,
// props) gets a twin sharing its geometry with a glass material that only draws inside the
// cutaway. Twins render after everything opaque and write no depth, so the character and the
// section caps show through. One glass material per cube (fading patches it per cube).
import * as THREE from 'three';
import { inject } from './cutshader.js';

function glassMaterial() {
  const mat = new THREE.MeshStandardMaterial({ color: 0xdcecff, transparent: true, opacity: 0.08, roughness: 0.2, metalness: 0, depthWrite: false });
  return inject(mat, fs => fs
    .replace('#include <clipping_planes_fragment>', 'if (cutRegion(true) < 0.5) discard;\n#include <clipping_planes_fragment>')
    // a little more opaque where the surface turns away (outlines the shapes)
    .replace('#include <dithering_fragment>', `#include <dithering_fragment>
      float rim = 1.0 - abs(dot(normalize(normal), normalize(vViewPosition)));
      gl_FragColor.a = mix(0.05, 0.3, rim * rim);`), 'cut-glass');
}

export function addGhosts(group) {
  const mat = glassMaterial(), solids = [];
  group.traverse(o => { if (o.isMesh && o.material.userData?.ghost) solids.push(o); });
  for (const o of solids) {
    const g = o.isInstancedMesh ? new THREE.InstancedMesh(o.geometry, mat, o.count) : new THREE.Mesh(o.geometry, mat);
    if (o.isInstancedMesh) g.instanceMatrix = o.instanceMatrix;
    g.position.copy(o.position); g.quaternion.copy(o.quaternion); g.scale.copy(o.scale);
    g.userData.sharedGeo = true;   // the solid owns the geometry
    g.renderOrder = 60;
    o.parent.add(g);
  }
}
