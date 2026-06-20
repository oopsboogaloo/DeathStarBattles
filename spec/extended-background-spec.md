# Extended Background — Specification & Design

> **Problem.** The `bgCanvas` and `trailsCanvas` are sized to the letterboxed/pillarboxed
> viewport (`_vpW × _vpH`). When the window aspect ratio doesn't match the game's locked
> ratio, or when the camera's 120 px overscroll margin is visible, the exposed fringe
> is pure black. Planets near the world edge have their corona/body clipped at the
> viewport boundary. Bullet trails are similarly clipped.
>
> **Fix.** Grow both cached canvases to the full main canvas size **plus a `BG_PAD` (120 px)
> border on every side** — `(width + 2·BG_PAD) × (height + 2·BG_PAD)` — bake with the
> letterbox offset *and* the pad baked in, and composite with an adjusted delta matrix.
> The pad matches the camera's `OVERSCROLL_PX` clamp, so the 120 px of overscroll the camera
> allows past the world edge is always covered even on screens with no letterbox bars
> (`_ox = _oy = 0`, e.g. a phone). The star field is generated across the same extended
> domain so it is one continuous field — no seam at the world edge. The camera system is
> **not changed**. No new gameplay. Purely visual.

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

`BG_PAD = 120` (must equal `Camera.OVERSCROLL_PX`).

```
bgCanvas      → size (width + 2·BG_PAD) × (height + 2·BG_PAD)
trailsCanvas  → same

Bake transform (background):
  ctx.setTransform(...camera.matrixFor(snap, _ox + BG_PAD, _oy + BG_PAD))  ← offset + pad baked IN

Composite (drawFrame):
  ctx.setTransform(...cam.fullDeltaMatrix(bgSnap, BG_PAD))
  ctx.drawImage(bgCanvas, 0, 0)                           ← settled view stamps at (−BG_PAD, −BG_PAD)
```

Because the letterbox offset is now baked into the canvas content rather than applied at
composite time, the composite uses a **different delta matrix** (§5).

At the default settled view (`ratio = 1`, camera == bake snap), `fullDeltaMatrix(snap, BG_PAD)`
is a pure translation by `(−BG_PAD, −BG_PAD)` — `drawImage(bgCanvas, 0, 0)` stamps the padded
canvas so its inner `width × height` region lands exactly on the main canvas, the cheapest
possible blit.

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

### 5.2 New `fullDeltaMatrix(snap, overscrollPx)` — for the padded canvas

Bake places world point `W` at canvas pixel `bx`:
```
bx = W.x · conv · z_snap  +  (_ox + BG_PAD)  +  _vpW/2 − cx_snap · conv · z_snap
```
(_ox/_oy and the pad baked in). Inverting and substituting into the current camera formula,
with `P = overscrollPx`, gives the composite:
```
tx = _ox · (1 − ratio)  +  _vpW/2 · (1 − ratio)  +  (snap.cx − cx) · conv · z  −  P · ratio
ty = _oy · (1 − ratio)  +  _vpH/2 · (1 − ratio)  +  (snap.cy − cy) · conv · z  −  P · ratio
matrix = [ratio, 0, 0, ratio, tx, ty]
```
The `−P·ratio` term cancels the `+BG_PAD` baked into `bx`, so an in-world point still lands at
exactly `cam.matrix(_ox,_oy)` — proven in code. Call with `P = BG_PAD` for the bg/trails canvases.

**Checks (with `P = BG_PAD`):**
- `ratio=1, snap=current` → `tx=ty=−BG_PAD` → stamps padded canvas at `(−BG_PAD,−BG_PAD)`,
  covering the full main canvas plus the overscroll fringe ✓
- `ratio=1, snap≠current` (pan only) → `tx=(snap.cx−cx)·conv − BG_PAD` — correct pixel shift ✓
- `ratio=2, snap=current` (zoom only) → scales the padded canvas around the viewport centre ✓

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

The border region in world coordinates (at default camera, z = 1) spans the bars **and** the
overscroll pad on each side:
```
x ∈ [−(_ox + BG_PAD)/conv,  gw + (_ox + BG_PAD)/conv]
y ∈ [−(_oy + BG_PAD)/conv,  gh + (_oy + BG_PAD)/conv]
```
This domain maps *exactly* onto the padded `bgCanvas` (`[0, bgCanvas.width]`), so generating
stars across it fills the canvas edge-to-edge with no gap.

The renderer exposes `bgExtraW = (_ox + BG_PAD)/conv` and `bgExtraH = (_oy + BG_PAD)/conv`;
`main.js` passes these to `generateStarField(gw, gh, count, extraW, extraH)`. The function
samples over `[−extraW, gw+extraW] × [−extraH, gh+extraH]` and scales `count` by the area
ratio so interior density is unchanged.

The density-noise map is normalised over `[0,1]`; for the extended region the normalised
coordinate is **clamped to `[0,1]`** so the edge cloud structure continues smoothly outward
(no seam at the boundary), then multiplied by a linear `borderFalloff` (1.0 at the world edge
→ 0.5 at the outer pad) for a deep-space feel. Because this is one continuous field generated
by one function, there is no density discontinuity at the world edge — this is the key
difference from a separate bar-fill pass, which always shows a visible rectangular seam.

---

## 7. Trails Extension

`trailsCanvas` grows to `(width+2·BG_PAD) × (height+2·BG_PAD)`. Three call sites change:

| Call | Today | After |
|---|---|---|
| `clearTrails()` | `clearRect(0,0,_vpW,_vpH)` | `clearRect(0,0,width+2·BG_PAD,height+2·BG_PAD)` |
| `redrawTrails(bullets)` | bake at `matrixFor(defaultSnap, 0, 0)` | bake at `matrixFor(defaultSnap, _ox+BG_PAD, _oy+BG_PAD)` |
| `appendTrailPoint(bullet)` | draw into viewport-origin context | bake at `matrixFor(trailsSnap, _ox+BG_PAD, _oy+BG_PAD)` (unchanged draw code — offset comes from the transform) |
| composite in `drawFrame` | `deltaMatrix(trailsSnap, _ox, _oy)` | `fullDeltaMatrix(trailsSnap, BG_PAD)` |

Note: trails are always baked at the **default camera** (`z = 1`, world-centred). This is
unchanged (§camera-spec FR-25 note). `fullDeltaMatrix` handles the soft scale when the live
camera is zoomed in relative to the trails bake.

---

## 8. File Change List

| File | Change |
|---|---|
| `src/rendering/Camera.js` | Add `fullDeltaMatrix(snap, overscrollPx = 0)` — uses stored `_vpW, _vpH, _ox, _oy, _conv`; the `−overscrollPx·ratio` term offsets the padded canvas. |
| `src/rendering/Renderer.js` | Add `const BG_PAD = 120` (== `Camera.OVERSCROLL_PX`). Resize `bgCanvas`/`trailsCanvas` to `(width+2·BG_PAD) × (height+2·BG_PAD)` in `resize()` and `setGameAspect()`. Change bake transforms to `matrixFor(snap, _ox+BG_PAD, _oy+BG_PAD)`. Composite with `fullDeltaMatrix(snap, BG_PAD)`. Widen `clearTrails`/`redrawBackground` clears. Add `bgExtraW`/`bgExtraH` getters; pass them to `generateStarField`. |
| `src/rendering/Renderer.js` | `generateStarField(gw, gh, count, extraW, extraH)`: sample over `[−extraW, gw+extraW] × [−extraH, gh+extraH]`, clamp the density-noise coord to `[0,1]` at the edges, apply `borderFalloff`, and scale `count` by the area ratio. (Replaces the earlier separate `_drawBarFill` pass, which left a visible seam.) |
| `src/main.js` | Pass `renderer.bgExtraW, renderer.bgExtraH` at the three `generateStarField` call sites (after `setGameAspect` has configured the viewport). |

No changes to `Camera.js` state/clamping, `CameraControls.js`, `InputHandler.js`,
`GameLoop.js`, `PhysicsEngine.js`, or any UI/entity files.

---

## 9. Edge Cases

| Case | Handling |
|---|---|
| No bars (`_ox = _oy = 0`, e.g. 16:9 game on 16:9 screen) | Canvases are still padded to `(width+2·BG_PAD) × (height+2·BG_PAD)` so the 120 px camera overscroll past the world edge is covered (this was the original bug — sizing to `width × height` left that fringe black on phones). |
| Portrait-rotated view | The canvas is CSS-rotated; `width` and `height` are swapped by `Renderer.resize()`. The extended canvas covers the correct pixel area. |
| Resize mid-game | `resize()` already re-sizes canvases and re-bakes. Covered. |
| Gas giants (drawn live, not baked) | Gas giants are rendered in `_drawLive` under `cam.matrix(_ox, _oy)`, which places them inside the viewport. Their glow is entirely live, not cached. If a gas giant is near the edge, its overflow won't appear in the bars. **Acceptable for now** — gas giants don't sit near world edges in any scenario. |
| Wormhole tunnel background (scenario 34) | Drawn to bgCanvas in `_renderBackground` — benefits automatically. |
