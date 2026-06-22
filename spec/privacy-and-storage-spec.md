# Privacy & Client Storage — Specification

> Documents exactly what the game persists on the user's device, why it is GDPR / ePrivacy ("cookie law") compliant without a blocking consent gate, and the two proportionate transparency surfaces added: a one-time storage notice and an always-available Privacy page.

---

## 1. What the Game Persists

The game has **no backend**. Nothing the user does is transmitted to any server. The only client-side persistence is the browser's **`localStorage`** (no cookies, no `sessionStorage`, no `indexedDB`).

### 1.1 Story Mode progress — `dsb_story`

Written/read by `src/story/StoryPersistence.js`. A single `localStorage` entry, key **`dsb_story`**, holding a JSON object:

```js
{
  unlocked: ["mission-id", ...],          // missions the player has unlocked
  scores:   { "mission-id": number },     // best CLEAN score per mission
  assistedLevel: { "mission-id": "half" },// best assist tier, only when no clean score exists
  campaignComplete: true                  // flag set once every mission is passed
}
```

- Write: `localStorage.setItem('dsb_story', JSON.stringify(data))` — wrapped in `try/catch`, fails silently when storage is unavailable (private browsing, quota, disabled).
- Read: `JSON.parse(localStorage.getItem('dsb_story') ?? '{}')`.
- Scope: first-party, same-origin, per-browser, per-device. Persists until the user clears site data. Not synced across devices.

### 1.2 Storage-notice acknowledgement — `dsb_privacy_ack`

Written/read by `src/ui/StorageNotice.js`. Key **`dsb_privacy_ack`**, value `'1'`. Records that the one-time storage notice (§3) has been dismissed so it is not shown again. Also `try/catch`-wrapped.

### 1.3 What is NOT stored or done

- **No cookies** — `document.cookie` is never accessed anywhere in the codebase.
- **No personal data** — the stored values are mission IDs, integer scores, and booleans. No name, email, IP address, device fingerprint, or tracking identifier.
- **No analytics, advertising, or third-party scripts.** All `fetch`/`Image` loads target local assets (sprite SVGs, sound files) only.
- Tournament weapon stocks, awards, and per-game stats live **in memory for the session only** and are never written to disk.

---

## 2. Compliance Rationale

> This section records the engineering rationale, not formal legal advice.

Two regimes are relevant and point the same way:

- **GDPR (personal data):** barely engages — no personal data is processed. `localStorage` content here is not personal data.
- **ePrivacy / PECR ("cookie law"):** governs *any* storage on the device, cookie or not. It requires consent **unless** the storage is *strictly necessary to provide a service the user explicitly requested*. Saving the progress of the single-player campaign the user is actively playing fits the **strictly-necessary / functional exemption** (the same basis that exempts a shopping cart or a remembered preference).

**Conclusion:** a blocking "Accept cookies" consent gate is **not required** — the game uses no cookies, performs no tracking, collects no personal data, and stores only functional, strictly-necessary data. A blocking banner would also be misleading (there are no cookies to consent to).

**Chosen approach (proportionate):** transparency without a consent gate —
1. a **one-time, non-blocking storage notice** (§3, option "A"), and
2. an **always-available Privacy page** (§4, option "B").

**Upgrade trigger:** if analytics, advertising, or any third-party script is ever added, this analysis no longer holds and a proper consent mechanism (granular opt-in, reject option, storage-off play) must be added. Whatever is built here should remain easy to upgrade to that.

---

## 3. Storage Notice (one-time, non-blocking)

`src/ui/StorageNotice.js` — a self-contained component.

- **Appearance:** a thin bar fixed to the bottom of the viewport, in the existing dark-space theme. Non-blocking — it does not overlay or gate the menu/game; the player can ignore it and keep playing.
- **Content:** short text — *"This game saves your Story Mode progress in your browser's local storage. No cookies, no tracking — nothing leaves your device."* — plus a **"Privacy details"** link and a **"Got it"** dismiss button.
- **z-index:** `150` (below modal overlays at `200`, so the Privacy page opens on top of it).
- **Behaviour:**
  - `maybeShow()` displays the bar **only if** `dsb_privacy_ack !== '1'`. Called once at startup in `main.js`.
  - "Privacy details" → `setOnDetails` callback → opens the Privacy modal (§4).
  - "Got it" → writes `dsb_privacy_ack = '1'` and hides the bar; it never shows again on this browser.
  - If `localStorage` is unavailable, the notice still shows and dismisses for the session (it simply cannot persist the acknowledgement).

### 3.1 API

```js
class StorageNotice {
  setOnDetails(cb)  // wire "Privacy details" → open Privacy modal
  get element()     // the bar DOM node (appended to <body>)
  maybeShow()       // show only if not previously acknowledged
  hide()
}
```

---

## 4. Privacy Page (always available)

`PrivacyModal` in `src/ui/InfoModals.js` — same modal pattern as About / Instructions (uses the shared `overlay()` / `panel()` / `closeBtn()` / `heading()` / `bodyText()` helpers; ESC and click-outside to close).

- **Heading:** `✦  PRIVACY & DATA`.
- **Body:** the full statement — what is stored (`dsb_story` story progress + the notice flag), what is *not* done (no cookies, no personal data, no analytics/third-party, nothing leaves the device), user control (clear site data / use private browsing), and the no-consent-banner-required rationale.
- **Access:** a **"Privacy"** link added to the config-panel footer info bar (`ConfigPanel`, alongside About / Instructions / Education / Scores / Options Help), routed through the existing `onInfo` callback with key `'privacy'`, and also reachable from the storage notice's "Privacy details" link.

---

## 5. Affected Files

| File | Change |
|---|---|
| `src/ui/InfoModals.js` | **NEW** `PrivacyModal` class + privacy body text |
| `src/ui/StorageNotice.js` | **NEW** — one-time non-blocking storage notice; `dsb_privacy_ack` flag |
| `src/ui/ConfigPanel.js` | Add `Privacy` link (`key: 'privacy'`) to the footer info bar |
| `src/main.js` | Instantiate `PrivacyModal` + `StorageNotice`; route `'privacy'` in `onInfo`; call `storageNotice.maybeShow()` at startup |

No change to `StoryPersistence.js` — it already wraps all `localStorage` access in `try/catch`.

---

## 6. Edge Cases

| Case | Behaviour |
|---|---|
| `localStorage` disabled / private browsing | All reads return `null`/throw → caught; progress is not saved, the notice shows each session, the game still plays |
| User clears site data | `dsb_story` and `dsb_privacy_ack` are removed; progress resets and the notice shows again on next visit (correct) |
| Notice dismissed, then Privacy opened later | Privacy page is always reachable from the config-panel footer regardless of notice state |
| Future addition of analytics/ads/third-party | Out of scope here; triggers the §2 upgrade requirement (a real consent mechanism) |
