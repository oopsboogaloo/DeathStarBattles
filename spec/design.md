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
│   │   └── Crystal.js      ← collectable crystal entity + WeaponId enum
│   ├── physics/
│   │   └── PhysicsEngine.js
│   ├── rendering/
│   │   ├── Renderer.js     ← composites the three layers; crystal + VFX drawing
│   │   └── PlanetRenderer.js
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
└── spec/
    ├── requirements.md
    ├── design.md
    ├── tasks.md
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
  crystals       // Crystal[]  — alive crystals on the map (max 3 at once)
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
3. `physicsEngine.checkCrystalCollision(bullet, gameState.crystals)` — crystal hit check (bullet continues; see §13.6)
4. Advance `vfxList` timers; prune completed VFX
5. Record trail points every `PRINT_EVERY` steps
6. Repaint every `PRINT_EVERY × SHOW_EVERY` steps
7. When all bullets are `DEAD` or `EXPLODING==done`:
   - Remove dead crystals from `gameState.crystals`
   - Process hyperspace queues (stations with `selectedWeapon === WeaponId.HYPERSPACE` teleport now)
   - Update leaderboard
   - Check win condition → RESULTS
   - Call `_trySpawnCrystal()` (see §13.5) before advancing to AIMING

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
| SCENARIO | 1–21 / Lucky Dip |
| MODE | Single Game / Tournament |
| GAME SPEED | ¼× / ½× / 1× / 2× / 4× |
| MOVEMENT SPEED | Off / Glacial / Slow / Normal / Fast / Rocket |
| PERFORMANCE | Full / Simplified |
| TEAM CLUSTERING | Off / Tight / Moderate / Loose |
| WILDCARD PLANETS | Off / Very Rare / Rare / Occasional / Common / Always |
| COLLECTABLES | Off / Rare / Normal / Common / Continuous |
| AIM CIRCLE SIZE | 0.5× / 1× / 2× / 3× |
| MINIMAL UI | Off / On |

### 10.2 Responsive Paged Layout

On small viewports (`panel.scrollHeight > window.innerHeight × 0.92`) the panel switches to a **3-page paged layout**:

- Page 1 **SETUP**: Players, Human/CPU, Stations/Player, CPU Level
- Page 2 **WORLD**: Station Size, Planets, Scenario, Mode, Game Speed, Movement Speed
- Page 3 **OPTIONS**: Performance, Team Clustering, Wildcard Planets, Collectables, Aim Circle, Minimal UI

Navigation: `◄  ● ○ ○  ►` dot bar + Prev/Next buttons. Start button pinned and visible on all pages.

Compact mode reduces font sizes and row spacing so the full panel fits within ~310px — comfortable for iPhone SE landscape (375px viewport height).

Fit is detected on every `show()` call and on `window resize`. The panel switches bidirectionally between flat and paged modes by physically moving row DOM nodes between containers (no duplication — state bindings remain intact).

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

This section covers the design of weapon selection, the Triple Cannon, space crystals, and their VFX. It augments the existing sections where noted.

---

### 13.1 Weapon Model

#### 13.1.1 `WeaponId` enum

```js
const WeaponId = Object.freeze({
  CANNON:        'cannon',        // default fire; infinite uses
  HYPERSPACE:    'hyperspace',    // teleport; infinite uses
  TRIPLE_CANNON: 'tripleCannon',  // 3 bullets ±5°; collectable; limited uses
});
```

The enum is the single authoritative list of weapons. Adding a new collectable weapon in the future means adding one entry here and one entry to the stock map.

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
5. Any of the three can independently hit stations, planets, or crystals.

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

### 13.3 `Crystal` Entity

```js
class Crystal {
  position    // Vec2 — stationary; never changes after spawn
  rotation    // float (radians) — increases each frame for spin animation
  alive       // bool
  radius      // float (game units) — collision radius; also governs draw size
              // fixed value: ~5 game units (roughly Tiny station size)
}
```

Crystals are **not** planets. They do not exert gravity. They are not in the `planets` array. They live in `gameState.crystals: Crystal[]`.

The `Crystal` entity has no physics state — it is purely a collision target and a rendering entity. The `rotation` field is advanced by the `Renderer` each frame (not by `GameLoop`/`PhysicsEngine`) since it is purely cosmetic.

---

### 13.4 Crystal Rendering

#### Layer assignment

Crystals rotate continuously, so they cannot be baked onto Layer 0 (background). They are drawn on **Layer 2** (live layer) every frame, after bullets and before HUD. This means they sit above planet backgrounds and trail lines visually, which is fine — crystals are foreground objects that need to be easily spotted.

#### Draw procedure

```
For each alive crystal:
  1. Save ctx
  2. Translate to crystal pixel position; rotate by crystal.rotation
  3. Draw outer ring: thin circle stroke in icy blue-white (#B8E8FF), alpha 0.6
  4. Draw 6 crystal facets: lines from centre to outer points (like a gem cross-section),
     alternating long (0.9r) and short (0.5r) spokes
  5. Draw inner hexagon connecting the spoke tips, stroke only
  6. Draw a soft radial gradient glow: centre white, outer fully transparent,
     radius 1.5× crystal radius — gives icy luminescence against the dark field
  7. Restore ctx
```

Colour palette: core lines `#FFFFFF`, structure lines `#B8E8FF`, glow `rgba(184,232,255,0.15)`.

The rotation speed is a fixed constant (~0.02 radians per frame at 30fps → ~one full rotation per ~10 seconds).

---

### 13.5 Crystal Spawning

Crystals spawn at turn end, during the `RESULTS → AIMING` transition, after hyperspace teleports are executed.

```js
_trySpawnCrystal(config, rng, planets, teams) {
  if (config.collectables === 'off') return;
  if (this.crystals.length >= 3) return;  // cap

  const prob = { rare: 0.20, normal: 0.40, common: 0.75, continuous: 1.0 }[config.collectables];
  if (rng.next() > prob) return;

  const pos = this._findCrystalSpawnPos(rng, planets, teams);
  if (pos) this.crystals.push(new Crystal(pos, rng.next() * Math.PI * 2));
}
```

**Placement rules** (same RNG as everything else → reproducible):
- Not inside any planet's radius (checked against `planet.radius + crystal.radius`)
- Not within `3 × crystal.radius` of any alive station (avoids spawning on top of a player)
- Retry up to 200 times before giving up (cap still applies, so a failed spawn is silent)
- Does not spawn in the Hyperspace scenario (`scenarioId === 21`)

The placement retry loop is deliberately lighter than the station placement algorithm — a failed spawn is harmless.

---

### 13.6 Bullet–Crystal Collision

Crystal collision is **not** handled inside `checkCollisions()` — that method handles interactions that stop or redirect the bullet. Crystals do not stop bullets. Instead a separate method is called for each active bullet each physics step:

```js
// PhysicsEngine
checkCrystalCollision(bullet, crystals) {
  // Returns the first crystal hit, or null.
  for (const crystal of crystals) {
    if (!crystal.alive) continue;
    if (bullet.position.distanceSqTo(crystal.position) < crystal.radius ** 2) {
      return crystal;
    }
  }
  return null;
}
```

Call site in `GameLoop._firingTick()`:

```js
const hitCrystal = physicsEngine.checkCrystalCollision(bullet, gameState.crystals);
if (hitCrystal) {
  hitCrystal.alive = false;
  bullet.owner.team.addStock(WeaponId.TRIPLE_CANNON, 3);
  gameState.vfxList.push(new CrystalShatterVFX(hitCrystal.position));
  gameState.vfxList.push(new CollectableGrantVFX(
    hitCrystal.position, 'TRIPLE CANNON', bullet.owner.team.colour
  ));
  // bullet continues — no status change
}
```

Dead crystals (`alive === false`) are pruned from `gameState.crystals` at the end of the FIRING phase, alongside the bullet cleanup pass.

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

#### `CrystalShatterVFX`

```js
class CrystalShatterVFX {
  type = 'crystalShatter'
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
  position   // Vec2 (crystal location at time of collection)
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

The value is stored in `GameConfig.collectables` (string, default `'off'`). It is passed to `_trySpawnCrystal()` each turn end.

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

#### Crystal targeting (SuperBot + MegaBot only)

After computing `bestShot` for the primary enemy target, SuperBot and MegaBot run a quick secondary pass over all live crystals:

```
for each live crystal:
  simulate(bestShot.angle, bestShot.power, station, crystalAsTarget, planets)
  if closestApproach < crystal.radius * 2:
    // this shot already collects the crystal — no change needed
    note the crystal collection as a side-effect
  else if team.getStock(TRIPLE_CANNON) < 2:
    // stock is low; try to find a shot that hits this crystal
    simulate with crystalAsTarget to find crystalShot
    if crystalShot.closestApproach < crystal.radius:
      // weigh crystal shot vs primary: choose crystal shot only if
      // primary shot closestApproach is > threshold (unlikely to score)
      if bestShot.closestApproach > CRYSTAL_CHASE_THRESHOLD:
        choose crystalShot
```

`CRYSTAL_CHASE_THRESHOLD` = 15 game units (roughly half a Large station radius). If the primary shot is already a good one, the bot ignores the crystal. It only diverts to crystal-hunting when its primary shot is poor.

This does not require any new simulation infrastructure — it reuses `PhysicsEngine.simulate()` with the crystal's position treated as a zero-radius target station.

---

### 13.11 Affected Files

| File | Change |
|---|---|
| `src/entities/Crystal.js` | **NEW** — Crystal entity + WeaponId enum |
| `src/entities/Team.js` | UPDATED — `weaponStock` map + `getStock` / `spendStock` / `addStock` |
| `src/entities/Station.js` | UPDATED — `selectedWeapon` field; `hyperspaceQueued` → computed getter |
| `src/physics/PhysicsEngine.js` | UPDATED — `checkCrystalCollision()` (separate from `checkCollisions()`) |
| `src/core/GameState.js` | UPDATED — `crystals[]`, `vfxList[]`, `_trySpawnCrystal()` |
| `src/core/GameLoop.js` | UPDATED — crystal collision call site, VFX advancement, `_fireAll` Triple Cannon path |
| `src/rendering/Renderer.js` | UPDATED — `_drawCrystals()`, `_drawVFX()` on Layer 2; crystal rotation advanced here |
| `src/ui/WeaponSelector.js` | **NEW** — DOM popup weapon selector |
| `src/ui/ConfigPanel.js` | UPDATED — Collectables cycle-button row |
| `src/ai/AIController.js` | UPDATED — `chooseAction` returns `weapon: WeaponId` not `hyperspace: bool` |
| `src/ai/RandBot.js` | UPDATED — weapon selection logic |
| `src/ai/AimBot.js` | UPDATED — weapon selection logic |
| `src/ai/CleverBot.js` | UPDATED — weapon selection logic |
| `src/ai/SuperBot.js` | UPDATED — weapon selection + crystal opportunism |
| `src/ai/MegaBot.js` | UPDATED — weapon selection + crystal opportunism |
| `src/main.js` | UPDATED — weapon button wires to WeaponSelector; GameState receives config |

---

### 13.12 Invariants & Edge Cases

| Case | Behaviour |
|---|---|
| Player selects Triple Cannon but stock reaches 0 before their turn | Weapon selector greys out the option; station falls back to Cannon if stock drops to 0 mid-turn (e.g. teammate fired last use on the same team's turn) |
| All three Triple Cannon bullets hit the same station | Station destroyed on first hit; remaining two bullets hit a dead/exploding station — treated as normal hits with no additional scoring |
| Triple Cannon bullet hits a crystal | Crystal destroyed, 3 uses awarded, bullet continues — same as any other bullet |
| Crystal spawns on top of another crystal | Placement validation checks other crystals' positions as well as planets/stations |
| All 3 simultaneous crystals destroyed in one turn | All three grant text VFX play concurrently; each awards 3 uses to the owning bullet's team independently |
| Crystal persists into a new game (tournament) | Crystals do **not** persist across games — `gameState.crystals` is cleared on `newGame()`. Weapon stocks persist; crystals do not |

---

## 12. Implementation Decisions Log

| # | Question | Decision |
|---|---|---|
| 1 | Star Wars theming depth | ✅ Death Star visuals — sphere + equatorial trench + dome detail, scaled by station size |
| 2 | Sound | ✅ Out of scope v1 |
| 3 | Slow-motion step (O while paused) | ✅ Implemented — hold O while paused reduces `SHOW_EVERY` to 1; release restores normal speed |
| 4 | RNG reproducibility | ✅ Seeded PRNG (mulberry32) used throughout |
| 5 | Mobile config panel | ✅ Implemented — responsive paged layout (see §10.2); game canvas not yet touch-controlled |
