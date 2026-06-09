# Remote Multiplayer — Design Document

**Status:** Draft  
**Date:** 2026-06-09  
**Spec:** [remote-multiplayer-spec.md](remote-multiplayer-spec.md)

---

## 1. Architecture Overview

The system uses Firebase Realtime Database as a turn relay and authoritative state store. All game logic runs client-side; Firebase is a dumb message bus plus one source of truth (the master client's post-turn state write).

**Roles:**
- **Master client** — Player 1 (game creator). Runs AI turns, performs the authoritative post-turn state write, promotes no one on disconnect (game ends).
- **Non-master clients** — Players 2–12. Run simulation locally for visual continuity, then overwrite their state with the master write.

```
┌─────────────┐     writes firing solution     ┌─────────────────────┐
│  Human P2   │ ─────────────────────────────► │  Firebase RTDB      │
│  client     │                                 │                     │
└─────────────┘                                 │  /games/{code}/     │
                                                │    meta             │
┌─────────────┐  writes AI + own solution       │    turns/{n}/       │
│  Master P1  │ ─────────────────────────────► │      solutions/     │
│  client     │ ◄──────────────────────────── │      state          │
│             │  reads all solutions; writes   │    presence/        │
└─────────────┘  authoritative post-turn state └─────────────────────┘
```

---

## 2. Firebase Data Model

```
/games/{code}/
  meta/
    status:         "lobby" | "starting" | "active" | "complete"
    totalSlots:     number          // 2–12
    humanSlots:     number          // human count
    timerSeconds:   number | null   // null = Unlimited
    createdAt:      ServerValue.TIMESTAMP
    startedAt:      ServerValue.TIMESTAMP | null
    config:         { ... }         // ScenarioFactory seed + options
    rng:            string          // serialised RNG seed
  slots/
    {slotIndex}/                    // "0"–"11"
      type:         "human" | "ai"
      uid:          string | null   // Firebase anonymous UID
      status:       "waiting" | "joined" | "disconnected" | "abandoned"
  turns/
    {turnIndex}/                    // "0", "1", …
      startedAt:    ServerValue.TIMESTAMP
      solutions/
        {slotIndex}/                // keyed by slot, e.g. "0"
          angle:    number
          power:    number
          weapon:   string          // WeaponId
          params:   object | null   // weapon-specific extras
      state/                        // written by master after simulation
        payload:    string          // JSON-serialised GameState snapshot
        writtenAt:  ServerValue.TIMESTAMP
      acks/
        {slotIndex}: true           // non-master clients confirm receipt
  presence/
    {uid}: ServerValue.TIMESTAMP    // updated via onDisconnect cleanup
```

### Key design decisions

- **`turns/{n}/state`** is write-once from the master; non-masters listen and apply on receipt.
- **`acks/`** lets the master advance the turn only after all connected human slots confirm receipt, preventing a race where a slow client misses the state write.
- **`presence/`** uses Firebase's `onDisconnect` to mark a UID as gone; the master listens and marks the relevant slot.
- **`config` + `rng`** are written at game creation so all clients can reconstruct an identical initial scene.

---

## 3. Module Breakdown

### 3.1 `src/multiplayer/FirebaseClient.js`
Low-level wrapper over the Firebase JS SDK. Exposes typed read/write/listen helpers. No game logic here.

```
FirebaseClient
  .init(firebaseConfig)
  .signInAnonymously() → Promise<uid>
  .createGame(gameData)  → Promise<code>
  .joinGame(code, uid)   → Promise<slotIndex>
  .watchSlots(code, cb)
  .watchTurnSolutions(code, turn, cb)
  .watchTurnState(code, turn, cb)
  .writeSolution(code, turn, slotIndex, solution)
  .writeTurnState(code, turn, payload)
  .writeAck(code, turn, slotIndex)
  .watchPresence(code, cb)
  .setOnDisconnect(code, uid)
```

### 3.2 `src/multiplayer/GameSession.js`
Coordinates the multiplayer flow. Owns the Firebase connection lifecycle and bridges into the existing `GameLoop` / `GameState` machinery.

```
GameSession
  .createGame(config)    → Promise<{code, url}>
  .joinGame(code)        → Promise<slotIndex>
  .isMaster              → boolean
  .submitSolution(sol)
  .onAllSolutionsReady(cb)
  .onTurnStateReady(cb)
  .writeTurnState(gameState)
  .onPlayerDisconnect(cb)
  .destroy()
```

### 3.3 `src/multiplayer/Serialiser.js`
Stateless pure functions. No Firebase dependency.

```
serialiseSolution(station, aimState)  → FiringSolutionDTO
deserialiseSolution(dto)              → FiringSolution

serialiseGameState(gameState)         → string  (JSON)
deserialiseGameState(json)            → GameState
```

### 3.4 `src/multiplayer/TurnTimer.js`
Derives a countdown from a Firebase server timestamp. Fires a callback on expiry. Used by all clients identically.

```
TurnTimer(serverStartMs, durationSec, onExpire)
  .start()
  .tick(nowMs)   → secondsRemaining
  .cancel()
```

### 3.5 `src/ui/LobbyScreen.js`
Replaces the `ConfigPanel` for multiplayer games. Shows game code, shareable URL, player slot list, and start trigger once all human slots fill.

### 3.6 `src/ui/JoinScreen.js`
Code-entry screen. Pre-populates from URL parameter. Validates against Firebase, routes to lobby or error.

### 3.7 Integration points in `src/main.js`
- New entry-point path: `"Create Game"` / `"Join Game"` buttons on the config panel surface `LobbyScreen` / `JoinScreen`.
- `GameLoop` gains a `multiplayerSession` option. When set, `waitingForInput` does not advance until `GameSession.onAllSolutionsReady` fires, and the end-of-turn state write is called before advancing.
- `AIController` is gated: only runs when `gameSession.isMaster`.

---

## 4. Turn Flow (state machine)

```
LOBBY
  └─ all human slots joined ──► STARTING (1s countdown, then)
AIMING
  ├─ human submits → writeSolution()
  ├─ master submits AI solutions → writeSolution() × n
  └─ onAllSolutionsReady → SIMULATING
SIMULATING
  ├─ all clients run physics
  └─ master: serialiseGameState → writeTurnState()
             non-masters: onTurnStateReady → deserialise + apply → writeAck()
             master: onAllAcks → advance turn
GAME_OVER
  └─ master writes final state → all clients show results
```

---

## 5. Disconnection Handling

| Event | Behaviour |
|---|---|
| Non-master disconnects | Slot marked `disconnected`; their turns auto-submit via timer expiry |
| Master (P1) disconnects | Game ends immediately; all clients receive `status: "complete"` with no winner |
| All remaining slots are AI | Master ends the game |
| Player abandons via menu | Slot marked `abandoned`; same as disconnect for turn purposes |

---

## 6. Security / Firebase Rules (sketch)

```json
{
  "rules": {
    "games": {
      "$code": {
        ".read": "auth != null",
        "meta": {
          ".write": "auth != null && (!data.exists() || data.child('slots').child(auth.uid) !== null)"
        },
        "turns": {
          "$turn": {
            "solutions": {
              "$slot": {
                ".write": "auth.uid === root.child('games').child($code).child('slots').child($slot).child('uid').val()"
              }
            },
            "state": {
              ".write": "auth.uid === root.child('games').child($code).child('slots').child('0').child('uid').val()"
            },
            "acks": {
              "$slot": {
                ".write": "auth.uid === root.child('games').child($code).child('slots').child($slot).child('uid').val()"
              }
            }
          }
        }
      }
    }
  }
}
```

Rules enforce: only the owning UID writes their solution/ack; only the master (slot 0) writes turn state.

---

## 7. Automated Testing Design

All automated testing is designed to run without a live Firebase connection. The Firebase dependency is fully injectable so Claude (or any CI runner) can drive complete integration tests from the command line with `node --experimental-vm-modules`.

### 7.1 Test seam: `FirebaseClient` stub

`FirebaseClient` is injected via `GameSession`'s constructor. Tests supply `StubFirebaseClient`, a fully synchronous in-memory implementation that:

- Stores data in a plain JS object tree mirroring the Firebase path structure.
- Fires registered listeners immediately on write (synchronous event loop).
- Exposes `stub.snapshot(path)` for assertions and `stub.inject(path, value)` to simulate remote writes.
- Has `stub.dropClient(uid)` to simulate a disconnection (triggers `onDisconnect` callbacks).

This means no network, no emulator, no async timeouts in tests.

### 7.2 Test runner

Tests are plain ES modules using Node's built-in `node:test` runner (no framework dependency). Run with:

```powershell
node --experimental-vm-modules --test tests/multiplayer/**/*.test.js
```

### 7.3 Test file layout

```
tests/
  multiplayer/
    stubs/
      StubFirebaseClient.js
      helpers.js              # buildTwoPlayerSession(), buildGameState(), etc.
    Serialiser.test.js
    TurnTimer.test.js
    GameSession.test.js
    TurnFlow.integration.test.js
    Disconnection.test.js
```

### 7.4 Test plan by module

#### `Serialiser.test.js`
Pure functions — no stubs needed.

| Test | What is verified |
|---|---|
| Round-trip: solution | `serialiseSolution → deserialiseSolution` produces structurally equal object |
| Round-trip: gameState | `serialiseGameState → deserialiseGameState` produces game with same team/planet/station positions, scores, weapon stocks |
| Unknown weapon params | `deserialiseSolution` with extra unknown fields does not throw |
| Minimal gameState | Deserialising a state with zero bullets/rockets does not crash |

#### `TurnTimer.test.js`

| Test | What is verified |
|---|---|
| Countdown maths | `tick(now)` returns correct seconds remaining given a known `serverStartMs` |
| Expiry callback | `onExpire` fires exactly once when `tick` crosses zero |
| Cancel | `cancel()` prevents `onExpire` from firing |
| Unlimited | Timer constructed with `null` duration never fires expiry |

#### `GameSession.test.js`
Uses `StubFirebaseClient`.

| Test | What is verified |
|---|---|
| createGame | Writes correct meta shape to stub; returns 6-char alphanumeric code |
| joinGame — success | Assigns UID to correct slot; resolves with slot index |
| joinGame — game full | Rejects with appropriate error |
| joinGame — already started | Rejects with appropriate error |
| isMaster | True for slot 0 UID, false for others |
| submitSolution | Writes correct DTO to `turns/{n}/solutions/{slot}` |
| onAllSolutionsReady fires | Fires callback after all slots have written |
| writeTurnState | Writes serialised payload to `turns/{n}/state` |
| onTurnStateReady fires (non-master) | Non-master callback fires when master writes state |
| writeAck | Writes `true` to `turns/{n}/acks/{slot}` |

#### `TurnFlow.integration.test.js`
Drives two `GameSession` instances (master + P2) against a single `StubFirebaseClient`.

| Test | What is verified |
|---|---|
| Full 2-player turn | Both sessions submit solutions → master receives `onAllSolutionsReady` → master writes state → P2 receives `onTurnStateReady` → both advance |
| AI submission by master | Master submits an AI solution; slot count still satisfies ready condition |
| Timer expiry auto-submit | `TurnTimer` fires; P2's last solution auto-submitted; turn still completes |
| Turn 1 default solution | P2 has no prior solution; auto-submit uses the hyperspace no-shot default |
| Multi-turn sequence | Three sequential turns complete without stale listener accumulation |

#### `Disconnection.test.js`

| Test | What is verified |
|---|---|
| Non-master disconnect | `stub.dropClient(p2uid)` → slot marked `disconnected` → master's `onPlayerDisconnect` cb fires with slot index |
| Disconnected player's turn | Turn still completes when disconnected player's timer auto-submits |
| Master disconnect | `stub.dropClient(p1uid)` → game status set to `complete` → non-master session receives game-over signal |
| All-AI remaining | After all human slots disconnect, game ends |

### 7.5 Claude running the tests

To run all multiplayer tests:

```powershell
node --experimental-vm-modules --test tests/multiplayer/**/*.test.js
```

To run a single file during development:

```powershell
node --experimental-vm-modules --test tests/multiplayer/TurnFlow.integration.test.js
```

Expected clean output (all passing):

```
TAP version 13
# Subtest: Serialiser
ok 1 - round-trip solution
ok 2 - round-trip gameState
...
# tests 24
# pass  24
# fail  0
```

Claude should run the full suite after implementing each module and report pass/fail counts. On any failure, Claude should read the failing test name and the assertion message before making a code change — do not guess at the fix.

---

## 8. Implementation Order

1. `Serialiser.js` + `Serialiser.test.js` — no dependencies, unblocks everything
2. `TurnTimer.js` + `TurnTimer.test.js`
3. `StubFirebaseClient.js` + `helpers.js`
4. `FirebaseClient.js` (real) — no tests against live Firebase; verified manually
5. `GameSession.js` + `GameSession.test.js`
6. `TurnFlow.integration.test.js`
7. `Disconnection.test.js`
8. `LobbyScreen.js` + `JoinScreen.js` — UI, verified manually in browser
9. Wire into `main.js` + `GameLoop.js`
10. Firebase security rules deploy + manual end-to-end smoke test

---

## 9. Open Questions (resolved from spec)

| ID | Question | Decision |
|---|---|---|
| OQ-1 | Turn 1 default auto-submit | Hyperspace (no-shot) |
| OQ-2 | Master disconnect | End game immediately |
| OQ-3 | Short code format | 6 alphanumeric characters |
| OQ-4 | Auto-start when slots fill | Yes, triggers automatically |
