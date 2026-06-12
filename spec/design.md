# DeathStarBattles — Technical Design

> Translates [requirements.md](requirements.md) into concrete implementation decisions: architecture, class model, rendering pipeline, physics, AI, and file structure.

---

## 1. Technology Decisions

| Concern | Decision | Rationale |
|---|---|---|
| Language | Vanilla ES2022 (classes, modules, `??`, `?.`) | No build step; runs directly in browser via `<script type="module">` |
| Rendering | HTML5 Canvas 2D API | Matches original; sufficient for 2D pixel-art-style game |
| Module system | Native ES modules (`import`/`export`) | No bundler needed; works in all modern browsers over a local server (VS Code Live Server) |
| Physics | Semi-implicit Euler (matches original) | Faithful reproduction; author acknowledged the drift and accepted it |
| Structure | One `index.html` + `src/` module tree | Easy to open, easy to read, no config files |
| Dependencies | None | Zero setup friction |

---

## 2. File Structure

```
DeathStarBattles/
├── index.html              ← entry point; loads src/main.js as module
├── src/
│   ├── main.js             ← bootstraps game, wires everything together
│   ├── core/
│   │   ├── Vec2.js         ← 2D vector math helper
│   │   ├── GameState.js    ← authoritative game state, turn machine
│   │   └── GameLoop.js     ← requestAnimationFrame driver
│   ├── entities/
│   │   ├── Planet.js       ← all planet/star/wormhole types
│   │   ├── Station.js      ← player station
│   │   ├── Bullet.js       ← projectile in flight
│   │   ├── Team.js         ← team + cumulative stats + weapon stock
│   │   └── Collectable.js  ← collectable gem entity + WeaponId enum
│   ├── physics/
│   │   └── PhysicsEngine.js
│   ├── rendering/
│   │   ├── Renderer.js       ← composites the three layers; collectable + VFX drawing
│   │   ├── PlanetRenderer.js
│   │   └── sprites/
│   │       ├── SpriteRenderer.js     ← initSprite(), drawSprite() — entity-agnostic vector draw
│   │       ├── SpriteSheetCache.js   ← per-team pre-baked animation frames for mass drawing
│   │       ├── spriteUtils.js        ← interpolateKeyframes(), resolveColor(), lerp
│   │       ├── index.js              ← sprite registry: getSprite(name)
│   │       └── ufo.sprite.js         ← GENERATED — do not edit; run scripts/build-sprites.mjs
│   ├── ai/
│   │   ├── AIController.js ← base class + factory
│   │   ├── RandBot.js
│   │   ├── AimBot.js
│   │   ├── CleverBot.js    ← also base for Superbot/Megabot (SimBot)
│   │   ├── SuperBot.js
│   │   └── MegaBot.js
│   ├── scenarios/
│   │   ├── ScenarioFactory.js
│   │   └── scenarioData.js ← per-scenario config constants
│   ├── input/
│   │   └── InputHandler.js
│   └── ui/
│       ├── ConfigPanel.js  ← pre-game setup panel (DOM); responsive paged layout
│       ├── AimControls.js  ← hold-to-repeat angle/power DOM buttons
│       └── WeaponSelector.js ← weapon popup selector (DOM)
├── assets/
│   └── sprites/
│       └── ufo.svg                   ← artist source for the UFO sprite
├── scripts/
│   └── build-sprites.mjs             ← SVG → sprite.js converter; run after artwork changes
└── spec/
    ├── requirements.md
    ├── design.md
    ├── tasks.md
    ├── space-mammoth-sprite-spec.md  ← full sprite system spec
    └── futureDesignThoughts.md
```

---

## 3. Class Model

### 3.1 `Vec2`
Immutable 2D vector. All positions and velocities are `Vec2`.

```js
class Vec2 {
  constructor(x, y)
  add(v)          // returns new Vec2
  sub(v)
  scale(s)
  dot(v)
  magnitude()
  normalised()
  distanceTo(v)   // scalar
  distanceSqTo(v) // avoids sqrt — used in hot physics loop
  angle()         // radians from +x axis
}
```

### 3.2 `Planet`

```js
class Planet {
  position   // Vec2
  radius     // float (simulation units)
  density    // float
  type       // PlanetType enum (see §3.2.1)
  colour     // CSS colour string
  shading    // ShadingStyle enum
  halo       // float multiplier (1.0 = normal, >1 = white hole glow)
  partner    // Planet | null  — wormhole destination (null for non-wormhole types)

  get mass()           // radius² × density
  get impactRadius()   // pixel radius for collision (may differ from draw radius)
}
```

#### 3.2.1 `PlanetType` enum

```js
const PlanetType = Object.freeze({
  ROCKY:            'rocky',        // explode on impact
  ASTEROID:         'asteroid',     // explode on impact; fragments into children
  CRYSTAL:          'crystal',      // bullet PASSES THROUGH; asteroid shatters into Crystal children
  STAR:             'star',         // explode on impact
  JOVIAN:           'jovian',       // explode on impact
  WHITE_DWARF:      'whiteDwarf',   // explode; tiny radius, very high density
  BLACK_HOLE:       'blackHole',    // vanish silently; near-invisible draw
  WHITE_HOLE:       'whiteHole',    // vanish silently; negative mass (repels)
  WORMHOLE_PAIRED:  'wormholePaired',   // teleport to partner
  WORMHOLE_CYCLIC:  'wormholeCyclic',   // teleport to next in chain
  WORMHOLE_RANDOM:  'wormholeRandom',   // teleport to random map position
  WORMHOLE_PLANET:  'wormholePlanet',   // teleport to near a random planet
  WORMHOLE_SELF:    'wormholeSelf',     // teleport back near same wormhole
});
```

`Planet` also carries a `rich` boolean flag (default `false`). A Rich Asteroid is an `ASTEROID` with `rich = true` — rendered with a blue-brown tint, and on destruction spawns one `Collectable` in addition to its normal child fragments. Only 5% of asteroids are marked `rich`, and only when the Collectables setting is ON.

#### 3.2.2 `ShadingStyle` enum

```js
const ShadingStyle = Object.freeze({
  NONE:     0,  // black hole — draw only if toggled debug
  ROCKY:    1,  // simple dark-side shading
  GLOWING:  2,  // star — bright core + corona
  WORMHOLE: 3,  // pulsing ring
});
```

### 3.3 `Station`

```js
class Station {
  id             // int
  team           // Team reference
  position       // Vec2
  size           // StationSize enum (MICRO→MAMMOTH, maps to radius)
  angle          // int 0–359
  power          // int 1–800
  selectedWeapon // WeaponId — reset to CANNON at start of each AIMING phase

  status         // StationStatus: ACTIVE | EXPLODING | DEAD
  explosionT     // float 0→1 animation progress when EXPLODING

  // cumulative stats (persisted across tournament)
  stats          // StationStats object (see §3.3.1)

  get radius()          // float, derived from size
  get colour()          // from team
  get hyperspaceQueued() // computed: selectedWeapon === WeaponId.HYPERSPACE
                         // kept for backward-compatible reads; no setter
}
```

#### 3.3.1 `StationStats`

```js
class StationStats {
  turns = 0
  shots = 0
  kills = 0
  ownGoals = 0
  suicides = 0
  survived = 0
  killedBy = null       // Station | null
  // kill type breakdown
  strategyKills = 0
  oppressionKills = 0
  tacticsKills = 0
  bullyKills = 0
  longshotKills = 0
  closeshotKills = 0
  vengeanceKills = 0
  totalPower = 0        // sum of power values fired
}
```

### 3.4 `Bullet`

```js
class Bullet {
  owner          // Station reference
  position       // Vec2 (current)
  velocity       // Vec2 (current)
  status         // BulletStatus: ACTIVE | EXPLODING | DEAD
  trail          // Vec2[]  — sampled every printevery steps
  teleportCount  // int — max 100 before forced destruction
  explosionT     // float 0→1
  lifetime       // int step counter
}
```

### 3.5 `Team`

```js
class Team {
  index          // int 0–11
  colour         // CSS colour string
  stations       // Station[]
  controller     // AIController | null (null = human)

  // cumulative tournament stats
  wins = 0
  score = 0      // wins + kills + survivors - ownGoals
  kills = 0
  ownGoals = 0
  suicides = 0
  shots = 0
  survived = 0
  turns = 0

  // collectable weapon stocks — shared across all stations; persist across tournament games
  weaponStock    // Map<WeaponId, int>  (absent key = 0 uses)
  getStock(weaponId)         // returns 0 if key absent
  addStock(weaponId, n)      // increments by n
  spendStock(weaponId)       // decrements by 1; returns false if stock is 0
}
```

### 3.6 `GameState`

Central read-only-from-outside state object. All mutation goes through `GameState` methods.

```js
class GameState {
  // Setup
  config         // GameConfig (players, scenario, AI level, size, etc.)
  scenario       // Scenario instance

  // World
  planets        // Planet[]
  teams          // Team[]
  stars          // StarField (static background data)

  // Turn tracking
  mode           // GameMode enum (see §3.6.1)
  turn           // int
  gameIndex      // int (for tournament)
  currentTeamIdx // int
  currentStatIdx // int within team (for multi-station teams)
  winner         // Team | null | undefined (undefined = no result yet)

  // Active turn data
  activeBullets  // Bullet[]
  collectables   // Collectable[]  — alive collectables on the map (max 3 at once)
  vfxList        // ActiveVFX[] — short-lived visual effects (shatter, grant text, muzzle)

  // Derived helpers
  get activeStation()
  get allStations()
  get aliveTeams()
  isHumanTurn()
  advance()          // progress turn machine — called by GameLoop
}
```

#### 3.6.1 `GameMode` enum

```js
const GameMode = Object.freeze({
  CONFIG:   'config',   // pre-game setup screen
  DEMO:     'demo',     // auto-play AI demo before first config
  AIMING:   'aiming',  // human/AI players are choosing angle+power
  FIRING:   'firing',  // all bullets in flight, simulation running
  RESULTS:  'results', // round resolved, brief pause showing outcome
  GAMEOVER: 'gameover',// winner determined
  AWARDS:   'awards',  // tournament awards screen (every 5 games)
});
```

---

## 4. Physics Engine

### 4.1 Constants

```js
const G          = 0.2;
const TIMESTEP   = 0.15;
const PRINT_EVERY = 10;   // record trail point every N steps
const SHOW_EVERY  = 10;   // repaint every N trail-record events
const BULLET_LIFE = 8000; // max steps before bullet expires
const MAX_TELEPORTS = 100;
const MIN_POWER   = 0.2;
const MAX_POWER   = 0.8;
```

### 4.2 `PhysicsEngine`

```js
class PhysicsEngine {
  // Advance bullet one TIMESTEP.
  // Mutates bullet.position, bullet.velocity in place.
  step(bullet, planets) {}

  // Check all collision conditions for bullet against planets + stations.
  // Returns CollisionResult | null.
  checkCollisions(bullet, planets, stations) {}

  // Fast trajectory simulation for AI.
  // Returns closest distance to targetStation over simSteps steps.
  simulate(angle, power, fromStation, targetStation, planets, {
    stepSize    = 20,
    simSteps    = 400,
    useWormholes = false,
  }) {}

  // Compute initial bullet position and velocity from angle/power/station.
  initialState(angle, power, station) {}
}
```

### 4.3 Gravity Step (semi-implicit Euler)

For each planet `p` and bullet `b`:
```
deltaX = p.position.x - b.position.x
deltaY = p.position.y - b.position.y
rSquared = deltaX² + deltaY²

if rSquared < p.radius²:
  → handle impact (see §4.4)
else:
  accel = sign * G * p.mass / rSquared
  b.velocity.x += cos(theta) * accel * TIMESTEP
  b.velocity.y += sin(theta) * accel * TIMESTEP

b.position.x += b.velocity.x * TIMESTEP
b.position.y += b.velocity.y * TIMESTEP
```

Note: this is the same Euler method as the original. Known drift near extreme gravity wells (e.g. single black hole) is accepted — it's part of the original game's character.

### 4.4 Collision Response

| Planet type | Response |
|---|---|
| ROCKY / ASTEROID / STAR / JOVIAN / WHITE_DWARF | `bullet.status = EXPLODING` |
| CRYSTAL | `planet.destroyed = true` only — bullet continues flying unchanged |
| BLACK_HOLE | `bullet.status = EXPLODING; bullet.explosionT = 30` (silent, trail allowed to catch up) |
| WHITE_HOLE | Same as BLACK_HOLE (repels via negative mass, but impact still destroys) |
| WORMHOLE_* | Teleport bullet to exit position; preserve velocity direction; increment `teleportCount`; if `teleportCount >= MAX_TELEPORTS` destroy bullet |
| Station hit | Bullet `EXPLODING`, station `EXPLODING`; update kill stats |

#### 4.4.1 Wormhole Exit Position
When a bullet exits a wormhole, its position is set to:
```
exitPos = partner.position + normalised(bullet.velocity) * (partner.radius + 0.5)
```
Velocity direction is preserved; magnitude is unchanged.

### 4.5 Play Boundary
If bullet position goes outside `[-width, 2*width] × [-width, height + width]`, bullet is set to `DEAD` (no explosion). This matches the original's extended boundary.

---

## 5. Rendering Pipeline

### 5.1 Three Canvas Layers

```html
<canvas id="canvas-bg">      <!-- Layer 0: stars + planets -->
<canvas id="canvas-trails">  <!-- Layer 1: bullet trail polylines -->
<canvas id="canvas-main">    <!-- Layer 2: composite; stations, bullets, HUD -->
```

All three are the same size. Only `canvas-main` is visible to the user (the other two are off-screen canvases drawn via `drawImage`).

```
Every frame:
  ctx.main.clearRect(...)
  ctx.main.drawImage(canvas-bg, 0, 0)       ← background
  ctx.main.drawImage(canvas-trails, 0, 0)   ← accumulated trails
  drawLiveLayer(ctx.main)                   ← stations, bullets, HUD
```

Layer 0 is drawn once per new game (planets don't move).
Layer 1 is cleared at the start of each new turn, then bullet trail points are appended to it during the fire phase.
Layer 2 is redrawn every animation frame.

### 5.2 `Renderer`

```js
class Renderer {
  constructor(canvasBg, canvasTrails, canvasMain)

  // Called once per game
  drawBackground(stars, planets)

  // Called each sim step when a trail point is recorded
  appendTrailPoint(bullet)

  // Called at turn start
  clearTrails()

  // Called every animation frame
  drawFrame(gameState)

  // --- sub-renderers ---
  drawPlanet(ctx, planet)    // dispatches by planet type
  drawRockyPlanet(ctx, planet)
  drawStar(ctx, planet)      // bright core + corona (§5.3)
  drawWormhole(ctx, planet)  // pulsing ring
  drawBlackHole(ctx, planet) // near-invisible; faint distortion ring only
  drawWhiteHole(ctx, planet) // bright glow halo
  drawStation(ctx, station, isActive)
  drawAimingIndicator(ctx, station)
  drawBullet(ctx, bullet)
  drawExplosion(ctx, bullet)
  drawHUD(ctx, gameState)
  drawStationExplosion(ctx, station)
}
```

### 5.3 Star Corona Effect
From the screenshots the corona is a dense bristly halo — not a smooth gradient. Implementation:

```
For each star:
  1. Draw filled circle in star colour (the core).
  2. Draw a second filled circle slightly larger in a darker shade (the inner corona).
  3. Draw N radial strokes (N ≈ 200–400) from the star surface outward:
     - Each stroke: length = random(0.15*r, 0.45*r)
     - Colour: darker variant of star colour, low opacity
     - Stroke width: 1–2px
     - Start radius: random(0.9*r, 1.05*r) — bristles emerge from just inside the surface
  4. No smooth gradient — the bristly texture is the key look.
```

### 5.4 Station Visual

#### Procedural renderer (all modes except `experimental`)
Station = Death Star icon, drawn procedurally on canvas. Scaled by station size.

```
For each station:
  1. Filled circle in team colour (the sphere body)
  2. Darker horizontal line across the equator (the trench)
  3. Small filled grey/dark hemisphere on the upper-right quadrant (the superlaser dish dome)
  4. Tiny circle highlight on the dome (the dish aperture)
```

At Micro/Tiny sizes (radius < 8px) the dome detail is omitted — only the sphere + trench line render, keeping it readable. At Medium and above all four elements render.

The team colour is the dominant visual identifier; the Death Star detailing is secondary.

#### Sprite renderer (`experimental` mode only)
When `_performance === 'experimental'`, normal (non-drone, non-target) stations are drawn from the generic sprite system instead of the procedural renderer. The active sprite is `'ufo'` — a flying saucer silhouette with team-coloured engine glow, rim trim, and porthole ring. See `spec/space-mammoth-sprite-spec.md` for the full pipeline spec; see §15.10 for the performance strategy.

The sprite renderer is engaged per-ship via `Renderer._drawSpriteStation()`; all overlays (armour, frozen, electrified, mind control) still draw on top through the existing overlay pipeline.

The **aiming indicator**: white circle at `stationBoxRadius` + single white line from centre to circumference in the firing direction. Drawn on Layer 2 only for the currently active station.

### 5.5 Coordinate System
The simulation runs in **game units** (approximately 0–700 horizontal, 0–500 vertical for the original 700×500 canvas). The renderer scales game units to pixels via a `conv` factor:
```
conv = canvasWidth / 700
```
All positions stored as game units; multiply by `conv` to get pixel coordinates.

### 5.6 HUD Elements (drawn on Layer 2)
All drawn directly on the canvas, not DOM:

| Element | Position | Style |
|---|---|---|
| "Team N   Station N" | Top-centre | Large, bold, monospace, team colour |
| "Angle:NNN" | Bottom-left | Large white monospace |
| "Power:NN.N" | Bottom-right | Large white monospace |
| "HYPERSPACING..." | Replaces angle/power | Pulsing team colour text |
| Winner announcement | Centre | Large, animated |

---

## 6. Scenario System

### 6.1 `ScenarioFactory`

```js
class ScenarioFactory {
  // Returns an array of Planet objects for the given scenario.
  // nPlanets may be overridden by scenario constraints.
  // collectables: 'off' | 'rare' | 'normal' | 'common' | 'continuous'
  //   When 'off', no asteroids are marked rich (no blue-brown tint).
  static create(scenarioId, width, height, nPlanets, rng,
                wildcardFrequency = 'rare', performance = 'full', collectables = 'off') {}

  // Lucky dip — weighted random scenario selection.
  // 25% → scenarios 1–6; 63% → 1–19; 12% → full 1–28 pool.
  static randomId(rng) {}
}
```

### 6.2 `scenarioData.js` Structure

Each scenario is a config object:

```js
{
  id: 1,
  name: 'Planetary',
  // placement envelope for random planets: pos = (A*r1 + B*r2)*dim + C*dim
  A: 0.4, B: 0.4, C: 0.1,
  // size envelope: radius = D*r1 + E*r2 + F
  D: 30.0, E: 30.0, F: 10.0,
  density: 0.03,
  shading: ShadingStyle.ROCKY,
  impactOnHit: 'explode',
  baseColour: [150, 120, 80],
  maxPlanets: 10,
  // function to place any fixed/special planets before random ones:
  placeFixed: (config, rng) => [],   // returns Planet[] for the fixed bodies
}
```

The `ScenarioFactory.create()` method:
1. Calls `placeFixed()` to get any pre-placed bodies (e.g. the central star in scenario 3)
2. Randomly generates remaining planets using the envelope parameters
3. Validates placement (no overlap, ≥25% free area) with retry loop
4. Places stations after planets are confirmed
5. Optionally injects random bonus features (§6.1 of requirements)

### 6.3 Random Number Generator
Use a **seeded PRNG** (mulberry32 or similar) so each game is reproducible from its seed. Store the seed in `GameConfig` so replays are possible in the future.

```js
class RNG {
  constructor(seed)
  next()        // float in [0, 1)
  nextInt(n)    // int in [0, n)
  nextInRange(min, max)
}
```

---

## 7. AI System

### 7.1 Class Hierarchy

```
AIController (abstract)
├── RandBot       (level 1)
├── AimBot        (level 2)
└── SimBot        (abstract base for simulation-based bots)
    ├── CleverBot (level 3)
    ├── SuperBot  (level 4)
    └── MegaBot   (level 5)
```

```js
class AIController {
  constructor(level)
  // Returns the action this AI chooses for the given station.
  // Called during AIMING mode.
  chooseAction(station, gameState) // → { angle, power, weapon: WeaponId }
}
```

### 7.2 `SimBot` — Simulation-Based AI

Shared simulation loop used by Cleverbot, Superbot, Megabot:

```js
class SimBot extends AIController {
  // Per-target memory: best known angle/power from previous turns
  #memory = new Map()  // key: `${shooterIdx}-${targetIdx}`, value: {angle, power}

  chooseAction(station, gameState) {
    const target = this.#selectTarget(station, gameState)
    const { angle, power } = this.#findBestShot(station, target, gameState)
    const weapon = this.#chooseWeapon(station, gameState)  // WeaponId
    return { angle, power, weapon }
  }

  #findBestShot(station, target, gameState) {
    // 1. Seed from memory (or random if no memory)
    // 2. Run `times` simulation attempts
    // 3. Return the attempt with smallest closest-approach distance
  }

  #selectTarget(station, gameState) { /* overridden by subclasses */ }
  #shouldHyperspace(station, gameState) { /* overridden by subclasses */ }

  // Simulation parameters — overridden per subclass:
  get stepSize()   { return 20 }
  get simSteps()   { return 400 }
  get times()      { return 2 }
  get useWormholes() { return false }
}
```

### 7.3 Simulation Parameters per Level

| Bot | stepSize | simSteps | times (turn≥8) | wormholes |
|---|---|---|---|---|
| CleverBot | 10 | 800 | 8 | No |
| SuperBot | 10 | 800 | 25 | Yes (turn≥3) |
| MegaBot | 5 | 2000 | 50 | Yes (always) |

### 7.4 Target Selection

| Bot | Strategy |
|---|---|
| RandBot / AimBot | Random enemy station |
| CleverBot | Random enemy station |
| SuperBot | Prefer close enemies; retry if selected too many times without valid target |
| MegaBot | Prefer enemies from the highest-scoring team; deprioritise already-losing team; teammates avoid duplicating targets |

### 7.5 Hyperspace Decision

| Bot | Trigger |
|---|---|
| RandBot | 18% random chance |
| AimBot | 14% random chance |
| CleverBot | 11% random chance |
| SuperBot | Threshold based on closest-approach distance and total planet mass |
| MegaBot | As Superbot but with awareness of leaderboard position |

---

## 8. Input Handling

### 8.1 `InputHandler`

```js
class InputHandler {
  constructor(canvas, gameState, onAction)
  // onAction callback: called with { type: 'angleChange'|'powerChange'|'fire'|'hyperspace'|'pause'|'step' }

  // Mouse: click+drag within stationBoxRadius of active station
  #onMouseDown(e)
  #onMouseMove(e)

  // Keyboard bindings (only active during AIMING mode for human player)
  // Z/X  → angle ±1, A/S → angle ±5
  // K/M  → power ±1, J/N → power ±10
  // H    → cycle weapons / open weapon selector popup (see §13.8)
  // Enter → end turn
  // P    → pause/unpause (any mode)
  // O    → slow-motion step-through (hold while paused; reduces SHOW_EVERY to 1)
  #onKeyDown(e)
}
```

### 8.2 Mouse Aiming
When the user clicks within `stationBoxRadius` of the active station:
```
deltaX = mouseX/conv - station.position.x
deltaY = mouseY/conv - station.position.y
theta  = atan2(deltaY, deltaX) → convert to game angle convention
length = sqrt(deltaX² + deltaY²) * conv
fraction = clamp((length - arrowMinRadius) / (boxRadius - arrowMinRadius), 0, 1)
power = round(800 * fraction) + 1
```
The `arrowMinRadius` ensures the inner dead zone (near the station icon) doesn't set power to 0.

---

## 9. Game State Machine

```
CONFIG ──────────────────────────────────────→ DEMO
  │                                              │
  │ [Start Game pressed]                         │ [any key / click]
  ↓                                              ↓
AIMING ←──────────────────────────────────── AIMING
  │                                              ↑
  │ [all stations have acted]                    │ [new turn, no winner]
  ↓                                              │
FIRING ────────────────────────────────────→ RESULTS
                                                 │
                                                 ├─ [winner found] ──→ GAMEOVER
                                                 │
                                                 └─ [every 5 games] ─→ AWARDS ──→ AIMING
```

### 9.1 Turn Progression

Within `AIMING` mode, the station pointer advances through stations in order:
1. For each station: if AI → `controller.chooseAction()` is called immediately
2. If human → wait for input
3. Stations with `status != ACTIVE` are skipped
4. Once all stations have acted → transition to `FIRING`

### 9.2 Firing Resolution

`FIRING` runs the physics loop. Each tick:
1. For each active bullet: `physicsEngine.step(bullet, planets)`
2. `physicsEngine.checkCollisions(bullet, planets, stations)` — handles planet/station hits
3. `physicsEngine.checkCollectableCollision(bullet, gameState.collectables)` — collectable hit check (bullet continues; see §13.6)
4. Advance `vfxList` timers; prune completed VFX
5. Record trail points every `PRINT_EVERY` steps
6. Repaint every `PRINT_EVERY × SHOW_EVERY` steps
7. When all bullets are `DEAD` or `EXPLODING==done`:
   - Remove dead collectables from `gameState.collectables`
   - Process hyperspace queues (stations with `selectedWeapon === WeaponId.HYPERSPACE` teleport now)
   - Update leaderboard
   - Check win condition → RESULTS
   - Call `_trySpawnCollectable()` (see §13.5) before advancing to AIMING

### 9.3 Win Condition
```
aliveTeams = teams.filter(t => t.stations.some(s => s.status === ACTIVE))
if aliveTeams.length === 1 → winner = aliveTeams[0]
if aliveTeams.length === 0 → draw (no winner)
```

---

## 10. Config Panel (DOM-based)

The pre-game config panel is a DOM overlay (not canvas) styled to match the dark space aesthetic. All controls are `◄ value ►` cycle buttons — click either arrow to step through options.

### 10.1 Layout

**Primary section** (always visible):

```
┌─────────────────────────────────────┐
│  Death Star Battles                 │
│                                     │
│  PLAYERS        [ 4 players     ◄►] │
│  HUMAN / CPU    [ 1H  3 CPU     ◄►] │
│  STATIONS/PLAYER[ 2             ◄►] │
│  CPU LEVEL      [ SuperBot      ◄►] │
│                                     │
│  ＋ ADVANCED                        │  ← collapsible on large screens
│                                     │
│       [ START GAME ]                │
│  About  Instructions  …             │
└─────────────────────────────────────┘
```

**Advanced section** (collapsible; 12 rows across two logical pages):

| Row | Options |
|---|---|
| STATION SIZE | Micro / Tiny / Small / Medium / Large / Giant / Mammoth |
| PLANETS | Random / 3–50 |
| SCENARIO | 1–28 / Lucky Dip |

| MODE | Single Game / Tournament |
| GAME SPEED | ¼× / ½× / 1× / 2× / 4× |
| MOVEMENT SPEED | Off / Glacial / Slow / Normal / Fast / Rocket |
| PERFORMANCE | Full / Simplified |
| TEAM CLUSTERING | Off / Tight / Moderate / Loose |
| WILDCARD PLANETS | Off / Very Rare / Rare / Occasional / Common / Always |
| COLLECTABLES | Off / Rare / Normal / Common / Continuous |
| AIM CIRCLE SIZE | 0.5× / 1× / 2× / 3× |
| MINIMAL UI | Off / On |

### 10.2 Paged Layout

The config panel **always** uses the compact 4-page paged layout — no viewport detection, no flat mode.

- Page 1 **SETUP**: Players, Human/CPU, Stations/Player, CPU Level
- Page 2 **WORLD**: Station Size, Planets, Scenario, Mode, Game Speed, Movement Speed
- Page 3 **OPTIONS**: Performance, Team Clustering, Wildcard Planets, Aim Circle, Minimal UI
- Page 4 **COLLECTABLES**: Collectables (spawn frequency), Rich Asteroids, Collectable Size, Starting Weapons

Navigation: `◄  ● ○ ○ ○  ►` dot bar + Prev/Next buttons. Start button visible on all pages.

Page 4 sub-options (Rich Asteroids, Collectable Size, Starting Weapons) are greyed out (`opacity: 0.35`, `pointer-events: none`) when Collectables is set to Off. They update reactively whenever Collectables changes.

---

## 11. Tournament Leaderboard

Decision: show a **compact summary** in-game, full breakdown on the awards screen.

### 11.1 In-game overlay (always visible, collapsible)
Shows per-team: colour swatch | team name | score | kills | stations remaining.

### 11.2 End-of-game screen
Shows per-station: kills / shots / accuracy % / suicides / own goals / survived.

### 11.3 Awards screen (every 5 games)
Full per-kill-type breakdown. Awards badges for: Bloodlust / Oppression / Bully / Vengeance.

---

## 13. Special Weapons & Collectables

This section covers the design of weapon selection, the Triple Cannon, collectables, and their VFX. It augments the existing sections where noted.

---

### 13.1 Weapon Model

#### 13.1.1 `WeaponId` enum

```js
const WeaponId = Object.freeze({
  CANNON:        'cannon',        // default fire; infinite uses
  HYPERSPACE:    'hyperspace',    // teleport; infinite uses
  TRIPLE_CANNON: 'tripleCannon',  // 3 bullets ±5°; 3 charges per collectable
  BLUNDERBUSS:   'blunderbuss',   // 11 random-spread bullets; 2 charges per collectable
  LASER:         'laser',         // piercing beam, 100% gravity; 1 charge per collectable
  ROCKET:        'rocket',        // fuel-burning self-propelled projectile; 1 charge per collectable
  BLASTER:       'blaster',       // 5 successive shots; 3 charges per collectable
  MINIGUN:       'minigun',       // 13 rapid shots; 1 charge per collectable
  FORCE_SHIELD:  'forceShield',   // deflects all incoming; 2 charges per collectable
});
```

The enum is the single authoritative list of weapons. Adding a new weapon means adding one entry here and one entry to the stock map.

#### 13.1.2 Weapon stock on `Team`

```js
// added to Team
weaponStock = new Map()  // WeaponId → int (omitted key = 0 uses)

// helpers
getStock(weaponId)          // returns 0 if key absent
spendStock(weaponId)        // decrements by 1; throws if 0
addStock(weaponId, n)       // increments by n; creates entry if absent
```

Stock is **shared across all stations on the team**. In tournament mode stock carries over between games (it is not reset on `newGame()`).

#### 13.1.3 Per-turn weapon selection on `Station`

```js
// added/changed on Station
selectedWeapon = WeaponId.CANNON   // reset to CANNON at start of each AIMING phase
                                   // for this station

// hyperspaceQueued becomes a computed getter (no longer a plain bool):
get hyperspaceQueued() {
  return this.selectedWeapon === WeaponId.HYPERSPACE;
}
```

All existing code that reads `station.hyperspaceQueued` continues to work. The setter is removed; callers that previously wrote `station.hyperspaceQueued = true` are updated to `station.selectedWeapon = WeaponId.HYPERSPACE`.

#### 13.1.4 Action object (updated)

`AIController.chooseAction()` and all human-input finalisation now return:

```js
{ angle: int, power: int, weapon: WeaponId }
```

The old `hyperspace: bool` field is dropped. All AI bots are updated to return `weapon` instead.

---

### 13.2 Triple Cannon Firing

When a station fires with `weapon === WeaponId.TRIPLE_CANNON`:

1. **Consume one use** from `station.team.weaponStock` before any bullets spawn. If stock is somehow 0 (should not happen in normal play), fall back to `WeaponId.CANNON`.
2. **Spawn three bullets** at angles `[angle − 5, angle, angle + 5]` (degrees, wrapped mod 360). All three share the same `power` value. Each bullet is a normal `Bullet` instance with `owner = station`.
3. Add all three to `gameState.activeBullets`. Physics applies independently to each.
4. Each bullet gets its own trail drawn on Layer 1 in the team colour — visually identical to three normal bullets from the same station.
5. Any of the three can independently hit stations, planets, or collectables.

The spawning logic lives in `GameState._spawnBullets(station, action)`, which already handles the single-bullet cannon case. Triple Cannon is an additional branch in that method:

```js
_spawnBullets(station, action) {
  if (action.weapon === WeaponId.TRIPLE_CANNON) {
    station.team.spendStock(WeaponId.TRIPLE_CANNON);
    for (const dAngle of [-5, 0, 5]) {
      const bullet = this._makeBullet(station, (action.angle + dAngle + 360) % 360, action.power);
      this.activeBullets.push(bullet);
    }
  } else {
    this.activeBullets.push(this._makeBullet(station, action.angle, action.power));
  }
}
```

**Muzzle VFX**: A brief triple-arc flash is drawn on Layer 2 at the station position just before the bullets begin moving. This is a short-lived `ActiveVFX` of type `'tripleCannonMuzzle'` (lifetime ~0.2s) that draws three radiating arcs at ±5° around the firing direction in the team colour, fading out quickly.

---

### 13.3 `Collectable` Entity

```js
class Collectable {
  position    // Vec2 — stationary; never changes after spawn
  rotation    // float (radians) — increases each frame for spin animation
  alive       // bool
  radius      // float (game units) — collision radius; also governs draw size
              // fixed value: ~5 game units (roughly Tiny station size)
}
```

> **Naming note:** These entities are called `Collectable` / `collectables` in all code and docs. The name `Crystal` / `crystal` is **reserved** for a separate future entity type.

Collectables are **not** planets. They do not exert gravity. They are not in the `planets` array. They live in `gameState.collectables: Collectable[]`.

The `Collectable` entity has no physics state — it is purely a collision target and a rendering entity. The `rotation` field is advanced by the `Renderer` each frame (not by `GameLoop`/`PhysicsEngine`) since it is purely cosmetic.

---

### 13.4 Collectable Rendering

#### Layer assignment

Collectables rotate continuously, so they cannot be baked onto Layer 0 (background). They are drawn on **Layer 2** (live layer) every frame, after bullets and before HUD. This means they sit above planet backgrounds and trail lines visually, which is fine — collectables are foreground objects that need to be easily spotted.

#### Draw procedure

```
For each alive collectable:
  1. Save ctx
  2. Translate to collectable pixel position; rotate by collectable.rotation
  3. Draw outer ring: thin circle stroke in icy blue-white (#B8E8FF), alpha 0.6
  4. Draw 6 gem facets: lines from centre to outer points (like a gem cross-section),
     alternating long (0.9r) and short (0.5r) spokes
  5. Draw inner hexagon connecting the spoke tips, stroke only
  6. Draw a soft radial gradient glow: centre white, outer fully transparent,
     radius 1.5× collectable radius — gives icy luminescence against the dark field
  7. Restore ctx
```

Colour palette: core lines `#FFFFFF`, structure lines `#B8E8FF`, glow `rgba(184,232,255,0.15)`.

The rotation speed is a fixed constant (~0.02 radians per frame at 30fps → ~one full rotation per ~10 seconds).

---

### 13.5 Collectable Spawning

Collectables spawn at turn end, during the `RESULTS → AIMING` transition, after hyperspace teleports are executed.

```js
_trySpawnCollectable(config, rng, planets, teams) {
  if (config.collectables === 'off') return;
  if (this.collectables.length >= 3) return;  // cap

  const prob = { rare: 0.20, normal: 0.40, common: 0.75, continuous: 1.0 }[config.collectables];
  if (rng.next() > prob) return;

  const pos = this._findCollectableSpawnPos(rng, planets, teams);
  if (pos) this.collectables.push(new Collectable(pos, rng.next() * Math.PI * 2));
}
```

**Placement rules** (same RNG as everything else → reproducible):
- Not inside any planet's radius (checked against `planet.radius + collectable.radius`)
- Not within `3 × collectable.radius` of any alive station (avoids spawning on top of a player)
- Retry up to 200 times before giving up (cap still applies, so a failed spawn is silent)
- Does not spawn in the Hyperspace scenario (`scenarioId === 26`)

The placement retry loop is deliberately lighter than the station placement algorithm — a failed spawn is harmless.

**Rich Asteroid collectable**: when a Rich Asteroid fragments, the collectable is placed at the position of `centers[0]` and that child slot is skipped — the collectable replaces one fragment rather than spawning alongside a full set of children.

---

### 13.6 Bullet–Collectable Collision

Collectable collision is **not** handled inside `checkCollisions()` — that method handles interactions that stop or redirect the bullet. Collectables do not stop bullets. Instead a separate method is called for each active bullet each physics step:

```js
// PhysicsEngine
checkCollectableCollision(bullet, collectables) {
  // Returns the first collectable hit, or null.
  for (const collectable of collectables) {
    if (!collectable.alive) continue;
    if (bullet.position.distanceSqTo(collectable.position) < collectable.radius ** 2) {
      return collectable;
    }
  }
  return null;
}
```

Call site in `GameLoop._firingTick()`:

```js
const WEAPON_GRANTS = [
  { id: WeaponId.TRIPLE_CANNON, charges: 3,  label: 'TRIPLE CANNON'  },
  { id: WeaponId.BLUNDERBUSS,   charges: 2,  label: 'BLUNDERBUSS'    },
  { id: WeaponId.LASER,         charges: 1,  label: 'LASER'          },
  { id: WeaponId.ROCKET,        charges: 1,  label: 'ROCKET'         },
  { id: WeaponId.BLASTER,       charges: 3,  label: 'BLASTER'        },
  { id: WeaponId.MINIGUN,       charges: 1,  label: 'MINIGUN'        },
  { id: WeaponId.FORCE_SHIELD,  charges: 2,  label: 'FORCE SHIELD'   },
];

const hitCollectable = physicsEngine.checkCollectableCollision(bullet, gameState.collectables);
if (hitCollectable) {
  hitCollectable.alive = false;
  const grant = WEAPON_GRANTS[Math.floor(rng.next() * WEAPON_GRANTS.length)];
  bullet.owner.team.addStock(grant.id, grant.charges);
  gameState.vfxList.push(new CollectableShatterVFX(hitCollectable.position));
  gameState.vfxList.push(new CollectableGrantVFX(
    hitCollectable.position, grant.label, bullet.owner.team.colour
  ));
  // bullet continues — no status change
}
```

Dead collectables (`alive === false`) are pruned from `gameState.collectables` at the end of the FIRING phase, alongside the bullet cleanup pass.

---

### 13.7 VFX System

A new lightweight VFX list on `GameState`:

```js
vfxList = []   // ActiveVFX[]  — drawn on Layer 2, pruned when t >= 1
```

The `GameLoop` advances `t` each frame:
```js
for (const vfx of gameState.vfxList) vfx.t += deltaSeconds / vfx.duration;
gameState.vfxList = gameState.vfxList.filter(v => v.t < 1);
```

Two concrete VFX types:

#### `CollectableShatterVFX`

```js
class CollectableShatterVFX {
  type = 'collectableShatter'
  position   // Vec2
  duration = 0.6   // seconds
  t = 0

  // 10 shards, initialised at construction:
  shards = Array(10).fill(null).map(() => ({
    angle:  random(0, 2π),
    speed:  random(2, 8),     // game units/sec
    length: random(1, 3),     // game units
  }))
}
```

Draw: each shard is a short line segment starting at `position + velocity*t` in direction `angle`, colour `#B8E8FF`, alpha `1 - t` (fades out). The shard moves outward along its angle over the duration.

#### `CollectableGrantVFX`

```js
class CollectableGrantVFX {
  type = 'collectableGrant'
  position   // Vec2 (collectable location at time of collection)
  text       // string e.g. 'TRIPLE CANNON'
  colour     // CSS colour (team colour)
  duration = 2.0
  t = 0
}
```

Draw: text drawn at `position` offset upward by `t * 20` game units. Opacity follows a pulse: `sin(t * π)` (fade in from 0, peak at t=0.5, fade out to 0). Font matches HUD font (monospace bold), size ~14px screen.

#### `TripleCannonMuzzleVFX`

```js
class TripleCannonMuzzleVFX {
  type = 'tripleCannonMuzzle'
  position   // Vec2 (station position at fire time)
  angle      // int (firing angle in degrees)
  colour     // CSS colour (team colour)
  duration = 0.2
  t = 0
}
```

Draw: three short arc strokes at angles `[angle − 5, angle, angle + 5]` from the station, length proportional to `1 − t`, colour fading from team colour to transparent. Gives a brief visual cue that a special weapon was used.

---

### 13.8 Weapon Selector UI

The Hyperspace button in the bottom toolbar is replaced by a **weapon button**:

```
[ CANNON  ▲ ]
```

The label always reflects `station.selectedWeapon`. For limited weapons it appends the team's stock count: `TRIPLE CANNON [3]`. For infinite weapons no count is shown.

#### Popup trigger

- **H key** or **click on weapon button**: if the team has ≤ 2 available weapons (only Cannon + Hyperspace, no collectables), toggle directly without opening a popup. This preserves the original H-to-hyperspace feel when no collectables are in play.
- If ≥ 3 options: open the popup.

#### Popup DOM structure

The popup is a DOM element (not canvas) positioned above the weapon button using CSS `position: absolute`. It contains one row per available weapon:

```
┌────────────────────────┐
│  ▶ CANNON         (∞)  │
│    HYPERSPACE     (∞)  │
│    TRIPLE CANNON  [3]  │
└────────────────────────┘
   [ CANNON           ▲ ]
```

The currently selected weapon has a `▶` marker. Weapons with 0 stock are shown greyed out and are not selectable (they remain visible so the player knows the weapon exists).

The popup is managed by a new `WeaponSelector` UI class:

```js
class WeaponSelector {
  constructor(buttonEl, gameState, onWeaponChosen)

  refresh(station)        // rebuild popup rows from station.team.weaponStock
  open()
  close()
  toggle()
  isOpen()
}
```

`onWeaponChosen(weaponId)` is the callback wired to `station.selectedWeapon = weaponId` and the HUD update. The popup closes automatically on selection or on click-outside (standard DOM blur/click-outside pattern).

#### HUD update

The existing `"HYPERSPACING..."` full-canvas text replacement (§5.6) is triggered by `station.selectedWeapon === WeaponId.HYPERSPACE`, replacing the `hyperspaceQueued` check. No other HUD change is needed: angle/power remain visible for all weapons including Triple Cannon (the player still sets angle and power normally).

---

### 13.9 Config Panel Addition

A new cycle-button row in the Environment panel:

```
│  Collectables   [ Off            ▲▼]│
```

Options in order: `Off → Rare → Normal → Common → Continuous → Off`.

The value is stored in `GameConfig.collectables` (string, default `'off'`). It is passed to `_trySpawnCollectable()` each turn end.

---

### 13.10 AI Changes

#### Using collected weapons (all levels)

The base `AIController.chooseAction()` gains a post-selection step: if the team's `TRIPLE_CANNON` stock is > 0, apply a probability threshold to promote the weapon choice to `WeaponId.TRIPLE_CANNON`:

| Bot level | Triple Cannon use probability (if stock > 0) |
|---|---|
| RandBot | 40% |
| AimBot | 35% |
| CleverBot | 30% |
| SuperBot | 25% (prefers to save for strategic shots) |
| MegaBot | 25% |

This is applied after the angle/power decision — the bot uses its normal targeting logic and simply fires three bullets at that angle instead of one.

#### Collectable targeting (SuperBot + MegaBot only)

After computing `bestShot` for the primary enemy target, SuperBot and MegaBot run a quick secondary pass over all live collectables:

```
for each live collectable:
  simulate(bestShot.angle, bestShot.power, station, collectableAsTarget, planets)
  if closestApproach < collectable.radius * 2:
    // this shot already collects the collectable — no change needed
    note the collection as a side-effect
  else if team.getStock(TRIPLE_CANNON) < 2:
    // stock is low; try to find a shot that hits this collectable
    simulate with collectableAsTarget to find collectableShot
    if collectableShot.closestApproach < collectable.radius:
      // weigh collectable shot vs primary: choose collectable shot only if
      // primary shot closestApproach is > threshold (unlikely to score)
      if bestShot.closestApproach > COLLECTABLE_CHASE_THRESHOLD:
        choose collectableShot
```

`COLLECTABLE_CHASE_THRESHOLD` = 15 game units (roughly half a Large station radius). If the primary shot is already a good one, the bot ignores the collectable. It only diverts to collectable-hunting when its primary shot is poor.

This does not require any new simulation infrastructure — it reuses `PhysicsEngine.simulate()` with the collectable's position treated as a zero-radius target station.

---

### 13.11 Affected Files

| File | Change |
|---|---|
| `src/entities/Collectable.js` | **NEW** — Collectable entity + WeaponId enum |
| `src/entities/Team.js` | UPDATED — `weaponStock` map + `getStock` / `spendStock` / `addStock` |
| `src/entities/Station.js` | UPDATED — `selectedWeapon` field; `hyperspaceQueued` → computed getter |
| `src/physics/PhysicsEngine.js` | UPDATED — `checkCollectableCollision()` (separate from `checkCollisions()`) |
| `src/core/GameState.js` | UPDATED — `collectables[]`, `vfxList[]`, `_trySpawnCollectable()` |
| `src/core/GameLoop.js` | UPDATED — collectable collision call site, VFX advancement, `_fireAll` Triple Cannon path |
| `src/rendering/Renderer.js` | UPDATED — `_drawCollectables()`, `_drawVFX()` on Layer 2; collectable rotation advanced here |
| `src/ui/WeaponSelector.js` | **NEW** — DOM popup weapon selector |
| `src/ui/ConfigPanel.js` | UPDATED — Collectables cycle-button row |
| `src/ai/AIController.js` | UPDATED — `chooseAction` returns `weapon: WeaponId` not `hyperspace: bool` |
| `src/ai/RandBot.js` | UPDATED — weapon selection logic |
| `src/ai/AimBot.js` | UPDATED — weapon selection logic |
| `src/ai/CleverBot.js` | UPDATED — weapon selection logic |
| `src/ai/SuperBot.js` | UPDATED — weapon selection + collectable opportunism |
| `src/ai/MegaBot.js` | UPDATED — weapon selection + collectable opportunism |
| `src/main.js` | UPDATED — weapon button wires to WeaponSelector; GameState receives config |

---

### 13.12 Invariants & Edge Cases

| Case | Behaviour |
|---|---|
| Player selects Triple Cannon but stock reaches 0 before their turn | Weapon selector greys out the option; station falls back to Cannon if stock drops to 0 mid-turn (e.g. teammate fired last use on the same team's turn) |
| All three Triple Cannon bullets hit the same station | Station destroyed on first hit; remaining two bullets hit a dead/exploding station — treated as normal hits with no additional scoring |
| Triple Cannon bullet hits a collectable | Collectable destroyed, 3 uses awarded, bullet continues — same as any other bullet |
| Collectable spawns on top of another collectable | Placement validation checks other collectables' positions as well as planets/stations |
| All 3 simultaneous collectables destroyed in one turn | All three grant text VFX play concurrently; each awards 3 uses to the owning bullet's team independently |
| Collectable persists into a new game (tournament) | Collectables do **not** persist across games — `gameState.collectables` is cleared on `newGame()`. Weapon stocks persist; collectables do not |

---

## 14. Extended Weapons

This section covers the six additional special weapons beyond Triple Cannon. Each follows the same acquisition model (random weapon from collectable pickup) and the same WeaponSelector UI. Only implementation specifics are documented here.

---

### 14.1 Plasma Blunderbuss

**Charges per collectable:** 2

#### Firing

Spawns 11 bullets simultaneously at the start of the fire phase. For each bullet:
- Angle offset is sampled from a uniform distribution over `[−15°, +15°]` independently (not evenly spaced)
- Speed is sampled from `[0.25 × maxCannonSpeed, 0.30 × maxCannonSpeed]` independently
- `maxCannonSpeed` = the speed a Cannon shot would have at power 800

All 11 bullets are normal `Bullet` instances. Standard gravity applies. They share the firing station as `owner`.

#### Rendering
Trail lines are drawn at 30% opacity in the team colour (vs 100% for Cannon). Trail point sampling rate (`PRINT_EVERY`) is the same as normal bullets.

---

### 14.2 Laser

**Charges per collectable:** 1

#### Firing delay
The laser does not fire at the start of the fire phase. A `pendingLaser` entry is queued on `GameState` at the moment of firing:
```js
{ station, angle, delaySteps: 400 + Math.floor(rng.next() * 400) }  // 400–800 steps
```
The delay is randomised per station so multiple lasers firing in the same turn appear to fire at staggered intervals, creating visual interest. `GameLoop._firingTick()` decrements `delaySteps` each step. When it reaches 0, the laser simulation runs and the path is committed to the VFX list.

#### Path simulation
A fast internal simulation is run (not the normal physics loop):
- Initial speed: `200 × maxCannonSpeed` (effectively instantaneous relative to normal bullets)
- Gravity factor: `1.0` (100% of normal `G`) — visibly bends around neutron stars and black holes
- Terminates when: boundary exceeded, or `MAX_LASER_STEPS = 200` steps elapsed
- Simulation records a path as `Vec2[]` sampled every step

During path simulation, collision is checked against:
- **Stations**: station is marked destroyed; simulation continues past it
- **Asteroids/Crystals**: planet is marked destroyed; simulation continues past it
- **Force Shields**: velocity is reflected elastically off the shield boundary; simulation continues with new direction
- **Planets (non-destructible)**: simulation terminates (laser absorbed)

Kill attribution: all station kills credit `laser.owner`.

#### Rendering
The committed path is added as a `LaserVFX` to `vfxList`:
```js
{
  type: 'laser',
  path: Vec2[],          // in game units
  colour: teamColour,
  t: 0, duration: 1.5,   // fades over 1.5 seconds
}
```
Draw procedure each frame:
1. Draw the full path as a wide stroke (`lineWidth = 6px`) in the team colour at `alpha = sin(t × π) × 0.5` — glows in then fades out
2. Draw the same path as a narrow white stroke (`lineWidth = 2px`) at `alpha = sin(t × π)` — bright white core
The path persists as a VFX; it is not drawn on the trails canvas.

---

### 14.3 Rocket

**Charges per collectable:** 1

#### Entity
Rocket is a separate class (not `Bullet`) stored in `gameState.rockets: Rocket[]`:

```js
class Rocket {
  owner          // Station
  position       // Vec2
  velocity       // Vec2
  fuel           // float — decrements each step; 0 = ballistic
  status         // 'active' | 'exploding' | 'dead'
  trail          // Vec2[] — positions for particle trail rendering
  teleportCount  // int — wormhole traversal count (max 100)
}
```

**Fuel model**: `power` maps linearly to fuel mass (power 1 → `ROCKET_MIN_FUEL`, power 800 → `ROCKET_MAX_FUEL`). Each step while `fuel > 0`:
```
thrustAccel = ROCKET_THRUST / (ROCKET_BASE_MASS + fuel)
velocity += direction(velocity) × thrustAccel × TIMESTEP
fuel -= ROCKET_FUEL_BURN_RATE × TIMESTEP
```
When `fuel ≤ 0`: rocket becomes ballistic — normal gravity applies, no thrust.

**Tuned constants:**
```
ROCKET_BASE_MASS      = 1.0
ROCKET_MIN_FUEL       = 1.0   // power 1
ROCKET_MAX_FUEL       = 6.0   // power 800
ROCKET_THRUST         = 0.15  // slow build-up
ROCKET_FUEL_BURN_RATE = 0.5
ROCKET_LAUNCH_SPEED   = 0.15  // very slow initial speed
```

#### Planet interaction
- **Wormholes**: rocket teleports through all wormhole types (PAIRED, CYCLIC, NETWORK, PLANET, SELF, RANDOM) using the same teleport logic as bullets. Max 100 wormhole hops.
- **Gas giants**: rocket passes through without detonating (same as bullets).
- **All other planets**: rocket detonates on contact.

#### Expanding blast zone
When a rocket detonates, an expanding blast entry is created in `gameState.rocketBlasts`:
```js
{ x, y, maxRadius: ROCKET_BLAST_RADIUS, currentRadius: 1, owner, hitSet: Set() }
```
`ROCKET_BLAST_RADIUS = 46` game units (fixed, does not scale with station size).

Each rAF frame the blast expands by `maxRadius / 22` units (~22 frames to full size). Damage is applied progressively as the circle reaches each entity — not instantly. Any entity not yet in `hitSet` that falls within `currentRadius` is affected:
- Station: destroyed (kill credited to rocket owner)
- Bullet: destroyed
- Asteroid/Crystal: destroyed
- Collectable: destroyed; weapon granted to rocket owner's team (same as bullet collection)

The visual circle exactly matches `currentRadius` at all times — what you see is the true kill boundary.

#### Shoot-down
Each active bullet is checked against each active rocket every step. If `distanceSq(bullet.position, rocket.position) < ROCKET_HITBOX_RADIUS²`, the rocket detonates at its current position. `ROCKET_HITBOX_RADIUS = 8` game units.

#### Force Shield interaction
If a rocket's position enters a Force Shield boundary, it detonates immediately.

#### Off-screen indicator
Rockets show the same edge triangle + distance indicator as bullets when off-screen.

#### Smoke trail
Each rAF frame while active, one smoke puff is emitted just behind the rocket (offset along reverse velocity direction with small lateral jitter):
- **Phase 1** (first 18% of lifetime): radius expands quickly from 0 to `maxR` (3–7 game units, randomised); alpha holds at 0.5
- **Phase 2** (18–75% of lifetime): radius and alpha contract/fade at normal rate
- **Phase 3** (last 25% of lifetime): rate slows to 1/5× — puffs linger at ~65% of maxR at ~15% opacity, leaving a visible trail
- Total lifetime: ~160 rAF frames (~2.6 seconds at 60fps)

---

### 14.4 Blaster

**Charges per collectable:** 3

#### Burst firing
At the start of the fire phase, a burst queue entry is created:
```js
{ station, weapon: WeaponId.BLASTER, shotsRemaining: 5,
  intervalSteps: 600, nextFireStep: 0 }
```
Stored on `GameState.burstQueue` with `totalShots: 5`. Each `_firingTick()`:
- For each burst entry, when `currentStep >= nextFireStep`:
  - Compute shot index: `shotIdx = totalShots - shotsRemaining` (0–4)
  - Spawn one bullet at progressive angle offset: `angle + (-10 + shotIdx × 5)°` → −10°, −5°, 0°, +5°, +10°
  - Speed: `0.55 × maxCannonSpeed`
  - Decrement `shotsRemaining`; advance `nextFireStep += intervalSteps`
  - When `shotsRemaining === 0`, remove from queue

**Interval**: `600` simulation steps ≈ 1 real-time second at normal game speed.

Trail opacity: 30% (same as Blunderbuss).

---

### 14.5 Minigun

**Charges per collectable:** 1

Identical to Blaster except:
- 13 shots total
- `intervalSteps: 200` (3× faster than Blaster)
- `±2.0°` random angle offset per shot
- Speed: `1.5 × maxCannonSpeed`

Trail opacity: 50% semi-transparent.

---

### 14.6 Force Shield

**Charges per collectable:** 2

#### Activation
When a station selects Force Shield, no bullet is spawned. At the start of the fire phase:
- A `ForceShield` is added to `gameState.shields: ForceShield[]`:
```js
class ForceShield {
  station       // Station reference
  radius        // station.radius × 1.6
  alive         // bool — set false at turn end
}
```
- The station's HUD reads `"SHIELDED..."` replacing angle/power (same pattern as `"HYPERSPACING..."`), rendered in the team colour

#### Bullet reflection
Each active bullet is checked against each active shield each step. If `distance(bullet.position, shield.station.position) < shield.radius`:
```
normal = normalise(bullet.position − shield.station.position)
bullet.velocity = bullet.velocity − 2 × dot(bullet.velocity, normal) × normal
// push bullet just outside shield boundary to avoid re-triggering
bullet.position = shield.station.position + normal × (shield.radius + 0.1)
```
The bullet continues with the reflected velocity. It can kill any station it subsequently hits, including the original shooter.

#### Laser reflection
The laser path simulation (§14.2) checks shield boundaries during its step loop using the same reflection formula. The reflected path continues from the shield boundary.

#### Rocket interaction
Rockets that enter the shield boundary detonate immediately (§14.3).

#### Rendering
Drawn on Layer 2 every frame while `shield.alive`:
1. Pulsing outer ring: `radius + sin(t × 4π) × 3px` screen pixels, team colour at 60% opacity, `lineWidth = 2px`
2. Inner fill: team colour at 8% opacity (faint translucent dome)

Shields are removed from `gameState.shields` at the end of the firing phase (same cleanup pass as dead bullets).

---

### 14.7 AI Behaviour — New Weapons

All bots spend new weapon stocks with the same probability thresholds as Triple Cannon (§13.10), applied weapon-by-weapon based on stock availability. Priority order when multiple weapons are stocked: Laser > Rocket > Minigun > Triple Cannon > Blunderbuss > Blaster > Force Shield.

Force Shield: bots activate Force Shield when they have stock **and** the previous turn's incoming fire hit or nearly hit them (closest-approach distance < 2 × station radius for any enemy bullet last turn). Otherwise they save it.

---

## 15. Rendering Performance Architecture

This section documents the rendering pipeline design decisions, platform-specific behaviour, and the reasoning behind each optimisation. It supersedes the high-level sketch in §5.

---

### 15.1 Canvas Layer Architecture

The renderer uses three canvases, all the same pixel dimensions:

| Canvas | Updated when | Contents |
|---|---|---|
| `bgCanvas` | Once per new game (and on resize) | Stars, all static planet types, SVG overlays, atmosphere glows for rocky planets |
| `trailsCanvas` | Cleared each turn; trail points appended during fire phase | Bullet/rocket trail polylines |
| `mainCanvas` | Every rAF frame | Everything else: `drawImage(bg)`, `drawImage(trails)`, live layer |

The live layer draw order within each frame:

1. `drawImage(bgCanvas)` — static background
2. `drawImage(trailsCanvas)` — accumulated trails
3. Wormhole particles
4. Ship explosion bloom + fireballs + fireball smoke
5. Comet smoke / rocket smoke
6. Rocket blast zones + force shields
7. Rockets + trails
8. **Gas giant combined canvas** — drawn here so bullets/trails are underneath, selling the "fire through the gas giant" effect
9. Collectables + VFX overlays
10. Aiming indicator
11. HUD + overlay

Gas giants are the only planet type deliberately excluded from `bgCanvas`. Every other static body is baked there once. The reason is draw order: gas giants must composite over bullets and trails, so they cannot sit in the background layer.

---

### 15.2 Performance Modes

Four modes, exposed via the config panel. Two are hidden behind `Ctrl+Shift+D` dev mode.

| Mode | Explosion system | Particle rendering | Wormhole particles | Gas giant blur |
|---|---|---|---|---|
| `simplified` | Classic arc flash | Arc circles | Skipped entirely | None |
| `full` | Bloom + fireballs | Halo+core circles | Halo+core circles | Baked in |
| `experimental` *(dev)* | Bloom + fireballs | Bitmaps (desktop) / circles (iOS) | Gradients (desktop) / circles (iOS) | Skipped |
| `exp-ipad` *(dev)* | Bloom + fireballs | Halo+core circles | Halo+core circles | Skipped |

`experimental` auto-detects iOS/iPadOS at construction time:

```js
this._isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
              (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
```

The second condition catches modern iPads that report `MacIntel`. When `_isIOS` is true, `experimental` routes through the same circle path as `exp-ipad`.

---

### 15.3 Platform Rendering Characteristics

Understanding why certain approaches are fast or slow on each platform is essential for making correct trade-off decisions.

#### Desktop (Chrome/Firefox — Skia/ANGLE)

- `ctx.arc()` + `fill()` is GPU-accelerated via the Skia rasteriser.
- `drawImage(canvas)` from an `HTMLCanvasElement` incurs a GPU pipeline flush/sync per call — Chrome cannot statically prove the source hasn't changed since last frame. This is invisible in CPU/GPU task manager but shows as frame time.
- `drawImage(imageBitmap)` avoids this: `ImageBitmap` is immutable by spec, so Chrome can hold a cached GPU texture with no flush.
- `ctx.filter = 'blur(Npx)'` is GPU-accelerated but processes the full bounding rectangle of the draw call including transparent pixels. With many large draw calls under a filter, this scales as O(n × area).
- `createRadialGradient()` is cheap per call; the cost is primarily the `fill()` that samples it.

#### Android (Chrome — Skia/Vulkan or ANGLE)

- Similar to desktop but mobile GPU is weaker.
- Blur filters can fall back to CPU on low-end devices.
- Canvas-to-canvas `drawImage` has the same flush issue but is less likely to bottleneck given fewer draw calls.

#### iOS/iPadOS (all browsers — WebKit WKWebView + Metal)

- **All browsers on iOS are WebKit** — Chrome, Firefox, Edge on iOS are all WKWebView wrappers. There is no alternative rendering engine.
- Canvas 2D is backed by Metal (Apple's GPU API). Every `globalCompositeOperation` change, every `ctx.filter` assignment, and every `createRadialGradient()` call triggers a Metal pipeline state change, which flushes the GPU command encoder.
- `drawImage(canvas)` from an offscreen canvas forces a Metal encoder commit + new encoder begin, which is expensive.
- `ctx.arc()` with `fill()` uses native Metal-backed path rendering and is fast — it is a single GPU primitive draw call with no state change.
- Conclusion: **circles are significantly cheaper than gradients or bitmaps on iOS**. The key principle is to minimise Metal pipeline state changes per frame.

---

### 15.4 Gas Giant Rendering

#### Why gas giants are different

Gas giants are semi-transparent (50% alpha) and must composite correctly over everything drawn before them in the frame, including bullets and trails. This makes them unsuitable for `bgCanvas` (which is drawn before bullets). They are also unsuitable for a simple per-frame draw because of the cost of recreating gradients and applying blur.

#### Combined canvas approach

At game start, viewport resize, and after SVG overlays finish loading, all gas giants are rendered into a single viewport-sized `_gasGiantCanvas`:

1. **Atmosphere halos** (no blur) — one `createRadialGradient` per planet, drawn normally.
2. **Planet bodies + SVG overlays** — drawn with `ctx.filter = 'blur(3px)'` active on the offscreen context. The blur is baked into the pixel data permanently.

The blur is applied to the **offscreen** context, not the main canvas. This is important: applying `filter = blur` to the main canvas during `drawImage` blurs the full rectangular canvas area including transparent pixels, scaling badly with many gas giants. Baking it into the offscreen canvas means the blur cost is paid once.

After building the canvas, `createImageBitmap(canvas)` is called asynchronously. Once the `ImageBitmap` resolves, it is used in preference to the raw canvas, eliminating Chrome's GPU pipeline flush on the `drawImage` call.

**Per-frame cost**: one `drawImage` call, zero gradients, zero filter state changes.

**Cache invalidation**: the combined canvas is rebuilt when `conv` changes (viewport resize) or when SVG overlays finish loading (detected by checking `overlays[0].img.complete`). It is not rebuilt per-frame even when movement is enabled, since gas giant positions are effectively static (movement is applied to stations, not planets, in normal gameplay).

#### Blur in experimental mode

`experimental` mode skips the blur (the `blurred` flag is false). This is useful for performance testing — removing the blur from the baked canvas reduces the build cost and avoids any residual blur-related overhead in the `drawImage` composite.

#### Rings (full and experimental modes)

In `full` and `experimental` performance modes, 30% of gas giants are given a set of planetary rings, baked into the combined canvas (so per-frame cost is unchanged — still one `drawImage`).

Ring parameters are generated lazily per planet and cached on the planet object (`planet._ringParams`), so the 30% roll and the layout survive canvas rebuilds (resize, SVG-overlay load) but re-roll each game:

- **Orientation** — random rotation in the screen plane (0–2π).
- **Tilt** — random minor/major axis ratio (0.14–0.72), so rings range from near edge-on slivers to wide ellipses that visibly come "out of the page".
- **Bands** — 2–5 concentric bands, each with independently random thickness (biased thin, occasionally broad), gap, and alpha (0.10–0.25). Band colours are the planet's base colour lerped toward a dusty off-white.

Each band is filled as a true elliptical annulus (two concentric ellipses with the same axis ratio, `evenodd` fill) — the correct projection of a flat ring, unlike a uniform-width ellipse stroke.

**Occlusion**: the ring is rendered in two halves, split along its major axis. The back half is drawn first (under atmosphere and body); the front half is drawn after the bodies and SVG overlays, once the `blur(3px)` body filter has been reset, so rings stay crisp in `full` mode. Because the body is only 50% alpha, simply drawing the back half underneath would leave it too visible "through" the planet — so the back half is knocked back with a `destination-out` disc (70% erase) where it crosses the planet disc. The result: the far side of the ring shows only faintly through the gas, dimmer than the near side, which sells the depth without a physically impossible hard occlusion on a translucent body.

---

### 15.5 Wormhole Particle System

#### Architecture (`WormholeParticles`)

Each wormhole planet has a `WormholeParticles` instance. Particle state is stored in three `Float32Array` buffers (`_angles`, `_radii`, `_hueOff`) for cache-friendly access. Per-particle RGB is pre-computed into `_colR`, `_colG`, `_colB` Float32Arrays at spawn time and only recalculated on particle respawn — `hsvToRgb`/`rgbToHsv` is entirely out of the per-frame draw loop.

**Default config**: 80 particles per wormhole, 2 spiral arms, angular velocity scaling as `(spawnR/r)^1.7` (accelerates toward centre).

#### Rendering modes

**Gradient mode** (`experimental` on desktop): 2 concentric `createRadialGradient` passes per particle × 80 particles = 160 gradient objects created per wormhole per frame. Looks best but is expensive on iOS due to Metal pipeline flushes.

**Circle mode** (`full`, `exp-ipad`, `experimental` on iOS): halo+core two-circle pattern — a large dim outer circle at 35% alpha followed by a small bright inner circle at full alpha. No gradients, no compositing state changes. The soft falloff is approximated by the size ratio rather than a gradient.

The draw method accepts a `useCircles` boolean: `particles.draw(ctx, conv, this._useCircles)`.

Wormhole particles are skipped entirely in `simplified` mode.

---

### 15.6 Smoke & SFX Particle Rendering

#### Rocket smoke (`rocketSmoke`)

In `full` and `simplified` modes: arc circles. In `experimental` mode on desktop: Cloud1.png bitmap sprite, tinted to the team colour via a pre-cached offscreen canvas (`_smokeTintCache`). Tinting is performed once per unique RGB key (one per team colour) using `source-atop` composite, then reused every frame. Per-puff tinting at draw time was measured to kill performance even with only a few dozen puffs.

#### Comet smoke (`cometSmoke`)

Always arc circles — no bitmap variant. Comet smoke uses a white/grey palette that doesn't require tinting.

#### Off-screen culling

All particle draw methods check `_isVisible(px, py, radius)` before any draw or tinting operation:

```js
_isVisible(px, py, radius) {
  return px + radius >= 0 && px - radius <= this._vpW &&
         py + radius >= 0 && py - radius <= this._vpH;
}
```

This avoids wasted GPU work on particles that are off-screen.

---

### 15.7 Ship Explosion Particle System

The experimental explosion system (`full`, `experimental`, `exp-ipad`) spawns two particle types when a station is destroyed:

#### Bloom particles (`shipExplosionBloom`)

10 particles per explosion. Lifecycle `t: 0→1`. Colour interpolation: ship colour → white → ship colour → black. Size: expands to `maxR` by t=0.25, then contracts. Drawn with `globalCompositeOperation = 'lighter'` (additive blending).

**Bitmap mode** (`experimental` desktop): per-particle tint via shared `_tintCanvas` (cleared and redrawn each particle). Acceptable at 10 particles max.

**Circle mode** (`full`, `exp-ipad`, `experimental` iOS): halo+core circles with the interpolated colour. The outer halo at 35% alpha and inner core at 45% radius give a similar soft centre-bright look to the bitmap without any offscreen canvas work.

#### Fireballs (`fireballs`)

3–5 per explosion, globally capped at 20. Affected by gravity using an inverse-square law applied once per rAF frame (not per physics step). The gravity constant omits `TIMESTEP` since fireballs update at frame rate (≈60Hz) rather than the physics step rate (≈42 steps/frame). Fireballs are removed on planet collision or when they leave the world bounds by more than 150 units.

Fireballs emit smoke puffs (`fireballSmoke`) every ~4 frames. Smoke puffs expand almost instantly to full size then fade slowly — short trail, high particle count during the explosion burst.

**Global cap**: the 20-fireball limit prevents runaway particle counts during multi-station explosions.

---

### 15.8 The Two-Circle (Halo+Core) Pattern

Several effects use the same "halo + core" circle pattern as a zero-cost substitute for radial gradients or bitmap sprites:

```js
// Outer halo — large, dim
ctx.fillStyle = `rgb(${r},${g},${b})`;
ctx.globalAlpha = alpha * 0.35;
ctx.beginPath();
ctx.arc(px, py, radius * 1.7, 0, Math.PI * 2);
ctx.fill();

// Inner core — small, bright
ctx.globalAlpha = alpha;
ctx.beginPath();
ctx.arc(px, py, radius * 0.45, 0, Math.PI * 2);
ctx.fill();
```

Used in: wormhole particles (circle mode), bloom particles (circle mode), fireballs (circle mode), fireball smoke (circle mode).

The pattern works because `globalCompositeOperation = 'lighter'` (additive blending) causes the overlapping halo and core to sum their colour values, producing the visual appearance of a bright centre fading to a dim edge — the same falloff that a radial gradient or a soft bitmap sprite would give, at the cost of two arc fills and two alpha assignments.

---

### 15.9 Summary — Per-Frame Cost by Element

| Element | `simplified` | `full` | `experimental` (desktop) | `experimental` (iOS) |
|---|---|---|---|---|
| bgCanvas blit | 1 drawImage | 1 drawImage | 1 drawImage | 1 drawImage |
| Gas giants | 1 drawImage | 1 drawImage | 1 drawImage | 1 drawImage |
| Stations (per ship, normal renderer) | ~5 arc fills | ~5 arc fills | — | — |
| Stations (per ship, sprite renderer) | — | — | 1 drawImage | 1 drawImage |
| Wormhole particles (per wormhole) | — | 160 arc fills | 160 gradient creates | 160 arc fills |
| Ship explosion bloom (per particle) | — | 2 arc fills | 1 tinted drawImage | 2 arc fills |
| Fireballs (per fireball) | — | 2 arc fills | 1 tinted drawImage | 2 arc fills |
| Rocket smoke (per puff) | arc fill | arc fill | 1 cached drawImage | arc fill |
| Filter state changes per frame | 0 | 0 | 0 | 0 |
| Gradients created per frame | 0 | 0 | 0 | 0 |

No performance mode creates radial gradients or sets `ctx.filter` during the live draw loop. All gradients and blur operations are either pre-baked at game start or occur at particle spawn time, not per-frame.

---

### 15.10 Sprite Sheet Caching for Ship Rendering

The sprite vector renderer (`drawSprite`) issues ~23 canvas calls per ship. At 96 ships that would be ~2,200 path fills per frame — too many Metal pipeline state changes on iPad. The `SpriteSheetCache` exploits the global animation phase (§9 of the sprite spec): because all ships with the same team colour are pixel-identical within any frame, each (sprite, team) pair needs only one set of pre-rendered frames.

**Sheet structure**: a horizontal `HTMLCanvasElement` of `frameSize × SHEET_FRAMES` pixels (128 × 24 = 3,072 × 128 px). The 24 frames cover the full 2,400ms animation loop at 100ms intervals — invisible stepping at normal ship sizes. Each frame is rendered via `drawSprite` at startup, so the sheet itself pays the ~23-call-per-frame cost once per (sprite, team) at build time rather than on every draw frame.

**ImageBitmap snapshot**: after building the canvas, `createImageBitmap()` is called asynchronously. Once resolved, the `ImageBitmap` replaces the raw canvas as the `drawImage` source, eliminating the GPU encoder flush that `HTMLCanvasElement → drawImage` would cause on iOS (identical to the gas giant canvas trick — §15.4).

**Per-frame draw cost**: one `drawImage(sheet, sx, 0, frameSize, frameSize, x−r, y−r, 2r, 2r)` call per ship. 96 ships = 96 `drawImage` calls at zero path-geometry cost. Measured: < 0.5ms for 96 ships on iPad A-series.

**Memory**: one sheet per team in play × 128² × 24 × 4 bytes ≈ 1.5 MB per team. With 12 teams: ≈ 18 MB total, well within Safari's canvas memory budget.

**Sheets are built lazily** — only on the first draw call for a given (sprite, team) pair. Teams not in the current game pay nothing.

The direct `drawSprite` path remains the renderer used to *build* sheet frames and as a fallback for one-off or oversized draws. `sprite-bench.html` at the repo root verifies the 60fps target on real hardware with a toggle between cached-sheet and direct-vector modes.

---

## 12. Implementation Decisions Log

| # | Question | Decision |
|---|---|---|
| 1 | Star Wars theming depth | ✅ Death Star visuals — sphere + equatorial trench + dome detail, scaled by station size |
| 2 | Sound | ✅ Out of scope v1 |
| 3 | Slow-motion step (O while paused) | ✅ Implemented — hold O while paused reduces `SHOW_EVERY` to 1; release restores normal speed |
| 4 | RNG reproducibility | ✅ Seeded PRNG (mulberry32) used throughout |
| 5 | Ship visual at 96 ships on iPad | ✅ Sprite sheet cache — 1 `drawImage` per ship via per-team pre-baked animation frames; engaged in `experimental` mode. Procedural Death Star kept in `full`/`simplified` until sprite system is proven (see §5.4, §15.10). |

---

## 16. Story Mode — Engineering Spec

> For what Story Mode must do, see `requirements.md §13`. For design rationale, see `requirements.md §13.11–13.15`.

### 16.1 Scope

Story Mode is accessed via the **Mode** selector in `ConfigPanel`. It reuses the core physics engine, `GameLoop`, and `Renderer` without modification, adding a data-driven setup layer, UI screens, an in-game objective panel, a mid-turn event dispatch system, and `localStorage` persistence.

**Out of scope:** save/resume of mid-mission state; multiplayer/tournament integration.

### 16.2 New `GameMode` Values

```js
STORY_SELECT:    'story_select',
STORY_BRIEFING:  'story_briefing',
STORY_DEBRIEF:   'story_debrief',
STORY_DIALOG:    'story_dialog',   // pauses physics loop until dismissed
```

`STORY_DIALOG` is a transient overlay mode — `GameLoop._advance()` skips all physics processing while it is active, same as `GAMEOVER`.

### 16.3 New Files

| File | Purpose |
|---|---|
| `src/story/StoryMissions.js` | `STORY_MISSIONS` constant array — all 20 mission definitions |
| `src/story/StoryModeState.js` | `StoryModeState` class — runtime story state (objectives, progress, events) |
| `src/story/StorySetup.js` | `buildStoryMission()` — constructs a `GameState` from a mission definition |
| `src/story/StoryPersistence.js` | `load/save/recordPass/isCampaignComplete` — localStorage wrapper |
| `src/ui/StoryModeScreen.js` | DOM UI for mission select, briefing overlay, debrief overlay |
| `src/ui/StoryObjectivePanel.js` | In-game HUD overlay for objectives + turn counter |
| `src/ui/StoryDialogPopup.js` | Modal dialog for mid-mission event text |

### 16.4 Modified Files

| File | Changes |
|---|---|
| `src/core/GameState.js` | Add 4 new `GameMode` values; add `storyState`, `storyDialogText`, `_storyPrevMode` fields |
| `src/core/GameLoop.js` | Add `_processStoryEvents()`, `_checkStoryObjectives()`, `_checkStoryFail()`, cannon guard, collectable override |
| `src/entities/Station.js` | Add `role` field (`'human'/'target'/'ai'`), `visualStyle` field (`'station'/'drone'`) |
| `src/entities/Team.js` | Add `addStartingWeapons(weaponMap)` helper |
| `src/rendering/Renderer.js` | Render `visualStyle: 'drone'` stations with angular shape; render pulsing ring for `role: 'target'` |
| `src/main.js` | Mount `StoryModeScreen`; wire story entry point from mode selector |

### 16.5 `StoryModeState` Class

```js
export class StoryModeState {
  constructor(mission) {
    this.mission      = mission;
    this.objectives   = [...mission.objectives];
    this.objectiveMet = new Array(mission.objectives.length).fill(false);
    this.firedEvents  = new Set();
    this.collectCount = 0;
    this.passed       = false;
    this.failed       = false;
    this.score        = 0;
  }

  get allObjectivesMet() { return this.objectiveMet.every(Boolean); }

  addObjective(obj) {
    this.objectives.push(obj);
    this.objectiveMet.push(false);
  }

  evaluate(gs) {
    for (let i = 0; i < this.objectives.length; i++) {
      const obj = this.objectives[i];
      switch (obj.type) {
        case 'destroy_all':
          this.objectiveMet[i] = gs.teams.filter((_, ti) => ti !== 0).every(t => !t.isAlive);
          break;
        case 'destroy_n':
          this.objectiveMet[i] = gs.teams[0].stats.kills >= obj.params.count;
          break;
        case 'collect_n':
          this.objectiveMet[i] = this.collectCount >= obj.params.count;
          break;
      }
    }
  }

  computeScore(gs, turnsUsed) {
    const f = this.mission.scoring.formula;
    const kills   = gs.teams[0].stats.kills;
    const survived = gs.teams[0].stations.filter(s => s.status === 'active').length;
    switch (f) {
      case 'turns_remaining': {
        const maxTurns = this.mission.failConditions.find(f => f.type === 'max_turns')?.turns ?? 20;
        return Math.max(0, (maxTurns - turnsUsed) * 100);
      }
      case 'collectables_score': return Math.max(0, this.collectCount * 200 - turnsUsed * 10);
      case 'combat_efficiency':  return kills * 200 + survived * 100 - turnsUsed * 5;
      default: return 0;
    }
  }
}
```

### 16.6 `GameLoop` Hooks

**`_processStoryEvents()`** — called at top of `_startTurn()`. Iterates `mission.events`; for each event matching `gs.turn` not yet fired: spawns stations (random valid position if `x/y` null, using `_processHyperspace()` placement loop), applies `addStartingWeapons`, adds objectives, queues dialog by setting `gs.storyDialogText` and switching mode to `STORY_DIALOG`.

**`_checkStoryFail()`** — called in `_advanceResults()`. Checks `max_turns` fail condition; sets `ss.failed = true` and transitions to `STORY_DEBRIEF` if turn limit exceeded.

**`_checkStoryObjectives()`** — called after `_checkStoryFail()`. Calls `ss.evaluate(gs)`; checks implicit combat fail (human wiped, enemies remain); on `allObjectivesMet`, sets `ss.passed = true` and transitions to `STORY_DEBRIEF`.

**Cannon guard** — in `_fireAll()` fallback branch and in `WeaponSelector.js`, guard behind `gs.storyState?.mission.settings.cannonEnabled !== false`.

**Collectable override** — in both collection points in `_advanceFiring()`, filter `WEAPON_GRANTS` to the single weapon specified by `mission.settings.collectableWeapon` if set; also increment `ss.collectCount` when the human team collects.

**`_advance()` no-physics case** — add `case GameMode.STORY_DIALOG:` alongside `GAMEOVER` and `TP_RESULTS`.

### 16.7 Mission Setup Builder (`StorySetup.js`)

`buildStoryMission(mission, physics, rng)` returns a configured `{gs, teams}` tuple:

1. Planets from `mission.layout.scenarioId` via `ScenarioFactory.build()` or from `mission.layout.planets[]` with normalised coords converted to game units.
2. One `Team` per unique team index in `mission.layout.stations`; call `addStartingWeapons` on each; attach `AIController.create(aiLevel)` to AI teams.
3. One `Station` per station def; set `role` and `visualStyle`.
4. Construct `GameState`; attach `storyState = new StoryModeState(mission)`.
5. For `collectablesSpawn === 'fixed'`, construct `Collectable` instances at normalised positions.

### 16.8 UI Components

**`StoryModeScreen`** — manages three sub-views: mission select (scrollable card list, lock state from persistence), briefing (story text + objectives + Start), debrief (COMPLETE/FAILED banner, score breakdown, Retry/Next). Story text uses `{enemyN}` → colour substitution via `substituteColours(text, gs)`.

**`StoryObjectivePanel`** — DOM overlay top-right canvas; `update(storyState, currentTurn)` renders objective checkboxes (`destroy_all` → "Destroy all enemies"; `collect_n` → "Collect N (X/N)") and turn counter ("Turn N / MAX" in amber when approaching limit).

**`StoryDialogPopup`** — semi-transparent centred modal; shows event dialog text with a single "Understood" button; dismissing restores `gs.mode = gs._storyPrevMode` and resumes the loop.

### 16.9 Renderer Changes

**Drone station** — branch on `station.visualStyle === 'drone'`: draw angular hexagonal/diamond shape with flat-black fill, angular notches, thin outer ring in darker team colour. No equatorial band.

**Target ring** — when `station.role === 'target'`: draw dashed circle at `radius × 1.8`, pulsing opacity (0.3–0.7, period ≈ 2s), colour `rgba(180, 30, 30, alpha)`.

### 16.10 Persistence (`StoryPersistence.js`)

Storage key `dsb_story`. Methods: `load()`, `save(data)`, `isUnlocked(missionId, data)`, `getBestScore(missionId, data)`, `recordPass(missionId, score, data)` (unlocks mission + next; updates best score; sets `campaignComplete` when all 20 are in `unlocked`), `isCampaignComplete(data)`. All `localStorage` calls wrapped in try/catch.

### 16.11 `main.js` Wiring

Mode = Story → hide config, show `StoryModeScreen` select view → user picks mission → briefing → Start → `buildStoryMission` → `GameLoop` → loop detects `STORY_DEBRIEF` → `StoryPersistence.recordPass()` + save → show debrief. Retry = full `buildStoryMission` reload. Next Mission = back to select view. `ConfigPanel` reads `campaignComplete` at startup to conditionally show Starting Weapons on Page 4.

### 16.12 Edge Cases

- `destroy_all` with events: event-spawned stations join existing teams; the check (`teams[1+].every(!isAlive)`) evaluates correctly.
- Multi-team `destroy_all` (M16–M20): AI teams can kill each other — all non-human teams must be eliminated; hiding and letting AI fight is a valid strategy.
- `_checkWin()` interaction: `_checkWin()` fires before `_checkStoryObjectives()`; ensure `_advanceResults()` checks `gs.mode === STORY_DEBRIEF` and returns before the `GAMEOVER` branch to avoid a mode conflict.
- Score of 0 on exact last turn (`turns_remaining`): valid pass; poor leaderboard result but not a failure.

---

## 17. Target Practice Mode — Engineering Design

> For what Target Practice must do, see `requirements.md §17`.

### 17.1 New Files

| File | Purpose |
|---|---|
| `src/entities/PracticeTarget.js` | Target entity: `id`, `position (Vec2)`, `radius` |
| `src/core/TargetPracticeSetup.js` | Station placement, target placement, feasibility simulation |
| `src/core/TargetPracticeGame.js` | Per-game state: target sets, round tracking, per-station scoring |
| `src/ui/TargetPracticeResultsScreen.js` | DOM results overlay (mirrors `GameOverScreen`) |

### 17.2 Modified Files

| File | Changes |
|---|---|
| `src/core/GameState.js` | New `GameMode` constants; new `tpGame` field |
| `src/core/GameLoop.js` | New `_advanceTPAiming()`, `_tpFireAll()`, `_advanceTPFiring()` methods |
| `src/physics/PhysicsEngine.js` | `stepTargetPractice()` — pass-through hit detection + accuracy |
| `src/rendering/Renderer.js` | `drawTarget()`, glitter VFX, `_tpVisibleStationId` filtering |
| `src/ui/ConfigPanel.js` | Mode `'target-practice'`; Page 5 TARGET PRACTICE |
| `src/main.js` | Wire TP start flow |
| `src/scenarios/scenarioData.js` | Export `TARGET_PRACTICE_SCENARIOS = [1, 2, 3, 6, 4, 19]` |

### 17.3 New `GameMode` Values

```js
TP_SETUP:   'tp_setup',    // feasibility sim running
TP_AIMING:  'tp_aiming',   // active station is aiming
TP_FIRING:  'tp_firing',   // active station's bullet in flight
TP_RESULTS: 'tp_results',  // results screen shown
```

New field on `GameState`: `this.tpGame = null; // TargetPracticeGame | null`

### 17.4 `TargetPracticeSetup`

Stateless static helper called once per game from `main.js`.

**`placeStations(config, planets, gameW, gameH)`** — determines landscape/portrait orientation, picks random edge, computes evenly-spaced positions with 2× station-radius padding, steps inward up to 200px per station to avoid planet overlap.

**`placeTargets(config, planets, stations, gameW, gameH)`** — divides map into a grid (cell side ≈ 4× target radius), excludes station-edge strip, shuffles and fills until 2N targets placed without planet overlap; returns `null` on failure (triggers scenario re-roll).

**`runFeasibility(stations, candidates, planets, physics, gameW, gameH)`** — shared trace budget of 200 total traces across all `(station, candidate)` pairs (`tracesPerPair = max(1, floor(200 / pairs.length))`). Calls `SimBot._findBestShot` with a duck-typed mock target `{position, radius, id, team: null}`. Returns `{hitMatrix, selectedTargets}` where `selectedTargets` is N targets chosen by priority rules (most-stations-hit first).

**Scenario re-roll:** if `placeTargets()` returns `null`, increment counter, try a different scenario. After 6 consecutive failures, fall back to Planetary (scenario 1) with N halved.

### 17.5 `TargetPracticeGame`

```js
class TargetPracticeGame {
  targets       // PracticeTarget[N]
  totalRounds   // from config
  currentRound  // 1-indexed
  stationList   // Station[] — all stations in turn order
  teamData      // Map<teamIndex, TeamTPData>
}

class TeamTPData {
  targetDestroyed  // boolean[N] — shared by all stations on team
  hits             // { stationId, targetIdx, accuracy }[]
  finishedRound    // number | null — round when all N cleared
}
```

A team with `finishedRound !== null` is excluded from `_turnOrder` in subsequent rounds.

### 17.6 Turn Model

Target Practice uses **simultaneous fire** — all stations on all teams aim, then all bullets fly at once — exactly like normal mode.

**`_startTPTurn()`** — sets `_turnOrder` to all active stations, resets weapons to `CANNON`, transitions to `TP_AIMING`.

**`_advanceTPAiming()`** — mirrors `_advanceAiming()`. AI stations call `_tpAIAim()` (picks a random surviving target, calls `_findBestShot` via a duck-typed mock); human stations wait for input. When all stations have aimed, call `_tpFireAll()`.

**`_tpFireAll()`** — creates one `Bullet` per station, sets `gs.mode = TP_FIRING`.

**`_advanceTPFiring()`** — runs `physics.step()` per bullet each tick; checks pass-through hit detection; on hit calls `tp.recordHit()`; pushes glitter VFX. When `activeBullets` empty: increments round; if past `totalRounds`, transitions to `TP_RESULTS`; otherwise calls `_startTPTurn()`.

### 17.7 Pass-Through Hit Detection (`PhysicsEngine.stepTargetPractice`)

Identical to `step()` for gravity and planet collision. Additionally, after position update, checks each surviving target:

```
dx = target.position.x − bullet.position.x
dy = target.position.y − bullet.position.y
if sqrt(dx² + dy²) <= target.radius → register hit (do NOT destroy bullet)
```

**Accuracy:**
```
toCenter = target.position − bullet.position (at moment of entry)
θ = angleBetween(bullet.velocity, toCenter)  (degrees, via acos of dot product)
accuracy = max(0, 1 − θ / 90)
```

Only the first hit per target per station counts; re-entries are ignored by skipping targets already in `teamData.targetDestroyed`.

### 17.8 Renderer — Targets and Visibility

**`drawTarget(ctx, target)`** — five concentric rings, outside in: white → red → white → red → white bullseye. Each ring width = `radius / 5`.

**Glitter VFX** — on destruction: 24 particles (`type: 'glitter'`) in `gs.vfxList`. Each: random direction (speed 1–4 px/frame), life 0–1 decrementing 0.04/frame, colour randomly from `#fff / #ff4444 / #ffcc00 / #ffaaaa`, size 2–5px.

**Visibility filtering** — in TP modes, only the active station and its team's targets are drawn. Set `_tpVisibleStationId` on `Renderer` before drawing; `drawStations()` and `drawTrails()` check it. Pass only the active team's target set to `drawTarget()` calls.

### 17.9 ConfigPanel — Page 5

Mode row: `single → tournament → target-practice → single`.

Page 5 (TARGET PRACTICE) — only rendered when `_d.mode === 'target-practice'`:

| Label | Values | Default |
|---|---|---|
| Targets | 1 / 3 / 5 / 7 / 10 / 20 | 5 |
| Target Size | Micro / Tiny / Small / Medium / Large / Giant / Mammoth | Medium |
| Rounds | 1 / 3 / 5 / 7 / 10 | 5 |
| Include AI | Off / On | Off |

When mode changes away from `'target-practice'`, clamp current page index to 0–3 to prevent user landing on hidden page.

### 17.10 State Machine

```
ConfigPanel [mode=target-practice] → Start
  │
  ▼
main.js: generate scenario → placeStations → placeTargets (re-roll on null) →
         runFeasibility → construct TargetPracticeGame → gs.tpGame = game
         gs.mode = TP_AIMING
  │
  ▼
[TP_AIMING] — active station only, its targets only
  human: wait for End Turn
  AI:    _tpAIAim() → advance _turnIdx
  all aimed → _tpFireAll() → [TP_FIRING]
  │
  ▼
[TP_FIRING] — single-step physics, pass-through hit detection
  hits recorded, glitter VFX
  bullets terminate → increment round
  ├── more rounds → [TP_AIMING]
  └── all rounds done → [TP_RESULTS]
  │
  ▼
[TP_RESULTS] — TargetPracticeResultsScreen.show(gs)
  Play Again → re-run from scenario generation
  Main Menu  → ConfigPanel.show()
```

### 17.11 HUD in TP Mode

Top-centre: `"Team X  Station Y — Round Z / R"`. Angle bottom-left, Power bottom-right unchanged. No weapon selector, no hyperspace button.
| 5 | Mobile config panel | ✅ Implemented — responsive paged layout (see §10.2); game canvas not yet touch-controlled |
