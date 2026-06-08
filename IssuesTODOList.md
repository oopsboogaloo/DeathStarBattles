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



- [x] **Rocket Pod** — New collectable weapon: fires 8 rockets in succession at Blaster timing (one per second). Each rocket is a standard Rocket with ½ blast radius and ±1° random angle deviation. Rockets alternate spawning left/right of the station (perpendicular to aim direction, 1× hit-radius offset). 1 charge per collectable. Aim indicator shows 3 representative lines at −1°/0°/+1°; no path preview (self-propelled); ghost trail shows all 8 trails. Mission 11 (Rocket Corps) gets 1 starting Rocket Pod charge for player and AI. See `spec/rocket-pod.md`.

- [x] **Named Seeds** — Allow players to enter a text string as a map seed. The seed deterministically generates the planet layout (count, types, positions, masses, wormhole pairings, asteroid shapes) via a separate PRNG, case-insensitively. Scenario and Planets config options grey out when a seed is active. Seed is shown as the map name in-game. See `spec/named-seeds.md`.

- [x] **Moons** — New planet type with multi-hit destruction, crater rendering, and a dedicated scenario.

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

- [x] **Space Rift** — New non-solid map object: a piecewise-linear chain of 3–11 connected segments (each ~1 Medium station diameter long, ≤30° turn between segments). Each vertex exerts a linear-falloff repulsive force on bullets, allowing slow shots to be deflected and fast shots to punch through. Background layer renders a forked lightning glow; the rift line itself is a static luminescent polyline. Adds two new scenarios (Rift: 1 rift + sparse planets; Rifts: 2–6 rifts + planets/asteroids) and a 10% wildcard chance. AI trajectory simulation picks up the repulsion automatically. See `spec/space-rift.md`.

- [x] **Fragmentation Shot** — New collectable weapon. The primary shot bounces inelastically off planets, stations, and asteroids, and explodes after a set timer into a lethal spread of fragments that behave like blaster bullets. See `spec/fragmentation-shot.md`.

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

- [x] **Septuple Cannon** — Rare variant of the triple cannon. Fires 7 cannon shots simultaneously across a wider arc; grants exactly 1 use when collected. See `spec/septuple-cannon.md`.

  **Weapon Behaviour (FR-1)**
  - 7 cannon shots fired simultaneously, evenly distributed across the arc
  - Each shot behaves identically to a standard cannon shot

  **Collectable Grant (FR-2)**
  - Grants exactly 1 use (not stacked)

  **Rarity (FR-3)**
  - Rare drop weight; specific tier TBD (OQ-2: pending rarity tier review)

  **Tuneability (NFR-1)** — named constants:
  - Shot count (default: 7)
  - Arc width (default: TBD — wider than triple cannon arc; resolve during playtesting — OQ-1)

- [x] **Pulse Laser** — Rare, powerful laser variant. Fires 9 laser pulses sequentially, sweeping across a ±15° arc around the selected angle, with slight random jitter per pulse. See `spec/pulse-laser.md`.

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

- [x] **Fragmentation Shot** — New collectable weapon. The primary shot bounces inelastically off planets, stations, and asteroids, and explodes after a set timer into a lethal spread of fragments that behave like blaster bullets. See `spec/fragmentation-shot.md`.

  **Tuneability (NFR-1)** — named constants:
  - Primary shot speed (default: 75% of max cannon power)
  - Primary shot bounce speed retention (default: 60%)
  - Timer range min (default: 1 s) / max (default: 5 s)
  - Fragment count min (default: 11) / max (default: 13)
  - Fragment speed min (default: 20% of max cannon power) / max (default: 40% of max cannon power)
  - Primary trail thickness multiplier (default: 2×)

## Future Weapons

- [x] **Dual Blaster** — Fires two blaster bursts in different independently-aimed directions, like the shotgun barrel 2 mechanic applied to the blaster.

- [ ] **Team Shield** — Deploys a Force Shield on every active friendly station simultaneously; the firing station does not fire a shot this turn.

  **Availability (FR-1)**
  - Not offered to players in single-station-per-team games (it would always be wasted); suppress it from the weapon selector when the team has only one station configured
  - A player whose team is down to one surviving station may still hold stock of this weapon and use it in a future turn when reinforcements arrive; it is only hidden at game-setup time based on the configured station count, not dynamically during play

  **Behaviour (FR-2)**
  - On use: a Force Shield is deployed on every active friendly station (same shield mechanics as the Force Shield weapon)
  - The station that used Team Shield does not fire any projectile this turn
  - Consumes one charge

- [ ] **Teleport** — Instantly relocates the firing station to a player-designated destination. Uses the angle and power controls: angle sets direction, power maps to distance (max distance = map diagonal). A destination marker is shown in the aim preview so the player can see exactly where they will land before firing.

  **Timing (FR-1)**
  - The teleport fires at the start of the turn (approximately 1 second in, before other projectiles resolve) — the station disappears from its origin and reappears at the destination immediately, not at end-of-turn.

  **Safe Landing (FR-2)**
  - The destination is always safe: if the computed arrival point would overlap a planet, asteroid, star, black hole, or any station (friendly or enemy), the destination is nudged to the nearest clear location along the same direction vector.
  - The station can never materialise inside a solid body.

  **Force Shield on Arrival (FR-3)**
  - The station materialises with a Force Shield already active, which persists for the remainder of that turn.
  - This protects it from any projectiles already in flight that might pass through the new location during the same turn.

  **Controls & Preview (FR-4)**
  - Angle selector sets travel direction as normal.
  - Power slider sets distance: minimum power → short hop, maximum power → full map diagonal.
  - Aim preview renders a destination marker (e.g. a ghost/outline of the station) at the computed safe landing point, updating live as angle/power change.

- [ ] **Electro Stun** — Fires a cone of electric shocks in the aimed direction. Any enemy station caught in the cone is stunned for one turn (cannot move or shoot). No direct damage.

- [ ] **Super Laser** — Star-Wars-style planet-destroying laser. Fires a massive beam that obliterates any planet it passes through. Extremely rare; single use.

- [ ] **Reinforcement Signal** — Fires a directional distress signal that travels across the map; if it reaches a screen edge a reinforcement ship is beamed in there at end of turn.

  **Projectile (FR-1)**
  - The signal is an animated waveform-like line rendered in the firing team's colour, travelling in the aimed direction
  - Angle selector sets direction; no power control (power is fixed)
  - Travel speed: 50% of max cannon speed
  - Gravity influence: 0.2× the normal gravity ratio (low inertia — travels mostly straight but curves slightly)

  **Reflection & Absorption (FR-2)**
  - Reflects off all hard surfaces (planets, asteroids, moons, stations) using the same elastic bounce as other reflecting projectiles
  - Absorbed and destroyed on contact with a star, dwarf star, or black hole — no reinforcement triggered

  **Wormholes (FR-3)**
  - Passes through wormholes and exits from the paired wormhole, continuing in the same direction

  **Reinforcement Spawn (FR-4)**
  - If the signal reaches any screen edge it triggers a reinforcement: at the end of that turn, one extra friendly station is beamed in at the point where the signal crossed the edge
  - Available even in single-station-per-team games (unlike Team Shield)
  - Only one reinforcement spawns per signal (the first edge contact counts; signal is then consumed)
  - The new station enters with default loadout and is controlled by the same player/AI as the rest of the team

- [ ] **Resupply** — No aim or power input. When triggered, 3–5 weapon collectables beam in near the firing station at the end of that turn. Collectables are high-tier and available for any team to collect.

- [ ] **Quantum Torpedo** — A torpedo that teleports through solid celestial bodies. On contact with any planet except a gas giant, a teleport VFX plays at the entry point, the torpedo instantly reappears at the straight-line exit point on the far side of the body, and a second VFX plays at the exit point. The torpedo continues on its original trajectory from the exit point and detonates only on station contact. Gas giants are treated normally (torpedo passes through without teleporting). Requires new teleport SFX and exit-point geometry calculation (ray vs sphere intersection for the far side).

- [x] **Bounce Cannon** — Cannon shot that reflects off solid planet surfaces (like Fragmentation Shot) but explodes immediately on station contact.

- [ ] **Mind Control Beam** — A laser-class weapon that fires an animated sine-wave beam. If the beam strikes an enemy station, that station is permanently converted to the firing team for the rest of the game.

  **Firing & Travel (FR-1)**
  - Aimed like a standard laser (angle selector, no power control)
  - The beam travels subject to gravity, identical to a laser
  - Stops at the first hard surface it contacts (planet, asteroid, moon, station) — does not pass through
  - Absorbed by stars, dwarf stars, and black holes (same as laser)
  - Longer charge-up / firing delay than other laser beams to signal its significance

  **Visuals (FR-2)**
  - Rendered as an animated sine-wave line rather than a straight beam
  - Drawn in the firing team's colour

  **Conversion (FR-3)**
  - On contact with an enemy station: the station immediately joins the firing team for the remainder of the game
  - The converted station's colour changes to the firing team's colour
  - Converted station is controlled by the same player/AI as the rest of the firing team from the next turn onwards
  - This counts as a kill for stats purposes

  **Win Condition (FR-4)**
  - After conversion, check if any opposing team still has active stations; if not, the round ends immediately (converted station may be the last enemy)

- [ ] **Mammoth Cannon** — A rare, prized heavy-artillery weapon. Fires a single massive cannonball that follows the exact same gravitational trajectory as a standard cannon shot at the chosen angle and power, but travels at half the speed — giving it a slow, imposing, unmistakably dangerous feel.

  **Projectile (FR-1)**
  - Launched at 50% of the speed a normal cannon shot would have at the same power setting
  - Follows identical gravitational physics to a cannon shot (same path, just slower)
  - Bullet is rendered significantly larger than a standard cannonball (size defined as a named constant multiplier; default 3×)
  - Leaves a thick trail (same flag as Fragmentation Shot primary)
  - Continuous fireball particle effects emit from the bullet during flight — glowing embers/sparks in orange/yellow/red that drift and fade, making the projectile look alive and dangerous

  **Impact (FR-2)**
  - On contact with any station or solid body, triggers a large, slow-expanding explosion
  - Explosion radius is significantly wider than a standard cannon blast (default 4× blast radius constant)
  - The explosion animation plays at a slower speed than normal to emphasise scale
  - Clears a wide area: anything within the blast radius is destroyed

  **Fragmentation (FR-3)**
  - On detonation, 11 fragments are spawned at the impact point
  - Fragment velocity: random directions across 360°, random speed 30–60% of max cannon power
  - Fragments behave like standard cannon bullets (subject to gravity, destroy stations on contact)
  - Single random rotational offset applied to the spread (same pattern as Fragmentation Shot)

  **Rarity & Acquisition (FR-4)**
  - Rare drop; grants exactly 1 charge per collectable
  - Included in the tier-2/rare collectable pool

  **Tuneability (NFR-1)** — named constants:
  - Speed multiplier (default: 0.5× cannon speed)
  - Bullet size multiplier (default: 3×)
  - Blast radius multiplier (default: 4×)
  - Fragment count (default: 11)
  - Fragment speed min (default: 30% of max cannon power) / max (default: 60%)
  - Explosion animation speed multiplier (default: 0.4× normal speed)

- [x] **Scatter Cannon** — Standard cannon shot that fragments into 5 sub-shots shortly after leaving the barrel, each travelling at a slightly different angle.

- [x] **Auto Cannon** — Fires 5 cannon shots in rapid succession, each with a small random angular deviation from the aimed direction.

- [x] **Spiral** — Fires blaster shots sequentially in all directions (360° sweep), one per blaster timing interval.

- [x] **Star Shot** — Fires 5 cannon shots simultaneously, evenly spread across 360° (like a star pattern); angle sets the rotation of the pattern, power sets shot speed as usual.

- [ ] **Hedgehog** — High-tier weapon. Deploys a Force Shield on the firing station and then fires 12 rockets outward in all directions across 4 rapid volleys.

  **Shield (FR-1)**
  - A Force Shield deploys on the firing station immediately when Hedgehog is used, before any rockets fire

  **Rocket Volleys (FR-2)**
  - 4 volleys of 3 rockets fire in quick succession after the shield deploys
  - Each volley is a triangular spread: 3 rockets equally spaced at 120° from each other
  - Each successive volley is rotated 30° from the previous, so all 12 rockets travel in distinct directions with no overlap:
    - Volley 1: 0°, 120°, 240°
    - Volley 2: 30°, 150°, 270°
    - Volley 3: 60°, 180°, 300°
    - Volley 4: 90°, 210°, 330°
  - No angle or power input — rockets always fire outward in all directions

  **Rocket Behaviour (FR-3)**
  - Each rocket uses the same reduced-impact stats as Rocket Pod rockets (½ standard blast radius)
  - Otherwise identical to standard rockets (self-propelled, gravity-affected, standard rocket visuals and SFX)

  **Rarity (FR-4)**
  - High-tier / rare collectable; grants 1 charge per pickup

- [ ] **Gravity Cannon** — Fires a large slow-moving gravitational mass along a standard cannon trajectory. Its own gravity warps the paths of other projectiles nearby, and it kills stations with a dramatic implosion rather than an explosion.

  **Trajectory (FR-1)**
  - Follows the exact same arc as a normal cannon shot at the same angle and power, but traverses it at half speed
  - Achieved by launching at half the normal initial velocity with gravity coefficient reduced to ¼ normal — the path is identical, the timing is doubled
  - Uses standard angle and power controls

  **Gravitational Mass (FR-2)**
  - The projectile exerts its own gravitational attraction on other bullets in flight, with a mass comparable to a comet
  - This will visibly bend the trajectories of nearby shots (friendly and enemy alike) toward the projectile as it passes

  **Visuals (FR-3)**
  - Rendered as a large projectile (similar scale to Mammoth Cannon)
  - Leaves a thick trail; no fireball effect (distinct from Mammoth Cannon)

  **Impact (FR-4)**
  - Destroyed on contact with any solid body (planet, asteroid, moon, star, dwarf star, black hole, or station)
  - No explosion on destruction

  **Station Kill (FR-5)**
  - When the projectile contacts a station, the station is destroyed via a fast implosion: the station rapidly shrinks to nothing with no outward explosion
  - Counts as a normal kill for stats

  **Tuneability (NFR-1)** — named constants:
  - Speed multiplier (default: 0.5× cannon speed)
  - Gravity coefficient multiplier (default: 0.25× normal)
  - Gravitational mass (default: comet-scale constant, TBD during tuning)

- [ ] **Repulsor Field** — Like Force Shield, this weapon allows the firing station to also fire a cannon shot on the same turn. In addition, a modest repulsive force field is applied centred on the station, identical in behaviour to a Space Rift node (linear-falloff repulsion on nearby bullets). This deflects incoming projectiles that pass close to the station.

  **Cannon Shot (FR-1)**
  - The station fires a normal cannon shot this turn (same as Force Shield behaviour — weapon does not consume the firing action)

  **Repulsion (FR-2)**
  - A repulsive force is applied to all bullets within range, centred on the firing station
  - Force model: linear falloff from maximum at the station centre to zero at the falloff radius — identical to a Space Rift node
  - Strength is modest: enough to deflect slow or nearby shots but not to halt fast ones outright
  - Affects all bullets (friendly and enemy alike)

  **Duration (FR-3)**
  - The repulsion field persists for the same duration as a Force Shield (one full round — active until the station's next turn)

  **Visuals (FR-4)**
  - Visual treatment TBD; should communicate an active repulsion zone around the station (e.g. a faint pulsing ring or distortion effect)

- [ ] **Armour** — Grants the firing station two armour layers that absorb incoming hits.

  **Armour Layer Appearance (FR-1)**
  - Each armour layer is rendered as a circular dashed line around the station, slightly larger than the station radius, not animated
  - Multiple layers are rendered as concentric dashed circles, each at a slightly larger radius than the last so all are visible simultaneously

  **Hit Absorption (FR-2)**
  - When a projectile contacts a station that has at least one armour layer, the outermost layer absorbs the hit entirely: no explosion, no damage, no associated VFX or SFX from the projectile itself
  - The absorbed layer plays a brief hit SFX: the dashed ring flashes white and then fades out very quickly (e.g. ~0.2 s)
  - After the flash the layer is permanently removed; the remaining inner layers shift out to fill the visual gap (or simply remain at their fixed radii)

  **Persistence (FR-3)**
  - Armour layers persist across turns until consumed by hits
  - All remaining armour layers are removed at the end of the game (no carry-over between games)

  **Grant (FR-4)**
  - Each use of Armour grants 2 layers to the firing station
  - Multiple uses stack: using Armour twice gives 4 layers

## Polish

<!-- e.g. - [ ] Description -->

## Mobile / Usability

<!-- e.g. - [ ] Description -->
