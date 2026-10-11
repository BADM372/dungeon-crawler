// Dissolving whole cubes in and out: every material in a cube gets an ordered-dither discard
// driven by the cube's fade value (1 = solid, 0 = gone). Dithering instead of transparency
// keeps depth writes and sorting intact. Materials must not be shared between cubes.
// Inverted, a group draws exactly the pixels a normal group with the same value drops: two
// versions of one cube cross-fade without gaps or overlap.
const DITHER = `
  if (uFade < 0.999 || uFadeInv > 0.5) {
    const float B[16] = float[16](0., 8., 2., 10., 12., 4., 14., 6., 3., 11., 1., 9., 15., 7., 13., 5.);
    ivec2 q = ivec2(mod(gl_FragCoord.xy, 4.0));
    bool keep = (B[q.x + q.y * 4] + 0.5) / 16.0 < uFade;
    if (keep == (uFadeInv > 0.5)) discard;
  }`;

function patch(mat, u, inv) {
  if (mat.userData.fadeU) return;
  const prev = mat.onBeforeCompile, key = mat.customProgramCacheKey();
  mat.onBeforeCompile = (sh, r) => {
    prev.call(mat, sh, r);
    sh.uniforms.uFade = u; sh.uniforms.uFadeInv = inv;
    sh.fragmentShader = 'uniform float uFade, uFadeInv;\n' + sh.fragmentShader.replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>' + DITHER);
  };
  mat.customProgramCacheKey = () => key + '|fade';
  mat.userData.fadeU = u;
  mat.needsUpdate = true;
}

export function makeFadable(group, value = 1) {
  const u = { value }, inv = { value: 0 };
  group.userData.fadeU = u; group.userData.fadeInv = inv;
  group.traverse(o => { if (o.material) for (const m of [].concat(o.material)) patch(m, u, inv); });
  setFade(group, value);
}

// faded-out parts stop casting shadows halfway through; invert: show what `f` would hide
export function setFade(group, f, invert = false) {
  const shown = invert ? 1 - f : f;
  group.userData.fade = shown;
  group.userData.fadeU.value = f;
  group.userData.fadeInv.value = invert ? 1 : 0;
  group.visible = shown > 0.002;
  const cast = shown > 0.5;
  if (group.userData.cast !== cast) {
    group.userData.cast = cast;
    group.traverse(o => { if (o.isMesh) { if (o.userData.cast0 === undefined) o.userData.cast0 = o.castShadow; o.castShadow = cast && o.userData.cast0; } });
  }
}
