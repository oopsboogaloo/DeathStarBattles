// Copyright © 2026 Chloe Bolland
// contact chloe@mammoththoughts.com if you wish to use, publish or reproduce this game or any part of it in any way

export const WeaponId = Object.freeze({
  CANNON:             'cannon',
  HYPERSPACE:         'hyperspace',
  TRIPLE_CANNON:      'tripleCannon',
  BLUNDERBUSS:        'blunderbuss',
  LASER:              'laser',
  ROCKET:             'rocket',
  ROCKET_POD:         'rocketPod',
  BLASTER:            'blaster',
  MINIGUN:            'minigun',
  FORCE_SHIELD:       'forceShield',
  SEPTUPLE_CANNON:    'septupleCannon',
  ANTIMATTER_LASER:   'antimatterLaser',
  FRAGMENTATION_SHOT: 'fragmentationShot',
  SHOTGUN:            'shotgun',
  DUAL_BLASTER:       'dualBlaster',
  BOUNCE_CANNON:      'bounceCannon',
  AUTO_CANNON:        'autoCannon',
  STAR_SHOT:          'starShot',
  SCATTER_CANNON:     'scatterCannon',
  SPIRAL:             'spiral',
  RESUPPLY:           'resupply',
  HEDGEHOG:           'hedgehog',
  TEAM_SHIELD:        'teamShield',
  ARMOUR:             'armour',
  REPULSOR_FIELD:     'repulsorField',
  MAMMOTH_CANNON:     'mammothCannon',
  QUANTUM_TORPEDO:        'quantumTorpedo',
  TRIPLE_QUANTUM_TORPEDO: 'tripleQuantumTorpedo',
  QUANTUM_AUTO_CANNON:    'quantumAutoCannon',
  GRAVITY_CANNON:         'gravityCannon',
  ELECTRO_STUN:             'electroStun',
  TELEPORT:                 'teleport',
  SUPER_LASER:              'superLaser',
  REINFORCEMENT_SIGNAL:     'reinforcementSignal',
  MIND_CONTROL_BEAM:        'mindControlBeam',
  // ── New weapons (new-weapons-spec.md) ──────────────────────────────────────
  ICE_ROCKET:               'iceRocket',
  ICE_BLAST:                'iceBlast',
  TRIPLE_BOUNCE_CANNON:     'tripleBounceCannon',
  SURPRISE:                 'surprise',
  ICE_BOMB:                 'iceBomb',
  QUANTUM_BEAM:             'quantumBeam',
  BOUNCE_AUTOCANNON:        'bounceAutocannon',
  BIRTHDAY_PRESENT:         'birthdayPresent',
  FREEZE_RAY:               'freezeRay',
  THRUST_BOOSTER:           'thrustBooster',
  TEAM_ARMOUR:              'teamArmour',
  SHOCK_ROCKET:             'shockRocket',
  SHOCK_BEAM:               'shockBeam',
  SUIT_UP:                  'suitUp',
  AAARRRGGHH:               'aaarrrgghh',
});

// Weapon grant table — one entry per special weapon, used when a collectable is collected.
// tier: 1 = Common (80%), 2 = Uncommon (16%), 3 = Rare (4%)
export const WEAPON_GRANTS = [
  // ── Tier 1 — Common ───────────────────────────────────────────────────────
  { id: WeaponId.TRIPLE_CANNON,      charges: 3, label: 'TRIPLE CANNON',   tier: 1 },
  { id: WeaponId.BLUNDERBUSS,        charges: 2, label: 'BLUNDERBUSS',     tier: 1 },
  { id: WeaponId.ROCKET,             charges: 1, label: 'ROCKET',          tier: 1 },
  { id: WeaponId.BLASTER,            charges: 3, label: 'BLASTER',         tier: 1 },
  { id: WeaponId.FORCE_SHIELD,       charges: 2, label: 'FORCE SHIELD',    tier: 1 },
  { id: WeaponId.BOUNCE_CANNON,      charges: 4, label: 'BOUNCE CANNON',   tier: 1 },
  { id: WeaponId.SCATTER_CANNON,     charges: 2, label: 'SCATTER CANNON',  tier: 1 },
  { id: WeaponId.RESUPPLY,           charges: 1, label: 'RESUPPLY',        tier: 1 },
  { id: WeaponId.QUANTUM_TORPEDO,    charges: 3, label: 'QUANTUM TORPEDO', tier: 1 },
  // ── Tier 2 — Uncommon ─────────────────────────────────────────────────────
  { id: WeaponId.LASER,              charges: 1, label: 'LASER',           tier: 2 },
  { id: WeaponId.ROCKET_POD,         charges: 1, label: 'ROCKET POD',      tier: 2 },
  { id: WeaponId.MINIGUN,            charges: 1, label: 'MINIGUN',         tier: 2 },
  { id: WeaponId.SEPTUPLE_CANNON,    charges: 2, label: 'SEPT. CANNON',    tier: 2 },
  { id: WeaponId.FRAGMENTATION_SHOT, charges: 2, label: 'FRAG SHOT',       tier: 2 },
  { id: WeaponId.SHOTGUN,            charges: 2, label: 'SHOTGUN',         tier: 2 },
  { id: WeaponId.DUAL_BLASTER,       charges: 3, label: 'DUAL BLASTER',    tier: 2 },
  { id: WeaponId.STAR_SHOT,          charges: 1, label: 'STAR SHOT',       tier: 2 },
  { id: WeaponId.SPIRAL,             charges: 1, label: 'SPIRAL',          tier: 2 },
  { id: WeaponId.TEAM_SHIELD,        charges: 1, label: 'TEAM SHIELD',     tier: 2 },
  { id: WeaponId.ARMOUR,             charges: 1, label: 'ARMOUR',          tier: 2 },
  { id: WeaponId.REPULSOR_FIELD,     charges: 2, label: 'REPULSOR FIELD',  tier: 2 },
  { id: WeaponId.TELEPORT,           charges: 3, label: 'TELEPORT',        tier: 2 },
  { id: WeaponId.AUTO_CANNON,        charges: 2, label: 'AUTO CANNON',     tier: 2 },
  { id: WeaponId.TRIPLE_QUANTUM_TORPEDO, charges: 3, label: 'TRIPLE Q. TORP.', tier: 2 },
  // ── Tier 3 — Rare ─────────────────────────────────────────────────────────
  { id: WeaponId.ANTIMATTER_LASER,      charges: 1, label: 'ANTIMATTER LASER', tier: 3 },
  { id: WeaponId.MAMMOTH_CANNON,        charges: 1, label: 'MAMMOTH CANNON',   tier: 3 },
  { id: WeaponId.QUANTUM_AUTO_CANNON,   charges: 1, label: 'QUANTUM AUTO-C.',  tier: 3 },
  { id: WeaponId.GRAVITY_CANNON,        charges: 1, label: 'GRAVITY CANNON',   tier: 3 },
  { id: WeaponId.SUPER_LASER,           charges: 1, label: 'SUPER LASER',      tier: 3 },
  { id: WeaponId.REINFORCEMENT_SIGNAL,  charges: 1, label: 'REINF. SIGNAL',    tier: 3 },
  { id: WeaponId.MIND_CONTROL_BEAM,     charges: 1, label: 'MIND CONTROL',     tier: 3 },
  { id: WeaponId.HEDGEHOG,              charges: 1, label: 'HEDGEHOG',         tier: 3 },
  // ── New weapons (new-weapons-spec.md) ──────────────────────────────────────
  // Tier 1
  { id: WeaponId.ICE_ROCKET,            charges: 2, label: 'ICE ROCKET',      tier: 1 },
  { id: WeaponId.THRUST_BOOSTER,        charges: 2, label: 'THRUST BOOSTER',  tier: 1, needsMovement: true },
  // Tier 2
  { id: WeaponId.ICE_BLAST,             charges: 1, label: 'ICE BLAST',           tier: 2 },
  { id: WeaponId.TRIPLE_BOUNCE_CANNON,  charges: 1, label: 'TRIPLE BOUNCE',       tier: 2 },
  { id: WeaponId.SHOCK_ROCKET,          charges: 2, label: 'SHOCK ROCKET',        tier: 2 },
  { id: WeaponId.SHOCK_BEAM,            charges: 1, label: 'SHOCK BEAM',          tier: 2 },
  // Tier 3
  { id: WeaponId.SURPRISE,              charges: 3, label: 'SURPRISE',            tier: 3 },
  { id: WeaponId.ICE_BOMB,              charges: 1, label: 'ICE BOMB',            tier: 3 },
  { id: WeaponId.QUANTUM_BEAM,          charges: 3, label: 'QUANTUM BEAM',        tier: 3 },
  { id: WeaponId.BOUNCE_AUTOCANNON,     charges: 1, label: 'BOUNCE AUTOCANNON',   tier: 3 },
  { id: WeaponId.BIRTHDAY_PRESENT,      charges: 1, label: 'BIRTHDAY PRESENT',    tier: 3 },
  { id: WeaponId.FREEZE_RAY,            charges: 2, label: 'FREEZE RAY',          tier: 3 },
  { id: WeaponId.TEAM_ARMOUR,           charges: 1, label: 'TEAM ARMOUR',         tier: 3 },
  { id: WeaponId.SUIT_UP,               charges: 1, label: 'SUIT UP',             tier: 3 },
  { id: WeaponId.AAARRRGGHH,            charges: 1, label: 'AAARRRGGHH',          tier: 3 },
];

// Game-unit radius for collision and rendering.
// Note: collectables are visually crystal-shaped gems; "crystal" is reserved as a
// separate future entity name. In code they are called Collectable throughout.
export const COLLECTABLE_RADIUS = 5;

export class Collectable {
  constructor(position) {
    this.position = position;  // Vec2
    this.rotation = 0;         // radians — advanced by Renderer each frame
    this.alive    = true;
    this.radius   = COLLECTABLE_RADIUS;
  }
}
