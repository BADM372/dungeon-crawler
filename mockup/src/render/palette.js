// Colours used by the world meshes.
import * as THREE from '../../vendor/three/three.module.js';   // plain path: also loads in the world worker
import { WATER, LAVA } from '../core/constants.js';

export const C = s => new THREE.Color(s);

export function gradient(stops, v) {
  if (v <= stops[0][0]) return new THREE.Color(stops[0][1]);
  for (let i = 1; i < stops.length; i++) {
    if (v <= stops[i][0]) {
      const t = (v - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0]);
      return new THREE.Color(stops[i - 1][1]).lerp(new THREE.Color(stops[i][1]), t);
    }
  }
  return new THREE.Color(stops[stops.length - 1][1]);
}

// terrain: tops by height (in levels), rock strata on the sides; set per depth (usePalette)
export let TOP_STOPS, SIDE_STOPS, LIP, UNDERSIDE, BEDROCK;
export function usePalette(theme) {
  TOP_STOPS = theme.top; SIDE_STOPS = theme.side;
  LIP = C(theme.lip); UNDERSIDE = C(theme.under); BEDROCK = theme.bed.map(C);
}
export const fluidBed = t => C(t === WATER ? '#7d6f52' : t === LAVA ? '#2b1d1a' : '#3e4a2a');
export const fluidBank = t => C(t === WATER ? '#c9b98a' : t === LAVA ? '#3a2a22' : '#a4a64a');

// structures
export const STONE = C('#cfc5b2'), STONE2 = C('#bdb29e'), CHEEK = C('#8f8678'), CAP = C('#a69d8d');
export const SOFFIT = C('#6f685e'), PIER = C('#968e80');
export const WOOD = C('#a0703f'), WOOD2 = C('#8d6136'), BEAM = C('#5d3d22'), ROPE = C('#cdb88e');
export const POST = C('#6e4420'), RAIL = C('#8b5a2b');
