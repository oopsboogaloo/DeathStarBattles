# Rocket Pod — Weapon Specification

## RP-01 Definition

**Rocket Pod** is a collectable special weapon that fires a volley of 8 rockets in rapid succession. Each rocket behaves identically to the standard Rocket weapon except where noted below. The weapon is intended as a dramatic, high-impact collectable — a single charge transforms one turn into an extended barrage.

**Collectable yield:** 1 charge per collectable (same as Rocket, Laser, Minigun).

---

## RP-02 Firing Sequence

WHEN a station fires the Rocket Pod, the system shall launch 8 rockets one at a time in succession at the same inter-shot interval as the Blaster (approximately one rocket per second of real time at normal game speed, scaling with Game Speed setting).

The 8 rockets fire in index order 1–8. All rockets are aimed at the station's set angle, each with an independent random angle deviation (see RP-03).

The turn does not end until the last rocket has been fired and all 8 rockets have resolved (impacted or timed out), consistent with how the Blaster and Minigun work.

---

## RP-03 Individual Rocket Behaviour

Each of the 8 rockets shall behave identically to the standard Rocket weapon with the following differences:

| Property | Standard Rocket | Rocket Pod Rocket |
|---|---|---|
| Thrust / fuel model | Standard (power sets fuel load) | Identical |
| Speed | Power-derived | Identical |
| Smoke trail | Team-coloured puffs | Identical |
| Off-screen edge indicator | Shown | Identical |
| Wormhole / gas giant traversal | Passes through | Identical |
| Blast radius | `ROCKET_BLAST_RADIUS` | ½ × `ROCKET_BLAST_RADIUS` |
| Blast duration / expanding circle | Standard | Identical |
| Collectable destruction in blast | Yes | Identical |
| Angle deviation | — | ±1° random, independent per rocket |

The ±1° angle deviation for each rocket is drawn independently from a uniform distribution at fire time.

---

## RP-04 Spawn Position — Alternating Side Offset

Each rocket spawns offset perpendicular to the aimed direction rather than at the station centre, alternating sides:

- **Odd-indexed rockets** (1, 3, 5, 7): spawn displaced 1× station diameter (2× hit-radius) perpendicular-left of the aim angle (aim angle rotated +90°).
- **Even-indexed rockets** (2, 4, 6, 8): spawn displaced 1× station diameter (2× hit-radius) perpendicular-right of the aim angle (aim angle rotated −90°).

All rockets travel in the player's aimed direction (plus their individual ±1° deviation) — the trajectories are parallel, not converging. The offset is purely a spawn position; rockets do not aim toward a point from their side positions. The 1× diameter offset ensures each rocket visually clears the station body before its smoke trail begins.

---

## RP-05 Aim Lines

The Rocket Pod aim indicator shall use 3 representative lines communicating the ±1° spread envelope:

| Weapon | Lines | Angles | Type |
|---|---|---|---|
| Rocket Pod | 3 | −1°, 0°, +1° | Representative |

Visual style follows the existing aim line rules: centre line (0°) at alpha 0.95 / 2px; flanking lines (±1°) at alpha 0.45 / 1px.

The aim line shall be drawn from the station centre regardless of the per-rocket spawn offset (RP-04) — the offset is a firing effect, not an aiming effect.

---

## RP-06 Bullet Path Preview

The Rocket Pod shall have **no bullet path preview** for the same reason as the standard Rocket: thrust overrides gravity, making any simulated path misleading. The prediction line entry for Rocket Pod is 0 paths.

---

## RP-07 Ghost Trail

Following the ghost trail rules in the aim indicator spec, all 8 rocket trails from the previous turn shall be shown during the station's next aiming phase:

| Weapon | Trails shown |
|---|---|
| Rocket Pod | 8 |

All 8 trails are drawn in the standard dashed ghost trail style (station team colour, `[5, 5]` dash pattern, ~0.55 alpha). No distinction is made between individual rockets.

---

## RP-08 Story Mode — Mission 11 Update

The **Rocket Corps** mission (Mission 11) `startingWeapons` and `enemyStartingWeapons` shall each include one Rocket Pod charge:

```
startingWeapons: { rocket: 99, rocketPod: 1 }
enemyStartingWeapons: { rocket: 99, rocketPod: 1 }
```

This gives both the player and the AI one dramatic Rocket Pod use for the duration of the mission, treated as a single-use tactical option alongside unlimited standard rockets.
