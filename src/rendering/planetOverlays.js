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
      svgs:          ['Images/moon1.svg', 'Images/moon2.svg'],
      count:         1,
      scale:         1.0,
      alpha:         0.35,
      colour:        { h: [200, 230], s: [5, 20], l: [50, 75] },
      rotation:      'random',
      strokeVisible: false,
    },
  ],

  // Uncomment and populate to add overlays for other body types:
  // rocky:     [ ... ],
  // gasGiant:  [ ... ],
  // asteroid:  [ ... ],
  // crystal:   [ ... ],
  // whiteDwarf:[ ... ],
  // star:      [ ... ],
};
