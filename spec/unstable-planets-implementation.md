# Unstable Planets — Implementation Notes

> As-built reference for the unstable-planet feature: the entities, the eruption
> choreography, every particle system involved, the generation/cascade model, the
> fire-phase interaction, and all tunable constants with their current values.
> The design rationale lives in `unstable-planets-spec.md`; this document describes
> what the code actually does and where it lives.

---

## 1. Overview

An **unstable planet** is an ordinary-looking obstacle that erupts when a projectile
hits it, throwing a hazard onto nearby stations — credited to whoever fired the shot.
There are four subtypes, distinguished by colour, idle effect, and eruption payload:

| Subtype | `PlanetType` | Glow / tint | Eruption payload | Effect on a station |
|---|---|---|---|---|
| **Pyro**    | `PYRO`    | molten red `[255,70,30]`     | slow swelling **blobs** (rumble sequence) | **destroys** it |
| **Cryo**    | `CRYO`    | frost white `[225,240,255]`  | slow swelling **blobs** (rumble sequence) | **freezes** (`frozen += 1`) |
| **Electro** | `ELECTRO` | blue-cyan `[70,200,255]`     | fast straight **lightning bolts** (instant) | **shocks** (`electrified += 1`) |
| **Beam**    | `BEAM`    | yellow `[255,210,60]`        | one piercing **laser** (instant) | **destroys** every station on the beam |

Colours are `UNSTABLE_GLOW` in `src/entities/Planet.js`; they tint the under-crack glow,
the ejecta, the debris, and the beam.

Passively an unstable planet is identical to a `ROCKY` planet (same gravity, same
`mass = radius² × density`, same "bullet explodes on impact") — it just *additionally*
erupts. `isUnstable(type)` (Planet.js) is the predicate used everywhere.

**Size:** scenario generation builds them at **2× radius** (`UNSTABLE_SIZE_MULT` in
`ScenarioFactory.js`), so they are large, dominant bodies.

---

## 2. Entities & state

| Thing | Where | Notes |
|---|---|---|
| `PlanetType.PYRO/CRYO/ELECTRO/BEAM`, `isUnstable()`, `UNSTABLE_GLOW` | `src/entities/Planet.js` | the type enum + helpers |
| `Planet.crackSeed` | `src/entities/Planet.js` | per-instance seed for the static crack pattern |
| `Ejecta` | `src/entities/Ejecta.js` | a lethal eruption particle (pyro/cryo blob or electro bolt) |
| `gs.ejecta` | `GameState` | `Ejecta[]` in flight |
| `gs.eruptions` | `GameState` | active **eruption sequences** (the timed choreography) |
| `gs.eruptionDebris` | `GameState` | cosmetic "rumble" particles (no gameplay effect) |
| `gs.cometSmoke` | `GameState` | shared comet-smoke pool, reused for ejecta smoke puffs |
| `gs.vfxList` | `GameState` | holds `eruptionFlash` and `laserPath` VFX |

The whole system is driven from `src/core/GameLoop.js`; rendering is in
`src/rendering/Renderer.js`.

### 2.1 The `Ejecta` object

```
position, velocity   // Vec2 (game units per TIMESTEP)
kind                 // 'pyro' | 'cryo' | 'electro'
owner                // the instigator Station (credited for kills/conditions)
sourcePlanet         // the planet it erupted from (never re-triggers its own source)
generation           // 0 = bullet-triggered; chains increment it (§6)
launchDelay          // steps to wait before launching (stagger)
lifetime, maxLifetime
maxRadius, radius    // pyro/cryo blobs grow; electro = 0 (drawn as a bolt)
trail                // short Vec2[] for the electro bolt
```

### 2.2 The eruption-sequence object (in `gs.eruptions`)

A pyro/cryo eruption is **not** fire-and-forget — it's a stateful sequence ticked every
physics sub-step:

```
kind, owner, sourcePlanet, generation
ox, oy, nx, ny, baseAngle   // contact point + outward surface normal
vEsc                        // escape velocity at this planet (sets blob/debris speed)
gr, gg, gb                  // glow colour
chain                       // generation > 0 — the fire phase doesn't wait for these
age, duration               // progress in steps
nextMiniAt                  // schedule for the next cosmetic mini-burst
waves[]                     // { at, count, fired, big } — the lethal ejecta releases
```

---

## 3. Trigger

`PhysicsEngine._handlePlanetImpact` (`src/physics/PhysicsEngine.js`) flags a bullet that
hits an unstable planet: it explodes the bullet exactly like a rocky impact **and** sets
`bullet._eruptPlanet` + the contact point. The firing loop in `GameLoop` reads that flag
and calls `_triggerEruption(planet, x, y, owner, generation = 0)`.

- **No cooldown.** Every impact triggers, so a Triple Cannon / scatter weapon
  **multi-triggers** (one full eruption per bullet that lands). Run-away is bounded by
  the generation cap (§6), the global ejecta cap, and finite lifetimes — not by
  rate-limiting.
- The eruption fires **perpendicular to the surface** at the contact point (the outward
  normal `n`), with random spread.

---

## 4. Particle systems

There are **seven** distinct visual/gameplay systems. Cosmetic ones never touch
gameplay; lethal ones resolve collisions.

### 4.1 Idle surface look (cosmetic)
*Where:* `Renderer._drawUnstablePlanets` (live, every frame, under the camera transform),
called from `_drawLive` for every non-destroyed unstable planet.

A dormant unstable planet draws two things over its baked rocky body, so "something
unusual" reads at a glance:

- **Pulsing under-crack glow** — a radial gradient (centre → rim → transparent) whose
  alpha breathes via `sin(wallclock·2 + seed)`. Smooth and continuous.
- **Crack network** — 5 jagged radial fractures generated **deterministically** from
  `planet.crackSeed` (the `Renderer._uHash` value-hash), so the cracks are fixed per
  planet and never shimmer; only their brightness rides the glow pulse.

> A continuous idle-eruption *particle* system was prototyped (surface fountains across a
> faked sphere) and then **removed** — the dormant tell is just the glow + cracks for now.
> The eruption-time particle systems below are the focus.

### 4.2 Eruption sequence — the "rumble" choreography
*Where:* `GameLoop._triggerEruption` (creates it) and `_stepEruptions` (advances it).
Pyro/cryo eruptions play out over ~3.6s (gen 0) as a build-up:
- **Escalating cosmetic mini-bursts** of debris (§4.3) at random, overlapping intervals,
  following a sine envelope (minor → peak in the middle → taper).
- **Lethal ejecta released in waves** (§4.4), each wave punctuated by a flash + a bigger
  debris burst. Gen-0 waves: **1 → 2–3 → 1–2** at 30% / 60% / 88% of the duration.

This runs at **every generation**, scaled down (§6), so chained eruptions rumble like the
primary, only smaller.

### 4.3 Mini-eruption debris (cosmetic "rumble" particles)
*Where:* `gs.eruptionDebris`, spawned by `_spawnEruptionDebris`, stepped by
`_stepEruptionDebris`, drawn by `Renderer._drawEruptionDebris`.
Small sparks thrown from the contact point. They feel **reduced gravity**
(`ERUPTION_DEBRIS_GRAV = 0.167`) so they float/drift, **linger** a long time
(`ERUPTION_DEBRIS_LIFE = 840` steps), and fade out. Rendered as a coloured glow disc with
a **bright white-hot core** so the rumble is visible. Globally capped at
`MAX_ERUPTION_DEBRIS = 600`. No collisions — purely visual.

### 4.4 Lethal ejecta blobs — Pyro / Cryo
*Where:* `Ejecta` (kind pyro/cryo), spawned by `_spawnEjectaWave`, stepped by
`_stepEjecta`, drawn by `Renderer._drawEjecta`.
Slow, swelling blobs:
- **Grow** from 0 to ~a Large-station radius (`EJECTA_MAX_RADIUS = 6`) fast-then-easing
  over `EJECTA_GROW_STEPS = 90` (ease-out cubic).
- **Slow launch** — `EJECTA_VELOCITY_FACTOR = 0.60` of the escape-velocity-scaled speed.
- **Light gravity** — `EJECTA_GRAVITY_FACTOR = 0.18`, so they arc back into the fray.
- **Long airtime** — `EJECTA_MAX_LIFETIME = 24000` steps, so the slow blobs travel.
- **Collisions:** the *grown radius* counts for shield/station/asteroid hits. Pyro
  **destroys** a station (and **fragments asteroids** it crosses); cryo applies
  **frozen += 1**. Shield blocks; one armour layer absorbs. The **source** planet only
  re-absorbs a blob when its *centre* falls back inside (so a swelling blob isn't eaten
  by its own surface).
- They also emit comet-style smoke (§4.6).

### 4.5 Lethal lightning bolts — Electro
*Where:* `Ejecta` (kind electro), spawned **instantly** in `_triggerEruption`, stepped by
`_stepEjecta`, drawn by `_drawEjecta` as a jagged bolt.
Fast (`ELECTRO_SPEED = 1.6`), **straight** (ignores gravity), short range
(`ELECTRO_REACH_MULT = 3` × planet radius). On a station: **electrified += 1**. Electro is
a one-shot spray (no rumble sequence).

### 4.6 Ejecta smoke puffs (cosmetic)
*Where:* `GameLoop._emitEjectaSmoke` (once per frame), reusing the `gs.cometSmoke` pool;
drawn by `Renderer._drawCometSmoke` (now honours an optional per-puff `r,g,b`).
Each live pyro/cryo blob trails a short-lived coloured smoke puff per frame (pyro orange,
cryo pale blue) — emitted once per frame (not per sub-step) so the count stays bounded and
game-speed-independent.

### 4.7 Beam laser (with charge-up)
*Where:* a `beam` eruption sequence in `gs.eruptions`, advanced by `GameLoop._stepBeamEruption`;
the laser itself is `_simulateUnstableBeamPath` pushed as a yellow `laserPath` VFX.
A Beam impact does **not** fire instantly — it runs a short sequence:
1. **Charge-up** (`BEAM_CHARGE_STEPS`, ~2s): converging "charging" particles
   (`_spawnBeamCharge`) spawn on a ring around the contact point and move **inward**, at an
   intensifying rate, so the energy looks like it's gathering. (`laserCharged` sound.)
2. **Fire:** a bright flash + a muzzle burst of debris, then the laser path — one piercing
   beam along the surface normal, reusing the Laser-weapon path simulation (100% gravity,
   **destroys** every station, shatters asteroids/crystals, reflects off shields, absorbed
   by solid planets). (`laserBeam` sound.) Its hits chain at generation + 1.
3. **Calm-down** (`BEAM_CALM_STEPS`, ~1.4s): a tapering scatter of sparks dissipates.

Gen 2+ skips the charge and is visual-only (flash + debris). Because a primary (gen-0) beam
is a non-chain sequence, the fire phase waits for the full charge→fire→calm before the turn
ends (so the build-up is always seen).

### 4.8 Eruption flash (VFX)
*Where:* `eruptionFlash` entries in `gs.vfxList`, drawn by `Renderer._drawEruptionFlash`.
A brief expanding bright burst at the contact point, type-coloured. Pushed at the eruption
start and on each ejecta wave.

---

## 5. Lethal-ejecta stepping & resolution (`_stepEjecta`)

Per sub-step, for each `Ejecta`:
1. Honour `launchDelay` (stagger).
2. **Motion:** pyro/cryo feel `EJECTA_GRAVITY_FACTOR` of each planet's gravity; electro
   flies straight.
3. **Grow** the blob radius (pyro/cryo).
4. **Lifetime / bounds** → die.
5. **Shield** (blob edge) → consumed.
6. **Station** (blob edge) → apply effect (`_applyEjectaToStation`), then die.
7. **Planet:** own `sourcePlanet` absorbs only by centre; a *different* unstable planet →
   chain-trigger at `generation + 1`; pyro fragments asteroids/crystals; any other planet
   absorbs it.

Smoke is emitted once per frame by `_emitEjectaSmoke` (not here).

---

## 6. Generations — bounding the cascade

Cascades are kept from running away by a **generation** carried on every eruption and
ejecta. A payload that triggers another planet passes `generation + 1`:

| Gen | Trigger | Pyro / Cryo | Electro | Beam |
|---|---|---|---|---|
| **0** | bullet / rocket | full rumble sequence, **1 → 2–3 → 1–2** ejecta (~3.6s) | 5–7 bolts (instant) | full laser |
| **1** | a gen-0 payload | shorter rumble (~0.6×), **2–3** ejecta over 2 waves | 2–3 bolts | one laser |
| **2+** | a gen-1 payload | brief rumble (~0.42×), **0 ejecta** (visual only) | flash + debris only | flash + debris only |

Because gen-2 produces **no payload**, the chain always terminates. The original source
planet is never re-triggered by its own payload (the `sourcePlanet` guard). `owner`
propagates down the chain, so every kill anywhere in the cascade credits the player who
fired the first shot.

Additional bounds: global `MAX_EJECTA = 30`, `MAX_ERUPTION_DEBRIS = 600`, and finite
lifetimes.

---

## 7. Fire-phase interaction

`_advanceFiring` steps eruptions, ejecta, and debris each sub-step (and `_advanceTPFiring`
does the same for Target Practice). The end-of-phase gate:

- **Does not** wait for ejecta or chain eruptions.
- **Does** wait, once the last bullet is gone, for any **primary** (gen-0, `chain === false`)
  eruption sequence to finish — so a full eruption plays out instead of being cut off.
- When the gate opens, mid-flight ejecta, chain eruptions, and debris are **cleared**
  (they just stop). All four pools are also reset at the start of each firing phase.

---

## 8. Rendering map (`src/rendering/Renderer.js`)

| Method | Draws |
|---|---|
| `_drawUnstablePlanets` | under-crack glow, crack network, idle particles (live, over the baked body) |
| `_drawEruptionDebris` | cosmetic rumble sparks (glow + hot core) |
| `_drawEjecta` | pyro/cryo blobs (radial-gradient, white-hot core) and electro bolts |
| `_drawCometSmoke` | comet + ejecta smoke puffs (per-puff colour) |
| `_drawEruptionFlash` | the contact-point flash (`vfxList` switch) |
| `_drawLaserPath` | the Beam laser (existing, fed a yellow colour) |

Unstable planet **bodies** are baked into the cached background as ordinary rocky discs
(`ShadingStyle.ROCKY`, no vertices); everything above is drawn live each frame on top.

---

## 9. Scenarios & spawning

| Where | What |
|---|---|
| `scenarioData.js` | scenarios **39 Unstable Planet** & **40 Unstable System**; `SCENARIO_COUNT = 40`; both added to `TARGET_PRACTICE_SCENARIOS`; rare in Lucky Dip (any-band only) |
| `ScenarioFactory.js` | `makeUnstablePlanet` (2× size via `UNSTABLE_SIZE_MULT`); scenario 39/40 generation incl. extreme variants; unstable planet (random type) added to the wildcard pool |

- **39 Unstable Planet** — one large unstable planet (random type), 70% near centre /
  30% anywhere, + 5–9 moons/asteroids. Extreme (10%): a second, well-separated one.
- **40 Unstable System** — 3–12 smaller unstable planets + 2–6 moons. Extreme: double the
  count.

---

## 10. Tunable constants (current values)

All in `src/core/GameLoop.js` unless noted.

### Lethal ejecta (pyro/cryo blobs, electro bolts)
| Constant | Value | Meaning |
|---|---|---|
| `EJECTA_COUNT_MIN / MAX` | 5 / 7 | bolts per gen-0 electro spray (pyro/cryo use waves) |
| `EJECTA_SPREAD_DEG` | 25 | max angle off the surface normal |
| `EJECTA_MIN_FRAC / MAX_FRAC` | 0.65 / 0.95 | blob speed as a fraction of escape velocity… |
| `EJECTA_VELOCITY_FACTOR` | 0.60 | …then scaled by this (slow, dramatic blobs) |
| `EJECTA_GRAVITY_FACTOR` | 0.18 | fraction of gravity a pyro/cryo blob feels |
| `EJECTA_MAX_RADIUS` | 6.0 | grown blob radius (≈ a Large station) |
| `EJECTA_GROW_STEPS` | 90 | steps to grow to full size (ease-out) |
| `EJECTA_MAX_LIFETIME` | 24000 | blob airtime before it fades |
| `ERUPTION_STAGGER_STEPS` | 300 | max random launch delay (electro spray) |
| `ELECTRO_SPEED` | 1.6 | electro bolt speed (straight, no gravity) |
| `ELECTRO_REACH_MULT` | 3 | electro range = this × planet radius |
| `MAX_EJECTA` | 30 | global active-ejecta cap |

### Eruption sequence & rumble debris
| Constant | Value | Meaning |
|---|---|---|
| `ERUPTION_DURATION_STEPS` | 9000 | gen-0 sequence length (~3.6s); chains scale down |
| `ERUPTION_MINI_MIN_GAP / MAX_GAP` | 26 / 100 | random interval between mini-bursts |
| `ERUPTION_DEBRIS_LIFE` | 840 | cosmetic debris lifetime (steps) |
| `ERUPTION_DEBRIS_GRAV` | 0.167 | fraction of gravity the debris feel (float) |
| `MAX_ERUPTION_DEBRIS` | 600 | global cosmetic-debris cap |
| `BEAM_CHARGE_STEPS` | 5200 | beam precursor build-up before the laser fires (~2s) |
| `BEAM_CALM_STEPS` | 3600 | beam particle calm-down after firing (~1.4s) |

### Other
| Constant | Value | Where |
|---|---|---|
| `UNSTABLE_SIZE_MULT` | 2 | `ScenarioFactory.js` — unstable planet radius multiplier |
| `UNSTABLE_GLOW` | per-type RGB | `Planet.js` — glow/ejecta/debris/beam tint |

---

## 11. File map

| File | Role |
|---|---|
| `src/entities/Planet.js` | unstable `PlanetType`s, `isUnstable`, `UNSTABLE_GLOW`, `crackSeed` |
| `src/entities/Ejecta.js` | the lethal ejecta entity |
| `src/core/GameState.js` | `ejecta`, `eruptions`, `eruptionDebris` pools |
| `src/physics/PhysicsEngine.js` | flags an eruption on bullet impact |
| `src/core/GameLoop.js` | `_triggerEruption`, `_stepEruptions`, `_spawnEjectaWave`, `_spawnEruptionDebris`, `_stepEruptionDebris`, `_stepEjecta`, `_emitEjectaSmoke`, `_applyEjectaToStation`, `_simulateUnstableBeamPath`, the firing gate |
| `src/rendering/Renderer.js` | all the live draw routines (§8) |
| `src/scenarios/scenarioData.js`, `ScenarioFactory.js` | scenarios 39/40, wildcard, 2× sizing |

---

## 12. Status of the wider spec

Implemented: the four subtypes, eruptions (drawn-out pyro/cryo rumble + instant
electro/beam), generation-bounded chains, all particle systems above, scenarios 39/40 +
wildcard, Target Practice eligibility, and rendering.

Not yet done (see `tasks.md` Phase 16): AI awareness (16.10), the design.md force-formula
write-up (16.11), bespoke sound assets (reusing existing SFX for now), and Story-mission
wiring.
