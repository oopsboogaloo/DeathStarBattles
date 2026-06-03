# Target Practice Mode — EARS Requirements Specification

## TPM-01 Mode Selection
The system shall offer **Target Practice** as a selectable Game Mode alongside Single Game and Tournament in the Mode config option.

---

## TPM-02 Configuration
The config panel shall include a **Target Practice** page (Page 5) that is only visible and accessible WHEN Target Practice is the selected Game Mode.

| Option | Values |
|---|---|
| Number of Targets (N) | 1 / 3 / **5** / 7 / 10 / 20 |
| Target Size | Micro / Tiny / Small / **Medium** / Large / Giant / Mammoth |
| Number of Rounds | 1 / 3 / **5** / 7 / 10 |
| Include AI | **Off** / On |

WHILE Target Practice mode is not selected, the Target Practice config page shall not be shown.

---

## TPM-03 Scenario Generation
WHEN a Target Practice game is started, the system shall randomly select a scenario from the permitted subset: **Planetary, Asteroids, Crystal Asteroids, Gas Giants, Star System, Wormhole**.

The system shall apply Wildcard planets if the Wildcard setting is enabled.

The scenario shall be generated with no stations placed — only planets and wildcard objects.

---

## TPM-04 Station Placement
WHEN the play area is landscape (width ≥ height), the system shall place all stations along a vertical line at either the left or right edge of the play area (chosen randomly).

WHEN the play area is portrait (height > width), the system shall place all stations along a horizontal line at either the top or bottom edge of the play area (chosen randomly).

Stations shall be evenly spaced along the placement line with sufficient separation to avoid overlap.

Stations shall not be placed inside or overlapping any planet (using the same three-tier fallback from §6.3 applied along the placement line).

---

## TPM-05 Target Placement
The system shall attempt to place **2N** practice targets in unoccupied map positions, avoiding planet overlap, spaced as evenly as practical across the non-station portion of the play area.

Targets shall be rendered as archery bullseye targets (concentric red and white rings) at the configured Target Size.

Targets shall not be affected by gravity.

Bullets shall pass through targets without being destroyed.

---

## TPM-06 Target Feasibility Simulation
WHEN 2N targets have been placed, the system shall run a silent internal feasibility simulation: for each station, fire 50 Megabot-quality simulated shots aimed at each target in turn, recording which (station, target) pairs achieve at least one hit.

The system shall then select N final targets from the 2N candidates by the following priority:

1. Prefer targets hit by the greatest number of distinct stations.
2. WHERE multiple candidates share equal hit-count, select randomly among them.
3. IF fewer than N targets were hit by any station, include the remaining unhit candidates chosen at random to reach N.

IF the placement algorithm cannot position the full 2N targets without planet overlap after repeated attempts, the system shall discard the current scenario and re-roll (returning to TPM-03).

---

## TPM-07 Per-Team Shared Target Pool
Targets are owned by a **team**, not by individual stations. All stations on the same team share one pool of N targets.

A target is destroyed for a team the first time **any** station on that team hits it. Once destroyed for a team it is gone for the rest of the game regardless of which station fires next.

---

## TPM-08 Round and Turn Structure
A Target Practice game shall consist of the configured number of rounds (default 5).

Each round mirrors normal game turn structure:

1. **Aiming phase** — every station sets its angle and power. Human stations wait for the player to confirm with End Turn. AI stations (when Include AI is On) calculate their shot immediately. Stations on the same team cycle through humans one at a time, just as in normal mode.
2. **Firing phase** — once all stations have aimed, **all bullets fire simultaneously**. Bullets travel until they hit a planet, leave the boundary, or time out.
3. **Hit resolution** — any bullet entering a surviving target's radius registers a hit for that bullet owner's team; the target is destroyed for that team and a glitter VFX plays.
4. **Early completion** — after each firing phase, IF a team's targets are all destroyed that team's play ends immediately. That team's `finishedRound` is recorded and it fires no further rounds.
5. **Round advance** — the round counter increments after each firing phase. WHEN all teams have either cleared their targets or reached `totalRounds`, the system proceeds to the Results Screen (TPM-13).
6. **Multi-team independence** — stations belonging to a finished team are excluded from all subsequent rounds. Remaining teams continue firing until they too finish or exhaust `totalRounds`. Scores are only compared once every team is done.

The aiming indicator, ghost trail, and End Turn button behave identically to normal play.

---

## TPM-09 Weapons and Movement
The system shall restrict available weapons to **Cannon only** in Target Practice mode. Hyperspace, special weapons, and the weapon selector shall not be available.

Station Movement shall be **Off** and non-configurable in Target Practice mode.

---

## TPM-10 Hit Detection and Target Destruction
WHEN a bullet's position enters a target's radius, the system shall register a hit for the (station, target) pair.

The bullet shall continue on its trajectory unaffected.

The target shall be destroyed immediately and a glitter particle burst VFX shall play at the target's position.

IF a bullet enters the radius of an already-destroyed target, no effect occurs.

---

## TPM-11 Hit Accuracy Calculation
WHEN a hit is registered, the system shall calculate an accuracy score A for that hit:

> **A = max(0, 1 − θ / 90°)**
>
> where θ is the angle in degrees between the bullet's velocity vector at moment of impact and the vector from the impact point to the target centre.

A score of 1.0 (100%) indicates the bullet was travelling directly through the target centre. A score of 0.0 (0%) indicates a tangential graze.

Accuracy shall be recorded only for hits. Misses do not contribute to accuracy scoring.

---

## TPM-12 Scoring
At the end of all rounds, the system shall calculate the following per team:

- **Targets cleared** — targets hit out of N.
- **Hit Rate** — targets hit ÷ N × 100%.
- **Mean Accuracy** — arithmetic mean of all per-hit accuracy scores (0–100%). Teams with zero hits show "—".
- **Finished Round** — the round in which all N targets were cleared, shown as "Round X / Y". Teams that did not clear all targets show "—".

Finishing in fewer rounds is implicitly better — a team that clears all targets in round 3 of 5 will have played fewer rounds and thus had fewer chances to miss, which naturally shows in their hit rate across rounds.

WHERE a player controls multiple stations, the system shall also display aggregated team-level hit rate and mean accuracy.

---

## TPM-13 Results Screen
WHEN all rounds are complete, the system shall display a Results Screen showing, per station and per team: hit rate, mean accuracy, and total targets destroyed out of N.

The Results Screen shall offer:
- **Play Again** — generate a new scenario with the same configuration.
- **Main Menu** — return to the configuration screen.

---

## TPM-14 Visual Continuity
The star field and planet layer (Layer 0) shall persist across all turns within a game.

Each station's bullet trails (Layer 1) shall be cleared at the start of that station's next turn, consistent with standard trail behaviour.

Destroyed target positions shall remain visually clear (no debris) after the destruction VFX completes.
