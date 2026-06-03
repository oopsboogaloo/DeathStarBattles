# Aim Indicator Spec

## Terminology

- **Aim circle** — the circular boundary drawn around the active station when aiming
- **Aim line** — the directional line(s) drawn from the station centre to the aim circle edge, showing where the shot is aimed
- **Aim indicator** — the aim circle and aim line(s) together

---

## Feature 1: Aim Lines for multi-bullet weapons

### Goal

For weapons that fire multiple bullets, show multiple aim lines — one per bullet angle — so the player can see the spread before committing. The centre line is drawn stronger than the flanking lines.

### Visual style

- All aim lines run from the station centre to the aim circle edge
- Centre line (0° offset): alpha 0.95, 2px
- Flanking lines: alpha 0.45, 1px
- All lines are solid (not dashed)

### Per-weapon aim lines

| Weapon | Lines | Angles | Notes |
|---|---|---|---|
| Cannon | 1 | 0° | Single shot, no change needed |
| Triple Cannon | 3 | −5°, 0°, +5° | Exact fire angles |
| Blaster | 5 | −10°, −5°, 0°, +5°, +10° | Exact fire angles |
| Blunderbuss | 5 | −15°, −7.5°, 0°, +7.5°, +15° | Representative — see note |
| Minigun | 3 | −2°, 0°, +2° | Representative — see note |
| Rocket | 1 | 0° | Single rocket, no change needed |
| Laser | 1 | 0° | See Feature 2 |
| Force Shield | 0 | — | No directional shot |
| Hyperspace | 0 | — | Already excluded from aim indicator |

### Representative vs exact

For **blunderbuss** and **minigun**, the actual fire angles are random (RNG at fire time), so showing exact paths is impossible. Instead we show lines that communicate the spread range:

- **Blunderbuss** fires 11 bullets at random angles within ±15° at low speed. Showing all 11 would be a cluttered mess, and they'd be wrong anyway. 5 lines spanning the full ±15° cone clearly communicates "wide scatter shot". The lines at ±7.5° fill in the cone visually without overcrowding.
- **Minigun** fires 13 bullets at random angles within ±2° at high speed. 3 lines at ±2° and 0° communicates "tight spread, lots of bullets" without noise.

For **triple cannon** and **blaster**, the fire angles are deterministic and the lines are exact.

### Status

- All weapons: **working**

---

## Feature 2: Bullet path preview

### Goal

Show the gravity-curved path(s) that the bullets will likely travel. For weapons with a deterministic spread, show one path per bullet. For random-spread weapons, show representative paths that communicate the spread range. This feature is optional and off by default — it's a player aid, not a core UI element.

### Menu setting

Config panel option: **BULLET PATHS** with values **OFF / FULL / HALF / QUARTER**.

- **OFF** — no path preview drawn (default)
- **FULL** — path drawn up to 1 screen width in length
- **HALF** — path drawn up to half a screen width
- **QUARTER** — path drawn up to a quarter of a screen width
- **EIGHTH** — path drawn up to an eighth of a screen width

"Screen width" = 700 game units (the full game coordinate space). Paths are truncated when cumulative path length reaches the limit, regardless of whether the bullet would still be in-flight.

### Visual style

- **Solid line, not dashed** (dashes are reserved for the laser path preview — Feature 3)
- Starts semi-transparent near the station and **fades to fully transparent** at the cutoff length
- Alpha at any point = `startAlpha × (1 − distanceTravelled / maxLength)`
- Line width: 1.5px for centre path, 1px for flanking paths
- Colour: white for all bullet weapons

Centre path is more prominent than flanking paths — higher `startAlpha`:

| Role | startAlpha |
|---|---|
| Centre / only path | 0.7 |
| Flanking (exact spread) | 0.35 |
| Flanking (representative spread) | 0.25 |

### Per-weapon paths

| Weapon | Paths | Angles | Type |
|---|---|---|---|
| Cannon | 1 | 0° | Exact |
| Triple Cannon | 3 | −5°, 0°, +5° | Exact |
| Blaster | 5 | −10°, −5°, 0°, +5°, +10° | Exact |
| Blunderbuss | 3 | −15°, 0°, +15° | Representative |
| Minigun | 3 | −2°, 0°, +2° | Representative |
| Rocket | 0 | — | Not applicable — self-propelled, path is not predictable |
| Laser | 0 | — | See Feature 3 |
| Force Shield | 0 | — | No shot |

**Blunderbuss representative paths:** The actual spread is 11 bullets at random ±15°. Showing 3 paths at the extremes and centre communicates "this fans out widely" without pretending to show exact trajectories. Fewer paths than Feature 1's 5 aim lines because the paths themselves are thicker and more visually prominent.

**Minigun representative paths:** The actual spread is 13 bullets at random ±2°. 3 paths at ±2° and 0° show the tight cluster. The high bullet speed means these paths curve less than cannon shots — the preview is less "guidance" and more "reassurance that they go roughly forward".

**Rocket:** Rocket thrust overrides gravity — any simulated path would be misleading. No path preview.

### Simulation

Uses `_computeBulletPreviewPath(station, angleDeg, power, planets, maxLength)` in `Renderer.js`. The function uses coarse stepping (`STEP_SIZE=20`, same as the AI simulator) and stops when cumulative path length exceeds `maxLength` or the bullet exits the extended play area.

For weapons with a **fixed speed** independent of `station.power` (blaster, blunderbuss, minigun), the speed is passed explicitly rather than derived from the power slider.

| Weapon | Speed passed to simulation |
|---|---|
| Cannon | `station.power` (standard) |
| Triple Cannon | `station.power` (standard) |
| Blaster | `MAX_V × 0.55` (fixed) |
| Blunderbuss | `MAX_V × 0.275` (midpoint of 0.25–0.30 range) |
| Minigun | `MAX_V × 1.5` (fixed) |

### Status

Not yet implemented. `_computeBulletPreviewPath` exists in `Renderer.js` as infrastructure but is not called. Path preview is disabled for all weapons pending this feature's implementation.

---

## Feature 3: Ghost trail

### Goal

During a station's aiming phase, show the path(s) of every bullet fired on that station's **previous turn** as dashed lines across the play area. This lets the player see where their shot actually went — especially useful for adjusting aim after a near-miss or seeing how gravity bent the trajectory.

If the previous turn fired multiple bullets, all of their trails are shown.

### Visual style

- Dashed line: `[5, 5]` (reserved for ghost trail — do not use this dash pattern elsewhere)
- Colour: station team colour at ~0.55 alpha
- Line width: `max(1, conv × 0.7)` (scales with viewport)
- Wormhole jumps: a `null` sentinel in the trail data lifts the pen, so pre- and post-wormhole segments are drawn separately with a visual gap. The full path including the post-wormhole segment is always shown.

### When shown

Displayed during `AIMING` and `TP_AIMING` modes, only when `waitingForInput` is true (human turn only). Hidden during firing phase and AI turns.

### Multi-bullet turns

If the previous turn fired multiple bullets (triple cannon, blaster, blunderbuss, minigun), **all** bullet trails are drawn. Each is drawn in the same colour/style — no distinction between bullets of the same weapon.

| Weapon | Trails shown |
|---|---|
| Cannon | 1 |
| Triple Cannon | 3 |
| Blaster | 5 |
| Blunderbuss | 11 |
| Minigun | 13 |
| Rocket | 1 |
| Laser | 1 (the laser path — see note) |

**Blunderbuss / Minigun:** Yes, show all 11 / 13 trails. They fired, they all went somewhere, the player deserves to see where. The trails will naturally cluster and overlap — this is informative, not clutter.

**Laser:** The laser uses a different trail mechanism (VFX path, not a bullet trail). Laser ghost trail handling is deferred to Feature 4.

### Current state and what needs changing

**Currently:** `station.lastTrail` is a single `Vec2[] | null`. When multiple bullets are fired in a turn, each bullet overwrites `lastTrail` as it expires — so only the **last** bullet's trail survives. For triple cannon, two of the three trails are lost.

**Required change:** Replace `station.lastTrail` with `station.lastTrails: Vec2[][] | null` — an array of trails, one per bullet.

- In `Station.js`: change field declaration from `lastTrail = null` to `lastTrails = null`
- In `GameLoop.js` (firing phase): when a station fires, reset `station.lastTrails = []` at the moment of firing. As each bullet from that station expires, **append** its trail: `bullet.owner.lastTrails.push([...bullet.trail])`
- In `Renderer.js` (`_drawGhostTrail`): iterate over all trails in `station.lastTrails` and draw each one using the same dashed style
- The ghost aim line (`station.lastAngle` / `station.lastPower`) is a separate mechanism and does not change

### Ghost aim line (separate, unchanged)

The short dashed line inside the aim circle that shows the angle+power of the last shot is driven by `station.lastAngle` and `station.lastPower`. This is distinct from the ghost trail and is not changing.

---

## Feature 4: Laser path preview

> To be specced separately once Features 1–3 are complete.

The laser aim line should show the actual curved path the beam will travel through gravity, as a dashed arc in team colour. A simulation already exists in `_computeLaserPreviewPath` but has not been confirmed working in-game. Dashed style is reserved for this feature.
