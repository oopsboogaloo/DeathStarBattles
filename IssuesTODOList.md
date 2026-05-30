# DeathStarBattles — Issues & TODO List

Issues and improvements to address. Add new items below with a short description.

---

## Bugs

- [x] **Wormhole trail continuity** — fixed: `null` sentinel pushed into `bullet.trail` on every wormhole teleport inside `_handlePlanetImpact`; `appendTrailPoint` and `redrawTrails` skip segments involving null (pen lift). Trail now breaks cleanly at wormhole entry and restarts at exit.

- [x] **Star corona draws over other planets** — fixed: `_renderBackground` now does two passes — `PlanetRenderer.drawCorona` for all planets first, then `PlanetRenderer.draw` (body only) for all planets. Corona bristles always sit behind solid planet discs.

- [x] **Explosions too fast** — fixed: explosion advancement moved from inside the physics inner loop (ran 100×/frame) to outside it (runs once per rAF frame). Station explosions: `+= 0.04/frame` (~25 frames). Bullet explosions: `+= 0.05/frame` (~20 frames). `_resultsTimer` extended to 150 frames (~2.5 s).

## Improvements

- [x] **Ghost trail of previous shot** — implemented: `station.lastTrail` saved when all bullets stop flying; rendered as a dashed, 28%-opacity line in team colour during AIMING phase for the active human station.

- [x] **Aiming indicator line length reflects power** — fixed: line length now scales from station radius (power ≈ 0) to full `boxR` (power = 800). Formula: `r + (boxR - r) * (station.power / 800)`.

- [x] **Off-screen bullet indicator** — implemented: for each active bullet outside the canvas, a team-coloured filled triangle is drawn at the nearest canvas edge pointing toward the bullet, with a distance-from-edge integer label beside it.

## Polish

<!-- e.g. [ ] Sound effects -->
