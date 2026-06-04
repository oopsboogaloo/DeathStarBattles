# Named Seeds — Requirements Specification

## NS-01 Seed Input

The config panel Page 2 (World) shall include a **Seed** text input field, positioned immediately above the Scenario option.

The field shall accept any sequence of printable characters up to 32 characters in length.

WHEN the Seed field is empty, the Scenario and Planets options shall behave as normal.

WHEN the Seed field contains one or more non-whitespace characters, the Scenario and Planets options shall be disabled and visually greyed out.

---

## NS-02 Seed Normalisation

WHEN a seed string is used, the system shall normalise it by:

1. Trimming leading and trailing whitespace.
2. Converting all characters to lowercase.

The normalised form is used for all subsequent processing. `"BANANA"`, `"banana"`, and `"  Banana  "` shall all produce identical planet layouts.

---

## NS-03 Seed Hashing

The system shall convert the normalised seed string to a 32-bit unsigned integer seed value using a deterministic hash function applied character-by-character to the string's UTF-16 code units.

The hash function shall produce the same output for the same input on all platforms and browsers.

The resulting integer shall be used to initialise a dedicated **seed PRNG** instance (mulberry32) that is separate from the main game RNG.

---

## NS-04 Planet Layout Generation

WHEN a seed is active, the system shall use the seed PRNG exclusively to determine the full planet layout:

| Property | Driven by seed PRNG |
|---|---|
| Planet count | Yes — drawn from the normal permitted range (3–50) |
| Planet type | Yes — for each planet in turn |
| Position (x, y) | Yes — for each planet in turn |
| Mass / size tier | Yes — for each planet in turn |
| Wormhole pairings | Yes — matched after all planets are placed |
| Asteroid shape (vertices, rotation speed) | Yes — for each asteroid in turn |

Station placement, collectable spawning, and AI behaviour shall continue to use the main game RNG and shall not be affected by the seed.

---

## NS-05 Reproducibility

A given normalised seed string shall produce an identical planet layout every time it is used, regardless of:

- Player count or team configuration
- Station size setting
- Game mode (Single / Tournament / Story / Target Practice)
- Game speed or movement speed settings
- Platform or browser

The Planets count config option shall have no effect when a seed is active; planet count is fully determined by the seed PRNG.

---

## NS-06 Seed Display In-Game

WHEN a seed is active, the system shall display the normalised seed string as the map name in place of the scenario name wherever the scenario name appears in the UI (config summary, in-game HUD map label, results screen).

The seed string shall be displayed in lowercase to match the normalised form.

---

## NS-07 Empty Seed Fallback

WHEN the Seed field is empty or contains only whitespace, the system shall behave exactly as it does today: the selected Scenario and Planets config drive planet layout, and the seed PRNG is not used.

---

## NS-08 Seed Persistence

The seed value shall be persisted in the same manner as other config options (retained across page reloads within a session).

WHEN the user clears the Seed field, the Scenario and Planets options shall return to their previous values.
