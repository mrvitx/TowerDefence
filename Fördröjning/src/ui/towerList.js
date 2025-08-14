// Tower list rendering and selection.
import { TOWER_TYPES } from '../towers.js';
import { State } from '../state.js';

export function initTowerList({ onSelect } = {}) {
  const listEl = document.getElementById('towerBtns');
  const moneyEl = document.getElementById('money');

  function refresh() {
    if (!listEl) return;
    listEl.innerHTML = '';
    let i = 1;
    for (const key in TOWER_TYPES) {
      const def = TOWER_TYPES[key];
      const wrap = document.createElement('div');
      wrap.style.textAlign = 'center';
      const c = document.createElement('canvas');
      c.width = 64; c.height = 64; c.style.background = '#111'; c.style.display = 'block'; c.style.marginBottom = '6px';
      const ctx2 = c.getContext('2d');
      if (def.income) {
        ctx2.fillStyle = '#2b2b2b'; ctx2.beginPath(); ctx2.arc(32,32,18,0,Math.PI*2); ctx2.fill();
        ctx2.fillStyle = def.color || '#fc6'; ctx2.strokeStyle = '#000';
        for(let k=0;k<3;k++){ const off=8-k*6; ctx2.beginPath(); ctx2.ellipse(32,32+off,12,6,0,0,Math.PI*2); ctx2.fill(); ctx2.stroke(); }
        ctx2.fillStyle='#000'; ctx2.font='bold 11px system-ui'; ctx2.textAlign='center'; ctx2.textBaseline='middle'; ctx2.fillText('¤',32,30);
      } else {
        ctx2.fillStyle = def.color; ctx2.beginPath(); ctx2.arc(32,32,18,0,Math.PI*2); ctx2.fill(); ctx2.fillStyle='#000'; ctx2.fillRect(22,28,20,8);
      }
      const btn = document.createElement('button'); btn.style.display='block'; btn.style.width='100%';
      btn.textContent = `${i} ${def.label} (${def.cost})`;
      btn.onclick = ()=>{ try { onSelect && onSelect(def.id); } catch(_e) {} };
      const statsLine = document.createElement('div'); statsLine.className='small';
      if(def.income){ statsLine.textContent = `Income: ${def.income}/våg`; }
      else { statsLine.textContent = `DMG:${def.dmg}  RNG:${def.range}  ROF:${def.fireRate}s`; }
      wrap.appendChild(c); wrap.appendChild(btn); wrap.appendChild(statsLine); listEl.appendChild(wrap); i++;
    }
    updateAffordability();
  }

  function updateAffordability(){
    if(!listEl) return; const cards = listEl.querySelectorAll('button'); let idx=0;
    for(const key in TOWER_TYPES){ const def=TOWER_TYPES[key]; const btn = cards[idx++]; if(!btn) break; const affordable = (State.money||0) >= def.cost; btn.style.opacity = affordable ? '1' : '0.5'; btn.disabled = false; }
  }

  // Watch money label to update affordability live
  try{
    if(moneyEl){ const obs = new MutationObserver(updateAffordability); obs.observe(moneyEl, {childList:true, characterData:true, subtree:true}); }
  }catch(_e){}

  return { refresh, updateAffordability };
}
