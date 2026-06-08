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



- [x] **Rocket Pod** *(Tier 2)* — New collectable weapon: fires 8 rockets in succession at Blaster timing (one per second). Each rocket is a standard Rocket with ½ blast radius and ±1° random angle deviation. Rockets alternate spawning left/right of the station (perpendicular to aim direction, 1× hit-radius offset). 1 charge per collectable. Aim indicator shows 3 representative lines at −1°/0°/+1°; no path preview (self-propelled); ghost trail shows all 8 trails. Mission 11 (Rocket Corps) gets 1 starting Rocket Pod charge for player and AI. See `spec/rocket-pod.md`.

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

- [x] **Fragmentation Shot** *(Tier 2)* — New collectable weapon. The primary shot bounces inelastically off planets, stations, and asteroids, and explodes after a set timer into a lethal spread of fragments that behave like blaster bullets. See `spec/fragmentation-shot.md`.

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

- [x] **Septuple Cannon** *(Tier 2)* — Rare variant of the triple cannon. Fires 7 cannon shots simultaneously across a wider arc; grants exactly 1 use when collected. See `spec/septuple-cannon.md`.

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

- [x] **Antimatter Laser** *(Tier 3)* — Rare, devastating laser variant. Fires 9 laser pulses sequentially, sweeping across a ±15° arc around the selected angle, with slight random jitter per pulse. See `spec/pulse-laser.md`.

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
  - Tier 3 drop weight; rare and exciting to find

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

### Collectable Weapon Tiers

Collectables are assigned a tier that governs drop rarity and starting-weapon eligibility.

**Tier 1 — Common.** Stronger than the basic cannon but never game-changers on their own. These are the bread-and-butter upgrades players will see often. Candidates for being offered as starting weapons outside dev mode once the tier system is fully tuned.

**Tier 2 — Rare.** Deadly and highly desirable. A tier-2 weapon meaningfully swings a round; players will fight over them. Some tier-2 weapons appear in story-mode missions as scripted pickups.

**Tier 3 — Exceptional.** Game-changing or genuinely unusual. Each tier-3 weapon should feel exciting to discover and dramatic in effect — converting enemies, spawning reinforcements, warping gravity, destroying planets. These are rare enough that seeing one mid-match is an event.

---

- [x] **Dual Blaster** *(Tier 1)* — Fires two blaster bursts in different independently-aimed directions, like the shotgun barrel 2 mechanic applied to the blaster.

- [ ] **Team Shield** *(Tier 2)* — Deploys a Force Shield on every active friendly station simultaneously; the firing station does not fire a shot this turn.

  **Availability (FR-1)**
  - Not offered to players in single-station-per-team games (it would always be wasted); suppress it from the weapon selector when the team has only one station configured
  - A player whose team is down to one surviving station may still hold stock of this weapon and use it in a future turn when reinforcements arrive; it is only hidden at game-setup time based on the configured station count, not dynamically during play

  **Behaviour (FR-2)**
  - On use: a Force Shield is deployed on every active friendly station including the firing station (same shield mechanics as the Force Shield weapon)
  - The station that used Team Shield does not fire any projectile this turn
  - Consumes one charge

- [ ] **Teleport** *(Tier 2)* — Instantly relocates the firing station to a player-designated destination. Uses the angle and power controls: angle sets direction, power maps to distance (max distance = map diagonal). A destination marker is shown in the aim preview so the player can see exactly where they will land before firing.

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

- [ ] **Electro Stun** *(Tier 2)* — Fires a fan of forked lightning across an aimed arc. Any station hit becomes Electrified for their next turn: they auto-fire a random cannon shot and cannot move or act.

  **Controls (FR-1)**
  - Left control: angle (direction the arc is centred on), as normal
  - Right control: spread — adjustable from 5° (tight, long-range) to 45° (wide, short-range)
  - As spread increases, effective range decreases proportionally; a narrow beam reaches far, a wide fan reaches close

  **Lightning Visuals (FR-2)**
  - Fires multiple forked lightning bolts that together fill the arc segment
  - Each bolt is crudely modelled — jagged/branching, not straight — rendered in the firing team's colour with a glow effect
  - Lightning is not a persistent projectile; it resolves instantly on firing (like a laser)

  **Blocking (FR-3)**
  - Lightning is blocked by planets, moons, and asteroids — solid bodies cast a shadow; stations behind them are not hit
  - Not blocked by stations — lightning passes through all stations (friendly and enemy alike) and can hit any station within the arc, including friendly ones

  **Electrified Condition (FR-4)**
  - Any station within the arc and within range that is not shielded by a solid body becomes Electrified
  - An animated lightning effect plays over the station for the remainder of that turn and the following turn as a visual indicator
  - Electrified is a generalised status condition; other weapons or phenomena may also inflict it

  **Electrified Turn Behaviour (FR-5)**
  - On the Electrified station's next turn: the game automatically fires a cannon shot for it at a random angle and random power; the station cannot move
  - No damage is dealt to the station itself
  - If the auto-fire shot destroys a station (friendly or enemy) it counts as a normal kill for the electrified station's team
  - The condition expires after one turn; the station returns to normal the turn after

  **Human Player UX (FR-6)**
  - If the Electrified station belongs to a human player, their turn still comes up normally
  - The UI displays an "Electrified" message; all aim and move controls are disabled
  - The auto-fire resolves automatically; the player can only acknowledge and end their turn
  - The condition lasts exactly one turn regardless of player type

- [ ] **Super Laser** *(Tier 3)* — An iconic, devastating superweapon. Multiple convergence beams assemble at a focal point and then fire a single catastrophic beam in the aimed direction. Destroys everything in its path short of stars and black holes.

  **Firing VFX (FR-1)**
  - On activation: several thin beams (the convergence beams) animate rapidly assembling inward to a focal point just ahead of the station, in the aimed direction
  - After a short charge-up, the focal point erupts into the main beam — a thick, blinding, particle-rich laser that fires along the aim angle
  - The overall look references the Death Star superlaser aesthetic: dramatic convergence → single devastating discharge
  - Accompanied by impressive SFX and glowing particle effects throughout the charge and firing sequence

  **Beam Travel & Penetration (FR-2)**
  - The beam travels in a straight line in the aimed direction (no gravity deflection — it is too powerful to bend)
  - Destroys all enemy stations it passes through; friendly stations are not harmed by the beam itself
  - Destroys asteroids, comets, and moons it passes through without slowing or stopping
  - Passes through gas giants without destroying them and without stopping
  - Continues until it hits a solid planet, star, dwarf star, or black hole

  **Planet Destruction (FR-3)**
  - On contact with a solid planet: the planet is instantly destroyed
  - The destroyed planet leaves 3–5 asteroid fragments at the impact site, identical to moon destruction behaviour
  - A large explosion at the impact point (similar in scale to a rocket explosion) damages anything — friendly or enemy — caught in the blast radius

  **Star / Hazard Contact (FR-4)**
  - On contact with a star, dwarf star, or black hole: the beam is absorbed and stops
  - A rocket-scale explosion triggers at the contact point, damaging anything — friendly or enemy — caught in the blast radius
  - The star/dwarf star/black hole itself is unaffected

  **Controls (FR-5)**
  - Angle selector only — no power control (beam always travels at full extent)
  - No aim path preview (the beam is straight and unaffected by gravity)

  **Rarity (FR-6)**
  - Extremely rare; grants exactly 1 charge per collectable
  - Tier 3 drop weight

- [ ] **Reinforcement Signal** *(Tier 3)* — Fires a directional distress signal that travels across the map; if it reaches a screen edge a reinforcement ship is beamed in there at end of turn.

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

- [ ] **Resupply** *(Tier 2)* — No aim or power input. When triggered, 3–5 weapon collectables beam in near the firing station at the end of that turn. Collectables are high-tier and available for any team to collect.

- [ ] **Quantum Torpedo** *(Tier 3)* — Fires and travels like a standard cannon shot but teleports through any solid non-station body it contacts, reappearing on the far side and continuing on its way.

  **Controls & Appearance (FR-1)**
  - Aimed and fired identically to a cannon shot (angle + power)
  - Travels subject to gravity in the same way as a cannon shot
  - Rendered identically to a standard cannon shot — it looks like a normal cannonball

  **Teleport Behaviour (FR-2)**
  - On contact with any solid non-station body (planet, asteroid, moon): the torpedo teleports
  - Exit point is computed by casting a ray from the contact point along the torpedo's current velocity vector to find where it exits the far surface of that body
  - The torpedo instantly reappears at the exit point with the same velocity and continues on its original trajectory
  - Can teleport multiple times if it subsequently contacts further bodies

  **Teleport VFX (FR-3)**
  - A brief teleport flash/ripple plays at the entry contact point
  - A matching flash/ripple plays at the exit point as it reappears
  - SFX accompanies each teleport

  **Station Contact (FR-4)**
  - On contact with a station: detonates and destroys the station normally (no teleport — stations are not teleported through)

  **Hazard Contact (FR-5)**
  - On contact with a star, dwarf star, or black hole: the torpedo is destroyed as normal (no teleport)

- [x] **Bounce Cannon** *(Tier 1)* — Cannon shot that reflects off solid planet surfaces (like Fragmentation Shot) but explodes immediately on station contact.

- [ ] **Triple Quantum Torpedo** *(Tier 3)* — Fires 3 Quantum Torpedoes simultaneously across a narrow arc, identical to how the Triple Cannon relates to a standard cannon shot. Each torpedo behaves exactly as a single Quantum Torpedo (teleports through solid bodies, detonates on station contact).

- [ ] **Quantum Auto Cannon** *(Tier 3)* — Fires 5 Quantum Torpedoes in rapid succession with small random angular deviation, identical to how the Auto Cannon relates to a standard cannon shot. Each torpedo behaves exactly as a single Quantum Torpedo (teleports through solid bodies, detonates on station contact).

- [ ] **Mind Control Beam** *(Tier 3)* — A laser-class weapon that fires an animated sine-wave beam. If the beam strikes an enemy station, that station is permanently converted to the firing team for the rest of the game.

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
  - If the firing player is human, they gain direct and full control of the converted station from the next turn onwards — it behaves as a second station under their command
  - If the firing player is AI, the converted station is controlled by that AI
  - This counts as a kill for stats purposes

  **Win Condition (FR-4)**
  - If conversion leaves an opposing team with no remaining stations, the round ends at the end of that turn in the normal way — no immediate termination mid-turn

- [ ] **Mammoth Cannon** *(Tier 3)* — A rare, prized heavy-artillery weapon. Fires a single massive cannonball that follows the exact same gravitational trajectory as a standard cannon shot at the chosen angle and power, but travels at half the speed — giving it a slow, imposing, unmistakably dangerous feel.

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

- [x] **Scatter Cannon** *(Tier 1)* — Standard cannon shot that fragments into 5 sub-shots shortly after leaving the barrel, each travelling at a slightly different angle.

- [x] **Auto Cannon** *(Tier 2)* — Fires 5 cannon shots in rapid succession, each with a small random angular deviation from the aimed direction.

- [x] **Spiral** *(Tier 1)* — Fires blaster shots sequentially in all directions (360° sweep), one per blaster timing interval.

- [x] **Star Shot** *(Tier 1)* — Fires 5 cannon shots simultaneously, evenly spread across 360° (like a star pattern); angle sets the rotation of the pattern, power sets shot speed as usual.

- [ ] **Hedgehog** *(Tier 2)* — High-tier weapon. Deploys a Force Shield on the firing station and then fires 12 rockets outward in all directions across 4 rapid volleys.

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

- [ ] **Gravity Cannon** *(Tier 3)* — Fires a large slow-moving gravitational mass along a standard cannon trajectory. Its own gravity warps the paths of other projectiles nearby, and it kills stations with a dramatic implosion rather than an explosion.

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

- [ ] **Repulsor Field** *(Tier 1)* — Like Force Shield, this weapon allows the firing station to also fire a cannon shot on the same turn. In addition, a modest repulsive force field is applied centred on the station, identical in behaviour to a Space Rift node (linear-falloff repulsion on nearby bullets). This deflects incoming projectiles that pass close to the station.

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

- [ ] **Armour** *(Tier 1)* — Grants the firing station two armour layers that absorb incoming hits.

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
