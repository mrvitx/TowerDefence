import { TILE, Settings, Admin, Visuals, MapModifiers, Skills, SKILL_TREE, MUTATORS } from './constants.js';
import { State, resetGame } from './state.js';
import { TOWER_TYPES } from './towers.js';
import { path, buildPath, isCellNearPath } from './path.js';
import { dist } from './math.js';
import { Tower } from './entities.js';
import { prepareWave, previewNextWave } from './waves.js';
import { rebuildBackground } from './render.js';
import { saveGame, loadGame, saveSettingsDump, loadSettingsApply, saveSettingsAsXML, importSettingsXMLFromText } from './persist.js';
import { loadProfile, saveProfile, createBlueprintFromParts, xpToNext } from './profiles/profile.js';
import { startProfileChipSync } from './ui/profileChip.js';
import { initTowerList } from './ui/towerList.js';
import { createUpgradePopup } from './ui/upgradePopup.js';
import { initToolbar } from './ui/toolbar.js';

// Elements
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const moneyEl = document.getElementById('money');
const skillPtsEl = document.getElementById('skillPts');
const incomeEl = document.getElementById('income');
const livesEl = document.getElementById('lives');
const waveEl = document.getElementById('wave');
const speedLbl = document.getElementById('speedLbl');
const startWaveBtn = document.getElementById('startWave');
const sellAllBtn = document.getElementById('sellAll');
const btnSpeed = document.getElementById('btnSpeed');
const btnPause = document.getElementById('btnPause');
const btnRanges = document.getElementById('btnRanges');
const btnDps = document.getElementById('btnDps');
const btnHeat = document.getElementById('btnHeat');
// removed: save/load/xml/reload/build-mode
const btnSkills = document.getElementById('btnSkills');
const btnAdmin = document.getElementById('btnAdmin');
const btnRestart = document.getElementById('btnRestart');
const btnMenu = document.getElementById('btnMenu');
// removed: btnReloadSettings, btnBuildMode
// Skill UI elements (injected)
let skillPanel = null;
let upgPopup = null;
let _upg = null; // modular upgrade popup API
let mutPanel = null; // mutator offer panel
let profilePanel = null; // profile/inventory panel
let _lastUpgUpdateTs = 0; // throttle popup content updates
// Ensure a basic replay state container
State.replay = State.replay || { recording:false, playing:false, events:[], seed: (State.seed||0), _idx:0 };
// New UI module instances
let _towerList = null;

// Icon sprite injection and button decorators
function injectIconSprite(){
  if(document.getElementById('icon-sprite')) return;
  const host=document.createElementNS('http://www.w3.org/2000/svg','svg');
  host.setAttribute('id','icon-sprite');
  host.setAttribute('aria-hidden','true');
  host.setAttribute('style','position:absolute;width:0;height:0;overflow:hidden');
  host.setAttribute('xmlns','http://www.w3.org/2000/svg');
  host.setAttribute('xmlns:xlink','http://www.w3.org/1999/xlink');
  host.innerHTML=`<defs>
  <symbol id="i-play" viewBox="0 0 24 24"><path fill="currentColor" d="M8 5v14l11-7z"/></symbol>
  <symbol id="i-pause" viewBox="0 0 24 24"><path fill="currentColor" d="M6 5h4v14H6zM14 5h4v14h-4z"/></symbol>
  <symbol id="i-speed" viewBox="0 0 24 24"><path fill="currentColor" d="M12 4a8 8 0 1 0 8 8h-2a6 6 0 1 1-6-6V4zm6.3 2.3l1.4 1.4-5.7 5.7a3 3 0 1 1-1.4-1.4l5.7-5.7z"/></symbol>
  <symbol id="i-eye" viewBox="0 0 24 24"><path fill="currentColor" d="M12 5c-5 0-9 4.5-10 7 1 2.5 5 7 10 7s9-4.5 10-7c-1-2.5-5-7-10-7zm0 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10z"/></symbol>
  <symbol id="i-bolt" viewBox="0 0 24 24"><path fill="currentColor" d="M11 2L3 14h6l-2 8 8-12h-6z"/></symbol>
  <symbol id="i-heat" viewBox="0 0 24 24"><path fill="currentColor" d="M13 2s5 3 5 9a6 6 0 1 1-12 0c0-4 3-6 3-6s-1 3 2 5c1-3 2-5 2-8z"/></symbol>
  <symbol id="i-sell" viewBox="0 0 24 24"><path fill="currentColor" d="M3 17h18v2H3v-2zm9-14l9 9-9 9-9-9 9-9zm0 4.8L7.8 12 12 16.2 16.2 12 12 7.8z"/></symbol>
  <symbol id="i-coin" viewBox="0 0 24 24"><path fill="currentColor" d="M12 4c5 0 9 2 9 4s-4 4-9 4-9-2-9-4 4-4 9-4zm0 10c5 0 9 2 9 4s-4 4-9 4-9-2-9-4 4-4 9-4z"/></symbol>
  <symbol id="i-skill" viewBox="0 0 24 24"><path fill="currentColor" d="M12 2l2.9 6 6.1.5-4.6 4 1.4 6-5.8-3.4L6.2 19l1.4-6-4.6-4L9 8z"/></symbol>
  <symbol id="i-admin" viewBox="0 0 24 24"><path fill="currentColor" d="M19.4 13a7.6 7.6 0 0 0 0-2l2-1.5-2-3.5-2.3.9a7.7 7.7 0 0 0-1.7-1L15 2h-6l-.4 2.9a7.7 7.7 0 0 0-1.7 1L4.6 6 2.6 9.5 4.6 11a7.6 7.6 0 0 0 0 2l-2 1.5 2 3.5 2.3-.9c.5.4 1.1.8 1.7 1L9 22h6l.4-2.9c.6-.2 1.2-.6 1.7-1l2.3.9 2-3.5-2-1.5zM12 15a3 3 0 1 1 0-6 3 3 0 0 1 0 6z"/></symbol>
  <symbol id="i-restart" viewBox="0 0 24 24"><path fill="currentColor" d="M12 5V1L7 6l5 5V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7z"/></symbol>
  <symbol id="i-home" viewBox="0 0 24 24"><path fill="currentColor" d="M12 3l9 8h-3v10h-5v-6H11v6H6V11H3z"/></symbol>
  <symbol id="i-tower" viewBox="0 0 24 24"><path fill="currentColor" d="M7 20h10l-2-8h2l-1-6h-2l-.5-2h-3L9 6H7l-1 6h2l-1 8z"/></symbol>
  <symbol id="i-crosshair" viewBox="0 0 24 24"><path fill="currentColor" d="M11 2h2v4h-2V2zm0 16h2v4h-2v-4zM2 11h4v2H2v-2zm16 0h4v2h-4v-2z"/><circle cx="12" cy="12" r="5" fill="none" stroke="currentColor" stroke-width="2"/></symbol>
  <symbol id="i-plus" viewBox="0 0 24 24"><path fill="currentColor" d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z"/></symbol>
  <symbol id="i-first" viewBox="0 0 24 24"><path fill="currentColor" d="M6 5h2v14H6zM10 12l8-7v14l-8-7z"/></symbol>
  <symbol id="i-last" viewBox="0 0 24 24"><path fill="currentColor" d="M16 5h2v14h-2zM6 19V5l8 7-8 7z"/></symbol>
  <symbol id="i-star" viewBox="0 0 24 24"><path fill="currentColor" d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.09-1.01L12 2z"/></symbol>
  <symbol id="i-near" viewBox="0 0 24 24"><circle cx="12" cy="12" r="2" fill="currentColor"/><path fill="currentColor" d="M12 4a8 8 0 1 1 0 16 8 8 0 0 1 0-16zm0-2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/></symbol>
  <symbol id="i-clear" viewBox="0 0 24 24"><path fill="currentColor" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-3 6l7 7-1.4 1.4-7-7L9 8zm7 0l1.4 1.4-7 7L9 15l7-7z"/></symbol>
  </defs>`;
  document.body.appendChild(host);
}
function injectIconStyles(){
  if(document.getElementById('icon-css')) return;
  const style = document.createElement('style');
  style.id = 'icon-css';
  style.textContent = `
    .ico{display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;margin-right:6px}
    .ico svg{width:16px;height:16px;display:block}
    button .lbl{vertical-align:middle}
  `;
  document.head.appendChild(style);
}
// Inline icon paths for robust rendering even if <use> fails under file://
const ICONS = {
  'i-play': '<path fill="currentColor" d="M8 5v14l11-7z"/>',
  'i-pause': '<path fill="currentColor" d="M6 5h4v14H6zM14 5h4v14h-4z"/>',
  'i-speed': '<path fill="currentColor" d="M12 4a8 8 0 1 0 8 8h-2a6 6 0 1 1-6-6V4zm6.3 2.3l1.4 1.4-5.7 5.7a3 3 0 1 1-1.4-1.4l5.7-5.7z"/>',
  'i-eye': '<path fill="currentColor" d="M12 5c-5 0-9 4.5-10 7 1 2.5 5 7 10 7s9-4.5 10-7c-1-2.5-5-7-10-7zm0 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10z"/>',
  'i-bolt': '<path fill="currentColor" d="M11 2L3 14h6l-2 8 8-12h-6z"/>',
  'i-heat': '<path fill="currentColor" d="M13 2s5 3 5 9a6 6 0 1 1-12 0c0-4 3-6 3-6s-1 3 2 5c1-3 2-5 2-8z"/>',
  'i-sell': '<path fill="currentColor" d="M3 17h18v2H3v-2zm9-14l9 9-9 9-9-9 9-9zm0 4.8L7.8 12 12 16.2 16.2 12 12 7.8z"/>',
  'i-coin': '<path fill="currentColor" d="M12 4c5 0 9 2 9 4s-4 4-9 4-9-2-9-4 4-4 9-4zm0 10c5 0 9 2 9 4s-4 4-9 4-9-2-9-4 4-4 9-4z"/>',
  'i-skill': '<path fill="currentColor" d="M12 2l2.9 6 6.1.5-4.6 4 1.4 6-5.8-3.4L6.2 19l1.4-6-4.6-4L9 8z"/>',
  'i-admin': '<path fill="currentColor" d="M19.4 13a7.6 7.6 0 0 0 0-2l2-1.5-2-3.5-2.3.9a7.7 7.7 0 0 0-1.7-1L15 2h-6l-.4 2.9a7.7 7.7 0 0 0-1.7 1L4.6 6 2.6 9.5 4.6 11a7.6 7.6 0  0 0 0 2l-2 1.5 2 3.5 2.3-.9c.5.4 1.1.8 1.7 1L9 22h6l.4-2.9c.6-.2 1.2-.6 1.7-1l2.3.9 2-3.5-2-1.5zM12 15a3 3 0 1 1 0-6 3 3 0 0 1 0 6z"/>',
  'i-restart': '<path fill="currentColor" d="M12 5V1L7 6l5 5V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7z"/>',
  'i-home': '<path fill="currentColor" d="M12 3l9 8h-3v10h-5v-6H11v6H6V11H3z"/>',
  'i-tower': '<path fill="currentColor" d="M7 20h10l-2-8h2l-1-6h-2l-.5-2h-3L9 6H7l-1 6h2l-1 8z"/>',
  'i-crosshair': '<path fill="currentColor" d="M11 2h2v4h-2V2zm0 16h2v4h-2v-4zM2 11h4v2H2v-2zm16 0h4v2h-4v-2z"/><circle cx="12" cy="12" r="5" fill="none" stroke="currentColor" stroke-width="2"/>',
  'i-plus': '<path fill="currentColor" d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z"/>'
  ,'i-first': '<path fill="currentColor" d="M6 5h2v14H6zM10 12l8-7v14l-8-7z"/>'
  ,'i-last': '<path fill="currentColor" d="M16 5h2v14h-2zM6 19V5l8 7-8 7z"/>'
  ,'i-star': '<path fill="currentColor" d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.09-1.01L12 2z"/>'
  ,'i-near': '<circle cx="12" cy="12" r="2" fill="currentColor"/><path fill="currentColor" d="M12 4a8 8 0 1 1 0 16 8 8 0 0 1 0-16zm0-2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/>'
  ,'i-clear': '<path fill="currentColor" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-3 6l7 7-1.4 1.4-7-7L9 8zm7 0l1.4 1.4-7 7L9 15l7-7z"/>'
};
function decorateButton(btn, iconId, label){
  if(!btn) return null;
  const inline = ICONS[iconId];
  const iconSvg = inline
    ? `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">${inline}</svg>`
    : `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><use href="#${iconId}" xlink:href="#${iconId}"></use></svg>`;
  btn.innerHTML = `<span class="ico" aria-hidden="true">${iconSvg}</span><span class="lbl"></span>`;
  const lbl = btn.querySelector('.lbl'); if(lbl) lbl.textContent = label;
  const api = { set: (txt)=>{ const l=btn.querySelector('.lbl'); if(l) l.textContent=txt; } };
  btn._deco = api;
  return api;
}

// Reusable: adds a small price pill to a button if missing and returns it
function ensurePriceBadge(btn){
  if(!btn) return null;
  let p = btn.querySelector && btn.querySelector('.price');
  if(!p){
    p = document.createElement('span');
    p.className = 'price';
    p.style.marginLeft = '8px';
    p.style.padding = '0 8px';
    p.style.borderRadius = '12px';
    p.style.background = 'rgba(0,0,0,0.35)';
    p.style.border = '1px solid rgba(255,255,255,0.35)';
    p.style.color = '#fff';
    p.style.fontWeight = '700';
    p.style.fontSize = '12px';
    p.style.lineHeight = '20px';
    p.style.height = '20px';
    p.style.display = 'inline-flex';
    p.style.alignItems = 'center';
    p.style.justifyContent = 'center';
    p.style.minWidth = '26px';
    p.style.whiteSpace = 'nowrap';
    p.style.verticalAlign = 'middle';
    try{ btn.appendChild(p); btn.style.overflow = 'visible'; }catch(_e){}
  }
  return p;
}

const towerBtns = document.getElementById('towerBtns');
const selInfo = document.getElementById('selInfo');
const upgControls = document.getElementById('upgControls');
const upgDmg = document.getElementById('upgDmg');
const upgRange = document.getElementById('upgRange');
const upgRate = document.getElementById('upgRate');
const sellBtn = document.getElementById('sellBtn');

const admin = document.getElementById('admin');
// Admin inputs removed; admin moved to separate page
const closeAdmin = document.getElementById('closeAdmin');

// Local UI state
// Start with no preselected build tool; player must choose a tower first
let selectedTool = null;
// Require explicit choice before first placement (works even if a default gets set elsewhere)
let _hasToolSelected = false;
let hoverPos = null; let selectedTower = null;
let isPainting = false; let lastPaintCell = null; let placingDef = null;
// Heatmap cache
let _heatCanvas = null, _heatCtx = null; let _heatDirty = true; let _heatLast = 0;
function markHeatDirty(){ _heatDirty = true; }
// Recompute coverage heat pre-rendered to an offscreen canvas
function rebuildHeat(canvas){
  try{
    if(!_heatCanvas){ _heatCanvas = document.createElement('canvas'); _heatCtx = _heatCanvas.getContext('2d'); }
    _heatCanvas.width = canvas.width; _heatCanvas.height = canvas.height; const ctx = _heatCtx; ctx.clearRect(0,0,canvas.width,canvas.height);
    const step = (Visuals.fontScale && Visuals.fontScale>1)? 24 : 20;
    for(let y=0;y<canvas.height;y+=step){
      for(let x=0;x<canvas.width;x+=step){
        let val=0;
        for(const t of State.towers){ if(t.def?.income) continue; const s=typeof t.getStats==='function'?t.getStats():{range:t.def?.range||0}; const rr=Math.max(0, s.range|0); if(rr<=0) continue; const d=Math.hypot(t.x-x,t.y-y); if(d<=rr){ const k = Math.exp(- (d*d) / (2*(rr*0.6)*(rr*0.6)) ); val += k; } }
        if(val>0.01){ const a = Math.min(0.45, val*0.25); ctx.fillStyle=`rgba(255,80,0,${a.toFixed(3)})`; ctx.fillRect(x, y, step, step); }
      }
    }
    _heatDirty = false; _heatLast = performance.now();
  }catch(_e){ _heatDirty=false; }
}

export function changeSpeed(v){
  Settings.gameSpeed = Math.max(0.25, Math.min(Settings.maxSpeed, v));
  speedLbl.textContent = Settings.gameSpeed.toFixed(2) + '×';
  const label = '×' + Math.round(Settings.gameSpeed);
  if(btnSpeed && btnSpeed._deco){ btnSpeed._deco.set(label); } else if(btnSpeed){ btnSpeed.textContent = label; }
}

export function isOnPath(x,y){
  // Grid-accelerated check using precomputed blocked tiles near the path
  const c = Math.floor(x / TILE); const r = Math.floor(y / TILE);
  return isCellNearPath(c, r);
}

function isOccupied(x,y){
  for(const t of State.towers){ if(Math.abs(x - t.x) <= TILE/2 && Math.abs(y - t.y) <= TILE/2) return true; }
  return false;
}

function placeTowerAt(x,y,def){
  if(!def) return false;
  // Bounds check
  if(x < TILE/2 || x > canvas.width - TILE/2 || y < TILE/2 || y > canvas.height - TILE/2) return false;
  if(isOnPath(x,y)) return false;
  if(isOccupied(x,y)) return false;
  if(State.money < def.cost) return false;
  State.money -= def.cost; State.towers.push(new Tower(x,y,def));
  markHeatDirty();
  if(State.replay?.recording){ try{ State.replay.events.push({ t:State.gameTime||0, type:'place', id:def.id, x, y }); }catch(_e){} }
  highlightAffordable(); return true;
}

function getSnappedFromEvent(e){
  const r = canvas.getBoundingClientRect();
  const scaleX = canvas.width / r.width;
  const scaleY = canvas.height / r.height;
  const x = (e.clientX - r.left) * scaleX;
  const y = (e.clientY - r.top) * scaleY;
  let sx = Math.floor(x/TILE)*TILE + TILE/2;
  let sy = Math.floor(y/TILE)*TILE + TILE/2;
  return {x:sx, y:sy};
}

// Legacy implementation kept as fallback; new wrapper below delegates to module if present
function _refreshTowerButtonsLegacy(){
  towerBtns.innerHTML=''; let i=1;
  for(const key in TOWER_TYPES){
    const def=TOWER_TYPES[key];
    const wrap=document.createElement('div'); wrap.style.textAlign='center';
    const c=document.createElement('canvas'); c.width=64; c.height=64; c.style.background='#111'; c.style.display='block'; c.style.marginBottom='6px';
    const ctx2 = c.getContext('2d');
    if(def.income){
      // coin stack thumbnail
      ctx2.fillStyle='#2b2b2b'; ctx2.beginPath(); ctx2.arc(32,32,18,0,Math.PI*2); ctx2.fill();
      ctx2.fillStyle=def.color||'#fc6'; ctx2.strokeStyle='#000';
      for(let k=0;k<3;k++){ const off=8-k*6; ctx2.beginPath(); ctx2.ellipse(32,32+off,12,6,0,0,Math.PI*2); ctx2.fill(); ctx2.stroke(); }
      ctx2.fillStyle='#000'; ctx2.font='bold 11px system-ui'; ctx2.textAlign='center'; ctx2.textBaseline='middle'; ctx2.fillText('¤',32,30);
    } else {
      ctx2.fillStyle=def.color; ctx2.beginPath(); ctx2.arc(32,32,18,0,Math.PI*2); ctx2.fill(); ctx2.fillStyle='#000'; ctx2.fillRect(22,28,20,8);
    }
  const btn=document.createElement('button'); btn.style.display='block'; btn.style.width='100%';
  decorateButton(btn, def.income ? 'i-coin' : 'i-tower', `${i} ${def.label} (${def.cost})`);
  btn.onclick=()=>{ selectedTool = def.id; _hasToolSelected = true; highlightAffordable(); };
    // Mini stats line
    const statsLine=document.createElement('div'); statsLine.className='small';
    if(def.income){ statsLine.textContent = `Income: ${def.income}/våg`; }
    else { statsLine.textContent = `DMG:${def.dmg}  RNG:${def.range}  ROF:${def.fireRate}s`; }
    wrap.appendChild(c); wrap.appendChild(btn); wrap.appendChild(statsLine); towerBtns.appendChild(wrap); i++; }
  highlightAffordable();
}

export function refreshTowerButtons(){
  if(_towerList && typeof _towerList.refresh==='function'){ try{ _towerList.refresh(); return; }catch(_e){} }
  _refreshTowerButtonsLegacy();
}

function updateBuildModeLabel(){}

function highlightAffordable(){
  const cards = towerBtns.querySelectorAll('button'); let idx=0;
  for(const key in TOWER_TYPES){ const def=TOWER_TYPES[key]; const btn = cards[idx++]; if(!btn) break; const affordable = State.money >= def.cost; btn.style.opacity = affordable ? '1' : '0.5'; btn.disabled = false; }
}

function showSelectedInfo(){
  if(!selectedTower){ selInfo.textContent='Inget torn valt.'; upgControls && upgControls.classList.add('hidden'); return; }
  const def = selectedTower.def;
  // Show detailed stats
  if(def.income){
    // preview income with current levels
    const tmp = { getIncomePerRound: ()=>0 };
    // use tower method to compute real income
    const inc = typeof selectedTower.getIncomePerRound==='function' ? Math.floor(selectedTower.getIncomePerRound()) : def.income;
    selInfo.textContent = `Torn: ${def.label} | Income/våg: ${inc} | Nivåer D/R/Rt: ${selectedTower.levels.dmg}/${selectedTower.levels.range}/${selectedTower.levels.rate}`;
    // Always use popup; keep sidebar controls hidden
    upgControls && upgControls.classList.add('hidden');
  } else {
    // compute live stats via method
    const s = selectedTower.getStats();
    selInfo.textContent=`Torn: ${def.label} | DMG:${s.dmg.toFixed(1)} RNG:${Math.round(s.range)} ROF:${s.fireRate.toFixed(2)}s | Nivåer D/R/Rt: ${selectedTower.levels.dmg}/${selectedTower.levels.range}/${selectedTower.levels.rate}`;
    upgControls && upgControls.classList.add('hidden');
  }
}

function ensureUpgPopup(){
  if(_upg) return;
  // Create modular popup and bind actions
  _upg = createUpgradePopup();
  _upg.bindActions({
    onBuy: (stat, tw)=>{
      if(!tw) return;
      // bulk buy with Shift (×5)
      let levels = 1; try{ if(window.event && (window.event.shiftKey||window.event.getModifierState?.('Shift'))){ levels=5; } }catch(_e){}
      const nextUpgCost = (t, s)=>{ const base=Admin.upgCost[s]||0; const lv=(t?.levels?.[s])||0; return Math.max(1, Math.floor(base * Math.pow(1.4, lv))); };
      let bought=0, totalCost=0;
      for(let i=0;i<levels;i++){
        const cost = nextUpgCost(tw, stat);
        if((State.money||0) >= cost){ State.money -= cost; totalCost += cost; tw.levels[stat]++; bought++; }
        else break;
      }
      if(bought>0){ if(typeof tw._spent==='number') tw._spent += totalCost; markHeatDirty(); if(State.replay?.recording){ try{ State.replay.events.push({ t:State.gameTime||0, type:'upg', stat, idx: State.towers.indexOf(tw), count: bought }); }catch(_e){} } showSelectedInfo(); positionUpgPopup(); }
    },
    onSell: (tw)=>{
      if(!tw) return;
      const def=tw.def; const sum=(tw.levels?.dmg||0)+(tw.levels?.range||0)+(tw.levels?.rate||0);
      let val=Math.floor(def.cost*def.sellFactor*(1+sum*0.2));
      if(tw._cursed){ val = Math.floor(val * (MapModifiers?.cursed?.sellMul || 0.5)); }
      State.money += val; const idx=State.towers.indexOf(tw); if(idx>=0) State.towers.splice(idx,1);
      markHeatDirty(); if(State.replay?.recording){ try{ State.replay.events.push({ t:State.gameTime||0, type:'sell', idx }); }catch(_e){} }
      selectedTower=null; showSelectedInfo(); hideUpgPopup();
    }
  });
  // Inject targeting controls into the modular popup (keeps feature parity)
  try{
    const el = _upg.element; if(el && !el.querySelector('[data-targeting]')){
      const grid = el.querySelector('#ppDmg')?.parentElement;
      const tgt = document.createElement('div');
      tgt.setAttribute('data-targeting','');
      tgt.className = 'small';
      tgt.style.display='flex'; tgt.style.gap='6px'; tgt.style.marginBottom='8px'; tgt.style.flexWrap='wrap';
      tgt.innerHTML = `
        <span style="opacity:0.8">Fokus:</span>
        <button data-mode="first" class="btn-secondary" style="color:#fff"></button>
        <button data-mode="last" class="btn-secondary" style="color:#fff"></button>
        <button data-mode="strong" class="btn-secondary" style="color:#fff"></button>
        <button data-mode="close" class="btn-secondary" style="color:#fff"></button>
        <button data-clear class="btn-secondary" title="Rensa manuellt mål" style="color:#fff"></button>`;
      if(grid && grid.parentElement){ grid.parentElement.insertBefore(tgt, grid); }
      const [bFirst,bLast,bStrong,bClose,bClear] = tgt.querySelectorAll('button');
      decorateButton(bFirst, 'i-first', 'Första');
      decorateButton(bLast, 'i-last', 'Sista');
      decorateButton(bStrong, 'i-star', 'Starkast');
      decorateButton(bClose, 'i-near', 'Närmast');
      decorateButton(bClear, 'i-clear', 'Rensa mål');
      tgt.addEventListener('click',(e)=>{
        const btn=e.target.closest('button'); if(!btn || !selectedTower) return;
        if(btn.hasAttribute('data-clear')){ selectedTower._manualTarget=null; return; }
        const mode = btn.getAttribute('data-mode'); if(mode){ selectedTower.targetMode = mode; positionUpgPopup(); }
      });
    }
  }catch(_e){}
}

function positionUpgPopup(){
  if(!_upg || !_upg.element || _upg.element.classList.contains('hidden') || !selectedTower) return;
  // Compute anchor position similar to legacy
  if(btnSkills){
    const br = btnSkills.getBoundingClientRect();
    _upg.element.style.left = Math.round(br.left) + 'px';
    _upg.element.style.top = Math.round(br.bottom + 6) + 'px';
  } else {
    const r = canvas.getBoundingClientRect();
    const scaleX = r.width / canvas.width;
    const scaleY = r.height / canvas.height;
    const left = r.left + selectedTower.x * scaleX + 20;
    const top = r.top + selectedTower.y * scaleY - 20;
    _upg.element.style.left = Math.round(left) + 'px';
    _upg.element.style.top = Math.round(top) + 'px';
  }
  // Throttle content refresh
  const nowTs = (typeof performance!=='undefined' && performance.now) ? performance.now() : Date.now();
  if(nowTs - _lastUpgUpdateTs < 250) return;
  _lastUpgUpdateTs = nowTs;
  try{ _upg.setSelected(selectedTower); _upg.render(); }catch(_e){}
}

function showUpgPopup(){ ensureUpgPopup(); try{ if(_upg?.element){ _upg.element.classList.remove('hidden'); } }catch(_e){} positionUpgPopup(); }
function hideUpgPopup(){ try{ _upg && _upg.hide(); }catch(_e){} }

export function wireUI(){
  injectIconSprite();
  injectIconStyles();
  // Ensure legacy sidebar upgrade controls are hidden; popup is used instead
  if(upgControls){ upgControls.classList.add('hidden'); }
  // Init modular tower list (safe if DOM missing); falls back to legacy refresh
  try{
    _towerList = initTowerList({ onSelect: (defId)=>{ selectedTool = defId; _hasToolSelected = true; highlightAffordable(); } });
  }catch(_e){ _towerList = null; }
  refreshTowerButtons();
  // Hard reset any residual build state on startup
  selectedTool = null;
  _hasToolSelected = false;
  placingDef = null;
  isPainting = false;
  lastPaintCell = null;
  // Canvas interactions - paint mode
  canvas.addEventListener('pointermove',e=>{
    hoverPos = getSnappedFromEvent(e);
    if(Settings.buildMode==='paint' && isPainting && placingDef && hoverPos){
      const cell = `${hoverPos.x}|${hoverPos.y}`;
      if(cell !== lastPaintCell){
        placeTowerAt(hoverPos.x, hoverPos.y, placingDef);
        lastPaintCell = cell;
      }
    }
  });
  canvas.addEventListener('pointerleave',()=>{ hoverPos=null });
  canvas.addEventListener('pointerdown',(e)=>{
  // prevent global pointerdown from closing the popup on same click
  e.stopPropagation();
    if(e.button===2){ // right click cancels
      placingDef=null; isPainting=false; lastPaintCell=null; selectedTower=null; showSelectedInfo(); hideUpgPopup(); return;
    }
    if(e.button!==0) return; // left only
    hoverPos = getSnappedFromEvent(e);
    if(!hoverPos) return;
    // If clicking an existing tower, select it and don't start drag-build
  for(const t of State.towers){ if(Math.abs(hoverPos.x-t.x)<=TILE/2 && Math.abs(hoverPos.y-t.y)<=TILE/2){ selectedTower=t; showSelectedInfo(); showUpgPopup(); return; } }
    // Manual focus: click an enemy near the cursor while a tower is selected
    if(selectedTower){
      const near = State.enemies.find(e2=> Math.hypot(e2.pos.x - hoverPos.x, e2.pos.y - hoverPos.y) < 22);
      if(near){ selectedTower._manualTarget = near; positionUpgPopup(); return; }
    }
  // Guard: do not place unless player explicitly picked a tool
  if(!_hasToolSelected) return;
    const def = TOWER_TYPES[selectedTool]; if(!def) return;
    placingDef = def; selectedTower=null; showSelectedInfo();
    if(Settings.buildMode==='paint'){
      isPainting = true; lastPaintCell = null;
      placeTowerAt(hoverPos.x, hoverPos.y, placingDef);
      lastPaintCell = `${hoverPos.x}|${hoverPos.y}`;
    } else {
      // single placement only
      placeTowerAt(hoverPos.x, hoverPos.y, placingDef);
  placingDef = null; isPainting=false; lastPaintCell=null; hideUpgPopup();
    }
  });
  window.addEventListener('pointerup',()=>{ if(isPainting){ isPainting=false; placingDef=null; lastPaintCell=null; } });
  // Prevent context menu to allow right-click cancel
  canvas.addEventListener('contextmenu',e=> e.preventDefault());

  // Buttons
  startWaveBtn.addEventListener('click',()=>{ if(State.waveInProgress) return; if(Settings.gameSpeed===0){ Settings.gameSpeed=1; speedLbl.textContent = '1.00×'; if(btnSpeed && btnSpeed._deco){ btnSpeed._deco.set('×1'); } else if(btnSpeed){ btnSpeed.textContent='×1'; } if(btnPause){ if(btnPause._deco){ btnPause._deco.set('Pausa'); } else { btnPause.textContent='Pausa'; } } }
    // If a mutator was chosen for next wave, activate it now
    State.activeWaveMutator = State.nextWaveMutator || null; State.nextWaveMutator = null;
    // Activate cadence bounty boost if queued
    if((State.bountyBoostNext||0)>0){ State.bountyBoostActive=true; State.bountyBoostNext--; }
    State.currentWave++; State.waveInProgress=true; State.lastRoundIncome=0; prepareWave(State.currentWave);
    if(State.replay?.recording){ try{ State.replay.events.push({ t:State.gameTime||0, type:'startWave' }); }catch(_e){} }
  });
  sellAllBtn.addEventListener('click',()=>{ for(const t of State.towers){ const def=t.def; const sum=(t.levels?.dmg||0)+(t.levels?.range||0)+(t.levels?.rate||0); State.money += Math.floor(def.cost*def.sellFactor*(1+sum*0.2)); } State.towers.length=0; markHeatDirty(); selectedTower=null; showSelectedInfo(); highlightAffordable(); });
  btnSpeed.addEventListener('click',()=>{ let next = Settings.gameSpeed>=Settings.maxSpeed ? 1 : Math.min(Settings.maxSpeed, Settings.gameSpeed+1); changeSpeed(next); if(State.replay?.recording){ try{ State.replay.events.push({ t:State.gameTime||0, type:'speed', v: next }); }catch(_e){} } });
  btnPause && btnPause.addEventListener('click',()=>{
    const pausing = Settings.gameSpeed>0;
    Settings.gameSpeed = pausing ? 0 : 1;
    // sync via toolbar api
    try{ _toolbar && _toolbar.syncSpeed(Settings.gameSpeed); _toolbar && _toolbar.syncPause(Settings.gameSpeed===0); }catch(_e){
      speedLbl.textContent = Settings.gameSpeed.toFixed(2) + '×';
      const spLbl = '×' + Math.max(1, Math.round(Settings.gameSpeed));
      if(btnSpeed && btnSpeed._deco){ btnSpeed._deco.set(spLbl); } else if(btnSpeed){ btnSpeed.textContent = spLbl; }
      const pLbl = Settings.gameSpeed>0 ? 'Pausa' : 'Fortsätt';
      if(btnPause?._deco){ btnPause._deco.set(pLbl); } else if(btnPause){ btnPause.textContent = pLbl; }
    }
  });
  // Toolbar module: decorations and toggles
  const _toolbar = initToolbar({
    buttons: { startWaveBtn, sellAllBtn, btnSpeed, btnPause, btnRanges, btnDps, btnHeat, btnSkills, btnAdmin, btnRestart, btnMenu, speedLbl },
    Visuals,
    Settings,
    saveSettingsDump
  });
  // removed in favor of toolbar module
  // Note: actual Dev-panel toggle binding is installed later in ensureDevPanel()
  // Provide alternate gesture to reach ADMIN.html
  if(btnAdmin){
    btnAdmin.addEventListener('click',(e)=>{
      if(e.shiftKey){
        e.preventDefault();
        window.location.href = './ADMIN.html';
      }
    });
    btnAdmin.addEventListener('contextmenu',(e)=>{ e.preventDefault(); window.location.href = './ADMIN.html'; });
    btnAdmin.addEventListener('auxclick',(e)=>{ if(e.button===1){ window.open('./ADMIN.html','_blank'); } });
  }
  btnMenu && btnMenu.addEventListener('click',()=>{ window.location.href = './START.html'; });
  // Restart: reset to defaults and rebuild
  btnRestart && btnRestart.addEventListener('click',()=>{
    if(!confirm('Starta om spelet och återställ till standardvärden?')) return;
    try{
      // Clear persistent settings to factory defaults, but keep Admin defaults in code
      localStorage.removeItem('td-settings-v1');
    }catch(_e){}
    try{ loadSettingsApply(); }catch(_e){}
    resetGame();
    try{ buildPath(canvas); }catch(_e){}
    try{ rebuildBackground(canvas); }catch(_e){}
    // Reset UI labels
    moneyEl.textContent = State.money; livesEl.textContent = State.lives; waveEl.textContent = State.currentWave; if(skillPtsEl) skillPtsEl.textContent = Skills.points||0; if(incomeEl) incomeEl.textContent='0';
    refreshTowerButtons();
  });
  // Skills panel toggle
  btnSkills && btnSkills.addEventListener('click',()=>{
  if(!skillPanel) mountSkills();
    // Position the panel under the Skills button
    const r = btnSkills.getBoundingClientRect();
    skillPanel.style.position='fixed';
    skillPanel.style.left = Math.round(r.left) + 'px';
    skillPanel.style.top = Math.round(r.bottom + 6) + 'px';
    skillPanel.classList.toggle('hidden');
    // Refresh labels on open
    if(!skillPanel.classList.contains('hidden')){
      const upd = skillPanel._refresh; upd && upd();
    }
  });

  // Inject a skill tree panel
  function mountSkills(){
    if(skillPanel) return;
    skillPanel = document.createElement('div');
    skillPanel.style.background='rgba(10,10,10,0.95)'; skillPanel.style.border='1px solid #333'; skillPanel.style.borderRadius='10px'; skillPanel.style.padding='10px'; skillPanel.style.zIndex='999'; skillPanel.style.minWidth='220px';
    skillPanel.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <div style="font-weight:600">Skill‑träd <span id="skPtsLbl">(${Skills.points||0})</span></div>
    <button id="skRespec" class="btn-secondary" style="background:#444"></button>
      </div>
      <div id="skSummary" class="small" style="background:#0e0e0f;border:1px solid #333;border-radius:8px;padding:8px;margin-bottom:8px;line-height:1.35"></div>
      <div id="skTree"></div>
    `;
    document.body.appendChild(skillPanel);
  // Decorate respec button
  decorateButton(document.getElementById('skRespec'), 'i-restart', 'Återställ');
    const pts=()=>{ const val=(Skills.points||0); const el=document.getElementById('skPtsLbl'); if(el) el.textContent = '('+val+')'; if(skillPtsEl) skillPtsEl.textContent = val; };
    const hasReq = (node)=>{
      if(!node.req||!node.req.length) return true;
      const lv = Skills.tree?.lv || {}; for(const r of node.req){ if((lv[r.id]||0) < r.lv) return false; } return true;
    };
    const summary = ()=>{
      const host = document.getElementById('skSummary'); if(!host) return;
      const fx=(v)=>'x'+(v||1).toFixed(2); const px=(v)=>'+'+((v||0)*100).toFixed(1)+'%';
      host.innerHTML = `DMG ${fx(Skills.dmgMul)} • RNG ${fx(Skills.rangeMul)} • Crit ${px(Skills.critAdd)} • Bank ${fx(Skills.bankMul)} • Bounty ${fx(Skills.bountyMul)}`;
    };
    const rebuild = ()=>{
      const host = document.getElementById('skTree'); if(!host) return; host.innerHTML='';
      const lv = Skills.tree?.lv || {}; const canSpend = (Skills.points||0) > 0;
      summary();
      for(const tier of SKILL_TREE){
        const sec = document.createElement('div'); sec.style.marginBottom='10px';
        const title = document.createElement('div'); title.textContent = `${tier.group} — Tier ${tier.tier}`; title.style.fontWeight='600'; title.style.margin='6px 0'; sec.appendChild(title);
        const grid = document.createElement('div'); grid.style.display='grid'; grid.style.gridTemplateColumns='1fr 1fr 1fr'; grid.style.gap='6px';
        for(const node of tier.nodes){
          const box = document.createElement('div'); box.style.border='1px solid #333'; box.style.borderRadius='8px'; box.style.padding='8px'; box.style.background='#0f0f10';
          const cur = lv[node.id]||0;
          const head = document.createElement('div'); head.style.display='flex'; head.style.justifyContent='space-between'; head.style.alignItems='center';
          const nm = document.createElement('div'); nm.textContent = node.name; nm.style.fontWeight='600'; head.appendChild(nm);
          const lvl = document.createElement('div'); lvl.className='small'; lvl.textContent = `${cur}/${node.max}`; head.appendChild(lvl);
          box.appendChild(head);
          const eff = document.createElement('div'); eff.className='small'; eff.style.color='#bbb';
          const parts=[]; if(node.effects.dmgMul) parts.push(`DMG +${(node.effects.dmgMul*100).toFixed(0)}%/lvl`);
          if(node.effects.rangeMul) parts.push(`RNG +${(node.effects.rangeMul*100).toFixed(0)}%/lvl`);
          if(node.effects.critAdd) parts.push(`Crit +${(node.effects.critAdd*100).toFixed(1)}%/lvl`);
          if(node.effects.bankMul) parts.push(`Bank x+${(node.effects.bankMul*100).toFixed(0)}%/lvl`);
          if(node.effects.bountyMul) parts.push(`Bounty x+${(node.effects.bountyMul*100).toFixed(0)}%/lvl`);
          eff.textContent = parts.join(' • ');
          box.appendChild(eff);
          const btn = document.createElement('button'); btn.style.marginTop='6px';
          decorateButton(btn, 'i-plus', `Köp (${node.cost})`);
          const locked = !hasReq(node);
          btn.disabled = !canSpend || cur>=node.max || locked;
          if(locked){ btn.title = 'Lås upp kraven först'; }
          btn.onclick = ()=>{
            if(btn.disabled) return;
            // spend
            Skills.points = (Skills.points||0) - node.cost;
            Skills.tree = Skills.tree || {lv:{}};
            Skills.tree.lv[node.id] = (Skills.tree.lv[node.id]||0) + 1;
            // Persist and apply immediately
            try{ saveSettingsDump(); loadSettingsApply(); }catch(_e){}
            // Live refresh
            pts(); rebuild();
          };
          box.appendChild(btn);
          if(node.req && node.req.length){ const rq=document.createElement('div'); rq.className='small'; rq.style.marginTop='4px'; rq.style.color='#888'; rq.textContent = 'Krav: ' + node.req.map(r=>`${r.id} ${r.lv}`).join(', '); box.appendChild(rq); }
          grid.appendChild(box);
        }
        sec.appendChild(grid); host.appendChild(sec);
      }
    };
    skillPanel._refresh = rebuild;
    rebuild();
    // Respec button logic
    const btnRespec = document.getElementById('skRespec');
    if(btnRespec){ btnRespec.onclick = ()=>{
      if(!confirm('Återställ skill‑trädet? Alla poäng återbetalas.')) return;
      const lv = Skills.tree?.lv || {}; let refund=0;
      for(const tier of SKILL_TREE){ for(const n of tier.nodes){ const l=lv[n.id]||0; if(l>0){ refund += l * n.cost; } } }
      Skills.tree = { lv:{} };
      Skills.points = (Skills.points||0) + refund;
      try{ saveSettingsDump(); loadSettingsApply(); }catch(_e){}
      pts(); rebuild();
    }; }
    // Close on outside click
    window.addEventListener('pointerdown', (e)=>{
      if(!skillPanel || skillPanel.classList.contains('hidden')) return;
      if(e.target===skillPanel || skillPanel.contains(e.target) || e.target===btnSkills) return;
      skillPanel.classList.add('hidden');
    });
  }
  // Do not auto-mount; open with button
  // Profile panel (toggle with key 'P')
  function mountProfile(){
    if(profilePanel) return;
    profilePanel = document.createElement('div');
    profilePanel.style.background='rgba(10,10,10,0.96)'; profilePanel.style.border='1px solid #333'; profilePanel.style.borderRadius='10px'; profilePanel.style.padding='10px'; profilePanel.style.zIndex='1002'; profilePanel.style.minWidth='260px';
    profilePanel.classList.add('hidden');
    profilePanel.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <div style="font-weight:600">Profil & Inventarie</div>
        <button id="pfClose" class="btn-secondary" style="background:#444">Stäng</button>
      </div>
      <div id="pfHeader" class="small" style="background:#0e0e0f;border:1px solid #333;border-radius:8px;padding:8px;margin-bottom:8px;line-height:1.35"></div>
      <div style="font-weight:600;margin:6px 0">Föremål</div>
      <div id="pfItems" class="small" style="display:grid;grid-template-columns:1fr 1fr;gap:6px"></div>
      <div style="font-weight:600;margin:8px 0 6px">Blueprints</div>
      <div id="pfBps" class="small"></div>
      <button id="pfCraft" class="btn-secondary" style="margin-top:8px">Skapa test‑blueprint</button>
    `;
    document.body.appendChild(profilePanel);
    profilePanel.querySelector('#pfClose')?.addEventListener('click',()=> profilePanel.classList.add('hidden'));
    profilePanel.querySelector('#pfCraft')?.addEventListener('click',()=>{
      try{
        const p = loadProfile();
        createBlueprintFromParts(p, 'Prototyp', 'cannon');
        saveProfile(p);
        refresh();
      }catch(_e){}
    });
    const refresh = ()=>{
      try{
        const p = loadProfile();
        const need = (lvl)=> 100 + Math.floor(lvl*lvl*50);
        const hdr = profilePanel.querySelector('#pfHeader');
        if(hdr){ hdr.innerHTML = `Namn: <b>${p.name||'Spelare'}</b> \u2022 Level <b>${p.level||1}</b> \u2022 XP ${p.xp||0}/${need(p.level||1)} \u2022 Shards: ${p.shards||0}`; }
        const itemsHost = profilePanel.querySelector('#pfItems');
        if(itemsHost){
          const items = Array.isArray(p.inventory)? p.inventory : [];
          itemsHost.innerHTML = items.length? items.map(it=>`<div style="border:1px solid #333;border-radius:8px;padding:6px;background:#0f0f10">${it.id}<br/><span style="opacity:0.8">${it.type}/${it.rarity.toUpperCase()}</span> \u2022 x${it.qty||1}</div>`).join('') : '<div style="opacity:0.7">Tomt</div>';
        }
        const bpsHost = profilePanel.querySelector('#pfBps');
        if(bpsHost){
          const bps = Array.isArray(p.towerBlueprints)? p.towerBlueprints : [];
          bpsHost.innerHTML = bps.length? bps.map(b=>`<div style="border:1px solid #333;border-radius:8px;padding:6px;background:#0f0f10;margin-bottom:6px">${b.name} <span class="small" style="opacity:0.8">(${b.base})</span></div>`).join('') : '<div style="opacity:0.7">Inga ännu</div>';
        }
      }catch(_e){}
    };
    profilePanel._refresh = refresh;
    refresh();
    window.addEventListener('pointerdown', (e)=>{ if(!profilePanel || profilePanel.classList.contains('hidden')) return; if(e.target===profilePanel || profilePanel.contains(e.target)) return; profilePanel.classList.add('hidden'); });
  }
  function openProfile(){
    mountProfile();
    const r = btnSkills ? btnSkills.getBoundingClientRect() : startWaveBtn.getBoundingClientRect();
    profilePanel.style.position='fixed'; profilePanel.style.left=Math.round(r.left)+'px'; profilePanel.style.top=Math.round(r.bottom+6)+'px';
    profilePanel.classList.remove('hidden');
    profilePanel._refresh && profilePanel._refresh();
  }
  window.addEventListener('keydown', (e)=>{ if(e.key==='p' || e.key==='P'){ e.preventDefault(); openProfile(); } });

  // Mutator selection panel (offer 3 choices before each wave if not already chosen)
  function openMutatorsOffer(){
    if(State.waveInProgress) return;
    // Build on demand
    if(!mutPanel){
      mutPanel = document.createElement('div');
      mutPanel.style.background='rgba(12,12,12,0.96)'; mutPanel.style.border='1px solid #333'; mutPanel.style.borderRadius='10px'; mutPanel.style.padding='10px'; mutPanel.style.zIndex='1001'; mutPanel.style.minWidth='260px';
      document.body.appendChild(mutPanel);
      // Close on outside
      window.addEventListener('pointerdown', (e)=>{ if(!mutPanel || mutPanel.classList.contains('hidden')) return; if(e.target===mutPanel || mutPanel.contains(e.target)) return; mutPanel.classList.add('hidden'); });
    }
    // Sample 3 distinct mutators
    const choices = [...MUTATORS]; for(let i=choices.length-1;i>0;i--){ const j=(Math.random()* (i+1))|0; [choices[i],choices[j]]=[choices[j],choices[i]]; }
    const offer = choices.slice(0,3);
    const r = startWaveBtn.getBoundingClientRect();
    mutPanel.style.position='fixed'; mutPanel.style.left=Math.round(r.left)+'px'; mutPanel.style.top=Math.round(r.bottom+6)+'px';
    mutPanel.innerHTML = `
      <div style="font-weight:600;margin-bottom:8px">Välj mutator för nästa våg</div>
      <div id="mutGrid" style="display:grid;grid-template-columns:1fr;gap:6px"></div>
      <div class="small" style="color:#999;margin-top:6px">Du kan starta utan att välja för att köra "vanlig" våg.</div>
    `;
    const host = mutPanel.querySelector('#mutGrid');
    for(const m of offer){
      const box=document.createElement('div'); box.style.border='1px solid #333'; box.style.borderRadius='8px'; box.style.padding='8px'; box.style.background='#0f0f10';
      const title=document.createElement('div'); title.textContent=m.name; title.style.fontWeight='600'; box.appendChild(title);
      const desc=document.createElement('div'); desc.className='small'; desc.style.color='#bbb'; desc.textContent=m.desc; box.appendChild(desc);
      const pick=document.createElement('button'); pick.textContent='Välj'; pick.style.marginTop='6px'; box.appendChild(pick);
      pick.onclick=()=>{ State.nextWaveMutator = m; mutPanel.classList.add('hidden'); };
      host.appendChild(box);
    }
    mutPanel.classList.remove('hidden');
  }
  // Open the mutator offer when player clicks Start wave but wave not running and no pending choice
  startWaveBtn.addEventListener('contextmenu', (e)=>{ e.preventDefault(); openMutatorsOffer(); });
  // Also show automatically right after a wave ends; handled in overlay via hint

  // Selected tower actions (legacy sidebar — only if elements exist)
  if(upgDmg){
    upgDmg.addEventListener('click',()=>{ if(!selectedTower) return; if(State.money >= Admin.upgCost.dmg){ State.money -= Admin.upgCost.dmg; selectedTower.levels.dmg++; showSelectedInfo(); } });
  }
  if(upgRange){
    upgRange.addEventListener('click',()=>{ if(!selectedTower) return; if(State.money >= Admin.upgCost.range){ State.money -= Admin.upgCost.range; selectedTower.levels.range++; showSelectedInfo(); } });
  }
  if(upgRate){
    upgRate.addEventListener('click',()=>{ if(!selectedTower) return; if(State.money >= Admin.upgCost.rate){ State.money -= Admin.upgCost.rate; selectedTower.levels.rate++; showSelectedInfo(); } });
  }
  if(sellBtn){
    sellBtn.addEventListener('click',()=>{ if(!selectedTower) return; const def=selectedTower.def; const sum=selectedTower.levels.dmg+selectedTower.levels.range+selectedTower.levels.rate; let val=Math.floor(def.cost*def.sellFactor*(1+sum*0.2)); if(selectedTower._cursed){ val = Math.floor(val * (MapModifiers?.cursed?.sellMul || 0.5)); } State.money += val; const idx=State.towers.indexOf(selectedTower); if(idx>=0) State.towers.splice(idx,1); selectedTower=null; showSelectedInfo(); });
  }

  // Keyboard
  window.addEventListener('keydown',e=>{
  if(e.key==='1'){ selectedTool = Object.keys(TOWER_TYPES)[0]; }
  if(e.key==='2'){ selectedTool = Object.keys(TOWER_TYPES)[1]; }
  if(e.key==='3'){ selectedTool = Object.keys(TOWER_TYPES)[2]; }
  if(/^[1-9]$/.test(e.key||'')) { _hasToolSelected = true; }
  if(e.key.toLowerCase()==='u'){ if(selectedTower && State.money>=Admin.upgCost.dmg){ State.money -= Admin.upgCost.dmg; selectedTower.levels.dmg++; showSelectedInfo(); } }
  if(e.key === '+'){ const v=Math.min(Settings.maxSpeed, Settings.gameSpeed + 0.25); changeSpeed(v); if(State.replay?.recording){ try{ State.replay.events.push({ t:State.gameTime||0, type:'speed', v }); }catch(_e){} } }
  if(e.key === '-') { const v=Math.max(0.25, Settings.gameSpeed - 0.25); changeSpeed(v); if(State.replay?.recording){ try{ State.replay.events.push({ t:State.gameTime||0, type:'speed', v }); }catch(_e){} } }
    // Disable F12 action in game
  if(e.key==='Escape'){ selectedTower=null; showSelectedInfo(); hideUpgPopup(); }
  if(e.key.toLowerCase()==='r'){ Visuals.showAllRanges = !Visuals.showAllRanges; try{ saveSettingsDump(); }catch(_e){} }
  if(e.key.toLowerCase()==='v'){ Visuals.showDps = !Visuals.showDps; try{ saveSettingsDump(); }catch(_e){} }
  if(e.key.toLowerCase()==='h'){ Visuals.showHeatmap = !Visuals.showHeatmap; try{ saveSettingsDump(); }catch(_e){} }
  });

  // Admin (moved)
  closeAdmin.addEventListener('click',()=>{ admin.classList.add('hidden'); });
  // Dev overlay (Admin 2.0) — small live slider panel + snapshot/restore + replay controls
  (function ensureDevPanel(){
    const btn = document.getElementById('btnAdmin'); if(!btn) return;
    let panel = document.getElementById('devPanel');
    if(!panel){
      panel = document.createElement('div'); panel.id='devPanel'; panel.style.position='fixed'; panel.style.left='14px'; panel.style.top='14px'; panel.style.zIndex='1001'; panel.style.background='rgba(10,10,10,0.96)'; panel.style.border='1px solid #333'; panel.style.borderRadius='10px'; panel.style.padding='10px'; panel.style.minWidth='280px'; panel.className='hidden';
      panel.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
          <div style="font-weight:600">Dev-verktyg</div>
          <button id="devClose" class="btn-secondary">Stäng</button>
        </div>
        <div class="small" style="margin-top:6px">Live-balansering</div>
        <div class="small">DMG <input id="slDmg" type="range" min="0.5" max="2" step="0.01"> <span id="slDmgV"></span></div>
        <div class="small">RNG <input id="slRange" type="range" min="0.5" max="2" step="0.01"> <span id="slRangeV"></span></div>
        <div class="small">Bank <input id="slBank" type="range" min="0.5" max="3" step="0.01"> <span id="slBankV"></span></div>
        <div class="small">Bounty <input id="slBounty" type="range" min="0.5" max="3" step="0.01"> <span id="slBountyV"></span></div>
        <div style="margin-top:8px;display:flex;gap:6px"><button id="snapSave" class="btn-secondary">Snapshot</button><button id="snapLoad" class="btn-secondary">Restore</button></div>
        <div class="small" style="margin-top:8px">Replay</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button id="rpStart" class="btn-secondary">Start record</button>
          <button id="rpStop" class="btn-secondary">Stop</button>
          <button id="rpPlay" class="btn-secondary">Play</button>
          <button id="rpExport" class="btn-secondary">Export</button>
          <input id="rpImport" type="file" accept="application/json" style="max-width:130px"/>
        </div>
        <div class="small" id="rpStatus" style="margin-top:6px;color:#bbb"></div>
      `;
      document.body.appendChild(panel);
    }
    const fmt=(v)=>'x'+(v||1).toFixed(2);
    function refreshVals(){ const id=(s)=>document.getElementById(s); if(id('slDmg')){ id('slDmg').value=String(Skills.dmgMul||1); id('slDmgV').textContent=fmt(Skills.dmgMul); } if(id('slRange')){ id('slRange').value=String(Skills.rangeMul||1); id('slRangeV').textContent=fmt(Skills.rangeMul); } if(id('slBank')){ id('slBank').value=String(Skills.bankMul||1); id('slBankV').textContent=fmt(Skills.bankMul); } if(id('slBounty')){ id('slBounty').value=String(Skills.bountyMul||1); id('slBountyV').textContent=fmt(Skills.bountyMul); } }
    function saveSnap(){ try{ const raw=JSON.parse(localStorage.getItem('td-settings-v1')||'{}'); raw._snapshot={ Skills:{...Skills}, Settings:{...Settings}, Visuals:{...Visuals} }; raw.ts=Date.now(); localStorage.setItem('td-settings-v1', JSON.stringify(raw)); }catch(e){} }
    function loadSnap(){ try{ const raw=JSON.parse(localStorage.getItem('td-settings-v1')||'{}'); const s=raw._snapshot; if(!s) return; Object.assign(Skills,s.Skills||{}); Object.assign(Settings,s.Settings||{}); Object.assign(Visuals,s.Visuals||{}); if(skillPtsEl) skillPtsEl.textContent=Skills.points||0; changeSpeed(Settings.gameSpeed||1); refreshTowerButtons && refreshTowerButtons(); }catch(e){} }
    function recStatus(txt){ const el=document.getElementById('rpStatus'); if(el) el.textContent=txt; }
    const hookBtn = (id,fn)=>{ const el=document.getElementById(id); if(el) el.onclick=fn; };
    hookBtn('devClose', ()=> panel.classList.add('hidden'));
    hookBtn('snapSave', ()=> saveSnap()); hookBtn('snapLoad', ()=> loadSnap());
    const bind=(id,key)=>{ const el=document.getElementById(id); if(!el) return; el.addEventListener('input',()=>{ const v=parseFloat(el.value)||1; Skills[key]=v; refreshVals(); try{ saveSettingsDump(); }catch(_e){} }); };
    bind('slDmg','dmgMul'); bind('slRange','rangeMul'); bind('slBank','bankMul'); bind('slBounty','bountyMul');
    refreshVals();
    hookBtn('rpStart', ()=>{ State.replay={ recording:true, playing:false, events:[], seed:(State.seed||0), _idx:0 }; recStatus('Recording…'); });
    hookBtn('rpStop', ()=>{ if(State.replay) State.replay.recording=false; recStatus('Stopped. '+((State.replay?.events||[]).length)+' events.'); });
    hookBtn('rpExport', ()=>{ try{ const blob=new Blob([JSON.stringify(State.replay||{},null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='replay.json'; a.click(); }catch(e){} });
    const imp=document.getElementById('rpImport'); if(imp){ imp.addEventListener('change',async(e)=>{ const f=e.target.files&&e.target.files[0]; if(!f) return; const txt=await f.text(); try{ State.replay = JSON.parse(txt); recStatus('Loaded replay with '+((State.replay?.events||[]).length)+' events.'); }catch(err){ recStatus('Import failed'); } }); }
    hookBtn('rpPlay', ()=>{ if(!State.replay||!Array.isArray(State.replay.events)) return; if(typeof resetGame==='function'){ resetGame(); } if(typeof window.__TD_SET_SEED==='function'){ window.__TD_SET_SEED(State.replay.seed||0); } State.replay.playing=true; State.replay._idx=0; State.gameTime=0; recStatus('Replaying…'); });
    // Toggle panel
    btn.addEventListener('click',(e)=>{
      // If Shift-click, let the earlier handler open ADMIN.html
      if(e.shiftKey) return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      panel.classList.toggle('hidden');
      refreshVals();
    });
  })();

  // Initial labels
  moneyEl.textContent = State.money;
  livesEl.textContent = State.lives;
  waveEl.textContent = State.currentWave;
  if(skillPtsEl) skillPtsEl.textContent = Skills.points||0;
  changeSpeed(Settings.gameSpeed);
  if(btnPause){ if(btnPause._deco){ btnPause._deco.set(Settings.gameSpeed>0 ? 'Pausa' : 'Fortsätt'); } else { btnPause.textContent = Settings.gameSpeed>0 ? 'Pausa' : 'Fortsätt'; } }
  // Profile chip initial sync (module)
  startProfileChipSync();
  // Also update when our HUD labels batch updates (money/lives/wave)
  try{
    const moneyObs = new MutationObserver(()=> startProfileChipSync());
    moneyObs.observe(moneyEl, {childList:true, characterData:true, subtree:true});
  }catch(_e){}
  // Open profile on custom event from SPEL.HTML
  document.addEventListener('td:openProfile', ()=>{ try{ openProfile(); }catch(_e){} });

  // Load settings on entry
  try{ loadSettingsApply(); refreshTowerButtons(); rebuildBackground(canvas); }catch(e){}
  updateBuildModeLabel();

  // Periodic settings watcher (live refresh when Admin saves in another tab/page)
  let lastSettingsTs = 0;
  try{
    const raw = localStorage.getItem('td-settings-v1');
    if(raw){ const d = JSON.parse(raw); if(d && d.ts) lastSettingsTs = d.ts; }
  }catch(e){}
  setInterval(()=>{
    try{
      const raw = localStorage.getItem('td-settings-v1'); if(!raw) return;
      const d = JSON.parse(raw); const ts = d && d.ts || 0;
      if(ts && ts !== lastSettingsTs){
        lastSettingsTs = ts;
        loadSettingsApply();
        refreshTowerButtons();
        rebuildBackground(canvas);
        updateBuildModeLabel(); if(skillPtsEl) skillPtsEl.textContent = Skills.points||0;
      }
    }catch(e){}
  }, 2500);

  // Public API for render overlay
  return {
  drawOverlay: function(){
      // Replay executor: run due events
      if(State.replay?.playing && Array.isArray(State.replay.events)){
        while((State.replay._idx||0) < State.replay.events.length){
          const ev = State.replay.events[State.replay._idx];
          if(ev.t > (State.gameTime||0)) break;
          if(ev.type==='startWave'){ if(!State.waveInProgress){ const click=new Event('click'); startWaveBtn.dispatchEvent(click); } }
          if(ev.type==='speed'){ changeSpeed(ev.v); }
          if(ev.type==='place'){ const def=TOWER_TYPES[ev.id]; if(def) placeTowerAt(ev.x, ev.y, def); }
          if(ev.type==='upg'){ const tw=State.towers[ev.idx]; if(tw){ const n=Math.max(1, ev.count||1); for(let k=0;k<n;k++){ const base=Admin.upgCost[ev.stat]||0; const lv=(tw.levels?.[ev.stat]||0); const cost=Math.max(1, Math.floor(base * Math.pow(1.4, lv))); State.money -= cost; if(ev.stat==='dmg') tw.levels.dmg++; if(ev.stat==='range') tw.levels.range++; if(ev.stat==='rate') tw.levels.rate++; } }}
          if(ev.type==='sell'){ const tw=State.towers[ev.idx]; if(tw){ const def=tw.def; const sum=tw.levels.dmg+tw.levels.range+tw.levels.rate; let val=Math.floor(def.cost*def.sellFactor*(1+sum*0.2)); if(tw._cursed){ val = Math.floor(val * (MapModifiers?.cursed?.sellMul || 0.5)); } State.money+=val; const i=State.towers.indexOf(tw); if(i>=0) State.towers.splice(i,1); }}
          State.replay._idx++;
        }
        if(State.replay._idx>=State.replay.events.length){ State.replay.playing=false; }
      }
  // (replay executor handled above in this function)
      if(hoverPos && selectedTool){ const def=TOWER_TYPES[selectedTool]; const canAfford = State.money >= def.cost; 
        // Tile highlight
        ctx.fillStyle = canAfford ? 'rgba(150,200,150,0.15)' : 'rgba(200,100,100,0.15)';
        ctx.fillRect(hoverPos.x - TILE/2 + 1, hoverPos.y - TILE/2 + 1, TILE - 2, TILE - 2);
        // Range circle preview for placement (includes skills and boost pad, but no upgrades yet)
        if(!def.income){
          let previewRange = def.range || 0;
          // Skills multiplier
          previewRange *= (Skills.rangeMul || 1);
          // Boost tile multiplier if placing on a boost pad
          try{ const c = Math.floor(hoverPos.x / TILE), r = Math.floor(hoverPos.y / TILE); if(Array.isArray(MapModifiers?.boostPads) && MapModifiers.boostPads.some(t=>t.c===c && t.r===r)){ const b = MapModifiers?.boost || {}; if(b.rangeMul) previewRange *= b.rangeMul; } }catch(_e){}
          if(previewRange>0){
            ctx.save();
            ctx.beginPath(); ctx.arc(hoverPos.x, hoverPos.y, previewRange, 0, Math.PI*2);
            // Subtle: very faint fill + thin dashed stroke
            ctx.fillStyle = canAfford ? 'rgba(120,180,255,0.02)' : 'rgba(255,140,140,0.015)'; ctx.fill();
            ctx.setLineDash([6,5]);
            ctx.strokeStyle = canAfford ? 'rgba(160,210,255,0.35)' : 'rgba(255,150,150,0.35)';
            ctx.lineWidth = 1.25; ctx.stroke();
            ctx.restore();
          }
        }
      }
      if(isPainting && hoverPos){ ctx.strokeStyle='rgba(255,255,255,0.15)'; ctx.lineWidth=1; ctx.strokeRect(hoverPos.x - TILE/2 + 0.5, hoverPos.y - TILE/2 + 0.5, TILE - 1, TILE - 1); }
  if(selectedTower){
        // Highlight tile
        ctx.strokeStyle='#fff'; ctx.lineWidth=2; ctx.strokeRect(selectedTower.x-20,selectedTower.y-20,40,40);
        // Draw selected tower range (skip for income towers)
        if(!selectedTower.def?.income){
          const s = typeof selectedTower.getStats==='function' ? selectedTower.getStats() : {range: selectedTower.def.range||0};
          const r = Math.max(0, s.range|0);
          if(r>0){
            ctx.save();
            ctx.beginPath(); ctx.arc(selectedTower.x, selectedTower.y, r, 0, Math.PI*2);
            ctx.fillStyle = 'rgba(120,180,255,0.03)'; ctx.fill();
            ctx.setLineDash([6,5]);
            ctx.strokeStyle = 'rgba(180,220,255,0.45)'; ctx.lineWidth = 1.5; ctx.stroke();
            ctx.restore();
          }
        }
      }

      // Optional: show all tower ranges
      if(Visuals.showAllRanges){
        ctx.save(); ctx.setLineDash([6,5]); ctx.strokeStyle='rgba(180,220,255,0.35)'; ctx.lineWidth=1.25; ctx.fillStyle='rgba(120,180,255,0.02)';
        for(const t of State.towers){ if(t?.def?.income) continue; const s=typeof t.getStats==='function'?t.getStats():{range:t.def?.range||0}; const rr=Math.max(0, Math.round(s.range||0)); if(rr>0){ ctx.beginPath(); ctx.arc(t.x,t.y, rr, 0, Math.PI*2); ctx.fill(); ctx.stroke(); } }
        ctx.restore();
      }
  // Per-tower DPS overlay (clamped with background for readability)
      if(Visuals.showDps){
        ctx.save();
        ctx.font=`${Math.round(12*(Visuals.fontScale||1))}px system-ui`;
        ctx.textAlign='center';
        ctx.textBaseline='middle';
        for(const t of State.towers){
          if(t.def?.income) continue;
          const val = t._dpsNow || 0;
          const text = val>0 ? val.toFixed(0) : '0';
          // Desired anchor above tower
          let tx=t.x, ty=t.y-24;
          // Measure and clamp inside canvas
          const padX=5, padY=3, h=16; const w=Math.ceil(ctx.measureText(text).width)+padX*2;
          let rx = Math.max(2, Math.min(canvas.width - w - 2, tx - w/2));
          let ry = Math.max(2, Math.min(canvas.height - h - 2, ty - h/2));
          const cx = rx + w/2, cy = ry + h/2;
          // Background pill
          ctx.save();
          ctx.fillStyle='rgba(0,0,0,0.55)';
          ctx.strokeStyle='rgba(255,255,255,0.18)';
          ctx.lineWidth=1;
          // Rounded rect
          const r=6; ctx.beginPath();
          ctx.moveTo(rx+r,ry);
          ctx.lineTo(rx+w-r,ry); ctx.quadraticCurveTo(rx+w,ry, rx+w,ry+r);
          ctx.lineTo(rx+w,ry+h-r); ctx.quadraticCurveTo(rx+w,ry+h, rx+w-r,ry+h);
          ctx.lineTo(rx+r,ry+h); ctx.quadraticCurveTo(rx,ry+h, rx,ry+h-r);
          ctx.lineTo(rx,ry+r); ctx.quadraticCurveTo(rx,ry, rx+r,ry);
          ctx.closePath(); ctx.fill(); ctx.stroke();
          // Optional leader line if clamped moved label
          if(Math.abs(cx-tx)>1 || Math.abs(cy-ty)>1){
            ctx.strokeStyle='rgba(255,255,255,0.25)'; ctx.lineWidth=1;
            ctx.beginPath(); ctx.moveTo(t.x, t.y-14); ctx.lineTo(cx, cy+h*0.55); ctx.stroke();
          }
          // Text
          ctx.fillStyle='rgba(255,255,255,0.95)';
          ctx.fillText(text, cx, cy);
          ctx.restore();
        }
        ctx.restore();
      }
    // Heatmap overlay: visualize coverage intensity by summing Gaussian kernels from each non-income tower
      if(Visuals.showHeatmap){
        try{
          const now = performance.now();
          if(_heatDirty || (now - _heatLast) > 400){ rebuildHeat(canvas); }
          if(_heatCanvas){ ctx.save(); ctx.globalAlpha = 1; ctx.drawImage(_heatCanvas, 0, 0); ctx.restore(); }
        }catch(_e){}
      }
      // Manual focus lock icon near tower if it has a manual target
      try{
        ctx.save();
        for(const t of State.towers){ if(!t._manualTarget) continue; const x=t.x+16, y=t.y-22; ctx.strokeStyle='rgba(255,215,0,0.9)'; ctx.fillStyle='rgba(255,215,0,0.15)'; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(x,y,8,0,Math.PI*2); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x-4,y); ctx.lineTo(x+4,y); ctx.moveTo(x,y-4); ctx.lineTo(x,y+4); ctx.stroke(); }
        ctx.restore();
      }catch(_e){}
      positionUpgPopup();

  // Use global imported path from module scope
      if(path && path.length){
        ctx.save(); ctx.strokeStyle='rgba(255,255,255,0.12)'; ctx.lineWidth=2;
        for(let i=12;i<path.length;i+=24){ const a=path[i-1], b=path[i]; const ang=Math.atan2(b.y-a.y, b.x-a.x); const x=b.x, y=b.y; ctx.translate(x,y); ctx.rotate(ang); ctx.beginPath(); ctx.moveTo(-6,-3); ctx.lineTo(0,0); ctx.lineTo(-6,3); ctx.stroke(); ctx.setTransform(1,0,0,1,0,0); }
        ctx.restore();
      }
      // Wave preview 2.0: icon + count per type
      const comp = previewNextWave(State.currentWave+1);
      const baseX=12, baseY=10, rowH=18; let row=0;
      const drawRow=(label,color,count)=>{
        if(!count) return; const y=baseY+row*rowH; row++;
        // icon circle
        ctx.fillStyle=color; ctx.beginPath(); ctx.arc(baseX+8,y+8,7,0,Math.PI*2); ctx.fill();
        // label + count
        ctx.fillStyle='rgba(255,255,255,0.9)'; ctx.font='12px system-ui'; ctx.textBaseline='top'; ctx.textAlign='left';
        ctx.fillText(label, baseX+22, y+2);
        ctx.fillStyle='rgba(255,255,255,0.7)'; ctx.fillText('×'+count, baseX+110, y+2);
      };
      drawRow('Vanlig',  '#6c6', comp.basic);
      drawRow('Snabb',   '#6cf', comp.fast);
      drawRow('Tung',    '#c86', comp.heavy);
      drawRow('Slime',   '#9c6', comp.slime);
      drawRow('Stealth', '#ccc', comp.stealth);
      drawRow('Boss',    '#a3c', comp.boss);

      // Active mutator badge and hint
  if(State.activeWaveMutator){
    ctx.fillStyle='rgba(255,255,255,0.85)'; ctx.font='12px system-ui'; ctx.fillText('Mutator: '+State.activeWaveMutator.name, baseX, baseY + row*rowH + 14);
  } else if(!State.waveInProgress){
    ctx.fillStyle='rgba(255,255,255,0.6)'; ctx.font='12px system-ui'; ctx.fillText('Högerklicka på Starta våg för mutators', baseX, baseY + row*rowH + 14);
  }

      // Fog patches
      if(Visuals.fogEnabled && MapModifiers?.fogRects){ ctx.save(); ctx.fillStyle='rgba(0,0,0,0.35)'; for(const fr of MapModifiers.fogRects){ ctx.fillRect(fr.x, fr.y, fr.w, fr.h); } ctx.restore(); }
    },
    updateLabels: (function(){
      let scheduled=false; let pending=null;
      const apply=()=>{
        scheduled=false; const d=pending; pending=null; if(!d) return;
        moneyEl.textContent = d.money;
        livesEl.textContent = d.lives;
        waveEl.textContent = d.wave;
        if(skillPtsEl) skillPtsEl.textContent = d.sp;
        if(incomeEl) incomeEl.textContent = d.income;
        const bb = document.getElementById('bountyBoost');
        if(bb){ bb.style.display = State.bountyBoostActive ? '' : 'none'; }
      };
      return function(){
        pending = {
          money: Math.max(0,Math.floor(State.money)),
          lives: State.lives,
          wave: State.currentWave,
          sp: (Skills.points||0),
          income: (State.lastRoundIncome||0) > 0 ? `+${State.lastRoundIncome}` : '0'
        };
        if(!scheduled){ scheduled=true; queueMicrotask(apply); }
      };
    })(),
    // Wave report popup
    showWaveReport: function(report){
      try{
        const host = document.createElement('div');
        host.style.position='fixed'; host.style.right='12px'; host.style.top='12px'; host.style.zIndex='1002';
        host.style.background='rgba(15,15,16,0.96)'; host.style.border='1px solid #333'; host.style.borderRadius='10px'; host.style.padding='10px'; host.style.minWidth='240px';
        const title = document.createElement('div'); title.style.fontWeight='600'; title.textContent = `Våg ${report.wave} klar!`; host.appendChild(title);
        const list = document.createElement('div'); list.className='small'; list.style.marginTop='6px';
        const rows = (report.towers||[]).slice().sort((a,b)=>b.dmg-a.dmg).slice(0,5);
        if(rows.length===0){ list.textContent = 'Inga skador registrerade ännu.'; }
        else {
          for(const r of rows){ const line=document.createElement('div'); line.textContent = `${r.id}: ${Math.round(r.dmg)} dmg • ${r.kills||0} kills`; list.appendChild(line); }
        }
        host.appendChild(list);
        if(report.mvp){ const badge=document.createElement('div'); badge.className='small'; badge.style.marginTop='6px'; badge.style.color='#ffd54f'; badge.textContent = `MVP: ${report.mvp.id} (${Math.round(report.mvp.dmg)} dmg)`; host.appendChild(badge); }
        // Bank ROI section
        if(report.banks && report.banks.length){
          const banks=document.createElement('div'); banks.className='small'; banks.style.marginTop='8px';
          const title2=document.createElement('div'); title2.textContent='Banker (ROI)'; title2.style.fontWeight='600'; title2.style.marginBottom='4px'; banks.appendChild(title2);
          for(const b of report.banks){ const payback = b.income>0? Math.ceil((b.invested||0) / b.income) : '–'; const line=document.createElement('div'); line.textContent=`${b.id}: +${b.income}/våg • Inv:${b.invested} • Payback≈${payback} våg`; banks.appendChild(line); }
          host.appendChild(banks);
        }
        // History (last 5)
        if(report.history && report.history.length){
          const hist=document.createElement('div'); hist.className='small'; hist.style.marginTop='8px';
          const t=document.createElement('div'); t.textContent='Senaste vågor'; t.style.fontWeight='600'; t.style.marginBottom='4px'; hist.appendChild(t);
          for(const h of report.history){ const line=document.createElement('div'); const top = (h.towers||[]).slice().sort((a,b)=>b.dmg-a.dmg)[0]; const bank=h.banks&&h.banks[0]; line.textContent=`V${h.wave}: MVP ${top?top.id:''} ${top?Math.round(top.dmg):0} dmg${bank?` • Bank +${bank.income}`:''}`; hist.appendChild(line); }
          host.appendChild(hist);
        }
        const close=document.createElement('button'); close.textContent='Stäng'; close.className='btn-secondary'; close.style.marginTop='8px'; host.appendChild(close);
        close.onclick=()=>{ host.remove(); };
        document.body.appendChild(host);
        // Auto-hide after 6s if a wave is active
        setTimeout(()=>{ if(host && host.parentNode) host.remove(); }, 6000);
      }catch(_e){}
    }
  };
}
