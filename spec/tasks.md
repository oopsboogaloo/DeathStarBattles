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
