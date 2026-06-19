# Camera (Zoom & Pan) — Technical Design

> Translates [camera-spec.md](camera-spec.md) into concrete implementation decisions. Covers the chosen injection strategy (native Canvas 2D transform), the new `Camera` and `CameraControls` modules, the exact transform math, the changes to the layered render pipeline, gesture recognition, re-rasterisation/performance, and a file-by-file change list. Terminology and symbols follow the spec.

> **Status: Implemented.** The strategy and math below shipped as designed. A few behaviours changed during implementation/playtesting — see **§11 Implementation deltas** for the authoritative list; the spec ([camera-spec.md](camera-spec.md)) has been updated to match.

---

## 1. Design Goals

1. Deliver spec FR-1..FR-29 with **minimal churn to existing draw code**. The renderer has hundreds of `x * this.conv` call sites; rewriting each is risky and noisy.
2. Keep the camera a **pure view concern** — no entity, physics, or turn logic changes.
3. Leave a **clean seam** so a future WebGPU backend replaces only the compositing layer, not the camera or input.
4. Preserve the current frame exactly at the default view (pixel-identical, FR-1).

---

## 2. Strategy Decision — How to inject the camera

Three options were considered:

| Option | Idea | Verdict |
|---|---|---|
| **A. Native canvas transform injection** | Set `ctx.setTransform(...)` once before drawing, so existing `world * conv` draw code is automatically zoomed/panned. | **Chosen.** Zero changes to the ~hundreds of draw call sites; the camera is a handful of transform set-ups at composition points. |
| B. Rewrite call sites | Replace every `x * this.conv` with `camera.worldToScreen(x)`. | Rejected — enormous diff, high regression risk, no upside over A. |
| C. Fold into `conv` / `_ox/_oy` | Redefine the `conv` getter to include zoom and the offsets to include pan. | Rejected — `conv` feeds `worldSize`/`gameHeight`/`gameWidth` with semantic ripples; integer letterbox offsets can't cleanly express continuous pan + focal anchoring. |

**Why A works.** Today's draw code expresses positions in **viewport-pixel space at z = 1**: `vpPx = world * conv`. The camera is then just an affine map from that space into actual screen pixels:

```
screenX = vpPx_x · z + (_ox + _vpW/2 − cx·conv·z)
screenY = vpPx_y · z + (_oy + _vpH/2 − cy·conv·z)
```

i.e. `ctx.setTransform(z, 0, 0, z, tx, ty)` with
`tx = _ox + _vpW/2 − cx·conv·z`, `ty = _oy + _vpH/2 − cy·conv·z`.

Set that transform, then call the **unchanged** `_drawLive()` and friends — every `x * this.conv` lands in the right place. At the default view (`z=1, cx=350, cy=gameHeight/2`) it reduces to `translate(_ox, _oy)` — today's exact behaviour (FR-1), because `350·conv = _vpW/2`.

The same transform applied to an **off-screen** context (without the `_ox/_oy` term) is how cached layers are re-rasterised crisply at the current zoom.

---

## 3. Module Design

```
src/rendering/Camera.js        ← NEW: pure state + transform math + tween. No DOM, no events.
src/input/CameraControls.js    ← NEW: gesture recognition (touch/mouse), mutates Camera, schedules re-raster.
src/rendering/Renderer.js      ← MODIFIED: owns a Camera; applies transform at composition points; rebuildForCamera().
src/input/InputHandler.js      ← MODIFIED: screen↔world via Camera (aim + move hit-testing).
src/core/GameLoop.js           ← MODIFIED: one line in _startTurn() to reset camera on turn change.
src/main.js                    ← MODIFIED: construct CameraControls; tick camera tween; re-clamp on resize.
```

### 3.1 `Camera` (rendering/Camera.js)

Owns the view state and all transform math. No knowledge of events or the DOM.

```
class Camera {
  z = 1; cx = 350; cy = H/2;          // current view
  // tween targets for animated reset (§7.3)
  _tz, _tcx, _tcy, _tweenT, _tweenDur;

  configure(vpW, vpH, ox, oy, conv, gameHeight)   // called by Renderer on resize/aspect lock
  get MIN_Z() { return 1; }  get MAX_Z() { return 4; }

  // affine for the *live* composite and for offscreen rasterisation (pass ox=oy=0 for offscreen)
  matrix(ox, oy)                       // → {a:z, b:0, c:0, d:z, e:tx, f:ty}
  worldToScreen(wx, wy)                // includes _ox/_oy
  screenToWorld(px, py)                // inverse (FR-2 hit-testing)

  // mutations (all re-clamp per FR-4)
  zoomAt(focusScreenX, focusScreenY, factor)       // pinch/wheel, focal-anchored (FR-7)
  panByScreen(dxPx, dyPx)                            // two-finger / desktop drag (FR-5)
  resetToDefault({ animated })                       // double-tap / turn change (FR-18, FR-22)
  _clamp()                                            // FR-4 bounds
  tick(now)                                           // advance reset tween; returns true while animating
  isDefault()                                         // z≈1 and centred → lets Renderer skip camera work
}
```

Key formulas (derive directly from §2):

- **Half-extents / clamp (FR-4):** `halfW = 350/z`, `halfH = (gameHeight/2)/z`; `cx ∈ [halfW, 700−halfW]`, `cy ∈ [halfH, gameHeight−halfH]`.
- **Focal-anchored zoom (FR-7):** convert focus screen px → world `w` (pre-zoom), set `z' = clamp(z·factor)`, then choose `(cx,cy)` so `w` stays under the focus: `cx = wx − (focusVpX − _vpW/2)/(conv·z')`, similarly `cy`. Then `_clamp()`.
- **Pan (FR-5):** `cx −= dxPx/(conv·z)`, `cy −= dyPx/(conv·z)`; `_clamp()`.

### 3.2 `CameraControls` (input/CameraControls.js)

Owns gesture recognition; the only place that listens for multi-touch and wheel. Mutates `renderer.camera` and schedules re-rasterisation.

```
new CameraControls({ canvas, renderer, getLoop })
  // touch: pointer events tracked in a Map; 1 pointer → ignore (aim owns it); 2 pointers → pinch+pan (FR-10..FR-13)
  // wheel: zoomAt(cursor) (FR-15)
  // desktop pan: middle-button drag OR space+left-drag (FR-16, open Q)
  // double-tap / double-click: resetToDefault({animated:true}) (FR-14, FR-17)
  // on any zoom change: schedule settle re-raster (debounce ≈120 ms) → renderer.rebuildForCamera()
```

**Coexistence with aiming (FR-9/FR-13).** `CameraControls` uses Pointer Events and only acts on **≥2 active pointers**. `InputHandler` keeps its existing single-pointer `mousedown/mousemove` (aim). When a second pointer goes down, `CameraControls` sets a `navigating` flag on the shared camera/loop that `InputHandler._tryAim` checks and bails on, and it suppresses the residual single-pointer aim when dropping back to one finger (FR-13, EC-3). Double-tap suppresses the aim-set on the second tap (EC-1).

### 3.3 Renderer changes

- Construct `this.camera = new Camera()`; call `camera.configure(...)` from `setGameAspect()` and `resize()` (so it always knows `_vpW/_vpH/_ox/_oy/conv/gameHeight`), and `camera._clamp()` after resize (EC-2).
- Expose `worldToScreen`/`screenToWorld` passthroughs for `InputHandler`.
- `_applyLiveTransform(ctx)` → `ctx.setTransform(camera.matrix(_ox,_oy))`; used in `drawFrame` for live content.
- `rebuildForCamera()` → re-rasterise cached layers at the current camera (calls `_renderBackground`, `_buildGasGiantCanvas`, `redrawTrails`) — see §4.2.

### 3.4 InputHandler changes

Replace the two manual conversions with camera-aware ones:
- Aim hit-test: station screen pos `= renderer.worldToScreen(station.position.x, station.position.y)`; mouse→world distance uses `renderer.screenToWorld(mx,my)` or compares in screen px consistently. The aim circle radius is in screen px and already scales because `stationR_px` derives from `conv·z` once the camera multiplies through.
- `waitingForMove` (EC-5): `const w = renderer.screenToWorld(mx,my); loop.humanSetMove(w.x, w.y);`

### 3.5 GameLoop change

One line in `_startTurn()` (GameLoop.js:909): `this.renderer.camera.resetToDefault({ animated: <openQ> })` (FR-22). No other game-logic change.

---

## 4. Render Pipeline Changes

The renderer composites three cached bitmaps (`bgCanvas`, `trailsCanvas`, gas-giant bitmap) plus per-frame live content. The camera touches compositing in two regimes: **settled** (crisp) and **mid-gesture** (soft, cheap).

### 4.1 Live content — always full camera, always crisp (FR-24)

In `drawFrame`, replace the current `ctx.translate(_ox,_oy)` blocks with `_applyLiveTransform(ctx)` before `_drawLive`. Because live content is vector-drawn each frame, it is crisp at every zoom with zero extra cost. Existing visibility culling (`_isVisible`, off-screen skips) now culls against the zoomed view, so zooming in **reduces** live object count (never exceeds the z=1 baseline). HUD/overlay (`_drawHUD`, `_drawOverlay`) are drawn with the transform reset to identity → screen-fixed (FR-28).

### 4.2 Cached layers — two regimes

Each cached layer records the camera it was rasterised at: `bgCamera`, `trailsCamera`, `ggCamera` (a `{z,cx,cy}` snapshot).

- **Rasterisation (settle).** `rebuildForCamera()` re-renders each layer with the camera baked into the **off-screen** context: at the top of `_renderBackground`/`_buildGasGiantCanvas`, `ctx.setTransform(camera.matrix(0,0))` (no `_ox/_oy`), then the existing draw code runs unchanged. `redrawTrails` replays `bullet.trail` points the same way. The layer now holds a crisp image of the visible view; snapshot its camera. (FR-26)
- **Compositing (per frame).** Draw each cached bitmap through the **delta transform** from its snapshot camera `C0` to the live camera `C`:
  ```
  scale = z / z0
  drawImage with setTransform(scale,0,0,scale,
      _ox + _vpW/2 − (cx − ... )·… )   // affine mapping C0-screen → C-screen
  ```
  Derivation: a bitmap pixel at C0-screen `p0` shows world `w`; its C-screen position is
  `p = (p0 − _vp/2)·(z/z0) + (c0 − c)·conv·z + _vp/2 (+ _ox/_oy)`.
  When `C == C0` (settled) this is the identity → pixel-perfect (FR-1). Mid-gesture it is a cheap scaled blit → soft, which the spec explicitly allows (FR-25).

So the loop is: **gesture → composite cached layers via delta (soft); on settle (debounce) → rebuildForCamera() resets deltas to identity (crisp).** Live content is always crisp.

### 4.3 Trails during the simultaneous-fire phase (FR-21)

Trails accumulate via `appendTrailPoint` into `trailsCanvas`, which is baked at `trailsCamera`. New segments are appended in the same baked space, so they stay consistent with earlier segments. If the camera changes during fire, the canvas composites via the delta (soft) until settle, then `redrawTrails` re-bakes all points crisply at the new camera. No change to `appendTrailPoint`’s body beyond it inheriting the baked transform.

### 4.4 Note on background re-roll

`_renderBackground` already uses `Math.random()` for cosmetic rift lightning and is already re-invoked on `resize` today, so re-rolling those decorations on zoom-settle is consistent with current behaviour. If flicker is objectionable, seed the decorations per-rift (deferred; not required by spec).

---

## 5. Gesture Recognition Detail

**Touch (Pointer Events on the canvas).** Track active pointers in a `Map<pointerId, {x,y}>`.
- 1 active pointer → do nothing (aim path owns it via existing mouse-compatible events).
- 2 active pointers → on each `pointermove` recompute midpoint `M` and spread `D`. `zoomAt(M, D/Dprev)` (FR-10) and `panByScreen(M − Mprev)` (FR-11) applied together (FR-12).
- Transition guards: on the 2nd `pointerdown`, set `navigating=true` (InputHandler bails). On drop to 1 pointer, keep `navigating` true until that last pointer lifts, then clear — prevents a stray aim (FR-13, EC-3).

**Double-tap / double-click (FR-14, FR-17).** Track last tap time+pos; two taps < 300 ms and < ~24 px apart → `resetToDefault({animated:true})`; mark the 2nd tap consumed so aim ignores it (EC-1). Reconcile with the existing `index.html` `touchend` double-tap suppressor — move/relax that handler so it doesn't swallow the reset or trigger native zoom.

**Desktop (FR-15/FR-16).** `wheel` → `zoomAt(cursor, 1.1^∓ticks)`. Pan binding is an open question (§9); default proposal: **space-held left-drag** (keeps middle/right free, discoverable via a hint).

---

## 6. Reset/Turn Hooks & Tween

`Camera.resetToDefault({animated})` sets tween targets (`z→1, cx→350, cy→H/2`) over ≈300 ms ease-out; `Camera.tick(now)` advances it. `drawFrame` calls `camera.tick(performance.now())` first thing (the rAF loop runs every frame, even paused — GameLoop.start), so the reset animates whether triggered by double-tap or `_startTurn`. While the tween runs, cached layers composite via delta (soft) and a single `rebuildForCamera()` fires when it lands.

---

## 7. Performance Plan (FR-27)

- **Per-frame steady state:** identical cost to today — one transform + the same `drawImage`s + the same (or fewer, due to culling) live draws.
- **Mid-gesture:** delta-blit of cached layers (cheap, GPU-composited) + crisp live vector draws. No re-raster per frame.
- **Settle:** one `rebuildForCamera()` — `_renderBackground` (sync) + `_buildGasGiantCanvas` (already async via `createImageBitmap`) + `redrawTrails`. Debounced ≈120 ms so a continuous pinch rebuilds once at the end, not per frame.
- **Resolution unchanged** (FR-29): still CSS-pixel backing store; no DPR change in scope.
- **Validation:** the camera **spike** (next deliverable) wires this onto the real renderer behind a flag with the existing FPS overlay (`setDebugMode`) and measures worst-case scenarios on the reference iPad before any of this is finalised.

---

## 8. File-by-File Change List

1. **`src/rendering/Camera.js`** (new) — state, `matrix/worldToScreen/screenToWorld`, `zoomAt/panByScreen/resetToDefault/_clamp/tick/isDefault`, `MIN_Z=1/MAX_Z=4`.
2. **`src/input/CameraControls.js`** (new) — pointer/wheel/double-tap recognition; mutates camera; debounced settle → `renderer.rebuildForCamera()`; `navigating` coordination with `InputHandler`.
3. **`src/rendering/Renderer.js`** — own `this.camera`; `camera.configure()` in `setGameAspect`/`resize` (+ `_clamp` on resize); `_applyLiveTransform`; camera transform at the cached-layer composite (delta) and live blocks of `drawFrame`; reset transform before HUD/overlay; bake camera into `_renderBackground`/`_buildGasGiantCanvas`/`redrawTrails`; add `rebuildForCamera()`; expose `worldToScreen/screenToWorld`.
4. **`src/input/InputHandler.js`** — station screen pos and pointer→world via `renderer.worldToScreen/screenToWorld`; honour `navigating` flag; `waitingForMove` uses `screenToWorld` (EC-5).
5. **`src/core/GameLoop.js`** — one line in `_startTurn()`: `renderer.camera.resetToDefault({animated})` (FR-22).
6. **`src/main.js`** — construct `CameraControls` alongside `InputHandler` (lines ~573/655/799); ensure resize handler re-clamps + (debounced) `rebuildForCamera()` (already calls `redrawTrails` at 1058); no other change.
7. **`index.html`** — relax the `touchend` double-tap suppressor so it cooperates with double-tap reset and never triggers native zoom.

---

## 9. Risks & Mitigations

- **Trails/gas-giant mid-gesture softness** — accepted by spec (FR-25); crisp on settle. Mitigated by short debounce.
- **Settle hitch from `_renderBackground`** — sync rebuild of the static layer; bounded by one rebuild per gesture; gas-giant stays async. Spike measures it; if heavy, lower-cost path is to keep the z=1 bg bitmap and only re-raster above a zoom threshold.
- **Aim/nav gesture races** — handled by the `navigating` flag + pointer-count guards (FR-13, EC-3); needs device testing.
- **iOS double-tap suppressor conflict** — explicit reconciliation in `index.html` (§5).

---

## 10. Resolved Decisions (were spec §14 open questions)

1. Turn-change reset (FR-22): **animated** ease.
2. Desktop pan binding (FR-16): **middle-button drag** (not space+left-drag).
3. Visible "reset view" affordance: **not added** — double-tap/double-click only, documented in the in-game Controls page.
4. "Centre on my active station" helper: **not added** — manual pan + edge-overscroll margin suffices.

---

## 11. Implementation Deltas

What shipped differs from the design above in these ways (spec is updated to match):

1. **Trails are not re-rasterised on settle.** `redrawTrails()` only sees live bullets, but completed shots are removed from `activeBullets` once `DEAD` — re-baking erased their loops. Instead trails **always bake at the default full-world view** (so a whole arc fits the viewport-sized canvas) and are composited via the camera delta: crisp at the default view, gently soft when zoomed, always complete. §4.2/§4.3's "trails re-bake crisp on settle" is therefore superseded; only `bgCanvas` re-bakes crisp. Gas giants keep their `z=1` baseline.
2. **Live "basic star disc."** While the background is mid-gesture-soft, a cheap crisp star disc is drawn live (under the camera transform) so the star's shape reads; skipped once the background re-bakes crisp.
3. **Edge-overscroll margin** added to `_clamp` (FR-4): a constant ≈120 screen-px margin past the world edge so edge stations' aim circles are reachable; pan at `z=1` is no longer a strict no-op.
4. **Off-screen indicators redrawn in screen space** so they track the visible (zoomed) view rather than the world rect.
5. **Turn reset also wired into Target Practice** (`GameLoop._startTPTeamTurn`), not just `_startTurn`.
6. **Input ownership unified.** Rather than InputHandler keeping its mouse listeners and checking a shared `navigating` flag, `CameraControls` is the **sole** owner of canvas pointer/wheel input and forwards single-pointer drags to `InputHandler.aimDown/aimMove`. Adds pointer hardening for the iOS stuck-gesture case (spec EC-7): primary-pointerdown state reset, pointer capture, window-level up/cancel, focus-loss reset.
7. **iOS double-tap suppressor removed** from `index.html` entirely (CSS `touch-action` already disables double-tap zoom; the JS was eating quick button taps) rather than merely relaxed.
