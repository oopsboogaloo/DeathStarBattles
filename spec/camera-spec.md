# Camera (Zoom & Pan) — Specification

> Adds a view camera to the in-game renderer so players can zoom and pan the battlefield, primarily for usability on iPad, phones, and other touch devices. The camera is a **view-only transform**: it changes what part of the world is on screen and at what magnification, but never changes game state, physics, aim values, or coordinates stored on entities. It is also the abstraction a future WebGPU rendering backend would plug into — all world→screen mapping is funnelled through it.

---

## 1. Overview & Motivation

The game renders a fixed **700-unit-wide** world. Today that world maps 1:1 into a letterboxed/pillarboxed viewport (`Renderer.conv = _vpW / 700`, offsets `_ox/_oy`); there is no camera. On small touch screens the ships, aim circle, and dense clusters are hard to see and aim precisely.

This spec introduces a **camera** with two degrees of freedom — **zoom** (magnification) and **pan** (the world point shown at viewport centre) — driven by touch and mouse/trackpad gestures. The default view is the whole battlefield (today's exact framing); the camera only ever lets the player look *closer* at a *subset* of the arena.

Non-goals are listed in §11.

---

## 2. Definitions

| Term | Meaning |
|---|---|
| **World space** | The fixed 700-unit coordinate space all entities live in. Unchanged by this feature. |
| **Viewport** | The letterboxed/pillarboxed drawable region inside the canvas: `_vpW × _vpH` at offset `_ox, _oy`. The camera operates entirely inside this region; black bars are unaffected. |
| **Zoom `z`** | Magnification factor. `z = 1` shows the whole world (minimum); `z = 4` is maximum (§5). |
| **Camera centre `(cx, cy)`** | The world-space point displayed at the centre of the viewport. |
| **Default view** | `z = 1`, camera centred on the world centre — pixel-identical to the current (pre-camera) framing. |

---

## 3. Coordinate Model

The camera replaces the direct `world × conv` mapping with a camera-aware mapping. Let `conv = _vpW / 700` (unchanged) and effective scale `s = conv · z`.

**World → screen (within the viewport, before adding `_ox/_oy`):**
```
screenX = (worldX − cx) · s + _vpW / 2
screenY = (worldY − cy) · s + _vpH / 2
```

**Screen → world (inverse, for input hit-testing):**
```
worldX = (screenX − _vpW / 2) / s + cx
worldY = (screenY − _vpH / 2) / s + cy
```

- **FR-1** At the default view (`z = 1`, `cx = 350`, `cy = gameHeight/2`) the mapping MUST reduce exactly to today's `worldX · conv` / `worldY · conv`, producing a pixel-identical frame. (Because `350 · conv = _vpW/2`.)
- **FR-2** All renderer drawing and all input hit-testing MUST go through this single mapping. No code path may multiply a world coordinate by `conv` directly once the camera exists.

---

## 4. Pan

- **FR-3** Pan moves the camera centre `(cx, cy)` across the world.
- **FR-4 (clamping)** The camera MUST stay within the world; the viewport may never show beyond the world edges. With half-extents `halfW = 350 / z` and `halfH = (gameHeight/2) / z`:
  ```
  cx ∈ [halfW, 700 − halfW]
  cy ∈ [halfH, gameHeight − halfH]
  ```
  At `z = 1` these collapse to a single point (world centre), so pan is a no-op when fully zoomed out. Clamping applies after every pan and after every zoom.
- **FR-5** Pan is continuous and 1:1 with the gesture: the world point under the fingers/cursor at gesture start stays under them as they move (subject to clamping).

---

## 5. Zoom

- **FR-6** Zoom range is `z ∈ [1, 4]`. `z = 1` is the minimum (whole battlefield) and the default; `z = 4` is the maximum.
- **FR-7 (focal anchor)** Zoom is anchored at the focal point of the gesture — the pinch midpoint on touch, the cursor on wheel/trackpad zoom. The world point under the focal point MUST remain stationary on screen as `z` changes (then pan-clamped per FR-4).
- **FR-8** Zoom is smooth/continuous, not stepped, for pinch and trackpad; discrete wheel ticks map to a smooth multiplicative step (e.g. ~1.1× per notch), clamped to range.

---

## 6. Input — Touch

The existing aim interaction is preserved: **one-finger** drag within the aim circle still sets angle/power (`InputHandler._tryAim`). Navigation is a distinct **two-finger** gesture, so there is no mode switch.

- **FR-9 (one finger)** A single-touch drag is delivered to the existing aim/move logic, unchanged — except its screen→world conversion now goes through §3 (FR-2).
- **FR-10 (two-finger pinch)** Two touches changing distance = zoom (FR-7), anchored at the midpoint between the two touches.
- **FR-11 (two-finger drag)** Two touches translating together = pan (FR-5), tracking the midpoint.
- **FR-12** Pinch and two-finger pan are simultaneous: a single two-finger gesture that both spreads and slides zooms and pans together (Maps-style).
- **FR-13** When a gesture transitions from one finger to two (or vice-versa), the renderer MUST NOT apply a one-finger aim update from the spurious frame where the second finger lands/lifts.
- **FR-14 (double-tap reset)** A double-tap (two taps in quick succession at roughly the same point) animates a gentle return to the default view (§8). The existing iOS double-tap-zoom suppression in `index.html` MUST be reconciled so it does not block this or fire native zoom.

## 7. Input — Mouse / Trackpad (desktop)

- **FR-15** Mouse wheel / trackpad pinch = zoom anchored at the cursor (FR-7, FR-8).
- **FR-16** Pan on desktop: drag with a non-aiming button/modifier (e.g. middle-button drag, or space-held left-drag). Left-drag continues to mean aim, unchanged. *(Exact binding is an implementation choice; see Open Questions.)*
- **FR-17** Double-click = animated return to the default view (§8), matching double-tap (FR-14).

---

## 8. Default-View Reset

- **FR-18** A reset (double-tap / double-click, FR-14/FR-17) animates `z` and `(cx, cy)` back to the default view over a short ease (≈250–400 ms, ease-out), not an instant jump.
- **FR-19** The reset is purely visual: it changes no aim, power, turn, or game state.

---

## 9. Behaviour by Game Phase

- **FR-20 (aiming phase)** The player may freely zoom and pan while aiming. Aiming a station that sits near a viewport edge MUST work: because the aim circle is world-anchored, zooming/panning to bring the station fully on screen makes its aim circle reachable.
- **FR-21 (fire phase)** Projectiles are fired **simultaneously**, so the camera does NOT auto-follow any single projectile. During the fire phase the player may freely zoom and pan — e.g. zoom out to watch where shots are heading, or follow the action manually. The existing off-screen projectile indicators remain.
- **FR-22 (turn change)** When a new station's turn begins, the camera resets to the default full-battlefield view (animated per §8, or instant — see Open Questions). This guarantees the player always starts a turn seeing the whole arena.
- **FR-23 (game over / menus / story dialogs)** These are DOM/screen-space overlays and are unaffected by the camera. The camera applies only to in-game world rendering (normal battle and Target Practice).

---

## 10. Rendering & Performance

The renderer caches several layers as viewport-resolution bitmaps composited per frame with `drawImage`: `bgCanvas` (stars + static planets), `trailsCanvas` (accumulated bullet trails, replayable via the existing `redrawTrails()`), and the gas-giant bitmap. Live content (particles, bullets, stations, shields, explosions, aim circle, HUD) is drawn per frame.

- **FR-24 (live content)** Per-frame live drawing applies the camera transform (§3). Existing visibility culling continues to operate against the (now camera-derived) viewport, so zooming in culls more and never increases live object count beyond the `z = 1` baseline.
- **FR-25 (cached layers during a gesture)** While a pinch/zoom gesture is active, cached layers MAY be composited by scaling the existing bitmap (cheap; may appear soft). Crispness during the gesture is not required.
- **FR-26 (cached layers on settle)** After a zoom gesture settles (debounce ≈100–150 ms with no further zoom change), cached layers MUST be re-rasterised for the current `z` so the static background, gas giants, and trails are crisp at the new magnification. Trails re-rasterise from stored points via `redrawTrails()`.
- **FR-27 (performance target)** Sustained per-frame cost MUST NOT regress versus the current 1× baseline on the reference iPad in the active performance mode. Re-rasterisation (FR-26) is an occasional, gesture-end operation; its hitch SHOULD stay within one or two frames and MUST NOT occur per frame. The blur-heavy gas-giant rebuild already runs through `createImageBitmap` asynchronously and SHOULD remain async.
- **FR-28 (HUD / DOM UI fixed)** Screen-space UI — the HUD text, `AimControls` buttons, weapon selector, turn counter, overlays — is NOT transformed by the camera; it stays fixed regardless of zoom/pan. Only world-anchored elements (including the per-station aim circle) scale and move with the camera.
- **FR-29 (resolution)** The camera does not change the canvas backing resolution; rendering stays at the current CSS-pixel resolution (no `devicePixelRatio` change is in scope here — see §11).

---

## 11. Out of Scope

- **WebGPU / rendering-backend change.** This camera is the seam a future WebGPU backend would sit behind; the port itself is separate work.
- **Native-retina (`devicePixelRatio`) rendering.** Current sub-native CSS-pixel resolution is retained (FR-29); retina is a separate perf decision.
- **Rotating the view**, free zoom-out beyond the battlefield, or a minimap.
- **Camera state in save/replay/multiplayer sync** — the camera is local and ephemeral; it is never serialised or networked.
- **Changing aim, physics, or turn logic** in any way.

---

## 12. Edge Cases

- **EC-1** Double-tap-to-reset (FR-14) overlaps the one-finger aim path: the two underlying taps would also register as aim sets. Because both taps land at the same point, any aim side-effect is identical to a normal aim tap; nonetheless the implementation SHOULD suppress the aim-set on the second tap of a recognised double-tap to avoid surprise.
- **EC-2** A window resize / orientation change recomputes `_vpW/_vpH/_ox/_oy`; the camera MUST re-clamp `(cx, cy)` (FR-4) and re-rasterise cached layers afterward, preserving `z` and the relative centre where possible.
- **EC-3** A two-finger gesture that ends with one finger lifting first MUST NOT snap into a one-finger aim from the residual finger (FR-13).
- **EC-4** At `z = 1`, pan input is accepted but clamps to a no-op (FR-4); the gesture must not jitter the frame.
- **EC-5** `waitingForMove` (move-target click in `InputHandler`) uses the same screen→world conversion and MUST honour the camera transform (FR-2).
- **EC-6** Performance-mode changes (`full` / `simplified` / `experimental`) and aspect re-lock (`setGameAspect`) must continue to work with the camera; a re-rasterise (FR-26) follows any rebuild.

---

## 13. Acceptance Criteria

1. With no gesture, the rendered frame is pixel-identical to the pre-camera build at the default view (FR-1).
2. On iPad: two-finger pinch zooms toward the pinch point up to 4×; two-finger drag pans within world bounds; one-finger drag still aims (FR-9–FR-12).
3. Double-tap / double-click animates back to the default full view without altering aim or turn state (FR-14, FR-17, FR-18, FR-19).
4. Aiming a station near a screen edge is possible by zooming/panning it into view (FR-20).
5. During the simultaneous-fire phase the player can zoom out and watch shots leave/where they head; no auto-follow occurs (FR-21).
6. Each new turn opens at the full-battlefield view (FR-22).
7. Zoomed-in static background, gas giants, and trails are crisp after the gesture settles (FR-26); no sustained FPS regression vs baseline on the reference iPad (FR-27).
8. HUD and on-screen controls remain fixed and correctly placed at every zoom level (FR-28).

---

## 14. Open Questions

1. **Turn-change reset (FR-22):** animated ease or instant snap to the full view? (Animated is gentler; instant is more predictable.)
2. **Desktop pan binding (FR-16):** middle-button drag, space-held left-drag, right-drag, or edge-scroll — which feels best alongside left-drag aiming?
3. **Reset-view discoverability:** is double-tap/double-click enough, or should there also be a small on-screen "reset view" affordance for users who don't discover the gesture?
4. **Auto-frame on zoom-in:** when a player zooms during aiming, should there be a one-tap "centre on my active station" helper, or is manual pan sufficient?
