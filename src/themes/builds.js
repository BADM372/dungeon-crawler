// What structures are made of at each theme (keyed by the theme's prop set): the stone and wood
// of stairs, landings, bridges, fences and ladders, the rope of rope bridges, the iron of iron
// bridges, and how often each bridge style is picked. Stone arches only where there is ground
// close below; the others go anywhere.
export const BUILDS = {
  meadow: { stone: '#cfc5b2', wood: '#a0703f', rope: '#cdb88e', iron: '#5a5c64', bridges: { stone: 1, plank: 1, rope: 2 } },
  peaks: { stone: '#b8bcc2', wood: '#6e5236', rope: '#d8d0c0', iron: '#5a5c64', bridges: { stone: 2, rope: 2, plank: 1 } },
  badlands: { stone: '#c9a070', wood: '#8a6a48', rope: '#c8a878', iron: '#5a5c64', bridges: { plank: 2, stone: 1, rope: 1 } },
  roots: { stone: '#8a7a66', wood: '#5e4630', rope: '#a89070', iron: '#4a4c54', bridges: { plank: 2, stone: 1, rope: 1 } },
  frozen: { stone: '#a8c0cc', wood: '#7a8a96', rope: '#d0dce4', iron: '#5a6470', bridges: { stone: 2, plank: 1 } },
  swamp: { stone: '#6e7a5a', wood: '#5a5a36', rope: '#8a8a5a', iron: '#4a4c44', bridges: { plank: 2, rope: 2 } },
  nests: { stone: '#8a8490', wood: '#4e4448', rope: '#e8e4ea', iron: '#4a4650', bridges: { rope: 3, plank: 1 } },
  mines: { stone: '#7a7a86', wood: '#8a6a44', rope: '#b0a080', iron: '#5a5c64', bridges: { plank: 2, iron: 2, stone: 1 } },
  ruins: { stone: '#c8b48a', wood: '#7a6040', rope: '#b8a070', iron: '#5a5048', bridges: { stone: 3, plank: 1 } },
  volcanic: { stone: '#4a4040', wood: '#3a2c24', rope: '#7a6a5a', iron: '#3c3a3e', bridges: { iron: 3, stone: 1 } },
  abyss: { stone: '#3a3644', wood: '#2a2430', rope: '#5a5060', iron: '#2e2c34', bridges: { iron: 2, stone: 2 } },
};

export const buildOf = theme => BUILDS[theme.props] || BUILDS.meadow;
