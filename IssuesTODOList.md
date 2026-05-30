# DeathStarBattles — Issues & TODO List

Issues and improvements to address. Add new items below with a short description.
Resolved items have been moved to ResolvedTODOList.md.

---

## Bugs

<!-- e.g. - [ ] Description -->

## Improvements

<!-- e.g. - [ ] Description -->

## Features

- [ ] **Stations pass through wormholes** — when a station's position overlaps a wormhole during movement (station movement feature), teleport it to the paired/cyclic/random exit using the same logic as bullets in `PhysicsEngine._handlePlanetImpact`. The station should emerge just outside the exit wormhole's surface, preserving its velocity direction. If the exit is a self-wormhole it emerges on the opposite side. Applies to all wormhole types; gas giants already pass bullets through so stations should also pass through gas giants without destruction.

- [ ] **Red wormhole network** — currently red wormholes (`WORMHOLE_RANDOM`) teleport to a completely random map position, identical to green. Change red wormhole behaviour so a bullet entering any red wormhole exits from a randomly chosen *other* red wormhole on the map (i.e. they form a random-destination network among themselves). If only one red wormhole exists, fall back to the current random-position behaviour. Requires a new `PlanetType` (e.g. `WORMHOLE_NETWORK`) or repurposing the existing red colour with modified logic in `PhysicsEngine._handlePlanetImpact`.

## Polish

<!-- e.g. - [ ] Description -->
