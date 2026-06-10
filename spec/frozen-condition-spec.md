# Frozen Condition — Specification

> Covers the frozen status condition applied to stations by comet impact, including stack behaviour, aiming/firing rules, VFX, interactions with other conditions, and edge cases.

---

## 1. Overview

The **frozen** condition immobilises a station for one or more turns. A frozen station cannot aim, fire, or move — its crew is locked in ice. The condition is applied by comets and stacks up to three layers deep (single → double → triple frozen). Each turn thaws one layer.

---

## 2. Station Property

A new integer field `frozen` is added to `Station`, initialised to `0`.

- Valid range: `0–3` (capped; cannot exceed triple frozen)
- `0` = not frozen (normal operation)
- `1` = frozen (one turn of immobility)
- `2` = double frozen
- `3` = triple frozen

`frozen` is distinct from `StationStatus`. A frozen station retains status `ACTIVE` and is fully visible, targetable, and destructible.

---

## 3. Comet Collision

When a comet makes contact with a station:

- The comet is **destroyed** (same as current behaviour against bullets)
- The station receives `frozen += 1`, capped at 3
- The comet does **not** pass through — it is consumed on impact regardless of the station's current freeze depth

This replaces the previous behaviour where comets destroyed stations on contact.

---

## 4. Aiming Phase

When it is a frozen station's turn to aim:

- All angle and power input is **disabled** — keyboard shortcuts (Z/X/A/S/K/M/J/N), mouse aim, and slider controls have no effect
- The HUD Angle/Power display is replaced with a centred status label in the station's team colour:
  - `frozen = 1` → `FROZEN`
  - `frozen = 2` → `DOUBLE FROZEN`
  - `frozen = 3` → `TRIPLE FROZEN`
- The **End Turn** button remains active; the Hyperspace button is disabled
- **Human players** see the frozen HUD and can only confirm the turn
- **AI stations** skip their action computation and end their turn immediately (no simulation, no targeting)

---

## 5. Fire Phase

When a frozen station's turn resolves:

- The station does **not fire**
- The station does **not execute movement** (even if movement speed is set)
- At the **end of the turn**, `frozen` decrements by 1

A single-frozen station is fully unfrozen the following turn. A triple-frozen station requires three turns to thaw completely.

---

## 6. Visual Effects

While `frozen > 0`, the station is overlaid with **ice blob particles** drawn on Layer 2 (the trails/effects layer):

- Particles are **stationary blobs** — not sparks, not drifting
- They spawn at the start of the frozen turn and fade individually over the turn duration, leaving the station sprite visible underneath
- Particle count scales with freeze depth:
  - `frozen = 1` — sparse coverage
  - `frozen = 2` — moderate coverage
  - `frozen = 3` — dense coverage, station largely obscured by ice
- Colour: cold white/pale blue
- Particles are cleared when `frozen` reaches `0`

---

## 7. Interaction with Other Conditions

### 7.1 Frozen vs Electrified

**Frozen supersedes electrified.** When a station is both frozen and electrified:

- The frozen behaviour takes full precedence — the station does not fire, does not move, and cannot be controlled
- The electrified counter still decrements by 1 per turn as normal (the condition progresses in the background)
- The HUD shows the frozen label, not the electrified label
- Once `frozen` reaches `0`, the electrified condition (if still active) resumes normal behaviour on the next turn

A station cannot be frozen *and* electrified simultaneously in terms of behaviour — freeze wins.

### 7.2 Armour

Armour operates as normal for frozen stations. A comet impact that triggers freezing first resolves armour: if `armourLayers > 0`, one armour layer is consumed and the station is **not** frozen. Only an unarmoured hit applies the freeze.

### 7.3 Team Shield

The team shield blocks comet impacts as normal. A shielded station is not frozen by a comet.

### 7.4 Bullets

A bullet hitting a frozen station resolves entirely normally — damage, destruction, armour, and kill attribution are unaffected. Frozen grants no immunity to weapons.

---

## 8. Edge Cases

- **Simultaneous comet hits**: if two comets hit the same station in the same resolution pass, each applies `frozen += 1` in sequence, still capped at 3
- **Frozen station destroyed by bullet**: the station explodes and dies as normal; `frozen` is irrelevant on a dead station
- **Triple-frozen station hit by another comet**: `frozen` stays at 3 (cap enforced); the comet is still destroyed
- **Draw condition**: a frozen station counts as a surviving station for the purposes of draw/win detection — it is alive

---

## 9. Tasks

| Task | Description |
|---|---|
| 12.1 | Add `frozen: 0` to `Station`; enforce cap at 3 |
| 12.2 | Aiming phase input suppression + HUD label |
| 12.3 | Fire phase: skip fire + movement; decrement at turn end |
| 12.4 | Ice blob VFX on Layer 2, scaled by freeze depth |
| 12.5 | Comet collision: destroy comet, apply `frozen += 1`; armour check first |
| 12.6 | Frozen supersedes electrified; armour/shield operate normally |
| 12.7 | Edge case handling as above |
