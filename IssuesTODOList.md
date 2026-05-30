# DeathStarBattles — Issues & TODO List

Issues and improvements to address. Add new items below with a short description.
Resolved items have been moved to ResolvedTODOList.md.

---

## Bugs

- [x] **Angle buttons reversed** — fixed: ► now calls `humanAngle(-0.1)` (clockwise = decreasing angle), ◄ calls `humanAngle(+0.1)`. Keyboard Z/A remain counter-clockwise, X/S clockwise.

## Improvements

<!-- e.g. [ ] Description -->

## Features

- [x] **Modal Information Pages** — About, Instructions, and Education overlays accessible from the main menu.

  **Trigger**: clicking About, Instructions, or Education on the main menu replaces the menu with the corresponding modal. A close button and ESC key return to the menu.

  **About**
  ```
  Death Star Battles
  © Chloe Bolland 2026
  Based on a game I wrote 25 years ago.
  ```

  **Instructions** — single screen:
  ```
  HOW TO PLAY

  Each turn, every player sets an angle and power for their
  station to fire a projectile at their opponents. When all
  players have chosen, all projectiles fire simultaneously.
  Projectiles are affected by the gravity of planets and stars.
  Last station standing wins.

  CONTROLS
  Mouse: Use the sliders to set angle and power. Click the
  circle around your station to aim directly.

  Keyboard:
  Z / X or A / S    Change angle
  J / N or K / M    Change power
  H                 Toggle hyperspace
  Return            Fire / End turn
  P                 Pause / Unpause
  O                 Slow motion (while paused)

  HYPERSPACE
  Instead of firing, click Hyperspace then End Turn to
  teleport your station to a random location.

  WINNING
  Destroy all enemy stations to win. Stations are destroyed
  by direct projectile hit. Watch out for gravity wells —
  your own shots can curve back and hit you.
  ```

  **Education** — paginated (Previous / Next + page indicator), 8 pages:
  1. **Gravity** — the invisible force pulling all masses together; more mass = stronger pull.
  2. **Newton** — laws of motion; how Newton unified terrestrial and celestial mechanics; F = ma.
  3. **Inverse square law** — gravity weakens with distance squared; double distance = quarter force; F = Gm₁m₂/r²
  4. **Orbits** — why planets don't fall into the sun; balance between gravity and tangential velocity; circular and elliptical orbits; Kepler's laws.
  5. **Three-body problem** — two bodies is solvable, three is not; sensitive dependence on initial conditions.
  6. **Chaos theory** — small differences in starting conditions produce wildly different outcomes; why this game is different every time.
  7. **Astronomical bodies** — planets, stars, red giants, white dwarfs, neutron stars, black holes, white holes, and wormholes; what they are and how their gravity differs.
  8. **How this game models physics** — Euler integration, timestep simulation, n-body gravity approximation, and where the model simplifies reality.

- [x] **Gas Giant Planet Type** — a new planet type that projectiles pass through, with banded rendering and interior gravity.

  **Colour**: one random pair from: purple/red · red/yellow · yellow/blue · blue/purple.

  **Rendering**:
  - Horizontal stripes alternating between the two colours, spanning the full disc.
  - Rendered at 50% transparency so background stars show through.
  - Stripe pattern is static — does not rotate.
  - Same size range as standard rocky planets.

  **Physics — exterior** (projectile outside planet radius): standard inverse-square gravity, identical to all other planet types.

  **Physics — interior** (projectile inside planet radius):
  - Projectile passes through without destruction.
  - Gravity reduces linearly from full surface gravity at the planet edge to zero at the core: `g(r) = g_surface × (r / R)` where r = distance from centre, R = planet radius.

  **Scenarios**:
  - **Jovian scenario**: replace the central Jupiter body with a gas giant of equivalent mass.
  - **New "Gas Giants" scenario**: map populated exclusively with gas giants in random positions.
  - Gas giant mass participates in gravitational calculations for all projectiles and stations in any scenario it appears.

- [x] **Station Movement** — optional feature (toggle in config menu) allowing stations to move each turn before bullets fire.

  **Config**: a toggle in the config/menu panel enables or disables station movement for the whole game. Off by default.

  **Human UI** (when feature is enabled):
  - A Move button appears alongside the Hyperspace button during a player's turn.
  - Clicking Move enters movement targeting mode; clicking a point on screen sets the station's velocity vector based on direction and distance from station to clicked point.
  - A transparent triangle is displayed on the station indicating the current velocity vector's direction and magnitude.
  - Velocity resets to zero at the start of the following turn (one-turn boost only).

  **Simulation**:
  - All stations move simultaneously with bullet simulation at end of turn.
  - Station path intersects a planet or asteroid → station is destroyed.
  - Two stations occupy the same cell during movement → both destroyed.
  - Maximum station speed is capped well below minimum projectile speed.

  **AI behaviour** (when feature is enabled):
  - **RandBot / AimBot**: small random velocity applied with low probability, no gravitational awareness.
  - **CleverBot**: occasional movement, biased away from immediate gravitational danger but not optimised.
  - **SuperBot**: calculates local gravitational potential energy gradient; moves toward lower gravitational influence in the majority of turns.
  - **MegaBot**: same gradient calculation as SuperBot, but suppresses movement if it would reduce average distance to friendly stations below a minimum threshold.

## Bugs

- [x] **"Click or press any key to start" hint persists after demo** — fixed: `_hideDemoHint()` now called before the btn-bar guard so the `{ once: true }` listener always clears the text.

- [ ] **Stations placed on top of each other** — the placement algorithm occasionally fails to enforce minimum separation between stations, resulting in two or more stations spawning at the same or nearly identical position. Investigate the tier-2 and tier-3 fallback paths in `ScenarioFactory.placeStations` and ensure a hard minimum station–station separation (at least `2 × stationRadius`) is enforced even in the last-resort push-to-surface fallback.

- [ ] **Ghost trail breaks at wormhole entry** — when a bullet passes through a wormhole the trail is split by a `null` marker, but the ghost trail renderer (`_drawGhostTrail`) currently skips null entries and draws nothing for the post-wormhole segment. Fix so all segments of the previous shot are drawn, including the portion after teleport, so players can see the full trajectory.

- [ ] **Station movement speed too high** — reduce `MAX_STATION_SPEED` (and the `humanSetMove` cap) by 50%. Update the matching constant in `Renderer.js` accordingly. — the demo-mode hint text shown at the bottom of the screen is not being reliably hidden when the user first interacts. The `{ once: true }` event listeners in `startDemo()` call `_hideDemoHint()`, but if the first interaction is swallowed (e.g. by a btn-bar guard or a race), the listener removes itself without hiding the element, leaving the text permanently visible. Fix the hide logic so it is robust regardless of interaction order.

## Improvements

- [ ] **Hide aim/power controls during movement targeting** — when `gs.waitingForMove` is true, hide the `AimControls` DOM element entirely (angle/power sliders and readout) so the player sees only the canvas and the Move/Cancel button. Restore aim controls when movement targeting is cancelled or confirmed.

- [ ] **Darken and blue-shift the background nebula** — the star field is currently too bright and distracting. Reduce overall star alpha by ~20% and shift the colour palette slightly cooler (increase the blue channel weighting across all palette buckets). Aim for a darker, deeper space feel that lets planets and bullets read more clearly.

- [ ] **Gas giant soft blur** — apply a subtle blur to the gas giant disc (similar to the star corona offscreen-canvas technique) to soften its stripe edges and make it read as a gaseous body rather than a flat graphic. A 2–3 px blur radius should be sufficient; it must not affect the background layer behind it.

- [ ] **Giant wormhole halo too thick** — the big wormholes (scenario 18 off-screen paired type) render with the same halo ring thickness as normal wormholes, but at their enormous display radius the effect is overwhelming. Halve the `lineWidth` multiplier for wormholes whose radius exceeds a threshold (e.g. display radius > 100 px). Normal-sized wormholes must remain unchanged.

- [ ] **Remove scenario label from top-right** — the `scenario-label` div (e.g. "3. Star System") shown in the top-right corner during play should be removed. No replacement needed.

- [ ] **Resume / close menu button** — when a game is in progress and the player opens the config panel (via the ⚙ button), a "Resume Game" button should appear at the top of the panel that closes the panel and returns to the current game without restarting it.

## Features

- [ ] **Improved ship and asteroid explosions** — replace the current simple ring animation with a two-layer effect:
  - **Shockwave**: solid filled circle at the impact point that expands quickly, slows, then fades to transparent. Colour = team colour for ships, dark red (`#8b1a1a`) for asteroids.
  - **Particles**: 12–20 small debris particles launched radially from the centre at random angles and speeds, each fading over ~0.8 s. Particles inherit the shockwave colour with slight hue variation.
  - The shockwave should be large enough to mask the object's removal for at least the first few frames.
  - Bullet impact explosions (existing ring) remain unchanged.

- [ ] **Bullet trail glow** — add a short glowing trace just behind each active bullet each frame:
  - Drawn as a series of 6–10 fading line segments along the most-recent trail points.
  - The tip (closest to bullet) is bright white; segments cool toward the team's trail colour over the length of the trace.
  - Drawn on the live canvas layer each frame (not baked into the trails canvas), so it doesn't persist.

- [ ] **Performance mode** — add a PERFORMANCE option to the config panel (default: FULL):
  - **FULL**: current behaviour, all effects enabled.
  - **SIMPLIFIED**: disables Gaussian blur (`ctx.filter = 'blur(...)'`) on star coronas and star fields; caps selectable planets at 20 and players at 4 in the config UI; disables particle effects from explosions and the bullet trail glow.
  - The setting should be stored in config and passed into the renderer and game loop so all relevant paths check it before drawing expensive effects.

## Polish

- [x] **Score display moved to modal** — live leaderboard removed from game screen. "Scores" link in config panel opens a modal showing the last game's team scores, kills, and station status.

- [x] **Star corona lines brighter** — bristle opacity doubled (outer layer 0.30→0.60, inner layer 0.45→0.90).

- [x] **Gas giant curved stripes** — stripes now rendered as quadratic bezier curves bowing downward; per-stripe amplitude is deterministically varied by stripe index + planet position. Base fill is colour A; curved colour-B bands overlay it, giving both stripe types curved edges.

- [x] **Pulsar stellar object** — white-dwarf-mass body emitting expanding circular pressure rings:
  - Period 0.5–5 seconds (random per pulsar).
  - Rings expand over 1.5 s to 180 game-unit radius, fading in opacity and push strength.
  - Any bullet crossing an active ring receives an outward radial impulse `(1 − t) × 0.09`.
  - New scenario 23 "Neutron Star": one pulsar + mixed rocky planets and asteroids.
  - Pulsars added to the wildcard bonus pool (~15% chance alongside white dwarfs and black holes).

- [x] **Config panel player/planet/station limits expanded**:
  - Players: all integers 2–12 selectable.
  - Max stations per player raised to **8**.
  - Planets: up to **50**, with multiples of 5 above 10 (10, 15, 20 … 50). Random range unchanged.

- [x] **Game speed rebalance + new speed tiers**:
  - Normal reduced by 30% (42 physics steps/frame, was 60).
  - All speeds scaled proportionally: Slow = 21, Fast = 84.
  - Added **Very Slow** (¼× = 11 steps/frame) and **Very Fast** (4× = 168 steps/frame).
