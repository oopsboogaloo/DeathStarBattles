# Forked Lightning Effect — Specification

> A reusable, stateful **forked-lightning** effect: a branching electric bolt that grows
> out from an origin with a characteristic stutter, electrifies anything it touches, then
> holds and fades. It currently powers the **Electro unstable planet** (see
> `unstable-planets-implementation.md` §4.5), but it is written to be **lifted into any
> other electric-shock effect** in the game. This spec captures the algorithm and the
> seams to parametrise for reuse.

---

## 1. Overview

A **strike** is a growing tree of straight **segments**. It starts at an origin point,
heading in a launch direction, and grows one segment at a time along randomly-turning
**path heads** that **fork** into new branches and occasionally **die off**, until a
segment budget is spent or every head has terminated. It then **holds** briefly and
**fades** out. As segments are laid they apply an effect (electrify / shock) to anything
they cross, stop at solid planets, and can chain to other emitters.

Two qualities make it read as lightning:
1. **Branching** — a lone path forks aggressively; multiple paths thin out (§4).
2. **Stutter** — the growth rate varies frame-to-frame: it sometimes halts, sometimes
   leaps ahead (§3).

It is grown **per rendered frame** (not per physics sub-step), so its pace is wall-clock
based and fast, independent of game speed.

---

## 2. Data model

A strike object (currently an entry in `gs.lightning`):

```
// identity / effect
owner            // who is credited for the shock (a Station, or null)
generation       // chain depth (0 = primary); used to scale + bound chains
chain            // generation > 0 — the fire phase need not wait for these
r, g, b          // bolt colour (Electro blue-cyan today)
sourcePlanet     // the emitter, exempt from self-collision at launch (optional)

// geometry
segments[]       // { x1, y1, x2, y2 } — every placed segment (drawn each frame)
heads[]          // active growing path heads: { x, y, angle, dead }
total            // segments placed so far
maxSegments      // segment budget (strike stops when reached)

// lifecycle
phase            // 'growing' | 'hold' | 'fading'
holdT            // frames elapsed in the hold phase
alpha            // 1 → 0 over the fade

// de-dupe (apply each effect/target once)
hitStations      // Set<Station> already shocked
hitPlanets       // Set<Planet> already chained
```

A **head** is one growing branch tip (`x, y` position, `angle` heading, `dead` flag).
A **segment** is one drawn line.

---

## 3. Lifecycle & stutter

Stepped once per frame (`_stepLightning`):

- **growing** — advance the strike by a random **0–3 growth rounds** this frame
  (`Math.floor(rng()*4)`). 0 rounds = a brief halt; 3 = a fast jump. Each round runs the
  growth pass (§4) once. This is the lightning **stutter**.
- **hold** — once growth ends, hold for `LIGHTNING_HOLD_FRAMES` (~1s) at full brightness.
- **fading** — reduce `alpha` by `1/LIGHTNING_FADE_FRAMES` per frame; remove the strike at
  `alpha ≤ 0`.

Growth ends (→ hold) when `total ≥ maxSegments` **or** every head is dead.

---

## 4. Growth pass (one round) — `_growLightningRound`

For each non-dead head (snapshot `single = heads.length === 1` once per round):

1. **Turn** the heading by a random `±LIGHTNING_MAX_ANGLE` (±30°).
2. **Extend** one segment of length `LIGHTNING_SEG_LEN × (0.8–1.2)` (~a station width) from
   the head; push the segment; `total++`.
3. **Collision / effect** (§5): if the segment hits a planet, clip the segment to the
   planet surface and **kill the head** (the bolt grounds). If it leaves the world bounds
   (±35% past the edge), kill the head.
4. **Branch dynamics** (only if the head survived):
   - **Single path** (`single`): **`LIGHTNING_FORK_CHANCE` (30%)** chance to **fork** — add
     a new head at the current point with a wider offset angle (`±(maxAngle + rand·maxAngle)`).
   - **Multiple paths**: a general **`LIGHTNING_FORK_MULTI` (10%)** fork keeps it busy, and
     each path has a **`LIGHTNING_END_CHANCE` (5%)** chance to **end** this segment.
   - Forking is capped at `LIGHTNING_MAX_HEADS` (10) live heads.

Net behaviour: the strike oscillates between a lone channel (forking out) and a branched
one (a few live branches that keep sprouting and dying), producing a detailed bolt with
many branch stubs even though only a handful are ever live at once.

---

## 5. Collisions & effects — `_lightningHitCheck`

Per placed segment (`A→B`), using a segment-vs-circle test (`_segHitsCircle`):

- **Stations** — for each active station the segment comes within `station.radius` of
  (once per station via `hitStations`): **apply the shock** unless a **team shield**
  covers it (shield blocks). The shock today is `_applyBeamCondition(station,
  'electrified', 1)` which **armour absorbs** (one layer) else `electrified += 1` + a
  condition-notify label.
- **Planets** — the first planet the segment reaches **stops the branch** (returns the
  blocker; the caller clips the segment to its surface). **Gas giants are passed through.**
  The **source** emitter is exempt only on the launch segment (`total ≤ 1`). A *different*
  **unstable planet** also **chain-triggers** its own eruption at `generation + 1` (once
  per planet via `hitPlanets`).

`_clipSegToCircle` returns the first point the segment reaches the circle, so the bolt
terminates exactly on the surface.

---

## 6. Rendering — `Renderer._drawLightning`

Two stroked passes over **all** segments, scaled to screen (`× conv`), with `lineCap:
'round'`, both multiplied by the strike `alpha` (carries hold/fade):

1. **Glow** — colour `(r,g,b)` at ~0.45·alpha, wide (`~conv·1.0`).
2. **Core** — white at ~0.9·alpha, thin (`~conv·0.4`).

Drawn live in `_drawLive` (under the camera transform), after the planet/ejecta layers.

---

## 7. Integration

- **Stepping:** once per frame in the firing loops (`_advanceFiring`, `_advanceTPFiring`),
  alongside the eruption/ejecta updates.
- **Fire-phase gate:** the phase waits for any **primary** (`chain === false`) strike to
  finish grow→hold→fade; chain strikes are not waited on. All strikes are cleared when the
  phase ends and reset at phase start.
- **Generations (chain bounding):** a strike triggered by another effect passes
  `generation + 1`; gen-0 uses the full budget (`LIGHTNING_MAX_SEGMENTS`), gen-1 a smaller
  one (~12), gen-2+ is suppressed to visual-only by the caller — so cascades terminate.
- **Sound:** play a zap on creation (Electro uses `laser` with `pitch: +0.3`). For a
  sustained effect, use `SoundManager.playHandle()` and stop it when the strike ends so it
  can't outlive the bolt.

---

## 8. Tunable parameters (current values)

All in `src/core/GameLoop.js`.

| Constant | Value | Meaning |
|---|---|---|
| `LIGHTNING_SEG_LEN` | 11 | segment length (~a station width) |
| `LIGHTNING_MAX_ANGLE` | 30 | ± degrees a segment may turn from the previous |
| `LIGHTNING_FORK_CHANCE` | 0.30 | fork chance per segment while a single path |
| `LIGHTNING_FORK_MULTI` | 0.10 | fork chance per segment while multiple paths |
| `LIGHTNING_END_CHANCE` | 0.05 | per-path end chance per segment while multiple paths |
| `LIGHTNING_MAX_SEGMENTS` | 30 | total segment budget (gen-0; gen-1 ≈ 12) |
| `LIGHTNING_MAX_HEADS` | 10 | cap on simultaneous live paths |
| `LIGHTNING_HOLD_FRAMES` | 60 | hold (~1s) after growth |
| `LIGHTNING_FADE_FRAMES` | 14 | quick fade-out |
| growth rounds/frame | 0–3 | `Math.floor(rng()*4)` — the stutter |

---

## 9. Reuse guide — generalising to other electric shocks

The effect is currently coupled to the Electro unstable planet only through a few inputs.
To reuse it elsewhere (shock weapons, Electrostar, electro-stun, civilised-world electric
events, etc.), factor a small **`spawnLightning({...})`** helper and parametrise:

| Input | Electro planet today | What to vary for reuse |
|---|---|---|
| **origin** `(ox, oy)` | the contact point on the planet surface | the muzzle / impact / emitter point |
| **launch angle** | the surface normal | aim direction, or toward a target |
| **owner** | the triggering station | the firer (for shock attribution) |
| **colour** | Electro blue-cyan | per-source tint |
| **maxSegments** | 30 (gen-scaled) | range/size of the shock |
| **on-station effect** | `electrified += 1` | could be any condition/damage callback |
| **chains?** | yes (unstable planets) | usually **off** for a weapon shock |
| **sourcePlanet** | the emitter (self-collision exemption) | optional; omit for a free strike |
| **gate `chain` flag** | primary waits, chains don't | match the host system's turn flow |

**Reuse helper:** `GameLoop._spawnLightning({ ox, oy, angle, owner, colour, maxSegments,
shockAmount, noChain, chain, generation, sourcePlanet })` creates one strike with these
inputs — used by both the Electro planet and the Shock Rocket.

**Candidate reuse sites:**
- ✅ **Shock Rocket** — now bursts into `SHOCK_BOLT_COUNT` (11) forked bolts radiating from
  the detonation (`_spawnShockBurst`), each applying `shockAmount` and `noChain: true`,
  replacing the old expanding shock zone + explosion. Because the rocket usually detonates
  on/inside the planet it struck, `_spawnShockBurst` detects a host planet containing the
  burst point and starts each bolt just outside that planet's surface along its own outward
  heading — otherwise every bolt would lay its first segment inside the planet and ground
  out immediately.
- The other **shock weapons** (Shock Beam, electro-stun) — replace their straight-beam /
  zone VFX with a forked strike toward the target.
- The planned **Electrostar** stellar body (its arc-lightning mechanic).
- Any future **electric hazard** or condition-application visual.

**To extract:** move the strike object + `_stepLightning` / `_growLightningRound` /
`_lightningHitCheck` / `_segHitsCircle` / `_clipSegToCircle` / `_drawLightning` into a
shared module (e.g. `src/effects/Lightning.js`), keyed off a generic `gs.lightning` pool,
with the per-use inputs in the table above passed at creation. The on-hit effect becomes a
callback so non-electric variants (e.g. a different condition) are possible too.

> **Status:** implemented for the Electro unstable planet and the Shock Rocket via the
> shared `_spawnLightning` helper (still in `GameLoop`, not yet a standalone module). A
> generic on-hit callback (instead of the hardcoded electrified application) would let
> non-electric variants reuse it too.
