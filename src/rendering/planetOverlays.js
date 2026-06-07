// ─── Planet SVG Overlay Config ────────────────────────────────────────────────
//
// Each key is a PlanetType value. The value is an array of layer definitions —
// layers are drawn in order (first = bottom). Edit this file to tune visuals.
//
// Layer fields:
//   svgs          string[]   Pool of SVG paths. One picked at random per planet.
//   count         number     How many times to apply this layer (each independent).
//   scale         number     SVG size relative to planet diameter. 1.0 = fills circle.
//   alpha         number     Opacity 0–1.
//   colour        object     HSL randomisation range for the SVG fill colour.
//     h           [min,max]  Hue degrees.
//     s           [min,max]  Saturation %.
//     l           [min,max]  Lightness %.
//   rotation      'random' | 'none' | number   Rotation applied before drawing.
//   strokeVisible boolean    If false, stroke is stripped from the SVG.

export const PLANET_OVERLAYS = {

  moon: [
    {
      svgs:          ['Images/moon1.svg', 'Images/moon2.svg', 'Images/moon3.svg', 'Images/moon4.svg', 'Images/moon5.svg', 'Images/moon6.svg'],
      count:         1,
      scale:         1.0,
      alpha:         0.35,
      colour:        { h: [200, 230], s: [5, 20], l: [50, 75] },
      rotation:      'random',
      strokeVisible: false,
    },
  ],

  gasGiant: [
    {
      svgs:          ['Images/gas1.svg', 'Images/gas2.svg', 'Images/gas3.svg', 'Images/gas4.svg', 'Images/gas5.svg'],
      count:         1,
      scale:         1.0,
      alpha:         0.45,
      colour:        'planetB',  // use the planet's colourB (band colour) for SVG marks
      rotation:      'random',
      strokeVisible: false,
    },
  ],

  rocky: [
    {
      svgs: [
        'Images/planet1.svg',  'Images/planet2.svg',  'Images/planet3.svg',
        'Images/planet4.svg',  'Images/planet5.svg',  'Images/planet6.svg',
        'Images/planet7.svg',  'Images/planet8.svg',  'Images/planet9.svg',
        'Images/planet10.svg', 'Images/planet12.svg', 'Images/planet13.svg',
        'Images/planet14.svg', 'Images/planet15.svg',
      ],
      countRange:    [1, 3],
      scale:         1.0,
      alpha:         1.0,
      colour: [
        [190, 130,  90],  // adobe
        [215, 190, 150],  // sandstone
        [155,  85,  65],  // burnt sienna
        [200, 155, 100],  // warm clay
        [175, 120,  80],  // terracotta
        [210, 175, 130],  // pale sand
        [160,  95,  70],  // rust
        [220, 200, 165],  // light ochre
      ],
      rotation:      'random',
      strokeVisible: false,
    },
  ],
  // asteroid:  [ ... ],
  // crystal:   [ ... ],
  // whiteDwarf:[ ... ],
  // star:      [ ... ],
};
