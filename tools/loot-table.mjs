// Weapon drop tables: the chance of a weapon or a potion per kind, the rarity odds per enemy
// level, and what side / descent guardians and chests drop. Then a sample of rolled weapons
// with their stats.
//   node tools/loot-table.mjs [samples per row, default 0]
import { RARITIES, RARITY, rarityOdds } from '../src/core/gear/rarities.js';
import { dropChance, potionChance, guardianDrops } from '../src/core/gear/drops.js';
import { CHESTS } from '../src/core/chests.js';
import { ENEMY_PROFILES } from '../src/core/enemies.js';
import { rollWeapon } from '../src/core/gear/generate.js';
import { itemStats, displayName, baseLine, affixLines, weaponDps } from '../src/core/gear/stats.js';
import { mulberry32 } from '../src/core/util.js';

const pct = p => p ? (p * 100).toFixed(p < 0.01 ? 2 : 1).padStart(6) + '%' : '      -';
const head = label => console.log(label.padEnd(14) + RARITIES.map(r => r.name.slice(0, 6).padStart(7)).join(''));

console.log('kind'.padEnd(14) + ' weapon potion');
for (const k of ENEMY_PROFILES) console.log(k.type.padEnd(14) + pct(dropChance(k.xp)) + pct(potionChance(k.xp)));
console.log('');
head('enemy level');
for (const level of [1, 2, 3, 4, 5, 6, 8, 10, 12, 14, 16, 18, 20, 22])
  console.log(`L${level}`.padEnd(14) + rarityOdds(level).map(pct).join(''));
console.log('');
head('guardian');
for (const [role, levels] of [['side', [2, 6, 10, 14, 18, 21]], ['descent', [3, 5, 10, 14, 18, 22]]])
  for (const level of levels) {
    const g = guardianDrops(role, level);
    console.log(`${role} L${level} x${g.count}`.padEnd(14) + rarityOdds(level, g).map(pct).join(''));
  }
console.log('');
head('chest at d10');
for (const [name, t] of Object.entries(CHESTS)) for (const w of t.weapons)
  console.log(`${name}`.padEnd(14) + rarityOdds(10 + t.level, { floor: RARITY[w.floor].rank, luck: w.luck }).map(pct).join(''));

const samples = Number(process.argv[2] || 0);
if (samples) {
  const R = mulberry32(1);
  for (const r of RARITIES) {
    console.log(`\n${r.name}`);
    for (let i = 0; i < samples; i++) {
      const item = rollWeapon(R, 4 + Math.floor(R() * 16), { rarity: r.id }), s = itemStats(item);
      console.log(`  ${displayName(item)}${baseLine(item) ? ` (${baseLine(item)})` : ''} · ilvl ${item.gen.ilvl} · ` +
        `${s.damage} dmg every ${s.interval}s (${Math.round(weaponDps(s))}/s), ${s.range} reach${affixLines(item).length ? ' · ' + affixLines(item).join(', ') : ''}`);
    }
  }
}
