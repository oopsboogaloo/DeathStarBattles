# DeathStarBattles — Issues & TODO List

Issues and improvements to address. Add new items below with a short description.
Resolved items have been moved to ResolvedTODOList.md.

---

## Bugs

- [x] Collectable special weapons: if a team has only 1 of a special weapon and a station uses it, it remains selectable by the next station — should be greyed out / disabled once the team's supply hits 0.

## Improvements

<!-- e.g. - [ ] Description -->

## Features

- [x] **Crystal Asteroid scenario** — New scenario "Crystal Asteroids" in the regular rotation, same layout as the existing Asteroids scenario but all asteroids are replaced with Crystal Asteroids. A Crystal Asteroid is the same size and fragmentation behaviour as a regular asteroid, but bullets pass through without being destroyed (the asteroid still shatters and plays its destruction effect). Child fragments are also Crystal Asteroids. Gameplay intent: players can aim through crystal asteroid fields without their shots being blocked.

- [x] **Rich Asteroids** — 5% of all asteroids (including child fragments) are Rich Asteroids, visually distinguished by a blue-brown tint. When a Rich Asteroid is destroyed it always spawns one collectable weapon collectable in addition to its normal child fragments. Only active when the Collectable Weapons setting is ON.



- [ ] **Rocket Pod** — New collectable weapon: fires 8 rockets in succession at Blaster timing (one per second). Each rocket is a standard Rocket with ½ blast radius and ±1° random angle deviation. Rockets alternate spawning left/right of the station (perpendicular to aim direction, 1× hit-radius offset). 1 charge per collectable. Aim indicator shows 3 representative lines at −1°/0°/+1°; no path preview (self-propelled); ghost trail shows all 8 trails. Mission 11 (Rocket Corps) gets 1 starting Rocket Pod charge for player and AI. See `spec/rocket-pod.md`.

- [ ] **Named Seeds** — Allow players to enter a text string as a map seed. The seed deterministically generates the planet layout (count, types, positions, masses, wormhole pairings, asteroid shapes) via a separate PRNG, case-insensitively. Scenario and Planets config options grey out when a seed is active. Seed is shown as the map name in-game. See `spec/named-seeds.md`.

- [ ] **Moons** — New planet type with multi-hit destruction, crater rendering, and a dedicated scenario.

  **Appearance**
  - White/blue colour palette; procedurally generated craters (circular/elliptical, randomised each game) with raised rims and shadowed interiors consistent with the solid-colour aesthetic
  - Size range similar to or smaller than standard rocky planets

  **Damage & crack rendering**
  - Hit 1: crack lines radiate outward from the impact point across the surface
  - Hit 2: additional cracks from the new impact point, overlapping existing cracks
  - Hit 3: moon destroyed — replaced by 3–5 child asteroid fragments (existing irregular convex polygon type) with no initial velocity, standard asteroid mass
  - Only projectile impacts count; station collisions and other bodies do not
  - Gravitational influence remains constant regardless of damage state

  **Station movement collision**
  - Moving station contacts a moon → elastic bounce identical to asteroid behaviour

  **Moons scenario** (new scenario in regular rotation)
  - One central planet of standard or larger size near screen centre
  - Small number of moons at varying orbital radii around the central planet, spaced for tactical depth

  **Wildcard pool**
  - Moons included in the wildcard candidate list for all scenarios that support wildcards

- [ ] **Space Rift** — New non-solid map object: a piecewise-linear chain of 3–11 connected segments (each ~1 Medium station diameter long, ≤30° turn between segments). Each vertex exerts a linear-falloff repulsive force on bullets, allowing slow shots to be deflected and fast shots to punch through. Background layer renders a forked lightning glow; the rift line itself is a static luminescent polyline. Adds two new scenarios (Rift: 1 rift + sparse planets; Rifts: 2–6 rifts + planets/asteroids) and a 10% wildcard chance. AI trajectory simulation picks up the repulsion automatically. See `spec/space-rift.md`.

- [ ] **Fragmentation Shot** — New collectable weapon. The primary shot bounces inelastically off planets, stations, and asteroids, and explodes after a set timer into a lethal spread of fragments that behave like blaster bullets. See `spec/fragmentation-shot.md`.

  **Weapon Selection UI (FR-1)**
  - Replaces the power slider with a timer slider (range: 1–5 s)
  - Angle selector behaves identically to other weapons

  **Firing (FR-2)**
  - Primary shot launches at 75% of max cannon power
  - Countdown timer starts from the moment of firing at the player-selected duration

  **Primary Shot — Visual (FR-3)**
  - Rendered in the firing player's colour (same as other shots)
  - Trail is slightly thicker than a standard bullet trail (thickness defined as a named constant multiplier; default 2×)

  **Primary Shot — Bounce Behaviour (FR-4)**
  - Reflects velocity about the surface normal on contact with a planet, station, or asteroid
  - Post-impact speed = 60% of pre-impact speed
  - Timer continues without reset
  - Does NOT destroy a station on contact

  **Primary Shot — Destroyed by Hazard (FR-5)**
  - Contacting a star, dwarf star, or black hole destroys the primary shot
  - No fragments spawned; timer cancelled

  **Detonation (FR-6)**
  - On timer expiry: primary shot destroyed at current position
  - 11–13 fragments spawned at that position (count chosen at random)

  **Fragment Velocity Distribution (FR-7)**
  - Each fragment speed: random in 20–40% of max cannon power
  - Directions evenly distributed across 360° (spacing = 360° / fragment count)
  - Single random rotational offset applied to the entire spread
  - Fragment velocities independent of the primary shot's velocity at detonation

  **Fragment Physics (FR-8)**
  - Subject to gravitational forces from all bodies
  - Do NOT bounce off any surface

  **Fragment Visuals (FR-9)**
  - Rendered identically to a blaster bullet (colour, size, trail)

  **Fragment Contact (FR-10)**
  - Destroyed on contact with any body (star, dwarf star, black hole, planet, asteroid, or station)
  - Destroys a station on contact

  **Fragment Skimming (FR-11)**
  - Fragments can skim a star surface per the Projectile Skimming feature (FR-1 of that spec)
  - Skim shots stat incremented on skim

  **Collectable Availability (FR-12)**
  - Included in the tier-2 collectable pool

- [ ] **Pulse Laser** — Rare, powerful laser variant. Fires 9 laser pulses sequentially, sweeping across a ±15° arc around the selected angle, with slight random jitter per pulse. See `spec/pulse-laser.md`.

  **Weapon Selection UI (FR-1)**
  - UI behaves identically to the standard laser (angle selector, no power/timer slider)

  **Firing Sequence (FR-2)**
  - 9 pulses fired sequentially, ~0.1 s apart
  - Total sequence duration ~0.8 s (8 intervals)

  **Pulse Arc Distribution (FR-3)**
  - Angles evenly distributed from (selected − 15°) to (selected + 15°)
  - Each pulse receives independent random angular jitter (default ±1°, tunable)
  - Firing order sweeps −15° → +15°

  **Individual Pulse Behaviour (FR-4)**
  - Each pulse is identical to a standard laser (travel, gravity, damage, destruction rules)

  **Rarity (FR-5)**
  - Assigned a rare drop weight; specific tier TBD (OQ-1: pending rarity tier system review)

  **Tuneability (NFR-1)** — named constants:
  - Pulse count (default: 9)
  - Arc half-width (default: 15°)
  - Interval between pulses (default: 0.1 s)
  - Per-pulse jitter range (default: ±1°)

- [ ] **Fragmentation Shot** — New collectable weapon. The primary shot bounces inelastically off planets, stations, and asteroids, and explodes after a set timer into a lethal spread of fragments that behave like blaster bullets. See `spec/fragmentation-shot.md`.

  **Tuneability (NFR-1)** — named constants:
  - Primary shot speed (default: 75% of max cannon power)
  - Primary shot bounce speed retention (default: 60%)
  - Timer range min (default: 1 s) / max (default: 5 s)
  - Fragment count min (default: 11) / max (default: 13)
  - Fragment speed min (default: 20% of max cannon power) / max (default: 40% of max cannon power)
  - Primary trail thickness multiplier (default: 2×)

## Polish

<!-- e.g. - [ ] Description -->

## Mobile / Usability

<!-- e.g. - [ ] Description -->
