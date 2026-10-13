// Shared enemy tuning, in game cells / seconds. Stunder is a slow, heavy threat.
// A strike's timing / reach / effect lives on the profile; a species with several
// attacks lists them in `attacks` (`clip` names its animation, `weight` how often it
// is picked). `arc` is the minimum cosine to the target (-1: hits all around),
// `power` scales the profile's damage, `knockDown` floors the player.
// `species` names the model (and the spawn roster's entry); `parts` groups the model's
// recolourable materials by role (core/oklch.js), the first one being the role's anchor.
// Teeth, pupils and mouths stay out of `parts`, so no kind recolours them.
// hp / damage / xp / coins are level-1 values; every species grows by GROWTH per level.
// `poise`: for how long (s) after a hit staggers it a hit cannot stagger it again (0: every hit
// does), so heavy species and guardians strike back even under a stream of blows. A heavy blow
// (core/combat.js HEAVY_HIT) staggers anyway.
// `style`: how it fights between blows (game/enemyai.js). 'skirmish' backs off after a blow and
// circles at `circle` cells (sidestepping, facing the player, if it `strafe`s; else walking
// round), then darts in again; 'ranged' backs away inside keep[0] and sidesteps while its throw
// recovers; 'brute' (the default) holds its ground. `charge`: how much faster it runs the last
// few cells at a player it sees.
import { hash32, mulberry32 } from './util.js';

// what every species gains per level, as a share of its level-1 value: health keeps pace with
// the weapons and levels a player finds and gains on the way down, damage with the player's
// health, and the rewards grow with both (docs/balance.md)
// learn: enemies.html#kind-code, stronger.html#curve #monsters-grow (see learn/README.md)
export const GROWTH = Object.freeze({ hp: 0.17, damage: 0.1, xp: 0.25, coins: 0.25 });
// the level enemies have at a depth: one per depth (1 at the surface), and ±1 for a cube's
// species from depth 2 on
// learn: code.html#functions, stronger.html#monsters-grow (see learn/README.md)
export const depthLevel = depth => Math.max(1, Math.floor(depth || 0));
// guardians stand above their depth: side guardians one level, descent guardians two (on the
// road out of town, the very first ones, at the road's own level)
export const GUARDIAN_LEVELS = Object.freeze({ side: 1, descent: 2 });
export const guardianLevel = (depth, role) => depthLevel(depth) + (depth >= 1 ? GUARDIAN_LEVELS[role] : 0);

// learn: checks.html#try-test, code.html#objects, combat.html#damage, enemies.html#numbers, space.html#distance, stronger.html#monsters-grow (see learn/README.md)
export const SPIDER = Object.freeze({
  type: 'spider', species: 'spider', label: 'Spider', hp: 32, damage: 15, knock: 4.5,
  xp: 20, coins: Object.freeze([4, 8]),
  radius: 0.3, height: 0.9, bodyHeight: 0.45, mass: 1,
  aggro: 3, giveUp: 6, chase: 2.6, wander: 0.6, homeSpeed: 1.2,
  reach: 0.85, hitReach: 1.15, hitAt: 0.42, trackUntil: 0.42, attackTime: 1.07, cooldown: 1.2,
  arc: 0.5, knockDown: false, hop: 3.5, reason: 'Bitten by a spider!', ichor: Object.freeze(['#a6d84e', '#5f8f22']), pitch: 1.1,
  poise: 0, hitStun: 0.18, deathTime: 2, corpseTime: 3.5,
  parts: Object.freeze({ body: ['SpiderBody'], eyes: ['SpiderEyes'] }),
  style: 'skirmish', circle: 1.5, strafe: true,
  seedSalt: 0x5b1d3a, spacing: 3,
});
// learn: checks.html#try-test, combat.html#damage (see learn/README.md)
export const STUNDER = Object.freeze({
  type: 'stunder', species: 'stunder', label: 'Stunder', hp: 140, damage: 30, knock: 7,
  xp: 80, coins: Object.freeze([20, 35]),
  radius: 0.48, height: 2.8, bodyHeight: 2.15, mass: 4,
  aggro: 4.5, giveUp: 8, chase: 1.05, wander: 0.45, homeSpeed: 0.65,
  reach: 1.15, hitReach: 1.55, hitAt: 16 / 30, trackUntil: 0.3, attackTime: 1.6, cooldown: 1.6,
  arc: 0.5, knockDown: true, hop: 4, reason: 'Rammed by a Stunder!', ichor: Object.freeze(['#d0503a', '#7a2418']), pitch: 0.8,
  poise: 1.5, hitStun: 0.25, deathTime: 2.4, corpseTime: 4,
  parts: Object.freeze({ skin: ['StunderBody', 'StunderEarInset', 'StunderLegRidges', 'StunderMouth'], eyes: ['StunderEyes_glow'] }),
  style: 'brute', charge: 1.8,
  seedSalt: 0x57a4de2, spacing: 5,
});
// Slithers in with its head raised and lunges forward and down to bite (clip frame 12).
// learn: art.html#bones (see learn/README.md)
export const SNAKE = Object.freeze({
  type: 'snake', species: 'snake', label: 'Grass snake', hp: 48, damage: 16, knock: 4,
  xp: 30, coins: Object.freeze([6, 12]),
  radius: 0.3, height: 0.8, bodyHeight: 0.6, mass: 1.2,
  aggro: 3.5, giveUp: 6, chase: 2.2, wander: 0.6, homeSpeed: 1.1,
  reach: 0.95, hitReach: 1.25, hitAt: 12 / 30, trackUntil: 0.26, attackTime: 1, cooldown: 1.3,
  arc: 0.5, knockDown: false, hop: 3.5, reason: 'Bitten by a snake!', ichor: Object.freeze(['#b4e67e', '#4f8f2a']), pitch: 1.25,
  poise: 0, hitStun: 0.18, deathTime: 2, corpseTime: 3.5,
  parts: Object.freeze({ skin: ['SnakeBody', 'SnakeRibs'], eyes: ['SnakeEyes_glow'] }),
  style: 'skirmish', circle: 1.6, strafe: false,
  seedSalt: 0x5a4e7c1, spacing: 3,
});
// Slaps with both arms (clip frame 13), or spins on five legs and sweeps the sixth
// all around it (clip frame 19): a harder kick that knocks the player over.
const OCTO_SLAP = Object.freeze({
  name: 'slap', clip: 'slap', weight: 2, hitAt: 13 / 30, trackUntil: 0.3, attackTime: 1.1, hitReach: 1.35,
  arc: 0.5, power: 1, knock: 5, knockDown: false, hop: 3.5, reason: 'Slapped by an Octonaut!',
});
const OCTO_SPIN = Object.freeze({
  name: 'spin', clip: 'spin', weight: 1, hitAt: 19 / 30, trackUntil: 0.15, attackTime: 1.4, hitReach: 1.5,
  arc: -1, power: 1.4, knock: 7, knockDown: true, hop: 3.8, reason: 'Kicked by an Octonaut!',
});
export const OCTONAUT = Object.freeze({
  type: 'octonaut', species: 'octonaut', label: 'Octonaut', hp: 90, damage: 20, knock: 5,
  xp: 55, coins: Object.freeze([12, 22]),
  radius: 0.42, height: 1.7, bodyHeight: 1.2, mass: 2.5,
  aggro: 4, giveUp: 7, chase: 1.5, wander: 0.5, homeSpeed: 0.8,
  reach: 1, ...OCTO_SLAP, cooldown: 1.4, ichor: Object.freeze(['#8fd0ff', '#2f6f9f']), pitch: 0.95,
  attacks: Object.freeze([OCTO_SLAP, OCTO_SPIN]),
  poise: 0.8, hitStun: 0.22, deathTime: 2.2, corpseTime: 4,
  parts: Object.freeze({ skin: ['OctonautBody', 'OctonautHair'], eyes: ['OctonautEyes_glow'] }),
  style: 'brute',
  seedSalt: 0x0c7a9a5, spacing: 4,
});
// The fire species and the Triangle are much stronger than the rest. A ranged attack has a
// `projectile`: it is thrown from `muzzle` (model space: x, up, forward; the clip's
// extras.muzzle) at the hit frame, flies straight along the enemy's heading (pitched at
// the player) and hurts on contact. `reach` is then the distance it starts throwing from.
// `hover`: floats, its idle loop runs on time rather than on ground speed.
// Spits a fireball (clip frame 18) that sets the player on fire for half a second.
export const FIREFACE = Object.freeze({
  type: 'fireface', species: 'fireface', label: 'Fire-face', hp: 120, damage: 22, knock: 3,
  xp: 90, coins: Object.freeze([24, 40]),
  radius: 0.34, height: 1.4, bodyHeight: 1.25, mass: 1.5, hover: true,
  aggro: 6, giveUp: 9, chase: 1.3, wander: 0.5, homeSpeed: 0.8,
  reach: 4.5, hitReach: 0, hitAt: 18 / 30, trackUntil: 0.5, attackTime: 1.2, cooldown: 1.6,
  arc: 0.5, knockDown: false, hop: 3, reason: 'Scorched by a Fire-face!', ichor: Object.freeze(['#ffd25a', '#ff5a14']), pitch: 1.2,
  projectile: Object.freeze({ kind: 'fireball', speed: 6.5, radius: 0.18, range: 7,
    muzzle: Object.freeze([-0.03, 0.444, 0.523]), burn: Object.freeze({ time: 0.5, damage: 6, ticks: 2 }) }),
  poise: 0.8, hitStun: 0.2, deathTime: 2, corpseTime: 3.5,
  parts: Object.freeze({ flame: ['FireFaceCore_glow', 'FireFaceBall_glow', 'FireFaceFlame_glow', 'FireFaceTips_glow'], eyes: ['FireFaceEyes_glow'] }),
  style: 'ranged', keep: Object.freeze([2.2, 4]),
  seedSalt: 0xf12efa, spacing: 4,
});
// Shoots its inner triangles out like a punch (clip frame 20); a hit knocks the player over.
export const TRIANGLE = Object.freeze({
  type: 'triangle', species: 'triangle', label: 'Triangle', hp: 170, damage: 28, knock: 6,
  xp: 110, coins: Object.freeze([28, 46]),
  radius: 0.42, height: 1.65, bodyHeight: 1.5, mass: 3, hover: true,
  aggro: 5.5, giveUp: 9, chase: 1.1, wander: 0.5, homeSpeed: 0.7,
  reach: 4, hitReach: 0, hitAt: 20 / 30, trackUntil: 0.55, attackTime: 1.3, cooldown: 2,
  arc: 0.5, knockDown: true, hop: 3.6, reason: 'Punched by a Triangle!', ichor: Object.freeze(['#d9a6ff', '#6a2cd6']), pitch: 0.9,
  projectile: Object.freeze({ kind: 'punch', speed: 8, radius: 0.3, range: 6, spin: 14,
    muzzle: Object.freeze([-0.037, 0.699, 0.87]) }),
  poise: 1.2, hitStun: 0.22, deathTime: 2, corpseTime: 4,
  parts: Object.freeze({ glow: ['TriangleCore_glow', 'TriangleRing_glow', 'TriangleFrame_glow', 'TriangleBrows'], eyes: ['TriangleEyes_glow'] }),
  style: 'ranged', keep: Object.freeze([2, 3.6]),
  seedSalt: 0x7a1a9e1, spacing: 5,
});
// Runs in fast, then pounces from up to `reach` away: between lunge.from and lunge.to of the
// attack it is carried forward until it is lunge.stop short of the player (at most
// lunge.max), lands and bites at clip frame 20.
export const FIRECAT = Object.freeze({
  type: 'firecat', species: 'firecat', label: 'Fire-cat', hp: 130, damage: 26, knock: 5,
  xp: 95, coins: Object.freeze([22, 38]),
  radius: 0.3, height: 1, bodyHeight: 0.7, mass: 1.6,
  aggro: 6, giveUp: 10, chase: 3.4, wander: 0.6, homeSpeed: 1.2,
  reach: 2.2, hitReach: 1.05, hitAt: 20 / 30, trackUntil: 0.28, attackTime: 1.2, cooldown: 1,
  arc: 0.5, knockDown: false, hop: 3.5, reason: 'Bitten by a Fire-cat!', ichor: Object.freeze(['#ff8a2a', '#7e1a14']), pitch: 1,
  lunge: Object.freeze({ from: 0.3, to: 0.6, max: 1.9, stop: 0.55 }),
  poise: 0.4, hitStun: 0.2, deathTime: 2, corpseTime: 3.5,
  parts: Object.freeze({ fur: ['FireCatBody', 'FireCatStripes', 'FireCatNose'], flame: ['FireCatFlame_glow', 'FireCatFlameCore_glow'], eyes: ['FireCatEyes_glow'] }),
  style: 'skirmish', circle: 2, strafe: false,
  seedSalt: 0xca7f12e, spacing: 4,
});
// Fights near and far: an attack may have its own `reach` (it is picked only from within it) and
// `minReach` (only from beyond it), and its own `projectile`. Pinches with both claws (clip
// frame 13) up close; from further off it throws an ice ball (clip frame 21) that chills the
// player: `chill.slow` scales the player's speed for `chill.time` seconds. The profile's
// `reach` is the longest of its attacks'. Between throws it keeps closing in for the claws.
// One model carries both heads (blender/shraps.py); `hide` names the materials a kind does not
// show: the plain Shraps has the ice head, the Fire shraps the fire one.
const SHRAPS_PINCH = Object.freeze({
  name: 'pinch', clip: 'pinch', weight: 1, reach: 1.05, hitAt: 13 / 30, trackUntil: 0.3, attackTime: 1, hitReach: 1.4,
  arc: 0.5, power: 1, knock: 4.5, knockDown: false, hop: 3.5, reason: 'Pinched by a Shraps!',
});
const SHRAPS_THROW = Object.freeze({
  name: 'throw', clip: 'throw', weight: 1, reach: 5, minReach: 1.8, hitAt: 21 / 30, trackUntil: 0.6, attackTime: 1.3, hitReach: 0,
  arc: 0.5, power: 0.9, knock: 3, knockDown: false, hop: 3, reason: 'Hit by an ice ball!',
  projectile: Object.freeze({ kind: 'iceball', speed: 7, radius: 0.16, range: 7, spin: 9,
    muzzle: Object.freeze([0.056, 0.795, 0.937]), chill: Object.freeze({ time: 1.6, slow: 0.5 }) }),
});
const ICE_HEAD = Object.freeze(['ShrapsIce', 'ShrapsIceSpikes', 'ShrapsIceBall_glow']);
const FIRE_HEAD = Object.freeze(['ShrapsFireCore_glow', 'ShrapsFlame_glow', 'ShrapsFlameTips_glow', 'ShrapsFireBall_glow']);
export const SHRAPS = Object.freeze({
  type: 'shraps', species: 'shraps', label: 'Shraps', hp: 110, damage: 22, knock: 4.5,
  xp: 70, coins: Object.freeze([16, 28]),
  radius: 0.4, height: 1.6, bodyHeight: 1.35, mass: 2.2,
  aggro: 5, giveUp: 8, chase: 1.6, wander: 0.5, homeSpeed: 0.8,
  ...SHRAPS_PINCH, reach: SHRAPS_THROW.reach, cooldown: 1.5, ichor: Object.freeze(['#c4ecff', '#4f8fbf']), pitch: 1.05,
  attacks: Object.freeze([SHRAPS_PINCH, SHRAPS_THROW]),
  poise: 0.8, hitStun: 0.2, deathTime: 2, corpseTime: 4,
  parts: Object.freeze({ shell: ['ShrapsShell', 'ShrapsClaw'], ice: [...ICE_HEAD], eyes: ['ShrapsEyes_glow'] }),
  hide: FIRE_HEAD, style: 'brute',
  seedSalt: 0x5a7a95, spacing: 4,
});
// Rolls about on two wheels (the game spins them by the distance covered, `wheel` being their
// radius) and fights from afar with a laser. An attack's `retreat` backs it off by `dist` cells
// between `from` and `to` of the attack (eased like a lunge): before it fires it rolls
// backwards, swaying. A `beam` is a ranged attack that is not thrown: from the muzzle (the
// clip's extras.muzzle, between the eyes) it shines for `time` seconds, ending at the hit frame,
// at a point that starts on the player and follows them at `track` cells/s, and on through it
// until the level stops it (core/beams.js). Then it bursts: within `radius` of the beam the
// player is hit. Sidestepping it dodges it, and staggering the Spicy puts it out.
export const SPICY = Object.freeze({
  type: 'spicy', species: 'spicy', label: 'Spicy', hp: 100, damage: 26, knock: 4,
  xp: 72, coins: Object.freeze([16, 30]),
  radius: 0.4, height: 1.35, bodyHeight: 1.05, mass: 1.6, wheel: 0.15,
  aggro: 5.5, giveUp: 9, chase: 1.9, wander: 0.6, homeSpeed: 0.9,
  reach: 4.5, hitReach: 0, hitAt: 45 / 30, trackUntil: 0.9, attackTime: 1.9, cooldown: 1.7,
  arc: 0.5, knockDown: false, hop: 3.2, reason: 'Blasted by a Spicy!', ichor: Object.freeze(['#c6ff5a', '#4f8f12']), pitch: 1.15,
  retreat: Object.freeze({ from: 0.05, to: 0.75, dist: 0.7 }),
  beam: Object.freeze({ kind: 'laser', time: 0.6, track: 0.8, radius: 0.28, range: 8, color: '#7dff3a',
    muzzle: Object.freeze([0, 1.279, 0.06]) }),
  poise: 0.6, hitStun: 0.2, deathTime: 2, corpseTime: 4,
  parts: Object.freeze({ body: ['SpicyBody', 'SpicyClaw'], glow: ['SpicyTips_glow'], wheels: ['SpicyTire', 'SpicyHub'], eyes: ['SpicyEyes_glow'] }),
  style: 'ranged', keep: Object.freeze([2.4, 4.2]),
  seedSalt: 0x5b1c7e3, spacing: 4,
});
export const ENEMY_PROFILES = Object.freeze([SPIDER, STUNDER, SNAKE, OCTONAUT, FIREFACE, TRIANGLE, FIRECAT, SHRAPS, SPICY]);
// what a ranged attack sends out: its projectile or its beam (null for a blow)
export const shotOf = a => a.projectile ?? a.beam ?? null;

// Enemy kinds: a species' base profile with its own name, colours and strength, drawn with
// the species' model.
//   colors: role (or material name) -> recolour op, see recolorFn in core/oklch.js
//   light / sparks / ichor: the glow light, the ember and trail colours, the blood
//   mods: multiply the base. hp and damage (their growth per level follows), speed (chase,
//     wander, homing), size (model, body and melee reach), xp (xp and coins; √(hp × damage)
//     unless given, so a kind pays for its toughness without inflating XP per cube much)
// Anything else replaces the base value. A kind keeps its species' seedSalt, so where an
// enemy stands, its level and its id do not depend on which kind it drew.
const times = (v, k) => Math.round(v * k);
// `attacks` (a list like the base's) replaces the species' attacks before they are sized: a kind
// that throws something else, say.
// learn: enemies.html#kinds (see learn/README.md)
export function enemyKind(base, { mods = {}, attacks = base.attacks, ...spec }) {
  const { hp = 1, damage = 1, speed = 1, size = 1 } = mods, xp = mods.xp ?? Math.sqrt(hp * damage);
  const reach = a => a.hitReach * size;
  const thrown = p => Object.freeze({ ...p, muzzle: Object.freeze(p.muzzle.map(v => v * size)) });
  // a melee attack's own reach grows with the body; a throw's (or a beam's) stays
  const sized = a => Object.freeze({ ...a, hitReach: reach(a), ...(a.reach !== undefined && !shotOf(a) && { reach: a.reach * size }),
    ...(a.projectile && { projectile: thrown(a.projectile) }), ...(a.beam && { beam: thrown(a.beam) }) });
  const list = attacks && Object.freeze(attacks.map(sized));
  const own = list?.some(a => a.reach !== undefined);
  return Object.freeze({
    ...base,
    hp: times(base.hp, hp), damage: times(base.damage, damage),
    xp: times(base.xp, xp), coins: Object.freeze(base.coins.map(c => times(c, xp))),
    chase: base.chase * speed, wander: base.wander * speed, homeSpeed: base.homeSpeed * speed,
    size: (base.size ?? 1) * size, radius: base.radius * size, height: base.height * size, bodyHeight: base.bodyHeight * size,
    reach: own ? Math.max(...list.map(a => a.reach ?? 0)) : shotOf(base) ? base.reach : base.reach * size, hitReach: reach(base),
    ...(list && { attacks: list }),
    ...(base.projectile && { projectile: thrown(base.projectile) }),
    ...(base.beam && { beam: thrown(base.beam) }),
    ...(base.wheel && { wheel: base.wheel * size }),
    ...spec,
  });
}
// Three snakes in rising strength: green, ochre, red.
export const SAND_VIPER = enemyKind(SNAKE, {
  type: 'sandviper', label: 'Sand viper', reason: 'Bitten by a Sand viper!',
  colors: { skin: 'oklch(0.80 0.12 82)', eyes: 'oklch(0.62 0.22 28)' }, ichor: Object.freeze(['#d9c46a', '#8a6a22']),
  mods: { hp: 1.25, damage: 1.2, speed: 1.1 },
});
// learn: enemies.html#kind-code #kinds (see learn/README.md)
export const BLOOD_VIPER = enemyKind(SNAKE, {
  type: 'bloodviper', label: 'Blood viper', reason: 'Bitten by a Blood viper!',
  colors: { skin: 'oklch(0.60 0.19 27)', eyes: 'oklch(0.93 0.18 100)' }, ichor: Object.freeze(['#e0503a', '#6a1410']),
  mods: { hp: 1.4, damage: 1.4, speed: 1.2, size: 1.1 },
});
// Three more for the themes: a slow, tough one in the ice, a venomous one in the swamp and a
// near-black one, the strongest, in the ruins and the volcanic depths.
export const FROST_ADDER = enemyKind(SNAKE, {
  type: 'frostadder', label: 'Frost adder', reason: 'Bitten by a Frost adder!',
  colors: { skin: 'oklch(0.88 0.04 225)', eyes: 'oklch(0.72 0.15 250)' }, ichor: Object.freeze(['#c4ecff', '#4f8fbf']),
  mods: { hp: 1.35, damage: 1.1, speed: 0.95 },
});
export const VENOM_ADDER = enemyKind(SNAKE, {
  type: 'venomadder', label: 'Venom adder', reason: 'Bitten by a Venom adder!',
  colors: { skin: 'oklch(0.58 0.15 310)', eyes: 'oklch(0.90 0.21 125)' }, ichor: Object.freeze(['#c6ff5a', '#5a8f12']),
  mods: { hp: 1.2, damage: 1.35, speed: 1.1 },
});
export const SHADOW_MAMBA = enemyKind(SNAKE, {
  type: 'shadowmamba', label: 'Shadow mamba', reason: 'Bitten by a Shadow mamba!',
  colors: { skin: 'oklch(0.34 0.025 280)', eyes: 'oklch(0.80 0.18 55)' }, ichor: Object.freeze(['#9a6ad8', '#2a1648']),
  mods: { hp: 1.6, damage: 1.6, speed: 1.3, size: 1.15 },
});
export const FROST_SPIDER = enemyKind(SPIDER, {
  type: 'frostspider', label: 'Frost spider',
  colors: { body: 'oklch(0.82 0.035 235)', eyes: 'oklch(0.85 0.13 210)' }, ichor: Object.freeze(['#c4ecff', '#4f8fbf']),
  mods: { hp: 1.35, damage: 1.1, speed: 0.9 },
});
export const BOG_SPIDER = enemyKind(SPIDER, {
  type: 'bogspider', label: 'Bog spider',
  colors: { body: 'oklch(0.40 0.06 135)', eyes: 'oklch(0.90 0.18 105)' },
  mods: { hp: 1.15, damage: 1.25, speed: 1.05 },
});
export const REDBACK = enemyKind(SPIDER, {
  type: 'redback', label: 'Redback', reason: 'Bitten by a Redback!',
  colors: { body: 'oklch(0.34 0.11 25)', eyes: 'oklch(0.78 0.17 55)' }, ichor: Object.freeze(['#d8442e', '#5a1008']),
  mods: { hp: 1.3, damage: 1.4, speed: 1.2, size: 1.1 },
});
export const FROST_STUNDER = enemyKind(STUNDER, {
  type: 'froststunder', label: 'Frost stunder', reason: 'Rammed by a Frost stunder!',
  colors: { skin: 'oklch(0.80 0.04 235)', eyes: 'oklch(0.85 0.13 210)' }, ichor: Object.freeze(['#c4ecff', '#4f8fbf']),
  mods: { hp: 1.25, speed: 0.9 },
});
export const STONE_STUNDER = enemyKind(STUNDER, {
  type: 'stonestunder', label: 'Stone stunder', reason: 'Rammed by a Stone stunder!',
  colors: { skin: 'oklch(0.55 0.03 70)', eyes: 'oklch(0.82 0.16 85)' }, ichor: Object.freeze(['#b8a890', '#5a4a3a']),
  mods: { hp: 1.6, damage: 1.15, speed: 0.85, size: 1.12 },
});
export const MAGMA_STUNDER = enemyKind(STUNDER, {
  type: 'magmastunder', label: 'Magma stunder', reason: 'Rammed by a Magma stunder!',
  colors: { skin: 'oklch(0.30 0.09 27)', eyes: 'oklch(0.84 0.17 75)' }, ichor: Object.freeze(['#ffb030', '#a02a10']),
  mods: { hp: 1.35, damage: 1.4, speed: 1.15 },
});
export const BOG_OCTONAUT = enemyKind(OCTONAUT, {
  type: 'bogoctonaut', label: 'Bog octonaut',
  colors: { skin: 'oklch(0.74 0.10 130)', eyes: 'oklch(0.90 0.18 105)' }, ichor: Object.freeze(['#b4e67e', '#4f8f2a']),
  mods: { hp: 1.2, damage: 1.15 },
});
export const CORAL_OCTONAUT = enemyKind(OCTONAUT, {
  type: 'coraloctonaut', label: 'Coral octonaut',
  colors: { skin: 'oklch(0.74 0.13 30)', eyes: 'oklch(0.80 0.14 190)' }, ichor: Object.freeze(['#ff9a7a', '#a0402a']),
  mods: { hp: 1.3, damage: 1.35, speed: 1.2 },
});
export const EMERALD_TRIANGLE = enemyKind(TRIANGLE, {
  type: 'emeraldtriangle', label: 'Emerald triangle', reason: 'Punched by an Emerald triangle!',
  colors: { glow: 'oklch(0.80 0.20 155)', eyes: 'oklch(0.96 0.06 150)' }, light: '#40e890', sparks: Object.freeze(['#c8ffd8', '#40d080']),
  ichor: Object.freeze(['#a8ffc8', '#1e9a5a']), mods: { hp: 1.25, damage: 1.1 },
});
export const CRIMSON_TRIANGLE = enemyKind(TRIANGLE, {
  type: 'crimsontriangle', label: 'Crimson triangle', reason: 'Punched by a Crimson triangle!',
  colors: { glow: 'oklch(0.64 0.22 25)', eyes: 'oklch(0.95 0.05 60)' }, light: '#ff4836', sparks: Object.freeze(['#ffc0b0', '#ff4836']),
  ichor: Object.freeze(['#ffa08a', '#a01a10']), mods: { hp: 1.35, damage: 1.35 }, cooldown: TRIANGLE.cooldown * 0.8,
});
// The Shraps of the volcanic depths: red, with a head of fire instead of ice, and it throws
// fireballs (the Fire-face's, burn included) instead of ice balls. `fx` picks its glow in
// render/enemies.js: a light, flickering flame tongues and embers.
export const FIRE_SHRAPS = enemyKind(SHRAPS, {
  type: 'fireshraps', label: 'Fire shraps', reason: 'Pinched by a Fire shraps!',
  colors: { shell: 'oklch(0.56 0.17 32)', eyes: 'oklch(0.95 0.12 95)' }, hide: ICE_HEAD, fx: 'fireshraps',
  attacks: [{ ...SHRAPS_PINCH, reason: 'Pinched by a Fire shraps!' }, { ...SHRAPS_THROW, reason: 'Scorched by a Fire shraps!',
    projectile: Object.freeze({ ...FIREFACE.projectile, speed: 6.5, range: 7, muzzle: SHRAPS_THROW.projectile.muzzle }) }],
  ichor: Object.freeze(['#ffb030', '#a02a10']), pitch: 0.9, mods: { hp: 1.45, damage: 1.4, speed: 1.1 },
});
// One full attack and recovery, averaged over a species' attacks (s), and what it deals per
// second at level 1 (a projectile's burn included): how dangerous it is to stand next to.
export function attackCycle(profile) {
  const list = profile.attacks ?? [profile], w = list.reduce((n, a) => n + (a.weight ?? 1), 0);
  return list.reduce((n, a) => n + a.attackTime * (a.weight ?? 1), 0) / w + profile.cooldown;
}
export function attackDamage(profile) {
  const list = profile.attacks ?? [profile], w = list.reduce((n, a) => n + (a.weight ?? 1), 0);
  return list.reduce((n, a) => n + (Math.round(profile.damage * (a.power ?? 1)) + (a.projectile?.burn?.damage ?? 0)) * (a.weight ?? 1), 0) / w;
}
export const threat = profile => attackDamage(profile) / attackCycle(profile);

// Guardians are distinct kinds for every species, never part of the ordinary roster. A tier
// sets level-1 floors, so the species it promotes matters for how it fights, not for how
// strong it is: HP at least `hp` (or `hpMult` × the species'), damage per second at least
// `threat` (or `damageMult` × the species' blows), a fixed XP reward and a longer poise.
// Side guardians are a mid-route fight; descent guardians (the boss placeholders) are the
// depth's big one: tougher, deadlier, and they recover from staggers more slowly still.
// learn: enemies.html#guardians (see learn/README.md)
export const GUARDIAN_TIERS = Object.freeze({
  side: Object.freeze({ hp: 550, hpMult: 3.5, threat: 9, damageMult: 1.15, xp: 260, poise: 1.4 }),
  descent: Object.freeze({ hp: 1000, hpMult: 6.5, threat: 11.5, damageMult: 1.45, xp: 650, poise: 2 }),
});
const guardianMods = (base, t) => ({
  hp: Math.max(t.hp / base.hp, t.hpMult),
  damage: Math.max(t.damageMult, t.threat / threat(base)),
  xp: t.xp / base.xp,
});
// Hot pink (hue 350) is reserved for side guardians, amber for descent guardians; eyes remain
// pale for contrast.
export const GUARDIAN_KINDS = Object.freeze(Object.fromEntries(ENEMY_PROFILES.map(base => [base.species, enemyKind(base, {
  type: 'guardian' + base.type, label: 'Guardian ' + base.label.toLowerCase(), guardian: true, guardianRole: 'side', bossPlaceholder: false,
  colors: Object.freeze(Object.fromEntries(Object.keys(base.parts).map(role => [role,
    role === 'eyes' ? 'oklch(0.97 0.025 350)' : 'oklch(0.70 0.25 350)']))),
  light: '#ff3fa8', sparks: Object.freeze(['#ff3fa8', '#ffd0ee']), ichor: Object.freeze(['#ff3fa8', '#9b165d']),
  poise: Math.max(base.poise, GUARDIAN_TIERS.side.poise), mods: guardianMods(base, GUARDIAN_TIERS.side),
})])));
// Explicit future-boss hook: a separate kind, not a level-dependent recolouring.
export const DESCENT_GUARDIAN_KINDS = Object.freeze(Object.fromEntries(ENEMY_PROFILES.map(base => [base.species, enemyKind(base, {
  type: 'descentGuardian' + base.type, label: 'Descent guardian ' + base.label.toLowerCase(),
  guardian: true, guardianRole: 'descent', bossPlaceholder: true,
  colors: Object.freeze(Object.fromEntries(Object.keys(base.parts).map(role => [role,
    role === 'eyes' ? 'oklch(0.97 0.025 65)' : 'oklch(0.78 0.19 65)']))),
  light: '#ff9b35', sparks: Object.freeze(['#ff9b35', '#fff0cc']), ichor: Object.freeze(['#ff9b35', '#9b4b16']),
  poise: Math.max(base.poise, GUARDIAN_TIERS.descent.poise), mods: guardianMods(base, GUARDIAN_TIERS.descent),
})])));
export const ENEMY_KINDS = Object.freeze(Object.fromEntries([...ENEMY_PROFILES, ...Object.values(GUARDIAN_KINDS), ...Object.values(DESCENT_GUARDIAN_KINDS), SAND_VIPER, BLOOD_VIPER, FROST_ADDER, VENOM_ADDER, SHADOW_MAMBA, FROST_SPIDER, BOG_SPIDER,
  REDBACK, FROST_STUNDER, STONE_STUNDER, MAGMA_STUNDER, BOG_OCTONAUT, CORAL_OCTONAUT, EMERALD_TRIANGLE, CRIMSON_TRIANGLE, FIRE_SHRAPS].map(k => [k.type, k])));

// the attack e is performing (or about to perform): one of profile.attacks, else the profile
export const attackOf = e => e.profile.attacks?.[e.attack] ?? e.profile;
// the index of an attack, picked by weight among `allowed` (indices; default: all of them)
export function pickAttack(profile, r = Math.random(), allowed = null) {
  const list = profile.attacks;
  if (!list) return 0;
  const from = allowed ?? list.map((_, i) => i);
  let w = r * from.reduce((n, i) => n + list[i].weight, 0);
  for (const i of from) if ((w -= list[i].weight) < 0) return i;
  return from[from.length - 1];
}
// does the profile throw or shine anything (with any of its attacks)?
export const isRanged = profile => !!(shotOf(profile) || profile.attacks?.some(shotOf));
// which attacks (indices; [0] for a species with one) can start against a target d away
// across the floor and dy above or below: within the attack's reach (else the profile's) and
// beyond its minReach; a throw (or a beam) allows more height, a blow enough for the next step
// of a stair or a ramp. A clear line for throws is the caller's.
export function attacksInReach(profile, d, dy) {
  const list = profile.attacks ?? [profile], out = [];
  list.forEach((a, i) => {
    if (d < (a.reach ?? profile.reach) && d >= (a.minReach ?? 0) && dy < (shotOf(a) ? 1.5 : 0.75)) out.push(i);
  });
  return out;
}

// how far a retreat has backed the enemy off by attack time t
export const retreatAt = (retreat, t) => lungeAt(retreat, t) * retreat.dist;
// when an attack's shot leaves: a beam shines for its time up to the hit frame
export const fireAt = a => a.beam ? a.hitAt - a.beam.time : a.hitAt;
// how far a pouncing attack carries the enemy towards a target d away
export const lungeDistance = (lunge, d) => Math.max(0, Math.min(lunge.max, d - lunge.stop));
// the share of the lunge covered at attack time t (eased in and out)
export function lungeAt(lunge, t) {
  const u = Math.min(1, Math.max(0, (t - lunge.from) / (lunge.to - lunge.from)));
  return u * u * (3 - 2 * u);
}

// what a strike (or a projectile) does to the player
export function blowOf(profile, a = profile) {
  return { damage: Math.round(profile.damage * (a.power ?? 1)), knock: a.knock ?? profile.knock,
    knockDown: !!a.knockDown, hop: a.hop, reason: a.reason, burn: a.projectile?.burn ?? a.burn ?? null,
    chill: a.projectile?.chill ?? a.chill ?? null };
}

// a level-1 value grown to `level`
// learn: stronger.html#monsters-grow (see learn/README.md)
export const grown = (value, rate, level) => value * (1 + rate * (level - 1));
// learn: stronger.html#race (see learn/README.md)
export function enemyProfile(profile, level) {
  if (!Number.isSafeInteger(level) || level < 1) throw new RangeError('Invalid enemy level');
  return Object.freeze({ ...profile, hp: Math.round(grown(profile.hp, GROWTH.hp, level)),
    damage: Math.round(grown(profile.damage, GROWTH.damage, level)), xp: Math.round(grown(profile.xp, GROWTH.xp, level)) });
}
// the copper a kind drops at a level: [least, most]
export const coinRange = (profile, level) => profile.coins.map(c => Math.round(grown(c, GROWTH.coins, level)));
// learn: memory.html#names (see learn/README.md)
export function enemyRoll(map, profile, floorId) {
  const R = mulberry32(hash32(map.seed ^ profile.seedSalt ^ Math.imul(floorId, 7919) ^ 0x1007));
  const depth = Math.max(0, map.depth || 0), r = R();
  const level = Math.max(1, depthLevel(depth) + (depth >= 2 ? r < .25 ? -1 : r >= .75 ? 1 : 0 : 0));
  const [lo, hi] = coinRange(profile, level);
  return { id: `${map.key ?? map.seed}:${profile.species}:${floorId}`, level, coinDrop: lo + Math.floor(R() * (hi - lo + 1)) };
}
export function makeEnemy(spot, profile, i = 0) {
  profile = enemyProfile(profile, spot.level || 1);
  return {
    ...spot, level: spot.level || 1, profile, type: profile.type, hp: profile.hp, home: spot.f,
    mode: 'idle', t: 1 + i * 0.7, think: i * 0.05, speed: 0,
    path: null, lost: 0, cool: 0, attacks: 0, attack: 0, bit: false, leap: 0,
    deadT: 0, hurtT: 0, stun: 0, poised: 0, staggered: false, phase: (i * 0.37) % 1,
  };
}
