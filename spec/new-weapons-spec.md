# New Weapons — Specification

> Covers ten new collectable weapons: Ice Rocket, Ice Blast, Triple Bounce Cannon, Surprise, Ice Bomb, Quantum Beam, Bounce Autocannon, Birthday Present, Freeze Ray, and Rocket Booster. Each section documents tier, charges, firing behaviour, rendering, special mechanics, and edge cases. All freeze semantics follow the existing `frozen` stack model (0–3, capped) from [frozen-condition-spec.md](frozen-condition-spec.md).

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
| Surprise draws ROCKET_BOOSTER when movement is off | Re-draws once; if drawn again, treat as CANNON |
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

## 10. Rocket Booster

**Tier:** 1  
**Charges per collectable:** 2  
**WeaponId:** `ROCKET_BOOSTER`  
**Availability:** Only added to the collectable weapon pool when Movement Speed is set to anything other than `Off`.

### 10.1 Behaviour

When a station fires with `ROCKET_BOOSTER`:

1. **Fire:** A standard Cannon shot is spawned at the station's current angle and power — identical to `WeaponId.CANNON` in every respect (same bullet, same physics, no modifications).
2. **Speed boost:** The station's movement this turn is doubled. Concretely, the movement vector that would be applied at turn end is scaled by 2.0.

One `ROCKET_BOOSTER` charge is consumed on use.

The movement doubling applies only to the current turn's movement. It does not carry over. If the station cannot move (e.g. frozen), the cannon shot still fires but the movement boost has no effect.

Movement is already resolved at turn end alongside hyperspace; the doubled movement is applied at that same resolution point.

### 10.2 HUD

During the aiming phase, when `ROCKET_BOOSTER` is the selected weapon, the standard aim display is shown (angle + power) — the player is setting the cannon shot's angle and power. A secondary label `SPEED ×2` is shown in the weapon button area to remind the player that movement will be doubled.

### 10.3 Rendering

The cannon shot fired by Rocket Booster is visually indistinguishable from a normal cannon shot. No special trail or muzzle VFX. The Rocket Booster charges appear in the weapon selector like any other weapon.

### 10.4 Edge Cases

| Case | Behaviour |
|---|---|
| Movement is Off | Weapon does not appear in the weapon pool; existing stock (from a session where movement was on) is greyed out and unusable |
| Frozen station has Rocket Booster selected | Station is frozen — does not fire, does not move (boost has no effect); charge is **not** consumed |
| Station hyperspaces on same turn | Hyperspace takes precedence; Rocket Booster is not the selected weapon if HYPERSPACE is selected |
| Player selects Rocket Booster then switches to another weapon | Standard weapon selection rules; Rocket Booster stock not consumed if not used |

---

## 11. WeaponId Additions

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
ROCKET_BOOSTER:        'rocketBooster',
```

New entries for `WEAPON_GRANTS` table:

| WeaponId | Tier | Charges | Label |
|---|---|---|---|
| `ICE_ROCKET` | 1 | 2 | `ICE ROCKET` |
| `ROCKET_BOOSTER` | 1 | 2 | `ROCKET BOOSTER` |
| `ICE_BLAST` | 2 | 1 | `ICE BLAST` |
| `TRIPLE_BOUNCE_CANNON` | 2 | 1 | `TRIPLE BOUNCE CANNON` |
| `SURPRISE` | 3 | 3 | `SURPRISE` |
| `ICE_BOMB` | 3 | 1 | `ICE BOMB` |
| `QUANTUM_BEAM` | 3 | 3 | `QUANTUM BEAM` |
| `BOUNCE_AUTOCANNON` | 3 | 1 | `BOUNCE AUTOCANNON` |
| `BIRTHDAY_PRESENT` | 3 | 1 | `BIRTHDAY PRESENT` |
| `FREEZE_RAY` | 3 | 2 | `FREEZE RAY` |

`ROCKET_BOOSTER` is excluded from the `WEAPON_GRANTS` random draw table when Movement Speed is `Off`. It may still appear in `weaponStock` (carried over from a session where movement was on) but is greyed out in the selector.

---

## 12. Affected Files

| File | Change |
|---|---|
| `src/entities/Collectable.js` | Add 10 new `WeaponId` entries; add to `WEAPON_GRANTS` table with tier and charges |
| `src/core/GameLoop.js` | Firing logic for each new weapon; `IceBombBlast` and `IceRing` step/expansion; Quantum Beam swap execution at turn end; Rocket Booster movement doubling; Surprise random draw |
| `src/entities/Bullet.js` | New bullet flags: `iceBomb`, `iceBombTimer`, `birthdayPresent`, `gravityScale` |
| `src/entities/IceRing.js` | **NEW** — `IceRing` entity class |
| `src/entities/Rocket.js` | No change; Ice Rocket reuses Rocket class with a new `isIceRocket` flag |
| `src/physics/PhysicsEngine.js` | Apply `bullet.gravityScale` in gravity step; add `IceRing` step logic; Quantum Beam path simulation with reflection and wormhole traversal |
| `src/rendering/Renderer.js` | Render Ice Rocket trail (white circles with team colour); Ice Ring circles; Ice Bomb projectile glow + blast zones; Quantum Beam sine-wave path + swap flash; Bounce Autocannon (no change, reuses existing trail); Birthday Present rotating striped bullet + stacked grant labels; Freeze Ray icy cyan path; new VFX types: `SurpriseRevealVFX`, `QuantumSwapVFX`, `BirthdayGrantVFX` |
| `src/ui/WeaponSelector.js` | Labels for all 10 new weapons; SURPRISE shows only `SURPRISE [N]`, no sub-weapon hint; ROCKET_BOOSTER greyed out when movement off |
| `src/ai/AIController.js` | Add new weapons to AI priority/probability tables |
