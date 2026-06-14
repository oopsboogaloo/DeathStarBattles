// Copyright © 2026 Chloe Bolland
// contact chloe@mammoththoughts.com if you wish to use, publish or reproduce this game or any part of it in any way

export class StoryDialogPopup {
  constructor() {
    this._onDismiss = null;

    // Dark overlay behind the popup
    this.overlay = document.createElement('div');
    Object.assign(this.overlay.style, {
      position:   'fixed',
      inset:      '0',
      background: 'rgba(0,0,0,0.45)',
      zIndex:     '30',
      display:    'none',
    });

    // Dialog box
    this.box = document.createElement('div');
    Object.assign(this.box.style, {
      position:     'fixed',
      bottom:       '80px',
      left:         '50%',
      transform:    'translateX(-50%)',
      background:   'rgba(3,3,18,0.97)',
      border:       '1px solid rgba(80,110,255,0.5)',
      borderRadius: '8px',
      padding:      '18px 22px 14px',
      fontFamily:   'monospace',
      fontSize:     '14px',
      color:        '#dde',
      zIndex:       '31',
      display:      'none',
      maxWidth:     '480px',
      minWidth:     '260px',
      lineHeight:   '1.55',
      boxShadow:    '0 0 30px rgba(50,80,200,0.3)',
    });

    this._textEl = document.createElement('div');
    this._textEl.style.marginBottom = '14px';

    this._dismissBtn = document.createElement('button');
    this._dismissBtn.textContent = 'DISMISS';
    Object.assign(this._dismissBtn.style, {
      background:   'rgba(40,60,160,0.85)',
      border:       '1px solid rgba(80,110,255,0.5)',
      borderRadius: '4px',
      color:        '#aac',
      fontFamily:   'monospace',
      fontSize:     '12px',
      letterSpacing:'1px',
      padding:      '6px 18px',
      cursor:       'pointer',
      display:      'block',
      marginLeft:   'auto',
    });
    this._dismissBtn.addEventListener('mouseenter', () => {
      this._dismissBtn.style.background = 'rgba(60,90,200,0.9)';
      this._dismissBtn.style.color = '#fff';
    });
    this._dismissBtn.addEventListener('mouseleave', () => {
      this._dismissBtn.style.background = 'rgba(40,60,160,0.85)';
      this._dismissBtn.style.color = '#aac';
    });
    this._dismissBtn.addEventListener('click', e => {
      e.stopPropagation();
      this._onDismiss?.();
    });

    this.box.append(this._textEl, this._dismissBtn);
    document.body.append(this.overlay, this.box);
  }

  setOnDismiss(cb) { this._onDismiss = cb; }

  update(gs) {
    if (gs?.storyDialogText) {
      this._textEl.textContent = gs.storyDialogText;
      this.overlay.style.display = 'block';
      this.box.style.display     = 'block';
    } else {
      this.overlay.style.display = 'none';
      this.box.style.display     = 'none';
    }
  }
}
