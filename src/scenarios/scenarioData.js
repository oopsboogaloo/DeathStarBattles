export const SCENARIO_COUNT = 28;

export const SCENARIO_NAMES = [
  null,                 // 0 unused
  'Planetary',          // 1
  'Asteroids',          // 2
  'Crystal Asteroids',  // 3
  'Star System',        // 4
  'Binary Star',        // 5
  'Jovian',             // 6
  'Super Giant',        // 7
  'Super Giant Binary', // 8
  'Uneven Binary',      // 9
  'Red Giant',          // 10
  'Star Cluster',       // 11
  'Gas Giants',         // 12
  'Mixture',            // 13
  'White Dwarf',        // 14
  'Comet',              // 15
  'Asteroid Ring',      // 16
  'Asteroid Belt',      // 17
  'Oort Cloud',         // 18
  'Wormhole',           // 19
  'Wormholes',          // 20
  'White Dwarfs',       // 21
  'Black Hole',         // 22
  'Neutron Star',       // 23
  'White Hole',         // 24
  'White Holes',        // 25
  'Hyperspace',         // 26
  'Black Holes',        // 27
  'Big Wormhole',       // 28
];

// Scenarios valid for Target Practice mode
// Planetary(1), Asteroids(2), Crystal Asteroids(3), Star System(4), Jovian(6), Wormhole(19)
export const TARGET_PRACTICE_SCENARIOS = [1, 2, 3, 4, 6, 19];

// Weighted random scenario selection matching the original:
// <25 → common (1-5), <88 → uncommon (1-13), else → any
export function weightedRandomId(rng) {
  const choice = Math.floor(rng.next() * 100);
  if (choice < 25) return rng.nextInt(6) + 1;
  if (choice < 88) return rng.nextInt(19) + 1;
  return rng.nextInt(SCENARIO_COUNT) + 1;
}
