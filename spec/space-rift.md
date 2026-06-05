# Space Rift — Requirements Specification

## SR-01 Definition

A **space rift** is a fracture in spacetime represented as a piecewise-linear chain of N connected line segments, where N is chosen uniformly at random from 3–11 at game generation time.

Each segment has length approximately equal to one Medium station diameter (referenced as `RIFT_SEGMENT_LENGTH` in implementation).

The rift is defined by an ordered list of N+1 vertices: v₀, v₁, … vₙ.

---

## SR-02 Generation

WHEN a rift is generated, the system shall:

1. Choose a random starting position v₀ within the map boundary (with margin sufficient to keep the full rift on-screen).
2. Choose a random initial direction θ₀.
3. For each subsequent vertex vᵢ (i = 1 … N): compute θᵢ = θᵢ₋₁ ± Δ, where Δ is drawn uniformly from [0°, 30°] and the sign (left/right turn) is chosen randomly. Place vᵢ at distance `RIFT_SEGMENT_LENGTH` from vᵢ₋₁ in direction θᵢ.

The system shall attempt to place the rift such that no segment significantly overlaps an existing planet body. IF placement fails after a reasonable number of retries, the rift shall be placed at the best available position regardless.

Rifts do not collide with planets or stations; they are pure physics field objects with no solid geometry.

---

## SR-03 Repulsive Force

Each vertex vᵢ of the rift exerts a **repulsive force** on any bullet within its influence radius.

**Influence radius:** `RIFT_INFLUENCE_RADIUS` = total rift length = N × `RIFT_SEGMENT_LENGTH`.

**Force magnitude** at distance d from vertex vᵢ:

> F = RIFT_REPULSION_STRENGTH × max(0, 1 − d / RIFT_INFLUENCE_RADIUS)

This is a **linear falloff**: maximum force at the vertex, reducing to zero at `RIFT_INFLUENCE_RADIUS`.

**Force direction:** directly away from vᵢ (unit vector from vᵢ to bullet position).

**Accumulation:** the net force on a bullet per simulation step is the vector sum of forces from all N+1 vertices across all rifts on the map.

**Affected objects:** bullets only. Stations and collectables are not affected by rift repulsion.

**Design intent:** a low-power bullet moving slowly spends more simulation steps within the influence radius and accumulates enough deflection to curve away from the rift. A high-power bullet passes through quickly and is only slightly deflected, effectively punching through.

---

## SR-04 Rendering — Background Layer (Layer 0)

WHEN the game is initialised, the system shall draw the following rift decorations once onto Layer 0 (the static background):

**Outer glow:**
A wide, soft-blurred line (approximately 20–30px wide, alpha 0.25–0.35) traced along the full rift vertex chain. Colour: electric purple-white (`#C060FF` or similar).

**Forked lightning paths:**
From 2–4 randomly chosen positions along the rift, draw branching lightning paths outward. Each path:
- Starts at the chosen rift point and extends outward in a random direction.
- Consists of 3–6 short irregular segments of varying length and ±40° random deflections.
- Forks into 2 sub-branches at least once, with sub-branches shorter than the parent.
- Colour: same purple-white as the outer glow, alpha 0.2–0.4, line width 1px.
- Sub-branches at reduced alpha (×0.6 per level).

These decorations are purely cosmetic and have no physics effect.

---

## SR-05 Rendering — Rift Line (Layer 0)

The rift line segments shall also be drawn onto Layer 0 as a static object (it does not move):

**Core line:** the connected vertex chain drawn as a polyline, line width 2px, colour bright white-purple (`#E8C0FF`), alpha 0.95.

**Inner glow:** a second pass of the same polyline at 6–8px width, same colour, alpha 0.35, with canvas blur (shadowBlur ≈ 8) to produce a luminescent core effect.

The rift shall render above planets but below stations and bullets.

---

## SR-06 Scenarios

Two new named scenarios shall be added to the scenario list (extending the current 28):

| # | Name | Contents |
|---|------|---------|
| 29 | Rift | 1 rift + 0–3 rocky planets + a sparse asteroid field |
| 30 | Rifts | 2–6 rifts + a moderate mix of rocky planets and asteroids |

Both scenarios shall be included in the **Lucky Dip** uncommon range (63% pool, scenarios 1–19 extended to include 29–30) and eligible for random selection in Tournament mode.

The existing **Hyperspace** scenario (26) shall be modified to include 2–4 rifts placed using SR-02. All other Hyperspace rules remain unchanged (no planets; hyperspace forced every turn).

---

## SR-07 Wildcard Pool

Rifts shall be added to the wildcard candidate list (§6.1). WHEN a wildcard object is injected into a scenario, the system shall have a **10% chance** of injecting one space rift instead of the existing wildcard options.

The injected rift is generated using SR-02 after all planets are placed.

---

## SR-08 AI Awareness

AI controllers (all levels) shall treat rift repulsion forces identically to any other force during trajectory simulation — no special-case handling is required, since the repulsion is applied through the same per-step force accumulation loop as gravity.
