# Sound Effects Specification

## Overview

Add a sound effects system to DeathStarBattles using the Web Audio API. No music at this stage. All sounds are pre-existing files in `/Sounds/`. The system must respect browser autoplay policy (audio context unlocked on first user gesture).

---

## 1. Architecture — `src/audio/SoundManager.js`

A singleton module that owns the Web Audio API context and all audio buffers.

### API surface

```js
SoundManager.init()            // call once on first user gesture to unlock AudioContext
SoundManager.play(id, opts?)   // play a named sound; opts: { volume?, pitch? }
SoundManager.setMasterVolume(0..1)
SoundManager.setAmbientVolume(0..1)
SoundManager.setEnabled(bool)
SoundManager.startAmbient()    // begin looping ambient track
SoundManager.stopAmbient()
```

### Internal structure

- One `AudioContext` (created lazily on first `init()` call)
- A `Map<id, AudioBuffer>` — all files decoded on load
- A master `GainNode` → destination
- A separate ambient `GainNode` (child of master) for ambient loop, independently controllable
- `play()` creates a `BufferSourceNode`, connects it through the master gain, and starts it; fire-and-forget
- Ambient track uses a looping `BufferSourceNode` through the ambient gain

### Preloading

All files decoded via `fetch` + `AudioContext.decodeAudioData` during the game's existing loading bar sequence. Sound loading is its own named stage (`'Loading sounds...'`) and its progress counts toward the bar. Silent failures for missing files (no throw). The manager is inert until `init()` is called; all `play()` calls before that are silently dropped.

`SoundManager.init()` is called on the first user gesture (Start Game click) to unlock the `AudioContext`, then `SoundManager.preload(onProgress)` is called inside `startGame()` so the bar reflects decode progress. If sounds are already loaded (subsequent games), `preload()` resolves immediately.

---

## 2. Config Panel — new SOUNDS page

Add a seventh page (`PAGE_TITLES` index 6, label `'SOUNDS'`), always visible regardless of mode.

### Settings added to `ConfigPanel._d`

| Key | Type | Default | Description |
|---|---|---|---|
| `soundEnabled` | bool | `true` | Master on/off |
| `masterVolume` | string | `'low'` | Stepped: `'mute' \| 'low' \| 'medium' \| 'high'` |
| `ambientVolume` | string | `'medium'` | Stepped: `'off' \| 'low' \| 'medium' \| 'high'` |

### Volume step → gain mapping

| Step | Gain |
|---|---|
| `mute` / `off` | 0.0 |
| `low` | 0.15 |
| `medium` | 0.35 |
| `high` | 0.65 |

Master volume default is `'low'` (0.15) — quiet out of the box. Ambient default is `'medium'` relative to master.

### Rows

```
SOUND EFFECTS     ◄  On / Off  ►
MASTER VOLUME     ◄  Low       ►
AMBIENT VOLUME    ◄  Medium    ►
```

Ambient Volume row is greyed out (opacity 0.35, pointer-events none) when Sound Effects is Off.

Config changes take effect immediately (no restart required) via `SoundManager.setEnabled()` / `setMasterVolume()` / `setAmbientVolume()`.

---

## 3. Sound File → ID Mapping

All paths relative to `/Sounds/`.

| ID | File | Notes |
|---|---|---|
| `uiClick` | `sfxclickbleep1.wav` | Primary button press |
| `uiNav` | `sfxclickbleep2.wav` | Modal nav, page turn |
| `cannon` | `CannonLaunch.wav` | Standard cannon fire |
| `blunderbuss` | `Blunderbus.wav` | |
| `rocket` | `RocketLaunch.wav` | Single rocket |
| `rocketPod` | `FireworksLaunch.wav` | Multi-rocket salvo |
| `minigun` | `mg1.wav` | Rapid-fire weapons |
| `blaster` | `pistol1.wav` | |
| `shotgun` | `shotgun2.wav` | |
| `laser` | `ahmed_abdulaal-laser-312360.mp3` | Standard laser — clean single zap |
| `laserAlt` | `soundreality-attack-laser-128280.mp3` | Slightly heavier variant — super laser launch |
| `laserCharged` | `freesound_community-charged-laser-7125.mp3` | Long charging beam — antimatter laser |
| `laserBeam` | `freesound_community-laser-beam-76426.mp3` | Continuous beam tone — mind control beam |
| `teleport` | `teleport.wav` | Hyperspace, teleport weapon |
| `explosionSmall` | `Explosion1.wav` | } randomly chosen |
| `explosionSmall2` | `Explosion2.wav` | } for bullet impacts |
| `explosionSmall3` | `Explosion3.wav` | } and small hits |
| `explosionMed` | `Explosion4.wav` | } randomly chosen |
| `explosionMed2` | `Explosion5.wav` | } for rocket/frag bursts |
| `explosionLarge` | `ExplosionLarge1.wav` | } randomly chosen |
| `explosionLarge2` | `ExplosionLarge2.wav` | } for station destruction |
| `glassSmash` | `GlassSmash.wav` | Collectable collected, crystal asteroid |
| `pop` | `Pop1.wav` | Shield hit, armour, bounce |
| `pop2` | `Pop2.wav` | Repulsor field, secondary hits |
| `fireworkBang` | `fireworkBang.wav` | Frag shot detonation, star shot |
| `nova` | `NovaEditGain.wav` | Gravity cannon charge, power-up received |
| `ambientSpace` | `SpaceAmbience.mp3` | Looping ambient background |

Unused at launch: elephant sounds, `SaucerNoise.wav`, `SunSoundCombined.wav`, `TheMadLab.mp3`, `shortPistol1.wav`, `AmbientSpaceWind.wav`, `soundreality-attack-laser-128280 (1).mp3`, `soundreality-attack-laser-128280 (2).mp3`. Keep available for future use.

---

## 4. Weapon Fire → Sound Mapping

Fired at the moment projectiles launch (start of FIRING phase, per station).

| Weapon | Sound |
|---|---|
| Cannon (default) | `cannon` |
| Triple Cannon | `cannon` × 1 (single cue, volume slightly lower) |
| Septuple Cannon | `cannon` × 1 |
| Mammoth Cannon | `cannon` (pitch −20%, volume +20%) |
| Scatter Cannon | `cannon` |
| Bounce Cannon | `cannon` |
| Auto Cannon | `minigun` |
| Quantum Auto-Cannon | `minigun` |
| Blunderbuss | `blunderbuss` |
| Blaster | `blaster` |
| Dual Blaster | `blaster` × 1 (single cue) |
| Shotgun | `shotgun` |
| Minigun | `minigun` |
| Rocket | `rocket` |
| Rocket Pod | `rocketPod` |
| Hedgehog | `rocketPod` |
| Reinforcement Signal | `rocketPod` |
| Laser | `laser` |
| Antimatter Laser | `laserCharged` |
| Super Laser | `laserAlt` (pitch −10%) |
| Mind Control Beam | `laserBeam` |
| Fragmentation Shot | `cannon` (launch) + `fireworkBang` (on detonation) |
| Star Shot | `rocketPod` (launch) + `fireworkBang` (on burst) |
| Quantum Torpedo | `teleport` (softer, pitch +15%) |
| Triple Quantum Torpedo | `teleport` (softer) |
| Gravity Cannon | `nova` |
| Spiral | `cannon` |
| Hyperspace | `teleport` |
| Teleport weapon | `teleport` |
| Force Shield | `pop` (deploy) |
| Team Shield | `pop` (deploy) |
| Armour | `pop2` |
| Repulsor Field | `pop2` |
| Resupply | `nova` (quiet) |

---

## 5. Game Event → Sound Mapping

| Event | Sound | Notes |
|---|---|---|
| Station destroyed | `explosionLarge` or `explosionLarge2` (random) | |
| Rocket detonation | `explosionMed` or `explosionMed2` (random) | |
| Bullet hits planet/station | `explosionSmall` or `explosionSmall2` (random) | |
| Frag shot fragments burst | `fireworkBang` | |
| Star shot bursts | `fireworkBang` | |
| Collectable collected | `glassSmash` | |
| Crystal asteroid split/destroyed | `glassSmash` | |
| Asteroid destroyed (non-crystal) | `explosionSmall` | |
| Shield reflects bullet | `pop` | |
| Armour absorbs hit | `pop2` | |
| Wormhole transit (bullet) | `teleport` (very quiet) | |
| Power-up/weapon received (resupply, prize) | `nova` | |

---

## 6. UI Sounds

| Interaction | Sound |
|---|---|
| Any button click in ConfigPanel | `uiClick` |
| Modal next/prev page navigation | `uiNav` |
| Weapon selector open/select | `uiClick` |
| Start Game button | `uiClick` |
| End Turn button | `uiClick` |
| Move button | `uiClick` |

---

## 7. Ambient Sound

- `SpaceAmbience.mp3` loops continuously whenever a game is active (AIMING or FIRING phase)
- Routed through the ambient gain node, independently controllable via Ambient Volume setting
- Starts on game start, stops when returning to the config menu
- If Ambient Volume is set to Off, the loop still runs but at gain 0 (avoids audio gap on re-enable)

---

## 8. Integration Points in Existing Code

### `src/main.js`
- Call `SoundManager.init()` on first user gesture (Start Game / Story / Target Practice click) to unlock `AudioContext`
- Call `SoundManager.preload(onProgress)` early in `startGame()` — on first call this fetches and decodes all audio files and advances the load bar under the label `'Loading sounds...'`; on subsequent calls it resolves immediately
- Apply config: `SoundManager.setEnabled(cfg.soundEnabled)`, `setMasterVolume(...)`, `setAmbientVolume(...)`
- Play UI sounds on button clicks: End Turn, Move, weapon selector, config panel buttons
- `SoundManager.startAmbient()` at start of game, `stopAmbient()` when returning to menu

### `src/core/GameLoop.js`
- Weapon fire: emit sound at the point each station's weapon fires (existing firing loop)
- Station destroyed: at the point `station.status` is set to dead
- Rocket detonation: inside `_detonateRocket()`
- Bullet hit: where `bullet.status` is set to `EXPLODING`
- Collectable collected: where collectable is claimed
- Crystal asteroid / asteroid destroyed: where planet is marked destroyed
- Shield reflect: inside the bullet-shield reflection block
- Wormhole transit: where bullet wormhole teleport is applied

### `src/ui/ConfigPanel.js`
- Add Sounds page with three rows
- Expose `cfg.soundEnabled`, `cfg.masterVolume`, `cfg.ambientVolume`
- Immediately apply changes to SoundManager on each `_onChange` for the sound keys

---

## 9. Implementation Order

1. `SoundManager.js` — core Web Audio wrapper, preload all sounds, master/ambient gain chain
2. ConfigPanel Sounds page — settings wired to SoundManager live
3. UI click sounds — lowest-risk, immediately audible
4. Ambient loop
5. Weapon fire sounds — one weapon at a time, starting with Cannon
6. Explosion / hit events
7. Special events (collectables, crystal, wormhole, shield)

---

## 10. Randomisation & Pitch Variation

### Explosion pool selection
`SoundManager` exposes a `playRandom(ids[], opts?)` helper that picks uniformly at random from a list of sound IDs. All explosion events use this:
- Small impacts → random from `[explosionSmall, explosionSmall2, explosionSmall3]`
- Medium bursts → random from `[explosionMed, explosionMed2]`
- Station destroyed → random from `[explosionLarge, explosionLarge2]`

### Pitch variation on every play
All weapon fire and explosion sounds get a small random pitch offset each time they play to avoid the "same sample every time" fatigue. Applied via `AudioBufferSourceNode.playbackRate`:

| Category | Pitch variation |
|---|---|
| Cannon family | ±6% |
| Blaster / pistol / shotgun | ±8% |
| Rocket / pod | ±5% |
| Minigun | ±4% |
| Explosions (all sizes) | ±10% |
| UI clicks | none (keep crisp) |
| Teleport | ±5% |
| Laser | ±3% |
| Ambient | none |

Implementation: `playbackRate.value = 1 + (Math.random() * 2 - 1) * variance` where `variance` is the half-range (e.g. 0.06 for ±6%).

---

## 11. Notes & Constraints

- Web Audio autoplay: `AudioContext` must be created (or resumed) inside a user gesture handler. Sounds before the first click are silently dropped.
- Do not use `<audio>` elements — Web Audio API gives better multi-instance and timing control.
- All sound calls are fire-and-forget (`BufferSourceNode.start()`). No pooling required at this scale.
- Simultaneous sounds (e.g. all stations fire at once) are fine — each gets its own `BufferSourceNode`.
- Volume values in `play()` opts are multiplied on top of master gain, not replacing it.
- `.meta` files in `/Sounds/` are Unity metadata — ignore them, fetch only the audio files.
