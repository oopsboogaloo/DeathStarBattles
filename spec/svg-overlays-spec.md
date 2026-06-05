# SVG Planet Overlay Spec

## Goal

Layer SVG graphics over planet/celestial body circles to enrich their visual appearance beyond flat shaded circles. SVGs are selected randomly from a pool, drawn at a random rotation, and coloured using a configurable randomised colour range. Multiple layers can be stacked on a single body.

---

## Config file

All overlay configuration lives in **`src/rendering/planetOverlays.js`** — a single file the artist can edit without touching rendering code.

Each entry in the config maps a planet type key to an array of **layer definitions**. Each layer is drawn independently on top of the body. Layers are drawn in array order (first = bottom).

```javascript
// src/rendering/planetOverlays.js

export const PLANET_OVERLAYS = {

  moon: [
    {
      svgs:          ['Images/moon1.svg'],   // pool to pick from — one is chosen at random per planet
      count:         1,                      // how many times to apply this layer (each pick is independent)
      scale:         1.0,                    // SVG size relative to planet diameter (1.0 = fills the circle exactly)
      alpha:         0.35,                   // opacity of the drawn overlay
      colour: {
        h: [200, 230],                       // hue range (degrees, 0–360)
        s: [5,   20 ],                       // saturation range (%)
        l: [50,  75 ],                       // lightness range (%)
      },
      rotation:      'random',               // 'random' (0–360°) | 'none' | fixed number (degrees)
      strokeVisible: false,                  // if false, stroke is stripped from the SVG before drawing
    },
  ],

  // Future body types added here...
  // rocky:  [ ... ],
  // gasGiant: [ ... ],
};
```

### Config fields reference

| Field | Type | Description |
|---|---|---|
| `svgs` | `string[]` | Paths to SVG files. One is chosen at random per planet instance. |
| `count` | `number` | How many times to apply this layer. Each application picks independently (can repeat the same SVG). |
| `scale` | `number` | SVG render size as a multiple of planet diameter. 1.0 fills the circle; 0.8 insets slightly; 1.2 oversizes (clipped to circle). |
| `alpha` | `number` | Opacity 0–1. Applied to the entire overlay, on top of the SVG's own colours. |
| `colour` | `object` | HSL randomisation range. Each planet gets a randomly picked colour within these bounds. |
| `colour.h` | `[min, max]` | Hue range in degrees. |
| `colour.s` | `[min, max]` | Saturation range in %. |
| `colour.l` | `[min, max]` | Lightness range in %. |
| `rotation` | `'random'` \| `'none'` \| `number` | Rotation applied to the SVG. `'random'` = uniform 0–360°. |
| `strokeVisible` | `boolean` | If false, any stroke styling in the SVG is removed before rendering. |

---

## SVG requirements

SVGs should follow these conventions to work well with the overlay system:

- **Single primary fill colour.** The renderer will replace all fill colours with the randomised colour. SVGs with multiple distinct fill colours will have all fills replaced with the same colour — design accordingly.
- **Transparent background.** No background rectangle. Paths only.
- **Square viewBox.** Use a square viewBox (e.g. `viewBox="0 0 1000 1000"`). The renderer scales to a square bounding box then clips to the planet circle.
- **Fills cover the full viewBox area.** The SVG will be drawn at `scale × diameter` centred on the planet — the planet circle clip will cut off anything outside the radius.

---

## Rendering behaviour

### When overlays are drawn

Overlays are part of the **background layer** (Layer 0) — drawn once per game at setup alongside planet rendering. They are not redrawn each frame. The planet's base shading (sphere gradient, corona, etc.) is drawn first; overlays go on top.

### Clipping

The overlay is clipped to the planet's circle. Nothing outside the planet radius is visible regardless of SVG content or scale.

### Colour substitution

The renderer fetches the SVG as text, replaces all occurrences of fill colour values with the randomised HSL colour, then creates a data URL for use as a canvas image source. If `strokeVisible` is false, stroke styling is also stripped.

The substitution targets:
- Inline style `fill:rgb(...)` or `fill:#...`
- Attribute `fill="..."` 
- Any `stroke` styling when `strokeVisible: false`

### Per-planet colour

Each planet instance gets its colour(s) picked once at scene creation time (seeded by the game's RNG so the same seed always produces the same look). The colour is fixed for the lifetime of that game.

### Rotation

Applied as a canvas rotation around the planet centre before drawing the SVG. `'random'` picks a uniform random angle 0–360°, seeded by game RNG.

### Multiple layers / count > 1

If `count > 1`, the layer is applied multiple times. Each application independently picks an SVG from the pool, picks a new colour, and picks a new rotation. This allows e.g. a foreground and background crater layer with different colour tones.

---

## Preloading

SVG files are fetched and processed once at game start (before `drawBackground` is called). The processed image objects are cached for the lifetime of the game. There is no per-frame cost.

---

## Planet type keys

| Key | Corresponds to |
|---|---|
| `moon` | `PlanetType.MOON` (small grey bodies) |
| `rocky` | Rocky planets (medium, brownish) |
| `gasGiant` | Gas giants (large, banded) |
| `star` | Stars (yellow/red/giant) |
| `blackHole` | Black holes |
| `whiteHole` | White holes |
| `asteroid` | Irregular asteroid polygons |
| `crystal` | Crystal asteroids |
| `whiteDwarf` | White dwarf |

Only keys that have entries in `PLANET_OVERLAYS` are processed. Omitting a key = no overlay for that type.

---

## Starting implementation: moons

First body type to implement. Use `Images/moon1.svg` as the initial SVG.

Suggested starting config:
```javascript
moon: [
  {
    svgs:          ['Images/moon1.svg'],
    count:         1,
    scale:         1.0,
    alpha:         0.35,
    colour: {
      h: [200, 230],
      s: [5,   20 ],
      l: [50,  75 ],
    },
    rotation:      'random',
    strokeVisible: false,
  },
],
```

Tune `alpha`, colour ranges, and `scale` until the craters look right against the base moon shading.

---

## Out of scope (v1)

- Animated overlays
- Overlays for stations or bullets
- Per-overlay blend modes (everything uses standard alpha compositing)
- SVGs with multiple distinct colours (all fills are treated as one)
- Overlays in simplified performance mode (skip overlay drawing when `performance = 'simplified'`)
