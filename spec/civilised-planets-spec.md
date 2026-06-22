# Civilised Planets, Planetary Defences & New Scenarios — Specification

> Introduces civilised planets, planetary defence systems, new hazard objects, and several new scenarios. The intent is to make the universe feel inhabited and reactive while greatly increasing the number of emergent gameplay situations. The majority of these features are **generic, reusable systems** rather than scripted behaviours, so they can be shared across Story Mode, random games, and future scenarios.

> **Status:** Future work — captured for later. Not yet implemented. This document records the design intent; implementation details (affected files, data shapes, tuning constants) are to be worked out when the feature is scheduled.

---

## 1. Civilised Planets

### 1.1 Overview

Any planet or moon may be marked as **Civilised**.

- The probability that a naturally generated planet is civilised is a **scenario parameter**. Default: **0%**.
- A civilised planet is visually distinguished by small buildings placed around its circumference.
- Buildings are decorative until the planet possesses defensive systems.

### 1.2 Buildings

Buildings are rendered around the edge of the planet.

**Properties**
- Small, randomly selected building sprites
- Random spacing
- Random orientation where appropriate
- Destroyed individually
- Replaced with rubble / crater graphics when destroyed

**Damage**
- Buildings have **one hit point**.
- Destroyed by weapons, explosions, or any damaging projectile.
- Destroyed buildings remain destroyed for the remainder of the game.

### 1.3 Planet Alert State

The **first time** any of the following is damaged, the planet immediately enters **Alert**:

- Building
- Planetary armour
- Surface rocket
- Defence station
- Defence satellite
- Mine
- Force Rift generator

When alerted:
- The aggressor is recorded.
- Dormant defences activate.
- Reinforcement stations begin their beam-in timer.
- Surface rockets begin firing.
- Defence satellites begin intercepting.
- Future aggressors are added to the hostile list.

### 1.4 Aggressor List

Each civilised planet maintains an **independent** list of hostile teams.

A team becomes hostile if it damages any planetary asset:
- Buildings
- Armour
- Defence stations
- Surface rockets
- Satellites
- Mines
- Force Rift generators

Only hostile teams are attacked, unless a scenario explicitly specifies otherwise.

---

## 2. Planetary Defence Systems

### 2.1 Defence Stations

Two varieties exist.

#### 2.1.1 Dormant Defence Stations

Already deployed near the planet; initially idle. They activate **only after** the planet becomes alerted.

**Scenario parameters**
- `0–N` stations
- AI level
- Initial weapons

#### 2.1.2 Reinforcement Defence Stations

Do not initially exist. After the first hostile action they:
1. Wait several turns (recommended beam delay: **2–5 turns**).
2. Beam into nearby space.

**Visual:** blue teleport effect; the station fades into existence.

**Scenario parameters**
- Number of stations
- AI level
- Starting weapons
- Beam delay

Stations only attack hostile teams.

### 2.2 Surface Rockets

Visible launch sites placed on the planetary surface. Each launcher contains **one** rocket.

**Properties**
- Visible
- Individually destructible
- Rockets use normal missile guidance
- Fire immediately when alerted
- May pass **through** planetary armour
- Destroyed launchers cannot fire

### 2.3 Planetary Armour

Planets may possess armour segments. Behaves identically to ship armour.

**Properties**
- Absorbs hits
- Damage still counts as aggression
- Rockets launch through armour
- Regeneration is configurable — e.g. restore one armour point every `N` turns

### 2.4 Planetary Mines

Civilised planets may deploy mines nearby.

**Properties**
- Rotate slowly; visible spikes
- Trigger when hit
- Trigger when ships approach
- Explode into spike projectiles
- If an explosion would damage the owning planet, the mine **detonates slightly early** so the planet is unharmed

Mines are planetary assets — destroying a mine counts as aggression.

### 2.5 Defence Satellites

Satellites slowly orbit the planet. Each turn they:
1. Predict incoming projectiles.
2. Identify those likely to strike the planet.
3. Coordinate with other satellites.
4. Fire **one** interceptor.

**Rules**
- Each satellite may intercept only one projectile per turn.
- Target selection attempts to avoid duplicate interceptions.
- Target interception success should be approximately **80%**.
- Satellites are destructible.
- Attacking a satellite **immediately** counts as aggression, even if the incoming projectile is intercepted.

### 2.6 Force Rift

Artificial reflective rifts, constructed from:
- One generator sphere at each end
- A blue reflective rift between them

The rift behaves exactly like an ordinary reflective rift.

**Generator spheres**
- Can be targeted
- One hit point each
- Destroying either sphere destroys both — the reflective rift dissolves immediately

---

## 3. New Space Objects

### 3.1 Space Debris

Irregular metallic wreckage. Uses asteroid collision detection.

**Initial state**
- Slowly rotating
- Pinned into a gentle circular orbit

**On hit**
- Unpins
- Receives projectile momentum
- Begins free gravitational movement
- Gains rotational momentum

**Properties**
- Five hit points
- Destroys ships on collision

> Scenario placement must ensure no ship begins inside a debris object's pinned orbit.

### 3.2 Cryo Tank

Large cryogenic storage vessel. Initially pinned.

**On hit**
- Becomes unpinned
- Receives impact momentum
- Begins leaking cryogen — the leak applies **continuous thrust** from the impact point. As the tank rotates, the thrust direction continually changes, producing curved / spiral movement.

**On collision** with any object:
- Medium **white** explosion
- Applies **Double Frozen** status

### 3.3 Pyro Tank

Identical movement behaviour to the Cryo Tank.

**After damage**
- Unpinned
- Fuel leak provides rotating thrust

**On collision:**
- Medium **red** explosion
- Destroys destructible objects, including ships

### 3.4 Capacitor Debris

Large battery assembly.

**After damage**
- Unpinned
- Electrical leak produces rotating thrust

**On collision:**
- Medium **electrical** explosion
- Applies **Double Electrified** status

### 3.5 Station Remains

Large circular wreckage. Initially pinned.

**After damage**
- Unpinned
- Receives projectile momentum

**On collision with ships**
- No direct damage
- Transfers momentum (can push ships into hazards)

**Properties**
- Seven hit points
- When destroyed, fragments into **2–4** moving Space Debris objects

---

## 4. New Scenarios

### 4.1 Civilised Planet

**Contents**
- One large civilised planet, mostly visible on screen
- 2–6 moons
- Asteroids

**Defences**

| Defence | Quantity |
|---|---|
| Dormant defence stations | 0–3 |
| Beam-in defence stations | 0–3 |
| Surface rockets | 0–5 |

| Satellites | Probability |
|---|---|
| 0 | 90% |
| 1 | 8% |
| 2 | 2% |

| Planetary armour | Probability |
|---|---|
| 0 | 80% |
| 1 | 10% |
| 2 | 6% |
| 3 | 4% |

- **25% chance** of 1–5 mines.

#### Wildcard Addition — Medium Civilised Planet

| Defence | Quantity |
|---|---|
| Dormant stations | 0–2 |
| Beam-in stations | 0–2 |
| Surface rockets | 0–3 |

| Satellites | Probability |
|---|---|
| 0 | 90% |
| 1 | 8% |
| 2 | 2% |

| Armour | Probability |
|---|---|
| 0 | 80% |
| 1 | 10% |
| 2 | 6% |
| 3 | 4% |

- Additional wildcard: 3–7 mines.

### 4.2 Warzone

Two large civilised planets positioned on opposite sides of the map.

- **25% chance** of a small central star.

**Additional objects**
- 2–4 moons or asteroids
- 3–4 debris objects
- All moons begin with one damage.

**Defences** (each planet receives identical defences)
- 2–4 defence stations
- Four rocket pods
- 1–3 planetary armour
- 0–3 surface rockets
- 0–1 defence satellites

**Initial diplomacy**
- Each planet is already hostile to the other; combat begins immediately.
- The planets themselves are valid attack targets.
- Players may accidentally become participants by damaging either side.

### 4.3 Space Junkyard

**Contents**
- 0–2 moons (already cracked once)
- 8–20 randomly selected objects

**Distribution**

| Object | Share |
|---|---|
| Space Debris | 25% |
| Asteroids | 15% |
| Crystal Asteroids | 5% |
| Pyro Tanks | 10% |
| Cryo Tanks | 10% |
| Capacitor Debris | 10% |
| Station Remains | 20% |
| Mines | 5% |

**Extreme variant:** mostly mines, tanks, and capacitors.

### 4.4 Space Minefield

**Contents**
- 2–4 small uninhabited planets
- 8–20 hazards

**Distribution**

| Object | Share |
|---|---|
| Space Debris | 12% |
| Crystal Asteroids | 2% |
| Pyro Tanks | 2% |
| Cryo Tanks | 2% |
| Capacitor Debris | 2% |
| Station Remains | 5% |
| Mines | 80% |

**Extreme variant:** double the object count.

### 4.5 Space Fortress

One medium civilised planet.

**Planetary defences**
- Six defence stations
- Five rocket pods
- Three planetary armour
- Three defence satellites
- Three Force Rifts arranged around the planet — the defence stations occupy the gaps between the Force Rifts

**Moons** — three civilised moons orbit the fortress, each with three surface rockets. All belong to the same planetary faction.

**Additional objects**
- 3–5 asteroids
- 3–6 mines

**Diplomacy** — the planetary faction begins hostile towards every team.

---

## 5. Story Mode Compatibility

All scenarios described above are fully compatible with Story Mode. These items will be added into the Story campaign later.
