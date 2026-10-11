// The cutaway's shader side: uniforms shared by every cut material and the region test that
// gets injected into them. The cut outline is a nine-cornered polygon on a circle around the
// character (corners at irregular angles), turning slowly.
import * as THREE from 'three';

const CORNERS = 9, TURN = 0.18;   // rad/s
const JITTER = [0.05, -0.22, 0.17, -0.08, 0.26, -0.15, 0.1, -0.27, 0.2];   // in corner steps

export const U = {
  uCutY: { value: 1e3 }, uCenter: { value: new THREE.Vector2() }, uRadius: { value: 1 },
  uAspect: { value: 1 }, uDepth: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) },
  uFront: { value: new THREE.Vector4() }, uWallY: { value: 1e3 },
  uPoly: { value: Array.from({ length: CORNERS }, () => new THREE.Vector2()) },
};

// corners on the unit circle, counter-clockwise
export function turnShape(time) {
  U.uPoly.value.forEach((v, i) => { const a = (i + JITTER[i]) / CORNERS * Math.PI * 2 + time * TURN; v.set(Math.cos(a), Math.sin(a)); });
}
turnShape(0);

// 1 inside the cutaway, 0 outside; y-test optional
const REGION = `
  bool inPoly(vec2 p) {
    for (int i = 0; i < ${CORNERS}; i++) {
      vec2 a = uPoly[i], b = uPoly[(i + 1) % ${CORNERS}];
      if ((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x) < 0.0) return false;
    }
    return true;
  }
  float cutRegion(bool testY) {
    if (testY && vCutW.y <= uCutY) return 0.0;
    if (vCutZ > uDepth - 0.15) return 0.0;
    vec2 ndc = gl_FragCoord.xy / uRes * 2.0 - 1.0;
    return inPoly((ndc - uCenter) * vec2(uAspect, 1.0) / uRadius) ? 1.0 : 0.0;
  }
  // caves: the walls on the faces towards the camera are cut down (+x, -x, +z, -z flags)
  bool frontWall() {
    if (vCutW.y <= uWallY) return false;
    vec4 d = vec4(16.0 - vCutW.x, vCutW.x, 16.0 - vCutW.z, vCutW.z);
    return any(bvec4(d.x < 2.2 && uFront.x > 0.5, d.y < 2.2 && uFront.y > 0.5, d.z < 2.2 && uFront.z > 0.5, d.w < 2.2 && uFront.w > 0.5));
  }`;

// patch a built-in material: world position / view depth varyings, uniforms, region test;
// fragCode edits the fragment shader (where to discard)
export function inject(mat, fragCode, key) {
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = 'varying vec3 vCutW;\nvarying float vCutZ;\n' + sh.vertexShader.replace('#include <project_vertex>',
      '#include <project_vertex>\n#ifdef USE_INSTANCING\n  vCutW = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;\n#else\n  vCutW = (modelMatrix * vec4(transformed, 1.0)).xyz;\n#endif\n  vCutZ = -mvPosition.z;');
    sh.fragmentShader = `varying vec3 vCutW;\nvarying float vCutZ;\nuniform float uCutY, uRadius, uAspect, uDepth, uWallY;\nuniform vec2 uCenter, uRes;\nuniform vec4 uFront;\nuniform vec2 uPoly[${CORNERS}];\n`
      + REGION + '\n' + fragCode(sh.fragmentShader);
  };
  mat.customProgramCacheKey = () => key;
  return mat;
}
