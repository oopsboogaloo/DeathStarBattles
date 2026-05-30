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

## Polish

<!-- e.g. [ ] Sound effects -->
