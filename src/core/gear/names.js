// Generated item names. Every rarity gets one; the better the item, the grander the name:
//   junk:      a shabby word and the base           "Rusty Long Sword"
//   common:    a plain word and the base            "Militia Long Sword"
//   uncommon:  two words                            "Bright Fang"
//   rare/epic: a compound                           "Grimfang"
//   legendary/mythic: a compound and an epithet     "Grimfang, the Last Oath"
//   ancient:   an old root, compound and epithet    "Ur-Grimfang, Bane of Kings"
// The base type is always shown with it (in the UI), except where it is part of the name.
const JUNK = ['Rusty', 'Bent', 'Chipped', 'Dull', 'Cracked', 'Pitted', 'Warped', 'Notched', 'Tarnished', 'Crude'];
const PLAIN = ['Iron', 'Sturdy', 'Militia', "Soldier's", 'Plain', 'Worn', 'Trusty', 'Simple', 'Forged', "Guard's"];
const ADJ = ['Bright', 'Keen', 'Grim', 'Silent', 'Pale', 'Red', 'Bitter', 'Quick', 'Cold', 'Wild', 'Hollow', 'Iron', 'Black'];
const NOUN = ['Fang', 'Edge', 'Thorn', 'Tooth', 'Song', 'Wing', 'Claw', 'Sting', 'Spike', 'Bite', 'Promise', 'Whisper'];
const ROOT = ['Grim', 'Dusk', 'Storm', 'Frost', 'Ash', 'Blood', 'Night', 'Dawn', 'Gloom', 'Star', 'Bone', 'Ember',
  'Raven', 'Thorn', 'Wolf', 'Hollow', 'Iron', 'Doom', 'Sun', 'Void'];
const TAIL = ['fang', 'bane', 'bite', 'brand', 'edge', 'reaver', 'cleaver', 'thorn', 'song', 'fall', 'shard',
  'caller', 'render', 'splitter', 'whisper', 'sting'];
const EPITHET = ['the Last Oath', 'the Unbroken', 'Warden of Depths', 'the Hungering', 'Oathkeeper', 'the Pale Queen',
  'Breaker of Gates', 'the Lantern', 'the Deep Vow', 'Kingslayer', 'the Ninth Hour', 'Heart of Ash'];
const OLD = ['Ur-', 'Elder ', 'First ', 'Primal '];
const ANCIENT_EPITHET = ['Bane of Kings', 'Who Was Before', 'the World-Root', 'Eye of the Abyss', 'Last of the First Forge',
  'the Sleeping Star'];

const pick = (list, rng) => list[Math.floor(rng() * list.length)];
function compound(rng) {   // never "Thornthorn" or "Boneedge"
  const root = pick(ROOT, rng), end = root.at(-1).toLowerCase();
  return root + pick(TAIL.filter(t => t !== root.toLowerCase() && t[0] !== end), rng);
}

// kids-docs: loot.html#affixes (see kids-docs/README.md)
export function itemName(rarity, baseName, rng) {
  switch (rarity) {
    case 'junk': return `${pick(JUNK, rng)} ${baseName}`;
    case 'common': return `${pick(PLAIN, rng)} ${baseName}`;
    case 'uncommon': return `${pick(ADJ, rng)} ${pick(NOUN, rng)}`;
    case 'rare': case 'epic': return compound(rng);
    case 'legendary': case 'mythic': return `${compound(rng)}, ${pick(EPITHET, rng)}`;
    default: return `${pick(OLD, rng)}${compound(rng)}, ${pick(ANCIENT_EPITHET, rng)}`;
  }
}
// whether the name already says what the item is (no base line needed under it)
export const namesBase = rarity => rarity === 'junk' || rarity === 'common';
