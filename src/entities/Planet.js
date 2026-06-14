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
  GIANT_ASTEROID:   'giantAsteroid',  // enormous multi-hit asteroid: 3 hits, 6-10 children
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
    craterData    = null,   // [{dx,dy,r}] — crater positions relative to moon centre (MOON only)
    hitCount      = 0,      // damage level 0-2; 3rd hit destroys the moon
    crackLines    = null,   // [[Vec2[]]...] — one crack-set per hit (MOON only)
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
    this.craterData    = craterData;
    this.hitCount      = hitCount;
    this.crackLines    = crackLines ?? [];
  }

  get mass()         { return this._massOverride ?? (this.radius * this.radius * this.density); }
  get impactRadius() { return this._impactRadius ?? this.radius; }
  get cssColour()    { return `rgb(${this.colour[0]},${this.colour[1]},${this.colour[2]})`; }
}
