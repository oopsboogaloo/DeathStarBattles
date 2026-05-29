export const PlanetType = Object.freeze({
  ROCKY:           'rocky',
  ASTEROID:        'asteroid',
  STAR:            'star',
  JOVIAN:          'jovian',
  WHITE_DWARF:     'whiteDwarf',
  BLACK_HOLE:      'blackHole',
  WHITE_HOLE:      'whiteHole',
  WORMHOLE_PAIRED: 'wormholePaired',
  WORMHOLE_CYCLIC: 'wormholeCyclic',
  WORMHOLE_RANDOM: 'wormholeRandom',
  WORMHOLE_PLANET: 'wormholePlanet',
  WORMHOLE_SELF:   'wormholeSelf',
});

export const ShadingStyle = Object.freeze({
  NONE:     0,  // black hole — near-invisible
  ROCKY:    1,  // standard lit-side shading
  GLOWING:  2,  // star / white hole — bright core + bristle corona
  WORMHOLE: 3,  // glowing ring with dark centre
});

export class Planet {
  constructor({
    position,
    radius,
    density,
    type,
    colour,
    shading,
    halo         = 1.0,
    partner      = null,
    impactRadius = null,
    mass         = null,   // overrides radius²×density for gravity (used by black/white holes and white dwarfs)
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
  }

  get mass()         { return this._massOverride ?? (this.radius * this.radius * this.density); }
  get impactRadius() { return this._impactRadius ?? this.radius; }
  get cssColour()    { return `rgb(${this.colour[0]},${this.colour[1]},${this.colour[2]})`; }
}
