// The rooms of the kids' guide, in the order we suggest walking through them. Like the game,
// the guide goes down one depth per room: each room borrows the look of a game depth (theme).
// index.html draws the map from this list; deck.js uses it for the "next room" portal.
export const DECKS = [
  { file: 'start.html', title: 'Welcome to Town', short: 'Start here', theme: 'meadow', depth: 0, icon: '../assets/items/item_town_portal.png',
    teaser: 'What Cube Crawler is, what it is made of, and how this guide works.' },
  { file: 'loop.html', title: 'The Heartbeat', short: 'Game loop', theme: 'meadow', depth: 1, icon: '../assets/items/item_potion_health.png',
    teaser: 'The game redraws itself 60 times a second. What happens in one tick?' },
  { file: 'random.html', title: 'Magic Numbers', short: 'Seeds & dice', theme: 'peaks', depth: 3, icon: '../assets/items/item_crystal_diamond.png',
    teaser: 'Random that is not really random: seeds, dice and bags of marbles.' },
  { file: 'world.html', title: 'Building the World', short: 'World generation', theme: 'badlands', depth: 4, icon: '../assets/items/item_crystal_amethyst.png',
    teaser: 'How a computer invents a whole world of cubes, and checks that you can finish it.' },
  { file: 'paths.html', title: 'Finding the Way', short: 'Pathfinding', theme: 'roots', depth: 5, icon: '../assets/items/item_stick_forked.png',
    teaser: 'How monsters and the generator find a way from here to there.' },
  { file: 'physics.html', title: 'Run, Jump, Fall', short: 'Physics', theme: 'frozen', depth: 7, icon: '../assets/items/item_potion_stamina.png',
    teaser: 'Gravity, jumping, sliding along walls, and floppy ragdolls.' },
  { file: 'combat.html', title: 'Swords & Fighting', short: 'Combat', theme: 'swamp', depth: 9, icon: '../assets/items/weapon_sword_long.png',
    teaser: 'How a swing works, how the game knows you hit, and why hits feel good.' },
  { file: 'enemies.html', title: 'Monster Brains', short: 'Enemy AI', theme: 'nests', depth: 11, icon: '../assets/items/item_crystal_ruby.png',
    teaser: 'Monsters that wander, notice you, chase you and give up.' },
  { file: 'loot.html', title: 'Treasure & Weapons', short: 'Loot', theme: 'mines', depth: 13, icon: '../assets/items/treasure_chest.png',
    teaser: 'Rarities, affixes and funny names: a machine that makes swords.' },
  { file: 'drawing.html', title: 'Drawing the World', short: 'Rendering', theme: 'ruins', depth: 15, icon: '../assets/items/item_crystal_sapphire.png',
    teaser: 'Triangles, cameras, lights, and cutting holes in roofs so you can see.' },
  { file: 'sound.html', title: 'Sounds & Music', short: 'Audio', theme: 'volcanic', depth: 17, icon: '../assets/items/item_coin_gold.png',
    teaser: 'Every sound is made from math. Music that changes with danger.' },
  { file: 'art.html', title: 'Making Monsters', short: 'Art & models', theme: 'abyss', depth: 19, icon: '../assets/items/item_crystal_emerald.png',
    teaser: 'Models built by code in Blender, from blobs of digital clay.' },
  { file: 'agents.html', title: 'Building with AI Helpers', short: 'Prompting', theme: 'core', depth: 20, icon: '../assets/items/item_potion_mana.png',
    teaser: 'How to ask a coding agent to change the game, and check its work.' },
];

// what the three detail levels are called (slides carry data-lv="1|2|3")
export const LEVELS = [
  null,
  { name: 'Big idea', short: 'Lv 1', color: '#61dc6b' },
  { name: 'How it works', short: 'Lv 2', color: '#51a9ff' },
  { name: 'Real code', short: 'Lv 3', color: '#fd9f07' },
];

// the game depth each theme name stands for (shown in the top bar)
export const THEME_NAMES = {
  meadow: 'Meadow islands', peaks: 'Snowy peaks', badlands: 'Badlands', roots: 'Root caves', frozen: 'Frozen caves',
  swamp: 'Fungal swamp', nests: 'Spider nests', mines: 'Crystal mines', ruins: 'Buried ruins', volcanic: 'Volcanic depths',
  abyss: 'Obsidian abyss', core: 'The core',
};
