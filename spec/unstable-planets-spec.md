# Unstable Planets — Specification

> Adds a new family of stellar objects — **unstable planets** — that sit inert as ordinary obstacles until struck by a projectile, at which point they violently erupt at the point of contact and unleash a hazard into the battlefield. They turn the terrain itself into a weapon: a well-placed shot into an unstable planet can rain destruction, freeze, shock, or a laser blast onto nearby stations. Four flavours exist — **Pyro**, **Cryo**, **Electro**, and **Beam** — distinguished by colour, idle effect, and the payload they release on impact.

> **Status: Not started.** This is a design spec; no implementation exists yet.

---

## 1. Overview & Motivation

The existing stellar bodies (rocky planets, stars, white dwarfs, black holes, the planned Electrostar/Magnetar) are either passive gravity wells or autonomous hazards. None of them reward the player for *aiming at the terrain*. Unstable planets fill that gap: they are dormant most of the time but become a chaos engine the moment a bullet lands on them, transferring the eruption's effect to whoever is unlucky enough to be near the blast cone — credited to whoever triggered it.

This makes the battlefield interactive in a new way. A skilled player can deliberately ignore a tricky direct line on an enemy and instead lob a shot into an unstable planet sitting beside them, letting the eruption do the work.

Four subtypes share one trigger (a projectile striking the surface) but differ in payload:

| Subtype | Under-crack glow | Idle FX | Eruption payload | Effect on station hit |
|---|---|---|---|---|
| **Pyro** | Glowing **red** | Mini red particle eruptions | 5–7 ballistic, **gravity-affected** ejecta | **Destroys** the station (lethal, like a bullet) |
| **Cryo** | Glowing **white** | White particle eruptions | 5–7 ballistic, **gravity-affected** ejecta | Applies **Frozen** (`frozen += 1`) |
| **Electro** | Glowing **blue-cyan** | Crackling surface electricity | 5–7 **lightning** bolts — straight, **ignores gravity** | Applies **Electrified** (`electrified += 1`) |
| **Beam** | Glowing **yellow** | Faint yellow light glints | **One laser beam** fired perpendicular to the surface | **Destroys** every station along the beam (like the Laser weapon) |

The first three (Pyro / Cryo / Electro) share the **ejecta eruption** model (§4.2–§4.4). **Beam** is the odd one out: instead of a spray of particles it fires a single piercing **laser beam** straight out from the point of impact (§4.6).

---

## 2. The Planet Entity

### 2.1 PlanetType additions

Four new values are added to the `PlanetType` enum (`src/entities/Planet.js`, design.md §3.2.1):

```js
PYRO:    'pyro',     // dormant; erupts ballistic fire ejecta on impact
CRYO:    'cryo',     // dormant; erupts ballistic ice ejecta on impact
ELECTRO: 'electro',  // dormant; erupts lightning on impact
BEAM:    'beam',     // dormant; fires a perpendicular laser beam on impact
```

A convenience predicate is added: `Planet.isUnstable(type)` → `true` for the four subtypes.

### 2.2 Gravity, mass and collision

Unstable planets are **ordinary planets in every passive respect**. They:

- Carry `radius` and `density` and therefore `mass = radius² × density`, exactly like a `ROCKY` planet of the same size.
- Exert normal gravity on all bullets/rockets/ejecta (§4.3 of design.md). Their gravity is what gives the ejecta a real **escape velocity** (§4.2) and lets the erupted particles arc back down.
- **Block and destroy** an incoming primary projectile on impact (`bullet.status = EXPLODING`), identical to `ROCKY` in the §4.4 collision table — *and additionally* trigger an eruption (§4).

> They are deliberately indistinguishable from a normal rocky planet in terms of trajectory bending, so players can use them as cover or sling-shots as usual. The eruption is the only added behaviour.

### 2.3 Sizing

Same size distribution as rocky planets in a scenario. No special size rules. A larger unstable planet has a higher escape velocity, so its ejecta stay closer to the surface and the eruption is more contained; a smaller one throws ejecta further. This emerges naturally from the physics — no special-casing.

---

## 3. Appearance (Idle State)

The intent is stated plainly in the design brief: **the player should be in no doubt that something unusual is at play.** An unstable planet never looks like an ordinary rock.

### 3.1 Cracked surface

- The planet body is drawn with a **fractured crust** — a network of dark cracks across the surface.
- **Beneath the cracks**, an inner glow shows through in the subtype colour:
  - Pyro → glowing **red** (molten/lava look)
  - Cryo → glowing **white** (super-cooled, frost-bright)
  - Electro → glowing **blue-cyan** (charged plasma)
  - Beam → glowing **yellow** (focused light, about to lase)
- The glow **pulses** slowly so the surface looks alive and pressurised. The crack pattern itself is static per planet instance (generated once at spawn from the planet's seed) so it does not shimmer distractingly.

### 3.2 Idle particle emission

Each subtype continuously emits a low-rate cosmetic particle effect from its surface. These are **purely visual** — they apply no effect and are not the eruption ejecta:

| Subtype | Idle emission |
|---|---|
| **Pyro** | Frequent **mini red particle eruptions** — small puffs/sparks that pop from random surface points and fall back or fade quickly |
| **Cryo** | Small **white eruptions** — wisps of frost/vapour drifting off the surface |
| **Electro** | **Crackling electricity** — short arcs skittering across the cracked surface between crack nodes |
| **Beam** | **Faint yellow light glints** — occasional brief lens-flare/sparkle along the cracks, hinting at building focused energy |

- Idle particles spawn from random points on the surface at a low, steady rate (a few per second), capped low so dormant unstable planets cost almost nothing to render.
- They are drawn on the effects layer (Layer 2) and never interact with gameplay.

### 3.3 Rendering location

- Surface/crack/glow drawing lives in `src/rendering/PlanetRenderer.js` alongside the other planet draw routines.
- Idle particles and eruption VFX live in `src/rendering/Renderer.js` (the effects pipeline), following the precedent of fireballs and star-surface particles.

---

## 4. The Eruption

This is the entire point of the feature. **Most of the time the planet does nothing.** When a qualifying projectile strikes the surface, the planet erupts.

### 4.1 Trigger

- **Trigger event:** a *primary projectile* (a `Bullet` or `Rocket`) collides with an unstable planet's surface (`rSquared < planet.radius²`, the same test as any planet impact).
- On trigger:
  1. The incoming projectile resolves its impact **exactly as it would against a rocky planet** — it explodes and is consumed. (The eruption is *in addition to*, not instead of, the normal impact.)
  2. An eruption is spawned at the **point of contact** (§4.2). For Pyro / Cryo / Electro this is an ejecta spray (§4.3–§4.5); for **Beam** it is a single laser emission (§4.6).
- **Chain reactions are allowed — with one hard rule.** An eruption payload (an ejecta particle, or a Beam laser) **can** trigger a fresh eruption on **another** unstable planet it strikes. It can **never** trigger an eruption on the **planet it was erupted from** — otherwise that planet's own particles would re-light it forever. Each payload therefore carries a `sourcePlanet` reference; on impact with an unstable planet:
  - **same planet as `sourcePlanet`** → consumed, no eruption (prevents the infinite self-loop);
  - **a different unstable planet** → that planet erupts at **generation + 1** (see below), and the payload is consumed exactly as a primary projectile would be.
- **Owner propagates through the chain.** A chained eruption inherits the `owner` of the payload that set it off, so every kill or condition anywhere down the chain is still credited to the **original** player whose shot started it (§5.2). The newly spawned payloads carry the same `owner` and a fresh `sourcePlanet` (the planet they just erupted from).
- **Generations cap the cascade (instead of a cooldown).** Every eruption and payload carries a **generation**:
  - **Gen 0** — bullet/rocket-triggered: the **full** eruption (drawn-out pyro/cryo sequence, 5–7 electro bolts, full beam).
  - **Gen 1** — triggered by a gen-0 payload: a **small** eruption — an instant burst of **2–3** ejecta/bolts (or a single beam).
  - **Gen 2+** — triggered by a gen-1 payload: **visual only** — a flash and cosmetic debris, **no payload**. The cascade terminates here because gen-2 produces nothing further.
- **No cooldown — every impact triggers.** There is intentionally no per-planet re-eruption cooldown, so a multi-hit weapon (Triple Cannon, scatter) **triple-triggers** — each bullet that lands sets off its own full gen-0 eruption. Run-away is prevented by the generation cap above (depth ≤ 2), the global `MAX_EJECTA` cap, and finite ejecta lifetime — not by rate-limiting.

### 4.2 Point of contact & surface normal

- **Contact point** `c` = the projectile's position at the moment `rSquared < radius²` first holds (it is already just inside the surface; clamp it back to the surface radius for a clean origin).
- **Surface normal** `n` = `normalise(c − planet.position)` — points radially outward from the planet centre through the contact point. The eruption fires *away* from the surface along this normal, with random spread.

### 4.3 Ejecta spawn (Pyro / Cryo / Electro)

On eruption, spawn **5–7 ejecta particles** (random count per eruption). Each particle:

- **Origin:** the contact point `c` (with a tiny random jitter along the surface so they don't all start from one pixel).
- **Direction:** the surface normal `n`, rotated by a random offset `±SPREAD` (tunable, ≈ ±25°). This is the "approximately perpendicular to the surface" spray.
- **Speed:** a random fraction of the planet's **escape velocity**:
  ```
  vEsc  = sqrt(2 * G * planet.mass / planet.radius)
  speed = vEsc * random(EJECTA_MIN_FRAC, EJECTA_MAX_FRAC)   // e.g. 0.55–0.90
  ```
  Speed is **below escape velocity** by design, so gravity-affected ejecta arc up and fall back rather than flying off forever — reinforcing the "eruption" read.
- **Initiation delay:** each particle is staggered by a small random delay (`0 … ERUPTION_STAGGER`, tunable ≈ 180 ms) before it launches. The particles do not all leave at once — they spit out raggedly, which sells the violent-eruption impression.
- **Owner / instigator:** `ejecta.owner = triggeringProjectile.owner` (or, for a chained eruption, the `owner` of the payload that set it off — see §4.1). This is who gets credit for any kill or condition the ejecta inflicts (§5), no matter how many planets down the chain it happens. This is the mechanism by which "well-placed shots cause harm to others."
- **Source planet:** `ejecta.sourcePlanet` = the planet erupting it. Used to enforce the no-self-retrigger rule (§4.1): this ejecta can erupt other unstable planets but never its own source.

The exact count, per-particle angle, per-particle speed, and per-particle delay are **all independently randomised within their ranges** so no two eruptions look identical.

### 4.4 Ejecta flight

| | Pyro / Cryo | Electro |
|---|---|---|
| **Motion** | Ballistic point particle | **Lightning bolt** — travels in a straight line from the surface |
| **Gravity** | **Affected** by all planets' gravity (same inverse-square step as fireballs, applied per rAF frame — design.md §"Fireballs") | **Ignores gravity entirely** — flies dead straight along its launch direction |
| **Range / lifetime** | Lives until it hits a station, leaves world bounds by > 150 units, or exceeds `EJECTA_MAX_LIFETIME`; then removed | Short range — reaches out to `ELECTRO_REACH` (tunable, e.g. 3× planet radius like the Electrostar arc) then dissipates |
| **Planet collision** | Consumed on contact with any planet. **Pyro** ejecta **shatter asteroids** they strike — fragmenting them exactly as a bullet impact would (the fragmentation/Crystal/Rich-asteroid rules in requirements §6 still apply, credited to `ejecta.owner`). Against ordinary solid planet types pyro is absorbed silently; cryo is always absorbed silently. **Striking an unstable planet** that is **not** the ejecta's `sourcePlanet` triggers a fresh eruption there (§4.1); striking its own `sourcePlanet` is silently absorbed. | Consumed on contact with any planet (same unstable-planet chain rule applies) |

- **Pyro asteroid fragmentation:** when a pyro ejecta hits an asteroid, run the standard asteroid-destruction path (spawn child fragments; honour Crystal pass-through and Rich/Pure collectable drops) and consume the ejecta. The resulting child fragments are normal asteroids — they do **not** become unstable, and the secondary debris cannot itself re-trigger anything. This is the only case where an ejecta affects terrain; cryo/electro have no terrain effect.
- **Global ejecta cap:** active ejecta are capped globally (`MAX_EJECTA`, ≈ 30, mirroring the 20-fireball cap) to keep particle counts bounded during chaotic multi-eruption turns. If the cap is reached, additional ejecta from a new eruption are dropped.
- Ejecta are tracked in a `gameState.ejecta` array and integrated by `PhysicsEngine` after the main bullet step, in their own pass (so they keep moving and resolving even between turns, like other in-flight effects).

### 4.5 Visual character of the eruption

- **Pyro:** slow, swelling red/orange **blobs** — each grows fast then eases to roughly a Large station's size — trailing short-lived red smoke puffs (the same puff system comets use). The eruption flash at the contact point is bright red-white.
- **Cryo:** the same swelling-blob behaviour in pale blue-white, trailing frosty smoke puffs. Contact flash is cold white.
- Pyro/Cryo ejecta launch at only ~30% of the usual speed and feel ~20% of gravity, so they move slowly and arc dramatically; the grown blob radius counts for collisions (a blob that engulfs a station hits it), but the **source** planet only re-absorbs a blob when its *centre* falls back inside, so a growing blob isn't eaten by its own surface.
- **Electro:** **branching lightning bolts** radiating from the contact point — short, jagged, redrawn each frame with randomised branch points for a crackling look (the same rendering approach planned for the Electrostar arcs, §12.11 of tasks.md), in blue-cyan/white.
- **Beam:** a bright **yellow laser beam** (§4.6) — rendered via the existing `LaserVFX`, tinted yellow rather than a team colour.

Each eruption fires a **sound hook** at the contact point, one per subtype (eruption roar / ice shatter / electric zap / laser fire). This spec only requires the hook call sites; the actual audio assets and mixing are owned by the sound spec (tasks.md §15.1).

### 4.6 Beam eruption (Beam type)

The Beam planet does **not** spawn ejecta. On trigger it fires a single piercing **laser beam** outward from the point of contact, reusing the existing Laser-weapon machinery (design.md §14.2) wholesale:

- **Origin:** the contact point `c` (§4.2), nudged just outside the surface so the beam starts in clear space.
- **Direction:** the **surface normal** `n` — the beam fires *perpendicular to the surface* at the strike point. A tiny random jitter (≈ ±2°) is allowed so repeated triggers don't look mechanically identical, but it is essentially radial.
- **Simulation:** run the standard laser path simulation — initial speed `200 × maxCannonSpeed`, gravity factor `1.0` (so the beam visibly bends near heavy bodies), terminating on boundary or `MAX_LASER_STEPS`. Along the path it:
  - **destroys every station** it crosses (simulation continues past each — it is piercing),
  - **shatters asteroids/crystals** it crosses (continues past),
  - **reflects** off Force Shields,
  - is **absorbed** (terminates) by ordinary non-destructible planets, and
  - on crossing **another unstable planet** (not its own `sourcePlanet`), **triggers a fresh eruption** there and terminates (absorbed). It never re-triggers its own source planet (geometrically it fires outward, but the rule is enforced regardless).
- **Attribution:** every kill credits `beam.owner` — the original instigator, propagated if the beam was itself set off by a chained eruption (§4.1), exactly as the Laser weapon credits `laser.owner`.
- **Rendering:** the committed path is added as a `LaserVFX` (wide team-coloured glow + narrow white core, fading over ~1.5 s) — but tinted **yellow** to match the planet, so it reads as the planet's beam rather than a player's shot.
- **No firing delay queue:** unlike the player Laser (which uses `pendingLaser`/`delaySteps` for staggered firing), the Beam planet fires its beam **immediately** on impact. There is no cooldown, so a multi-bullet weapon fires one beam per bullet that lands (bounded by the generation cap, §4.1).

Because the beam is instantaneous and pierces, a Beam planet is the most *surgical* of the four — a player who lines up a shot so the planet's outward normal points down a row of enemies can wipe several at once.

---

## 5. Effect on Stations

When an ejecta particle (or, for Beam, the laser path) reaches a station (`distance < station hit radius`):

| Payload | Effect | Mirrors |
|---|---|---|
| **Pyro** | Station is **destroyed** — `status = EXPLODING`, killed exactly as by a direct bullet hit | Bullet → station impact (§4.4 design.md) |
| **Cryo** | Station receives `frozen += 1` (capped at 3) and a `ConditionNotifyVFX` floating label | Comet freeze (frozen-condition-spec.md §3) |
| **Electro** | Station receives `electrified += 1` (capped at 3) and a `ConditionNotifyVFX` floating label | Electrostar arc / shock weapons (tasks.md §12.10) |
| **Beam** | **Every station** crossed by the beam is **destroyed** (piercing) | Laser weapon (design.md §14.2) |

### 5.1 Defensive interactions

All payloads respect the existing defensive layers, resolved in this order — consistent with how comets, shock weapons, and the Laser already behave:

1. **Team Shield** — if the station's team shield is up, the hit is blocked. Ejecta are consumed; the **Beam reflects** off the shield boundary and continues (matching the Laser weapon's shield interaction, design.md §14.2).
2. **Armour** — if `armourLayers > 0`, one armour layer is consumed and **no** effect is applied (no destroy, no freeze, no shock). The ejecta is consumed; the Beam continues past (one armour layer spent per protected station it crosses).
3. **Unprotected** — the effect from the table above applies.

### 5.2 Attribution

- **A kill by any eruption payload counts as a kill for the owner of the projectile that initiated the eruption.** A **Pyro** or **Beam** kill is credited to `ejecta.owner` / `beam.owner` — the player whose shot triggered the eruption — with the appropriate kill-type stat (treated as a normal kill for scoring; the instigator is the killer). Through a chain reaction (§4.1) the `owner` propagates, so even a kill several planets removed is still credited to that original player. Self-harm is possible: if your own eruption hits one of your stations, it counts as a normal own-goal exactly as a self-inflicted bullet would.
- A **Cryo/Electro** condition is applied to the target station in the **target's** team colour for the `ConditionNotifyVFX` label (per new-weapons-spec.md §18), but the *instigator* for any scoring purposes is `ejecta.owner`.

### 5.3 Frozen vs Electrified precedence

Unchanged from frozen-condition-spec.md §7.1 — frozen supersedes electrified behaviourally. A Cryo eruption that freezes a station already carrying electrified follows the existing precedence rules.

---

## 6. Scenarios & Spawning

Two new named scenarios are added, following the numbering convention in `src/scenarios/scenarioData.js` (current `SCENARIO_COUNT = 38`, so these become **39** and **40** and `SCENARIO_COUNT` is bumped accordingly). Each has a 10% **extreme** variant per the requirements §6.4 mechanism. Both are registered in the scenario table in `requirements.md` and in `scenarioData.js`, and added to the extreme-eligible list.

**Lucky Dip rarity:** both scenarios are **rare** — reachable only in the rarest (any) band of `weightedRandomId`. They are placed in the `> 88` index range (i.e. above 32), so they are never selected by the common (`< 25`) or uncommon (`< 88`) bands. Bumping `SCENARIO_COUNT` to 40 already achieves this for the `else → any` branch; no change to the common/uncommon ranges. They remain fully available via manual scenario selection.

### 6.1 Scenario 39 — Unstable Planet

A single dominant unstable planet plus a field of small bodies:

- **One large unstable planet**, type chosen at random (Pyro / Cryo / Electro / Beam, equal weight).
  - **70%** of games: placed approximately at the **centre** of the map (small random jitter so it isn't pixel-exact).
  - **30%** of games: placed at a **random position** anywhere on the map (normal placement rules — at least partly on screen, no overlap).
- **5–9 moons or asteroids** (random count) scattered randomly across the map as filler. These are ordinary small bodies — not unstable.

**Extreme variant (10%):** add a **second large unstable planet** (type rolled independently). The two unstable planets must not be placed too close together — enforce a **minimum centre-to-centre separation** so they sit in distinct regions of the map and their eruptions are independent threats. (Suggested floor ≈ the larger of `0.4 × world width` or `sum of the two radii × 3`; tune for readability. If a valid separated position can't be found within the retry budget, fall back to a single unstable planet rather than placing them touching.)

### 6.2 Scenario 40 — Unstable System

A crowded field of many smaller unstable planets:

- **3–12 smaller unstable planets** (random count), each an independently rolled type (Pyro / Cryo / Electro / Beam). Sizes in the small-to-medium range (no single dominant body).
- **2–6 moons** (random count) scattered as filler.
- This is deliberately chaotic — a battlefield where almost any errant shot sets *something* off.

**Extreme variant (10%):** **double the number of unstable planets** — i.e. **6–24** smaller unstable planets (still 2–6 moons). Subject to the normal placement constraints (no overlap, minimum free play area per requirements §6.2); discs that won't fit after the retry budget are dropped, trimming the body count on crowded fields — same approach as the Giant Wormhole Network scenario.

### 6.3 Wildcard pool

Add an **unstable planet** to the **wildcard planet pool** (the random bonus stellar-object injection, requirements §6.1). When a wildcard object is rolled, it may be an unstable planet of a **randomly chosen type** (Pyro / Cryo / Electro / Beam). A single unstable planet dropped into an otherwise ordinary scenario is a nasty surprise.

### 6.4 Spawn placement

- Unstable planets are placed by the normal planet-placement routine (no overlap with stations or other planets, minimum free play area honoured), so there is no special spawn logic beyond adding the types to the generator — except the inter-unstable separation rule in the Unstable Planet extreme variant (§6.1).
- They are present from the **start** of the scenario (unlike collectables, which spawn at turn-end). They are terrain, not pickups.

---

## 7. AI Awareness

- **RandBot / AimBot / SimBot / CleverBot:** treat unstable planets as ordinary obstacles. They do not deliberately target them and do not model the eruption. (They can still trigger eruptions accidentally, which is fine for chaos.)
- **SuperBot / MegaBot:** *opportunistic eruption targeting* — when evaluating shots, factor in that a shot landing on an unstable planet near an enemy can damage/disable that enemy. This reuses the same idea as their opportunistic collectable targeting (futureDesignThoughts.md, Special Weapons §4): a candidate shot that strikes an unstable planet within blast range of an enemy gets a scoring bonus. They should avoid triggering eruptions adjacent to their **own** stations.
- This AI layer is **lower priority** than the core mechanic and may ship in a second pass (see Tasks §16.9).

---

## 8. New / Modified Files

| File | Change |
|---|---|
| `src/entities/Planet.js` | Add `PYRO` / `CRYO` / `ELECTRO` / `BEAM` to `PlanetType`; add `isUnstable()` |
| `src/entities/Ejecta.js` | **New** entity: position, velocity, `kind` (pyro/cryo/electro), `owner`, `sourcePlanet`, launch delay, lifetime |
| `src/core/GameState.js` | Track `ejecta: Ejecta[]`; pending-eruption queue for staggered launches |
| `src/physics/PhysicsEngine.js` | Detect primary-projectile impact on unstable planet → spawn eruption; integrate ejecta (gravity for pyro/cryo, straight for electro); ejecta↔station collision + shield/armour resolution + attribution; ejecta↔planet consumption; **Beam** — run the laser path simulation along the surface normal and emit a `LaserVFX` (reuse design.md §14.2 machinery) |
| `src/rendering/PlanetRenderer.js` | Cracked-surface + under-crack glow draw for the four subtypes (incl. yellow Beam) |
| `src/rendering/Renderer.js` | Idle FX (red/white eruptions, electric crackle, yellow Beam glints); eruption flash; pyro/cryo ejecta trails + smoke; electro lightning; Beam laser via yellow-tinted `LaserVFX` |
| `src/scenarios/scenarioData.js` | Add Unstable Planet (39) + Unstable System (40) scenarios; bump `SCENARIO_COUNT`; add to extreme-eligible list; add both to `TARGET_PRACTICE_SCENARIOS`; add unstable planet (random type, incl. Beam) to wildcard pool |
| `src/audio/SoundManager.js` | Eruption SFX hooks (roar / shatter / zap / laser) — call sites only; assets per sound spec |
| `src/story/StoryMissions.js` | Make unstable planets / scenarios available to Story missions |
| `src/scenarios/ScenarioFactory.js` | Generate the two new scenarios (incl. extreme variants and inter-unstable separation) / wildcard injection |
| `src/ai/SuperBot.js`, `src/ai/MegaBot.js` | (Phase 2) opportunistic eruption targeting |
| `spec/requirements.md` | Add Unstable Planet (39) + Unstable System (40) to the scenario table and the extreme-variant list (§6.4) |
| `spec/design.md` | Document the eruption force formula and the `PlanetType` additions |

---

## 9. Tunable Constants

| Constant | Purpose | Suggested start |
|---|---|---|
| `EJECTA_COUNT_MIN / MAX` | Particles per eruption | 5 / 7 |
| `EJECTA_SPREAD` | Max angular offset from surface normal | ≈ ±25° |
| `EJECTA_MIN_FRAC / MAX_FRAC` | Ejecta speed as fraction of escape velocity | 0.65 / 0.95 |
| `EJECTA_VELOCITY_FACTOR` | Slow-down on launch speed (pyro/cryo) → dramatic blobs | 0.60 |
| `EJECTA_GRAVITY_FACTOR` | Fraction of gravity felt by pyro/cryo ejecta (floaty arcs; ~v²/g range means low gravity restores reach) | 0.18 |
| `EJECTA_MAX_LIFETIME` | Steps a ballistic blob lives — slow blobs need airtime to travel their range | 24000 |
| `ERUPTION_DURATION_STEPS` | Length of the drawn-out pyro/cryo eruption sequence (~2.6s) | 6500 |
| `ERUPTION_MINI_MIN/MAX_GAP` | Random interval between escalating cosmetic mini-bursts | 26 / 100 |
| `ERUPTION_DEBRIS_LIFE` / `_GRAV` | Cosmetic debris lifetime (steps) / gravity felt (more than the blobs) | 210 / 0.5 |
| `EJECTA_MAX_RADIUS` | Grown blob size — ejecta swell fast then ease to ≈ a Large station | 6.0 |
| `EJECTA_GROW_STEPS` | Steps to reach full blob size (ease-out) | 90 |
| `ERUPTION_STAGGER` | Max random launch delay per particle | ≈ 180 ms |
| `EJECTA_MAX_LIFETIME` | Ballistic ejecta max airtime before fade | tune |
| `ELECTRO_REACH` | Lightning bolt range | ≈ 3× planet radius |
| `MAX_EJECTA` | Global active-ejecta cap | ≈ 30 |

All values are tuned empirically so the eruption is "strong enough to be visibly interesting but not so strong it makes the game unplayable" (the tuning maxim used for the Magnetar field, tasks.md §12.15).

---

## 10. Resolved Decisions

| Question | Decision |
|---|---|
| Subtypes | Four: Pyro (red), Cryo (white), Electro (blue-cyan), Beam (yellow) |
| Beam payload | Single piercing laser beam fired perpendicular to the surface; reuses the Laser-weapon simulation/VFX (tinted yellow); destroys every station along the path |
| Passive behaviour | Behave as a normal rocky planet (gravity + obstacle) until struck |
| Trigger | Every bullet/rocket impact triggers a full eruption (no cooldown — multi-hit weapons multi-trigger). Payloads chain-trigger **other** unstable planets but never their own source; cascades are bounded by a **generation cap** (gen 0 full → gen 1 small → gen 2 visual-only) plus ejecta lifetime + global cap |
| Chain attribution | `owner` propagates down the chain — every kill/condition credits the original initiating player |
| Planet persistence | Persists and can re-erupt on every impact — not destroyed |
| Ejecta count | 5–7, randomised per eruption |
| Ejecta direction | Surface normal ±25°, randomised per particle |
| Ejecta speed | Below escape velocity (random fraction), so they fall back |
| Stagger | Per-particle random launch delay for the eruption feel |
| Pyro/Cryo gravity | Affected by gravity (ballistic) |
| Electro behaviour | Lightning — straight line, ignores gravity, short range |
| Effects | Pyro destroys; Cryo freezes (`frozen += 1`); Electro shocks (`electrified += 1`) |
| Defensive order | Shield blocks → armour absorbs one layer → else effect applies |
| Attribution | Credited to the owner of the triggering projectile |
| Cascade control | Generation cap (gen 0 full → gen 1 = 2–3 → gen 2+ visual-only), not a cooldown |
| Pyro lethality | Direct hit only — no splash radius |
| Ejecta vs terrain | Pyro ejecta **fragment asteroids** they strike (as a bullet would); cryo/electro have no terrain effect |
| Lucky Dip rarity | Both scenarios rare — any-band only (index > 88); manual selection always available |
| Sound | Per-subtype SFX (eruption roar / ice shatter / electric zap) — trigger **hooks added here**, asset selection owned by the sound spec |
| Mode eligibility | Eligible in **both** Target Practice and Story mode (add 39 + 40 to `TARGET_PRACTICE_SCENARIOS`; available to Story missions) |
| Spawning | Wildcard pool (random-type unstable planet) + two scenarios — **Unstable Planet** (39) and **Unstable System** (40), each with a 10% extreme variant; present from game start |

---

## 11. Open Questions

*None outstanding — all resolved (see §10).* Sound asset selection itself is owned by the sound spec; this spec only requires the trigger hooks to exist.
