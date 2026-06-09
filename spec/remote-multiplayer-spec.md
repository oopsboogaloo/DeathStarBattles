# Remote Multiplayer — requirements.md

## Feature Overview

Turn-based remote multiplayer for Death Star Battles, supporting 2–12 human and/or AI players. Uses Firebase Realtime Database as a turn relay and authoritative state store. No in-game communication of any kind. Player 1 (game creator) is the master client responsible for AI turn generation and authoritative post-simulation state.

A client may own one or more player slots, supporting hot seat play within a single client alongside remote play across multiple clients. All slot ownership, turn submission, heartbeat, and disconnect behaviour is managed at the client level.

---

## Functional Requirements

### Game Creation

WHEN a player selects "Create Game"
THE SYSTEM SHALL create a new game record in Firebase with a unique short alphanumeric code
AND display the short code to the player
AND display a full shareable URL embedding the game code
AND designate the creating client as the master client
AND prompt the creating client to specify how many local human players are on this client
AND assign that many consecutive player slots to the creating client, beginning at Player 1

WHEN generating a short game code
THE SYSTEM SHALL verify the generated code does not already exist in Firebase before writing
AND if a collision is detected SHALL regenerate until a unique code is found

WHEN Player 1 configures a new game
THE SYSTEM SHALL allow configuration of the following before the game starts:
- Total player count (2–12)
- Number and position of AI players within that count
- Turn timer duration (30s / 60s / 120s / Unlimited)

WHEN all player slots are AI
THE SYSTEM SHALL not require any further clients to join and SHALL start immediately

---

### Game Joining

WHEN a client navigates to a URL containing a valid game code parameter
THE SYSTEM SHALL automatically populate the join screen with that game code

WHEN a client submits a valid game code on the join screen
THE SYSTEM SHALL prompt the joining client to specify how many local human players are on this client

WHEN a client submits a join request specifying N local human players
AND the game exists in Firebase
AND the game has not yet started
AND at least N human player slots are available
THE SYSTEM SHALL assign N consecutive slots to the joining client using a Firebase atomic transaction to prevent double-assignment
AND record the client's anonymous Firebase identity against all assigned slots

WHEN a client submits a join request and insufficient human slots are available
THE SYSTEM SHALL display a game is full error message and reject the client

WHEN a client submits a game code for a game that does not exist or has already started
THE SYSTEM SHALL display an appropriate error message

WHEN all human player slots are filled
THE SYSTEM SHALL auto-start the game and notify all connected clients

WHEN Player 1 chooses to start the game early from the lobby before all human slots are filled
THE SYSTEM SHALL convert all unfilled human slots to AI control
AND start the game immediately

WHEN the game starts with unfilled slots converted to AI
THE SYSTEM SHALL treat those slots identically to slots configured as AI at game creation

---

### Anonymous Authentication

WHEN any client loads the game
THE SYSTEM SHALL authenticate the client anonymously via Firebase Anonymous Auth
AND persist that identity for the session

---

### Turn Timer

WHEN a new turn begins
THE SYSTEM SHALL write a server timestamp to Firebase as the turn start time
AND all clients SHALL derive the countdown from that timestamp, not local clock time

WHEN the turn timer expires for a slot whose owning client has not submitted a firing solution
THE SYSTEM SHALL automatically submit that slot's last firing solution on its behalf
AND if no previous firing solution exists (turn 1) SHALL submit a hyperspace firing solution as the default

WHEN the turn timer is set to Unlimited
THE SYSTEM SHALL not enforce any time limit and wait indefinitely for all submissions

---

### Firing Solution Submission

WHEN all local human players on a client have confirmed their firing solutions for the current turn
THE SYSTEM SHALL serialise all firing solutions to defined JSON structures
AND write them to Firebase under the current turn's firing solutions map, keyed by player slot

WHEN the master client detects that an AI player slot has not yet submitted a firing solution
THE SYSTEM SHALL generate a firing solution for that AI slot locally
AND submit it to Firebase as if it were a human submission

WHEN all player slots have submitted a firing solution for the current turn
THE SYSTEM SHALL signal all clients that simulation may begin

---

### Hot Seat Turn Sequencing

WHEN a client owns multiple human player slots
THE SYSTEM SHALL present each local player's firing input in slot order within the turn
AND not reveal other local players' inputs until all local players have submitted
AND submit all owned slot firing solutions to Firebase as a single batch

---

### Simulation and State Sync

WHEN all firing solutions are received
THE SYSTEM SHALL trigger simulation on all clients simultaneously

WHEN simulation completes on the master client
THE SYSTEM SHALL serialise the full resulting game state to a defined JSON structure
AND write it to Firebase as the authoritative post-turn state

WHEN a non-master client receives the authoritative post-turn state from Firebase
THE SYSTEM SHALL overwrite its local game state with the received state
AND if simulation has already completed locally SHALL apply the correction silently

WHEN the authoritative state has been written and all clients have confirmed receipt
THE SYSTEM SHALL advance to the next turn

---

### Serialisation

WHEN a firing solution is serialised
THE SYSTEM SHALL produce a JSON structure capturing all inputs required to define a player's turn action (angle, power, weapon type, and any weapon-specific parameters)

WHEN a firing solution is deserialised
THE SYSTEM SHALL reconstruct the equivalent local firing solution object from the JSON structure

WHEN game state is serialised
THE SYSTEM SHALL produce a JSON structure capturing the complete state of all game entities sufficient to fully reconstruct the game at that point (player states, positions, scores, remaining weapons, simulation body states)

WHEN game state is deserialised
THE SYSTEM SHALL reconstruct the full local game state from the JSON structure without requiring any prior simulation

---

### Player and Connection Status

WHEN a client is active in a game
THE SYSTEM SHALL write a heartbeat timestamp to Firebase on behalf of all its owned slots every 30 seconds

WHEN any client polls Firebase for turn state
THE SYSTEM SHALL check the lastSeen timestamp of all player slots
AND if any slot's lastSeen is older than 60 seconds SHALL mark all slots owned by that client as disconnected

WHEN a client's slots are marked as disconnected
THE SYSTEM SHALL make the disconnected status visible to all players within the next poll cycle
AND allow one full turn timer duration as a reconnection grace period before converting those slots to AI control

WHEN a disconnected client writes a heartbeat before the grace period expires
THE SYSTEM SHALL restore all its owned slots to human status
AND resume normal play

WHEN a disconnected client attempts to reconnect after its slots have been converted to AI
THE SYSTEM SHALL reject the reconnection and display an appropriate message
AND those slots SHALL remain under AI control

WHEN the reconnection grace period expires for a disconnected client's slots
THE SYSTEM SHALL permanently convert all those slots to AI control
AND make the AI takeover visible to all players

---

### Voluntary Quit

WHEN a client selects quit from the in-game menu
THE SYSTEM SHALL immediately mark all its owned slot statuses as abandoned in Firebase
AND convert all those slots to AI control
AND make the abandoned status visible to all players within the next poll cycle

---

### AI Takeover

WHEN one or more player slots are converted to AI control (abandoned or disconnected)
THE SYSTEM SHALL update those slot statuses to ai in Firebase
AND the master client SHALL immediately assume responsibility for generating firing solutions for those slots each turn
AND all clients SHALL display those slots as AI-controlled with a visible indicator

WHEN the master client's slots are converted to AI control
THE SYSTEM SHALL promote the client owning the lowest-numbered remaining human slot to master client
AND that client SHALL assume responsibility for AI turn generation and authoritative state writes from that point forward
AND all clients SHALL be notified of the new master via Firebase

WHEN all remaining active slots are AI-controlled
THE SYSTEM SHALL end the game and display an appropriate result

---

### Game Completion

WHEN the game ends by normal victory conditions
THE SYSTEM SHALL write the final game state to Firebase
AND display results to all connected clients

---

## Analytics

WHEN a game is created
THE SYSTEM SHALL log a game_created event with total player count, human player count, and AI player count

WHEN a game starts
THE SYSTEM SHALL log a game_started event with total player count, human player count, and AI player count

WHEN a game ends by normal victory conditions
THE SYSTEM SHALL log a game_completed event with total turns played

WHEN a game is abandoned by any client
THE SYSTEM SHALL log a game_abandoned event with the turn number at abandonment

WHEN a turn timer expires and auto-submit fires
THE SYSTEM SHALL log a turn_timeout event

THE SYSTEM SHALL use Firebase Analytics for event logging
THE SYSTEM SHALL additionally write game outcome records to a /stats node in Firebase for custom querying

---

## Non-Functional Requirements

THE SYSTEM SHALL NOT provide any in-game text input, chat, or messaging capability of any kind
THE SYSTEM SHALL NOT display player-entered names; players are identified by slot designation only (Player 1, Player 2, etc.)
THE SYSTEM SHALL use Firebase server timestamps for all timer synchronisation to eliminate client clock skew
THE SYSTEM SHALL treat AI player submissions identically to human player submissions in the Firebase data model
THE SYSTEM SHALL use one-shot polling to detect opponent turn submission rather than persistent Firebase listeners, to avoid consuming simultaneous connection quota
THE SYSTEM SHALL poll at no greater than 1 second intervals while waiting for opponent submissions
THE SYSTEM SHALL cease polling when not actively waiting for opponent input

---

## Logging

THE SYSTEM SHALL emit structured JSON log entries for all significant events
THE SYSTEM SHALL support log levels DEBUG, INFO, WARN, and ERROR
THE SYSTEM SHALL tag every log entry with: timestamp, gameId, clientId, owned slot IDs, and current turn number
THE SYSTEM SHALL be designed for machine parsing; logs are the primary mechanism for automated test assertion

THE SYSTEM SHALL log at INFO level the following events:
- Game created (with configuration)
- Client joined (with slot assignments)
- Game started
- Turn begun (with turn number and server timestamp)
- Firing solution submitted (per slot)
- All firing solutions received
- Simulation started
- Simulation completed
- Authoritative state written (master client)
- Authoritative state received and applied (non-master client)
- Turn advanced
- Heartbeat written (per client)
- Slot status change (human / disconnected / abandoned / ai)
- Master client promotion
- AI firing solution generated (per slot)
- Timer expiry and auto-submit triggered
- Game ended (with result)

THE SYSTEM SHALL log at WARN level:
- Slot lastSeen approaching disconnect threshold
- Firebase write retry
- Firing solution auto-submitted due to timer expiry
- Reconnection rejected (slot already converted to AI)

THE SYSTEM SHALL log at ERROR level:
- Firebase read/write failure
- Deserialisation failure
- Master promotion failure
- Unexpected game state

THE SYSTEM SHALL expose a log sink interface injectable at runtime, supporting:
- Console output (development)
- In-memory buffer (automated testing)
- No-op sink (production, to suppress verbose output)

---

## Automated Testing

### Unit Tests

THE SYSTEM SHALL provide a Jest unit test suite covering:
- Firing solution serialisation round-trip (serialise then deserialise produces identical object)
- Game state serialisation round-trip (serialise then deserialise produces identical state)
- Firing solution validation (valid and invalid inputs)
- AI firing solution generation (produces valid firing solution)
- Timer logic (expiry detection, auto-submit trigger, server timestamp derivation)
- Short code generation (correct format, collision retry behaviour)
- Slot assignment logic (correct consecutive assignment, full game rejection)
- Master promotion logic (correct client promoted under all disconnect/quit scenarios)
- Heartbeat timestamp freshness evaluation

### Integration Tests

THE SYSTEM SHALL provide a Jest integration test suite using a Firebase Emulator instance covering:
- Firebase game record creation and retrieval
- Atomic slot assignment under concurrent join requests
- Firing solution write and detection
- Heartbeat write and staleness detection
- Authoritative state write and receipt
- Slot status transitions (human → disconnected → ai)
- Master promotion written to and read from Firebase

### Multiplayer Simulation Tests

THE SYSTEM SHALL provide headless multiplayer simulation tests runnable under Jest covering the following scenarios:
- Two-client game plays to completion
- Four-client game plays to completion
- Single-client all-AI game plays to completion
- Client disconnect mid-game triggers AI takeover and game continues
- Master client disconnect triggers master promotion and game continues
- Turn timer expiry triggers auto-submit and game continues
- Client with multiple local slots plays to completion
- All human clients quit leaving only AI — game ends correctly
- Late join rejected when game is full
- Late join rejected when game has started

THE SYSTEM SHALL implement headless clients with:
- No rendering or browser dependency
- Injectable firing solution providers (scripted sequences for deterministic test scenarios)
- In-memory log sink for assertion against emitted log entries
- Assertions on final game state, turn count, slot statuses, and log events
- No reliance on screenshots or visual output for pass/fail determination

THE SYSTEM SHALL use the Firebase Emulator Suite for all integration and simulation tests to avoid consuming production quota

---

## Production Monitoring

THE SYSTEM SHALL log a turn_stuck WARNING event when a turn has been open for longer than 2× the configured timer duration
THE SYSTEM SHALL log a heartbeat_missing WARNING event when a client has not heartbeated within 60 seconds
THE SYSTEM SHALL log a firebase_error ERROR event for any Firebase operation failure including the operation type and error code
THE SYSTEM SHALL surface all WARN and ERROR level production events via Firebase Analytics custom events for dashboard visibility

---

## Open Questions

OQ-1: RESOLVED — default firing solution for turn 1 auto-submit is hyperspace
OQ-2: RESOLVED — when the master client disconnects or quits, master client responsibility is promoted to the client owning the lowest-numbered remaining human slot
OQ-3: RESOLVED — short code is 6 alphanumeric characters
OQ-4: RESOLVED — game auto-starts when all human player slots are filled, no explicit start action required
