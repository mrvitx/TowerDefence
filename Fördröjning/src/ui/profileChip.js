// Profile chip updater isolated from main UI glue.
import { loadProfile, xpToNext } from '../profiles/profile.js';

export function startProfileChipSync() {
  function apply() {
    try {
      const p = loadProfile();
      const nm = document.getElementById('pcName');
      const lv = document.getElementById('pcLvl');
      const xp = document.getElementById('pcXpFill');
      const pctLbl = document.getElementById('pcXpPct');
      if (nm) nm.textContent = p.name || 'Spelare';
      if (lv) lv.textContent = 'Lvl ' + (p.level || 1);
      if (xp) {
        const need = xpToNext(p.level || 1) || 1;
        const pct = Math.max(0, Math.min(100, Math.floor(((p.xp || 0) / need) * 100)));
        xp.style.width = pct + '%';
        if (pctLbl) pctLbl.textContent = pct + '%';
      }
    } catch(_e) {}
  }
  apply();
  const id = setInterval(apply, 800);
  return () => clearInterval(id);
}
