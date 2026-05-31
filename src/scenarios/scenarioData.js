export const SCENARIO_COUNT = 27;

export const SCENARIO_NAMES = [
  null,            // 0 unused
  'Planetary',     // 1
  'Asteroids',     // 2
  'Star System',   // 3
  'Binary Star',   // 4
  'Jovian',        // 5
  'Super Giant',   // 6
  'Super Giant Binary', // 7
  'Uneven Binary', // 8
  'Red Giant',     // 9
  'Star Cluster',  // 10
  'Mixture',       // 11
  'White Dwarf',   // 12
  'Wormhole',      // 13
  'White Dwarfs',  // 14
  'Black Hole',    // 15
  'Black Holes',   // 16
  'Wormholes',     // 17
  'Big Wormhole',  // 18
  'White Hole',    // 19
  'White Holes',   // 20
  'Hyperspace',    // 21
  'Gas Giants',    // 22
  'Neutron Star',  // 23
  'Asteroid Ring', // 24
  'Asteroid Belt', // 25
  'Comet',         // 26
  'Oort Cloud',    // 27
];

// Weighted random scenario selection matching the original:
// <25 → common (1-5), <88 → uncommon (1-13), else → any
export function weightedRandomId(rng) {
  const choice = Math.floor(rng.next() * 100);
  if (choice < 25) return rng.nextInt(5) + 1;
  if (choice < 88) return rng.nextInt(13) + 1;
  return rng.nextInt(SCENARIO_COUNT) + 1;
}
