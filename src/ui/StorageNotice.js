// Copyright © 2026 Chloe Bolland
// contact chloe@mammoththoughts.com if you wish to use, publish or reproduce this game or any part of it in any way

// One-time, non-blocking notice that the game saves Story Mode progress in the
// browser's local storage. Proportionate transparency for a no-cookie, no-tracking,
// functional-storage-only app (see PrivacyModal for the full statement). The
// "seen" flag is itself stored in local storage so the notice shows only once.

const ACK_KEY = 'dsb_privacy_ack';

function el(tag, styles) {
  const node = document.createElement(tag);
  Object.assign(node.style, styles);
  return node;
}

export class StorageNotice {
  constructor() {
    this._onDetails = null;
    this._bar = this._build();
  }

  setOnDetails(cb) { this._onDetails = cb; }
  get element()    { return this._bar; }

  _acked() { try { return localStorage.getItem(ACK_KEY) === '1'; } catch { return false; } }
  _ack()   { try { localStorage.setItem(ACK_KEY, '1'); } catch {} }

  // Show only if the player has not dismissed it before.
  maybeShow() { if (!this._acked()) this._bar.style.display = 'flex'; }
  hide()      { this._bar.style.display = 'none'; }

  _build() {
    const bar = el('div', {
      position:   'fixed',
      left:       '0', right: '0', bottom: '0',
      zIndex:     '150', // below modal overlays (200) so Privacy details sits on top
      display:    'none',
      alignItems: 'center', justifyContent: 'center',
      flexWrap:   'wrap', gap: '10px 16px',
      padding:    '10px 16px',
      background: 'rgba(3,3,20,0.95)',
      borderTop:  '1px solid rgba(80,110,255,0.35)',
      boxShadow:  '0 -4px 24px rgba(30,40,120,0.3)',
      fontFamily: 'monospace',
    });

    const text = el('span', {
      color: 'rgba(190,200,235,0.85)', fontSize: '12px',
      letterSpacing: '0.03em', lineHeight: '1.5', textAlign: 'center',
    });
    text.textContent = 'This game saves your Story Mode progress in your browser’s local storage. '
      + 'No cookies, no tracking — nothing leaves your device.';

    const details = el('button', {
      background: 'transparent', border: 'none',
      color: 'rgba(150,170,255,0.9)', fontFamily: 'monospace', fontSize: '12px',
      textDecoration: 'underline', cursor: 'pointer', padding: '2px 4px',
    });
    details.textContent = 'Privacy details';
    details.addEventListener('click', () => this._onDetails?.());

    const ok = el('button', {
      background: 'transparent',
      border: '1px solid rgba(100,120,255,0.4)', borderRadius: '4px',
      color: 'rgba(180,195,255,0.9)', fontFamily: 'monospace', fontSize: '12px',
      padding: '4px 14px', cursor: 'pointer',
    });
    ok.textContent = 'Got it';
    ok.addEventListener('mouseenter', () => { ok.style.borderColor = 'rgba(150,170,255,0.8)'; });
    ok.addEventListener('mouseleave', () => { ok.style.borderColor = 'rgba(100,120,255,0.4)'; });
    ok.addEventListener('click', () => { this._ack(); this.hide(); });

    bar.appendChild(text);
    bar.appendChild(details);
    bar.appendChild(ok);
    return bar;
  }
}
