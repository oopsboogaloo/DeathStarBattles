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
- Station size is configurable: Micro / Tiny / Small / Medium / Large / Giant (affects hit radius and visual size)
- Station colours are fixed per team: green, cyan, yellow, red, purple, blue, orange, grey, white, black, pink, brown

### 4.2 Per-turn Actions
Each station selects a weapon, then either fires or hyperspaces:
- **Cannon** — standard single bullet at the configured angle and power. Default weapon, infinite uses.
- **Hyperspace** — teleport to a random valid location instead of firing. The player sacrifices their shot for a repositioning gamble. Infinite uses.
- **Triple Cannon** — fires 3 bullets simultaneously at `[angle − 5°, angle, angle + 5°]`, each at the same power. Limited uses; acquired by shooting space crystals (see §4.6).

### 4.3 Aiming Controls
Human players control angle and power via:
- **Mouse drag** — click near the station and drag; direction sets angle, distance from station sets power. A visual arrow and power indicator renders in real-time.
- **Keyboard** — angle: Z/X (±1°), A/S (±5°); power: K/M (±1), J/N (±10)
- **UI sliders** — angle slider (0–360), power slider (1–800) shown in the control panel

### 4.4 Hyperspace
- Available via the weapon selector (H key or weapon button)
- Station is teleported to a random free position at start of next turn (before firing)
- Cannot be used if the station is already destroyed
- Forced every turn in the Hyperspace scenario (§6.21)

### 4.5 Station Movement
- When Movement Speed is set to anything other than Off, stations drift slowly around the map each turn
- Speed tiers: Glacial (1×), Slow (2×), Normal (3×), Fast (5×), Rocket (8×)
- Movement is purely positional drift — it does not affect the station's angle or power settings

### 4.6 Special Weapons & Collectables

#### Weapon Selector
The Hyperspace button is replaced by a **weapon selector** showing the currently selected weapon. Clicking the button (or pressing H) opens a vertical popup listing all available weapons with remaining use counts. If only Cannon and Hyperspace are available, H toggles directly between them without a popup.

Selected weapon resets to Cannon at the start of each turn.

#### Triple Cannon
- Fires 3 bullets simultaneously at `[angle − 5°, angle, angle + 5°]`
- Each bullet is an independent physics entity with its own trail in the team colour
- Consumes one use per firing (not per bullet); brief triple-arc muzzle-flash VFX plays on the station before the bullets launch
- Not in the default loadout — acquired by shooting space crystals

#### Space Crystals
- Rotating geometric crystal entities that spawn at random valid map positions
- Not affected by gravity; do not stop bullets — a bullet passes straight through and the crystal is destroyed
- Spawn probability is configurable (see §10); maximum 3 crystals on the map simultaneously
- Do not spawn in the Hyperspace scenario
- When a bullet destroys a crystal: the bullet continues on its trajectory; the bullet owner's team gains **3 uses** of Triple Cannon; a crystal shatter VFX plays at the crystal position; the collectable name fades in/out in the bullet owner's team colour
- Weapon stocks are **shared across all stations on a team** and **carry over between tournament games**

#### AI Behaviour with Collectables
- All AI levels use Triple Cannon when they have stock (they spend it opportunistically)
- Randbot and Aimbot use a random probability check before spending stock
- Cleverbot, Superbot, and Megabot factor stock use into their existing shot-selection logic
- Superbot and Megabot opportunistically aim for crystals when selecting targets

---

## 5. Planet Types

All planets exert gravity unless stated otherwise. Planet impact behaviour when a bullet enters the planet radius:

| Type | Colour | Impact Behaviour |
|---|---|---|
| Rocky planet | Brown/tan | Bullet explodes on impact |
| Asteroid | Dark brown | Bullet explodes on impact |
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

---

## 6. Scenarios

21 named scenarios control how planets are placed and what types appear. A "lucky dip" option picks randomly, weighted towards the more common scenarios.

| # | Name | Description |
|---|---|---|
| 1 | Planetary | 1–10 rocky planets randomly placed |
| 2 | Asteroids | Many small asteroids (density low, mass low) |
| 3 | Star System | One central star + rocky planets |
| 4 | Binary Star | Two stars + rocky bodies |
| 5 | Jovian | One large gas giant + smaller moons |
| 6 | Super Giant | One massive star placed off-centre, partially off-screen |
| 7 | Super Giant Binary | Two massive off-screen stars |
| 8 | Uneven Binary | One supergiant + one regular star |
| 9 | Red Giant | Large red star + rocky bodies |
| 10 | Star Cluster | Several small dense stars |
| 11 | Mixture | Mix of stars and asteroids |
| 12 | White Dwarf | One tiny but enormously dense white dwarf + rocky bodies |
| 13 | Wormhole | Primarily wormhole portals (type varies: paired/cyclic/random/self) |
| 14 | Dwarfs | Multiple white dwarfs |
| 15 | Black Hole | One central black hole + rocky bodies |
| 16 | Black Holes | Multiple black holes |
| 17 | Wormholes | All wormhole portals, no regular planets |
| 18 | Big Wormhole Pair | Two enormous wormhole portals (partially off-screen) + planets |
| 19 | White Hole | One repulsive white hole + rocky bodies |
| 20 | White Holes | Multiple white holes |
| 21 | Hyperspace | No planets; hyperspace is forced every turn |

### 6.1 Wildcard Features
A configurable wildcard frequency option controls whether a bonus special object is injected into each scenario. When enabled, the injected object is one of: extra wormhole pair, wormhole triple, random-wormhole, white dwarf, or black hole. Frequency options: Off / Very Rare / Rare (default) / Occasional / Common / Always.

### 6.2 Planet Placement Rules
- Planets may not overlap each other (checked on generation with retry)
- At least ~25% of the play area must remain free of planets
- Stations are placed after planets and must not overlap planets or be too close to enemy stations

### 6.3 Station Placement Guarantee
Stations **must never be rendered inside a planet**, even on extreme scenarios (e.g. large binary stars that leave almost no free space). The placement algorithm uses a three-tier fallback:

1. **Normal** — retry up to 4000 times enforcing both station-station spacing AND planet avoidance. Spacing threshold decreases on each failure.
2. **Emergency** — if normal fails, drop station-station spacing requirements but continue checking planet avoidance (up to 2000 more attempts).
3. **Last resort** — if emergency also fails (can happen when stars cover >95% of play area), push any station that landed inside a planet outward to the planet's surface + a small buffer. Stations may be close together but will never be inside a planet.

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
Every 5 games, awards are shown for:
- **Bloodlust** — most kills
- **Oppression** — most oppression kills
- **Bully** — most bully kills
- **Vengeance** — most vengeance kills

---

## 9. Game Modes

### 9.1 Single Game
Play one match. The team with surviving stations wins.

### 9.2 Tournament
Play a series of games on a fixed configuration. A cumulative leaderboard tracks wins, kills, suicides, own goals, shots fired, and survival. Scenarios may randomise between games. Awards are shown every 5 games.

---

## 10. Configuration Options

The config panel has a primary section always visible and an Advanced section (collapsible on large screens; split across pages 2 and 3 on small screens — see §11.8).

### Primary Options
| Option | Values |
|---|---|
| Number of players (teams) | 2–12 |
| Human / CPU split | 0 human up to all human |
| Stations per player | 1–8 |
| CPU difficulty | Randbot / Aimbot / Cleverbot / Superbot / Megabot |

### Advanced — World
| Option | Values |
|---|---|
| Station size | Micro / Tiny / Small / Medium / Large / Giant / Mammoth |
| Number of planets | Random / 3–50 |
| Scenario | 1–21 / Lucky Dip |
| Game mode | Single game / Tournament |
| Game speed | ¼× / ½× / 1× (default) / 2× / 4× |
| Movement speed | Off (default) / Glacial / Slow / Normal / Fast / Rocket |

### Advanced — Options
| Option | Values | Notes |
|---|---|---|
| Performance | Full / Simplified | Simplified caps planets at 20 and players at 4 |
| Team clustering | Off / Tight / Moderate / Loose | Controls how close same-team stations are placed |
| Wildcard planets | Off / Very Rare / Rare (default) / Occasional / Common / Always | See §6.1 |
| Collectables | Off (default) / Rare / Normal / Common / Continuous | Crystal spawn probability; see §4.6 |
| Aim circle size | 0.5× / 1× (default) / 2× / 3× | Visual size of the aiming circle around the active station |
| Minimal UI | Off / On | Reduces HUD text size for smaller screens |

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

### 11.3 In-Game Aiming Visualisation (from screenshots)
The original shows a **white circle** around the active station with a **single white line** extending from the centre in the firing direction. This is clean and effective — preserve it in the HTML5 version:
- White circle radius = the interactive drag zone (matches stationboxradius)
- Single white line from centre in firing direction, length proportional to power
- Updates live as the player adjusts angle/power

### 11.4 Station Visual Design (from screenshots)
- Stations are small circular icons (~15–25px diameter) resembling a **Death Star** — a coloured sphere with a visible equatorial band/trench detail
- Each station is solid in its team colour (green, cyan, red, yellow, etc.)
- No label on the station itself; team identity comes from colour + the canvas header text

### 11.5 Planet & Star Visual Style (from screenshots)
- **Stars** (yellow/red/giant): bright coloured core circle surrounded by a **fuzzy corona** — a halo of short radiating strokes or dots in a darker shade of the star colour, giving a bristly/spiky appearance. This is the most distinctive visual in the game — preserve it.
- **Rocky planets / asteroids**: smaller, brownish or dark-orange circles with simple shading (lighter on one side)
- **Black holes**: invisible or near-invisible (confirmed by original hints — players must infer from the gap in the map)
- **Wormholes**: distinctive colour-coded circles (purple/blue/green/grey/yellow) with pulsing or swirling render effect
- **White holes**: bright white with a repulsion glow

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

### 12.4 No Dependencies (initially)
- Pure vanilla JS — no frameworks, no build step
- May add a single lightweight bundler (e.g. esbuild) later if module organisation requires it

---

## 13. Out of Scope (v1)

- Sound / music
- Multiplayer over network
- Mobile touch controls
- Save/load game state
- Animated star field parallax
- Custom planet/scenario editor

These may be considered for later versions.

---

## 14. Open Questions for Review

The following are confirmed from the original source / website / screenshots:
- ✅ **Simultaneous fire** — all shots fire at once when every player has acted.
- ✅ **Station size default** — large (size 5).
- ✅ **Trail persistence** — trails cleared at start of each new turn (persist across explosion animation within the same turn, via the three-layer render approach).
- ✅ **Wormhole colour coding** — purple/blue/green/grey/yellow — keep exactly.
- ✅ **First-run demo** — auto-start a demo game (5 AI, red giant scenario) before the player configures anything.

The following still need a decision:

1. **Tournament leaderboard detail** — the original shows "hit accuracy, wins, kills and surviving stations" as a running total. Do we want to surface the per-kill-type breakdown (vengeance/strategy/bully etc.) in the UI, or reserve that for an end-of-tournament awards screen only?
2. **Star Wars theming** — how literal? Death Star icons on stations (as in original), Star Wars-style font for the title screen, or minimal theming (keep the name but don't lean hard into SW IP)?
3. **Sound** — the original has no sound. Do we want to add it in v1, or keep it out for now?
4. **Slow-motion mode** — the original has O key while paused for slow-motion step-through. Include in v1?
5. **Numerical accuracy** — the original's author notes the physics has known drift errors near black holes (acceptable). Should we try to improve this (e.g. RK4 integration) or faithfully reproduce the same Euler method?
