// Copyright © 2026 Chloe Bolland
// contact chloe@mammoththoughts.com if you wish to use, publish or reproduce this game or any part of it in any way

export const PlanetType = Object.freeze({
  ROCKY:            'rocky',
  ASTEROID:         'asteroid',
  CRYSTAL:          'crystal',
  STAR:             'star',
  JOVIAN:           'jovian',
  GAS_GIANT:        'gasGiant',
  WHITE_DWARF:      'whiteDwarf',
  PULSAR:           'pulsar',
  BLACK_HOLE:       'blackHole',
  WHITE_HOLE:       'whiteHole',
  WORMHOLE_PAIRED:  'wormholePaired',
  WORMHOLE_CYCLIC:  'wormholeCyclic',
  WORMHOLE_RANDOM:  'wormholeRandom',
  WORMHOLE_PLANET:  'wormholePlanet',
  WORMHOLE_SELF:    'wormholeSelf',
  WORMHOLE_NETWORK: 'wormholeNetwork', // red network — bullet exits via another red wormhole
  COMET:            'comet',           // dynamic body with reduced self-gravity
  MOON:             'moon',            // multi-hit body: 3 hits to destroy; shows cracks
  GIANT_ASTEROID:   'giantAsteroid',  // enormous multi-hit asteroid: 9 hits, 25-40 children
  // ── Unstable planets — dormant obstacles that erupt when struck (see
  //    spec/unstable-planets-spec.md). They behave gravitationally and
  //    collision-wise exactly like a ROCKY planet until a projectile hits them.
  PYRO:             'pyro',            // erupts gravity-affected fire ejecta — destroys
  CRYO:             'cryo',            // erupts gravity-affected ice ejecta — freezes
  ELECTRO:          'electro',         // erupts straight lightning — shocks
  BEAM:             'beam',            // fires a perpendicular laser beam on impact
});

// The four unstable-planet subtypes.
export const UNSTABLE_TYPES = Object.freeze([
  PlanetType.PYRO, PlanetType.CRYO, PlanetType.ELECTRO, PlanetType.BEAM,
]);
const _UNSTABLE_SET = new Set(UNSTABLE_TYPES);
export function isUnstable(type) { return _UNSTABLE_SET.has(type); }

// Under-crack glow colour per subtype (also the ejecta / beam tint).
export const UNSTABLE_GLOW = Object.freeze({
  pyro:    [255,  70,  30],   // molten red
  cryo:    [225, 240, 255],   // frost white
  electro: [ 70, 200, 255],   // charged blue-cyan
  beam:    [255, 210,  60],   // focused yellow
});

export const ShadingStyle = Object.freeze({
  NONE:      0,  // black hole — near-invisible
  ROCKY:     1,  // standard lit-side shading
  GLOWING:   2,  // star / white hole — bright core + bristle corona
  WORMHOLE:  3,  // glowing ring with dark centre
  GAS_GIANT: 4,  // horizontal stripes at 50% transparency, pass-through physics
});

// Colour pairs for gas giants [colourA, colourB]
export const GAS_GIANT_COLOUR_PAIRS = [
  [[160,  60, 220], [200,  40,  60]],  // purple / red
  [[220,  70,  40], [240, 210,  50]],  // red / yellow
  [[220,  70,  40], [ 50, 110, 230]],  // red / blue
  [[230, 215,  45], [ 50, 110, 230]],  // yellow / blue
  [[230, 215,  45], [150,  45, 215]],  // yellow / purple
  [[ 55, 100, 225], [150,  45, 215]],  // blue / purple
];

export class Planet {
  constructor({
    position,
    radius,
    density,
    type,
    colour,
    shading,
    halo          = 1.0,
    partner       = null,
    impactRadius  = null,
    mass          = null,   // overrides radius²×density for gravity (used by black/white holes and white dwarfs)
    vertices      = null,   // unit-radius polygon offsets for ASTEROID type (Vec2[])
    rotation      = 0,      // current rotation angle in radians
    rotationSpeed = 0,      // radians per rAF frame
    colourB       = null,   // secondary colour for GAS_GIANT stripes ([r,g,b] or null)
    pulsarPeriod  = 0,      // seconds between pressure pulses (PULSAR type only)
    pulsarPhase   = 0,      // current phase within period (seconds)
    supergiant    = false,  // STAR flag for supergiants — drives visual differentiation
    velocity      = null,   // Vec2 — used by COMET type for dynamic movement
    rich          = false,  // true for Rich Asteroid (blue-brown, yields crystal on break)
    pure          = false,  // true for Pure Asteroid (gold; a rare sub-type of rich)
    craterData    = null,   // [{dx,dy,r}] — crater positions relative to moon centre (MOON only)
    hitCount      = 0,      // damage level 0-2; 3rd hit destroys the moon
    crackLines    = null,   // [[Vec2[]]...] — one crack-set per hit (MOON only)
    crackSeed     = 0,      // deterministic seed for unstable-planet crack pattern
    // ── Civilised planets (see spec/civilised-planets-spec.md §1) ───────────────
    civilised     = false,  // true → inhabited body with buildings and defences
    buildings     = null,   // [{angle, kind, h, destroyed}] — decorative/destructible structures
    armour        = 0,      // planetary armour points absorbed before buildings take damage
    armourRegen   = 0,      // restore one armour point every N rounds (0 = none)
    surfaceRockets = null,  // [{angle, fired, destroyed}] — single-shot surface launch sites
  }) {
    this.position      = position;
    this.radius        = radius;
    this.density       = density;
    this.type          = type;
    this.colour        = colour;
    this.shading       = shading;
    this.halo          = halo;
    this.partner       = partner;
    this._impactRadius = impactRadius;
    this._massOverride = mass;
    this.vertices      = vertices;
    this.rotation      = rotation;
    this.rotationSpeed = rotationSpeed;
    this._rotatedVerts = null; // cached world-space vertices, updated each frame
    this.colourB       = colourB;
    this.pulsarPeriod  = pulsarPeriod;
    this.pulsarPhase   = pulsarPhase;
    this.supergiant    = supergiant;
    this.pulsarPulses  = pulsarPeriod > 0 ? [] : null; // active expanding rings
    this.velocity      = velocity;
    this.rich          = rich;
    this.pure          = pure;
    this.craterData    = craterData;
    this.hitCount      = hitCount;
    this.crackLines    = crackLines ?? [];
    this.crackSeed     = crackSeed;
    // ── Civilised planet state ──────────────────────────────────────────────────
    this.civilised     = civilised;
    this.buildings     = buildings ?? [];
    this.armour        = armour;
    this.armourMax     = armour;        // ceiling for regeneration
    this.armourRegen   = armourRegen;
    this.armourTimer   = 0;             // rounds counted toward the next regen
    this.surfaceRockets = surfaceRockets ?? [];
    this.alerted       = false;         // becomes true the first time any asset is damaged
    this.aggressors    = new Set();     // Team[] this planet has turned hostile toward
    this.firstAggressor = null;         // the Team that first provoked the planet
    this.armourFlash   = 0;             // 1→0 flash when an armour point absorbs a hit
    this.alertFlash    = 0;             // 1→0 flash when the planet first alerts
    this.faction       = null;          // lazy { team, station } used as defence-rocket owner
  }

  get mass()         { return this._massOverride ?? (this.radius * this.radius * this.density); }
  get impactRadius() { return this._impactRadius ?? this.radius; }
  get cssColour()    { return `rgb(${this.colour[0]},${this.colour[1]},${this.colour[2]})`; }
}
