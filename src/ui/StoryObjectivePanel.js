export class StoryObjectivePanel {
  constructor() {
    this._collapsed = false;
    this._lastGs    = null;

    this.el = document.createElement('div');
    Object.assign(this.el.style, {
      position:      'fixed',
      top:           '14px',
      right:         '14px',
      background:    'rgba(3,3,18,0.88)',
      border:        '1px solid rgba(80,110,255,0.35)',
      borderRadius:  '6px',
      padding:       '8px 12px',
      fontFamily:    'monospace',
      fontSize:      '13px',
      color:         '#ccd',
      zIndex:        '8',
      display:       'none',
      minWidth:      '170px',
      cursor:        'pointer',
      userSelect:    'none',
      lineHeight:    '1.6',
      transition:    'background 0.15s, border-color 0.15s',
    });
    this.el.addEventListener('click', () => {
      this._collapsed = !this._collapsed;
      if (this._lastGs) this.update(this._lastGs);
    });
    document.body.appendChild(this.el);
  }

  update(gs) {
    this._lastGs = gs;
    const ss = gs?.storyState;
    if (!ss || gs.mode === 'story_debrief') { this.el.style.display = 'none'; return; }

    this.el.style.display = 'block';

    if (this._collapsed) {
      Object.assign(this.el.style, {
        background: 'rgba(3,3,18,0.40)',
        border:     '1px solid rgba(80,110,255,0.18)',
        padding:    '5px 9px',
        minWidth:   '0',
      });
      this.el.innerHTML = '<span style="color:rgba(119,153,255,0.65);font-size:11px;letter-spacing:1px">OBJ &#9660;</span>';
      return;
    }

    Object.assign(this.el.style, {
      background: 'rgba(3,3,18,0.88)',
      border:     '1px solid rgba(80,110,255,0.35)',
      padding:    '8px 12px',
      minWidth:   '170px',
    });

    const parts = [`<span style="color:#7799ff;letter-spacing:1px;font-size:11px">OBJECTIVES &#9650;</span>`];

    if (ss.objectives.length === 0) {
      parts.push(`<span style="color:#555">— awaiting orders —</span>`);
    }
    for (let i = 0; i < ss.objectives.length; i++) {
      const obj = ss.objectives[i];
      const met = ss.objectiveMet[i];
      const icon  = met ? '✓' : '○';
      const color = met ? '#66ee88' : '#ccd';
      let label;
      switch (obj.type) {
        case 'destroy_all': label = 'Destroy all enemies';              break;
        case 'destroy_n':   label = `Destroy ${obj.params.count}`;      break;
        case 'collect_n':
          label = `Collect ${ss.collectCount} / ${obj.params.count}`;  break;
        default:            label = obj.type;
      }
      parts.push(`<span style="color:${color}">${icon} ${label}</span>`);
    }

    const maxTurnsFc = ss.mission.failConditions.find(fc => fc.type === 'max_turns');
    const displayTurn = gs.turn + 1;
    const turnStr = maxTurnsFc
      ? `Turn ${displayTurn} / ${maxTurnsFc.turns}`
      : `Turn ${displayTurn}`;
    parts.push(`<span style="color:#666;font-size:11px">${turnStr}</span>`);

    this.el.innerHTML = parts.join('<br>');
  }

  hide() { this.el.style.display = 'none'; }
}
