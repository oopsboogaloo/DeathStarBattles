export class StoryObjectivePanel {
  constructor() {
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
      pointerEvents: 'none',
      lineHeight:    '1.6',
    });
    document.body.appendChild(this.el);
  }

  update(gs) {
    const ss = gs?.storyState;
    if (!ss || gs.mode === 'story_debrief') { this.el.style.display = 'none'; return; }

    this.el.style.display = 'block';

    const parts = [`<span style="color:#7799ff;letter-spacing:1px;font-size:11px">OBJECTIVES</span>`];

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
