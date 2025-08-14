// Upgrade popup panel encapsulated.
import { Admin, MapModifiers } from '../constants.js';
import { State } from '../state.js';
import { ensurePriceBadge } from '../utils/dom.js';

export function createUpgradePopup() {
  let popup = null;
  let selectedTower = null;

  function ensure(){
    if(popup) return;
    popup = document.createElement('div');
    popup.style.position='fixed';
    popup.style.background='rgba(20,20,20,0.98)';
    popup.style.border='1px solid #444';
    popup.style.padding='8px';
    popup.style.borderRadius='10px';
    popup.style.zIndex='1000';
    popup.style.minWidth='180px';
    popup.style.boxShadow='0 2px 10px rgba(0,0,0,0.4)';
    popup.classList.add('hidden');
    popup.innerHTML = `
      <div style="font-weight:600;margin-bottom:6px" id="upgTitle">Uppgradera</div>
      <div id="upgStats" class="small" style="background:#0e0e0f;border:1px solid #333;border-radius:8px;padding:8px;margin-bottom:8px;line-height:1.35"></div>
      <div style="display:grid;grid-template-columns:1fr auto;gap:6px;align-items:center">
        <div class="small" id="cLblD">+DMG</div><button id="ppDmg" style="color:#fff">Köp</button>
        <div class="small" id="cLblR">+Range</div><button id="ppRange" style="color:#fff">Köp</button>
        <div class="small" id="cLblRt">+Rate</div><button id="ppRate" style="color:#fff">Köp</button>
        <div></div><button id="ppSell" class="btn-secondary" style="background:#b33;color:#fff">Sälj</button>
      </div>`;
    document.body.appendChild(popup);
    ensurePriceBadge(popup.querySelector('#ppDmg'));
    ensurePriceBadge(popup.querySelector('#ppRange'));
    ensurePriceBadge(popup.querySelector('#ppRate'));
    window.addEventListener('pointerdown', (e)=>{ if(!popup || popup.classList.contains('hidden')) return; if(e.target===popup || popup.contains(e.target)) return; hide(); });
  }

  function nextUpgCost(tw, stat){ const base=Admin.upgCost[stat]||0; const lv=(tw?.levels?.[stat])||0; return Math.max(1, Math.floor(base * Math.pow(1.4, lv))); }

  function show(tower, anchorRect){ ensure(); selectedTower = tower; popup.classList.remove('hidden');
    if(anchorRect){ popup.style.left = Math.round(anchorRect.left) + 'px'; popup.style.top = Math.round(anchorRect.bottom + 6) + 'px'; }
    render();
  }

  function hide(){ if(popup) popup.classList.add('hidden'); }

  function render(){
    if(!popup || !selectedTower) return;
    const statsEl = popup.querySelector('#upgStats');
    const ppD = popup.querySelector('#ppDmg');
    const ppR = popup.querySelector('#ppRange');
    const ppRt = popup.querySelector('#ppRate');

    const cD = nextUpgCost(selectedTower,'dmg');
    const cR = nextUpgCost(selectedTower,'range');
    const cRt = nextUpgCost(selectedTower,'rate');
    const bD = ensurePriceBadge(ppD); if(bD) bD.textContent = String(cD);
    const bR = ensurePriceBadge(ppR); if(bR) bR.textContent = String(cR);
    const bRt = ensurePriceBadge(ppRt); if(bRt) bRt.textContent = String(cRt);

    if(selectedTower?.def?.income){
      const base = selectedTower.def.income;
      const L = selectedTower.levels;
      const bankMul = (window?.Skills?.bankMul||1);
      const inc = typeof selectedTower.getIncomePerRound==='function' ? Math.floor(selectedTower.getIncomePerRound()) : Math.floor(base*bankMul);
      const parts = [`Bas ${base}`, `× (1+20%×${L.dmg})`, `× (1+10%×${L.range})`, `× (1+15%×${L.rate})`, `× Bank x${bankMul.toFixed(2)}`];
      if(selectedTower._boost && (MapModifiers?.boost?.incomeMul)){ parts.push(`× Boost x${(MapModifiers.boost.incomeMul).toFixed(2)}`); }
      const sum = L.dmg+L.range+L.rate;
      let sell = Math.floor(selectedTower.def.cost*selectedTower.def.sellFactor*(1+sum*0.2));
      if(selectedTower._cursed){ sell = Math.floor(sell * (MapModifiers?.cursed?.sellMul || 0.5)); }
      statsEl.innerHTML = `
        <div>Income nu: <b>+${inc}</b> / våg</div>
        <div style="color:#bbb">${parts.join(' ')}</div>
        <div style="margin-top:6px">Nivåer D/R/Rt: ${L.dmg}/${L.range}/${L.rate} • Säljvärde: ${sell}</div>`;
    } else {
      const s = selectedTower.getStats();
      const def = selectedTower.def;
      const dps = s.fireRate>0 ? (s.dmg / s.fireRate) : s.dmg;
      const sum = selectedTower.levels.dmg+selectedTower.levels.range+selectedTower.levels.rate;
      let sell = Math.floor(def.cost*def.sellFactor*(1+sum*0.2));
      if(selectedTower._cursed){ sell = Math.floor(sell * (MapModifiers?.cursed?.sellMul || 0.5)); }
      let dpsNow = (selectedTower._dpsNow||0).toFixed(1);
      const tgt = selectedTower._manualTarget ? 'MANUELL' : ({first:'Första',last:'Sista',strong:'Starkast',close:'Närmast'}[selectedTower.targetMode]||'Första');
      statsEl.innerHTML = `
        <div>Skada: <b>${s.dmg.toFixed(1)}</b> • DPS: <b>${dps.toFixed(1)}</b> • Räckvidd: <b>${Math.round(s.range)}</b> • Eldhast: <b>${s.fireRate.toFixed(2)}s</b></div>
        <div style="margin-top:6px">Nivåer D/R/Rt: ${selectedTower.levels.dmg}/${selectedTower.levels.range}/${selectedTower.levels.rate}</div>
        <div>Fokus: <b>${tgt}</b> • DPS (3s): <b>${dpsNow}</b> • Säljvärde: ${sell}</div>`;
    }
  }

  function bindActions({ onBuy, onSell }){
    ensure();
    popup.querySelector('#ppDmg').addEventListener('click', ()=> onBuy && onBuy('dmg', selectedTower));
    popup.querySelector('#ppRange').addEventListener('click', ()=> onBuy && onBuy('range', selectedTower));
    popup.querySelector('#ppRate').addEventListener('click', ()=> onBuy && onBuy('rate', selectedTower));
    popup.querySelector('#ppSell').addEventListener('click', ()=> onSell && onSell(selectedTower));
  }

  return { show, hide, render, bindActions, get element(){ return popup; }, setSelected(t){ selectedTower=t; } };
}
