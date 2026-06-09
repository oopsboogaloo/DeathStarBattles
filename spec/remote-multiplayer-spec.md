# Remote Multiplayer — requirements.md

## Feature Overview

Turn-based remote multiplayer for Death Star Battles, supporting 2–12 human and/or AI players. Uses Firebase Realtime Database as a turn relay and authoritative state store. No in-game communication of any kind. Player 1 (game creator) is the master client responsible for AI turn generation and authoritative post-simulation state.

---

## Functional Requirements

### Game Creation

WHEN a player selects "Create Game"
THE SYSTEM SHALL create a new game record in Firebase with a unique short alphanumeric code
AND display the short code to the player
AND display a full shareable URL embedding the game code
AND designate the creating player as Player 1 and master client
AND record Player 1 as the first entry in the player slots

WHEN Player 1 configures a new game
THE SYSTEM SHALL allow configuration of the following before the game starts:
- Total player count (2–12)
- Number and position of AI players within that count
- Turn timer duration (30s / 60s / 120s / Unlimited)

WHEN all player slots are AI
THE SYSTEM SHALL not require any further players to join and SHALL start immediately

---

### Game Joining

WHEN a player navigates to a URL containing a valid game code parameter
THE SYSTEM SHALL automatically populate the join screen with that game code

WHEN a player submits a valid game code on the join screen
AND the game exists in Firebase
AND the game has not yet started
AND a human player slot is available
THE SYSTEM SHALL assign the joining player to the next available human slot
AND record their anonymous Firebase identity against that slot

WHEN a player submits a game code that does not exist or is already full or started
THE SYSTEM SHALL display an appropriate error message

WHEN all human player slots are filled
THE SYSTEM SHALL mark the game as ready to start
AND notify all connected clients that the game is starting

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

WHEN the turn timer expires for a player who has not submitted a firing solution
THE SYSTEM SHALL automatically submit that player's last firing solution on their behalf
AND if no previous firing solution exists (turn 1) SHALL submit a defined default firing solution

WHEN the turn timer is set to Unlimited
THE SYSTEM SHALL not enforce any time limit and wait indefinitely for all submissions

---

### Firing Solution Submission

WHEN a human player confirms their firing solution
THE SYSTEM SHALL serialise the firing solution to a defined JSON structure
AND write it to Firebase under the current turn's firing solutions map, keyed by player slot

WHEN Player 1's client detects that an AI player slot has not yet submitted
THE SYSTEM SHALL generate a firing solution for that AI player locally
AND submit it to Firebase as if it were a human submission

WHEN all player slots have submitted a firing solution for the current turn
THE SYSTEM SHALL signal all clients that simulation may begin

---

### Simulation and State Sync

WHEN all firing solutions are received
THE SYSTEM SHALL trigger simulation on all clients simultaneously

WHEN simulation completes on the master client (Player 1)
THE SYSTEM SHALL serialise the full resulting game state to a defined JSON structure
AND write it to Firebase as the authoritative post-turn state

WHEN the non-master client receives the authoritative post-turn state from Firebase
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

WHEN a client connects to an active game
THE SYSTEM SHALL record their presence in Firebase

WHEN a client disconnects from an active game
THE SYSTEM SHALL mark that player slot as disconnected
AND notify all remaining clients

WHEN a disconnected player's turn timer expires
THE SYSTEM SHALL apply the default auto-submit behaviour as normal

WHEN all remaining connected players are AI players only
THE SYSTEM SHALL end the game and display an appropriate result

---

### Game Completion

WHEN the game ends by normal victory conditions
THE SYSTEM SHALL write the final game state to Firebase
AND display results to all connected clients

WHEN a player abandons the game via the menu
THE SYSTEM SHALL mark their slot as abandoned in Firebase
AND remaining players shall continue under auto-submit timer rules

---

## Non-Functional Requirements

THE SYSTEM SHALL NOT provide any in-game text input, chat, or messaging capability of any kind
THE SYSTEM SHALL NOT display player-entered names; players are identified by slot designation only (Player 1, Player 2, etc.)
THE SYSTEM SHALL use Firebase server timestamps for all timer synchronisation to eliminate client clock skew
THE SYSTEM SHALL treat AI player submissions identically to human player submissions in the Firebase data model

---

## Open Questions

OQ-1: Default firing solution for turn 1 auto-submit — exact definition TBD (e.g. minimum power, straight up) - Hyperspace. No shot.
OQ-2: Behaviour when Player 1 (master client) disconnects — promote Player 2 to master, or end game? End game.
OQ-3: Exact short code format and length (e.g. 6 alphanumeric chars) - 6 alphanumeric chars is good
OQ-4: Whether "ready to start" requires Player 1 to explicitly confirm, or triggers automatically when slots are full. trigger automatically