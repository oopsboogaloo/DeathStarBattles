# Extended Background — Specification & Design

> **Problem.** The `bgCanvas` and `trailsCanvas` are sized to the letterboxed/pillarboxed
> viewport (`_vpW × _vpH`). When the window aspect ratio doesn't match the game's locked
> ratio, or when the camera's 120 px overscroll margin is visible, the exposed fringe
> is pure black. Planets near the world edge have their corona/body clipped at the
> viewport boundary. Bullet trails are similarly clipped.
>
> **Fix.** Grow both cached canvases to the full main canvas size (`width × height`),
> bake with the letterbox offset baked in, and composite with an adjusted delta matrix.
> The camera system is **not changed**. No new gameplay. Purely visual.

---

## 1. Scope

| In scope | Out of scope |
|---|---|
| Starfield visible in bar regions | Parallax (stars at a different scroll rate) |
| Planet/comet coronas bleeding into bars | Stars responding to camera zoom/pan differently |
| Bullet trail arcs bleeding into bars | Allowing the camera to pan beyond current clamp |
| Gas giant glow bleeding into bars | Any physics / game-state change |

---

## 2. Definitions

Follow [camera-spec.md](camera-spec.md). Additional symbols:

| Symbol | Meaning |
|---|---|
| `width × height` | Full main canvas size (= `window.innerWidth × innerHeight` at game start, swapped when portrait-rotated). |
| `_vpW × _vpH` | Letterboxed viewport inside the canvas. Unchanged. |
| `_ox, _oy` | Viewport offset inside the canvas (pillarbox/letterbox gap). Unchanged. |
| `snap` | Camera snapshot `{z, cx, cy}` recorded at bake time. |
| `ratio` | `camera.z / snap.z` — zoom ratio between current camera and bake snapshot. |

---

## 3. Requirements

- **EB-1** The region of the main canvas outside the viewport (`_ox` px on each side in pillarbox
  mode, `_oy` px top/bottom in letterbox mode) MUST show a continuation of the starfield
  rather than black. The star distribution does not need to match the nebula density of
  the game-world centre; it just needs to look like the same sky.

- **EB-2** Planets, comets, and gas giants whose visual radius / corona extends past the
  world edge MUST render their overflow visually into the bar region rather than being
  hard-clipped.

- **EB-3** Bullet trail arcs (including completed arcs from earlier turns) MUST not be
  hard-clipped at the viewport boundary; trails that reach the world edge continue into
  the bar region.

- **EB-4** At the default camera view (`z = 1`, world-centred) the in-viewport rendering
  MUST be pixel-identical to today. The extended region is additive — it only adds content
  outside the viewport rectangle.

- **EB-5** The existing bake-on-settle pipeline (re-rasterise `bgCanvas` crisply after the
  camera has been still for 130 ms) MUST continue to work, covering the extended canvas.

- **EB-6** Performance: the extended canvas has at most `width × height / (_vpW × _vpH)` ≈ 1.0–1.3×
  more pixels than today in typical play (16:9 game on a 16:9 screen = no bars = exact
  same size). On heavily non-matching ratios (portrait phone, e.g. 9:19.5) the cost is at
  most ~2.2×. This is acceptable because it is a bake cost, not a per-frame cost — the
  composite is a single `drawImage`.

- **EB-7** HUD and overlays remain screen-fixed and MUST NOT be affected.

---

## 4. Architecture Change

### 4.1 Today

```
bgCanvas      → size _vpW × _vpH
trailsCanvas  → size _vpW × _vpH

Bake transform (background):
  ctx.setTransform(...camera.matrixFor(snap, 0, 0))   ← no _ox/_oy (0,0 origin in canvas)

Composite (drawFrame):
  ctx.setTransform(...cam.deltaMatrix(bgSnap, _ox, _oy))
  ctx.drawImage(bgCanvas, 0, 0)                        ← stamps at offset _ox,_oy
```

### 4.2 After this change

```
bgCanvas      → size width × height   (full main canvas)
trailsCanvas  → size width × height

Bake transform (background):
  ctx.setTransform(...camera.matrixFor(snap, _ox, _oy))  ← _ox/_oy baked IN to canvas

Composite (drawFrame):
  ctx.setTransform(...cam.fullDeltaMatrix(bgSnap))
  ctx.drawImage(bgCanvas, 0, 0)                           ← stamps from canvas origin
```

Because the letterbox offset is now baked into the canvas content rather than applied at
composite time, the composite uses a **different delta matrix** (§5).

At the default settled view (`ratio = 1`, camera == bake snap), `fullDeltaMatrix` is the
**identity** — `drawImage(bgCanvas, 0, 0)` with no transform, which is the cheapest possible
blit.

---

## 5. Transform Math

### 5.1 Existing `deltaMatrix(snap, ox, oy)` — for _vpW × _vpH canvas

Bake places world point `W` at canvas pixel `bx`:
```
bx = W.x · conv · z_snap  +  _vpW/2 − cx_snap · conv · z_snap
```
(no _ox/_oy in bake). Composite via:
```
tx = _ox  +  _vpW/2 · (1 − ratio)  +  (snap.cx − cx) · conv · z
ty = _oy  +  _vpH/2 · (1 − ratio)  +  (snap.cy − cy) · conv · z
```
At `ratio=1, snap=current`: `tx = _ox, ty = _oy` → stamps canvas at viewport offset ✓

### 5.2 New `fullDeltaMatrix(snap)` — for `width × height` canvas

Bake places world point `W` at canvas pixel `bx`:
```
bx = W.x · conv · z_snap  +  _ox  +  _vpW/2 − cx_snap · conv · z_snap
```
(_ox/_oy baked in). Inverting and substituting into current camera formula gives composite:
```
tx = _ox · (1 − ratio)  +  _vpW/2 · (1 − ratio)  +  (snap.cx − cx) · conv · z
ty = _oy · (1 − ratio)  +  _vpH/2 · (1 − ratio)  +  (snap.cy − cy) · conv · z
matrix = [ratio, 0, 0, ratio, tx, ty]
```

**Checks:**
- `ratio=1, snap=current` → `tx=0, ty=0` → identity blit ✓
- `ratio=1, snap≠current` (pan only) → `tx=(snap.cx−cx)·conv, ty=...` — correct pixel shift ✓
- `ratio=2, snap=current` (zoom only, full-canvas) → `tx=−_ox−_vpW/2, ty=−_oy−_vpH/2` → scales canvas
  around its centre `(_ox+_vpW/2, _oy+_vpH/2)` = the viewport centre ✓

`fullDeltaMatrix` is a new method on `Camera`; it needs `_vpW, _vpH, _ox, _oy, conv` from the
renderer, which are already stored in `Camera._vpW` etc. after `configure()`.

### 5.3 Live content — unchanged

`cam.matrix(_ox, _oy)` used for `_drawLive` is **not changed**. Live world content is still
drawn inside the viewport rectangle; the extended area is bars only.

---

## 6. Starfield Generation

`Renderer.generateStarField(gw, gh)` currently generates star positions in `[0, gw] × [0, gh]`
world units. To fill bars, stars need to span the extended world area that maps to the full
canvas pixel space.

The bar regions in world coordinates (at default camera, z = 1):
```
x ∈ [−_ox / conv,  gw + _ox / conv]
y ∈ [−_oy / conv,  gh + _oy / conv]
```

At call time the renderer knows `_ox, _oy, conv`. Pass `{xMin, xMax, yMin, yMax}` to
`generateStarField`, or (simpler) pass `extraW = _ox / conv` and `extraH = _oy / conv` so
the function can extend its sampling domain symmetrically. Star count scales proportionally
with the area increase (typically < 5 % more stars; on portrait phone at most ~2× more).

The density-noise map is already generated from normalised `[0,1]` coordinates; for the
extended region clamp to the nearest noise edge or extend with a constant low density (deep
space feel in the bars — deliberately sparser than the centre).

---

## 7. Trails Extension

`trailsCanvas` grows to `width × height`. Three call sites change:

| Call | Today | After |
|---|---|---|
| `clearTrails()` | `clearRect(0,0,_vpW,_vpH)` | `clearRect(0,0,width,height)` |
| `redrawTrails(bullets)` | bake at `matrixFor(defaultSnap, 0, 0)` | bake at `matrixFor(defaultSnap, _ox, _oy)` |
| `appendTrailPoint(bullet)` | draw into viewport-origin context | draw into full-canvas context (unchanged draw code — the offset comes from the canvas size / transform, not the draw call) |
| composite in `drawFrame` | `deltaMatrix(trailsSnap, _ox, _oy)` | `fullDeltaMatrix(trailsSnap)` |

Note: trails are always baked at the **default camera** (`z = 1`, world-centred). This is
unchanged (§camera-spec FR-25 note). `fullDeltaMatrix` handles the soft scale when the live
camera is zoomed in relative to the trails bake.

---

## 8. File Change List

| File | Change |
|---|---|
| `src/rendering/Camera.js` | Add `fullDeltaMatrix(snap)` — uses stored `_vpW, _vpH, _ox, _oy, _conv`. |
| `src/rendering/Renderer.js` | Resize `bgCanvas`/`trailsCanvas` to `width × height` in `resize()`, `setGameAspect()`, and constructor. Change bake transforms to `matrixFor(snap, _ox, _oy)`. Change compositing to `fullDeltaMatrix`. Change `clearTrails` rect. Pass extended star domain to `generateStarField`. |
| `src/rendering/Renderer.js` | `generateStarField`: accept optional `{xMin, xMax, yMin, yMax}` override; extend noise sampling and star count proportionally. |

No changes to `Camera.js` state/clamping, `CameraControls.js`, `InputHandler.js`,
`GameLoop.js`, `PhysicsEngine.js`, or any UI/entity files.

---

## 9. Edge Cases

| Case | Handling |
|---|---|
| No bars (`_ox = _oy = 0`, e.g. 16:9 game on 16:9 screen) | Canvases stay `_vpW × _vpH` = `width × height`. Zero extra work. |
| Portrait-rotated view | The canvas is CSS-rotated; `width` and `height` are swapped by `Renderer.resize()`. The extended canvas covers the correct pixel area. |
| Resize mid-game | `resize()` already re-sizes canvases and re-bakes. Covered. |
| Gas giants (drawn live, not baked) | Gas giants are rendered in `_drawLive` under `cam.matrix(_ox, _oy)`, which places them inside the viewport. Their glow is entirely live, not cached. If a gas giant is near the edge, its overflow won't appear in the bars. **Acceptable for now** — gas giants don't sit near world edges in any scenario. |
| Wormhole tunnel background (scenario 34) | Drawn to bgCanvas in `_renderBackground` — benefits automatically. |
