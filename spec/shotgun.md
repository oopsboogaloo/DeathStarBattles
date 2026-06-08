# Shotgun — Weapon Spec

## Overview

A double-barrelled spread weapon. Each barrel fires 6 pellets in a ±8° cone.
The two barrels can be aimed independently — one controlled by the standard
angle slider, the other by the right-hand slider (repurposed from power).
Barrels fire in quick succession.

---

## Weapon Behaviour

**FR-1 — Pellets per barrel**
Each barrel fires 6 pellets. Spread: random angles within ±8° of the barrel's
aim direction. Speed: random in the range MAX_V × 0.25–0.30 (identical to
blunderbuss). Pellet lifetime: 17–23% of standard bullet life (identical to
blunderbuss).

**FR-2 — Firing sequence**
Barrel 1 fires first. Barrel 2 fires 300 physics steps later (~0.5 s).
Both use the burstQueue mechanism. Total 12 pellets.

**FR-3 — Collectable grant**
1 charge per pickup.

---

## Aiming UI

**FR-4 — Two independent angle controls**
When Shotgun is selected:
- Left slider controls **Barrel 1 angle** (standard behaviour, label unchanged).
- Right slider is repurposed as **Barrel 2 angle** (no power value; same
  ±0.1° precision as the angle slider).
- Right slider display: `Barrel 2: 180.0°` (full) / `∠2 180°` (minimal).
- Power slider is hidden / not applicable.

**FR-5 — Barrel 2 initial angle**
When Shotgun is selected or the turn begins, Barrel 2 angle initialises to the
same value as Barrel 1. The player adjusts from there.

**FR-6 — Barrel 2 angle storage**
Barrel 2 angle is stored in a new field `station.angle2` (number, degrees,
same range as `station.angle`). It is reset to `station.angle` at the start
of each aiming phase.

---

## Aim Indicator

**FR-7 — Two sets of aim lines on one circle**
Both barrel directions are shown on the station's single aim circle.

| Lines | Alpha | Width | Count |
|---|---|---|---|
| Barrel 1 centre (0° offset) | 0.95 | 2 px | 1 |
| Barrel 1 flanking (±8°) | 0.45 | 1 px | 2 |
| Barrel 2 centre (0° offset) | 0.60 | 2 px | 1 |
| Barrel 2 flanking (±8°) | 0.28 | 1 px | 2 |

Barrel 2 lines are drawn in the same white colour as Barrel 1 but at reduced
opacity so both directions are legible without crowding.

---

## Bullet Path Preview

**FR-8**
Three representative paths per barrel (at −8°, 0°, +8° relative to each
barrel's aim angle), using the blunderbuss fixed speed (MAX_V × 0.275).

| Path | startAlpha | lw |
|---|---|---|
| Barrel 1 centre | 0.7 | 1.5 |
| Barrel 1 flanking | 0.25 | 1 |
| Barrel 2 centre | 0.45 | 1.5 |
| Barrel 2 flanking | 0.15 | 1 |

---

## Ghost Trail

**FR-9**
All 12 pellet trails are recorded in `station.lastTrails` (6 per barrel).
The standard trail-recording mechanism handles this automatically.

---

## Starting Weapons Pool

Included in `_ALL_SPECIAL` and `WEAPON_GRANTS` (1 charge).

---

## Tuneability — named constants

| Constant | Default |
|---|---|
| `SHOTGUN_PELLETS` | 6 (per barrel) |
| `SHOTGUN_SPREAD` | 8° |
| `SHOTGUN_SPEED_MIN` | MAX_V × 0.25 |
| `SHOTGUN_SPEED_MAX` | MAX_V × 0.30 |
| `SHOTGUN_INTERVAL_STEPS` | 300 (gap between barrels) |
| `SHOTGUN_LIFETIME_MIN` | 0.17 × BULLET_LIFE |
| `SHOTGUN_LIFETIME_MAX` | 0.23 × BULLET_LIFE |

---

## Open Questions

- **OQ-1**: Should the Barrel 2 angle persist between turns (remembers last
  used angle) or always reset to Barrel 1's angle at the start of aiming?
  Currently specified as reset.
- **OQ-2**: Should the canvas click/tap mechanic cycle which barrel the left
  slider controls as an alternative touch input? Not included in this spec;
  can be added as FR-10 if desired.
