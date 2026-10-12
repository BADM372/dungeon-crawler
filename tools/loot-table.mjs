// Weapon drop tables: the chance of a weapon and the rarity odds per enemy level, and what
// side / descent guardians drop. Then a sample of rolled weapons with their stats.
//   node tools/loot-table.mjs [samples per row, default 0]
import { RARITIES, rarityOdds } from '../src/core/gear/rarities.js';
import { dropChance, guardianDrops } from '../src/core/gear/drops.js';
import { rollWeapon } from '../src/core/gear/generate.js';
import { itemStats, displayName, baseLine, affixLines } from '../src/core/gear/stats.js';
import { mulberry32 } from '../src/core/util.js';

const pct = p => p ? (p * 100).toFixed(p < 0.01 ? 2 : 1).padStart(6) + '%' : '      -';
const head = label => console.log(label.padEnd(14) + RARITIES.map(r => r.name.slice(0, 6).padStart(7)).join(''));

head('enemy level');
for (const level of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
  console.log(`L${level} ${pct(dropChance(level))}`.padEnd(14) + rarityOdds(level).map(pct).join(''));
console.log('\n(the % after the level: chance that an ordinary enemy drops a weapon)\n');
head('guardian');
for (const [role, levels] of [['side', [7, 10, 12, 15, 18, 23]], ['descent', [10, 13, 15, 20, 23, 26]]])
  for (const level of levels) {
    const g = guardianDrops(role, level);
    console.log(`${role} L${level} x${g.count}`.padEnd(14) + rarityOdds(level, g).map(pct).join(''));
  }

const samples = Number(process.argv[2] || 0);
if (samples) {
  const R = mulberry32(1);
  for (const r of RARITIES) {
    console.log(`\n${r.name}`);
    for (let i = 0; i < samples; i++) {
      const item = rollWeapon(R, 4 + Math.floor(R() * 16), { rarity: r.id }), s = itemStats(item);
      console.log(`  ${displayName(item)}${baseLine(item) ? ` (${baseLine(item)})` : ''} · ilvl ${item.gen.ilvl} · ` +
        `${s.damage} dmg, ${s.cooldown}s, ${s.range} reach${affixLines(item).length ? ' · ' + affixLines(item).join(', ') : ''}`);
    }
  }
}
