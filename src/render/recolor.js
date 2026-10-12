// Enemy kinds recolour their species' model (core/oklch.js). The colours are worked out once
// per kind from the prefab's own materials, then copied into the material clones each
// instance (or projectile) owns, before anything remembers them as its base colour.
import * as THREE from 'three';
import { recolorTable } from '../core/oklch.js';

const tables = new WeakMap();
const rgb = c => [c.r, c.g, c.b];

// name -> { color, emissive? } for a kind, or null when it keeps the species' colours
export function kindColors(profile, prefab) {
  if (!profile?.colors || !prefab?.source) return null;
  let table = tables.get(profile);
  if (!table) {
    const materials = {};
    const visit = root => root.traverse(o => {
      if (o.isMesh) for (const m of [].concat(o.material)) materials[m.name] ??= { color: rgb(m.color), emissive: m.emissive && rgb(m.emissive) };
    });
    visit(prefab.source);
    Object.values(prefab.props ?? {}).forEach(visit);
    table = new Map(Object.entries(recolorTable(materials, profile.parts, profile.colors)).map(([name, { color, emissive }]) =>
      [name, { color: new THREE.Color(...color), emissive: emissive && new THREE.Color(...emissive) }]));
    tables.set(profile, table);
  }
  return table;
}
// recolour a material this instance owns
export function recolor(material, table) {
  const to = table?.get(material.name);
  if (!to) return material;
  material.color.copy(to.color);
  if (to.emissive && material.emissive) material.emissive.copy(to.emissive);
  return material;
}
