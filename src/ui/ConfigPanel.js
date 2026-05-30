import { SCENARIO_NAMES } from '../scenarios/scenarioData.js';

const AI_NAMES  = ['RandBot', 'AimBot', 'CleverBot', 'SuperBot', 'MegaBot'];
const SIZE_KEYS = ['MICRO', 'TINY', 'SMALL', 'MEDIUM', 'LARGE', 'GIANT', 'MAMMOTH'];

const PLANET_VALS   = [-1, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20, 25, 30, 35, 40, 45, 50];
const PLANET_LABELS = ['Random', '3', '4', '5', '6', '7', '8', '9', '10', '15', '20', '25', '30', '35', '40', '45', '50'];

const SCENARIO_VALS = [0, ...Array.from({ length: 23 }, (_, i) => i + 1)];

export class ConfigPanel {
  constructor() {
    this._d = {
      numPlayers:        4,
      numHuman:          1,
      stationsPerPlayer: 2,
      aiLevel:           3,
      stationSize:       'LARGE',
      numPlanets:        -1,
      scenarioId:        0,
      mode:              'single',
      speed:             'normal',
      stationMovement:   false,
      performance:       'full',
    };
    this._onStartCb  = null;
    this._onResumeCb = null;
    this._canResume  = false;
    this._humanCtrl  = null; // updated when numPlayers changes
    this.element     = this._build();
  }

  show() { this.element.style.display = 'flex'; }
  hide() { this.element.style.display = 'none'; }
  get isVisible() { return this.element.style.display !== 'none'; }

  onStart(cb)  { this._onStartCb  = cb; }
  onInfo(cb)   { this._onInfoBtn  = cb; }
  onResume(cb) { this._onResumeCb = cb; }

  setCanResume(bool) {
    this._canResume = bool;
    if (this._resumeBtn) this._resumeBtn.style.display = bool ? 'block' : 'none';
  }

  get config() { return { ...this._d }; }

  // ── DOM construction ────────────────────────────────────────────────────────

  _build() {
    const overlay = el('div', {
      position: 'fixed', inset: '0', zIndex: '100',
      display: 'none',              // hidden until show() called
      alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,8,0.82)',
    });

    const panel = el('div', {
      background:   'rgba(3,3,18,0.97)',
      border:       '1px solid rgba(80,110,255,0.4)',
      borderRadius: '8px',
      padding:      '30px 40px 36px',
      minWidth:     '460px',
      maxWidth:     '95vw',
      color:        '#ccd',
      fontFamily:   'monospace',
      boxShadow:    '0 0 50px rgba(50,70,200,0.25), inset 0 0 30px rgba(40,60,180,0.04)',
    });
    overlay.appendChild(panel);

    // Resume button — only shown when there is a paused game to return to
    this._resumeBtn = el('button', {
      display:       'none',
      margin:        '0 auto 18px',
      padding:       '9px 36px',
      background:    'rgba(20,80,30,0.75)',
      border:        '1px solid rgba(80,210,100,0.5)',
      borderRadius:  '5px',
      color:         '#cec',
      fontFamily:    'monospace',
      fontSize:      '14px',
      letterSpacing: '0.1em',
      cursor:        'pointer',
    });
    this._resumeBtn.textContent = '▶  RESUME GAME';
    this._resumeBtn.addEventListener('mouseenter', () => { this._resumeBtn.style.background = 'rgba(30,110,45,0.9)'; });
    this._resumeBtn.addEventListener('mouseleave', () => { this._resumeBtn.style.background = 'rgba(20,80,30,0.75)'; });
    this._resumeBtn.addEventListener('click', () => { this.hide(); this._onResumeCb?.(); });
    panel.appendChild(this._resumeBtn);

    // Title
    const title = el('div', {
      margin:      '0 0 26px',
      fontSize:    '17px',
      letterSpacing: '0.2em',
      color:       '#aac',
      textShadow:  '0 0 20px rgba(110,130,255,0.65)',
      textAlign:   'center',
    });
    title.textContent = '✦  D E A T H  S T A R  B A T T L E S';
    panel.appendChild(title);

    // ── Primary options ──────────────────────────────────────────────────────

    panel.appendChild(this._playerRow());
    panel.appendChild(this._humanRow());
    panel.appendChild(this._row('STATIONS / PLAYER',
      this._cycle('stationsPerPlayer', [1, 2, 3, 4, 5, 6, 7, 8], v => String(v))));
    panel.appendChild(this._row('CPU LEVEL',
      this._cycle('aiLevel', [1, 2, 3, 4, 5], v => AI_NAMES[v - 1])));

    // ── Divider ──────────────────────────────────────────────────────────────

    const div = el('div', { margin: '16px 0 8px', fontSize: '11px', color: 'rgba(130,145,210,0.45)', letterSpacing: '0.08em' });
    div.textContent = '── ADVANCED ────────────────────────────────────────';
    panel.appendChild(div);

    // ── Advanced options ─────────────────────────────────────────────────────

    panel.appendChild(this._row('STATION SIZE',
      this._cycle('stationSize', SIZE_KEYS, v => v[0] + v.slice(1).toLowerCase())));
    this._planetsCtrl = this._cycle('numPlanets', PLANET_VALS, (v, i) => PLANET_LABELS[i]);
    panel.appendChild(this._row('PLANETS', this._planetsCtrl));
    panel.appendChild(this._row('SCENARIO',
      this._cycle('scenarioId', SCENARIO_VALS,
        v => v === 0 ? 'Lucky Dip' : `${v}. ${SCENARIO_NAMES[v]}`)));
    panel.appendChild(this._row('MODE',
      this._cycle('mode', ['single', 'tournament'],
        v => v === 'single' ? 'Single Game' : 'Tournament')));
    panel.appendChild(this._row('GAME SPEED',
      this._cycle('speed', ['verySlow', 'slow', 'normal', 'fast', 'veryFast'],
        v => ({ verySlow: '¼×  Very Slow', slow: '½×  Slow', normal: '1×  Normal', fast: '2×  Fast', veryFast: '4×  Very Fast' }[v]))));
    panel.appendChild(this._row('STATION MOVEMENT',
      this._cycle('stationMovement', [false, true],
        v => v ? 'On' : 'Off')));
    panel.appendChild(this._row('PERFORMANCE',
      this._cycle('performance', ['full', 'simplified'],
        v => v === 'full' ? 'Full' : 'Simplified')));

    // ── Start button ─────────────────────────────────────────────────────────

    const startBtn = el('button', {
      display:       'block',
      margin:        '28px auto 0',
      padding:       '12px 52px',
      background:    'rgba(35,55,175,0.7)',
      border:        '1px solid rgba(110,140,255,0.55)',
      borderRadius:  '5px',
      color:         '#eef',
      fontFamily:    'monospace',
      fontSize:      '16px',
      letterSpacing: '0.12em',
      cursor:        'pointer',
      boxShadow:     '0 0 18px rgba(70,95,255,0.35)',
    });
    startBtn.textContent = 'START GAME';
    startBtn.addEventListener('mouseenter', () => {
      startBtn.style.background = 'rgba(55,85,210,0.9)';
      startBtn.style.boxShadow  = '0 0 28px rgba(90,120,255,0.6)';
    });
    startBtn.addEventListener('mouseleave', () => {
      startBtn.style.background = 'rgba(35,55,175,0.7)';
      startBtn.style.boxShadow  = '0 0 18px rgba(70,95,255,0.35)';
    });
    startBtn.addEventListener('click', () => {
      this.hide();
      this._onStartCb?.(this.config);
    });
    panel.appendChild(startBtn);

    // ── Info links ───────────────────────────────────────────────────────────

    const infoBar = el('div', {
      display: 'flex', justifyContent: 'center', gap: '22px',
      marginTop: '20px',
    });
    for (const label of ['About', 'Instructions', 'Education', 'Scores']) {
      const btn = el('button', {
        background:    'transparent',
        border:        'none',
        color:         'rgba(140,155,210,0.65)',
        fontFamily:    'monospace',
        fontSize:      '12px',
        letterSpacing: '0.06em',
        cursor:        'pointer',
        padding:       '2px 6px',
      });
      btn.textContent = label;
      btn.addEventListener('mouseenter', () => { btn.style.color = 'rgba(180,195,255,0.9)'; });
      btn.addEventListener('mouseleave', () => { btn.style.color = 'rgba(140,155,210,0.65)'; });
      btn.addEventListener('click', () => this._onInfoBtn?.(label.toLowerCase()));
      infoBar.appendChild(btn);
    }
    panel.appendChild(infoBar);

    return overlay;
  }

  // ── Option rows ─────────────────────────────────────────────────────────────

  _row(label, ctrl) {
    const row = el('div', {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      marginBottom: '9px', minHeight: '30px',
    });
    const lbl = el('span', { fontSize: '12px', letterSpacing: '0.07em', color: 'rgba(185,195,235,0.8)', minWidth: '190px' });
    lbl.textContent = label;
    row.appendChild(lbl);
    row.appendChild(ctrl);
    return row;
  }

  // Generic cycle control — cycles through `values`, displays via `toLabel(value, index)`
  _cycle(key, values, toLabel) {
    let idx = Math.max(0, values.indexOf(this._d[key]));

    const display = el('span', {
      display: 'inline-block', minWidth: '160px', textAlign: 'center',
      fontSize: '13px', color: '#eee',
    });
    const refresh = () => { display.textContent = toLabel(values[idx], idx); };
    refresh();

    const ctrl = this._cycleCtrl(display,
      () => { idx = (idx + 1) % values.length;         this._d[key] = values[idx]; refresh(); this._onChange(key); },
      () => { idx = (idx - 1 + values.length) % values.length; this._d[key] = values[idx]; refresh(); this._onChange(key); },
    );
    ctrl._refresh = () => { idx = Math.max(0, values.indexOf(this._d[key])); refresh(); };
    return ctrl;
  }

  // Players row — feeds into the human/cpu row
  _playerRow() {
    const vals = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    const ctrl = this._cycle('numPlayers', vals, v => `${v} players`);
    this._playersCtrl = ctrl;
    return this._row('PLAYERS', ctrl);
  }

  // Human/CPU row — options depend on numPlayers
  _humanRow() {
    const display = el('span', {
      display: 'inline-block', minWidth: '160px', textAlign: 'center',
      fontSize: '13px', color: '#eee',
    });
    const humanLabel = () => {
      const np = this._d.numPlayers, nh = this._d.numHuman, nc = np - nh;
      if (nh === 0) return `${np} CPU`;
      if (nc === 0) return `${np} Human`;
      return `${nh}H  ${nc} CPU`;
    };
    const refresh = () => { display.textContent = humanLabel(); };
    refresh();

    const ctrl = this._cycleCtrl(display,
      () => { this._d.numHuman = (this._d.numHuman + 1) % (this._d.numPlayers + 1); refresh(); },
      () => { this._d.numHuman = (this._d.numHuman - 1 + this._d.numPlayers + 1) % (this._d.numPlayers + 1); refresh(); },
    );
    this._humanCtrlRefresh = refresh;
    return this._row('HUMAN / CPU', ctrl);
  }

  // Builds ◄  value  ► control
  _cycleCtrl(display, onNext, onPrev) {
    const wrap = el('div', { display: 'flex', alignItems: 'center', gap: '6px' });
    wrap.appendChild(this._arrow('◄', onPrev));
    wrap.appendChild(display);
    wrap.appendChild(this._arrow('►', onNext));
    return wrap;
  }

  _arrow(ch, onClick) {
    const btn = el('button', {
      background:   'transparent',
      border:       '1px solid rgba(100,120,255,0.3)',
      borderRadius: '3px',
      color:        'rgba(170,185,255,0.75)',
      fontFamily:   'monospace',
      fontSize:     '13px',
      padding:      '2px 9px',
      cursor:       'pointer',
    });
    btn.textContent = ch;
    btn.addEventListener('mouseenter', () => { btn.style.borderColor = 'rgba(150,170,255,0.7)'; });
    btn.addEventListener('mouseleave', () => { btn.style.borderColor = 'rgba(100,120,255,0.3)'; });
    btn.addEventListener('click', onClick);
    return btn;
  }

  _onChange(key) {
    if (key === 'numPlayers') {
      this._d.numHuman = Math.min(this._d.numHuman, this._d.numPlayers);
      this._humanCtrlRefresh?.();
    }
    if (key === 'performance' && this._d.performance === 'simplified') {
      // Simplified mode: cap planets at 20, players at 4
      if (this._d.numPlanets > 20)  { this._d.numPlanets = 20;  this._planetsCtrl?._refresh(); }
      if (this._d.numPlayers > 4)   { this._d.numPlayers = 4;   this._playersCtrl?._refresh(); this._onChange('numPlayers'); }
    }
  }
}

// Minimal helper — create an element with style properties applied
function el(tag, styles) {
  const node = document.createElement(tag);
  Object.assign(node.style, styles);
  return node;
}
