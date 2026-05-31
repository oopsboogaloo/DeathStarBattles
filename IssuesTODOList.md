# DeathStarBattles — Issues & TODO List

Issues and improvements to address. Add new items below with a short description.
Resolved items have been moved to ResolvedTODOList.md.

---

## Bugs

- [x] **Hyperspace overlap** — hyperspace can place a station overlapping another station. The destination should be rejected and resampled if it would cause any station-to-station overlap, using the same minimum separation check applied during initial station placement.

## Improvements

<!-- e.g. - [ ] Description -->

## Features

- [x] **Stations pass through wormholes** — when a station's position overlaps a wormhole during movement (station movement feature), teleport it to the paired/cyclic/random exit using the same logic as bullets in `PhysicsEngine._handlePlanetImpact`. The station should emerge just outside the exit wormhole's surface, preserving its velocity direction. If the exit is a self-wormhole it emerges on the opposite side. Applies to all wormhole types; gas giants already pass bullets through so stations should also pass through gas giants without destruction.

- [x] **Red wormhole network** — currently red wormholes (`WORMHOLE_RANDOM`) teleport to a completely random map position, identical to green. Change red wormhole behaviour so a bullet entering any red wormhole exits from a randomly chosen *other* red wormhole on the map (i.e. they form a random-destination network among themselves). If only one red wormhole exists, fall back to the current random-position behaviour. Requires a new `PlanetType` (e.g. `WORMHOLE_NETWORK`) or repurposing the existing red colour with modified logic in `PhysicsEngine._handlePlanetImpact`.

- [x] **Team Clustering** — add a Team Clustering option to the config panel cycling through: Off, Tight, Moderate, Loose. Default is Off (current random placement behaviour unchanged). Has no effect on teams with only one station. When non-Off, stations on the same team are placed near each other: Tight = within a few station diameters; Moderate = within roughly one quarter of the map width; Loose = within the same map quadrant. Enemy teams are unconstrained relative to each other or to friendly clusters. All existing placement constraints (min distance from planets, map boundaries, etc.) still apply.

- [x] **Asteroid Ring scenario** — new named scenario with a central gas giant (usually centred, occasionally offset so ≥25% of its diameter remains visible) surrounded by one ring of asteroids (common) or rarely two or three concentric rings. Each ring has a defined radius and random band thickness (narrow to moderately thick); asteroids are placed at random positions within the band, not evenly spaced. Multiple rings must not overlap. Uses the existing irregular convex polygon asteroid type. Default asteroid count is approximately double the normal random range; player-specified counts are honoured and distributed proportionally by ring circumference across multiple rings. No other planet types unless a random wildcard condition fires (at most one additional non-gas-giant body). Off-screen offset cases must keep all asteroids on screen. Stations may be placed anywhere on the map including inside ring bands.

- [x] **Asteroid Belt scenario** — new named scenario with no central body. Belt centre point is off screen by default (random position well beyond the screen boundary), occasionally near/at screen centre as a variation. One belt (common), rarely two or three concentric belts. Each belt has a defined radius and random band thickness (narrow to moderately thick); asteroids placed at random positions within the band, not evenly spaced. Multiple belts must not overlap. Uses the existing irregular convex polygon asteroid type. No gravitational body at the belt centre — geometry is purely positional. Default asteroid count is approximately double the normal random range; player-specified counts honoured and distributed proportionally by belt circumference. No other planet types unless a random wildcard condition fires (at most one additional body, no gas giant). Stations may be placed anywhere on the map including inside belt bands.

- [x] **Game Options Explained** — add a "?" or "Help" button on the main config panel that opens a popup overlay explaining each game option in turn. The popup should describe what each option does, its valid values, and the effect of each value, in plain language. Should cover all config options: Players, Human/CPU, Stations/Player, CPU Level, Station Size, Planets, Scenario, Game Mode, Team Clustering, Wildcard Planets, and any future options added. Dismissible by clicking outside or pressing Escape. Styled consistently with the existing dark space aesthetic.

- [x] **Wildcard Frequency menu option** — add a Wildcard Planets option to the config panel cycling through: Off, Very Rare, Rare, Occasional, Common, Always. Default is Rare (current behaviour). Off suppresses wildcard placement entirely. Very Rare places wildcards at a significantly lower probability than current. Occasional is moderately higher than Rare. Common gives a high probability such that most scenarios include at least one wildcard. Always guarantees at least one wildcard in every scenario that supports wildcards. The selected frequency applies uniformly to all wildcard-supporting scenarios.

- [x] **Comets** — new dynamic entity distinct from static planets. Each comet has a random initial velocity and moves each timestep under gravity from all other bodies, but with a significantly reduced effective G for its own movement (making it weakly attracted). Comets continue simulating off screen and resume rendering when they re-enter. Their gravitational influence on projectiles and stations uses normal mass-based gravity (unaffected by the reduced G). A projectile colliding with a comet destroys both; a comet colliding with a planet, star, or asteroid destroys the comet. Rendering: bright nucleus consistent with the solid-colour aesthetic; pale blue tail trailing opposite the velocity direction, length proportional to speed (no tail when near-stationary). Comets are added to the wildcard candidate list for any scenario. Two new named scenarios: **Comet** — one small star near centre, a small number of random asteroids, and a single comet already on screen with a random initial velocity; **Oort Cloud** — a white dwarf as the central body with 4–10 comets given approximate circular orbital velocities at their starting radii plus random variance to produce elliptical/irregular orbits.

## Polish

<!-- e.g. - [ ] Description -->

## Mobile / Usability

- [x] **Aiming circle size option** — add a config option cycling through: Smaller, Regular, Larger, Mammoth. Scales the aiming circle to 0.5×, 1×, 2×, and 3× the default radius respectively. Default is Regular (current behaviour unchanged). Applies to all stations and all game modes.

- [x] **Accelerating angle/power buttons** — when a player holds down an angle or power adjustment button, the rate of change should accelerate over time so that large adjustments can be made quickly without losing the ability to make subtle changes with a short tap. A brief tap should produce a small increment similar to today; holding should ramp up smoothly so that after a second or two of continuous hold the change rate is significantly faster. The acceleration curve should feel natural on touch (no sudden jumps).

- [x] **Minimal UI mode** — add a config option to enable a compact button layout for small screens. In minimal mode: replace button labels with single characters or icons (X = end turn, H = hyperspace, M = move station); remove any redundant text; shrink button footprint where possible. Default is off (current layout unchanged). Should be noticeably less obstructive on a Galaxy Fold-sized screen.

- [x] **Skip round when all humans eliminated** — once every human-controlled station has been destroyed, show two buttons at the bottom of the screen: **Fast FWD** and **Skip**. Fast FWD immediately switches the game to its fastest speed setting for the remainder of the round; when the next round begins, restore the speed to whatever it was before Fast FWD was activated. Skip bypasses the rest of the round entirely by simulating the outcome: repeatedly and randomly determine which station hits and destroys which enemy station until only one team (or no team — a draw) remains, using approximate per-CPU-level accuracy weights (e.g. Easy ~30%, Medium ~50%, Hard ~70%, Ace ~85%) so the simulation doesn't wildly distort overall match statistics. Apply the simulated kills/deaths to scores as if they had happened in play. Both buttons are only visible while human players are all eliminated and disappear at the start of the next round.

- [x] **Hide shot controls during hyperspace** — when a station has hyperspace selected as its action, hide the angle indicator, power indicator, and their associated buttons/labels entirely, since they are irrelevant for a hyperspace jump. The UI should update immediately when the player switches action mode and restore the controls when they switch back to firing.
