# Remote Multiplayer — Design Document

**Status:** Draft  
**Date:** 2026-06-09  
**Spec:** [remote-multiplayer-spec.md](remote-multiplayer-spec.md)

---

## 1. Architecture Overview

The system uses Firebase Realtime Database as a turn relay and authoritative state store. All game logic runs client-side; Firebase is a dumb message bus plus one source of truth (the master client's post-turn state write).

**Client vs. slot distinction (important):**  
A *client* is one browser session / device. A *slot* is one player position in the game. A single client may own multiple consecutive slots (hot seat). All Firebase ownership, heartbeat, and disconnect handling is managed at the **client** level; firing solutions and game state entries are indexed at the **slot** level.

**Roles:**
- **Master client** — the client owning slot 0 at game creation, or the client promoted to master after the previous master leaves. Responsible for: AI turn generation, authoritative post-turn state write, and master promotion writes.
- **Non-master clients** — all other clients. Run simulation locally for visual continuity, then overwrite their state with the master's write.

```
┌──────────────────┐  writes solutions for        ┌──────────────────────┐
│  Client B        │  slots it owns ─────────────►│  Firebase RTDB       │
│  (owns slots 2,3)│                               │                      │
└──────────────────┘                               │  /games/{code}/      │
                                                   │    meta/             │
┌──────────────────┐  writes AI solutions +        │    slots/            │
│  Master Client A │  own solutions ─────────────► │    turns/{n}/        │
│  (owns slots 0,1)│ ◄──────── polls solutions ─── │      solutions/      │
│                  │  writes authoritative state ──►│      state/          │
└──────────────────┘                               │      acks/           │
                                                   │    heartbeats/       │
                                                   │    stats/            │
                                                   └──────────────────────┘
```

---

## 2. Firebase Data Model

```
/games/{code}/
  meta/
    status:         "lobby" | "starting" | "active" | "complete"
    totalSlots:     number            // 2–12
    humanSlots:     number            // human count as originally configured
    timerSeconds:   number | null     // null = Unlimited
    createdAt:      ServerValue.TIMESTAMP
    startedAt:      ServerValue.TIMESTAMP | null
    masterClientUid: string           // UID of current master client
    config:         { ... }           // ScenarioFactory seed + options
    rng:            string            // serialised RNG seed

  slots/
    {slotIndex}/                      // "0"–"11"
      type:         "human" | "ai"
      clientUid:    string | null     // Firebase anonymous UID of owning client
      status:       "waiting" | "joined" | "disconnected" | "abandoned" | "ai"
      lastSeen:     number            // ms epoch, written by owning client heartbeat

  turns/
    {turnIndex}/                      // "0", "1", …
      startedAt:    ServerValue.TIMESTAMP
      solutions/
        {slotIndex}/                  // keyed by slot, e.g. "0"
          angle:    number
          power:    number
          weapon:   string            // WeaponId
          params:   object | null     // weapon-specific extras
      state/
        payload:    string            // JSON-serialised GameState snapshot
        writtenAt:  ServerValue.TIMESTAMP
      acks/
        {slotIndex}: true             // non-master clients confirm receipt per slot they own

  heartbeats/
    {clientUid}: number               // ms epoch, updated by each client every 30s

  stats/
    {gameCode}/
      result:       "complete" | "abandoned"
      totalTurns:   number
      playerCount:  number
      humanCount:   number
      aiCount:      number
      endedAt:      ServerValue.TIMESTAMP
```

### Key design decisions

- **`clientUid` on slots** rather than a per-slot UID — a single UID may appear on N consecutive slots (hot seat). Firebase rules check ownership by matching `clientUid`.
- **`heartbeats/{clientUid}`** is written every 30 seconds by each client. Any client that polls `slots/` checks `lastSeen` freshness; if a slot's `lastSeen` is >60s old, that client's slots are marked `disconnected`.
- **Polling instead of persistent listeners** — after the turn begins, clients one-shot poll `turns/{n}/solutions` at ≤1s intervals until all solutions are present, then stop. No `on()` listeners held open during idle periods, preserving Firebase simultaneous connection quota.
- **`meta/masterClientUid`** is writable during master promotion. The new master writes its own UID here; all other clients observe the change and adjust behaviour accordingly.
- **`acks/`** contains one entry per slot (not per client). A client that owns slots 2 and 3 writes two acks. The master advances the turn once all connected non-AI slots have acked.
- **`turns/{n}/state`** is write-once from the current master.
- **`config` + `rng`** written at game creation so all clients reconstruct an identical initial scene deterministically.

---

## 3. Module Breakdown

### 3.1 `src/multiplayer/FirebaseClient.js`
Low-level wrapper over the Firebase JS SDK. All reads use `get()` (one-shot) not `on()`. No game logic.

```
FirebaseClient
  .init(firebaseConfig)
  .signInAnonymously()                         → Promise<uid>
  .createGame(code, gameData)                  → Promise<void>   // fails if code exists (collision check)
  .isCodeTaken(code)                           → Promise<boolean>
  .getGameMeta(code)                           → Promise<GameMeta>
  .getSlots(code)                              → Promise<Slot[]>
  .assignSlots(code, uid, n)                   → Promise<slotIndices[]>  // atomic transaction, n consecutive
  .watchMeta(code, cb)                         → unsubscribe            // only persistent listener (lobby + master change)
  .getSolutions(code, turn)                    → Promise<SolutionMap>   // one-shot poll
  .writeSolution(code, turn, slotIndex, sol)   → Promise<void>
  .getTurnState(code, turn)                    → Promise<StatePayload|null>  // one-shot poll
  .writeTurnState(code, turn, payload)         → Promise<void>
  .writeAck(code, turn, slotIndex)             → Promise<void>
  .getAcks(code, turn)                         → Promise<AckMap>        // one-shot poll
  .writeHeartbeat(uid, tsMs)                   → Promise<void>
  .markSlotsDisconnected(code, slotIndices)    → Promise<void>
  .markSlotsAbandoned(code, slotIndices)       → Promise<void>
  .convertSlotsToAI(code, slotIndices)         → Promise<void>
  .writeMasterPromotion(code, newMasterUid)    → Promise<void>
  .writeGameComplete(code, statsPayload)       → Promise<void>
  .writeStats(code, statsPayload)              → Promise<void>
```

### 3.2 `src/multiplayer/GameSession.js`
Coordinates the multiplayer flow. Owns the Firebase connection lifecycle, heartbeat interval, poll loops, and bridges into the existing `GameLoop` / `GameState` machinery.

```
GameSession
  .createGame(config, localSlotCount)          → Promise<{code, url}>
  .joinGame(code, localSlotCount)              → Promise<slotIndices[]>
  .startEarly()                                → Promise<void>   // P1 only; converts unfilled slots to AI
  .isMaster                                    → boolean
  .ownedSlots                                  → number[]
  .submitSolutions(slotSolutionMap)            → Promise<void>   // batch write for all owned slots
  .pollUntilAllSolutions(turn)                 → Promise<SolutionMap>
  .pollUntilTurnState(turn)                    → Promise<StatePayload>
  .pollUntilAllAcks(turn)                      → Promise<void>   // master only
  .writeTurnState(gameState)                   → Promise<void>   // master only
  .checkAndHandleDisconnects()                 → Promise<void>   // called each poll cycle
  .onMetaChange(cb)                            → void
  .destroy()                                   → void            // stops heartbeat, clears listeners
```

### 3.3 `src/multiplayer/Serialiser.js`
Stateless pure functions. No Firebase dependency.

```
serialiseSolution(station, aimState)  → FiringSolutionDTO
deserialiseSolution(dto)              → FiringSolution
validateSolution(dto)                 → { valid: boolean, errors: string[] }

serialiseGameState(gameState)         → string   (JSON)
deserialiseGameState(json)            → GameState
```

### 3.4 `src/multiplayer/TurnTimer.js`
Derives a countdown from a Firebase server timestamp. Fires a callback on expiry. Used by all clients identically. Constructed with `null` duration for Unlimited mode (never fires).

```
TurnTimer(serverStartMs, durationSec | null, onExpire)
  .start()
  .tick(nowMs)      → secondsRemaining | null   // null = Unlimited
  .cancel()
```

### 3.5 `src/multiplayer/CodeGenerator.js`
Generates 6-character alphanumeric codes and handles collision retry.

```
CodeGenerator
  .generate()                                  → string   // single candidate
  .generateUnique(isCodeTaken)                 → Promise<string>   // retries until unique
```

### 3.6 `src/multiplayer/HeartbeatManager.js`
Writes a heartbeat to Firebase every 30 seconds on behalf of the owning client. Stops cleanly on `destroy()`.

```
HeartbeatManager(uid, firebaseClient, logger)
  .start()
  .destroy()
```

### 3.7 `src/multiplayer/DisconnectMonitor.js`
Evaluates slot `lastSeen` timestamps. Called by `GameSession` each poll cycle. Emits slot status change events.

```
DisconnectMonitor(slots, nowMs, timerDurationSec)
  .evaluate()   → { toDisconnect: slotIndex[], toConvertAI: slotIndex[], toRestore: slotIndex[] }
```

### 3.8 `src/multiplayer/MasterPromotion.js`
Pure function. Given the current slot list and departed master's UID, returns the UID of the client owning the lowest-numbered remaining human/joined slot.

```
electNewMaster(slots, departedUid)   → string | null
```

### 3.9 `src/multiplayer/Logger.js`
Structured JSON logger. Injectable sink.

```
Logger(sink, context)
  .debug(event, data?)
  .info(event, data?)
  .warn(event, data?)
  .error(event, data?)
  // context = { gameId, clientId, ownedSlots, turn }
  // context is attached to every entry automatically

LogSinks:
  ConsoleSink         — development
  InMemorySink        — automated testing; exposes .entries[] for assertion
  NoOpSink            — production default
```

Every log entry shape:
```json
{
  "ts": 1749470400000,
  "level": "INFO",
  "event": "turn_begun",
  "gameId": "AB3X7Q",
  "clientId": "uid-abc",
  "ownedSlots": [0, 1],
  "turn": 3,
  "data": { "serverTs": 1749470400123 }
}
```

### 3.10 `src/multiplayer/Analytics.js`
Thin wrapper over Firebase Analytics. Called by `GameSession` at the appropriate lifecycle points. Also writes to `/stats/{code}` for custom querying.

```
Analytics(firebaseApp, firebaseClient)
  .gameCreated(totalCount, humanCount, aiCount)
  .gameStarted(totalCount, humanCount, aiCount)
  .gameCompleted(totalTurns)
  .gameAbandoned(turnNumber)
  .turnTimeout()
```

### 3.11 `src/ui/LobbyScreen.js`
Replaces `ConfigPanel` for multiplayer. Shows game code, shareable URL, player slot list (live-updating), "Start Early" button for P1, and triggers auto-start when all slots fill.

### 3.12 `src/ui/JoinScreen.js`
Code-entry screen. Pre-populates from URL parameter `?game=`. Prompts for local player count. Validates against Firebase, routes to lobby or error.

### 3.13 Integration points in `src/main.js`
- `ConfigPanel` gains "Create Game" / "Join Game" entry points that surface `LobbyScreen` / `JoinScreen`.
- `GameLoop` gains a `multiplayerSession` option. When set:
  - `waitingForInput` cycles through all owned slots (hot seat sequencing) before triggering `submitSolutions()`.
  - After input is gathered, `pollUntilAllSolutions` drives the transition to simulation.
  - Master calls `writeTurnState()` post-simulation; non-masters wait on `pollUntilTurnState()`.
- `AIController` is gated: only runs when `gameSession.isMaster`.
- A per-client "owned slots" indicator renders above the aim UI so hot seat players know whose turn it is locally.

---

## 4. Hot Seat Turn Sequencing

When a client owns slots [2, 3]:

1. Turn begins — client enters aiming mode for slot 2.
2. Player 2 (local) confirms their firing solution — stored locally, **not yet sent to Firebase**. UI transitions to slot 3.
3. Player 3 (local) confirms their firing solution.
4. **Batch write** — both solutions written to Firebase in a single multi-path update under `turns/{n}/solutions/2` and `turns/{n}/solutions/3`.
5. Client then polls for remaining slots' solutions from other clients.

This prevents a co-located player from seeing another local player's solution before they've submitted.

---

## 5. Turn Flow (state machine)

```
LOBBY
  ├─ all human slots joined ──────────────────────────────────► STARTING
  └─ P1 presses "Start Early" → convert unfilled slots to AI ──► STARTING

STARTING  (1 s delay, all clients notified)
  └─────────────────────────────────────────────────────────────► AIMING

AIMING  (per owned slot, in order)
  ├─ local player submits → buffer locally
  ├─ all owned slots done → batch writeSolutions() to Firebase
  ├─ master generates + writes AI solutions
  └─ pollUntilAllSolutions() → SIMULATING

SIMULATING
  ├─ all clients run physics locally
  ├─ master: serialiseGameState → writeTurnState()
  ├─ non-masters: pollUntilTurnState() → deserialise + apply silently → writeAck()
  └─ master: pollUntilAllAcks() → advance turn ──────────────────► AIMING (next turn)
                                                              or ──► GAME_OVER

GAME_OVER
  └─ master writes final state + stats → all clients show results
```

**Each poll cycle (≤1s interval) during AIMING/SIMULATING also:**
- Writes heartbeat if 30s elapsed
- Calls `checkAndHandleDisconnects()` → may trigger AI takeover or master promotion

---

## 6. Disconnection & Reconnection Handling

| Event | Behaviour |
|---|---|
| Client heartbeat missing >60s | Any polling client calls `markSlotsDisconnected()` for all slots with `clientUid` matching the stale heartbeat |
| Disconnected — within grace period (1× timer duration) | Slots stay as `disconnected`; auto-submit fires on timer expiry for their turns |
| Client writes heartbeat before grace expires | `DisconnectMonitor` emits restore; slots return to `human` status |
| Grace period expires | Slots permanently converted to `ai`; `convertSlotsToAI()` written; master assumes generation |
| Client tries to reconnect after AI conversion | Firebase meta check on join → rejected with message |
| Client voluntarily quits | `markSlotsAbandoned()` + `convertSlotsToAI()` immediately; no grace period |
| Master client disconnects or quits | `MasterPromotion.electNewMaster()` finds lowest-numbered remaining human slot's `clientUid`; that client writes `meta/masterClientUid`; all clients observe via `watchMeta` and adjust `isMaster` |
| All slots become AI | Game ends; master writes `status: "complete"` |

---

## 7. Security / Firebase Rules (sketch)

Rules enforce: only the owning client (matched by `clientUid` on the slot) may write their solutions and acks; only the current master may write turn state and promote master.

```json
{
  "rules": {
    "games": {
      "$code": {
        ".read": "auth != null",
        "meta": {
          "masterClientUid": {
            ".write": "auth.uid === data.val()"
          }
        },
        "slots": {
          "$slot": {
            ".write": "auth != null && (!data.exists() || data.child('clientUid').val() === auth.uid)"
          }
        },
        "turns": {
          "$turn": {
            "solutions": {
              "$slot": {
                ".write": "auth.uid === root.child('games').child($code).child('slots').child($slot).child('clientUid').val()"
              }
            },
            "state": {
              ".write": "auth.uid === root.child('games').child($code).child('meta').child('masterClientUid').val()"
            },
            "acks": {
              "$slot": {
                ".write": "auth.uid === root.child('games').child($code).child('slots').child($slot).child('clientUid').val()"
              }
            }
          }
        },
        "heartbeats": {
          "$uid": {
            ".write": "auth.uid === $uid"
          }
        }
      }
    },
    "stats": {
      "$code": {
        ".write": "auth != null"
      }
    }
  }
}
```

---

## 8. Automated Testing Design

Testing has three tiers: **unit**, **integration**, and **multiplayer simulation**.

### 8.1 Test runner choice: Jest vs `node:test`

The spec mandates Jest for all tiers. The original design draft used `node:test`. The considerations are recorded here for transparency.

#### `node:test` (Node built-in, available since Node 18)

**Pros:**
- Zero dependencies — no `package.json` addition, no install step, no version to pin
- Ships with Node; always available in any environment that can run the game's build tooling
- Native ES module support without configuration (`--experimental-vm-modules` flag, stable in Node 22+)
- Runs fast; no Jest transform overhead
- Outputs TAP, which is machine-parseable and directly readable by Claude for pass/fail assertion

**Cons:**
- Custom matchers require more boilerplate (no `expect.extend` ecosystem)
- No built-in mock/spy library; would need `node:test`'s `mock` module (added Node 20.18+) or manual stubs
- Snapshot testing not available out of the box
- Less familiar to most JS developers; fewer examples online
- The spec explicitly calls for Jest — a design that diverges from the spec needs a documented reason to be accepted

#### Jest

**Pros:**
- Explicitly required by the spec — no design/spec divergence
- Rich matcher ecosystem (`expect.extend`, `toMatchObject`, etc.) makes log-entry assertions clean
- `jest.fn()` / `jest.spyOn()` built in, reducing stub boilerplate
- Widely known; any contributor will be immediately productive
- `--testPathPattern` / `--testNamePattern` flags make selective runs easy
- Good Firebase Emulator integration precedent in the ecosystem

**Cons:**
- Requires a dependency and configuration (`jest.config.js`, Babel or `--experimental-vm-modules`)
- The codebase currently has no `package.json` at all — adopting Jest means introducing one, plus at minimum `jest`, `@jest/globals`, and a transform setup for ES modules
- ES module support in Jest still requires either Babel transpilation or the experimental VM modules flag, adding friction
- Slower cold start than `node:test` due to transform pipeline

#### Current project context

The game is currently a dependency-free collection of ES modules loaded directly in the browser with no bundler and no `package.json`. Introducing Jest is the larger infrastructure step; `node:test` would have zero project-structure impact.

#### Decision

**Follow the spec: use Jest.** The spec's testing section is detailed and deliberate, and the log-assertion ergonomics (`InMemorySink` + custom matchers) benefit from Jest's `expect.extend`. The infrastructure cost is real but one-time. A `package.json` with dev-only dependencies does not affect the browser runtime. The ES module friction is resolved by adding `"type": "module"` to `package.json` and using `--experimental-vm-modules` in the Jest invocation (or upgrading to Jest 30+ when it ships native ESM support).

**Minimum setup required:**
```json
// package.json (new)
{
  "type": "module",
  "devDependencies": {
    "jest": "^29",
    "@jest/globals": "^29"
  },
  "scripts": {
    "test": "node --experimental-vm-modules node_modules/.bin/jest",
    "test:unit": "node --experimental-vm-modules node_modules/.bin/jest --testPathPattern=unit",
    "test:integration": "node --experimental-vm-modules node_modules/.bin/jest --testPathPattern=integration",
    "test:simulation": "node --experimental-vm-modules node_modules/.bin/jest --testPathPattern=simulation"
  }
}
```

No Babel, no bundler. Jest runs the ES modules directly via the VM modules flag.

---

### 8.2 Test environment

- **Unit tests** — run fully in-memory; no Firebase dependency. Use `StubFirebaseClient` (see §8.2).
- **Integration tests** — require the Firebase Emulator Suite (`firebase emulators:start`). Tests write and read real Firebase paths against the emulator.
- **Simulation tests** — headless multi-client scenarios driven against the Firebase Emulator.

```powershell
# Start emulator (keep running in background)
firebase emulators:start --only database

# Run all tests
npx jest

# Run only unit tests (no emulator needed)
npx jest --testPathPattern=unit

# Run integration + simulation (emulator must be running)
npx jest --testPathPattern="integration|simulation"
```

### 8.2 `StubFirebaseClient` (unit test seam)

`FirebaseClient` is injected via `GameSession`'s constructor. Unit tests supply `StubFirebaseClient`:

- Stores data in a plain JS object tree mirroring the Firebase path structure.
- One-shot `get()` calls return immediately from the in-memory store.
- `watchMeta(cb)` stores the callback; tests call `stub.triggerMetaChange(value)` to fire it.
- `assignSlots()` performs the same consecutive-slot logic but against the in-memory store with no network.
- `stub.snapshot(path)` — read any path for assertions.
- `stub.inject(path, value)` — simulate a remote write (e.g. another client writing a solution).
- `stub.dropClient(uid)` — zeroes `heartbeats/{uid}` to simulate a stale heartbeat.

### 8.3 `InMemorySink` for log assertions

Tests inject an `InMemorySink` logger into `GameSession` and all sub-components. After exercising the system under test:

```js
expect(logger.sink.entries).toContainEvent('turn_begun', { turn: 1 });
expect(logger.sink.entries).toContainEvent('firing_solution_submitted', { slot: 0 });
expect(logger.sink.warnEntries).toContainEvent('turn_timeout');
```

`toContainEvent` is a Jest custom matcher that checks `event` and optionally `data` fields.

### 8.4 Test file layout

```
tests/
  unit/
    stubs/
      StubFirebaseClient.js
      helpers.js                  # buildSession(), buildGameState(), buildSolution(), etc.
    Serialiser.test.js
    TurnTimer.test.js
    CodeGenerator.test.js
    SlotAssignment.test.js
    DisconnectMonitor.test.js
    MasterPromotion.test.js
    HeartbeatManager.test.js
    GameSession.test.js
  integration/
    FirebaseClient.test.js        # against Firebase Emulator
  simulation/
    helpers/
      HeadlessClient.js           # no rendering, injectable solution provider
      ScriptedSolutionProvider.js # deterministic turn sequences
    TwoClientGame.test.js
    FourClientGame.test.js
    AllAIGame.test.js
    ClientDisconnect.test.js
    MasterDisconnect.test.js
    TimerExpiry.test.js
    HotSeat.test.js
    AllHumansQuit.test.js
    LateJoinRejected.test.js
```

---

## 9. Unit Test Plan

### `Serialiser.test.js`

| Test | What is verified |
|---|---|
| Round-trip: solution | `serialiseSolution → deserialiseSolution` produces structurally equal object |
| Round-trip: gameState | `serialiseGameState → deserialiseGameState` produces game with equal team/planet/station positions, scores, weapon stocks |
| Validation: valid solution | Returns `{ valid: true }` |
| Validation: missing angle | Returns `{ valid: false, errors: [...] }` |
| Unknown weapon params | `deserialiseSolution` with extra unknown fields does not throw |
| Minimal gameState | Deserialising a state with zero bullets/rockets does not crash |

### `TurnTimer.test.js`

| Test | What is verified |
|---|---|
| Countdown maths | `tick(now)` returns correct seconds remaining |
| Expiry callback | `onExpire` fires exactly once when `tick` crosses zero |
| Cancel | `cancel()` prevents `onExpire` from firing |
| Unlimited | Timer constructed with `null` duration never fires, `tick` returns `null` |

### `CodeGenerator.test.js`

| Test | What is verified |
|---|---|
| Format | Generated code is exactly 6 alphanumeric characters |
| Collision retry | When `isCodeTaken` returns `true` twice then `false`, `generateUnique` resolves on third attempt |
| No infinite loop | Resolves within reasonable attempt count |

### `SlotAssignment.test.js`

| Test | What is verified |
|---|---|
| Single slot join | Correct slot assigned, `clientUid` recorded |
| Two-slot (hot seat) join | Two consecutive slots assigned to same UID |
| Game full rejection | `assignSlots` rejects when fewer than N slots available |
| Atomic under concurrency | Two concurrent `assignSlots` calls on stub do not assign overlapping slots |

### `DisconnectMonitor.test.js`

| Test | What is verified |
|---|---|
| Fresh heartbeat | No slots marked disconnected |
| Stale heartbeat (>60s) | Slots owned by that client returned in `toDisconnect` |
| Grace expired (>60s + timer) | Slots returned in `toConvertAI` |
| Heartbeat restored | Client that was disconnected and writes fresh heartbeat returned in `toRestore` |
| Post-AI-conversion reconnect | Monitor does not restore slots already in `"ai"` status |

### `MasterPromotion.test.js`

| Test | What is verified |
|---|---|
| Simple 2-client | P2's UID returned when P1 departs |
| Skips abandoned slots | Abandoned slot not promoted |
| Skips AI slots | AI slot not promoted |
| All human slots gone | Returns `null` |
| Lowest-numbered wins | Slot 2's UID returned when slot 4 is also human |

### `HeartbeatManager.test.js`

| Test | What is verified |
|---|---|
| Writes on start | `writeHeartbeat` called immediately on `.start()` |
| Writes every 30s | Fake timer advanced 30s → second write fires |
| Stops on destroy | No writes after `.destroy()` |

### `GameSession.test.js`
Uses `StubFirebaseClient` + `InMemorySink`.

| Test | What is verified |
|---|---|
| `createGame` | Writes correct meta; returns 6-char code; logs `game_created` |
| Code collision handled | Retries until unique code found |
| `joinGame` — success | Assigns consecutive slots; logs `client_joined` |
| `joinGame` — full | Rejects; error logged |
| `joinGame` — started | Rejects; error logged |
| `isMaster` | True for slot-0 UID, false for others |
| `submitSolutions` batch | Writes all owned slots in single update |
| Hot seat: solutions buffered | Local solutions not written until all owned slots submit |
| `pollUntilAllSolutions` | Resolves after all slots have solutions in stub |
| `pollUntilTurnState` | Resolves after master writes state to stub |
| `writeTurnState` | Writes serialised payload; logs `authoritative_state_written` |
| `checkAndHandleDisconnects` — triggers disconnect | Stale heartbeat → `markSlotsDisconnected` called; logs slot status change |
| `checkAndHandleDisconnects` — grace expiry | Past grace → `convertSlotsToAI` called; logs AI takeover |
| Master promotion trigger | Stale master heartbeat → `electNewMaster` → `writeMasterPromotion` called |
| `startEarly` | Converts unfilled slots to AI; writes updated meta |

---

## 10. Integration Test Plan (`integration/FirebaseClient.test.js`)

All tests run against the Firebase Emulator. Each test runs in an isolated game code namespace.

| Test | What is verified |
|---|---|
| Game creation + retrieval | `createGame` then `getGameMeta` returns expected shape |
| `isCodeTaken` | Returns false before creation, true after |
| Atomic slot assignment — sequential | Two joins of 1 slot each get slots 0 and 1 |
| Atomic slot assignment — concurrent | Two simultaneous `assignSlots` calls get non-overlapping slots |
| Firing solution write + read | `writeSolution` then `getSolutions` returns the written DTO |
| Heartbeat write + read | `writeHeartbeat` then `getSlots` shows updated `lastSeen` |
| Authoritative state write + read | `writeTurnState` then `getTurnState` returns payload |
| Ack write + read | `writeAck` then `getAcks` confirms ack present |
| Slot status transitions | `markSlotsDisconnected` → `convertSlotsToAI` → slot shows `"ai"` |
| Master promotion | `writeMasterPromotion` updates `meta/masterClientUid`; `watchMeta` callback fires |

---

## 11. Simulation Test Plan

Each simulation test uses `HeadlessClient` instances wired to the Firebase Emulator via real `FirebaseClient`. Each client has an injectable `ScriptedSolutionProvider` that returns deterministic angle/power/weapon values per turn.

Assertions are made against:
- **Final game state** (winner, turn count, slot statuses)
- **Log entries** in each client's `InMemorySink`
- **Firebase Emulator data** (turn records, slot statuses, stats node)

| Test | Scenario | Key assertions |
|---|---|---|
| `TwoClientGame` | 2 human clients, play to completion | Game ends; `game_completed` logged; stats written |
| `FourClientGame` | 4 clients (1 slot each), play to completion | All turns complete; acks from all 4 clients each turn |
| `AllAIGame` | Single master client, all AI slots | Starts without any join; all solutions generated by master; completes |
| `ClientDisconnect` | Client B stops heartbeating mid-game | B's slots transition `disconnected → ai`; game continues; AI takeover logged |
| `MasterDisconnect` | Master stops heartbeating mid-game | New master elected; `master_promoted` logged on all clients; game continues |
| `TimerExpiry` | Client B never submits solution | Timer fires; auto-submit with default hyperspace solution; `turn_timeout` warned; turn completes |
| `HotSeat` | Single client owns 3 consecutive slots | Solutions batched; all 3 submitted together; turn flow correct |
| `AllHumansQuit` | All human clients call `destroy()` | Game ends with AI-only result; `game_abandoned` logged |
| `LateJoin_Full` | Join attempted when all slots taken | Rejected with full-game error |
| `LateJoin_Started` | Join attempted after game started | Rejected with started-game error |

---

## 12. Production Monitoring

The following events are surfaced via Firebase Analytics in addition to the structured log:

| Condition | Log Level | Event name |
|---|---|---|
| Turn open for >2× timer duration | WARN | `turn_stuck` |
| Client not heartbeated within 60s | WARN | `heartbeat_missing` |
| Firebase operation failure | ERROR | `firebase_error` (includes operation type + error code) |

All WARN and ERROR events are forwarded to Firebase Analytics as custom events for dashboard visibility.

---

## 13. Analytics Events

| Trigger | Event | Parameters |
|---|---|---|
| Game created | `game_created` | `total_count`, `human_count`, `ai_count` |
| Game starts | `game_started` | `total_count`, `human_count`, `ai_count` |
| Game ends normally | `game_completed` | `total_turns` |
| Any client abandons | `game_abandoned` | `turn_number` |
| Timer auto-submit | `turn_timeout` | — |

Additionally, `Analytics.gameCompleted()` and `Analytics.gameAbandoned()` write a record to `/stats/{code}` for custom querying.

---

## 14. Implementation Order

1. `Logger.js` + sinks — no dependencies; needed by everything
2. `Serialiser.js` + `unit/Serialiser.test.js`
3. `TurnTimer.js` + `unit/TurnTimer.test.js`
4. `CodeGenerator.js` + `unit/CodeGenerator.test.js`
5. `DisconnectMonitor.js` + `unit/DisconnectMonitor.test.js`
6. `MasterPromotion.js` + `unit/MasterPromotion.test.js`
7. `HeartbeatManager.js` + `unit/HeartbeatManager.test.js`
8. `StubFirebaseClient.js` + `helpers.js`
9. `GameSession.js` + `unit/GameSession.test.js`
10. `FirebaseClient.js` (real) + `integration/FirebaseClient.test.js` (emulator)
11. `simulation/HeadlessClient.js` + `simulation/ScriptedSolutionProvider.js`
12. All simulation tests
13. `LobbyScreen.js` + `JoinScreen.js` + `Analytics.js` — UI + analytics
14. Wire into `main.js` + `GameLoop.js`
15. Firebase security rules deploy + manual end-to-end smoke test

---

## 15. Open Questions (all resolved)

| ID | Question | Decision |
|---|---|---|
| OQ-1 | Turn 1 default auto-submit | Hyperspace (no-shot) |
| OQ-2 | Master disconnect behaviour | Promote to client owning lowest-numbered remaining human slot |
| OQ-3 | Short code format | 6 alphanumeric characters |
| OQ-4 | Auto-start when slots fill | Yes, triggers automatically |
