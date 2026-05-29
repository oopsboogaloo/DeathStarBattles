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
│   │   └── Team.js         ← team + cumulative stats
│   ├── physics/
│   │   └── PhysicsEngine.js
│   ├── rendering/
│   │   ├── Renderer.js     ← composites the three layers
│   │   ├── PlanetRenderer.js
│   │   └── HUDRenderer.js
│   ├── ai/
│   │   ├── AIController.js ← base class + factory
│   │   ├── RandBot.js
│   │   ├── AimBot.js
│   │   ├── CleverBot.js    ← also base for Superbot/Megabot
│   │   ├── SuperBot.js
│   │   └── MegaBot.js
│   ├── scenarios/
│   │   ├── ScenarioFactory.js
│   │   └── scenarioData.js ← per-scenario config constants
│   ├── input/
│   │   └── InputHandler.js
│   └── ui/
│       ├── ConfigPanel.js  ← pre-game setup panel (DOM)
│       └── HUD.js          ← in-canvas HUD drawing
└── spec/
    ├── requirements.md
    ├── design.md
    └── tasks.md
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
  ASTEROID:         'asteroid',     // explode on impact
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
  size           // StationSize enum (MICRO→GIANT, maps to radius)
  angle          // int 0–359
  power          // int 1–800
  hyperspaceQueued  // bool

  status         // StationStatus: ACTIVE | EXPLODING | DEAD
  explosionT     // float 0→1 animation progress when EXPLODING

  // cumulative stats (persisted across tournament)
  stats          // StationStats object (see §3.3.1)

  get radius()   // float, derived from size
  get colour()   // from team
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
  static create(scenarioId, width, height, nPlanets, rng) {}

  // Lucky dip — weighted random scenario selection.
  static randomId() {}
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
  chooseAction(station, gameState) // → { angle, power, hyperspace: bool }
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
    const hyperspace = this.#shouldHyperspace(station, gameState)
    return { angle, power, hyperspace }
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
  // H    → toggle hyperspace
  // Enter → end turn
  // P    → pause/unpause (any mode)
  // O    → slow-motion step (while paused)
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
2. `physicsEngine.checkCollisions(bullet, planets, stations)`
3. Record trail points every `PRINT_EVERY` steps
4. Repaint every `PRINT_EVERY × SHOW_EVERY` steps
5. When all bullets are `DEAD` or `EXPLODING==done`:
   - Process hyperspace queues (stations with `hyperspaceQueued` teleport now)
   - Update leaderboard
   - Check win condition → RESULTS

### 9.3 Win Condition
```
aliveTeams = teams.filter(t => t.stations.some(s => s.status === ACTIVE))
if aliveTeams.length === 1 → winner = aliveTeams[0]
if aliveTeams.length === 0 → draw (no winner)
```

---

## 10. Config Panel (DOM-based)

The pre-game config panel is a DOM overlay (not canvas) so it can use standard HTML form controls. It is styled to match the game's dark space aesthetic.

```
┌─────────────────────────────────────┐
│  ☆ DEATH STAR BATTLES               │
│                                     │
│  Players        [ 2 players      ▲▼]│
│  Human / CPU    [ 1H  1CPU       ▲▼]│
│  Stations/Player[ 1              ▲▼]│
│  CPU Level      [ Cleverbot      ▲▼]│
│                                     │
│  ── More Options ───────────────── │
│  Station Size   [ Medium         ▲▼]│
│  Planets        [ Random (max 8) ▲▼]│
│  Scenario       [ Lucky Dip      ▲▼]│
│  Mode           [ Single Game    ▲▼]│
│                                     │
│       [ START GAME ]                │
└─────────────────────────────────────┘
```

Each `▲▼` is a cycle button (click to advance through options), matching the original's button-cycling interaction but styled as a proper select or custom cycle control.

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

## 12. Open Implementation Decisions

These were not resolved in requirements and need a call before implementation:

| # | Question | Recommended Default |
|---|---|---|
| 1 | Star Wars theming depth | ✅ **Death Star visuals** — sphere + equatorial trench + dome detail, scaled by station size |
| 2 | Sound | Out of scope v1 |
| 3 | Slow-motion step (O while paused) | ✅ **Include** — reduce `SHOW_EVERY` multiplier while O is held; release restores normal speed |
| 4 | RNG reproducibility | Use seeded PRNG (mulberry32) — enables replay in future without cost now |
| 5 | Mobile / touch | Out of scope v1 |
