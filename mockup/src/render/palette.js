// Colours used by the world meshes.
import * as THREE from 'three';
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

// terrain: grass tops by height (in levels), rock strata on the sides
export const TOP_STOPS = [[0, '#3b6532'], [4, '#4c8a3c'], [8, '#76ad50'], [12, '#a3b26a'], [16, '#b7a888'], [20, '#d9d3c5']];
export const SIDE_STOPS = [[0, '#4e382a'], [6, '#7a5638'], [11, '#7a6d62'], [20, '#9a948c']];
export const LIP = C('#3f6b2e');
export const UNDERSIDE = C('#3a2f28');
export const BEDROCK = [C('#2a2a31'), C('#23232a')];
export const fluidBed = t => C(t === WATER ? '#7d6f52' : t === LAVA ? '#2b1d1a' : '#3e4a2a');
export const fluidBank = t => C(t === WATER ? '#c9b98a' : t === LAVA ? '#3a2a22' : '#a4a64a');

// structures
export const STONE = C('#cfc5b2'), STONE2 = C('#bdb29e'), CHEEK = C('#8f8678'), CAP = C('#a69d8d');
export const SOFFIT = C('#6f685e'), PIER = C('#968e80');
export const WOOD = C('#a0703f'), WOOD2 = C('#8d6136'), BEAM = C('#5d3d22'), ROPE = C('#cdb88e');
export const POST = C('#6e4420'), RAIL = C('#8b5a2b');
