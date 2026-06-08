// Hold-down angle / power controls shown during AIMING phase.
// Replaces the canvas-drawn Angle/Power text with interactive DOM buttons.
// Holding a button starts slow and accelerates up to MAX_RATE units/tick.

const NO_POWER_WEAPONS = new Set(['blunderbuss', 'blaster', 'laser', 'pulseLaser']);

const HOLD_DELAY    = 350;  // ms before repeat begins
const TICK_MS       = 80;   // ms between repeat ticks
const MAX_RATE      = 10;   // max repetitions per tick for power buttons
const MAX_RATE_ANG  = 50;   // max repetitions per tick for angle (50 × 0.1° = 5°/tick)
const RAMP_TICKS    = 4;    // ticks to double the rate (exponential — reaches max in ~2 s)

export class AimControls {
  constructor() {
    this._loop      = null;
    this._holdTimer = null;
    this._holdCount = 0;
    this._minimal   = false;
    this.element    = this._build();
  }

  setLoop(loop) { this._loop = loop; }

  show() { this.element.style.display = 'flex'; }
  hide() { this.element.style.display = 'none'; }

  setMinimal(isMinimal) {
    this._minimal = isMinimal;
    const fs = isMinimal ? '14px' : '18px';
    const mw = isMinimal ? '70px'  : '130px';
    const pm = isMinimal ? '70px'  : '120px';
    this._angleVal.style.fontSize = fs;
    this._angleVal.style.minWidth = mw;
    this._powerVal.style.fontSize = fs;
    this._powerVal.style.minWidth = pm;
  }

  // Call each frame while aiming so values stay in sync
  update(station) {
    if (!station) return;
    const w          = station.selectedWeapon;
    const noPower    = NO_POWER_WEAPONS.has(w);
    const isFragShot = w === 'fragmentationShot';
    const isShotgun  = w === 'shotgun';
    this._powerGroup.style.visibility = noPower ? 'hidden' : 'visible';
    if (this._minimal) {
      this._angleVal.textContent = `∠${station.angle.toFixed(0)}°`;
      if (isFragShot) {
        const val = (1 + (station.power - 1) / 799 * 4).toFixed(1);
        this._powerVal.textContent = `⏱${val}`;
      } else if (isShotgun) {
        this._powerVal.textContent = `∠2 ${(station.angle2 ?? station.angle).toFixed(0)}°`;
      } else {
        this._powerVal.textContent = `⚡${(station.power / 8).toFixed(1)}`;
      }
    } else {
      this._angleVal.textContent = `Angle: ${station.angle.toFixed(1)}°`;
      if (isFragShot) {
        const val = (1 + (station.power - 1) / 799 * 4).toFixed(1);
        this._powerVal.textContent = `Timer: ${val}`;
      } else if (isShotgun) {
        this._powerVal.textContent = `Barrel 2: ${(station.angle2 ?? station.angle).toFixed(1)}°`;
      } else {
        this._powerVal.textContent = `Power: ${(station.power / 8).toFixed(1)}`;
      }
    }
  }

  // ── DOM ────────────────────────────────────────────────────────────────────

  _build() {
    const bar = el('div', {
      position: 'fixed', bottom: '0', left: '0', right: '0',
      display: 'none',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      paddingBottom: '8px',
      pointerEvents: 'none',
      zIndex: '10',
    });

    // Angle group (left)
    const angleGroup = el('div', {
      display: 'flex', alignItems: 'center', gap: '5px',
      pointerEvents: 'auto', marginLeft: '14px',
    });
    this._angleVal = el('span', {
      fontFamily: 'monospace', fontSize: '18px', fontWeight: 'bold',
      color: '#fff', minWidth: '130px', textAlign: 'center',
      textShadow: '0 0 6px rgba(0,0,0,0.9)',
    });
    this._angleVal.textContent = 'Angle: 180.0°';
    angleGroup.appendChild(this._makeBtn('◄', () => this._loop?.humanAngle(+0.1), MAX_RATE_ANG));
    angleGroup.appendChild(this._angleVal);
    angleGroup.appendChild(this._makeBtn('►', () => this._loop?.humanAngle(-0.1), MAX_RATE_ANG));

    // Power group (right)
    const powerGroup = el('div', {
      display: 'flex', alignItems: 'center', gap: '5px',
      pointerEvents: 'auto', marginRight: '14px',
    });
    this._powerVal = el('span', {
      fontFamily: 'monospace', fontSize: '18px', fontWeight: 'bold',
      color: '#fff', minWidth: '120px', textAlign: 'center',
      textShadow: '0 0 6px rgba(0,0,0,0.9)',
    });
    this._powerVal.textContent = 'Power: 0.1';
    powerGroup.appendChild(this._makeBtn('◄', () => this._loop?.humanPower(-1)));
    powerGroup.appendChild(this._powerVal);
    powerGroup.appendChild(this._makeBtn('►', () => this._loop?.humanPower(+1)));

    this._powerGroup = powerGroup;
    bar.appendChild(angleGroup);
    bar.appendChild(powerGroup);
    return bar;
  }

  _makeBtn(label, action, maxRate = MAX_RATE) {
    const btn = el('button', {
      background:   'rgba(10,10,25,0.82)',
      border:       '1px solid rgba(255,255,255,0.32)',
      borderRadius: '4px',
      color:        '#dde',
      fontFamily:   'monospace',
      fontSize:     '16px',
      padding:      '5px 14px',
      cursor:       'pointer',
      userSelect:   'none',
      transition:   'background 0.1s, transform 0.07s',
    });
    btn.textContent = label;

    btn.addEventListener('mouseenter', () => {
      btn.style.background = 'rgba(40,45,90,0.95)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.background = 'rgba(10,10,25,0.82)';
      btn.style.transform  = 'scale(1)';
      this._stopHold();
    });
    btn.addEventListener('mousedown', e => {
      e.preventDefault();
      btn.style.transform = 'scale(0.9)';
      this._startHold(action, maxRate);
    });
    btn.addEventListener('mouseup', () => {
      btn.style.transform = 'scale(1)';
      this._stopHold();
    });
    // Touch support
    btn.addEventListener('touchstart', e => {
      e.preventDefault();
      this._startHold(action, maxRate);
    }, { passive: false });
    btn.addEventListener('touchend', () => this._stopHold());

    return btn;
  }

  // ── Hold logic ─────────────────────────────────────────────────────────────

  _startHold(action, maxRate = MAX_RATE) {
    action(); // immediate first nudge
    this._holdCount = 0;
    this._holdTimer = setTimeout(() => {
      this._holdTimer = setInterval(() => {
        this._holdCount++;
        const rate = Math.min(maxRate, Math.ceil(Math.pow(2, this._holdCount / RAMP_TICKS)));
        for (let i = 0; i < rate; i++) action();
      }, TICK_MS);
    }, HOLD_DELAY);
  }

  _stopHold() {
    clearTimeout(this._holdTimer);
    clearInterval(this._holdTimer);
    this._holdTimer = null;
    this._holdCount = 0;
  }
}

function el(tag, styles) {
  const node = document.createElement(tag);
  Object.assign(node.style, styles);
  return node;
}
