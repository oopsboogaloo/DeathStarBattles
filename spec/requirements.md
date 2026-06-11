# DeathStarBattles — Requirements

> HTML5 port of the original DeathStarBattles Java applet (© Ian Bolland 2001). Faithful to the 2D gameplay and physics, with a modern UI replacing the Java AWT controls. The original was itself a remake of *Gravity Wars* by Edward Bartz (Amiga/DOS), which this project continues the lineage of.

---

## 1. Overview

DeathStarBattles is a turn-based, 2D gravity-warfare game for 2–12 players (human and/or AI). Players control **space stations** (styled as Star Wars "death star stations"). Each turn, every player sets a firing angle and power level; when all have chosen, **all missiles fire simultaneously** so turn order is irrelevant. Bullets travel through a gravitational field created by planets, stars, black holes and other celestial objects. The goal is to destroy all enemy stations.

The game is a direct remake of *GravityWars* (Amiga/DOS, early 1990s, by Edward Bartz) — the defining mechanic is that bullets follow curved paths through gravity, requiring players to anticipate the physics rather than aim directly at a target. It is closest in spirit to *Worms* for the turn structure but played in zero-G 2D space.

---

## 2. Core Game Loop

1. **Setup phase** — players configure number of players, AI level, scenario, station size, and game mode, then press Start.
2. **Aiming phase** — the current human player sets angle and power. AI players calculate their shots automatically.
3. **Fire phase** — all shots fire simultaneously once every player has acted. Bullets travel until they hit a planet, a station, leave the play area, or time out.
4. **Resolution phase** — hits are scored, explosions play, destroyed stations are removed.
5. **Next turn** — play passes to the next surviving station. Destroyed players are skipped.
6. **Win condition** — the last team with surviving stations wins. In tournament mode, a leaderboard accumulates across games.

---

## 3. Physics

### 3.1 Gravity
- Each planet exerts Newtonian gravitational acceleration on all active bullets: `a = G * M / r²`
- `G = 0.2` (fixed constant)
- Planet mass `M = radius² × density`
- Acceleration is applied each simulation timestep (`timestep = 0.15`)
- Multiple planets all apply force simultaneously — bullets can be slung around massive bodies

### 3.2 Bullet Firing
- Initial velocity is derived from angle and power: `vx = (power/1000 + 0.2) * 0.8 * sin(angle)`, `vy = (power/1000 + 0.2) * 0.8 * cos(angle)`
- Bullet spawns just outside the firing station, offset in the firing direction
- Power range: 1–800 (maps to roughly 0.16–0.64 velocity units)
- Angle: 0–359 degrees

### 3.3 Bullet Termination
A bullet is destroyed (or teleported) when it:
- Enters a planet's radius — behaviour depends on planet type (see §5)
- Hits a station's radius — that station is destroyed
- Leaves the play boundary (which extends beyond the visible screen)
- Exceeds the maximum lifetime (8000 simulation steps)

### 3.4 Trail
- Each bullet's path is recorded as a polyline of pixel positions, sampled every N steps
- The trail is drawn during the resolution phase so players can learn from each shot

---

## 4. Stations (Players)

### 4.1 Configuration
- 2–12 stations total, divided into teams
- Each team can have 1 or more stations (up to `floor(12 / num_teams)`)
- Station size is configurable: Micro / Tiny / Small / Medium / Large / Giant / Mammoth (affects hit radius and visual size)
- Station colours are fixed per team: green, cyan, yellow, red, purple, blue, orange, grey, white, black, pink, brown

### 4.2 Per-turn Actions
Each station selects a weapon, then either fires or takes its weapon's action:
- **Cannon** — standard single bullet at the configured angle and power. Default weapon, infinite uses.
- **Hyperspace** — teleport to a random valid location instead of firing. Infinite uses.
- **Triple Cannon** — fires 3 bullets simultaneously at `[angle − 5°, angle, angle + 5°]`, each at the same power. 3 charges per collectable.
- **Plasma Blunderbuss** — fires 11 bullets simultaneously with random spread across ±15° (not evenly spaced). Each bullet is assigned a random velocity of 25–30% of max cannon speed and a random short lifetime (17–23% of normal) so shots fizzle out nearby. Velocity is not adjustable. Trails are thin and semi-transparent. 2 charges per collectable.
- **Laser** — fires a beam after a randomised brief delay (varies per station so simultaneous lasers stagger visually). The path is simulated as an extremely fast bullet under 100% normal gravity (enough to visibly bend around neutron stars and black holes), then rendered as a bright glowing line (white core, team-colour glow). The laser pierces all targets — destroying asteroids and killing stations without stopping. Reflected elastically by Force Shields. Power controls are hidden (angle only). 1 charge per collectable.
- **Rocket** — fires a self-propelled rocket that starts slow and accelerates under thrust using a fuel model. Power sets fuel load: more fuel = heavier start but longer burn. When fuel is exhausted the rocket becomes a ballistic projectile. Travels through wormholes (teleports like a bullet) and passes through gas giants. On impact or shoot-down, an expanding blast circle grows to its maximum radius over ~0.4 seconds — any station, bullet, asteroid, or collectable inside the circle when the blast reaches it is destroyed; collectables grant their weapon to the rocket owner. Leaves a team-coloured smoke trail of expanding-then-contracting puffs that linger as a visible trail. Off-screen edge indicators shown like bullets. 1 charge per collectable.
- **Blaster** — fires 5 shots in succession, one approximately every second of real time (at normal game speed). Shots are spread progressively: −10°, −5°, 0°, +5°, +10° from the aimed angle, at 55% of max cannon speed. Velocity not adjustable. Thin transparent trails. 3 charges per collectable.
- **Minigun** — fires 13 shots in rapid succession at 3× the Blaster rate, each with ±2° random angle variation, at 150% of max cannon speed. Velocity not adjustable. Thin semi-transparent trails. 1 charge per collectable.
- **Force Shield** — deploys a protective shield for the remainder of the turn instead of firing, analogous to Hyperspace. All incoming bullets and lasers are reflected elastically off the shield boundary. Rockets detonate on contact. The shield is displayed as a pulsing ring slightly larger than the station in the team colour. UI indicates the shielded state in the same way as Hyperspace. 2 charges per collectable.

### 4.3 Aiming Controls
Human players control angle and power via:
- **Mouse drag** — click near the station and drag; direction sets angle, distance from station sets power. A visual arrow and power indicator renders in real-time.
- **Keyboard** — angle: Z/X (±1°), A/S (±5°); power: K/M (±1), J/N (±10)
- **UI sliders** — angle slider (0–360), power slider (1–800) shown in the control panel

### 4.4 Hyperspace
- Available via the weapon selector (H key or weapon button)
- Station is teleported to a random free position at start of next turn (before firing)
- Cannot be used if the station is already destroyed
- Forced every turn in the Hyperspace scenario (§6.26)

### 4.5 Station Movement
- When Movement Speed is set to anything other than Off, stations drift slowly around the map each turn
- Speed tiers: Glacial (1×), Slow (2×), Normal (3×), Fast (5×), Rocket (8×)
- Movement is purely positional drift — it does not affect the station's angle or power settings

#### 4.5.1 Rift bounce (11.10)
During movement resolution, a station may not cross a rift segment. When the station's movement path would intersect any rift segment (geometric line check), its velocity vector is reflected elastically off that segment's normal — identical to the screen-edge bounce. Applies to all movement modes. Stations placed by hyperspace inside a rift's geometric boundary are immediately ejected perpendicular to the nearest rift segment to the nearest clear side. Bullet trajectories are unaffected by this rule.

#### 4.5.2 Pulsar nudge (11.11)
When movement is enabled (any speed other than Off), pulsar pressure rings interact with stations. Each time a pressure ring sweeps through a station's position (i.e. the ring's expanding radius crosses the station's distance from that pulsar), the station receives a single outward velocity nudge of `0.2 × MAX_MOVE_SPEED` in the radially-outward direction. Nudges accumulate; total speed is capped at the station's configured move speed. If the station had no queued move that turn, nudges still apply and set it in motion. Multiple pulsars and multiple rings act independently.

#### 4.5.3 White hole push (11.11)
When movement is enabled, stations within 40 game units of a white hole are continuously pushed outward during movement resolution. Force magnitude scales linearly from maximum at distance 0 to zero at distance 40, applied each movement step. Accumulated speed is capped at 1.5× the station's configured move speed (so a player cannot fully counter it by commanding movement toward the white hole, but a strong move command can partially resist). No effect when movement is Off.

### 4.6 Special Weapons & Collectables

#### Weapon Selector
The Hyperspace button is replaced by a **weapon selector** showing the currently selected weapon. Clicking the button (or pressing H) opens a vertical popup listing all available weapons with remaining use counts. If only Cannon and Hyperspace are available, H toggles directly between them without a popup.

Selected weapon resets to Cannon at the start of each turn.

#### Triple Cannon
- Fires 3 bullets simultaneously at `[angle − 5°, angle, angle + 5°]`
- Each bullet is an independent physics entity with its own trail in the team colour
- Consumes one use per firing (not per bullet); brief triple-arc muzzle-flash VFX plays on the station before the bullets launch
- Not in the default loadout — acquired by shooting collectables

#### Shotgun
A double-barrelled spread weapon. Each barrel fires 6 pellets in a ±8° cone at blunderbuss speed (MAX_V × 0.25–0.30) with blunderbuss lifetime (17–23% of standard). Barrel 2 fires 300 physics steps (~0.5 s) after Barrel 1. Total: 12 pellets per use.

**Aiming UI:** The right-hand slider is repurposed as a **Barrel 2 angle** control (same ±0.1° precision as the angle slider; power slider hidden). Barrel 2 angle initialises to Barrel 1's angle at the start of each turn and is stored in `station.angle2`.

**Aim indicator:** Both barrel directions shown on a single aim circle. Barrel 1 lines at full opacity (centre 0.95 / flanking 0.45); Barrel 2 lines at reduced opacity (centre 0.60 / flanking 0.28). Three representative paths per barrel at −8°, 0°, +8°. Ghost trail shows all 12 pellet paths (6 per barrel).

2 charges per collectable.

**Named constants:** `SHOTGUN_PELLETS` (6 per barrel), `SHOTGUN_SPREAD` (8°), `SHOTGUN_SPEED_MIN` (0.25 × MAX_V), `SHOTGUN_SPEED_MAX` (0.30 × MAX_V), `SHOTGUN_INTERVAL_STEPS` (300), `SHOTGUN_LIFETIME_MIN` (0.17 × BULLET_LIFE), `SHOTGUN_LIFETIME_MAX` (0.23 × BULLET_LIFE).

#### Rocket Pod
Fires 8 rockets in succession at Blaster timing (one per second at normal speed). Each rocket is a standard Rocket with ½ blast radius and ±1° independent random angle deviation per rocket. Rockets alternate spawning perpendicular-left/right of the aim direction, offset 1× station diameter (2× hit-radius) from the station centre — odd-indexed (1, 3, 5, 7) spawn left, even-indexed (2, 4, 6, 8) spawn right. Trajectories are parallel (not converging). Turn does not end until all 8 rockets have resolved. 1 charge per collectable.

**Aim indicator:** 3 representative lines at −1°, 0°, +1° (centre line 0.95 / 2px; flanking 0.45 / 1px). No bullet path preview (thrust overrides gravity). Ghost trail shows all 8 rocket paths.

**Story mode:** Mission 11 (Rocket Corps) grants 1 starting Rocket Pod charge to both the human player and AI teams (`startingWeapons: { rocket: 99, rocketPod: 1 }`).

#### Collectables
- Rotating geometric gem-shaped entities (visually crystal-shaped) that spawn at random valid map positions
- Not affected by gravity; do not stop bullets — a bullet passes straight through and the collectable is destroyed
- Spawn probability is configurable (see §10); maximum 3 collectables on the map simultaneously
- Do not spawn in the Hyperspace scenario
- When a bullet destroys a collectable: the bullet continues on its trajectory; the collecting team receives charges of a **randomly chosen weapon** (weighted by tier — see §4.7); a shatter VFX plays at the collectable position; the weapon name fades in/out in the bullet owner's team colour
- A rocket blast also destroys collectables within its blast radius, granting the weapon to the rocket owner's team
- The weapon type is decided at collection time, not at spawn
- When a Rich Asteroid fragments, the collectable **replaces** one child fragment — it does not spawn on top of a child
- Weapon stocks are **shared across all stations on a team** and **carry over between tournament games**

| Weapon | Charges per collectable |
|---|---|
| Triple Cannon | 3 |
| Plasma Blunderbuss | 2 |
| Laser | 1 |
| Rocket | 1 |
| Blaster | 3 |
| Minigun | 1 |
| Force Shield | 2 |

> **Naming note:** In code and design documents, these entities are called `Collectable` / `collectables` throughout. The name `Crystal` / `crystal` is **reserved** for a separate future entity type and must not be used for collectables.

#### AI Behaviour with Collectables
- All AI levels use Triple Cannon when they have stock (they spend it opportunistically)
- Randbot and Aimbot use a random probability check before spending stock
- Cleverbot, Superbot, and Megabot factor stock use into their existing shot-selection logic
- Superbot and Megabot opportunistically aim for collectables when selecting targets

### 4.7 Weapon Tiers

Weapons are grouped into three tiers that govern their drop probability from collectables. Higher tiers are rarer.

| Tier | Name | Drop chance |
|---|---|---|
| 1 | Common | 80% |
| 2 | Uncommon | 16% |
| 3 | Rare | 4% |

A tier is rolled first at the stated probability, then a weapon is chosen uniformly at random from all weapons in that tier.

**Tier 1 — Common**

| Weapon | Charges per pickup |
|---|---|
| Triple Cannon | 3 |
| Plasma Blunderbuss | 2 |
| Rocket | 1 |
| Blaster | 3 |
| Force Shield | 2 |
| Bounce Cannon | 4 |
| Scatter Cannon | 2 |
| Resupply | 1 |
| Quantum Torpedo | 3 |

**Tier 2 — Uncommon**

| Weapon | Charges per pickup |
|---|---|
| Laser | 1 |
| Rocket Pod | 1 |
| Minigun | 1 |
| Septuple Cannon | 2 |
| Frag Shot | 2 |
| Shotgun | 2 |
| Dual Blaster | 3 |
| Star Shot | 1 |
| Spiral | 1 |
| Team Shield | 1 |
| Armour | 1 |
| Repulsor Field | 2 |
| Teleport | 3 |
| Auto Cannon | 2 |
| Triple Quantum Torpedo | 3 |

**Tier 3 — Rare**

| Weapon | Charges per pickup |
|---|---|
| Antimatter Laser | 1 |
| Mammoth Cannon | 1 |
| Quantum Auto-Cannon | 1 |
| Gravity Cannon | 1 |
| Super Laser | 1 |
| Reinforcement Signal | 1 |
| Mind Control Beam | 1 |
| Hedgehog | 1 |

> **Note:** Electro Stun exists as a weapon but is excluded from the pickup pool. It can only be granted via developer mode.

---

## 5. Planet Types

All planets exert gravity unless stated otherwise. Planet impact behaviour when a bullet enters the planet radius:

| Type | Colour | Impact Behaviour |
|---|---|---|
| Rocky planet | Brown/tan | Bullet explodes on impact |
| Asteroid | Dark brown | Bullet explodes on impact; fragments into 2–4 child asteroids |
| Crystal Asteroid | Icy blue-white | **Bullet passes through** — asteroid shatters and fragments into Crystal Asteroid children; bullet is not destroyed. Exception: **Bounce Cannon** reflects off elastically and smashes the asteroid (bullet survives). |
| Rich Asteroid | Blue-brown | Same as Asteroid; additionally spawns one Collectable on destruction. Only appears when Collectables setting is ON (5% of asteroids). |
| Star | Yellow/orange | Bullet explodes on impact |
| White Dwarf | White | Bullet explodes on impact; very small radius, very high density |
| Black Hole | Black | Bullet vanishes silently (no explosion); very high density |
| White Hole | White | Bullet vanishes silently; **negative mass** — repels instead of attracts |
| Wormhole (paired, purple) | Purple | Bullet teleports to the paired wormhole and exits on the other side |
| Wormhole (cyclic, blue) | Blue | Bullet teleports to the next in a cyclic chain |
| Wormhole (random, green) | Green | Bullet teleports to a random location on the map |
| Wormhole (random-planet, grey) | Grey | Bullet teleports to near a randomly chosen planet |
| Wormhole (self, yellow) | Yellow | Bullet teleports back to near the same wormhole |

### 5.1 Wormhole Exit
When a bullet teleports through a wormhole, it exits the destination wormhole travelling in the same direction it was going when it entered (preserving velocity vector).

### 5.2 Bullet Teleport Limit
A bullet may teleport a maximum of 100 times before it is destroyed (prevents infinite loops).

### 5.3 Space Rifts

A **space rift** is a non-solid map object — a piecewise-linear chain of 3–11 connected segments, each approximately one Medium station diameter long (≤30° turn between segments). Rifts have no solid geometry; bullets, stations, and planets pass through them freely.

**Repulsive force:** Each vertex of the rift exerts a linear-falloff repulsive force on bullets within an influence radius equal to the total rift length. Force: `F = RIFT_REPULSION_STRENGTH × max(0, 1 − d / RIFT_INFLUENCE_RADIUS)`, directed away from the vertex. Forces from all vertices across all rifts are summed each simulation step. Collectables are unaffected. Design intent: slow shots curve away; fast shots punch through.

**Station bounce:** Stations cannot cross rift segments during movement — see §4.5.1.

**Rendering:** Drawn on the static background layer. Outer glow: wide soft-blurred purple-white line (~20–30px, alpha 0.25–0.35). Forked lightning branches: 2–4 branching paths from random rift positions, 3–6 irregular segments with ±40° deflections and at least one fork, alpha 0.2–0.4. Rift line itself: bright white-purple polyline at 2px / alpha 0.95 with an inner luminescent glow pass. Renders above planets, below stations and bullets.

**Generation:** Random start position and direction; each subsequent vertex turns ±0–30° from the previous. System attempts to avoid placing segments over existing planets.

**Wildcard:** 10% chance of injecting one space rift when a wildcard object is rolled (§6.1). Hyperspace scenario (26) includes 2–4 rifts.

**AI:** All AI levels handle rift repulsion automatically — it is applied through the standard per-step force loop alongside gravity; no special-case handling required.

**Named constants:** `RIFT_SEGMENT_LENGTH`, `RIFT_INFLUENCE_RADIUS`, `RIFT_REPULSION_STRENGTH`.

---

## 6. Scenarios

30 named scenarios control how planets are placed and what types appear. A "lucky dip" option picks randomly, weighted towards the more common scenarios:
- **25% chance** — picks from scenarios 1–6 (Planetary through Jovian)
- **63% chance** — picks from scenarios 1–19 (common + uncommon range)
- **12% chance** — picks from the full 1–28 pool

| # | Name | Description |
|---|---|---|
| 1 | Planetary | Rocky planets randomly placed |
| 2 | Asteroids | Many small asteroids (density low, mass low) |
| 3 | Crystal Asteroids | Like Asteroids but all asteroids are Crystal type — bullets pass through; Bounce Cannon reflects off and smashes them |
| 4 | Star System | One central star + rocky planets |
| 5 | Binary Star | Two stars + rocky bodies |
| 6 | Jovian | One large gas giant + smaller moons |
| 7 | Super Giant | One massive star placed off-centre, partially off-screen |
| 8 | Super Giant Binary | Two massive, mostly off-screen stars with the play area between them. See §6.6. |
| 9 | Uneven Binary | One supergiant + one regular star |
| 10 | Red Giant | Large red star + rocky bodies |
| 11 | Star Cluster | Several small dense stars |
| 12 | Gas Giants | Multiple gas giants |
| 13 | Mixture | Mix of stars and asteroids |
| 14 | White Dwarf | One tiny but enormously dense white dwarf + rocky bodies |
| 15 | Comet | A moving comet that reacts to gravity |
| 16 | Asteroid Ring | Ring of asteroids around a gas giant |
| 17 | Asteroid Belt | Dense asteroid belt |
| 18 | Oort Cloud | Orbiting comets around a white dwarf |
| 19 | Wormhole | Primarily wormhole portals (type varies: paired/cyclic/random/self) |
| 20 | Wormholes | All wormhole portals, no regular planets |
| 21 | White Dwarfs | Multiple white dwarfs |
| 22 | Black Hole | One central black hole + rocky bodies |
| 23 | Neutron Star | One pulsar + mix of rocky planets and asteroids |
| 24 | White Hole | One repulsive white hole + rocky bodies |
| 25 | White Holes | 2–5 white holes biased toward screen edges + rocky/asteroid filler. 10% chance of extreme version (§6.4). |
| 26 | Hyperspace | No planets; hyperspace is forced every turn |
| 27 | Black Holes | 2–5 black holes biased toward screen edges + rocky/asteroid filler. 10% chance of extreme version (§6.4). |
| 28 | Big Wormhole | Two enormous wormhole portals, mirrored through the screen centre (partially off-screen) + planets. See §6.7. |
| 29 | Rift | 1 space rift + 0–3 rocky planets + sparse asteroid field |
| 30 | Rifts | 2–6 space rifts + moderate mix of rocky planets and asteroids |
| 31 | Moons | One large rocky planet + 2–5 moons + asteroid filler |
| 32 | Giant Asteroid | One enormous multi-hit asteroid surrounded by smaller asteroids |
| 33 | Pulsars | 2–5 pulsars biased toward screen edges + rocky/asteroid filler. 10% chance of extreme version (§6.4). |
| 34 | Wormhole Tunnel | The interior of a wormhole. A boundary rift forms a rough oval loop around the play area; 2–6 random interior bodies. Special tunnel background. See §6.5. |

### 6.1 Wildcard Features
A configurable wildcard frequency option controls whether a bonus special object is injected into each scenario. When enabled, the injected object is one of: extra wormhole pair, wormhole triple, random-wormhole, white dwarf, black hole, or space rift (10% of wildcard rolls). Frequency options: Off / Very Rare / Rare (default) / Occasional / Common / Always.

### 6.2 Planet Placement Rules
- Planets may not overlap each other (checked on generation with retry)
- At least ~20% of the play area must remain free of planets (validated as ≥80 of 400 sampled grid points)
- Stations are placed after planets and must not overlap planets or be too close to enemy stations

**Layout variability (general requirement):** Placement must not be over-controlled. Constraints exist only to guarantee a playable, readable map — no overlapping bodies, key bodies at least partly visible, and the minimum free play area above. Within those limits, layouts should stay as random as the scenario's concept allows: positions, separation angles and balance vary freely between games, and lopsided, asymmetric or tightly confined arrangements are intended outcomes, not defects. A somewhat restrictive play space is itself a valued source of variety. When fixing a placement bug, prefer rejecting invalid layouts over narrowing the random distribution.

### 6.3 Station Placement Guarantee
Stations **must never be rendered inside a planet**, even on extreme scenarios (e.g. large binary stars that leave almost no free space). The placement algorithm uses a three-tier fallback:

### 6.4 Extreme Scenario Variants
Scenarios 25 (White Holes), 27 (Black Holes), and 33 (Pulsars) each have a 10% chance of generating an **extreme** version. Extreme variants are silently tracked via `gameState.config.isExtreme` and displayed in dev mode stats (§12.3).

**Extreme rules (all three scenarios):**
- Body count: 0–15 (uniform random), chosen independently of `nPlanets`
- No rocky planet or asteroid filler — the map may contain only the special bodies (or even be empty)
- Placement uses the same edge-preference and 50% middle-slot logic as the normal version (§6.4.1)

**§6.4.1 Edge-preference placement** (shared by normal and extreme versions of scenarios 25, 27, 33):
- Each body independently picks one of the 4 screen sides (left / right / top / bottom) with equal probability
- The body is placed 5–20% from the chosen edge; the perpendicular axis roams freely at 15–85%
- 50% of games: one randomly chosen body is instead placed near the centre (30–70% on each axis)

### 6.5 Wormhole Tunnel Scenario (id 34)

**Concept:** The play area is the interior of a living wormhole. A jagged glowing boundary rift surrounds all interior bodies; outside is black void.

**Boundary rift:** A single `SpaceRift` with `isBoundary: true`, `strengthMultiplier: 2`, and a fixed `influenceRadius: 40`. Its 44–60 vertices are distributed around an ellipse centred on the play area (semi-axes ≈ 43% of each dimension), each displaced radially ±10% at random plus 2–4 shared group displacements of ±6% to break up machine regularity. The last vertex is identical to the first, closing the loop exactly. The boundary rift participates in the normal rift bounce mechanic (§4.5.1). Stations are ejected to just inside the boundary at placement time (15 + station.radius inward from nearest segment); at runtime, any station detected outside the closed polygon is hard-teleported to the same point.

**Out-of-bounds bullets:** Bullets whose position falls outside the boundary polygon are killed immediately (status → DEAD).

**Interior bodies (2–6):** Randomly selected from: rocky planet, asteroid, gas giant, wormhole pair, wormhole triple, white hole, moon, star. Placed with standard no-overlap validation. The scenario also has a 40% chance of spawning one additional interior space rift.

**Background:** Replaces the star field. Drawn once to the background canvas. The area outside the boundary rift polygon is solid black. Inside: 32 concentric ellipses in alternating dark blues (hsl ≈ 225–260°) and purples (hsl ≈ 268–284°), lightness 5–14%, drawn using `lighter` compositing. A t² perspective curve makes inner rings very small and densely packed near the vanishing point (slightly off canvas centre), giving deep tunnel depth. Ring centres drift from the vanishing point outward toward the canvas centre as rings enlarge. Each ring is rotated ~3° more than the previous (96° total spiral twist across 32 rings). A soft radial glow at the vanishing point simulates the far end of the tunnel. The clip region is set to the boundary rift polygon before drawing, so the rings are masked to the interior automatically.

1. **Normal** — retry up to 4000 times enforcing both station-station spacing AND planet avoidance. Spacing threshold decreases on each failure.
2. **Emergency** — if normal fails, drop station-station spacing requirements but continue checking planet avoidance (up to 2000 more attempts).
3. **Last resort** — if emergency also fails (can happen when stars cover >95% of play area), push any station that landed inside a planet outward to the planet's surface + a small buffer. Stations may be close together but will never be inside a planet.

### 6.6 Super Giant Binary Scenario (id 8)

**Concept:** The battle takes place between two supergiant stars whose gravity partially balances across the play area. The star size is essential to the scenario and must not be reduced: each radius is 1.5–1.9× screen height (fixed supergiant mass).

**Hard constraints (enforced by rejection sampling at generation):**
- **No overlap, anywhere:** the two star discs must never overlap, on or off screen. Note the generic overlap validator (§6.2) exempts planet pairs whose centres are both off-screen, so this scenario enforces the rule itself.
- **Both stars partly visible:** each disc must reach onto the screen by at least ~6% of screen height, so players can see a bit of both stars and read the gravitational environment.
- **Minimum play area:** the standard free-play-area floor (§6.2) applies to the combined coverage of both discs. A tight play space is acceptable — and desirable for variety — but it must never shrink below the floor.

**Everything else is deliberately unconstrained (see §6.2 layout variability):** the stars may sit off-screen in any direction — the separation axis may be horizontal, vertical, diagonal, at any angle. Both stars may crowd two adjacent corners or edges, producing a strong directional gravity field across the play area; or they may face each other across the screen with gravity largely cancelling in the middle. Star centres may sit anywhere their disc still peeks on-screen — placement must not be limited to a fixed box smaller than this (a fixed sampling box shorter than the sum of two star radii silently made vertical separations impossible).

**Fallback:** On extreme aspect ratios where free sampling cannot separate two discs this large, the giants are placed constructively on opposite sides of the screen centre along a random axis, each just reaching on-screen, preserving the constraints above.

### 6.7 Big Wormhole Scenario (id 28)

**Concept:** Two enormous paired wormhole portals (capture ring radius 480) reach onto the screen from opposite sides, with rocky planets and asteroids in between.

**Hard constraints:**
- **Point symmetry is required:** the two portals must be exact mirrors of each other through the screen centre, so that a bullet shot into the visible arc of one ring exits the other ring on-screen. Placement freedom applies only to the first portal; the partner is always its mirror.
- **Equal gravity:** both portals have the same mass (2400 each); the gravitational field must be as symmetric as the geometry.
- **No ring overlap:** the two capture rings must never overlap (equivalently, the first centre must sit at least one ring radius from the screen centre). Overlapping paired rings can re-capture an exiting bullet and burn its teleport budget.
- **Both rings partly visible** (≥ ~6% of screen height of ring depth on-screen) and the standard free-play-area floor (§6.2) applies to the combined ring coverage.

**Within those limits, orientation and separation are deliberately free (§6.2):** the portal axis may lie at any angle, and the ring separation varies continuously from nearly touching (a narrow corridor between the rings) to far apart in opposite corners. Placement must not be quantized to fixed corner/edge modes. A corner placement is used as a constructive fallback if sampling fails.

---

## 7. AI Players

Five AI difficulty levels, each a named bot:

| Level | Name | Hit Rate | Behaviour |
|---|---|---|---|
| 1 | Randbot | ~1% | Fires at a completely random angle and power; occasionally hyperspaces |
| 2 | Aimbot | ~3% | Aims roughly at the nearest enemy; accuracy degrades with more planet mass; occasionally hyperspaces |
| 3 | Cleverbot | ~12% | Simulates trajectories to find a good angle/power; refines from previous best shots |
| 4 | Superbot | ~30% | More simulation iterations; prefers close targets; uses hyperspace strategically; aims through wormholes |
| 5 | Megabot | ~50% | Maximum simulation depth (~2 shots/kill average); considers leaderboard when targeting; coordinates with teammates to spread fire |

### 7.1 AI Simulation
Cleverbot and above run a fast internal simulation of the bullet path (using larger timesteps) to estimate closest approach to a target. They iteratively refine angle and power, seeding each attempt from the previous best result. Accuracy improves with more turns played (the AI learns from its own shots).

### 7.2 Target Selection
- Megabot prefers targeting the highest-scoring team (strategy kills) and deprioritises the already-losing team
- Megabot teammates try not to target the same enemy (spread fire across multiple enemies)

---

## 8. Scoring & Awards

### 8.1 Per-game Scoring
- Kill an enemy station: **+1** point for your team
- Kill a teammate (own goal): **−1** point for your team
- Suicide (your bullet hits your own station): **−1** point

### 8.2 Kill Types Tracked (for awards and stats)
| Kill Type | Condition |
|---|---|
| Strategy kill | Target was the highest-scoring team |
| Oppression kill | Target was the lowest-scoring team |
| Tactical kill | Target was the station-count leader |
| Bully kill | Target was the station-count loser |
| Long shot | Distance to target > 60% of map width |
| Close shot | Distance to target < 20% of map width |
| Vengeance kill | Target was the last station that killed you |

### 8.3 Tournament Awards
Every 5 games, 4 awards are selected from the following pool and shown on the awards screen. Selection is weighted to favour awards not recently shown, and only awards where at least one team has a non-zero stat are eligible.

| Award | Stat |
|---|---|
| Bloodlust | Most kills |
| Strategy | Most strategy kills |
| Oppression | Most oppression kills |
| Tactics | Most tactics kills |
| Bully | Most bully kills |
| Vengeance | Most vengeance kills |
| Longshot | Most long-range kills |
| Point Blank | Most close-range kills |
| Wormhole | Most wormhole kills |
| Trick Shot | Most trick-shot kills |
| Near Miss | Most near misses |
| Hyperactive | Most hyperspace jumps |
| Self Destruct | Most suicides |
| Not Friendly | Most own goals |

When **Award Prizes** is enabled (see §10 Page 6), each award winner receives weapons added to their team stock immediately:

| Prize tier | Weapons awarded per award |
|---|---|
| None | No weapons |
| Minor | 1× random Tier 1 weapon |
| Mid | 2× random Tier 1 weapons |
| Major | 1× random Tier 2 weapon |
| Mammoth | 2× random Tier 2 weapons |

Each weapon is selected independently at random from the eligible tier using uniform weighting (all weapons in that tier equally likely). The 2× prizes need not be distinct — a team may receive two of the same weapon type.

If two or more teams tie for an award, each tied team receives the full prize.

The awards screen lists each weapon received beneath the award winner's name. Weapons are added to team stock using the same stock system as collectables and carry over into subsequent games.

---

## 9. Game Modes

### 9.1 Single Game
Play one match. The team with surviving stations wins.

### 9.2 Tournament
Play a series of games on a fixed configuration. A cumulative leaderboard tracks wins, kills, suicides, own goals, shots fired, and survival. Scenarios may randomise between games. Awards are shown every 5 games.

When **Number of Games** is set to a specific number (see §10 Page 6), the tournament ends automatically after that many games. The final results screen shows standings marked ★ FINAL and an End Tournament button that returns to the menu. The default "Keep Going" setting runs indefinitely.

When **Turn Limit** is set (see §10 Page 6), each game ends automatically when that many turns have been completed and no winner has been found by normal elimination. The team with the most surviving stations at that point wins; if two or more teams are tied, the result is a draw. The HUD shows a countdown in orange from 5 turns remaining, switching to red at 2 turns remaining, and showing "LAST TURN" on the final turn. In tournament mode a turn-limit win scores as a normal win.

When a human player opens the config panel during a game, a **Resign** button is shown. The first click prompts "CONFIRM RESIGN?" and a second click confirms. Resigning immediately destroys all of the current active team's stations with normal explosion VFX. If this leaves only one team alive, that team wins immediately. In tournament mode, a resigned team scores as a loss with 0 surviving stations.

**Winner Prize** and **Handicap Prize** (see §10 Page 6) fire independently after every game. Winner Prize goes to the game winner; Handicap Prize goes to the last-place team in the current tournament standings. Both are configured separately but use the same tiers:

| Tier | Weapons awarded |
|---|---|
| None | — |
| Minor | 1× random Tier 1 weapon (uniform weighting within tier) |
| Mid | 1× weapon drawn using 80/16/4% tier weighting |
| Mammoth | 2× weapons drawn using 80/16/4% tier weighting |

Weapons are applied to the recipient team's stock immediately and carry into the next game. The results screen shows a labelled section for each active prize (⬡ WINNER PRIZE, ⬡ HANDICAP PRIZE). Both can be active simultaneously; if Winner and Handicap go to the same team (e.g. winner is also last place in a 2-team game), they both still fire and are shown as separate sections.

When **Claim Collectables** is enabled (see §10 Page 6), all collectables still on the map at game end are converted into random weapons and distributed to surviving teams. Surviving teams are those with at least one alive station; the winning team is included. Distribution uses a random rotation: surviving teams are shuffled, then each collectable is assigned to the next team in the rotation, cycling if the number of collectables exceeds the number of surviving teams. Each collectable generates one weapon using the standard 80/16/4% tier weighting. The weapons carry over into the next game. If no collectables remain or no teams survived, nothing is distributed.

---

## 10. Configuration Options

The config panel always uses a compact 4-page paged layout. Page 1 is always visible; pages 2–4 are accessed via navigation dots.

### Page 1 — Setup
| Option | Values |
|---|---|
| Number of players (teams) | 2–12 |
| Human / CPU split | 0 human up to all human |
| Stations per player | 1–8 |
| CPU difficulty | Randbot / Aimbot / Cleverbot / Superbot / Megabot |

### Page 2 — World
| Option | Values |
|---|---|
| Station size | Micro / Tiny / Small / Medium / Large / Giant / Mammoth |
| Number of planets | Random / 3–50 (ignored when Override Seed is set) |
| Scenario | 1–30 / Lucky Dip (greyed out when Override Seed is set) |
| Game mode | Single game / Tournament |
| Game speed | ¼× / ½× / 1× (default) / 2× / 4× |
| Movement speed | Off (default) / Glacial / Slow / Normal / Fast / Rocket |
| Current Map Seed | Read-only display of the seed used in the last game. Selectable for copying. |
| Override Seed | Editable text (up to 32 chars). Blank = random map. Non-blank = use this seed deterministically. See §10.5. |

### Page 3 — Options
| Option | Values | Notes |
|---|---|---|
| Performance | Full / Simplified / Experimental | Simplified caps planets at 20 and players at 4; Experimental enables the SVG sprite renderer for ships (UFO saucer) and bitmap smoke, targeting 60fps with up to 96 ships on iPad — see §12.3 |
| Team clustering | Off / Tight / Moderate / Loose | Controls how close same-team stations are placed |
| Wildcard planets | Off / Very Rare / Rare (default) / Occasional / Common / Always | See §6.1 |
| Aim circle size | 0.5× / 1× (default) / 2× / 3× | Visual size of the aiming circle around the active station |
| Bullet paths | Off (default) / Minor / Major / Extreme / Cheating | Simulated path preview for current aim — see §11.11 |
| Minimal UI | Off / On | Reduces HUD text size for smaller screens |

### Page 6 — Tournament
Only accessible when Mode = Tournament.

| Option | Values | Notes |
|---|---|---|
| No. of Games | Keep Going (default) / 5 / 10 / 15 / 20 / 30 / 50 | Tournament ends automatically after the set number of games; final results screen shows ★ FINAL |
| Turn Limit | Off (default) / 5 / 10 / 15 / 20 / 30 / 50 | Maximum turns per game; see §9.2 |
| Winner Prize | None (default) / Minor / Mid / Mammoth | Weapon(s) awarded to game winner after each game; see §9.2 |
| Handicap Prize | None (default) / Minor / Mid / Mammoth | Weapon(s) awarded to last-place team after each game; see §9.2 |
| Award Prizes | None (default) / Minor / Mid / Major / Mammoth | Weapons awarded to each award winner at the 5-game ceremony; see §8.3 |
| Claim Collectables | Off (default) / On | Surviving teams receive weapons from remaining map collectables at game end; see §9.2 |

### Page 4 — Collectables
All sub-options are greyed out and unclickable when Collectables is Off.

| Option | Values | Notes |
|---|---|---|
| Collectables | Off (default) / Rare / Normal / Common / Continuous | Spawn probability per turn end; see §4.6 |
| Rich Asteroids | Off / Rare (1%) / Normal (5%) / Common (10%) / Abundant (25%) / Overwhelming (100%) | Only active when Collectables ≠ Off |
| Collectable Size | Tiny (½×) / Medium / Large (1.5×) / Huge (2×) / Mammoth (3×) / Varied | Varied picks a random size each spawn |
| Starting Weapons | None / One at Random / Minor (2 Triple Cannons) / One of Each / Lots (3 of each) / Too Many (7 of each) | Topped up to minimum each game; One at Random always adds one |

### 10.5 Map Seeds

The **Override Seed** field (Page 2) allows players to enter a text string to deterministically reproduce a planet layout. The **Current Map Seed** field (read-only) always shows the seed that was actually used when the last game started — useful for copying and sharing.

**Behaviour:**
- Override Seed blank → random map each game; Current Map Seed updates after each start.
- Override Seed non-blank → same planet layout every time regardless of other settings; Scenario and Number of Planets options are greyed out.
- Clearing Override Seed restores Scenario and Planets options to their previous values.

**Normalisation:** Seeds are trimmed and lowercased before use. `"BANANA"`, `"banana"`, and `" Banana "` are identical.

**Hashing:** The normalised string is hashed to a 32-bit unsigned integer via a deterministic character-by-character hash (consistent across all platforms and browsers). This seeds a dedicated mulberry32 PRNG instance separate from the main game RNG.

**What the seed controls:**

| Property | Seed-driven |
|---|---|
| Planet count | Yes (drawn from normal 3–50 range) |
| Planet type, position, size | Yes, per planet |
| Wormhole pairings | Yes |
| Asteroid shape, rotation speed | Yes, per asteroid |
| Station placement | No (main RNG) |
| Collectable spawning | No (main RNG) |
| AI behaviour | No (main RNG) |

**Reproducibility:** A given seed produces an identical planet layout regardless of player count, station size, game mode, game speed, or browser.

**In-game display:** When a seed is active, the normalised seed string is shown as the map name wherever the scenario name would normally appear (config summary, HUD, results screen).

---

## 11. UI — Modern Redesign

The original Java applet used AWT buttons crammed into a top and bottom toolbar. The HTML5 version redesigns this as:

### 11.1 Layout (original reference — screenshots)
The original game draws everything on-canvas with a Java AWT toolbar above and below:
- **Top toolbar** (6 buttons): Start Game / Players / Human·CPU ratio / Stations per player / CPU level / More Options
- **Game canvas** (centre): full play area, no chrome
- **Bottom toolbar**: Angle slider | End Turn button | Hyperspace button | Power slider
- Angle and Power values are also rendered as large white text directly onto the canvas at bottom-left and bottom-right ("Angle:20" / "Power:68.2")
- Active player name rendered as large green spaced-out text at the top of the canvas ("Team 1   Station 1")

### 11.2 New Layout (HTML5 redesign)
- **Full-screen canvas** — no external chrome during play
- **Collapsible config panel** — shown before game start, slides away or minimises during play
- **In-canvas HUD** (keep from original): current team/station name drawn top-centre; Angle bottom-left; Power bottom-right — large, readable white/team-colour text drawn directly on the canvas, not in DOM panels
- **In-canvas control buttons** (redesigned from bottom toolbar): End Turn and **weapon selector** (replaces Hyperspace button) rendered as minimal floating DOM buttons at the bottom edge
- **Floating score panel** — compact, expandable leaderboard

### 11.3 In-Game Aiming Visualisation

The **aim indicator** consists of an aim circle and one or more aim lines:

- **Aim circle** — white circle around the active station, radius scaled by the Aim Circle Size config option. Functions as the interactive drag zone.
- **Aim lines** — solid white line(s) from station centre to the aim circle edge, showing firing direction. Length is proportional to power (fixed at max for weapons with no power control).
- For **multi-bullet weapons**, one aim line is drawn per bullet angle. The centre line is brighter (alpha 0.95, 2px); flanking lines are dimmer (alpha 0.45, 1px).

| Weapon | Aim lines | Angles | Notes |
|---|---|---|---|
| Cannon | 1 | 0° | |
| Triple Cannon | 3 | −5°, 0°, +5° | Exact fire angles |
| Blaster | 5 | −10°, −5°, 0°, +5°, +10° | Exact fire angles |
| Blunderbuss | 5 | −15°, −7.5°, 0°, +7.5°, +15° | Representative — actual angles random at fire time |
| Minigun | 3 | −2°, 0°, +2° | Representative — actual angles random at fire time |
| Laser | 1 | 0° | Always full length (no power control) |
| Rocket | 1 | 0° | |
| Shotgun | 6 | Barrel 1: −8°, 0°, +8°; Barrel 2: −8°, 0°, +8° | Barrel 2 lines at reduced opacity (centre 0.60 / flanking 0.28) |
| Rocket Pod | 3 | −1°, 0°, +1° | Representative |
| Force Shield | 0 | — | No directional shot |
| Hyperspace | 0 | — | No shot |

For **representative** weapons (Blunderbuss, Minigun, Rocket Pod), the actual fire angles are random — the aim lines communicate spread range rather than exact angles. For **exact** weapons (Triple Cannon, Blaster), aim lines match the actual fire angles precisely.

A faint **ghost aim line** (dashed, low opacity) also shows the angle and power used on the previous turn.

### 11.10 Ghost Trail

During a station's aiming phase, dashed lines in the station's team colour are drawn showing the path(s) every bullet/beam/rocket took on that station's previous turn. Allows the player to see exactly where their shot went and adjust accordingly.

- Shown only during human aiming phases; hidden during AI turns and the firing phase.
- Style: dashed `[5, 5]` (this dash pattern is reserved for ghost trails — not used elsewhere), team colour, alpha 0.55.
- Wormhole jumps: a gap appears at the entry point; path continues from exit point.
- Laser: the full simulated beam path is shown.
- Rocket: the full flight path including thrust arc is shown.

All trails from the previous turn are shown — one per bullet/rocket fired:

| Weapon | Trails shown |
|---|---|
| Cannon | 1 |
| Triple Cannon | 3 |
| Blaster | 5 |
| Blunderbuss | 11 |
| Minigun | 13 |
| Shotgun | 12 (6 per barrel) |
| Rocket Pod | 8 |
| Rocket | 1 |
| Laser | 1 |

### 11.11 Bullet Path Preview

An optional player aid that shows simulated gravity-curved path(s) for the current aim, rendered as solid fading lines (bright near the station, fading to transparent at the cutoff length). Off by default.

Controlled by the **Bullet Paths** config option:

| Label | Max path length |
|---|---|
| Off | No preview |
| Minor | ⅛ screen width |
| Major | ¼ screen width |
| Extreme | ½ screen width |
| Cheating | Full screen width |

"Screen width" = 700 game units. Alpha at any point = `startAlpha × (1 − distanceTravelled / maxLength)`.

Per-weapon preview paths:

| Weapon | Paths | Angles | Start alpha (centre / flanking) |
|---|---|---|---|
| Cannon | 1 | 0° | 0.7 / — |
| Triple Cannon | 3 | −5°, 0°, +5° | 0.7 / 0.35 |
| Blaster | 5 | −10°, −5°, 0°, +5°, +10° | 0.7 / 0.35 |
| Blunderbuss | 3 | −15°, 0°, +15° | 0.7 / 0.25 |
| Minigun | 3 | −2°, 0°, +2° | 0.7 / 0.25 |
| Shotgun | 6 | Barrel 1 −8°/0°/+8°; Barrel 2 −8°/0°/+8° | 0.7 / 0.25 (Barrel 2 half-alpha) |
| Rocket Pod | 3 | −1°, 0°, +1° | 0.7 / 0.25 |
| Rocket | 0 | — | Self-propelled; path not predictable |
| Laser | 0 | — | See below |
| Force Shield | 0 | — | No shot |

Fixed-speed weapons use their actual launch speed in the simulation (not `station.power`): Blaster uses MAX_V × 0.55, Blunderbuss uses MAX_V × 0.275, Minigun uses MAX_V × 1.5.

Laser uses a dedicated preview (team-coloured fading path) simulated at very high speed under reduced gravity, matching laser physics. Rocket shows the thrust-then-coast arc. Both are drawn behind aim lines.

The preview uses coarse stepping (same as the AI simulator) so paths may diverge from actual trajectories near massive bodies. Wormhole teleportation, rift repulsion forces, and Hyperspace-scenario boundaries are not modelled in the preview — this is intentional: the feature is an aid, not a guarantee.

### 11.12 Bullet Path Assistance Disclosure

When a game or mission is completed with Bullet Paths active, the results screen notes the assistance level used — making it visible at the point of completion.

- **Target practice results screen:** shown between the stats table and the action buttons.
- **Story mode debrief screen:** shown below the score/best lines, above the action buttons.
- Style: small italic text, muted amber (`rgba(255,200,80,0.6)`), format: `Assistance level... [Label]` (e.g. "Assistance level... Minor").
- Hidden entirely when Bullet Paths is Off.

### 11.13 Story Mode Score Integrity

High scores in story mode are only recorded for runs completed without assistance. Assisted completions are tracked separately.

| Run type | Rule |
|---|---|
| Clean run (Bullet Paths Off) | Score recorded normally. Any prior assisted-only record for that mission is cleared. |
| Assisted run, no prior clean score | Recorded if equal to or better (less assistance) than any stored assisted level. |
| Assisted run, clean score exists | Ignored — the clean score is not overwritten. |
| Assisted run, worse level than stored | Ignored — only the least-assistive level is kept. |

Assistance ranking (best → worst): Minor → Major → Extreme → Cheating.

**Mission select card display:**

| State | Colour | Text |
|---|---|---|
| Clean score | Green | `✓ [score]` |
| Assisted-only completion | Amber | `✓ (Minor/Major/Extreme/Cheating assistance)` |
| Not completed | Dim | `Not completed` |

Clean score always takes priority if both exist. Stored in `localStorage` under `dsb_story`: existing `scores` map holds clean scores only; a separate `assistedLevel` map holds the best assisted level per mission (only present when no clean score exists).

### 11.14 SVG Planet Overlays

SVG graphics can be layered over planet/celestial body circles to enrich their appearance beyond flat shaded circles. SVGs are selected randomly from a pool, drawn at a random rotation, and coloured using a randomised HSL range. Multiple layers can be stacked on a single body.

**Configuration** lives in `src/rendering/planetOverlays.js` — a single artist-editable file with no renderer code changes required. Each planet type key maps to an array of layer definitions:

| Field | Type | Description |
|---|---|---|
| `svgs` | `string[]` | Pool of SVG paths; one chosen at random per planet instance |
| `count` | `number` | How many times to apply this layer (each application picks independently) |
| `scale` | `number` | SVG size as a multiple of planet diameter (1.0 = fills the circle exactly) |
| `alpha` | `number` | Opacity 0–1 for the entire overlay |
| `colour.h/s/l` | `[min, max]` | HSL randomisation ranges; each planet gets one colour picked once at scene creation |
| `rotation` | `'random'` / `'none'` / `number` | Canvas rotation before drawing (`'random'` = uniform 0–360°) |
| `strokeVisible` | `boolean` | If false, SVG stroke styling is stripped before rendering |

**Rendering:** Overlays are part of Layer 0 (background) — drawn once at game start, not per frame. Planet base shading is drawn first; overlays go on top. Each overlay is clipped to the planet's circle. Colour is applied by replacing all fill values in the SVG source. Per-planet colour and rotation are seeded by the game RNG (same seed = same look). SVGs are fetched and processed once at game start and cached; no per-frame cost. Overlays are skipped in Simplified performance mode.

**SVG authoring requirements:** single primary fill colour (all fills replaced with one randomised colour); transparent background (no background rect); square `viewBox`; fills covering the full viewBox area.

**Planet type keys:** `moon`, `rocky`, `gasGiant`, `star`, `blackHole`, `whiteHole`, `asteroid`, `crystal`, `whiteDwarf`. Only types with entries in `PLANET_OVERLAYS` receive overlays.

**Out of scope:** animated overlays; overlays for stations or bullets; per-layer blend modes; SVGs with multiple distinct fill colours.

### 11.4 Station Visual Design
- **Full / Simplified modes**: stations are small circular icons (~15–25px diameter) resembling a **Death Star** — a coloured sphere with a visible equatorial band/trench detail. Each station is solid in its team colour. No label on the station itself; team identity comes from colour + the canvas header text.
- **Experimental mode**: stations are drawn from the **SVG sprite system** — a flying saucer (UFO) shape with a silver hull disc, team-coloured engine glow and rim trim, and a pale dome. Ship art is authored in SVG, converted to a pre-parsed JS module at build time, and rendered via pre-baked per-team animation sheets (`drawImage`). Targets 60fps at 96 ships on iPad. See `spec/space-mammoth-sprite-spec.md` for the full specification.

### 11.5 Planet & Star Visual Style (from screenshots)
- **Stars** (yellow/red/giant): bright coloured core circle surrounded by a **fuzzy corona** — a halo of short radiating strokes or dots in a darker shade of the star colour, giving a bristly/spiky appearance. This is the most distinctive visual in the game — preserve it.
- **Rocky planets / asteroids**: smaller, brownish or dark-orange circles with simple shading (lighter on one side)
- **Black holes**: invisible or near-invisible (confirmed by original hints — players must infer from the gap in the map)
- **Wormholes**: distinctive colour-coded circles (purple/blue/green/grey/yellow) with pulsing or swirling render effect
- **White holes**: bright white glowing core with a large radial halo (15× body radius). Animated outward-drifting particles: 160 white soft blobs spawned at the body surface, accelerating outward (`accelFrac = 12 × visualRadius / s²`), fading out at the halo edge. Skipped in simplified mode. Communicates the constant repulsive force visually.
- **White dwarfs**: identical visual treatment to white holes (same glowing core + large halo). Distinguished by physics — white dwarfs have strong positive gravity; white holes repel.
- **Pulsars**: glowing white core. Emits periodic expanding pressure rings (outward-travelling concentric circles, fading as they expand). Per-pulsar random ring radius 90–150 game units; per-pulsar random period 0.4–4 s.

### 11.6 Bullet Trails (from screenshots)
- Smooth curved polyline in the firing station's team colour
- Trails from all shots in the current round remain visible until next turn
- No fading within the same turn — the full path is visible after firing

### 11.7 Visual Style
- Star field: many small dots in reds, purples, blues, varying sizes — scattered randomly across the background, not moving
- Fonts: modern sans-serif for UI panels; for in-canvas text (Angle/Power/Team name) use a bold, slightly retro-feeling font — the original used large Courier/Serif; something like `monospace` or a Google Font like `Orbitron` fits the aesthetic
- Colour palette: dark space background (#000 or near-black), vivid team colours, warm star yellows and reds

### 11.8 Config Panel — Responsive Layout Constraint

The config panel automatically switches to a compact 3-page paged layout on small viewports (phones, tablets in landscape). **Adding a new config option must not cause the compact paged layout to overflow its viewport.**

Rules for new options:
- Assign the new row to whichever of the three pages (SETUP / WORLD / OPTIONS) has the most headroom. Current row counts: SETUP 4, WORLD 6, OPTIONS 6.
- If all three pages are full (i.e. adding to any page would overflow a ~375 px viewport), add a fourth page rather than growing an existing one.
- Never rely on the panel's `overflow-y: auto` safety net as the primary solution — it is a last resort for extreme edge cases only.
- The compact row budget is approximately **6–7 rows per page** at current font/spacing settings. Verify fit by checking `panel.scrollHeight ≤ window.innerHeight × 0.92` on a 375 × 667 viewport (iPhone SE) before shipping.

### 11.9 Keyboard Shortcuts
| Key | Action |
|---|---|
| Z / X | Angle ±1° |
| A / S | Angle ±5° |
| K / M | Power ±1 |
| J / N | Power ±10 |
| H | Cycle weapons (Cannon → Triple Cannon if stocked → Hyperspace → Cannon); opens weapon selector popup if more than 2 options available |
| Enter | End turn / advance |
| P | Pause |
| O | Slow-motion step-through (hold while paused) |

---

## 12. Technical Requirements

### 12.1 Platform
- Single HTML file + assets (or minimal asset bundle) — no server required
- Runs in any modern browser (Chrome, Firefox, Safari, Edge)
- Responsive: playable at any screen size from 800×600 upwards; canvas scales

### 12.2 Code Architecture
- **Object-oriented JavaScript** — no parallel arrays. Entities are class instances:
  - `Planet` — position, radius, mass, density, type, colour, shading
  - `Station` — position, team, status, angle, power, stats, AI level
  - `Bullet` — position, velocity, status, trail, owner
  - `Team` — members, colour, score, stats
  - `Scenario` — factory method returning a configured planet layout
  - `AIPlayer` — strategy method on each difficulty subclass
  - `GameState` — turn management, mode, winner detection
  - `Renderer` — all canvas drawing logic isolated from game logic
  - `PhysicsEngine` — gravity simulation, collision detection
  - `UI` — panel rendering, input handling

### 12.3 Rendering
- HTML5 Canvas 2D API
- **Three-layer compositing** (matching the original's triple-buffer approach):
  - **Layer 0 — background**: star field + planets. Redrawn only on new game.
  - **Layer 1 — trails**: bullet path polylines accumulated during the fire phase. Cleared at start of each new turn. Drawn on top of Layer 0.
  - **Layer 2 — live**: stations, active bullets, explosions, aiming indicator, HUD text. Redrawn every frame during simulation.
  - Final frame = Layer 0 + Layer 1 + Layer 2 composited to the visible canvas.
- Trails must persist across explosion animations — the three-layer approach achieves this cleanly.
- Target: 30fps during simulation, idle when waiting for input

### 12.3 Dev Mode Stats Overlay
Toggled via a keyboard shortcut (dev builds only). Displayed as a fixed top-left overlay, monospace font, semi-transparent background. Shows:

| Field | Content |
|---|---|
| FPS | Smoothed framerate (10% EMA) |
| Scenario | Human-readable scenario name from `SCENARIO_NAMES[scenarioId]`; appends `EXTREME` if `gameState.config.isExtreme` is true |
| Celestial | Planet count |
| Ships | Total station count across all teams |
| Bullets | Active bullets + rockets |
| SFX | Sum of all particle/effect counts (smoke, explosions, wormhole particles, etc.) |

### 12.4 No Dependencies (initially)
- Pure vanilla JS — no frameworks, no build step
- May add a single lightweight bundler (e.g. esbuild) later if module organisation requires it

---

## 13. Story Mode

### 13.1 Overview

Story Mode is a curated sequence of single-human-player missions with fixed layouts, defined objectives, and narrative framing. Missions progress from a simple introductory exercise to challenges that require mastery of specific mechanics — hyperspace, collectables, multi-station coordination. Completing a mission with a passing score unlocks the next; all completed missions remain replayable for score improvement.

Story Mode is entirely separate from the standard game loop. No config panel is shown; all game parameters are fixed by the mission definition.

**Narrative tone:** All story text uses a military boot camp voice — gruff, direct, drill sergeant addressing a raw recruit. Avoid all references to specific IP (no proprietary character or faction names). Reference enemies by their team colour: "those cyans", "the reds", "those yellows." Objectives are orders, not suggestions. Keep briefing text to 2–4 sentences.

**Colour substitution:** Story text strings use template placeholders `{enemy1}`, `{enemy2}`, etc. which are replaced at render time with the actual colour name of the enemy team at that index (e.g. `{enemy1}` → "cyan" for team 1). Colour names match the fixed team colour list (green, cyan, yellow, red, purple, blue, orange, grey…). This ensures the text is always accurate regardless of team assignment.

---

### 13.2 Mission Select Screen

- **Entry point:** Story Mode is selected via the **Mode** option in the config panel (alongside Single Game and Tournament), not a separate button. The Story Mode screen replaces the config panel when this mode is active.
- Displays all missions in a vertical list or card grid, in order
- Each card shows: mission number, title, lock/unlock state, best score (if previously completed)
- Locked missions are visible but greyed out with a padlock icon
- Mission 1 is always unlocked; subsequent missions unlock by completing the preceding mission with objectives met
- Selecting an unlocked mission shows the Mission Briefing overlay, then starts the game

---

### 13.3 Mission Briefing & Debrief

**Briefing** (shown before play begins):
- Mission number and title
- Narrative flavour text (2–4 sentences, in-world voice)
- Objectives listed clearly ("Destroy all 3 targets", "Collect at least 5 collectables")
- Active fail conditions listed ("Fail if not complete within 15 turns")
- **Start Mission** button

**Debrief** (shown after the game ends, win or lose):
- Outcome banner: MISSION COMPLETE or MISSION FAILED
- Score breakdown in mission-specific metrics
- Final numeric score
- Best score badge if the player beat their previous record
- Two buttons: **Retry Mission** | **Next Mission** (greyed out on fail if next mission is still locked)

---

### 13.4 In-Game Objective Panel

A compact overlay panel, top-right corner of the canvas, lists the mission's active objectives. Each objective has a checkmark that fills when the condition is met. The panel also shows the current turn count and, if a turn limit is active, a countdown ("Turn 7 of 15"). Objectives are evaluated at the end of each resolution phase.

All objectives must be met (and no fail condition triggered) for the mission to count as MISSION COMPLETE.

---

### 13.5 Mission Data Schema

All missions are declared as entries in a `STORY_MISSIONS` constant array. This is the data-driven layout system — every aspect of a mission is specified in its definition object rather than in procedural game setup code. The game engine reads the mission object and configures itself accordingly; no mission-specific branching logic exists in the engine.

```js
{
  id: string,            // unique slug, e.g. "m1-training"
  title: string,         // display title, e.g. "Basic Training"
  story: string,         // narrative briefing text shown before play

  layout: {
    planets: [
      {
        type: PlanetType,   // any type from §5 (e.g. "asteroid", "star", "crystalAsteroid")
        x: float,           // normalised canvas position 0–1
        y: float,
        radius: float,      // game units
        density: float,     // mass = radius² × density
      }
    ],
    stations: [
      {
        x: float,
        y: float,
        team: number,           // 0 = human team; 1+ = separate enemy teams
        role: "human" | "target" | "ai",
        aiLevel: number,        // 1–5 matching §7; only for role "ai"
        visualStyle: "station" | "drone",  // visual variant; default "station"
      }
    ],
    collectables: [         // optional: explicit collectable positions spawned at game start
      { x: float, y: float }
    ],
  },

  settings: {
    stationSize: StationSize,         // size tier from §4.1
    gameSpeed: number,                // speed multiplier from §10
    startingWeapons: object,          // weapon type → initial charge count for human team
    enemyStartingWeapons: object,     // weapon type → initial charge count for all AI teams
    collectablesSpawn: string,        // "off" | "fixed" | "normal"; "fixed" uses layout.collectables
    collectableWeapon: string | null, // if set, all collectables always grant this weapon; null = random (default)
    movementSpeed: string,            // from §4.5
    cannonEnabled: boolean,           // default true; false removes cannon from the weapon list entirely
  },

  objectives: [
    {
      type: ObjectiveType,      // see §13.6
      params: object,
    }
  ],

  failConditions: [
    {
      type: "max_turns",
      turns: number,
    }
  ],

  events: [                     // optional: turn-triggered game events
    {
      turn: number,             // 1-indexed turn number when this fires
      spawnStations: [          // stations materialised on the map at this turn
        {
          x: float | null,      // null = random valid position (uses hyperspace animation)
          y: float | null,
          team: number,
          role: "ai",
          aiLevel: number,
          visualStyle: "station" | "drone",
          startingWeapons: object,
        }
      ],
      dialog: string,           // optional popup message shown to the player when event fires
      addObjectives: [          // optional objectives appended to the active list mid-game
        { type: ObjectiveType, params: object }
      ],
    }
  ],

  scoring: {
    formula: ScoringFormula,   // see §13.7
    passingScore: number,      // minimum score to count as a pass and unlock the next mission
  },
}
```

#### `role: "target"` — Station Role for Story Mode

Target stations are stationary non-combatants: they never fire, never use hyperspace, and never move. They represent training dummies or objective markers. Visually they use standard station rendering in dark red with a thin pulsing ring indicator to distinguish them from active enemy stations. They count as enemies for scoring purposes (killing one is a kill; own-goaling one does not deduct points in story missions).

#### `visualStyle: "drone"` — Combat AI Visual Variant

Drone-style stations render as angular, mechanical shapes rather than the standard death-star sphere — a robot/machine aesthetic that signals "this one fights back." Used for AI opponents in story missions. Drones use their assigned team colour. Story-mode-only; no gameplay effect.

#### `collectablesSpawn: "fixed"`

When set to `"fixed"`, all collectables listed in `layout.collectables` are placed on the map at game start simultaneously. The normal per-turn spawn system is disabled. This enables designed collectable layouts for missions that require them.

#### `cannonEnabled: false`

When false, Cannon is removed from the active weapon list. Any collectable that would normally grant a Cannon-type reward instead re-rolls once for a different weapon. Intended for missions built entirely around a specific alternative weapon.

#### `events` — Mid-Mission Events

Events fire exactly once when `GameState.turn` equals the event's `turn` value. Stations spawned by an event use the hyperspace materialisation animation (appearing at a random valid position when `x`/`y` are `null`). The combat implicit fail rule applies to event-spawned enemy stations from the moment they arrive. If an event includes `addObjectives`, those objectives are appended to the active list and the in-game objective panel updates immediately. A `dialog` string triggers a dismissable popup overlay at event time.

#### Combat Fail Condition (Implicit)

For missions containing `role: "ai"` stations (whether placed at game start or via `events`), if all human stations are destroyed the mission fails immediately. This does not appear in `failConditions` — it is a base rule enforced by the engine for all story combat missions.

---

### 13.6 Objective Types

| Type | Description | Params |
|---|---|---|
| `destroy_all` | Destroy every enemy station (all teams other than team 0) | — |
| `destroy_n` | Destroy at least N enemy stations | `count: number` |
| `collect_n` | Shoot through (collect) at least N collectables | `count: number` |

Objective state is tracked per-mission-run and reset on retry. The in-game objective panel (§13.4) reflects real-time progress.

---

### 13.7 Scoring Formulae

**Pass/fail:** Meeting all objectives within any fail conditions = MISSION COMPLETE. Failing an objective or triggering a fail condition = MISSION FAILED. Score has no effect on pass/fail.

**Score** is a leaderboard grade awarded on a pass. Each mission uses one scoring formula:

| Formula | Calculation |
|---|---|
| `target_practice` | Delegates to the target practice mode scoring system (see Target Practice spec). Rewards accuracy (shots fired vs hits) and turn efficiency. |
| `turns_remaining` | `score = (maxTurns − turnsUsed) × 100` — faster completion scores higher |
| `collectables_score` | `score = (collectedCount × 200) − (turnsUsed × 10)` — collectables are primary; turn efficiency is secondary |
| `combat_efficiency` | `score = (kills × 200) + (stationsSurvived × 100) − (turnsUsed × 5)` — rewards kills, preserving stations, and winning fast |

`passingScore` is a reference benchmark displayed on the debrief screen (e.g. as a star rating) but does not gate the unlock. Completing objectives unlocks the next mission regardless of score. Best scores are recorded per mission; retrying can improve them.

---

### 13.8 Persistence

Story progress is stored in `localStorage` under the key `dsb_story`. This is distinct from the §14 out-of-scope "save/load game state" — it stores only unlock flags and high scores, not mid-game state.

```json
{
  "unlocked": ["m1-training", "m2-team"],
  "scores": {
    "m1-training": 2450,
    "m2-team": 1800
  }
}
```

- `unlocked` — mission IDs the player has passed at least once
- `scores` — best score per mission ID; absent if never passed
- `campaignComplete` — boolean flag set when all 20 missions have been passed at least once
- Mission 1 is always playable regardless of `unlocked` contents

---

### 13.9 Campaign Completion Reward

When the player passes Mission 20 (completing all 20 missions for the first time), `campaignComplete: true` is written to `dsb_story`. This flag unlocks the **Starting Weapons** config option in the main config panel — an option that is hidden from players until this point. Starting Weapons also applies to Target Practice mode. No other hidden or dev-only config options are exposed by this flag.

The completion reward is shown on the Mission 20 debrief screen with a brief unlock message.

---

### 13.10 Mission Definitions

#### Mission 1 — Basic Training

**Story:** *"You are a new recruit. Welcome to the Academy. Pass basic target practice and we'll talk about putting you in a real cockpit."*

**Layout:**
- 1 human station at centre-left (x=0.2, y=0.5)
- 3 target stations in a loose arc to the right: (x=0.78, y=0.22), (x=0.82, y=0.5), (x=0.78, y=0.78)
- 3 Crystal Asteroids forming a cluster at map centre: (x=0.5, y=0.4), (x=0.48, y=0.55), (x=0.53, y=0.62); small radius, low density
- No stars or heavy gravitating bodies

**Settings:** Standard size, normal speed, no movement, collectables off

**Objectives:** Destroy all 3 targets

**Fail conditions:** None

**Scoring:** `target_practice` formula

**Passing score:** 500

**Design note:** Crystal Asteroids are placed between the player and targets; bullets pass straight through them (§5). This introduces the crystal asteroid mechanic while keeping the challenge accessible. Players learn that crystal asteroids do not block shots.

---

#### Mission 2 — Wing Formation

**Story:** *"Good shooting, recruit. But out there you won't be alone. Learn to coordinate with your wingman — two ships, one objective."*

**Layout:**
- 2 human stations on the same team, left side: (x=0.18, y=0.35) and (x=0.18, y=0.65) — the human player controls both sequentially each turn (2 stations per player, as per existing §4.1 multi-station support)
- 5 target stations scattered across the right half
- 3 standard asteroids placed across the centre band

**Settings:** Standard size, normal speed, no movement, collectables off

**Objectives:** Destroy all 5 targets

**Fail conditions:** None

**Scoring:** `target_practice` formula applied across both stations combined (total shots fired, total hits)

**Passing score:** 800

**Design note:** The human controls both stations themselves, taking two aiming actions per turn. "Team practice" teaches multi-station coordination — planning which station to use for which target, and recovering when one fires badly.

---

#### Mission 3 — Dead Zone

**Story:** *"Position is everything in combat. Your current position is a death sentence — the star's gravity will drag every shot you fire right back down. Figure it out, recruit."*

**Layout:**
- 1 human station placed in the lower-middle of the screen, close to the star (x=0.5, y=0.82)
- 1 target station at the top of the screen (x=0.5, y=0.1)
- 1 Supergiant star (type `star`, very large radius, high density) placed just off the bottom edge (x=0.5, y=1.08) — visible as a large corona bleeding into the bottom of the play area; gravitationally dominates the lower half of the screen
- No other planets

**Settings:** Standard size, normal speed, no movement, collectables off; Hyperspace available from the start

**Objectives:** Destroy the target

**Fail conditions:** 15 turns maximum

**Scoring:** `turns_remaining` — `score = (15 − turnsUsed) × 100`

**Passing score:** 200 (equivalent to succeeding within 13 turns)

**Design note:** The intended solution is to Hyperspace once or twice to escape the gravity well, then fire from a position where the target is reachable. The star must be tuned so that no straight shot from the starting position reaches the target — all trajectories curve back down. Players who stumble onto an extreme angle solution are not blocked, but the consistent path is repositioning via hyperspace. This teaches strategic hyperspace use (§4.4).

---

#### Mission 4 — Field Collection

**Story:** *"Special equipment doesn't get handed out for free — you earn it in the field. Those collectables out there? Each one gives you a Blaster charge. Get five of them. Go."*

**Layout:**
- 1 human station at screen left (x=0.15, y=0.5)
- 10 collectables placed in a spread pattern across the right two-thirds of the map (`collectablesSpawn: "fixed"`)
- 6 standard asteroids interspersed amongst the collectables as obstacles requiring trajectory planning
- No stars or heavy gravitating bodies; mild gravity from asteroids only

**Settings:** Standard size, normal speed, no movement, `collectablesSpawn: "fixed"`, `collectableWeapon: "blaster"`

**Objectives:** Collect at least 5 collectables (shoot through 5)

**Fail conditions:** 15 turns maximum

**Scoring:** `collectables_score` — `score = (collectedCount × 200) − (turnsUsed × 10)`

**Passing score:** 600 (collecting 5 within 10 turns, or 6+ in up to 14 turns)

**Design note:** Collectables always grant Blaster here (overriding the usual random weapon), so the reward is predictable and the player learns what the Blaster does. Bullets pass through collectables without being destroyed — a well-aimed shot can chain through multiple in one turn. Discovering this is part of the skill ceiling.

---

#### Mission 5 — Contact

**Story:** *"Target practice is over, recruit. Those {enemy1}s shoot back now. One of them, one of you. Show us you can hold your own against a live opponent."*

**Layout:**
- 1 human station at left (x=0.18, y=0.5)
- 1 AI drone station (Aimbot, level 2; `visualStyle: "drone"`) at right (x=0.82, y=0.5)
- Binary Star scenario (existing scenario 5)

**Settings:** Standard size, normal speed, Slow movement, collectables off

**Objectives:** Destroy the enemy drone

**Fail conditions:** Combat implicit fail (human station destroyed)

**Scoring:** `combat_efficiency`

**Passing score:** 200

**Design note:** First mission with a live opponent that fires back. Binary Star provides two gravitational foci that curve trajectories unpredictably — harder than a flat range. Aimbot accuracy is low (~3%) so the player has room to learn, but the threat is real.

---

#### Mission 6 — Solo Combat

**Story:** *"One on one. Gas giant territory. Those cyans picked this turf — they like the gravity curves. Outthink them."*

**Layout:**
- 1 human station at left
- 1 AI drone (Aimbot, level 2; `visualStyle: "drone"`) at right
- Gas Giants scenario (existing scenario 12)

**Settings:** Standard size, normal speed, Slow movement, collectables off

**Objectives:** Destroy the enemy drone

**Fail conditions:** Combat implicit fail

**Scoring:** `combat_efficiency`

**Passing score:** 200

**Design note:** Same opponent as M5 but on a Gas Giants map with stronger gravity curvature. The player must adapt trajectory intuition to a heavier gravitational environment.

---

#### Mission 7 — Two vs Two

**Story:** *"Two of you, two of theirs. Gas Giants again — same field, different problem. Watch your wingman and pick your targets. Don't cross their shots."*

**Layout:**
- 2 human stations at left, medium team grouping
- 2 AI drone stations (Aimbot, level 2; `visualStyle: "drone"`) at right, medium team grouping
- Gas Giants scenario (existing scenario 12)

**Settings:** Standard size, normal speed, Slow movement, collectables off, medium team clustering

**Objectives:** Destroy all enemy stations

**Fail conditions:** Combat implicit fail

**Scoring:** `combat_efficiency`

**Passing score:** 350

---

#### Mission 8 — Squad

**Story:** *"Four on four. Tight formations. Star system — that gravity will bite you if you don't respect it. Those reds think their numbers make them safe. Show them different."*

**Layout:**
- 4 human stations, tight team grouping, left side
- 4 AI drone stations (Cleverbot, level 3; `visualStyle: "drone"`), tight team grouping, right side
- Star System scenario (existing scenario 4)

**Settings:** Standard size, normal speed, Slow movement, collectables off, tight team clustering

**Objectives:** Destroy all enemy stations

**Fail conditions:** Combat implicit fail

**Scoring:** `combat_efficiency`

**Passing score:** 500

---

#### Mission 9 — Platoon

**Story:** *"Six on six. Wormhole space — unpredictable. Those purples are veterans. They will adapt to you. Adapt faster."*

**Layout:**
- 6 human stations, loose team grouping, left half
- 6 AI drone stations (Superbot, level 4; `visualStyle: "drone"`), loose team grouping, right half
- Wormhole scenario (existing scenario 19)

**Settings:** Standard size, normal speed, Slow movement, collectables off, loose team clustering

**Objectives:** Destroy all enemy stations

**Fail conditions:** Combat implicit fail

**Scoring:** `combat_efficiency`

**Passing score:** 600

---

#### Mission 10 — Line of Battle

**Story:** *"Eight versus eight. Asteroid belt between you and those reds. You have one minigun — so do they. Whoever uses it better wins. Don't waste it."*

**Layout:**
- 8 human stations evenly spaced in a vertical line at x=0.1 (y from 0.1 to 0.9)
- 8 AI drone stations (Cleverbot, level 3; `visualStyle: "drone"`) in a mirrored vertical line at x=0.9
- Dense horizontal band of asteroids across the centre (y=0.4 to y=0.6) — approximately 15–20 small asteroids placed explicitly in the mission layout (not using the scenario generator, so both lines and belt width are precisely controlled)

**Settings:** Standard size, normal speed, Fast movement, collectables off, `startingWeapons: { minigun: 1 }`, `enemyStartingWeapons: { minigun: 1 }`

**Objectives:** Destroy all enemy stations

**Fail conditions:** Combat implicit fail

**Scoring:** `combat_efficiency`

**Passing score:** 700

**Design note:** Fast movement means positions shift meaningfully each turn. The Minigun timing decision — when to spend the single charge — is the central strategic choice of the mission.

---

#### Mission 11 — Rocket Corps

**Story:** *"No cannons today, recruit. Rockets only. Dense field around a star — everything curves. Four on four. Welcome to the Rocket Corps."*

**Layout:**
- 4 human stations, left half
- 4 AI drone stations (Cleverbot, level 3; `visualStyle: "drone"`), right half
- Small central star (medium radius, moderate density)
- Dense asteroid ring around the star — approximately 20–25 small asteroids in a rough ring at 25–35% of map-width radius from the star centre

**Settings:** Standard size, normal speed, Slow movement, `cannonEnabled: false`, `startingWeapons: { rocket: 99 }`, `enemyStartingWeapons: { rocket: 99 }`, `collectablesSpawn: "normal"`

**Objectives:** Destroy all enemy stations

**Fail conditions:** Combat implicit fail

**Scoring:** `combat_efficiency`

**Passing score:** 500

**Design note:** With cannon disabled, every action is a rocket or hyperspace. Rocket blasts destroy asteroids within their radius, so the map opens up over the course of the game. The central star curves all rocket paths. Collectables spawn normally and provide standard special weapons — any collectable that rolls Cannon re-rolls once (per the `cannonEnabled: false` rule in §13.5).

---

#### Mission 12 — Mining Duty

**Story:** *"Basic training is done, recruit. Now you pull your weight. That asteroid field is full of raw crystals — we've logged at least ten in range. Two ships, twenty turns. Get them."*

**Layout:**
- 2 human stations, left side, moderate team grouping
- Small Gas Giant at map centre (low density, moderate radius)
- Surrounding mixed asteroid field: standard asteroids with Rich Asteroids at ~10% of bodies; no stars

**Settings:** Standard size, normal speed, no movement, `collectablesSpawn: "normal"`, Rich Asteroids = Common (10%), no enemy starting weapons

**Objectives:** Collect at least 10 collectables

**Fail conditions:** 20 turns maximum

**Scoring:** `collectables_score` — `score = (collectedCount × 200) − (turnsUsed × 10)`

**Passing score:** 1500

**Design note:** No enemies — pure collection in a gravitational field. Shooting Rich Asteroids destroys them and spawns a collectable; the player must plan shots to collect the spawned gem in the same move or a follow-up before it drifts. The two ships allow parallel approach angles. Story text uses "crystals" as the in-universe informal term for collectables.

---

#### Mission 13 — Ambush

**Story:** *"Same sector. Intel says collect crystals — sensors are picking up something on the edge of the system. Stay sharp."*

**Layout:**
- 2 human stations, left side
- Small Gas Giant at map centre; mixed Rich/standard asteroid field (own separate layout from M12)
- No initial enemy stations

**Settings:** Standard size, normal speed, no movement, `collectablesSpawn: "normal"`, Rich Asteroids = Common (10%)

**Objectives (initial):** None — the collection phase is tactical (collectables grant weapons), not a tracked objective. The objective panel is empty until the ambush fires.

**Fail conditions:** 20 turns maximum; combat implicit fail once enemy arrives

**Events:**
- **Turn 3:** 2 Cleverbot drones (`visualStyle: "drone"`, `startingWeapons: { rocket: 99 }`) spawn at random valid positions. Dialog: *"Contact. Two {enemy1} ships have warped in. New objective: take them out."* New objective added: destroy all enemy stations.

**Scoring:** `combat_efficiency` — once the ambush fires, winning the fight is the only thing that matters

**Passing score:** 400

**Design note:** The collecting phase (turns 1–2) is purely tactical — use it to gather weapon charges before the fight. Once the enemies arrive, the mission reorients entirely. A player who collects nothing and survives the fight still passes; a player who collects everything but gets destroyed fails. The 20-turn limit applies from turn 1 — it is visible in the objective panel throughout.

---

#### Mission 14 — Patrol

**Story:** *"We are at war, recruit. You are on patrol. Supergiant binary — dangerous territory. Keep your eyes open."*

**Layout:**
- 2 human stations, left side
- No initial enemy stations
- Supergiant Binary scenario (existing scenario 8)

**Settings:** Standard size, normal speed, Slow movement, collectables off, `startingWeapons: { blaster: 2, blunderbuss: 2 }`

**Objectives:** Destroy all enemy stations (added by event)

**Fail conditions:** Combat implicit fail once enemy arrives

**Events:**
- **Turn 2:** 4 Cleverbot drones (`visualStyle: "drone"`, `startingWeapons: { tripleCannon: 4 }`) spawn at random valid positions. Dialog: *"Bogeys inbound. Four {enemy1}s, armed. Don't let them pick you apart."* New objective added: destroy all enemy stations.

**Scoring:** `combat_efficiency`

**Passing score:** 400

**Design note:** Human team starts as a 2-ship patrol with cannon and hyperspace only, then faces 4 triple-cannon Cleverbots. Hyperspace repositioning to break targeting is the intended survival tool. The hostile supergiant binary gravity adds trajectory complexity on both sides. Triple cannon charges are finite — surviving the opening salvo matters.

---

#### Mission 15 — Outnumbered

**Story:** *"Three of you. Six of them. Same weapons. Different odds. Figure it out."*

**Layout:**
- 3 human stations, left side, tight team grouping
- 6 Cleverbot drone stations, right side, tight team grouping
- Star Cluster scenario (existing scenario 11)

**Settings:** Standard size, normal speed, Slow movement, collectables off, tight team clustering, `startingWeapons: { tripleCannon: 3, minigun: 1 }`, `enemyStartingWeapons: { tripleCannon: 3, minigun: 1 }`

**Objectives:** Destroy all enemy stations

**Fail conditions:** Combat implicit fail

**Scoring:** `combat_efficiency`

**Passing score:** 500

**Design note:** 2:1 numerical disadvantage with equal firepower. Star Cluster's multiple dense gravity sources reward mastery of curved shots. The shared enemy minigun is a genuine threat — they will deploy it.

---

#### Mission 16 — Three-Way

**Story:** *"Another faction has entered the field. The reds and the yellows both want those resources. So do we. There's only room for one team in this asteroid field."*

**Layout:**
- 3 human stations, moderate team grouping (team 0)
- 3 Cleverbot drone stations, moderate team grouping (team 1)
- 3 Cleverbot drone stations, moderate team grouping (team 2)
- Mixed asteroid field: standard asteroids with Rich Asteroids = Normal (5%) and Crystal Asteroids (~20% of bodies); no stars

**Settings:** Standard size, normal speed, Slow movement, `collectablesSpawn: "normal"`, Rich Asteroids = Normal (5%), moderate team clustering, `startingWeapons: { rocket: 2 }`, `enemyStartingWeapons: { rocket: 2 }`

**Objectives:** Destroy all enemy stations (both opposing teams)

**Fail conditions:** Combat implicit fail

**Scoring:** `combat_efficiency` — kills against either enemy team count equally

**Passing score:** 400

**Design note:** First 3-team mission. The two AI factions fight each other as well as the player — letting them weaken each other before committing is valid strategy. Crystal Asteroids mean some bullets unexpectedly pass through terrain; Rich Asteroids generate collectables mid-battle as a side effect of combat.

---

#### Mission 17 — Four Factions

**Story:** *"Four factions. Two stations each. Red Giant territory. Everyone's armed. Show them who belongs in this sector."*

**Layout:**
- 2 human stations (team 0), moderate team grouping
- 2 Superbot drone stations per enemy team (teams 1, 2, 3), moderate team grouping
- Red Giant scenario (existing scenario 10)

**Settings:** Standard size, normal speed, Slow movement, collectables off, moderate team clustering, `startingWeapons: { rocket: 2, blaster: 4, blunderbuss: 3 }`, `enemyStartingWeapons: { rocket: 2, blaster: 4, blunderbuss: 3 }`

**Objectives:** Destroy all enemy stations (3 opposing teams)

**Fail conditions:** Combat implicit fail

**Scoring:** `combat_efficiency`

**Passing score:** 500

**Design note:** First mission against Superbots (~30% hit rate). Three AI factions target each other as well as the player; the human must manage threats across multiple directions. The heavy loadout on all sides makes every turn consequential.

---

#### Mission 18 — Laser Engagement

**Story:** *"Six factions. Three ships each. Asteroid field around a white dwarf — shots bend hard near the centre. Everyone has lasers. First team through wins."*

**Layout:**
- 3 human stations (team 0), loose team grouping
- 3 Superbot drone stations per enemy team (teams 1–5), loose team grouping
- Asteroid Belt scenario (existing scenario 17) with a White Dwarf substituted at map centre (custom planet entry: type `whiteDwarf`, x=0.5, y=0.5, small radius, very high density)

**Settings:** Standard size, normal speed, Slow movement, collectables off, loose team clustering, `startingWeapons: { laser: 3 }`, `enemyStartingWeapons: { laser: 3 }`

**Objectives:** Destroy all enemy stations (5 opposing teams)

**Fail conditions:** Combat implicit fail

**Scoring:** `combat_efficiency`

**Passing score:** 600

**Design note:** Lasers pierce through multiple stations in a line without stopping — a single aligned shot can eliminate several targets. The white dwarf's extreme gravity bends laser paths near the centre. With 5 AI factions fighting simultaneously, the arena degrades rapidly and opportunities for multi-kill shots open unpredictably.

---

#### Mission 19 — Total War

**Story:** *"All factions. Maximum engagement. Wormhole space. Small stations. Everyone is in the fight now, recruit. Do not let them outmanoeuvre you."*

**Layout:**
- 4 human stations (team 0), loose team grouping
- 4 Megabot drone stations per enemy team (teams 1–7), loose team grouping
- Wormhole scenario (existing scenario 19) — wormhole portals with mixed planet types

**Settings:** Small station size, normal speed, Slow movement, collectables off, loose team clustering

**Objectives:** Destroy all enemy stations (7 opposing teams)

**Fail conditions:** Combat implicit fail

**Scoring:** `combat_efficiency`

**Passing score:** 700

**Design note:** 32 stations total. Megabots coordinate targeting and factor in leaderboard positioning (§7.2). Wormhole deflections cause bullets to appear from unexpected directions — in a 32-station game this produces chaotic crossfire. Human must survive the opening turns while the AI factions thin each other, then push for kills once the field opens. Small station size shrinks hit radius for all parties.

---

#### Mission 20 — The Duel

**Story:** *"One final confrontation. Micro stations. A black hole between you and them. This is what all the training was for. Do not miss."*

**Layout:**
- 4 human stations (team 0), tight team grouping, left side
- 4 Megabot drone stations (team 1), tight team grouping, right side
- Black Hole scenario (existing scenario 22) with 3 comets added to `layout.planets` (type `comet`, gravitational bodies that move each turn per Comet scenario rules — see scenario 15)

**Settings:** Micro station size, normal speed, Slow movement, collectables off, tight team clustering

**Objectives:** Destroy all 4 enemy stations

**Fail conditions:** Combat implicit fail

**Scoring:** `combat_efficiency`

**Passing score:** 800

**Design note:** The finale. Micro stations are the smallest hit target in the game — every shot must count. The black hole at centre makes direct paths impossible; all trajectories must arc around it. Moving comets add shifting gravitational perturbations that vary turn to turn. Megabots run at ~50% hit rate; surviving the opening turns requires careful hyperspace use and positional play learned across the full campaign.

---

### 13.11 Design Goals

1. **Teach by doing** — every mission introduces or emphasises exactly one mechanic. The player learns by playing, not by reading.
2. **Always feel achievable** — early missions are winnable on the first or second attempt. Later missions are hard but fair.
3. **Build tension** — the campaign arc escalates from a quiet firing range to a 32-station war across wormhole space.
4. **Reward mastery** — completing the full campaign unlocks a hidden game feature. Score-chasing keeps replayable missions interesting.
5. **Get out of the way** — no lengthy tutorials, no dialog boxes between turns. The briefing is 3 sentences. Then you play.

### 13.12 Player Experience Flow

```
Main Menu
  └─ Mode: Story Mode
       └─ Mission Select Screen
            ├─ Locked missions (visible, greyed out)
            └─ Unlocked mission card → click
                 └─ Mission Briefing Overlay
                      └─ "Start Mission"
                           └─ Game (standard engine, story layout)
                                ├─ In-game Objective Panel (top-right HUD)
                                ├─ [optional] Mid-mission Dialog Popup (pauses game)
                                └─ Mission ends → Debrief Screen
                                     ├─ MISSION COMPLETE → score + best score badge
                                     │    ├─ Retry (improve score)
                                     │    └─ Next Mission → Mission Select
                                     └─ MISSION FAILED
                                          ├─ Retry
                                          └─ Next Mission (greyed if still locked)
```

No config panel during story missions. All settings are locked to the mission definition. Progress (unlock state and best scores) is stored in `localStorage` and survives browser restarts.

### 13.13 Campaign Arc

**Phase 1 — Basic Training (M1–M4):** No enemies. Learn the physics. Player is a raw recruit on a firing range. Targets don't shoot back. Each mission introduces one core concept: crystal asteroids (M1), multi-station coordination (M2), hyperspace as a tactical tool (M3), collectables that grant weapons (M4).

**Phase 2 — Live Fire (M5–M11):** Enemies fight back. Learn to fight. Escalates from 1v1 Binary Star through to Rockets-only combat with no cannon, adding new complexity each mission: gas giants (M6), squads (M7–M8), platoons with Superbot (M9), line of battle with Minigun (M10), Rockets-only (M11).

**Phase 3 — Field Operations (M12–M16):** The war gets complicated. Missions shift to scenarios with story complications: mining duty (M12), ambush that pivots to combat (M13), patrol followed by a 4-on-2 arrival (M14), outnumbered 3v6 (M15), three-way faction battle where letting enemies fight each other is valid strategy (M16).

**Phase 4 — Total War (M17–M20):** Everything at once. Large-scale chaotic battles with the hardest AI: 4 factions in a Red Giant (M17), lasers-only near a white dwarf (M18), 32 stations in wormhole space with Megabots (M19), 4v4 Megabots with micro stations and a black hole (M20).

### 13.14 Key Design Decisions

**Pass on objectives, score for pride:** Meeting all mission objectives = MISSION COMPLETE regardless of score. Score is a leaderboard grade displayed on the debrief screen. A pass is a pass. Score only matters for replay.

**Linear unlock, free replay:** Missions unlock in sequence. Once unlocked, any mission can be replayed for a better score. You can't skip ahead but you can always revisit.

**Narrative as a thin wrapper:** Story text is 2–4 sentences in a military boot camp voice. No cutscenes, no extended dialogue, no named characters. The narrative exists to give each mission a reason and a mood. Players can skim it and hit Start immediately.

**Enemies referenced by colour:** Enemy faction names are their team colour ("those cyans", "the reds"). Briefing text uses `{enemy1}` placeholders resolved to actual colour names at render time.

**Mid-mission events for story beats:** Missions 13 and 14 use the event system to introduce enemies partway through, completely changing the nature of the mission. M13 starts as a quiet collection run and becomes a firefight. This teaches the player to stay adaptable.

**Target stations as non-firing dummies:** Training missions use `role: "target"` stations — they look different (pulsing red ring) and never fire. The game engine runs normally; the distinction is purely in the station's role field.

**Drone visual for combat AI:** AI opponents use `visualStyle: "drone"` — an angular mechanical shape instead of the standard death star sphere. This signals visually that these enemies fight back.

**Data-driven mission definitions:** Every mission is a plain JavaScript object in `STORY_MISSIONS[]`. Adding or changing a mission is a data edit, not a code change.

### 13.15 What Story Mode Is Not

- Not a tutorial with pop-up instructions — mechanics are introduced through scenario design.
- Not a narrative game — the story is flavour, not the point.
- Not a separate code path for physics — the standard `GameLoop`, `PhysicsEngine`, and `Renderer` run unmodified.
- Not synced across devices — `localStorage` means progress is per-browser.
- Not resumable mid-mission — retrying always restarts from the beginning.

---

## 16. Non-Functional Requirements

### 16.1 Frame Rate

The game must sustain **60 fps** on all target platforms during normal gameplay, including scenarios with many planets, active bullets, rocket smoke, and wormhole particles simultaneously.

| Platform | Target | Minimum acceptable |
|---|---|---|
| Desktop PC (Chrome/Firefox) | 60 fps | 60 fps |
| Android phone/tablet (Chrome) | 60 fps | 45 fps |
| iPad (Safari / WKWebView) | 60 fps | 45 fps |

"Normal gameplay" is defined as: up to 15 planets (including up to 6 gas giants and 3 wormholes), 4 teams × 2 stations, up to 8 simultaneous bullets in flight, rocket smoke active, and wormhole particles active. The `full` performance mode must meet this target on all three platforms.

### 16.2 Performance Modes

The game must provide at least two user-selectable performance modes:

- **Full** — all visual effects enabled (bloom explosions, fireball particles, wormhole particles, gas giant blur). Must hit 60 fps on the platforms above.
- **Simplified** — reduced effects (classic arc explosions, no wormhole particles, no gas giant blur). Provides headroom for low-end devices or user preference.

Two additional modes are available in developer mode only (`Ctrl+Shift+D`):

- **Experimental** — full effects rendered with bitmaps on desktop, automatically falls back to circles on iOS (detected via user agent). Intended for visual quality testing.
- **Exp iPad** — full effects always rendered as circles, regardless of platform. Intended for performance testing on iPad.

### 16.3 Developer Mode

A hidden developer mode must be accessible via `Ctrl+Shift+D` on keyboard, or by triple-tap on the About panel (for mobile access without a keyboard). Dev mode:

- Reveals the `Experimental` and `Exp iPad` performance options in the config panel.
- Unlocks all story missions regardless of completion state.
- Displays a real-time stats overlay (toggled separately) showing: FPS, planet count, station count, bullet count, and a combined SFX particle count covering all active particle arrays (rocket smoke, comet smoke, wormhole particles, bloom particles, fireballs, fireball smoke).
- All dev-mode options reset to hidden if dev mode is toggled off during a session.
- Dev mode state is not persisted across sessions.

### 16.4 Rendering Constraints

- No per-frame `document.createElement('canvas')` calls. All offscreen canvases must be allocated at game start or on viewport resize.
- No `ctx.filter` assignments during the live draw loop. Blur and filter effects must be baked into pre-rendered canvases at setup time.
- No `createRadialGradient()` calls during the live draw loop. All gradients used for static or near-static elements (gas giant spheres, atmosphere halos, wormhole rings) must be pre-computed.
- Canvas-to-canvas `drawImage` of frequently-reused sources should use `ImageBitmap` where the source is immutable, to avoid GPU pipeline flushes in Chrome.

---

## 14. Out of Scope (v1)

- Sound / music
- Multiplayer over network
- Mobile touch controls
- Save/load game state
- Animated star field parallax
- Custom planet/scenario editor

These may be considered for later versions.

---

## 15. Confirmed Decisions

The following are confirmed from the original source / website / screenshots:
- ✅ **Simultaneous fire** — all shots fire at once when every player has acted.
- ✅ **Station size default** — large (size 5).
- ✅ **Trail persistence** — trails cleared at start of each new turn (persist across explosion animation within the same turn, via the three-layer render approach).
- ✅ **Wormhole colour coding** — purple/blue/green/grey/yellow — keep exactly.
- ✅ **First-run demo** — auto-start a demo game (5 AI, red giant scenario) before the player configures anything.

All open questions have been resolved.

---

## 17. Target Practice Mode

### 17.1 Mode Selection
Target Practice is a selectable Game Mode alongside Single Game and Tournament in the Mode config option.

### 17.2 Configuration
The config panel includes a **Target Practice** page (Page 5) visible only when Target Practice is the selected mode.

| Option | Values | Default |
|---|---|---|
| Number of Targets (N) | 1 / 3 / 5 / 7 / 10 / 20 | 5 |
| Target Size | Micro / Tiny / Small / Medium / Large / Giant / Mammoth | Medium |
| Number of Rounds | 1 / 3 / 5 / 7 / 10 | 5 |
| Include AI | Off / On | Off |

### 17.3 Scenario Generation
On game start, a scenario is randomly selected from the permitted subset: **Planetary, Asteroids, Crystal Asteroids, Gas Giants, Star System, Wormhole**. Wildcard planets apply if the Wildcard setting is enabled. No stations are placed by the scenario generator.

### 17.4 Station Placement
- **Landscape orientation** (width ≥ height): all stations placed along a vertical line at either the left or right edge (chosen randomly).
- **Portrait orientation**: all stations placed along a horizontal line at either the top or bottom edge (chosen randomly).
- Stations are evenly spaced along the placement line. The same three-tier planet-avoidance fallback from §6.3 is applied along the placement line.

### 17.5 Target Placement
The system attempts to place **2N** practice targets in unoccupied positions, avoiding planet overlap, distributed across the non-station portion of the map. Targets are rendered as archery bullseye targets (concentric red/white rings) at the configured Target Size. Targets are not affected by gravity. Bullets pass through targets without being destroyed.

### 17.6 Target Feasibility Simulation
After placing 2N candidates, a silent feasibility simulation is run: fire 50 Megabot-quality simulated shots from each station at each candidate target, recording which pairs achieve at least one hit. N final targets are selected from the 2N candidates by priority: (1) prefer targets hittable by the most distinct stations; (2) break ties randomly; (3) if fewer than N targets were hit at all, pad with unhit candidates randomly to reach N.

If the placement algorithm cannot position 2N targets without planet overlap, the scenario is discarded and re-rolled (up to 6 attempts; after 6 failures, fall back to Planetary with N halved).

### 17.7 Per-Team Shared Target Pool
Targets are owned by a **team**, not individual stations. All stations on a team share one pool of N targets. A target is destroyed for a team the first time any station on that team hits it. Once destroyed for a team it is gone for the rest of the game.

### 17.8 Round and Turn Structure
A game consists of the configured number of rounds. Each round follows the same structure as normal play (simultaneous fire — all stations aim, then all bullets fire at once):

1. **Aiming phase** — every station sets angle and power. AI stations (when Include AI is On) calculate immediately. Stations cycle in the normal order.
2. **Firing phase** — all bullets fire simultaneously. Bullets travel until they hit a planet, leave the boundary, or time out.
3. **Hit resolution** — any bullet entering a surviving target's radius registers a hit for that bullet owner's team; the target is destroyed for that team and a glitter VFX plays.
4. **Early completion** — after each firing phase, if a team's targets are all destroyed, that team's play ends. Remaining teams continue until they finish or exhaust all rounds.
5. **Round advance** — round counter increments. When all teams have finished or exhausted rounds, the Results Screen is shown.

The aiming indicator, ghost trail, and End Turn button behave identically to normal play.

### 17.9 Weapons and Movement
Only **Cannon** is available in Target Practice mode. Hyperspace, special weapons, and the weapon selector are not available. Station Movement is Off and non-configurable.

### 17.10 Hit Detection and Accuracy
When a bullet's position enters a target's radius, a hit is registered for that (station, target) pair. The bullet continues on its trajectory unaffected. The target is destroyed immediately with a glitter particle burst VFX. Hitting an already-destroyed target has no effect.

**Accuracy score per hit:**

> **A = max(0, 1 − θ / 90°)**

where θ is the angle in degrees between the bullet's velocity vector at moment of impact and the vector from the impact point to the target centre. A = 1.0 means the bullet passed directly through the centre; A = 0.0 means a tangential graze.

### 17.11 Scoring
At the end of all rounds, per team:

- **Targets cleared** — targets hit out of N.
- **Hit Rate** — targets hit ÷ N × 100%.
- **Mean Accuracy** — arithmetic mean of all per-hit accuracy scores. Shown as "—" for zero hits.
- **Finished Round** — round in which all N targets were cleared ("Round X / Y"). "—" if not cleared.

Multi-station teams show aggregated team-level hit rate and mean accuracy alongside individual station breakdowns.

### 17.12 Results Screen
On completion: per-station and per-team results showing hit rate, mean accuracy, and targets destroyed out of N. Offers **Play Again** (new scenario, same config) and **Main Menu** (return to config screen).

### 17.13 Visual Continuity
The star field and planet layer persist across all turns within a game. Each station's bullet trails are cleared at the start of that station's next turn. Destroyed target positions remain visually clear after the destruction VFX completes.
