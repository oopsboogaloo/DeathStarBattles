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



- [ ] **Moons** — New planet type with multi-hit destruction, crater rendering, and a dedicated scenario.

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

## Polish

<!-- e.g. - [ ] Description -->

## Mobile / Usability

<!-- e.g. - [ ] Description -->
