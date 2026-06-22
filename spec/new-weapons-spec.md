# New Weapons — Specification

> Covers ten new collectable weapons: Ice Rocket, Ice Blast, Triple Bounce Cannon, Surprise, Ice Bomb, Quantum Beam, Bounce Autocannon, Birthday Present, Freeze Ray, and Thrust Booster. Also specifies condition notifications for freeze and electrified states (§18). Each section documents tier, charges, firing behaviour, rendering, special mechanics, and edge cases. All freeze semantics follow the existing `frozen` stack model (0–3, capped) from [frozen-condition-spec.md](frozen-condition-spec.md).

---

## Freeze Terminology Reference

| Term | Effect |
|---|---|
| Single freeze | `station.frozen = min(3, station.frozen + 1)` |
| Double freeze | `station.frozen = min(3, station.frozen + 2)` |
| Triple freeze | `station.frozen = min(3, station.frozen + 3)` |

Armour and Team Shield block freeze exactly as they block comet freeze (§7.2–7.3 of frozen-condition-spec.md). A freeze-applying weapon that hits an armoured station consumes one armour layer and applies no freeze.

---

## 1. Ice Rocket

**Tier:** 1  
**Charges per collectable:** 2  
**WeaponId:** `ICE_ROCKET`

### 1.1 Behaviour

The Ice Rocket is a self-propelled projectile using the same physics model as the standard Rocket (design.md §14.3), with the following differences:

- **Blast radius:** `ICE_ROCKET_BLAST_RADIUS = 3 × ROCKET_BLAST_RADIUS` (138 game units)
- **Freeze on blast:** Every station within the blast radius when it is reached by the expanding circle is **double frozen** (`frozen = min(3, frozen + 2)`). Destruction does not occur — the Ice Rocket never kills stations. A station with armour consumes one armour layer instead of receiving the freeze.
- **Shoot-down:** Same hitbox as the standard Rocket (`ROCKET_HITBOX_RADIUS = 8`); detonates on bullet contact.
- **Planet interaction:** Identical to the standard Rocket (detonates on all non-gas-giant planets; passes through gas giants).
- **Wormholes:** Traverses wormholes, same as standard Rocket.

The expanding blast circle behaviour follows the same progressive expansion model as the standard Rocket blast (expanding by `maxRadius / 22` per rAF frame), but the freeze is applied as the circle reaches each station rather than destruction.

### 1.2 Smoke Trail

Each rAF frame while active, one smoke puff is emitted behind the rocket:

- **Shape:** Circle (not the diffuse grey puff of the standard Rocket)
- **Fill:** White (`#FFFFFF`) with a filled disc of team colour at 60% of the puff radius centred inside it
- **Phase 1** (first 18% of lifetime): radius expands from 0 to `maxR` (3–7 game units); alpha 0.6
- **Phase 2** (18–75%): radius and alpha contract/fade
- **Phase 3** (last 25%): rate slows to 1/5×
- Total puff lifetime: same as standard Rocket (~160 rAF frames)

### 1.3 Explosion Visual

When the Ice Rocket detonates, the expanding blast circle is drawn in white (`#FFFFFF`) at 70% opacity on Layer 2. The circle fades to 0% as it reaches `ICE_ROCKET_BLAST_RADIUS`. No team colour is used in the explosion.

### 1.4 Edge Cases

| Case | Behaviour |
|---|---|
| Station already triple frozen | Receives no additional freeze; blast circle passes through it normally |
| Armoured station in blast | One armour layer consumed; no freeze |
| Multiple stations in blast | Each processed independently as the expanding circle reaches them |
| Rocket destroyed by incoming bullet | Detonates at current position; full freeze zone applies |

---

## 2. Ice Blast

**Tier:** 2  
**Charges per collectable:** 1  
**WeaponId:** `ICE_BLAST`

### 2.1 Behaviour

Ice Blast fires a stream of 8 slow-moving ice rings from the station in sequence, at intervals of 300 simulation steps. Each ring is an independent `IceRing` entity stored in `gameState.iceRings: IceRing[]`.

```js
class IceRing {
  owner        // Station
  position     // Vec2 — centre of the ring
  velocity     // Vec2 — affected by gravity each step
  radius       // float — expands over lifetime (starts at station.radius; grows to ICE_RING_MAX_RADIUS)
  lifetime     // int step counter
  status       // 'active' | 'dead'
  hitSet       // Set<Station> — stations already frozen by this ring
}
```

**Constants:**
```
ICE_RING_INITIAL_SPEED = 0.08 × maxCannonSpeed   (very slow)
ICE_RING_GRAVITY_FACTOR = 1.0                     (full gravity)
ICE_RING_MAX_RADIUS = 18                          (game units)
ICE_RING_LIFETIME = 3000                          (simulation steps)
ICE_RING_EXPAND_RATE = ICE_RING_MAX_RADIUS / ICE_RING_LIFETIME
```

Each step, an ice ring:
1. Accumulates gravity from all planets (same as a bullet, `G × 1.0`)
2. Updates position
3. Expands `radius += ICE_RING_EXPAND_RATE`
4. Checks collision with any station whose centre is within `ring.radius + station.radius` of the ring centre and is not in `ring.hitSet`
5. On station contact: applies **single freeze** (`frozen = min(3, frozen + 1)`); adds station to `ring.hitSet`; ring does **not** stop — it passes through stations
6. Checks collision with solid planet surfaces (not gas giants, not crystals, not wormholes): ring is set to `dead`
7. When `lifetime >= ICE_RING_LIFETIME` or outside play boundary: ring set to `dead`

The burst queue for Ice Blast fires one ring every 300 steps for 8 rings:
```js
{ station, weapon: WeaponId.ICE_BLAST, ringsRemaining: 8,
  intervalSteps: 300, nextFireStep: 0 }
```
All 8 rings share the same initial angle and power from the station's aim.

### 2.2 Rendering

Ice rings are drawn on Layer 2 each frame:

- **Ring stroke:** Icy pale blue (`#AADEFF`), `lineWidth = 3px` screen
- **Opacity:** `0.8 × (1 - lifetime / ICE_RING_LIFETIME)` — fades as it ages
- **Inner fill:** Radial gradient from `rgba(180,230,255,0.15)` at centre to fully transparent at `ring.radius` — faint icy glow
- The circle drawn matches the current `ring.radius` exactly

### 2.3 Edge Cases

| Case | Behaviour |
|---|---|
| Ring hits same station twice | `hitSet` prevents double-application per ring |
| Ring hits armoured station | One armour layer consumed; no freeze; station added to `hitSet` |
| Ring hits wormhole | Teleports like a bullet (position moved to exit, velocity direction preserved) |
| Ring hits crystal planet | Crystal destroyed; ring continues |
| Ring hits gas giant | Ring continues through without stopping |

---

## 3. Triple Bounce Cannon

**Tier:** 2  
**Charges per collectable:** 1  
**WeaponId:** `TRIPLE_BOUNCE_CANNON`

### 3.1 Behaviour

Fires three bullets simultaneously at angles `[angle − 5°, angle, angle + 5°]` (same spread as Triple Cannon). Each bullet has bounce properties identical to the Bounce Cannon:

```js
b.fragBouncy = true
b.bouncePlanetOnly = true
b.thickTrail = true
b.bounceRetention = 0.6
```

One charge is consumed on firing. All three bullets are independent `Bullet` instances. Physics, gravity, and station hit detection are identical to normal bullets. Bounce logic: elastic reflection off planet surface normals, retaining 60% speed per bounce.

### 3.2 Rendering

Each of the three bullets renders identically to a Bounce Cannon bullet:
- `thickTrail = true` — 2× trail width in team colour
- Standard bullet circle at current position in team colour

### 3.3 Edge Cases

| Case | Behaviour |
|---|---|
| All three hit the same station | First hit destroys station; remaining two resolve against dead/exploding station as normal |
| Bullet bounces into a wormhole | Teleports, velocity direction preserved post-teleport |

---

## 4. Surprise

**Tier:** 3  
**Charges per collectable:** 3  
**WeaponId:** `SURPRISE`

### 4.1 Behaviour

When selected, Surprise shows only `SURPRISE [N]` in the weapon selector — no hint of what it will do. The selected weapon sub-type is determined at the start of the fire phase (not at selection time), using the session's shared RNG.

**Random weapon pool:** All tier 2 and tier 3 `WeaponId` values currently defined in `WEAPON_GRANTS`:

```
Tier 2: LASER, ROCKET_POD, MINIGUN, SEPTUPLE_CANNON, FRAGMENTATION_SHOT, SHOTGUN,
        DUAL_BLASTER, STAR_SHOT, SPIRAL, TEAM_SHIELD, ARMOUR, REPULSOR_FIELD,
        TELEPORT, AUTO_CANNON, TRIPLE_QUANTUM_TORPEDO,
        ICE_BLAST, TRIPLE_BOUNCE_CANNON

Tier 3: ANTIMATTER_LASER, MAMMOTH_CANNON, QUANTUM_AUTO_CANNON, GRAVITY_CANNON,
        SUPER_LASER, REINFORCEMENT_SIGNAL, MIND_CONTROL_BEAM, HEDGEHOG,
        SURPRISE, ICE_BOMB, QUANTUM_BEAM, BOUNCE_AUTOCANNON, BIRTHDAY_PRESENT,
        FREEZE_RAY
```

One weapon is drawn uniformly at random from this pool. The drawn weapon is then fired as if the station had selected it directly (one use of that weapon's logic, with the station's current angle and power). One `SURPRISE` charge is consumed; no charge of the drawn weapon is consumed (Surprise provides the use).

**Reveal VFX:** Immediately after the random draw, a `SurpriseRevealVFX` fires above the station:

```js
class SurpriseRevealVFX {
  type = 'surpriseReveal'
  position     // Vec2 (station position)
  text         // e.g. 'LASER' (the drawn weapon's label)
  colour       // team colour
  duration = 2.5
  t = 0
}
```

Rendered identically to `CollectableGrantVFX` (rising, fading text) but in a larger font (≈18px screen).

### 4.2 Edge Cases

| Case | Behaviour |
|---|---|
| Surprise draws SURPRISE again | Fires as Surprise again — draws a second random weapon recursively, but only one reveal VFX plays (the final resolved weapon) |
| Surprise draws a weapon requiring setup (e.g. TEAM_SHIELD, ARMOUR) | Applied immediately as if the station selected that weapon |
| Surprise draws THRUST_BOOSTER when movement is off | Re-draws once; if drawn again, treat as CANNON |
| AI uses Surprise | AI fires normally with its chosen angle/power; the drawn weapon resolves as above |

---

## 5. Ice Bomb

**Tier:** 3  
**Charges per collectable:** 1  
**WeaponId:** `ICE_BOMB`

### 5.1 Behaviour

The Ice Bomb is fired as a cannon-speed projectile that detonates after a fuse delay. The fuse is based on travel time, using the same model as `FRAGMENTATION_SHOT`:

```js
b.iceBomb = true
b.iceBombTimer = Math.round((1 + t * 4) * 1800)   // t = power / 800; same formula as fragTimer
b.thickTrail = true
```

`t` is `station.power / 800`, giving a fuse of 1800–9000 steps (scaling with power so higher power detonates later/further).

When `iceBombTimer` reaches 0, an `IceBombBlast` is created at the bullet's current position:

```js
{ x, y,
  maxRadius: ICE_BOMB_BLAST_RADIUS,
  currentRadius: 1,
  owner,
  hitSet: Set()
}

ICE_BOMB_BLAST_RADIUS = 120   // game units
```

The blast expands progressively (same rate as rocket blast: `maxRadius / 22` per rAF frame). As the expanding circle reaches each station:

- Station centre within `currentRadius × (1/3)` → **triple freeze** (`frozen = min(3, frozen + 3)`)
- Station centre within `currentRadius × (2/3)` → **double freeze** (`frozen = min(3, frozen + 2)`)
- Station centre within `currentRadius` → **single freeze** (`frozen = min(3, frozen + 1)`)

The zone threshold is evaluated at the moment the expanding circle first reaches the station (i.e. when `currentRadius >= distance(blast_centre, station_centre) - station.radius`). Stations are added to `hitSet` on contact to prevent double-processing.

Armour/shield interactions are identical to Ice Rocket: armour consumed instead of freeze.

The Ice Bomb projectile itself explodes on planet contact (same as a cannon shot) before the fuse timer elapses, detonating the blast at the planet surface.

### 5.2 Rendering

**Projectile:** Drawn as a normal bullet but with a faint white pulsing glow around it (`radius × 2` white circle, alpha `0.15 + 0.1 × sin(lifetime × 0.03)`).

**Blast circle:**
- White (`#FFFFFF`) stroke at 80% opacity, fading to 0% as it reaches `ICE_BOMB_BLAST_RADIUS`
- Inner zone rings: at `currentRadius × (1/3)` and `currentRadius × (2/3)`, draw dashed pale blue circles at 40% opacity — these shrink as the outer circle expands, giving a visible zone indicator while the blast is expanding

### 5.3 Edge Cases

| Case | Behaviour |
|---|---|
| No stations in any zone | Blast produces no effect; expanding circle VFX plays normally |
| Station on zone boundary (e.g. exactly at 1/3 radius) | Apply the higher freeze (inner zone wins) |
| Multiple stations in overlapping zones | Each resolved independently at the moment the circle first reaches them |
| Ice Bomb shot down by bullet before fuse elapses | Detonates at current position — full blast applies |

---

## 6. Quantum Beam

**Tier:** 3  
**Charges per collectable:** 3  
**WeaponId:** `QUANTUM_BEAM`

### 6.1 Behaviour

The Quantum Beam is a laser-style weapon. Like the Laser (design.md §14.2), it fires after a random delay:

```js
{ station, angle, delaySteps: 400 + Math.floor(rng.next() * 400),
  weaponType: 'quantumBeam' }
```

**Path simulation** rules (differences from Laser):

| Rule | Laser | Quantum Beam |
|---|---|---|
| Passes through stations | Yes (destroys them) | No — stops at first station hit |
| Destroys asteroids/crystals | Yes | No — passes through |
| Reflects off solid planets/stars | No — terminates | Yes — reflects elastically off surface normal |
| Wormholes | Not specified | Traverses (same teleport logic as bullets) |
| Force Shields | Reflects | Reflects |
| Maximum bounces | n/a | 10 (then terminates) |
| Max path steps | 200 | 300 |

**On station hit:**  
The beam stops at the first station it contacts. The firing station and the struck station **instantly swap positions**. Velocity of neither station changes (positions only). Both stations are repositioned simultaneously:

```js
const tempPos = firingStation.position;
firingStation.position = targetStation.position;
targetStation.position = tempPos;
```

The swap happens at the end of the fire phase (same timing as hyperspace execution), after all bullets have resolved. If the firing station was destroyed during the same fire phase, the swap does not occur (no position to swap to).

No damage is dealt to either station. No kill is credited.

### 6.2 Rendering

The Quantum Beam path is stored as a `QuantumBeamVFX`:

```js
{
  type: 'quantumBeam',
  path: Vec2[],
  colour: teamColour,
  t: 0, duration: 1.5,
  swapOccurred: bool,
}
```

Draw procedure each frame:

1. Draw the path as a wide stroke (`lineWidth = 5px`) in team colour at `alpha = sin(t × π) × 0.4`
2. Draw the same path as a narrow pale cyan stroke (`lineWidth = 2px`, colour `#88FFFF`) with a sine-wave lateral offset to simulate a higher-frequency oscillation than the Mind Control Beam:
   - For each consecutive pair of path points, sample sub-points along the segment
   - Offset each sub-point laterally by `sin(pathLength × 0.8 + t × 20) × 2px`
   - This produces a fast ripple along the beam length
3. If `swapOccurred`, flash a `QuantumSwapVFX` at both endpoints: a brief expanding white ring (radius 0 → `station.radius × 3`, duration 0.4s) at each station's new position

### 6.3 Edge Cases

| Case | Behaviour |
|---|---|
| Beam hits firing station's own team | Swap still occurs; same-team swap is valid |
| Target station destroyed before swap executes | Swap does not occur (dead stations cannot be swapped) |
| Beam reflects past play boundary | Path terminates at boundary |
| Beam traverses wormhole and hits a station | Swap still occurs; wormhole traversal is transparent to the swap mechanic |
| Firing station destroyed in same fire phase | Swap does not occur |

---

## 7. Bounce Autocannon

**Tier:** 3  
**Charges per collectable:** 1  
**WeaponId:** `BOUNCE_AUTOCANNON`

### 7.1 Behaviour

Identical to the Autocannon (design.md §14.x — `AUTO_CANNON`), except every bullet spawned has bounce properties:

```js
b.fragBouncy = true
b.bouncePlanetOnly = true
b.thickTrail = true
b.bounceRetention = 0.6
```

Burst parameters (same as Autocannon):
```
totalShots: 5
intervalSteps: 500
angleSpread: [-10, -5, 0, +5, +10]° (progressive, one per shot)
speed: 0.55 × maxCannonSpeed
```

### 7.2 Rendering

Each bullet renders as a Bounce Cannon bullet (`thickTrail = true`, team colour, 2× trail width). Trail opacity: 100% (not reduced).

---

## 8. Birthday Present

**Tier:** 3  
**Charges per collectable:** 1  
**WeaponId:** `BIRTHDAY_PRESENT`

### 8.1 Behaviour

Birthday Present fires a single slow-moving projectile that follows the same spatial trajectory as a Cannon shot at the same power, but takes 3× as long to travel it.

**Speed and gravity adjustment:**

A normal Cannon shot at power P has initial speed `v`. The Birthday Present has:
- Initial speed: `v / 3`
- Effective gravity multiplier: `1 / 9` (applied as a per-bullet gravity scale factor)

This preserves the spatial path (same arc shape) while stretching the time taken by 3×. The gravity scale is stored on the bullet:

```js
b.gravityScale = 1/9
b.birthdayPresent = true
b.thickTrail = true
```

`PhysicsEngine.step()` multiplies each planet's gravitational acceleration by `bullet.gravityScale ?? 1.0` when computing the bullet's trajectory.

**On station hit:** When the Birthday Present bullet strikes a station (of any team, including own team), that station's team immediately receives **3 to 5 random weapons** from the tier 2 or tier 3 pool (same pool as Surprise, §4.1), drawn one at a time using the session RNG. Each drawn weapon is granted at its standard collectable charge count (e.g. LASER → 1 charge, TRIPLE_CANNON → 3 charges).

The number of weapons granted (3, 4, or 5) is itself random: `3 + Math.floor(rng.next() * 3)`.

Kill attribution: if the struck station is destroyed by the impact (standard cannon-shot damage), the kill is credited to the shooter normally.

### 8.2 Rendering

**Projectile:**
- Drawn 2× the normal bullet radius (visually large, clearly special)
- Fill: alternating team colour and white stripes, rotating slowly each frame (drawn as a pie-chart-style sectored circle, sectors rotating at ~0.05 rad/frame)
- Glow: soft white radial gradient (`radius × 2` outer, 10% opacity) — like a wrapped gift with a glow
- Trail: `thickTrail = true`, team colour, full opacity

**On hit:** A `BirthdayGrantVFX` fires at the struck station's position:

```js
class BirthdayGrantVFX {
  type = 'birthdayGrant'
  position     // Vec2
  labels       // string[] — weapon labels, one per granted weapon
  colour       // struck station's team colour
  duration = 3.0
  t = 0
}
```

Rendered as a stacked column of rising label text (same style as `CollectableGrantVFX`), each label offset upward by its index × 14px, staggered fade-in at intervals of 0.1s.

### 8.3 Edge Cases

| Case | Behaviour |
|---|---|
| Birthday Present hits own team | Grants weapons to own team; functions identically |
| Birthday Present hits a dead/exploding station | No grant triggered (station must be `ACTIVE` at moment of impact) |
| Birthday Present destroyed by planet before hitting a station | No grant; standard bullet explosion |
| Birthday Present hits a shielded station | Shield deflects; no grant; no damage |

---

## 9. Freeze Ray

**Tier:** 3  
**Charges per collectable:** 2  
**WeaponId:** `FREEZE_RAY`

### 9.1 Behaviour

The Freeze Ray is a laser-style beam weapon using the same delayed-fire, path-simulation model as the Laser (design.md §14.2), with the following differences:

| Property | Laser | Freeze Ray |
|---|---|---|
| Effect on stations | Destroys | Triple freezes (`frozen = min(3, frozen + 3)`) |
| Effect on asteroids/crystals | Destroys | Passes through (no destruction) |
| Effect on solid planets | Terminates | Terminates |
| Passes through multiple stations | Yes | Yes — freezes all stations along the path, continues |
| Armour interaction | n/a | One armour layer consumed instead of freeze |

Path simulation continues past frozen stations (beam passes through them). All stations along the path are processed. Beam terminates on solid planet surfaces only.

Delay: `400 + Math.floor(rng.next() * 400)` steps (same as Laser).

### 9.2 Rendering

The Freeze Ray path is stored as a `FreezeRayVFX`:

```js
{
  type: 'freezeRay',
  path: Vec2[],
  t: 0, duration: 1.5,
}
```

Draw procedure each frame:

1. Wide stroke (`lineWidth = 6px`), pale icy cyan (`#88DDFF`) at `alpha = sin(t × π) × 0.5`
2. Narrow stroke (`lineWidth = 2px`), white (`#FFFFFF`) at `alpha = sin(t × π)`

This is the same two-layer rendering as the Laser but in cold icy cyan rather than team colour.

### 9.3 Edge Cases

| Case | Behaviour |
|---|---|
| Freeze Ray hits an already triple-frozen station | Cap enforced; no change to frozen value; station added to processed set; beam continues |
| Freeze Ray hits same station twice (e.g. via Force Shield reflection back through the same station) | Second hit applies freeze again if the station is re-encountered during the continued path simulation |
| Freeze Ray hits a Force Shield | Reflects off the shield boundary (same as Laser) |

---

## 10. Thrust Booster

**Tier:** 1  
**Charges per collectable:** 2  
**WeaponId:** `THRUST_BOOSTER`  
**Availability:** Only added to the collectable weapon pool when Movement Speed is set to anything other than `Off`.

### 10.1 Behaviour

When a station fires with `THRUST_BOOSTER`:

1. **Fire:** A standard Cannon shot is spawned at the station's current angle and power — identical to `WeaponId.CANNON` in every respect (same bullet, same physics, no modifications).
2. **Speed boost:** The station's movement this turn is doubled. Concretely, the movement vector that would be applied at turn end is scaled by 2.0.

One `THRUST_BOOSTER` charge is consumed on use.

The movement doubling applies only to the current turn's movement. It does not carry over. If the station cannot move (e.g. frozen), the cannon shot still fires but the movement boost has no effect.

Movement is already resolved at turn end alongside hyperspace; the doubled movement is applied at that same resolution point.

### 10.2 HUD

During the aiming phase, when `THRUST_BOOSTER` is the selected weapon, the standard aim display is shown (angle + power) — the player is setting the cannon shot's angle and power. A secondary label `SPEED ×2` is shown in the weapon button area to remind the player that movement will be doubled.

### 10.3 Rendering

The cannon shot fired by Thrust Booster is visually indistinguishable from a normal cannon shot. No special trail or muzzle VFX. The Thrust Booster charges appear in the weapon selector like any other weapon.

### 10.4 Edge Cases

| Case | Behaviour |
|---|---|
| Movement is Off | Weapon does not appear in the weapon pool; existing stock (from a session where movement was on) is greyed out and unusable |
| Frozen station has Thrust Booster selected | Station is frozen — does not fire, does not move (boost has no effect); charge is **not** consumed |
| Station hyperspaces on same turn | Hyperspace takes precedence; Thrust Booster is not the selected weapon if HYPERSPACE is selected |
| Player selects Thrust Booster then switches to another weapon | Standard weapon selection rules; Thrust Booster stock not consumed if not used |

---

## 11. Team Armour

**Tier:** 3  
**Charges per collectable:** 1  
**WeaponId:** `TEAM_ARMOUR`

### 11.1 Behaviour

When a station fires with Team Armour, no projectile is spawned. At the start of the fire phase, every `ACTIVE` station on the firing station's team (including the firing station itself) receives two additional armour layers:

```js
for (const s of station.team.stations) {
  if (s.status === 'active') s.armourLayers += 2;
}
```

This mirrors the existing `ARMOUR` weapon (which adds 2 layers to the firing station only) but applies team-wide.

### 11.2 HUD

During the aiming phase, when Team Armour is selected, the weapon button reads `TEAM ARMOUR [N]`. Angle and power controls remain visible but are irrelevant (no projectile). A status label `ARMOUR FOR ALL` is shown in the station's team colour, matching the styling of `SHIELDED...`.

### 11.3 VFX

A brief `TeamArmourVFX` fires simultaneously at every station on the team that receives armour:

```js
class TeamArmourVFX {
  type = 'teamArmour'
  position     // Vec2 (station position)
  colour       // team colour
  duration = 0.8
  t = 0
}
```

Rendered as an expanding ring (radius 0 → `station.radius × 2.5`) in team colour at fading opacity, identical in style to the existing armour flash overlay but larger. All instances play concurrently.

### 11.4 Edge Cases

| Case | Behaviour |
|---|---|
| Firing station is the only active station on the team | Only that station receives armour; still valid use |
| A teammate is frozen | Frozen stations are still `ACTIVE`; they receive the armour |
| A teammate already has armour | Layers stack additively; no cap enforced |

---

## 12. Shock Rocket

**Tier:** 2  
**Charges per collectable:** 2  
**WeaponId:** `SHOCK_ROCKET`

### 12.1 Shock Terminology Reference

| Term | Effect |
|---|---|
| Single shock | `station.electrified = min(3, station.electrified + 1)` |
| Double shock | `station.electrified = min(3, station.electrified + 2)` |

Electrified stations fire on their turn but with fully randomised angle and power (existing behaviour). Armour blocks shock the same way it blocks freeze: one layer consumed, no shock applied.

### 12.2 Behaviour

The Shock Rocket uses the same physics, fuel model, and flight behaviour as the standard Rocket (design.md §14.3). On detonation, instead of an expanding kill-blast, it creates a `ShockZone`:

```js
{ x, y,
  maxRadius: SHOCK_ROCKET_RADIUS,
  currentRadius: 1,
  owner,
  hitSet: Set()
}

SHOCK_ROCKET_RADIUS = 3 × ROCKET_BLAST_RADIUS   // = 138 game units
```

The zone expands at the same rate as a rocket blast (`maxRadius / 22` per rAF frame). As the expanding circle reaches each station:
- Station is **double shocked** (`electrified = min(3, electrified + 2)`)
- Station is **not destroyed**
- Armoured stations consume one layer instead of receiving the shock
- Station is added to `hitSet`

All other rocket behaviours are identical: shoot-down hitbox, wormhole traversal, Force Shield detonation, off-screen indicator.

### 12.3 Smoke Trail

Same as the standard Rocket smoke trail (grey diffuse puffs) — no change to trail appearance.

### 12.4 Shock Zone Rendering

The expanding `ShockZone` circle is rendered on Layer 2:

1. **Outer ring:** White (`#FFFFFF`) stroke, `lineWidth = 3px`, alpha fading from 0.9 to 0 as `currentRadius` reaches `maxRadius`
2. **Interior lightning:** While the zone is expanding, draw `N` arcing lightning bolts radiating from the centre outward to `currentRadius`. Each bolt is a jagged polyline (5–8 random mid-point deflections) drawn in white at 80% opacity with a wider team-colour glow stroke underneath at 40% opacity.
   - `N = 12` bolts
   - Each bolt re-randomises its jag pattern every 2 rAF frames (flickering)
   - Bolt length = `currentRadius` (they fill the expanding area)
   - Bolt angles evenly spaced + small random offset per frame

The lightning fills the interior of the zone, giving the impression of an electric storm expanding outward.

### 12.5 Edge Cases

| Case | Behaviour |
|---|---|
| Station already triple electrified | Cap enforced; station still added to `hitSet` |
| Armoured station in zone | One armour layer consumed; no shock |
| Shock Rocket shot down | Detonates at current position; full shock zone applies |

---

## 13. Shock Beam

**Tier:** 2  
**Charges per collectable:** 1  
**WeaponId:** `SHOCK_BEAM`

### 13.1 Behaviour

The Shock Beam uses the same delayed-fire, path-simulation model as the Laser (design.md §14.2):

```js
{ station, angle, delaySteps: 400 + Math.floor(rng.next() * 400),
  weaponType: 'shockBeam' }
```

**Path simulation** differences from Laser:

| Property | Laser | Shock Beam |
|---|---|---|
| Effect on stations hit | Destroys | Double shocks; does **not** destroy |
| Passes through multiple stations | Yes | Yes — shocks all stations along path |
| Effect on asteroids/crystals | Destroys | Passes through (no destruction) |
| Solid planets | Terminates | Terminates |
| Force Shields | Reflects | Reflects |
| Armour | n/a | One layer consumed instead of shock |

The beam continues past electrified/shocked stations (it does not stop on hit).

### 13.2 Rendering

The Shock Beam path is stored as a `ShockBeamVFX`:

```js
{
  type: 'shockBeam',
  path: Vec2[],
  colour: teamColour,
  t: 0, duration: 1.2,
}
```

Draw procedure each frame:

The path is rendered as **joined lightning segments** rather than a smooth line. For each consecutive pair of path sample points:
1. Subdivide the segment into 3–5 sub-segments
2. At each interior junction, apply a random lateral offset of ±(2–6)px screen — this creates a jagged bolt appearance
3. The sub-segment offsets are re-randomised every 3 rAF frames (flickering effect)
4. Draw the jagged polyline twice:
   - Wide pass: team colour, `lineWidth = 5px`, alpha `sin(t × π) × 0.5` — glowing halo
   - Narrow pass: white (`#FFFFFF`), `lineWidth = 1.5px`, alpha `sin(t × π)` — bright core

The result is a beam that looks like a continuous bolt of lightning from muzzle to termination point, with a team-coloured glow and a white hot centre.

### 13.3 Edge Cases

| Case | Behaviour |
|---|---|
| Shock Beam hits a frozen station | Applies double shock on top of existing frozen (conditions coexist; frozen takes precedence for turn resolution) |
| Beam reflects off Force Shield into own station | Shock applies to own station |

---

## 14. Suit Up

**Tier:** 3  
**Charges per collectable:** 1  
**WeaponId:** `SUIT_UP`

### 14.1 Behaviour

Suit Up is a composite weapon that executes three simultaneous effects at the start of the fire phase:

**Effect 1 — Triple Armour:**
The firing station receives three additional armour layers:
```js
station.armourLayers += 3;
```

**Effect 2 — Force Shield:**
A Force Shield is activated for the firing station for this turn, identical to selecting `WeaponId.FORCE_SHIELD` directly (design.md §14.6). The shield expires at turn end.

**Effect 3 — Minigun:**
A minigun burst is fired from the firing station at its chosen angle and power, identical to `WeaponId.MINIGUN` (13 shots × 200-step intervals, ±2° random spread per shot, 1.5× maxCannonSpeed).

All three effects are applied atomically at fire-phase start. The Force Shield is active from the first simulation step, so it deflects incoming bullets during the same turn the Suit Up is used.

### 14.2 HUD

During the aiming phase, angle and power are shown normally (they govern the minigun direction). The weapon button reads `SUIT UP [N]`. A sub-label `ARMOUR + SHIELD + MINIGUN` is shown beneath the weapon button in the team colour.

### 14.3 VFX

A `SuitUpVFX` triggers at the firing station at fire-phase start:

```js
class SuitUpVFX {
  type = 'suitUp'
  position     // Vec2
  colour       // team colour
  duration = 0.5
  t = 0
}
```

Rendered as a rapid double-ring expansion from the station (two concentric rings, slightly staggered in timing) in team colour, to signal the defensive boost before the minigun bullets begin flying.

### 14.4 Edge Cases

| Case | Behaviour |
|---|---|
| Station already has a Force Shield active (from a previous Suit Up or Force Shield weapon) | A second shield is added — two shield entries on `gameState.shields` for this station; both deflect independently |
| Station is frozen | Force Shield still activates (defence applies even to frozen stations); minigun does not fire (frozen station cannot fire); armour is still added |
| Minigun bullets hit the station's own shield | Bullets are deflected by the shield in the normal way |

---

## 15. Aaarrrgghh

**Tier:** 3  
**Charges per collectable:** 1  
**WeaponId:** `AAARRRGGHH`

### 15.1 Behaviour

Aaarrrgghh fires both an Auto Cannon burst and a Rocket Pod burst simultaneously, using the same angle and power. Both burst queues are added to `gameState.burstQueue` at the start of the fire phase:

**Auto Cannon component** (identical to `WeaponId.AUTO_CANNON`):
```js
{ station, weapon: 'autoCannon', totalShots: 5, shotsRemaining: 5,
  intervalSteps: 500, nextFireStep: 0,
  angleOffsets: [-10, -5, 0, +5, +10] }
```

**Rocket Pod component** (identical to `WeaponId.ROCKET_POD`):
```js
{ station, weapon: 'rocketPod', totalRockets: 8, rocketsRemaining: 8,
  intervalSteps: 600, nextFireStep: 0 }
```

Both queues tick independently each `_firingTick()`. The cannon bullets and rockets are in flight simultaneously and interact with the world independently. All kills from either component are credited to the firing station.

One `AAARRRGGHH` charge is consumed on firing. No Auto Cannon or Rocket Pod charges are consumed.

### 15.2 Rendering

Auto Cannon bullets render as normal Auto Cannon bullets (standard trail, team colour). Rockets render as standard Rocket Pod rockets (standard smoke trail). No special visual distinguishes this weapon from its components firing at the same time.

### 15.3 Muzzle VFX

A `AaaarrrgghhhMuzzleVFX` fires at the station at fire-phase start — a brief text label `AAARRRGGHH!` in team colour, large font, very short duration (0.4s), which rises and fades like a `CollectableGrantVFX`. This gives the weapon the comedic energy it deserves.

### 15.4 Edge Cases

| Case | Behaviour |
|---|---|
| Station is frozen | Neither component fires; charge is not consumed |
| A Rocket Pod rocket is shot down mid-flight | Detonates normally; unrelated to the Auto Cannon bullets |
| Auto Cannon bullet hits a rocket from the same burst | Rocket detonates at its current position (same as any bullet hitting a rocket) |

---

## 16. WeaponId Additions

New entries for `Collectable.js` `WeaponId` enum:

```js
ICE_ROCKET:            'iceRocket',
ICE_BLAST:             'iceBlast',
TRIPLE_BOUNCE_CANNON:  'tripleBounceCannon',
SURPRISE:              'surprise',
ICE_BOMB:              'iceBomb',
QUANTUM_BEAM:          'quantumBeam',
BOUNCE_AUTOCANNON:     'bounceAutocannon',
BIRTHDAY_PRESENT:      'birthdayPresent',
FREEZE_RAY:            'freezeRay',
THRUST_BOOSTER:        'thrustBooster',
TEAM_ARMOUR:           'teamArmour',
SHOCK_ROCKET:          'shockRocket',
SHOCK_BEAM:            'shockBeam',
SUIT_UP:               'suitUp',
AAARRRGGHH:            'aaarrrgghh',
```

New entries for `WEAPON_GRANTS` table:

| WeaponId | Tier | Charges | Label |
|---|---|---|---|
| `ICE_ROCKET` | 1 | 2 | `ICE ROCKET` |
| `THRUST_BOOSTER` | 1 | 2 | `THRUST BOOSTER` |
| `ICE_BLAST` | 2 | 1 | `ICE BLAST` |
| `TRIPLE_BOUNCE_CANNON` | 2 | 1 | `TRIPLE BOUNCE CANNON` |
| `SHOCK_ROCKET` | 2 | 2 | `SHOCK ROCKET` |
| `SHOCK_BEAM` | 2 | 1 | `SHOCK BEAM` |
| `SURPRISE` | 3 | 3 | `SURPRISE` |
| `ICE_BOMB` | 3 | 1 | `ICE BOMB` |
| `QUANTUM_BEAM` | 3 | 3 | `QUANTUM BEAM` |
| `BOUNCE_AUTOCANNON` | 3 | 1 | `BOUNCE AUTOCANNON` |
| `BIRTHDAY_PRESENT` | 3 | 1 | `BIRTHDAY PRESENT` |
| `FREEZE_RAY` | 3 | 2 | `FREEZE RAY` |
| `TEAM_ARMOUR` | 3 | 1 | `TEAM ARMOUR` |
| `SUIT_UP` | 3 | 1 | `SUIT UP` |
| `AAARRRGGHH` | 3 | 1 | `AAARRRGGHH` |

`THRUST_BOOSTER` is excluded from the `WEAPON_GRANTS` random draw table when Movement Speed is `Off`. It may still appear in `weaponStock` (carried over from a session where movement was on) but is greyed out in the selector.

---

## 18. Condition Notifications

When a condition (freeze or electrified) is applied to a station, a floating text label rises from the station and fades out, using exactly the same presentation as `CollectableGrantVFX` — the weapon-collected text that appears when a collectable gem is picked up. The label is drawn in the **affected station's team colour**.

### 18.1 Labels

#### Freeze conditions

| `frozen` value after application | Label |
|---|---|
| 1 | `FROZEN` |
| 2 | `DOUBLE FROZEN` |
| 3 | `TRIPLE FROZEN` |

The label reflects the station's new `frozen` value at the moment the condition is applied, not the increment. If a station at `frozen = 1` is double-frozen (increment +2, capped at 3), the label reads `TRIPLE FROZEN`.

#### Electrified conditions

| `electrified` value after application | Label |
|---|---|
| 1 | `ELECTRIFIED` |
| 2 | `DOUBLE ELECTRIFIED` |
| 3 | `TRIPLE ELECTRIFIED` |

Same rule: label reflects the resulting stack value, not the increment.

### 18.2 VFX Type

A new VFX entry type `'conditionNotify'` is added to `vfxList`:

```js
class ConditionNotifyVFX {
  type = 'conditionNotify'
  position   // Vec2 — station position at the moment of application
  text       // string — label as above
  colour     // CSS colour — affected station's team colour
  duration = 2.0
  t = 0
}
```

Rendering is identical to `CollectableGrantVFX`: the text rises upward (`t × 20` game units offset) and fades using the eased curve `alpha = clamp(t / 0.12) * 0.5 * (1 + cos(t × π))`. Font size matches the grant label (~14px screen, bold monospace).

`conditionNotify` entries are advanced by `_advanceCollectableVFX` (the same always-running advancer used by `collectableGrant`) so they continue fading through the aiming phase without freezing on screen.

### 18.3 Trigger Points

A `ConditionNotifyVFX` is pushed to `gameState.vfxList` at every point in `GameLoop` where a condition is applied to a station:

| Trigger | Condition |
|---|---|
| Comet hits unarmoured station | Freeze (`frozen += 1`) |
| Ice Rocket blast reaches station | Freeze (`frozen += 2`) |
| Ice Blast ring contacts station | Freeze (`frozen += 1`) |
| Ice Bomb blast inner zone | Freeze (`frozen += 3`) |
| Ice Bomb blast middle zone | Freeze (`frozen += 2`) |
| Ice Bomb blast outer zone | Freeze (`frozen += 1`) |
| Freeze Ray hits station | Freeze (`frozen += 3`) |
| Shock Rocket zone reaches station | Electrified (`electrified += 2`) |
| Shock Beam hits station | Electrified (`electrified += 2`) |
| Existing ELECTRO_STUN weapon | Electrified (`electrified += 1`) |

If a single event would apply a condition but armour absorbs it, **no** `ConditionNotifyVFX` is created (the condition was not applied).

### 18.4 Stacking and Multiple Hits

If the same station is hit by multiple condition sources in the same fire phase (e.g. two Ice Blast rings pass through it), each successful application spawns its own `ConditionNotifyVFX`. Multiple labels from the same station stack vertically in the order they are pushed (each starts at the station position, so they ride up independently). The cap still applies to the `frozen`/`electrified` value; the label always reflects the actual resulting value.

### 18.5 Affected Files (addition)

| File | Change |
|---|---|
| `src/core/GameLoop.js` | Push `ConditionNotifyVFX` at every condition-application site listed in §18.3 |
| `src/rendering/Renderer.js` | Render `conditionNotify` type — reuse `CollectableGrantVFX` draw path with the station team colour |

---

## 17. Affected Files

| File | Change |
|---|---|
| `src/entities/Collectable.js` | Add 15 new `WeaponId` entries; add to `WEAPON_GRANTS` table with tier and charges |
| `src/core/GameLoop.js` | Firing logic for all new weapons; `IceBombBlast`, `IceRing`, `ShockZone` step/expansion; Quantum Beam swap at turn end; Thrust Booster movement doubling; Surprise random draw; Suit Up composite activation; Aaarrrgghh dual burst queue; `ConditionNotifyVFX` at all condition-application sites (§18.3) |
| `src/entities/Bullet.js` | New bullet flags: `iceBomb`, `iceBombTimer`, `birthdayPresent`, `gravityScale` |
| `src/entities/IceRing.js` | **NEW** — `IceRing` entity class |
| `src/entities/Rocket.js` | Reused unchanged; Ice Rocket and Shock Rocket use `isIceRocket` / `isShockRocket` flags |
| `src/physics/PhysicsEngine.js` | Apply `bullet.gravityScale` in gravity step; `IceRing` step logic; Quantum Beam and Shock Beam path simulation |
| `src/rendering/Renderer.js` | Ice Rocket trail; Ice Ring circles; Ice Bomb glow + blast zones; Quantum Beam sine-wave path + swap flash; Birthday Present striped bullet + grant labels; Freeze Ray icy path; Shock Zone expanding lightning fill; Shock Beam jagged lightning path; Team Armour ring VFX; Suit Up double-ring VFX; Aaarrrgghh muzzle text VFX; `conditionNotify` VFX (reuses grant-label draw path) |
| `src/ui/WeaponSelector.js` | Labels for all 15 new weapons; SURPRISE sub-weapon hidden; THRUST_BOOSTER greyed when movement off |
| `src/ai/AIController.js` | Add all new weapons to AI priority/probability tables |
