import { STORY_MISSIONS } from '../story/StoryMissions.js';
import { StoryPersistence } from '../story/StoryPersistence.js';

const PHASES = [
  { label: 'Phase 1 — Basic Training',   range: [0,  3]  },
  { label: 'Phase 2 — Live Fire',         range: [4,  10] },
  { label: 'Phase 3 — Field Operations', range: [11, 15] },
  { label: 'Phase 4 — Total War',        range: [16, 19] },
];

function el(tag, styles = {}, text = '') {
  const e = document.createElement(tag);
  Object.assign(e.style, styles);
  if (text) e.textContent = text;
  return e;
}

function btn(label, bg = 'rgba(35,55,175,0.75)', hoverBg = 'rgba(55,85,210,0.9)') {
  const b = el('button', {
    background:    bg,
    border:        '1px solid rgba(80,110,255,0.45)',
    borderRadius:  '5px',
    color:         '#cce',
    fontFamily:    'monospace',
    fontSize:      '13px',
    letterSpacing: '0.05em',
    padding:       '8px 22px',
    cursor:        'pointer',
  }, label);
  b.addEventListener('mouseenter', () => { b.style.background = hoverBg; b.style.color = '#fff'; });
  b.addEventListener('mouseleave', () => { b.style.background = bg; b.style.color = '#cce'; });
  return b;
}

export class StoryModeScreen {
  constructor() {
    this._onStartMission = null;
    this._onClose        = null;
    this._selectedMission = null;
    this._debriefGs       = null;
    this._devMode         = false;

    this.el = el('div', {
      position:   'fixed',
      inset:      '0',
      background: 'rgba(3,3,18,0.97)',
      zIndex:     '40',
      display:    'none',
      overflowY:  'auto',
      fontFamily: 'monospace',
      color:      '#ccd',
    });
    document.body.appendChild(this.el);

    this._selectView   = this._buildSelectView();
    this._briefingView = this._buildBriefingView();
    this._debriefView  = this._buildDebriefView();
    this.el.append(this._selectView, this._briefingView, this._debriefView);
  }

  setOnStartMission(cb)  { this._onStartMission = cb; }
  setOnClose(cb)         { this._onClose = cb; }
  setDevMode(on)         { this._devMode = on; if (this._selectView.style.display !== 'none') this._refresh(); }
  get isVisible()        { return this.el.style.display !== 'none'; }

  showSelect() {
    this.el.style.display = 'block';
    this._refresh();
    this._show(this._selectView);
  }

  showBriefing(mission) {
    this._selectedMission = mission;
    this.el.style.display = 'block';
    this._populateBriefing(mission);
    this._show(this._briefingView);
  }

  showDebrief(gs) {
    this._debriefGs = gs;
    this.el.style.display = 'block';
    this._populateDebrief(gs);
    this._show(this._debriefView);
  }

  hide() { this.el.style.display = 'none'; }

  // ─── Select view ──────────────────────────────────────────────────────────────

  _buildSelectView() {
    const view = el('div', { display: 'none', padding: '32px 24px 48px' });

    const title = el('div', {
      textAlign:     'center',
      fontSize:      '22px',
      letterSpacing: '3px',
      color:         '#8899ff',
      marginBottom:  '28px',
    }, 'STORY MODE');
    view.appendChild(title);

    this._missionGrid = el('div', {});
    view.appendChild(this._missionGrid);

    const footer = el('div', { textAlign: 'center', marginTop: '32px' });
    const backBtn = btn('← Back to Menu', 'rgba(10,10,25,0.7)', 'rgba(30,30,60,0.9)');
    backBtn.addEventListener('click', () => { this.hide(); this._onClose?.(); });
    footer.appendChild(backBtn);
    view.appendChild(footer);

    return view;
  }

  _refresh() {
    const data = StoryPersistence.load();
    this._missionGrid.innerHTML = '';

    for (const phase of PHASES) {
      const [start, end] = phase.range;
      const missions     = STORY_MISSIONS.slice(start, end + 1);

      const phaseHeader = el('div', {
        fontSize:      '11px',
        letterSpacing: '2px',
        color:         '#556',
        margin:        '16px 0 8px',
        textTransform: 'uppercase',
      }, phase.label);
      this._missionGrid.appendChild(phaseHeader);

      const row = el('div', {
        display:             'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
        gap:                 '8px',
      });

      for (const m of missions) {
        const unlocked      = this._devMode || StoryPersistence.isUnlocked(m.id, data);
        const bestScore     = StoryPersistence.getBestScore(m.id, data);
        const assistedLevel = bestScore === null ? StoryPersistence.getAssistedLevel(m.id, data) : null;
        const card          = this._missionCard(m, unlocked, bestScore, assistedLevel);
        row.appendChild(card);
      }
      this._missionGrid.appendChild(row);
    }

    const complete = StoryPersistence.isCampaignComplete(data);
    if (complete) {
      const banner = el('div', {
        textAlign:   'center',
        marginTop:   '24px',
        color:       '#ffdd66',
        fontSize:    '13px',
        letterSpacing: '1px',
      }, '★  CAMPAIGN COMPLETE  ★');
      this._missionGrid.appendChild(banner);
    }
  }

  _missionCard(mission, unlocked, bestScore, assistedLevel = null) {
    const card = el('div', {
      background:   unlocked ? 'rgba(15,20,50,0.85)' : 'rgba(8,8,20,0.6)',
      border:       `1px solid ${unlocked ? 'rgba(80,110,255,0.4)' : 'rgba(50,50,80,0.3)'}`,
      borderRadius: '6px',
      padding:      '10px 10px 8px',
      cursor:       unlocked ? 'pointer' : 'default',
      opacity:      unlocked ? '1' : '0.45',
      transition:   'border-color 0.15s',
    });

    const num = el('div', {
      fontSize:      '10px',
      color:         '#556',
      marginBottom:  '3px',
      letterSpacing: '1px',
    }, mission.id.split('-')[0].toUpperCase());
    const name = el('div', { fontSize: '12px', color: unlocked ? '#ccd' : '#667', lineHeight: '1.3' }, mission.title);
    card.append(num, name);

    if (unlocked) {
      const score = el('div', { fontSize: '11px', marginTop: '6px' });
      if (bestScore !== null) {
        score.style.color = '#88ee88';
        score.textContent = `✓  ${bestScore.toLocaleString()}`;
      } else if (assistedLevel !== null) {
        const label = { eighth: 'Minor', quarter: 'Major', half: 'Extreme', full: 'Cheating' }[assistedLevel] ?? assistedLevel;
        score.style.color = 'rgba(255,200,80,0.75)';
        score.textContent = `✓  (${label} assistance)`;
      } else {
        score.style.color = '#555';
        score.textContent = 'Not completed';
      }
      card.appendChild(score);

      card.addEventListener('mouseenter', () => { card.style.borderColor = 'rgba(100,140,255,0.7)'; card.style.background = 'rgba(25,35,80,0.9)'; });
      card.addEventListener('mouseleave', () => { card.style.borderColor = 'rgba(80,110,255,0.4)';  card.style.background = 'rgba(15,20,50,0.85)'; });
      card.addEventListener('click',      () => this.showBriefing(mission));
    } else {
      const locked = el('div', { fontSize: '11px', marginTop: '6px', color: '#334' }, 'LOCKED');
      card.appendChild(locked);
    }

    return card;
  }

  // ─── Briefing view ────────────────────────────────────────────────────────────

  _buildBriefingView() {
    const view = el('div', { display: 'none', padding: '40px 32px 48px', maxWidth: '640px', margin: '0 auto' });

    this._briefTitle    = el('div', { fontSize: '18px', color: '#8899ff', marginBottom: '20px', letterSpacing: '1px' });
    this._briefStory    = el('div', { fontSize: '14px', lineHeight: '1.7', color: '#bbc', marginBottom: '20px' });
    this._briefObjList  = el('div', { fontSize: '13px', color: '#99bb99', marginBottom: '24px' });

    const btnRow = el('div', { display: 'flex', gap: '16px', justifyContent: 'center' });
    const backBtn  = btn('← Back', 'rgba(10,10,25,0.7)', 'rgba(30,30,60,0.9)');
    this._startBtn = btn('Start Mission  →');
    backBtn.addEventListener('click', () => { this._show(this._selectView); this._refresh(); });
    this._startBtn.addEventListener('click', () => {
      this.hide();
      this._onStartMission?.(this._selectedMission);
    });
    btnRow.append(backBtn, this._startBtn);

    view.append(this._briefTitle, this._briefStory, this._briefObjList, btnRow);
    return view;
  }

  _populateBriefing(mission) {
    this._briefTitle.textContent = `${mission.id.split('-')[0].toUpperCase()} — ${mission.title.toUpperCase()}`;
    this._briefStory.textContent = mission.story;

    this._briefObjList.innerHTML = '';
    for (const obj of mission.objectives) {
      const line = el('div', {}, '○  ' + this._objLabel(obj));
      this._briefObjList.appendChild(line);
    }
    const fc = mission.failConditions.find(f => f.type === 'max_turns');
    if (fc) {
      const line = el('div', { color: '#cc7777', marginTop: '4px' }, `⚠  ${fc.turns} turn limit`);
      this._briefObjList.appendChild(line);
    }
  }

  _objLabel(obj) {
    switch (obj.type) {
      case 'destroy_all': return 'Destroy all enemies';
      case 'destroy_n':   return `Destroy ${obj.params.count} enemies`;
      case 'collect_n':   return `Collect ${obj.params.count} power-ups`;
      default:            return obj.type;
    }
  }

  // ─── Debrief view ─────────────────────────────────────────────────────────────

  _buildDebriefView() {
    const view = el('div', { display: 'none', padding: '48px 32px', maxWidth: '500px', margin: '0 auto', textAlign: 'center' });

    this._debriefTitle   = el('div', { fontSize: '16px', color: '#8899ff', marginBottom: '24px', letterSpacing: '1px' });
    this._debriefResult  = el('div', { fontSize: '26px', marginBottom: '16px' });
    this._debriefScore   = el('div', { fontSize: '14px', color: '#aac', marginBottom: '8px' });
    this._debriefBest    = el('div', { fontSize: '12px', color: '#667', marginBottom: '12px' });
    this._debriefAssist  = el('div', { fontSize: '11px', color: 'rgba(255,200,80,0.6)', marginBottom: '20px', fontStyle: 'italic' });

    const btnRow        = el('div', { display: 'flex', gap: '14px', justifyContent: 'center', flexWrap: 'wrap' });
    this._retryBtn      = btn('Retry');
    this._selectBtn     = btn('Mission Select', 'rgba(10,10,25,0.7)', 'rgba(30,30,60,0.9)');
    this._nextBtn       = btn('Next Mission  →');

    this._retryBtn.addEventListener('click', () => {
      this.hide();
      this._onStartMission?.(this._debriefGs.storyState.mission);
    });
    this._selectBtn.addEventListener('click', () => {
      this._show(this._selectView);
      this._refresh();
    });
    this._nextBtn.addEventListener('click', () => {
      const idx  = STORY_MISSIONS.indexOf(this._debriefGs.storyState.mission);
      const next = STORY_MISSIONS[idx + 1];
      if (next) this.showBriefing(next);
    });

    btnRow.append(this._retryBtn, this._selectBtn, this._nextBtn);
    view.append(this._debriefTitle, this._debriefResult, this._debriefScore, this._debriefBest, this._debriefAssist, btnRow);
    return view;
  }

  _populateDebrief(gs) {
    const ss      = gs.storyState;
    const mission = ss.mission;
    const data    = StoryPersistence.load();
    const best    = StoryPersistence.getBestScore(mission.id, data);

    this._debriefTitle.textContent = `${mission.id.split('-')[0].toUpperCase()} — ${mission.title.toUpperCase()}`;

    if (ss.passed) {
      this._debriefResult.textContent = '✓  MISSION COMPLETE';
      this._debriefResult.style.color = '#66ee88';
      this._debriefScore.textContent  = `Score: ${ss.score.toLocaleString()}`;
      this._debriefBest.textContent   = best !== null ? `Best: ${best.toLocaleString()}` : '';
    } else {
      this._debriefResult.textContent = '✗  MISSION FAILED';
      this._debriefResult.style.color = '#ee6666';
      this._debriefScore.textContent  = '';
      this._debriefBest.textContent   = best !== null ? `Best: ${best.toLocaleString()}` : '';
    }

    const bp = gs.config?.bulletPaths;
    if (bp && bp !== 'off') {
      const label = { eighth: 'Minor', quarter: 'Major', half: 'Extreme', full: 'Cheating' }[bp] ?? bp;
      this._debriefAssist.textContent = `Assistance level... ${label}`;
      this._debriefAssist.style.display = '';
    } else {
      this._debriefAssist.style.display = 'none';
    }

    const idx  = STORY_MISSIONS.indexOf(mission);
    const next = STORY_MISSIONS[idx + 1];
    const nextUnlocked = next && (this._devMode || StoryPersistence.isUnlocked(next.id, data));
    this._nextBtn.style.display = (ss.passed && next && nextUnlocked) ? 'inline-block' : 'none';

    if (ss.passed && StoryPersistence.isCampaignComplete(data)) {
      this._debriefResult.textContent = '★  CAMPAIGN COMPLETE!';
      this._debriefResult.style.color = '#ffdd66';
    }
  }

  // ─── helpers ─────────────────────────────────────────────────────────────────

  _show(view) {
    this._selectView.style.display   = 'none';
    this._briefingView.style.display = 'none';
    this._debriefView.style.display  = 'none';
    view.style.display = 'block';
    this.el.scrollTop  = 0;
  }
}
