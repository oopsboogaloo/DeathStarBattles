import { SCENARIO_NAMES, SCENARIO_COUNT } from '../scenarios/scenarioData.js';

const AI_NAMES  = ['RandBot', 'AimBot', 'CleverBot', 'SuperBot', 'MegaBot'];
const SIZE_KEYS = ['MICRO', 'TINY', 'SMALL', 'MEDIUM', 'LARGE', 'GIANT', 'MAMMOTH'];


const SCENARIO_VALS = [0, ...Array.from({ length: SCENARIO_COUNT }, (_, i) => i + 1)];

const PAGE_TITLES = ['SETUP', 'WORLD', 'OPTIONS', 'COLLECTABLES', 'TARGET PRACTICE', 'TOURNAMENT'];
const NUM_PAGES   = 6; // index 4 only in target-practice; index 5 only in tournament

// Style tokens — normal vs compact (paged mobile) mode
const S = {
  norm: {
    panelPad:      '30px 40px 36px',
    panelMinW:     '460px',
    titleFont:     '17px',
    titleMargin:   '0 0 26px',
    resumePad:     '9px 36px',
    resumeFont:    '14px',
    resumeMarginB: '18px',
    rowMarginB:    '9px',
    rowMinH:       '30px',
    lblFont:       '12px',
    lblMinW:       '190px',
    valFont:       '13px',
    valMinW:       '160px',
    arrowFont:     '13px',
    arrowPad:      '2px 9px',
    startMarginT:  '28px',
    startPad:      '12px 52px',
    startFont:     '16px',
    infoMarginT:   '20px',
    infoGap:       '14px',
    navMarginT:    '14px',
    navPadT:       '12px',
  },
  compact: {
    panelPad:      '18px 24px 20px',
    panelMinW:     '320px',
    titleFont:     '13px',
    titleMargin:   '0 0 10px',
    resumePad:     '5px 18px',
    resumeFont:    '11px',
    resumeMarginB: '10px',
    rowMarginB:    '4px',
    rowMinH:       '22px',
    lblFont:       '10px',
    lblMinW:       '145px',
    valFont:       '11px',
    valMinW:       '120px',
    arrowFont:     '11px',
    arrowPad:      '1px 6px',
    startMarginT:  '12px',
    startPad:      '8px 32px',
    startFont:     '13px',
    infoMarginT:   '8px',
    infoGap:       '8px',
    navMarginT:    '8px',
    navPadT:       '8px',
  },
};

export class ConfigPanel {
  constructor() {
    this._d = {
      numPlayers:        4,
      numHuman:          1,
      stationsPerPlayer: 2,
      aiLevel:           3,
      stationSize:       'LARGE',
      scenarioId:        0,
      mode:              'tournament',
      speed:             'normal',
      movementSpeed:     'normal',
      performance:       'full',
      teamClustering:    'off',
      wildcardFrequency: 'rare',
      collectables:      'normal',
      richAsteroids:     'normal',
      collectableSize:   'medium',
      startingWeapons:   'none',
      forceExtreme:      false,
      overrideSeed:      '',
      aimCircleSize:     'regular',
      bulletPaths:       'off',
      minimalUI:         false,
      tpTargets:         5,
      tpSize:            'MEDIUM',
      tpRounds:          5,
      tpIncludeAI:       false,
      turnLimit:         'off',
      winnerPrize:       'none',
      handicapPrize:     'none',
      tournamentGames:   'keepGoing',
      awardPrizes:       'none',
      claimCollectables: true,
    };
    this._onStartCb       = null;
    this._onResumeCb      = null;
    this._onResignCb      = null;
    this._canResume       = false;
    this._pagedMode       = false;
    this._currentPage     = 0;
    this._pageEls         = [];
    this._dotEls          = [];
    this._prevBtn         = null;
    this._nextBtn         = null;
    this._panel           = null;
    this._title           = null;
    this._startBtn        = null;
    this._infoBar         = null;
    this._navBar          = null;
    this._flatPrimary     = null;
    this._advancedInner   = null;
    this._collectSubRows      = null; // rows greyed out when collectables === 'off'
    this._devRows             = null; // rows hidden unless dev mode is active
    this._perfValues      = null; // mutated to include 'experimental' in dev mode
    this._perfCtrl        = null;
    this._campaignUnlocked = false;
    this._devModeOn        = false;
    this._flatSection     = null;
    this._pagedSection    = null;
    this.element          = this._build();
  }

  show() {
    this.element.style.display = 'flex';
    requestAnimationFrame(() => this._checkFit());
  }
  hide() { this.element.style.display = 'none'; }
  get isVisible() { return this.element.style.display !== 'none'; }

  onStart(cb)  { this._onStartCb  = cb; }
  onInfo(cb)   { this._onInfoBtn  = cb; }
  onResume(cb) { this._onResumeCb = cb; }
  onResign(cb) { this._onResignCb = cb; }
  getData()    { return this._d; }

  setCanResume(bool) {
    this._canResume = bool;
    if (this._resumeBtn) this._resumeBtn.style.display = bool ? 'block' : 'none';
    if (this._resignBtn) {
      this._resignBtn.style.display = bool ? 'block' : 'none';
      this._resignBtn.textContent   = 'RESIGN';
      this._resignConfirm = false;
    }
  }

  get config() { return { ...this._d }; }

  // ── Fit detection ────────────────────────────────────────────────────────────

  _checkFit() {
    if (!this._panel) return;
    // Always use the compact paged layout regardless of screen size.
    if (!this._pagedMode) this._applyLayout(true);
    return;
    const wasPaged = this._pagedMode; // dead code kept for reference

    // Always measure in flat/non-compact state for accuracy.
    // If currently paged, temporarily restore flat layout (synchronous forced
    // reflow — rows move back, styles restored, then measured before next paint).
    if (wasPaged) {
      this._pagedMode = false;
      for (const row of this._page1Rows) this._flatPrimary.appendChild(row);
      for (const row of this._page2Rows) this._advancedInner.appendChild(row);
      for (const row of this._page3Rows) this._advancedInner.appendChild(row);
      for (const row of this._page4Rows) this._advancedInner.appendChild(row);
      this._flatSection.style.display  = 'block';
      this._pagedSection.style.display = 'none';
      this._panel.style.minWidth  = S.norm.panelMinW;
      this._panel.style.maxHeight = '';
      this._panel.style.overflowY = '';
      this._panel.style.padding   = S.norm.panelPad;
      this._setCompact(false);
    }

    const needsPaged = this._panel.scrollHeight > window.innerHeight * 0.92;
    if (needsPaged !== this._pagedMode) this._applyLayout(needsPaged);
  }

  _applyLayout(paged) {
    this._pagedMode = paged;
    if (paged) {
      for (const row of this._page1Rows) this._pageEls[0].appendChild(row);
      for (const row of this._page2Rows) this._pageEls[1].appendChild(row);
      for (const row of this._page3Rows) this._pageEls[2].appendChild(row);
      for (const row of this._page4Rows) this._pageEls[3].appendChild(row);
      for (const row of this._page5Rows) this._pageEls[4].appendChild(row);
      for (const row of this._page6Rows) this._pageEls[5].appendChild(row);
      this._flatSection.style.display  = 'none';
      this._pagedSection.style.display = 'block';
      this._panel.style.minWidth  = S.compact.panelMinW;
      this._panel.style.maxHeight = '92vh';
      this._panel.style.overflowY = 'auto';
      this._panel.style.padding   = S.compact.panelPad;
      this._setCompact(true);
      this._showPage(this._currentPage);
    } else {
      for (const row of this._page1Rows) this._flatPrimary.appendChild(row);
      for (const row of this._page2Rows) this._advancedInner.appendChild(row);
      for (const row of this._page3Rows) this._advancedInner.appendChild(row);
      for (const row of this._page4Rows) this._advancedInner.appendChild(row);
      for (const row of this._page5Rows) this._advancedInner.appendChild(row);
      for (const row of this._page6Rows) this._advancedInner.appendChild(row);
      this._flatSection.style.display  = 'block';
      this._pagedSection.style.display = 'none';
      this._panel.style.minWidth  = S.norm.panelMinW;
      this._panel.style.maxHeight = '';
      this._panel.style.overflowY = '';
      this._panel.style.padding   = S.norm.panelPad;
      this._setCompact(false);
    }
  }

  _setCompact(c) {
    const t = c ? S.compact : S.norm;

    this._title.style.fontSize  = t.titleFont;
    this._title.style.margin    = t.titleMargin;

    this._resumeBtn.style.marginBottom = t.resumeMarginB;
    this._resumeBtn.style.padding      = t.resumePad;
    this._resumeBtn.style.fontSize     = t.resumeFont;

    for (const row of [...this._page1Rows, ...this._page2Rows, ...this._page3Rows, ...this._page4Rows, ...this._page5Rows, ...this._page6Rows]) {
      row.style.marginBottom = t.rowMarginB;
      row.style.minHeight    = t.rowMinH;
      const lbl  = row.children[0];
      const ctrl = row.children[1];
      if (lbl) {
        lbl.style.fontSize = t.lblFont;
        lbl.style.minWidth = t.lblMinW;
      }
      if (ctrl) {
        const btnL   = ctrl.children[0];
        const valSpan = ctrl.children[1];
        const btnR   = ctrl.children[2];
        if (valSpan) { valSpan.style.fontSize = t.valFont; valSpan.style.minWidth = t.valMinW; }
        for (const btn of [btnL, btnR]) {
          if (btn) { btn.style.fontSize = t.arrowFont; btn.style.padding = t.arrowPad; }
        }
      }
    }

    this._startBtn.style.marginTop = t.startMarginT;
    this._startBtn.style.padding   = t.startPad;
    this._startBtn.style.fontSize  = t.startFont;

    this._infoBar.style.marginTop = t.infoMarginT;
    this._infoBar.style.gap       = t.infoGap;

    this._navBar.style.marginTop  = t.navMarginT;
    this._navBar.style.paddingTop = t.navPadT;
  }

  get _maxPage() {
    if (this._d.mode === 'target-practice') return 4;
    if (this._d.mode === 'tournament')      return 5;
    return 3;
  }

  _showPage(n) {
    // Clamp to valid range for current mode
    n = Math.min(n, this._maxPage);
    this._currentPage = n;
    for (let i = 0; i < NUM_PAGES; i++) {
      this._pageEls[i].style.display = i === n ? 'block' : 'none';
      if (i === 4) this._dotEls[i].style.display = this._d.mode === 'target-practice' ? '' : 'none';
      if (i === 5) this._dotEls[i].style.display = this._d.mode === 'tournament'      ? '' : 'none';
      this._dotEls[i].textContent = i === n ? '●' : '○';
      this._dotEls[i].style.opacity = i === n ? '1' : '0.45';
    }
    this._prevBtn.disabled      = n === 0;
    this._nextBtn.disabled      = n === this._maxPage;
    this._prevBtn.style.opacity = n === 0 ? '0.25' : '1';
    this._nextBtn.style.opacity = n === this._maxPage ? '0.25' : '1';
    this._prevBtn.style.cursor  = n === 0 ? 'default' : 'pointer';
    this._nextBtn.style.cursor  = n === this._maxPage ? 'default' : 'pointer';
  }

  // ── DOM construction ─────────────────────────────────────────────────────────

  _build() {
    const overlay = el('div', {
      position: 'fixed', inset: '0', zIndex: '100',
      display: 'none',
      alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,8,0.82)',
    });

    const panel = el('div', {
      background:   'rgba(3,3,18,0.97)',
      border:       '1px solid rgba(80,110,255,0.4)',
      borderRadius: '8px',
      padding:      S.norm.panelPad,
      minWidth:     S.norm.panelMinW,
      maxWidth:     '95vw',
      color:        '#ccd',
      fontFamily:   'monospace',
      boxShadow:    '0 0 50px rgba(50,70,200,0.25), inset 0 0 30px rgba(40,60,180,0.04)',
    });
    this._panel = panel;
    overlay.appendChild(panel);

    window.addEventListener('resize', () => this._checkFit());

    // ── Resume button ────────────────────────────────────────────────────────
    this._resumeBtn = el('button', {
      display:       'none',
      margin:        `0 auto ${S.norm.resumeMarginB}`,
      padding:       S.norm.resumePad,
      background:    'rgba(20,80,30,0.75)',
      border:        '1px solid rgba(80,210,100,0.5)',
      borderRadius:  '5px',
      color:         '#cec',
      fontFamily:    'monospace',
      fontSize:      S.norm.resumeFont,
      letterSpacing: '0.1em',
      cursor:        'pointer',
    });
    this._resumeBtn.textContent = '▶  RESUME GAME';
    this._resumeBtn.addEventListener('mouseenter', () => { this._resumeBtn.style.background = 'rgba(30,110,45,0.9)'; });
    this._resumeBtn.addEventListener('mouseleave', () => { this._resumeBtn.style.background = 'rgba(20,80,30,0.75)'; });
    this._resumeBtn.addEventListener('click', () => { this.hide(); this._onResumeCb?.(); });
    panel.appendChild(this._resumeBtn);

    // ── Resign button ────────────────────────────────────────────────────────
    this._resignConfirm = false;
    this._resignBtn = el('button', {
      display:       'none',
      margin:        '0 auto 8px',
      padding:       '5px 16px',
      background:    'rgba(80,15,15,0.7)',
      border:        '1px solid rgba(200,60,60,0.45)',
      borderRadius:  '5px',
      color:         'rgba(220,150,150,0.9)',
      fontFamily:    'monospace',
      fontSize:      '11px',
      letterSpacing: '0.1em',
      cursor:        'pointer',
    });
    this._resignBtn.textContent = 'RESIGN';
    this._resignBtn.addEventListener('mouseleave', () => {
      this._resignConfirm = false;
      this._resignBtn.textContent = 'RESIGN';
      this._resignBtn.style.background = 'rgba(80,15,15,0.7)';
    });
    this._resignBtn.addEventListener('mouseenter', () => {
      this._resignBtn.style.background = 'rgba(110,20,20,0.85)';
    });
    this._resignBtn.addEventListener('click', () => {
      if (!this._resignConfirm) {
        this._resignConfirm = true;
        this._resignBtn.textContent = 'CONFIRM RESIGN?';
      } else {
        this._resignConfirm = false;
        this._resignBtn.textContent = 'RESIGN';
        this.hide();
        this._onResignCb?.();
      }
    });
    panel.appendChild(this._resignBtn);

    // ── Title ────────────────────────────────────────────────────────────────
    this._title = el('div', {
      margin:        S.norm.titleMargin,
      fontSize:      S.norm.titleFont,
      letterSpacing: '0.2em',
      color:         '#aac',
      textShadow:    '0 0 20px rgba(110,130,255,0.65)',
      textAlign:     'center',
    });
    this._title.textContent = 'Death Star Battles';
    this._devBadge = el('span', {
      display:       'none',
      marginLeft:    '8px',
      fontSize:      '10px',
      letterSpacing: '0.12em',
      color:         'rgba(255,180,50,0.9)',
      border:        '1px solid rgba(255,180,50,0.5)',
      borderRadius:  '3px',
      padding:       '1px 5px',
      verticalAlign: 'middle',
    });
    this._devBadge.textContent = 'DEV';
    this._title.appendChild(this._devBadge);
    panel.appendChild(this._title);

    // ── Build all row elements once ──────────────────────────────────────────

    // Page 1 — Setup
    const rowPlayers  = this._playerRow();
    const rowHuman    = this._humanRow();
    const rowStations = this._row('STATIONS / PLAYER',
      this._cycle('stationsPerPlayer', [1, 2, 3, 4, 5, 6, 7, 8], v => String(v)));
    const rowCpuLevel = this._row('CPU LEVEL',
      this._cycle('aiLevel', [1, 2, 3, 4, 5], v => AI_NAMES[v - 1]));

    // Page 2 — World
    const rowStationSize = this._row('STATION SIZE',
      this._cycle('stationSize', SIZE_KEYS, v => v[0] + v.slice(1).toLowerCase()));
    const rowCurrentSeed  = this._currentSeedRow();
    const rowOverrideSeed = this._overrideSeedRow();
    const rowScenario    = this._row('SCENARIO',
      this._cycle('scenarioId', SCENARIO_VALS,
        v => v === 0 ? 'Lucky Dip' : `${v}. ${SCENARIO_NAMES[v]}`));
    const rowMode        = this._row('MODE',
      this._cycle('mode', ['single', 'tournament', 'target-practice', 'story'],
        v => ({ single: 'Single Game', tournament: 'Tournament', 'target-practice': 'Target Practice', story: 'Story Mode' }[v])));
    const rowGameSpeed   = this._row('GAME SPEED',
      this._cycle('speed', ['verySlow', 'slow', 'normal', 'fast', 'veryFast'],
        v => ({ verySlow: '¼×  Very Slow', slow: '½×  Slow', normal: '1×  Normal', fast: '2×  Fast', veryFast: '4×  Very Fast' }[v])));
    const rowMovement    = this._row('MOVEMENT SPEED',
      this._cycle('movementSpeed',
        ['off', 'glacial', 'slow', 'normal', 'fast', 'rocket'],
        v => ({ off: 'Off', glacial: 'Glacial  (1×)', slow: 'Slow  (2×)', normal: 'Normal  (3×)', fast: 'Fast  (5×)', rocket: 'Rocket  (8×)' }[v])));

    // Page 3 — Options
    this._perfValues = ['full', 'simplified'];
    const rowPerformance = this._row('PERFORMANCE',
      this._perfCtrl = this._cycle('performance', this._perfValues,
        v => ({ full: 'Full', simplified: 'Simplified', experimental: 'Experimental', 'exp-ipad': 'Exp iPad' }[v] ?? v)));
    const rowClustering  = this._row('TEAM CLUSTERING',
      this._cycle('teamClustering', ['off', 'tight', 'moderate', 'loose'],
        v => ({ off: 'Off', tight: 'Tight', moderate: 'Moderate', loose: 'Loose' }[v])));
    const rowWildcard    = this._row('WILDCARD PLANETS',
      this._cycle('wildcardFrequency',
        ['off', 'veryRare', 'rare', 'occasional', 'common', 'always'],
        v => ({ off: 'Off', veryRare: 'Very Rare', rare: 'Rare', occasional: 'Occasional', common: 'Common', always: 'Always' }[v])));
    const rowAimCircle   = this._row('AIM CIRCLE SIZE',
      this._cycle('aimCircleSize', ['smaller', 'regular', 'larger', 'mammoth'],
        v => ({ smaller: '0.5×  Smaller', regular: '1×   Regular', larger: '2×   Larger', mammoth: '3×   Mammoth' }[v])));
    const rowBulletPaths = this._row('BULLET PATH ASSIST',
      this._cycle('bulletPaths', ['off', 'eighth', 'quarter', 'half', 'full'],
        v => ({ off: 'Off', eighth: 'Minor  (⅛ screen)', quarter: 'Major  (¼ screen)', half: 'Extreme  (½ screen)', full: 'Cheating  (1 screen)' }[v])));
    const rowMinimalUI   = this._row('MINIMAL UI',
      this._cycle('minimalUI', [false, true], v => v ? 'On' : 'Off'));
    // Page 6 — Tournament
    const rowNumGames = this._row('NO. OF GAMES',
      this._cycle('tournamentGames', ['keepGoing', 5, 10, 15, 20, 30, 50],
        v => v === 'keepGoing' ? 'Keep Going' : `${v} games`));
    const rowTurnLimit = this._row('TURN LIMIT',
      this._cycle('turnLimit', ['off', 5, 10, 15, 20, 30, 50],
        v => v === 'off' ? 'Off' : `${v} turns`));
    const rowWinnerPrize = this._row('WINNER PRIZE',
      this._cycle('winnerPrize',
        ['none', 'minor', 'mid', 'mammoth'],
        v => ({ none: 'None', minor: 'Minor  (1×T1)', mid: 'Mid  (1 random)', mammoth: 'Mammoth  (2 random)' }[v] ?? v)));
    const rowHandicapPrize = this._row('HANDICAP PRIZE',
      this._cycle('handicapPrize',
        ['none', 'minor', 'mid', 'mammoth'],
        v => ({ none: 'None', minor: 'Minor  (1×T1)', mid: 'Mid  (1 random)', mammoth: 'Mammoth  (2 random)' }[v] ?? v)));
    const rowAwardPrizes = this._row('AWARD PRIZES',
      this._cycle('awardPrizes',
        ['none', 'minor', 'mid', 'major', 'mammoth'],
        v => ({ none: 'None', minor: 'Minor  (1×T1)', mid: 'Mid  (2×T1)', major: 'Major  (1×T2)', mammoth: 'Mammoth  (2×T2)' }[v] ?? v)));
    const rowClaimCol = this._row('CLAIM COLLECTABLES',
      this._cycle('claimCollectables', [false, true], v => v ? 'On' : 'Off'));

    // Page 4 — Collectables
    const rowCollect     = this._row('COLLECTABLES',
      this._cycle('collectables',
        ['off', 'rare', 'normal', 'common', 'continuous'],
        (v, i) => (['Off', 'Rare', 'Normal', 'Common', 'Continuous'][i])));
    const rowRichAst     = this._row('RICH ASTEROIDS',
      this._cycle('richAsteroids',
        ['off', 'rare', 'normal', 'common', 'abundant', 'overwhelming'],
        v => ({ off: 'Off', rare: 'Rare  (1%)', normal: 'Normal  (5%)', common: 'Common  (10%)', abundant: 'Abundant  (25%)', overwhelming: 'Overwhelming' }[v])));
    const rowColSize     = this._row('COLLECTABLE SIZE',
      this._cycle('collectableSize',
        ['tiny', 'medium', 'large', 'huge', 'mammoth', 'varied'],
        v => ({ tiny: 'Tiny  (½×)', medium: 'Medium', large: 'Large  (1.5×)', huge: 'Huge  (2×)', mammoth: 'Mammoth  (3×)', varied: 'Varied' }[v])));
    const rowForceExtreme = this._row('FORCE EXTREME',
      this._cycle('forceExtreme', [false, true], v => v ? 'On' : 'Off'));

    const rowStartWep    = this._row('STARTING WEAPONS',
      this._cycle('startingWeapons',
        ['none', 'one', 'minor', 'oneOfEach', 'lots', 'tooMany'],
        v => ({ none: 'None', one: 'One at Random', minor: 'Minor  (2 Cannons)', oneOfEach: 'One of Each', lots: 'Lots  (3 of Each)', tooMany: 'Too Many  (7 of Each)' }[v])));

    // Page 5 — Target Practice
    const rowTPTargets = this._row('TARGETS',
      this._cycle('tpTargets', [1, 3, 5, 7, 10, 20], v => String(v)));
    const rowTPSize    = this._row('TARGET SIZE',
      this._cycle('tpSize', SIZE_KEYS, v => v[0] + v.slice(1).toLowerCase()));
    const rowTPRounds  = this._row('ROUNDS',
      this._cycle('tpRounds', [1, 3, 5, 7, 10], v => String(v)));
    const rowTPAI      = this._row('INCLUDE AI',
      this._cycle('tpIncludeAI', [false, true], v => v ? 'On' : 'Off'));

    this._collectSubRows = [rowRichAst, rowColSize, rowStartWep];
    this._seedSubRows    = [rowScenario];
    this._devRows        = [rowStartWep, rowForceExtreme];
    rowStartWep.style.display    = 'none'; // hidden until dev mode enabled
    rowForceExtreme.style.display = 'none';
    this._updateCollectableGrey();
    this._updateSeedGrey();

    this._page1Rows = [rowPlayers, rowHuman, rowStations, rowCpuLevel];
    this._page2Rows = [rowMode, rowScenario, rowCurrentSeed, rowOverrideSeed, rowStationSize, rowWildcard, rowMovement];
    this._page3Rows = [rowPerformance, rowClustering, rowGameSpeed, rowAimCircle, rowBulletPaths, rowMinimalUI];
    this._page4Rows = [rowCollect, rowRichAst, rowColSize, rowStartWep, rowForceExtreme];
    this._page5Rows = [rowTPTargets, rowTPSize, rowTPRounds, rowTPAI];
    this._page6Rows = [rowNumGames, rowTurnLimit, rowWinnerPrize, rowHandicapPrize, rowAwardPrizes, rowClaimCol];

    // ── Flat section ─────────────────────────────────────────────────────────
    this._flatSection = el('div', {});

    this._flatPrimary = el('div', {});
    for (const row of this._page1Rows) this._flatPrimary.appendChild(row);
    this._flatSection.appendChild(this._flatPrimary);

    let advancedOpen = false;
    const advancedToggle = el('div', {
      margin: '16px 0 0', padding: '4px 0', fontSize: '11px',
      color: 'rgba(150,165,230,0.65)', letterSpacing: '0.08em',
      cursor: 'pointer', userSelect: 'none', display: 'flex',
      alignItems: 'center', gap: '6px',
    });
    const toggleIcon  = el('span', { fontSize: '14px', lineHeight: '1', transition: 'transform 0.15s' });
    toggleIcon.textContent = '＋';
    const toggleLabel = el('span', {});
    toggleLabel.textContent = 'ADVANCED';
    advancedToggle.appendChild(toggleIcon);
    advancedToggle.appendChild(toggleLabel);
    advancedToggle.addEventListener('mouseenter', () => { advancedToggle.style.color = 'rgba(190,205,255,0.85)'; });
    advancedToggle.addEventListener('mouseleave', () => { advancedToggle.style.color = 'rgba(150,165,230,0.65)'; });

    const advancedSection = el('div', { overflow: 'hidden', maxHeight: '0', transition: 'max-height 0.25s ease', marginTop: '0' });
    this._advancedInner   = el('div', { paddingTop: '8px' });
    for (const row of [...this._page2Rows, ...this._page3Rows, ...this._page4Rows]) this._advancedInner.appendChild(row);

    advancedToggle.addEventListener('click', () => {
      advancedOpen = !advancedOpen;
      toggleIcon.textContent          = advancedOpen ? '－' : '＋';
      advancedSection.style.maxHeight = advancedOpen ? '600px' : '0';
      if (advancedOpen) requestAnimationFrame(() => this._checkFit());
    });

    advancedSection.appendChild(this._advancedInner);
    this._flatSection.appendChild(advancedToggle);
    this._flatSection.appendChild(advancedSection);
    panel.appendChild(this._flatSection);

    // ── Paged section ────────────────────────────────────────────────────────
    this._pagedSection = el('div', { display: 'none' });

    for (let i = 0; i < NUM_PAGES; i++) {
      const pageEl = el('div', { display: 'none' });
      const lbl = el('div', {
        fontSize: '10px', letterSpacing: '0.13em',
        color: 'rgba(130,145,210,0.55)', marginBottom: '10px',
      });
      lbl.textContent = PAGE_TITLES[i];
      pageEl.appendChild(lbl);
      this._pageEls.push(pageEl);
      this._pagedSection.appendChild(pageEl);
    }

    // Nav bar: ◄  ● ○ ○  ►
    this._navBar = el('div', {
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      gap: '14px', marginTop: S.norm.navMarginT, paddingTop: S.norm.navPadT,
      borderTop: '1px solid rgba(80,110,255,0.18)',
    });

    this._prevBtn = this._navBtn('◄', () => {
      if (this._currentPage > 0) {
        let p = this._currentPage - 1;
        if (p === 4 && this._d.mode !== 'target-practice') p = 3;
        this._showPage(p);
      }
    });
    this._navBar.appendChild(this._prevBtn);

    const dotsWrap = el('div', { display: 'flex', gap: '10px', alignItems: 'center' });
    for (let i = 0; i < NUM_PAGES; i++) {
      const dot = el('span', {
        fontSize: '16px', cursor: 'pointer',
        color: 'rgba(170,185,255,0.8)', userSelect: 'none',
        display: (i === 4 || i === 5) ? 'none' : '', // mode-specific dots start hidden
      });
      dot.textContent = '○';
      dot.addEventListener('click', () => this._showPage(i));
      this._dotEls.push(dot);
      dotsWrap.appendChild(dot);
    }
    this._navBar.appendChild(dotsWrap);

    this._nextBtn = this._navBtn('►', () => {
      if (this._currentPage < this._maxPage) {
        let p = this._currentPage + 1;
        if (p === 4 && this._d.mode !== 'target-practice') p = 5;
        this._showPage(p);
      }
    });
    this._navBar.appendChild(this._nextBtn);

    this._pagedSection.appendChild(this._navBar);
    panel.appendChild(this._pagedSection);

    // ── Start button ─────────────────────────────────────────────────────────
    this._startBtn = el('button', {
      display:       'block',
      margin:        `${S.norm.startMarginT} auto 0`,
      padding:       S.norm.startPad,
      background:    'rgba(35,55,175,0.7)',
      border:        '1px solid rgba(110,140,255,0.55)',
      borderRadius:  '5px',
      color:         '#eef',
      fontFamily:    'monospace',
      fontSize:      S.norm.startFont,
      letterSpacing: '0.12em',
      cursor:        'pointer',
      boxShadow:     '0 0 18px rgba(70,95,255,0.35)',
    });
    this._startBtn.textContent = 'START GAME';
    this._startBtn.addEventListener('mouseenter', () => {
      this._startBtn.style.background = 'rgba(55,85,210,0.9)';
      this._startBtn.style.boxShadow  = '0 0 28px rgba(90,120,255,0.6)';
    });
    this._startBtn.addEventListener('mouseleave', () => {
      this._startBtn.style.background = 'rgba(35,55,175,0.7)';
      this._startBtn.style.boxShadow  = '0 0 18px rgba(70,95,255,0.35)';
    });
    this._startBtn.addEventListener('click', () => {
      this.hide();
      this._onStartCb?.(this.config);
    });
    panel.appendChild(this._startBtn);

    // ── Info links ───────────────────────────────────────────────────────────
    this._infoBar = el('div', {
      display: 'flex', justifyContent: 'center', flexWrap: 'wrap',
      gap: S.norm.infoGap, rowGap: '6px', marginTop: S.norm.infoMarginT,
    });
    for (const [label, key] of [['About', 'about'], ['Instructions', 'instructions'], ['Education', 'education'], ['Scores', 'scores'], ['? Options Help', 'options']]) {
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
      btn.addEventListener('click', () => this._onInfoBtn?.(key));
      this._infoBar.appendChild(btn);
    }
    panel.appendChild(this._infoBar);

    return overlay;
  }

  _navBtn(label, onClick) {
    const btn = el('button', {
      background:   'rgba(10,10,25,0.82)',
      border:       '1px solid rgba(255,255,255,0.22)',
      borderRadius: '4px',
      color:        '#dde',
      fontFamily:   'monospace',
      fontSize:     '13px',
      padding:      '4px 14px',
      cursor:       'pointer',
    });
    btn.textContent = label;
    btn.addEventListener('click', onClick);
    btn.addEventListener('mouseenter', () => { if (!btn.disabled) btn.style.background = 'rgba(40,45,90,0.95)'; });
    btn.addEventListener('mouseleave', () => { btn.style.background = 'rgba(10,10,25,0.82)'; });
    return btn;
  }

  // ── Option rows ──────────────────────────────────────────────────────────────

  _row(label, ctrl) {
    const row = el('div', {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      marginBottom: S.norm.rowMarginB, minHeight: S.norm.rowMinH,
    });
    const lbl = el('span', {
      fontSize: S.norm.lblFont, letterSpacing: '0.07em',
      color: 'rgba(185,195,235,0.8)', minWidth: S.norm.lblMinW,
    });
    lbl.textContent = label;
    row.appendChild(lbl);
    row.appendChild(ctrl);
    return row;
  }

  _cycle(key, values, toLabel) {
    let idx = Math.max(0, values.indexOf(this._d[key]));

    const display = el('span', {
      display: 'inline-block', minWidth: S.norm.valMinW, textAlign: 'center',
      fontSize: S.norm.valFont, color: '#eee',
    });
    const refresh = () => { display.textContent = toLabel(values[idx], idx); };
    refresh();

    const ctrl = this._cycleCtrl(display,
      () => { idx = (idx + 1) % values.length;                    this._d[key] = values[idx]; refresh(); this._onChange(key); },
      () => { idx = (idx - 1 + values.length) % values.length;   this._d[key] = values[idx]; refresh(); this._onChange(key); },
    );
    ctrl._refresh = () => { idx = Math.max(0, values.indexOf(this._d[key])); refresh(); };
    return ctrl;
  }

  _playerRow() {
    const vals = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    const ctrl = this._cycle('numPlayers', vals, v => `${v} players`);
    this._playersCtrl = ctrl;
    return this._row('PLAYERS', ctrl);
  }

  _humanRow() {
    const display = el('span', {
      display: 'inline-block', minWidth: S.norm.valMinW, textAlign: 'center',
      fontSize: S.norm.valFont, color: '#eee',
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
      fontSize:     S.norm.arrowFont,
      padding:      S.norm.arrowPad,
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
if (this._d.numPlayers > 4)   { this._d.numPlayers = 4;   this._playersCtrl?._refresh(); this._onChange('numPlayers'); }
    }
    if (key === 'collectables') this._updateCollectableGrey();
    if (key === 'mode') {
      let page = this._currentPage;
      if (page === 4 && this._d.mode !== 'target-practice') page = 3;
      if (page === 5 && this._d.mode !== 'tournament')      page = 3;
      this._showPage(Math.min(page, this._maxPage));
    }
  }

  setDevMode(enabled) {
    this._devBadge.style.display = enabled ? 'inline' : 'none';
    this._devModeOn = enabled;
    this._updateDevRows();
    if (this._perfValues) {
      if (enabled) {
        if (!this._perfValues.includes('experimental')) this._perfValues.push('experimental');
        if (!this._perfValues.includes('exp-ipad'))    this._perfValues.push('exp-ipad');
      } else {
        for (const mode of ['experimental', 'exp-ipad']) {
          const i = this._perfValues.indexOf(mode);
          if (i >= 0) this._perfValues.splice(i, 1);
        }
        if (this._d.performance === 'experimental' || this._d.performance === 'exp-ipad') {
          this._d.performance = 'full';
          this._perfCtrl._refresh();
        }
      }
    }
  }

  setCampaignComplete(complete) {
    this._campaignUnlocked = complete;
    this._updateDevRows();
  }

  _updateDevRows() {
    const show = this._devModeOn || this._campaignUnlocked;
    for (const row of this._devRows ?? []) {
      row.style.display = show ? '' : 'none';
    }
  }

  _updateCollectableGrey() {
    const off = this._d.collectables === 'off';
    for (const row of this._collectSubRows ?? []) {
      row.style.opacity       = off ? '0.35' : '1';
      row.style.pointerEvents = off ? 'none' : '';
    }
  }

  _updateSeedGrey() {
    const active = (this._d.overrideSeed ?? '').trim().length > 0;
    for (const row of this._seedSubRows ?? []) {
      row.style.opacity       = active ? '0.35' : '1';
      row.style.pointerEvents = active ? 'none' : '';
    }
  }

  // Called by main.js after each game starts — writes the seed actually used into the read-only display.
  setGeneratedSeed(seed) {
    if (this._currentSeedDisplay) {
      this._currentSeedDisplay.value = seed;
    }
  }

  _currentSeedRow() {
    const input = document.createElement('input');
    input.type     = 'text';
    input.readOnly = true;
    input.value    = '';
    Object.assign(input.style, {
      background:    'rgba(5,5,20,0.5)',
      border:        '1px solid rgba(80,110,255,0.18)',
      borderRadius:  '3px',
      color:         'rgba(180,185,210,0.55)',
      fontFamily:    'monospace',
      fontSize:      S.norm.arrowFont,
      padding:       S.norm.arrowPad,
      minWidth:      '150px',
      outline:       'none',
      letterSpacing: '0.06em',
      cursor:        'text',
    });
    this._currentSeedDisplay = input;

    const ctrl = el('div', {});
    ctrl.appendChild(input);
    return this._row('CURRENT SEED', ctrl);
  }

  _overrideSeedRow() {
    const input = document.createElement('input');
    input.type        = 'text';
    input.maxLength   = 32;
    input.placeholder = 'leave blank for random…';
    input.value       = this._d.overrideSeed ?? '';
    Object.assign(input.style, {
      background:    'rgba(5,5,20,0.8)',
      border:        '1px solid rgba(80,110,255,0.3)',
      borderRadius:  '3px',
      color:         '#eee',
      fontFamily:    'monospace',
      fontSize:      S.norm.arrowFont,
      padding:       S.norm.arrowPad,
      minWidth:      '150px',
      outline:       'none',
      letterSpacing: '0.06em',
    });
    input.addEventListener('focus', () => { input.style.borderColor = 'rgba(130,160,255,0.6)'; });
    input.addEventListener('blur',  () => { input.style.borderColor = 'rgba(80,110,255,0.3)'; });
    input.addEventListener('input', () => {
      this._d.overrideSeed = input.value;
      this._updateSeedGrey();
    });
    this._overrideSeedInput = input;

    const ctrl = el('div', {});
    ctrl.appendChild(input);
    return this._row('OVERRIDE SEED', ctrl);
  }
}

function el(tag, styles) {
  const node = document.createElement(tag);
  Object.assign(node.style, styles);
  return node;
}
