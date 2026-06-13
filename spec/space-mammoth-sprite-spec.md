# Space Mammoth Sprite Rendering — Specification

> Covers the theme rebrand from Death Star to Space Mammoth, the SVG-to-sprite build pipeline, the runtime canvas renderer, team colour theming, and the keyframe animation system.
>
> **The sprite system is object-agnostic.** The pipeline, module format, and renderer carry no station-specific assumptions: any game entity (ship, drone, projectile, pickup) can be rendered from a sprite module. The space mammoth saucer is the flagship use, not a special case.
>
> **Rollout**: the first integration is ship rendering via a simple `ufo` sprite, enabled **only when the performance mode is exactly `'experimental'`** (not `full`). All other modes keep the procedural Death Star renderer until the sprite system is proven on iPad.

---

## 1. Overview

Station visuals are replaced with **space mammoths piloting flying saucers**. Rather than bitmap images (which hurt performance on iPad), all station art is rendered from vector primitives using the Canvas 2D API. The artwork is authored once as SVG files, converted at build time into a lightweight JS sprite module, and drawn at runtime using pre-parsed `Path2D` objects and direct canvas calls.

The goals are:

- Correct performance on iPad (Safari / WKWebView / Metal) at 60fps
- Artist-controlled shapes, not fully procedural geometry
- Per-team colour variation without duplicating artwork
- Smooth keyframe animation including path morphing where needed

---

## 2. Artistic Direction

### 2.1 Space Mammoth Character

A stylised mammoth visible through the glass dome of the saucer, interpreted as a cockpit pilot:

- **Head and body** — rounded forms, readable at small sizes (down to ~15px diameter)
- **Tusks** — two curved bezier strokes, one of the most expressive features; tusk angle can convey mood (relaxed vs alarmed)
- **Trunk** — a single bezier curve; animated by wiggling its control points or rotating the trunk layer at its root
- **Ears** — two arcs flanking the head; can flap via layer rotation
- **Eyes** — small filled circles; minimal but needed for readability

### 2.2 Flying Saucer

The saucer is the station body and the most arc-native shape in the game:

- **Disc / hull** — wide, flat arc (bottom half of ellipse)
- **Dome** — taller arc on top of the disc; the glass canopy through which the mammoth is visible. The mammoth is clipped to the dome arc.
- **Porthole ring** — row of small filled arcs around the disc rim
- **Engine glow** — radial gradient or simple filled ellipse underneath the disc; team-coloured
- **Rim trim** — stroke arc in team secondary colour

### 2.3 Size Rendering

The same sprite is used at all station sizes; the canvas `scale` transform handles size. At the smallest sizes (Micro / Tiny, radius < 8px) the mammoth detail inside the dome is omitted — only the saucer disc, dome silhouette, and porthole ring are drawn.

---

## 3. SVG Authoring Requirements

### 3.1 Tool

Any SVG editor (Inkscape, Illustrator, Figma). The output must be a plain `.svg` file with no embedded scripts or CSS animation that relies on the DOM.

### 3.2 Layer naming convention

Each animated or independently-coloured element must be a separate `<g>` or `<path>` element with a descriptive `id`:

| id pattern | Purpose |
|---|---|
| `saucer-disc` | Main hull shape |
| `saucer-dome` | Glass dome |
| `saucer-rim` | Decorative trim ring |
| `saucer-ports` | All porthole arcs (can be a group) |
| `engine-glow` | Glow/exhaust under disc |
| `mammoth-body` | Body silhouette |
| `mammoth-head` | Head shape |
| `mammoth-tusk-left` | Left tusk |
| `mammoth-tusk-right` | Right tusk |
| `mammoth-trunk` | Trunk curve |
| `mammoth-ear-left` | Left ear |
| `mammoth-ear-right` | Right ear |
| `mammoth-eye-left` | Left eye |
| `mammoth-eye-right` | Right eye |

### 3.3 Team colour placeholder convention

Fills that should be replaced by the team's colours at runtime must use **magic placeholder values**:

| Placeholder fill | Resolved to |
|---|---|
| `#ff0000` (pure red) | `team.colors.primary` |
| `#0000ff` (pure blue) | `team.colors.secondary` |
| `#400000` | `team.colors.shade1` (darkest of the team ramp) |
| `#800000` | `team.colors.shade2` |
| `#cc0000` | `team.colors.shade3` (team base tone) |
| `#ff6666` | `team.colors.shade4` (lightest of the team ramp) |

The `shade1`–`shade4` placeholders are a **dark→light tonal ramp** derived from the team colour (§6), so a single artwork can carry an interesting range of team-coloured tones across its sections (e.g. saucer hull → body → dome) while staying recognisably one team.

All other fills are treated as fixed colours and passed through unchanged. This means the artist can use any colour outside the placeholder set for fixed elements (mine hazard rings, saucer hull silver, mammoth brown, etc.).

Fills may be authored either as a `fill="…"` attribute or inside a `style="fill:…"` declaration (Inkscape's default). When each colour is placed on its own Inkscape layer (a `<g inkscape:groupmode="layer">`), the build combines that layer's shapes into one sprite layer and inherits the fill from the layer's first child shape.

### 3.4 Path morphing requirements

For layers that are keyframe-morphed (not just transformed):

- Every keyframe of the path must contain **the same number of path commands** in the same order
- All path commands must be the same type — convert everything to cubic bezier curves (`C`) before export (Inkscape: Path → Object to Path → Extensions → Modify Path → Flatten Beziers is a workflow; Illustrator and Figma have equivalent)
- The first node of each keyframe must be topologically equivalent (same structural point on the shape) — misaligned start nodes produce crossing interpolation artefacts

Morphing is opt-in per layer. Only layers that genuinely change silhouette (e.g. ear flap, tusk raise) need morph keyframes. Wiggling motions (trunk swing, body bob) are cheaper as transform animations on rigid paths.

### 3.5 Keyframe annotation

**Transform keyframes** are authored as a `data-keyframes` attribute on the element — a JSON array of `{t, tx, ty, rot, scale, opacity}` objects (all fields except `t` optional):

```xml
<ellipse id="engine-glow" cx="100" cy="122" rx="54" ry="12" fill="#ff0000"
         data-keyframes='[{"t":0,"scale":0.9,"opacity":0.6},{"t":0.5,"scale":1.15,"opacity":1},{"t":1,"scale":0.9,"opacity":0.6}]'/>
```

**Morph keyframes** are provided as named `<g>` groups within the same file using the convention `<g id="trunk-kf1" data-t="0.3">`, each containing one `<path>`. The layer's own path is keyframe 0 unless an explicit `-kf0` group exists. The build script resolves these by id prefix.

**Other per-layer annotations**:

| Attribute | Purpose |
|---|---|
| `data-min-radius` | Layer is skipped when on-screen radius (px) is below this — generic detail LOD |
| `data-duration` (on `<svg>`) | ms for one full animation loop (default 2400) |
| `id="<name>-clip"` + `data-clip-layers="a b c"` | Element becomes the sprite clip path; listed layers are clipped to it |

---

## 4. Build-Time Conversion Pipeline

### 4.1 Overview

```
assets/sprites/
  ufo.svg                     ← simple example sprite (current ship art)
  mammoth-saucer.svg          ← master artwork (and keyframe groups)

      ↓  node scripts/build-sprites.mjs        (converts every .svg in assets/sprites/)

src/rendering/sprites/
  ufo.sprite.js               ← generated; checked into repo
  mammoth-saucer.sprite.js    ← generated; checked into repo
```

The script runs once after artwork changes and processes **all** SVGs in `assets/sprites/` — adding a new sprite requires no script changes. The output JS files are committed alongside the source SVGs. Nothing is regenerated at game runtime.

### 4.2 Output module format

```js
// mammoth-saucer.sprite.js  (generated — do not edit by hand)
export const mammothSaucer = {
  duration: 2400,       // ms for one full animation loop
  viewBox: [0, 0, 200, 200],   // original SVG coordinate space

  layers: [
    {
      id: "saucer-disc",
      path: "M 20 100 a 80 25 0 1 0 160 0 a 80 25 0 1 0 -160 0",
      fill: "#c0c0c0",          // fixed colour
      keyframes: [
        { t: 0.0, tx: 0, ty:  0, rot: 0, scale: 1 },
        { t: 0.5, tx: 0, ty: -3, rot: 0, scale: 1 },
        { t: 1.0, tx: 0, ty:  0, rot: 0, scale: 1 },
      ]
    },
    {
      id: "mammoth-trunk",
      path: "M 105 90 C 95 105 100 120 108 132",   // keyframe 0 path
      fill: "#7a5c2e",
      morphKeyframes: [
        {
          t: 0.0,
          commands: [
            { cmd: "M", x: 105, y:  90 },
            { cmd: "C", x1:  95, y1: 105, x2: 100, y2: 120, x: 108, y: 132 },
          ]
        },
        {
          t: 0.3,
          commands: [
            { cmd: "M", x: 105, y:  90 },
            { cmd: "C", x1:  85, y1: 100, x2:  90, y2: 118, x:  98, y: 135 },
          ]
        },
        {
          t: 0.7,
          commands: [
            { cmd: "M", x: 105, y:  90 },
            { cmd: "C", x1: 112, y1: 108, x2: 116, y2: 122, x: 110, y: 136 },
          ]
        },
        {
          t: 1.0,
          commands: [
            { cmd: "M", x: 105, y:  90 },
            { cmd: "C", x1:  95, y1: 105, x2: 100, y2: 120, x: 108, y: 132 },
          ]
        },
      ]
    },
    {
      id: "engine-glow",
      fill: "team.primary",      // resolved at render time to team colour
      path: "M 60 108 a 40 10 0 1 0 80 0 a 40 10 0 1 0 -80 0",
      keyframes: [
        { t: 0.0, tx: 0, ty: 0, rot: 0, scale: 0.9, opacity: 0.7 },
        { t: 0.5, tx: 0, ty: 0, rot: 0, scale: 1.1, opacity: 1.0 },
        { t: 1.0, tx: 0, ty: 0, rot: 0, scale: 0.9, opacity: 0.7 },
      ]
    },
  ],

  // generic clip support — for the saucer this is the dome arc clipping the mammoth
  clipPath: "M 60 95 a 40 40 0 1 1 80 0",
  clippedLayers: ["mammoth-body", "mammoth-head", "mammoth-trunk",
                  "mammoth-tusk-left", "mammoth-tusk-right",
                  "mammoth-ear-left", "mammoth-ear-right",
                  "mammoth-eye-left", "mammoth-eye-right"],
};
```

A layer has either `keyframes` (transform animation, rigid path) or `morphKeyframes` (path morph per keyframe), never both. Optional per-layer fields:

- `minRadius` — layer skipped when on-screen radius (px) is below this (detail LOD, §8)
- `pivot: [x, y]` — centre for `rot`/`scale` keyframes; emitted automatically for circles/ellipses, defaults to the viewBox centre otherwise

### 4.3 Build script responsibilities

1. Parse the SVG XML
2. For each element with an id: extract the `d` attribute (or synthesise it for `<circle>` / `<ellipse>`; a `<g>` of shapes becomes one combined path). Document order = paint order.
3. Detect team colour placeholders in `fill` attributes; replace with `"team.primary"` / `"team.secondary"`
4. Extract transform keyframes from `data-keyframes` JSON attributes; morph keyframes from `-kfN` named groups
5. For morph layers: parse each keyframe path into the command array format above; validate same command count and types across keyframes (error on mismatch)
6. Emit the JS module — one per input SVG, named `<file>.sprite.js` exporting `<fileCamelCase>Sprite`

---

## 5. Runtime Renderer

### 5.1 Startup — Path2D initialisation

When the game starts (once), for each sprite in use:

```js
for (const layer of sprite.layers) {
  if (layer.path) {
    layer._path = new Path2D(layer.path);
  }
  // morphKeyframes have no _path; they are drawn via ctx commands directly
}
```

`Path2D` objects are reused every frame. No string parsing or object allocation occurs in the draw loop.

### 5.2 Per-frame draw — single sprite instance

`drawSprite()` is entity-agnostic: callers pass position, on-screen radius, team colours, and the global animation phase. Implemented in `src/rendering/sprites/SpriteRenderer.js`.

```js
function drawSprite(ctx, sprite, x, y, screenRadius, teamColors, animPhase) {
  // animPhase: 0–1 within sprite.duration, advanced each frame

  const scale = screenRadius / (sprite.viewBox[2] / 2);

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.translate(-sprite.viewBox[2] / 2, -sprite.viewBox[3] / 2);

  for (const layer of sprite.layers) {
    if (layer.minRadius !== undefined && screenRadius < layer.minRadius) continue;

    const clipped = sprite._clippedSet.has(layer.id);  // Set built at startup
    if (clipped) ctx.save(), ctx.clip(sprite._clipPath);

    if (layer.morphKeyframes) {
      _drawMorphLayer(ctx, layer, animPhase, teamColors);
    } else {
      _drawTransformLayer(ctx, layer, animPhase, teamColors);
    }

    if (clipped) ctx.restore();
  }

  ctx.restore();
}
```

### 5.3 Transform layer draw

```js
function _drawTransformLayer(ctx, layer, phase, teamColors) {
  const kf = _interpolateKeyframes(layer.keyframes, phase);

  ctx.save();
  ctx.translate(kf.tx ?? 0, kf.ty ?? 0);
  ctx.rotate((kf.rot ?? 0) * Math.PI / 180);
  if (kf.scale != null && kf.scale !== 1) ctx.scale(kf.scale, kf.scale);

  ctx.globalAlpha = kf.opacity ?? 1;
  ctx.fillStyle = _resolveColor(layer.fill, teamColors);

  ctx.beginPath();
  ctx.fill(layer._path);

  ctx.restore();
}
```

### 5.4 Morph layer draw

```js
function _drawMorphLayer(ctx, layer, phase, teamColors) {
  const kfA = _prevMorphKeyframe(layer.morphKeyframes, phase);
  const kfB = _nextMorphKeyframe(layer.morphKeyframes, phase);
  const t = _localT(kfA.t, kfB.t, phase);

  ctx.fillStyle = _resolveColor(layer.fill, teamColors);
  ctx.beginPath();

  for (let i = 0; i < kfA.commands.length; i++) {
    const a = kfA.commands[i];
    const b = kfB.commands[i];
    const lerp = (va, vb) => va + (vb - va) * t;

    switch (a.cmd) {
      case "M":
        ctx.moveTo(lerp(a.x, b.x), lerp(a.y, b.y));
        break;
      case "C":
        ctx.bezierCurveTo(
          lerp(a.x1, b.x1), lerp(a.y1, b.y1),
          lerp(a.x2, b.x2), lerp(a.y2, b.y2),
          lerp(a.x,  b.x),  lerp(a.y,  b.y)
        );
        break;
      case "Z":
        ctx.closePath();
        break;
    }
  }

  ctx.fill();
}
```

No string building. No `new Path2D()`. Direct canvas path calls only.

### 5.5 Keyframe interpolation

```js
function _interpolateKeyframes(keyframes, phase) {
  // find the two bracketing keyframes
  let a = keyframes[0], b = keyframes[keyframes.length - 1];
  for (let i = 0; i < keyframes.length - 1; i++) {
    if (phase >= keyframes[i].t && phase <= keyframes[i + 1].t) {
      a = keyframes[i]; b = keyframes[i + 1]; break;
    }
  }
  const t = a.t === b.t ? 0 : (phase - a.t) / (b.t - a.t);
  const lerp = (va, vb) => (va ?? 0) + ((vb ?? 0) - (va ?? 0)) * t;
  return {
    tx:      lerp(a.tx,      b.tx),
    ty:      lerp(a.ty,      b.ty),
    rot:     lerp(a.rot,     b.rot),
    scale:   lerp(a.scale ?? 1, b.scale ?? 1),
    opacity: lerp(a.opacity ?? 1, b.opacity ?? 1),
  };
}
```

### 5.6 Colour resolution

```js
function _resolveColor(fill, teamColors) {
  if (fill === "team.primary")   return teamColors.primary;
  if (fill === "team.secondary") return teamColors.secondary;
  return fill;
}
```

---

## 6. Team Colour System

Each team has two colours used for sprite rendering:

```js
team.spriteColors = {
  primary:   "#e63946",   // mammoth fur, engine glow, saucer interior accent
  secondary: "#f1a208",   // saucer rim trim, porthole ring
  shade1:    "rgb(...)",  // team colour × 0.40  — darkest ramp tone
  shade2:    "rgb(...)",  // team colour × 0.65
  shade3:    "rgb(...)",  // team colour        — base ramp tone
  shade4:    "rgb(...)",  // team colour mixed 55% toward white — lightest
}
```

`shade1`–`shade4` form a dark→light ramp derived from the team's base colour by scaling brightness (and lightening the top tone toward white). All four keep the team hue, so the saucer reads as a single team while showing tonal depth across its sections. The ramp is computed in `Renderer._spriteTeamColors()` and cached per team colour.

`team.spriteColors` is distinct from the existing `team.colour` (used for trails, HUD, and the aim indicator). `team.colour` is the canonical team identity colour used throughout the rest of the game; `spriteColors` are the fine-grained palette entries specific to the station sprite.

By default, `spriteColors.primary` is the same value as `team.colour`. `spriteColors.secondary` is a lighter or complementary shade derived from `primary`. A small palette table maps each of the 12 existing team colours to a secondary value.

---

## 7. Clipping (dome glass)

Sprites support one optional clip path applied to a named subset of layers. For the mammoth saucer this is the dome glass: the mammoth is visible only through the dome, so mammoth body parts that extend beyond the dome edge are invisible.

The `clipPath` field in the sprite module is an SVG path string. At startup:

```js
sprite._clipPath = new Path2D(sprite.clipPath);
```

In the draw loop, `ctx.clip(sprite._clipPath)` is applied before drawing any layer listed in `clippedLayers`. The clip is scoped inside a `ctx.save()` / `ctx.restore()` pair so it does not affect other layers.

---

## 8. Detail Level by Station Size

| Station size | Saucer | Dome | Mammoth in dome | Porthole ring |
|---|---|---|---|---|
| Micro (r < 6px) | disc only | arc outline only | hidden | hidden |
| Tiny (r < 10px) | disc + dome | filled | hidden | hidden |
| Small and above | all layers | filled | visible | visible |

Detail LOD is generic: each layer may carry a `minRadius` (authored as `data-min-radius` in the SVG), and the renderer skips any layer whose `minRadius` exceeds the current `screenRadius`. The table above is realised by tagging the mammoth and porthole layers with appropriate thresholds.

---

## 9. Animation Phase Management

The sprite system uses a global wall-clock time, not per-station timers, so all stations of the same sprite type animate in phase with each other. This is intentional — it avoids tracking per-station animation state.

Each frame:

```js
const now = performance.now();
const animPhase = (now % sprite.duration) / sprite.duration;  // 0–1
```

`animPhase` is passed into `drawStation()`. All stations drawn in a given frame use the same `animPhase`.

---

## 10. Performance Targets

| Scenario | Target |
|---|---|
| **96 ships, full animation** | **60fps on iPad (A-series); sprite draw < 2ms per frame** |
| 12 stations, full animation | < 0.5ms draw time per frame on iPad (A-series) |
| Per-instance draw budget (direct vector path) | ≤ 25 canvas calls (save/restore/fill/clip) |
| Per-instance draw budget (cached sheet path) | 1 `drawImage` call |
| Memory | No per-frame allocations in the draw loop; ≈1.5MB sheet per team in play |

The primary iOS constraint (§15.3 of design.md) is Metal pipeline state changes. The sprite renderer is designed to avoid them:

- No `ctx.filter` in the draw loop
- No `createRadialGradient()` in the draw loop
- Minimal `globalCompositeOperation` changes (engine glow may use `'lighter'` but is scoped)
- `Path2D` objects are pre-created at startup; morph layers use direct canvas commands

### 10.1 Scaling to many ships — per-team sprite sheets

Direct vector drawing costs ~23 canvas calls per instance; at 96 ships that is ~2,200 path fills per frame, too many for the iPad Metal backend. The renderer instead exploits the global animation phase (§9): **all instances of a sprite with the same team colours are pixel-identical within a frame**.

`SpriteSheetCache` pre-renders `SHEET_FRAMES` (24) animation phases per (sprite, team) pair into one horizontal sheet canvas, built lazily on first use — only teams actually in play pay the cost. Frames are rendered at full detail (128px, radius 64) and downscaled per ship, so per-layer LOD does not apply on this path. Each finished sheet is snapshotted to an `ImageBitmap` where supported, for zero-flush `drawImage` on iOS (same pattern as the gas giant canvas).

Per-frame cost becomes **one `drawImage` per ship** plus zero path geometry. 24 frames over a 2400ms loop is one frame per 100ms; at game ship sizes the stepping is invisible.

The direct vector path (`drawSprite`) remains the renderer used to *build* sheet frames, the fallback for one-off draws, and the comparison mode in `sprite-bench.html` — a standalone page that draws 96 animated ships across 12 teams with an fps/draw-time HUD and a mode toggle, for verifying the target on real hardware.

---

## 11. File Layout

```
assets/sprites/
  ufo.svg                       ← artist sources; not shipped in build
  mammoth-saucer.svg

scripts/
  build-sprites.mjs             ← build-time converter (Node.js, no dependencies)

src/rendering/sprites/
  ufo.sprite.js                 ← generated output; committed to repo
  mammoth-saucer.sprite.js
  SpriteRenderer.js             ← initSprite(), drawSprite() — entity-agnostic
  spriteUtils.js                ← interpolateKeyframes(), resolveColor(), lerp helpers
  index.js                      ← sprite registry: getSprite(name) → initialised module
```

Adding a new sprite for any object type is: drop the `.svg` in `assets/sprites/`, run the build script, register the generated module in `index.js`, and call `drawSprite()` from the relevant draw path.

**Current integration**: `Renderer._drawStation()` routes normal (non-drone, non-target) ships to `_drawSpriteStation()` — which draws the `ufo` sprite — only when the performance mode is exactly `'experimental'`. All other modes use the existing procedural Death Star renderer (`_drawNormalStation`), which is removed only once the sprite system is proven.

---

## 12. Future Considerations (not in scope now)

- **Replay / killcam**: sprite animation state is a pure function of wall-clock time, so replay requires no special animation state capture
- **Custom scenario editor**: no dependency on sprite system
- **Additional sprite variants**: drone style (`visualStyle: "drone"`, §13.5 of requirements.md) could be a separate `drone.sprite.js` using the same pipeline and renderer
