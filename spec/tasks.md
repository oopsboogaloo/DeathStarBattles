# DeathStarBattles — Tasks

> Implementation plan derived from [design.md](design.md). Phases are ordered by dependency — each phase produces something runnable. Tasks within a phase can often be parallelised.

---

## Phase 1 — Project Scaffold & Rendering Foundation

Get a blank canvas rendering a star field and a single planet. No game logic yet.

- [x] **1.1** Create `index.html` — loads `src/main.js` as ES module; three stacked `<canvas>` elements (bg, trails, main); basic CSS (black background, canvas centred/fullscreen)
- [x] **1.2** `src/core/Vec2.js` — implement and unit-test (in console): `add`, `sub`, `scale`, `dot`, `magnitude`, `normalised`, `distanceTo`, `distanceSqTo`, `angle`
- [x] **1.3** `src/rendering/Renderer.js` — skeleton: constructor takes three canvas refs; exposes `drawBackground()`, `clearTrails()`, `appendTrailPoint()`, `drawFrame()`; compositing logic (bg + trails + live each frame)
- [x] **1.4** Star field generation — `src/rendering/Renderer.js` or helper: generate 2000 stars with random position, size, colour (reds/purples/blues); draw to bg canvas once
- [x] **1.5** `src/entities/Planet.js` — `Planet` class + `PlanetType` + `ShadingStyle` enums
- [x] **1.6** `src/rendering/PlanetRenderer.js` — `drawRockyPlanet()` and `drawStar()` (with bristle corona); wire into `Renderer.drawBackground()`
- [x] **1.7** Verify: `main.js` creates a handful of hardcoded planets and a star, calls `renderer.drawBackground()` — visible on screen

---

## Phase 2 — Scenarios & World Generation

Replace hardcoded planets with the full scenario system.

- [x] **2.1** `src/core/RNG.js` — seeded PRNG (mulberry32); `next()`, `nextInt(n)`, `nextInRange(min, max)`
- [x] **2.2** `src/scenarios/scenarioData.js` — config objects for all 21 scenarios (placement envelopes A/B/C/D/E/F, density, shading, fixed-body placement functions)
- [x] **2.3** `src/scenarios/ScenarioFactory.js` — `create(scenarioId, width, height, nPlanets, rng)`: places fixed bodies, randomly generates remaining planets using envelope params, validates no-overlap + ≥25% free area with retry loop; `randomId()` weighted random picker
- [x] **2.4** Random bonus feature injection (10% chance of extra wormhole pair / black hole / white dwarf appended to any scenario)
- [x] **2.5** All remaining planet type renderers: `drawWormhole()` (pulsing ring), `drawBlackHole()` (faint distortion ring only — near invisible), `drawWhiteHole()` (bright glow), `drawWhiteDwarf()`
- [x] **2.6** Verify: cycle through all 21 scenarios and confirm each renders correctly with valid planet placement

---

## Phase 3 — Stations & Game State

Place stations on the world and establish the core state object.

- [x] **3.1** `src/entities/Station.js` — `Station` class: position, team ref, size, angle, power, hyperspaceQueued, status, explosionT, stats (`StationStats`)
- [x] **3.2** `src/entities/Team.js` — `Team` class: index, colour, stations array, controller ref, cumulative stats
- [x] **3.3** `src/core/GameState.js` — `GameState` class: planets, teams, stars, mode (`GameMode` enum), turn, currentTeamIdx, currentStatIdx, winner, activeBullets; helper getters (`activeStation`, `allStations`, `aliveTeams`, `isHumanTurn`)
- [x] **3.4** Station placement in `ScenarioFactory` — after planets confirmed, place stations with min-distance checks (per player count table from requirements §4); retry with decreasing min-distance; fallback to hyperspace scatter
- [x] **3.5** Station renderer — `drawStation(ctx, station, isActive)`: Death Star icon (sphere + equatorial trench + dome + aperture at Medium+; sphere + trench only at Micro/Tiny); scale by station size
- [x] **3.6** Aiming indicator renderer — white circle at `stationBoxRadius` + white line from centre in firing direction; drawn only for active station
- [x] **3.7** Verify: start a game with 4 teams, stations placed correctly on a scenario, Death Star icons visible in team colours, aiming circle on station 0

---

## Phase 4 — Physics Engine

Simulate a single bullet in flight.

- [x] **4.1** `src/physics/PhysicsEngine.js` — `step(bullet, planets)`: Euler gravity accumulation + position update
- [x] **4.2** Collision detection — `checkCollisions(bullet, planets, stations)`: returns `CollisionResult | null`; handles all planet impact types (explode / vanish / wormhole teleport variants); station hit detection
- [x] **4.3** `initialState(angle, power, station)` — computes starting position (just outside station) and initial velocity from angle + power using the `MIN_POWER` / `MAX_POWER` constants
- [x] **4.4** Play boundary check — bullet exits `[-width, 2*width] × [-width, height+width]` → `DEAD`
- [x] **4.5** `src/entities/Bullet.js` — `Bullet` class: owner, position, velocity, status (`BulletStatus` enum), trail array, teleportCount, explosionT, lifetime
- [x] **4.6** Wormhole exit position calculation — preserve velocity direction, set position to partner surface + 0.5 offset; enforce MAX_TELEPORTS limit
- [x] **4.7** Verify: fire a single hardcoded bullet from a station near a planet and watch it curve; fire into a star and confirm explosion; fire into a black hole and confirm silent vanish

---

## Phase 5 — Game Loop & Turn Machine

Wire physics and state into a running game loop.

- [x] **5.1** `src/core/GameLoop.js` — `requestAnimationFrame` driver; calls `gameState.advance()` then `renderer.drawFrame(gameState)` each tick; pause/resume
- [x] **5.2** `GameState.advance()` — implements the state machine transitions: CONFIG → AIMING → FIRING → RESULTS → GAMEOVER (§9 of design)
- [x] **5.3** AIMING phase logic — iterate through stations; skip dead ones; for AI stations call `controller.chooseAction()` immediately; for human station pause and wait for input flag
- [x] **5.4** FIRING phase logic — run physics loop; record trail points every `PRINT_EVERY` steps; repaint every `PRINT_EVERY × SHOW_EVERY` steps; detect all-bullets-resolved; process hyperspace queues; check win condition
- [x] **5.5** RESULTS phase — brief pause (show outcome text), then advance to next turn or GAMEOVER
- [x] **5.6** Hyperspace execution — randomly place station at a valid free position (not inside planet, not too close to enemy); animate with a flash effect
- [x] **5.7** Pause (P key) and slow-motion (O key while paused — reduces `SHOW_EVERY` multiplier to 1 while held)
- [x] **5.8** Verify: 2-player all-AI game runs to completion without errors; winner declared; trails visible; explosions play

---

## Phase 6 — Human Input & HUD

Make the game playable by a human.

- [x] **6.1** `src/input/InputHandler.js` — keyboard handler: Z/X (angle ±1), A/S (angle ±5), K/M (power ±1), J/N (power ±10), H (hyperspace toggle), Enter (end turn), P (pause), O (slow-mo)
- [x] **6.2** Mouse aiming — click+drag within `stationBoxRadius`; compute angle from direction, power from drag distance; update `station.angle` and `station.power` live
- [x] **6.3** `src/rendering/HUDRenderer.js` — draws on Layer 2: "Team N   Station N" (top-centre, large, team colour); "Angle:NNN" (bottom-left, white monospace); "Power:NN.N" (bottom-right); "HYPERSPACING..." replacement when queued
- [x] **6.4** End-turn button and Hyperspace button — minimal floating DOM buttons at bottom edge (or drawn on canvas); wire to game state
- [x] **6.5** Verify: human vs 1 AI; player can aim with mouse and keyboard; HUD updates live; end turn fires both shots simultaneously; trails render correctly

---

## Phase 7 — AI Players

Implement all five AI levels.

- [x] **7.1** `src/ai/AIController.js` — abstract base class + static `create(level)` factory
- [x] **7.2** `src/ai/RandBot.js` — random angle/power; 18% hyperspace chance
- [x] **7.3** `src/ai/AimBot.js` — direct-aim with accuracy noise scaled by total planet mass; 14% hyperspace
- [x] **7.4** `src/ai/CleverBot.js` (extends SimBot) — trajectory simulation with per-target memory; simulation params: stepSize=10, simSteps=800, times=8 (turn≥8)
- [x] **7.5** `PhysicsEngine.simulate()` — fast trajectory simulation for AI: runs physics loop at larger timestep, returns closest approach distance to target station
- [x] **7.6** `src/ai/SuperBot.js` — extends CleverBot; smarter target selection (prefer close enemies); wormhole-aware simulation (turn≥3); strategic hyperspace
- [x] **7.7** `src/ai/MegaBot.js` — extends SuperBot; leaderboard-aware target selection; teammate coordination (avoid targeting same enemy); maximum simulation depth
- [x] **7.8** Verify: run 5-bot all-AI game on each scenario type; confirm kill rates approximately match spec (Randbot ≈1%, Cleverbot ≈12%, Megabot ≈50%)

---

## Phase 8 — Config Panel & Game Flow

Full start-to-finish playable game with UI.

- [x] **8.1** `src/ui/ConfigPanel.js` — DOM overlay panel: Players, Human/CPU, Stations/Player, CPU Level, Station Size, Planets, Scenario, Game Mode; each option is a cycle button; Start Game button
- [x] **8.2** Style config panel — dark space aesthetic matching the game; collapses/hides on game start; can be re-shown from a menu icon during play
- [x] **8.3** Demo mode — auto-start 5-AI game (red giant scenario) when page loads before player presses Start; any interaction dismisses demo and shows config
- [x] **8.4** Game-over screen — winner announcement drawn on canvas; "Play Again" / "New Game" prompt
- [x] **8.5** New game flow — re-run ScenarioFactory with new seed; reset all state; preserve tournament stats if in tournament mode
- [x] **8.6** Verify: full flow from landing page → demo → config → game → game over → new game works without errors

---

## Phase 9 — Scoring, Stats & Tournament Mode

- [x] **9.1** Kill resolution — on bullet hitting station: update `stationkills`, `teamkills`, classify kill type (strategy/oppression/tactical/bully/long/close/vengeance); update scores
- [x] **9.2** Own goal and suicide detection — same-team hit; update relevant counters; deduct from team score
- [x] **9.3** Leaderboard overlay — compact in-canvas or DOM overlay showing per-team: colour / score / kills / stations alive; visible during play, collapsible
- [x] **9.4** End-of-game stats screen — per-station breakdown: kills / shots / accuracy % / suicides / own goals / survived
- [x] **9.5** Tournament mode — accumulate stats across games; show running leaderboard; auto-advance on click/key after game over
- [x] **9.6** Awards screen (every 5 games) — Bloodlust / Oppression / Bully / Vengeance awards with winner highlight
- [x] **9.7** Tournament scoring formula: 1pt win + 1pt per kill + 1pt per surviving station − 1pt per own-team kill
- [x] **9.8** Verify: play a 5-game tournament; confirm scores accumulate correctly; awards screen appears at game 5; accuracy percentages are reasonable

---

## Phase 10 — Polish & Edge Cases

- [x] **10.1** Explosion animations — station explosion: radial particle burst in team colour; bullet explosion: smaller flash
- [x] **10.2** Wormhole animation — pulsing/rotating ring effect on wormhole planets
- [x] **10.3** Hyperspace animation — brief flash/scatter effect when station teleports
- [x] **10.4** "HYPERSPACING..." HUD text — replaces Angle/Power display; pulses in team colour
- [x] **10.5** First-run demo polish — demo game starts immediately; clean transition to config on interaction
- [x] **10.6** Edge cases: all stations killed simultaneously (draw); scenario generation fails after 1000 attempts (graceful fallback); wormhole teleport loop detection (MAX_TELEPORTS)
- [x] **10.7** Responsive canvas — resize handler recomputes `conv` factor and redraws background layer; game remains playable at any window size ≥ 800×600
- [x] **10.8** Performance pass — profile on a busy scenario (16 planets, 12 stations); ensure 30fps during simulation; optimise hot paths in physics loop if needed
- [x] **10.9** Cross-browser test — Chrome, Firefox, Safari, Edge

---

## Milestone Summary

| Phase | Deliverable |
|---|---|
| 1 | Star field + planets on screen |
| 2 | All 21 scenarios generating correctly |
| 3 | Stations placed, Death Star icons visible |
| 4 | Single bullet flies and hits things |
| 5 | Full AI-vs-AI game runs to completion |
| 6 | Human can play, HUD works |
| 7 | All 5 AI levels implemented and tuned |
| 8 | Full game flow: demo → config → play → game over |
| 9 | Scoring, stats, tournament mode |
| 10 | Animations, polish, edge cases, cross-browser |
| 11 | Balance tweaks, new options, rift interactions |
| 12 | Frozen condition + Electrostar + Magnetar |
| 13 | Gravitational time dilation (black holes / white dwarfs) |
| 14 | Space Mammoth SVG sprite system |

---

## Phase 11 — Balance Tweaks, New Options & Rift Interactions

Minor adjustments to existing systems and small new player-facing options.

### 11.1 Planet tuning

- [ ] **11.1** White Dwarfs scenario — audit default planet count; reduce to keep the field readable. Bias spawn placement toward the edges/periphery of the map rather than centre-heavy.
- [ ] **11.2** Black Holes scenario — cap typical count at 2–3; reduce the tail end of the random range so extreme counts (4+) are very rare.
- [ ] **11.3** Pulsars — reduce the radius of effect to 60% of current value. Narrow the frequency range so some pulsars are very low frequency (slow pulse) and some are moderate; remove the high-frequency end so no pulsar feels frantic.

### 11.2 Tournament & game options

- [x] **11.4** Tournament prizes — reduce rate and/or magnitude so prizes feel notable rather than constant. Review current config values and step them down; verify that a typical 10-game tournament doesn't drown everyone in weapons.
- [x] **11.5** Turn limit option — add a configurable turn limit to the config panel (Options page). When the limit is reached and no winner has been found, the game ends and the team with the most surviving stations wins (or a draw if tied). Show a countdown in the HUD from turn `limit − 5` onward.
- [x] **11.6** Resign game option — add a Resign button (accessible from the in-game menu or a small canvas button). Resigning eliminates the resigning team's remaining stations immediately; in tournament mode it scores as a loss with 0 survivors.
- [x] **11.7** Tournament: surviving teams claim collectables — add a tournament option. When enabled, at the end of a game all collectables remaining on the map are distributed as random weapons to the surviving teams (one collectable per team, round-robin if multiple collectables). Uses the standard 80/16/4% weapon tier weighting.
- [ ] **11.8** Modest starting weapons for non-dev mode — add "Minimal" to the Starting Weapons config option (currently hidden behind campaign completion). Minimal = 1 Triple Cannon per team. This makes the option visible to all players; the existing richer tiers (One at Random, Minor, One of Each, etc.) remain gated behind campaign completion as before.

### 11.3 Rift interactions

- [ ] **11.9** Rifts — reduce effect strength slightly (tune the force constant). Halve the range at which rifts influence bullets.
- [ ] **11.10** Ships bounce off rifts — when a moving station (movement speed ≠ Off) reaches the edge of a rift's influence radius, reflect its movement vector elastically so it cannot cross into or through the rift. Treat the rift boundary as an elastic wall for station movement only; bullet trajectories are unaffected.
- [ ] **11.11** Stations pushed by pulsars and white dwarfs — when movement is enabled, pulsars and white dwarfs apply a small outward push to stations within their gravitational radius each turn, nudging them away. Magnitude should be subtle — enough to slowly drift a parked station but not enough to fling it across the map.

---

## Phase 12 — Frozen Condition, Electrostar & Magnetar

Three new additions: a ship status condition and two new stellar body types.

### 12.1 Frozen condition

- [ ] **12.1** Add `frozen` stack counter to `Station` (integer 0–3, capped at triple frozen). Frozen is distinct from `DEAD` / `EXPLODING` — the station is still alive and visible.
- [ ] **12.2** Aiming phase: if `station.frozen > 0`, skip all angle/power input (keyboard, mouse, sliders). HUD replaces Angle/Power display with a centred label: `FROZEN` / `DOUBLE FROZEN` / `TRIPLE FROZEN` in the team colour. Only the End Turn button is active. AI stations in the frozen state skip their action and end their turn immediately.
- [ ] **12.3** Fire phase: frozen stations do not fire and do not execute movement. Their `frozen` counter decrements by 1 at the end of the turn (so a single-frozen station is unfrozen next turn).
- [ ] **12.4** Frozen VFX — while `frozen > 0`, cover the station with white particle sparks on Layer 2. Particles spawn at the start of the frozen turn and fade individually over the turn duration, leaving the station visible underneath. Particle count scales with freeze stack (more = more dramatic).
- [ ] **12.5** Frozen comet interaction — comets no longer destroy stations on contact. Instead they apply `frozen += 1` (capped at 3) and pass through. Update collision handling and requirements doc accordingly.
- [ ] **12.6** Team Shield and Armour still operate for frozen stations (the ship is immobilised, not defenceless). Document this in the frozen state spec.
- [ ] **12.7** Edge cases: a frozen station that is also hit by a bullet behaves normally (takes damage / is destroyed). Frozen does not grant immunity.

### 12.2 Electrostar

- [ ] **12.8** Add `ELECTROSTAR` to `PlanetType` enum. Appearance: compact neutron star body (similar to a white dwarf) with visible electric arc tendrils radiating from the surface. Gravity: 20% of white dwarf mass at equal radius.
- [ ] **12.9** Arc lightning mechanic: approximately once per turn (with some randomness ±30%), the Electrostar fires an arc in a random direction. The arc travels in a straight line from the star surface outward to 3× the star's radius. Any station the arc touches receives `electrified += 1`.
- [ ] **12.10** Electrified condition — same stack model as frozen (0–3, triple max). While electrified, the station's angle and power are randomised each turn (the player cannot control them); the station fires and moves at these random values. HUD shows `ELECTRIFIED` / `DOUBLE ELECTRIFIED` / `TRIPLE ELECTRIFIED`. Electrified counter decrements by 1 per turn. Implement this properly for both human and AI stations (the existing shock weapon electrified behaviour needs to be brought in line with this spec — audit and fix).
- [ ] **12.11** Electrostar rendering — animated electric arcs: short branching strokes radiating from the star surface, redrawn each frame with randomised branch points to give a sparkling/crackling appearance. Colour: bright cyan/white.
- [ ] **12.12** Add Electrostar to the wildcard planet pool (random bonus stellar object injection, §6.1 of requirements).
- [ ] **12.13** Add Electrostar scenario: 1–2 Electrostars placed amongst a standard asteroid field. Add to the scenario table in requirements and `scenarioData.js`.

### 12.3 Magnetar

- [ ] **12.14** Add `MAGNETAR` to `PlanetType` enum. Appearance: dense neutron star with visible looping magnetic field line overlay (animated). Gravity: 20% of white dwarf mass at equal radius (low, like Electrostar).
- [ ] **12.15** Magnetic force mechanic: unlike simple radial gravity, Magnetar exerts a **looping magnetic field** force on bullets. The field follows a dipole pattern — bullets are deflected laterally (perpendicular to the radial direction) depending on their position relative to the field poles. This produces curved, looping trajectories rather than simple infall. Tune the field constant so the effect is strong enough to be visibly interesting but not so strong it makes the game unplayable. Document the force formula in design.md.
- [ ] **12.16** Magnetar field line animation — draw a set of looping arc curves around the Magnetar (the classic dipole field-line pattern) on the background layer. Lines should animate (slowly rotating or pulsing) to communicate the magnetic field. Colour: warm amber/gold to distinguish from electric-blue Electrostar.
- [ ] **12.17** Add Magnetar to the wildcard planet pool.
- [ ] **12.18** Add Magnetar scenario: 1–2 Magnetars placed amongst a standard asteroid field. Add to scenario table in requirements and `scenarioData.js`.

---

## Phase 13 — Gravitational Time Dilation

Improves the visual quality of bullet paths near black holes and white dwarfs without increasing global computation costs. Grounded in a relativistic narrative.

- [ ] **13.1** Add an `eventHorizonRadius` property to black hole and white dwarf planets. This is a small inner radius (smaller than the existing `radius`) within which bullets are absorbed. For black holes: `eventHorizonRadius ≈ 0.15 × radius`. For white dwarfs: `eventHorizonRadius ≈ 0.25 × radius`.
- [ ] **13.2** Time dilation factor — compute `dilationFactor` for each active bullet each physics step:
  - For each black hole / white dwarf within range, compute `r = distance(bullet, planet)`.
  - The dilation zone begins at `3 × eventHorizonRadius` and falls linearly to `0` at `eventHorizonRadius`.
  - `dilationFactor = clamp((r − eventHorizonRadius) / (2 × eventHorizonRadius), 0, 1)`
  - Use the minimum dilation factor across all nearby dilating bodies.
- [ ] **13.3** Apply dilation to bullet step: multiply the effective `TIMESTEP` by `dilationFactor` for that bullet for that step. Compensate by multiplying the gravitational acceleration by `1 / dilationFactor` (so the bullet follows the same physical path — only the simulation step size changes, producing more trail sample points near the horizon).
- [ ] **13.4** Trail sampling: because the effective timestep is smaller near the horizon, trail points are recorded more densely there, producing a visibly smoother curved path — the cosmetic goal of the feature.
- [ ] **13.5** Event horizon absorption: if `r < eventHorizonRadius`, the bullet does not explode. Instead it transitions to a `FADING` state: no explosion VFX, the trail end fades to transparent over ~0.5 seconds. This replaces the current silent vanish behaviour.
- [ ] **13.6** Bullets ending their turn inside the dilation zone (but outside the event horizon) do not explode at turn end — they continue into the next turn still affected. Bullets that have been inside the zone for more than `BULLET_LIFE` steps are silently removed (existing timeout still applies).
- [ ] **13.6a** AI simulation (`PhysicsEngine.simulate()`) is explicitly exempt from time dilation. AI fast-step trajectories run at full speed regardless of proximity to black holes or white dwarfs. Dilation is a visual/cosmetic effect applied only to real-time bullet physics, not to AI path prediction.
- [ ] **13.7** Education / tutorial text — add a short paragraph to the game's About or Instructions panel explaining the time dilation effect in accessible language ("near a black hole, time itself slows — you can watch bullets freeze as they approach the event horizon").
- [ ] **13.8** Update `requirements.md` §5 (Planet Types) and `design.md` §4 (Physics Engine) to document the event horizon radius, dilation zone, and fading absorption behaviour.

---

## Phase 14 — Space Mammoth SVG Sprite System

Replaces the procedural Death Star station renderer with a vector sprite system driven by pre-converted SVG artwork. Full spec in `spec/space-mammoth-sprite-spec.md`.

- [ ] **14.1** Write `scripts/build-sprites.mjs` — Node script that parses a source SVG, extracts path data and keyframe annotations, resolves team colour placeholders, and emits a `*.sprite.js` module.
- [ ] **14.2** Author `assets/mammoth-saucer.svg` — the master artwork file. Must conform to the layer naming and placeholder colour conventions in the sprite spec.
- [ ] **14.3** Run the build script against the artwork; commit the generated `src/rendering/sprites/mammoth-saucer.sprite.js` to the repo.
- [ ] **14.4** `src/rendering/sprites/spriteUtils.js` — implement `_interpolateKeyframes()`, `_resolveColor()`, `_drawMorphLayer()`, `_drawTransformLayer()` helpers.
- [ ] **14.5** `src/rendering/sprites/SpriteRenderer.js` — implement `initSprite(sprite)` (builds `Path2D` objects at load), `drawStation(ctx, sprite, x, y, screenRadius, teamColors, animPhase)`, and the detail-level LOD check (hide mammoth at Micro/Tiny).
- [ ] **14.6** Wire `SpriteRenderer.drawStation()` into the main `Renderer.drawFrame()` in place of the existing `drawStation()` death-star implementation.
- [ ] **14.7** Populate `team.spriteColors` for all 12 teams — primary = team colour, secondary = derived complementary shade (static lookup table).
- [ ] **14.8** Verify on iPad: confirm 12-station game sustains 60fps; confirm no `ctx.filter`, no `createRadialGradient`, no per-frame `Path2D` construction in the hot path.
- [ ] **14.9** Remove the procedural Death Star `drawStation` code from `Renderer.js` once sprite system is proven.
- [ ] **14.10** Update `requirements.md` §11.4 (Station Visual Design) and `design.md` §5.4 to reference the sprite system and retire the Death Star description.
