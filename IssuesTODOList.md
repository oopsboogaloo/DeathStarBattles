# DeathStarBattles — Issues & TODO List

Issues and improvements to address. Add new items below with a short description.
Resolved items have been moved to ResolvedTODOList.md.

---

## Bugs

<!-- e.g. - [ ] Description -->

## Improvements

<!-- e.g. - [ ] Description -->

## Features

- [ ] **Red wormhole network** — currently red wormholes (`WORMHOLE_RANDOM`) teleport to a completely random map position, identical to green. Change red wormhole behaviour so a bullet entering any red wormhole exits from a randomly chosen *other* red wormhole on the map (i.e. they form a random-destination network among themselves). If only one red wormhole exists, fall back to the current random-position behaviour. Requires a new `PlanetType` (e.g. `WORMHOLE_NETWORK`) or repurposing the existing red colour with modified logic in `PhysicsEngine._handlePlanetImpact`.

## Polish

<!-- e.g. - [ ] Description -->
