// Measures the enemy population per cube on real generated cubes for docs/depths.md:
// the average count, the most in one cube and the average XP, per depth over 4 seeds
// and up to 32 cubes each (town and camp cubes skipped).
// Usage: node tools/depth-population.mjs
globalThis.location = { search: '?seed=1' };
const { state } = await import('../src/game/state.js');
const { World } = await import('../src/world/world.js');
const { ENEMY_PROFILES, enemyProfile } = await import('../src/core/enemies.js');
const { enemySpots } = await import('../src/game/enemyspawn.js');

console.log('| Depth | Enemies | Max | XP |\n|---:|---:|---:|---:|');
for (let depth = 0; depth <= 20; depth++) {
  let total = 0, max = 0, xp = 0, cubes = 0;
  for (const seed of [1, 2, 3, 4]) {
    const world = new World(seed);
    for (const k of [...world.layout(depth).exists].slice(0, 32)) {
      const map = state.map = world.cube(k).map;
      if (map.enemyFree) continue;
      let n = 0;
      for (const p of ENEMY_PROFILES) for (const s of enemySpots(map, p)) { n++; xp += enemyProfile(s.kind, s.level).xp; }
      total += n; max = Math.max(max, n); cubes++;
    }
  }
  console.log(`| ${depth} | ${(total / cubes).toFixed(1)} | ${max} | ${Math.round(xp / cubes)} |`);
}
