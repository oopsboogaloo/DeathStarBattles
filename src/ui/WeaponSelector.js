import { WeaponId } from '../entities/Collectable.js';

const LABELS = {
  [WeaponId.CANNON]:        'CANNON',
  [WeaponId.HYPERSPACE]:    'HYPERSPACE',
  [WeaponId.TRIPLE_CANNON]: 'TRIPLE CANNON',
};

export class WeaponSelector {
  constructor() {
    this._onSelect = null;
    this._isOpen   = false;
    this.popup     = this._buildPopup();
    document.body.appendChild(this.popup);
  }

  setOnSelect(cb) { this._onSelect = cb; }
  get isOpen()    { return this._isOpen; }

  // Refresh the weapon button label to match the station's current weapon.
  updateBtn(btn, station) {
    if (!station) return;
    const w   = station.selectedWeapon;
    const lbl = LABELS[w] ?? w;
    const n   = w === WeaponId.TRIPLE_CANNON ? station.team.getStock(WeaponId.TRIPLE_CANNON) : null;
    btn.textContent = n !== null ? `${lbl} [${n}] ▲` : `${lbl} ▲`;
  }

  open(station, anchorEl) {
    this._rebuildRows(station);
    this.popup.style.display = 'block';
    this._isOpen = true;
    this._position(anchorEl);
  }

  close() {
    this.popup.style.display = 'none';
    this._isOpen = false;
  }

  toggle(station, anchorEl) {
    this._isOpen ? this.close() : this.open(station, anchorEl);
  }

  _position(anchorEl) {
    const rect = anchorEl.getBoundingClientRect();
    this.popup.style.left   = `${rect.left}px`;
    this.popup.style.bottom = `${window.innerHeight - rect.top + 6}px`;
    this.popup.style.top    = 'auto';
  }

  _buildPopup() {
    const popup = document.createElement('div');
    Object.assign(popup.style, {
      position:     'fixed',
      display:      'none',
      background:   'rgba(3,3,18,0.97)',
      border:       '1px solid rgba(80,110,255,0.4)',
      borderRadius: '6px',
      padding:      '6px 0',
      fontFamily:   'monospace',
      fontSize:     '14px',
      zIndex:       '20',
      boxShadow:    '0 0 20px rgba(50,70,200,0.3)',
      minWidth:     '170px',
    });
    return popup;
  }

  _rebuildRows(station) {
    this.popup.innerHTML = '';
    const weapons = [WeaponId.CANNON, WeaponId.HYPERSPACE];
    const tcStock = station.team.getStock(WeaponId.TRIPLE_CANNON);
    if (tcStock > 0) weapons.splice(1, 0, WeaponId.TRIPLE_CANNON);

    for (const weaponId of weapons) {
      const isSelected = station.selectedWeapon === weaponId;
      const row = document.createElement('div');
      const lbl = LABELS[weaponId];
      const suffix = weaponId === WeaponId.TRIPLE_CANNON ? ` [${tcStock}]` : ' (∞)';
      row.textContent = (isSelected ? '▶ ' : '   ') + lbl + suffix;
      Object.assign(row.style, {
        padding:    '8px 16px',
        cursor:     'pointer',
        color:      isSelected ? '#fff' : '#99b',
        background: 'transparent',
        whiteSpace: 'nowrap',
      });
      row.addEventListener('mouseenter', () => { row.style.background = 'rgba(40,40,80,0.8)'; });
      row.addEventListener('mouseleave', () => { row.style.background = 'transparent'; });
      row.addEventListener('click', e => {
        e.stopPropagation();
        this._onSelect?.(weaponId);
        this.close();
      });
      this.popup.appendChild(row);
    }
  }
}
