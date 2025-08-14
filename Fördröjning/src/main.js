import { buildPath } from './path.js';
import { State, resetGame } from './state.js';
import { handleSpawning } from './waves.js';
import { drawGrid, drawWorld, initBackground, drawRangesCached, drawMatrixTop } from './render.js';
import { wireUI } from './ui.js';
import { SpatialHash } from './spatial.js';
import { loadSettingsApply, tryAutoLoadXML } from './persist.js';
import { Settings, Skills, Visuals, MapSettings } from './constants.js';
import { ensureProfile, grantXP, addItem, rollBossDrop, saveProfile, unlockMap } from './profiles/profile.js';
import { updateUnlocksForProfile } from './profiles/gating.js';

// Boot
window.__TD_BOOTED = true;
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
// Initialize profile (local for now; DB later)
const Profile = ensureProfile();
try{ updateUnlocksForProfile(Profile); saveProfile(Profile); }catch(_e){}

// Force MapSettings.preset from localStorage before anything else
try {
  const raw = localStorage.getItem('td-settings-v1');
  if (raw) {
    const data = JSON.parse(raw);
    if (data && data.MapSettings && data.MapSettings.preset) {
      MapSettings.preset = data.MapSettings.preset;
    }
  }
} catch (e) {}

// Load saved settings first, then reset to apply Admin defaults
try{ loadSettingsApply(); }catch(e){}
// After settings load, build path once to apply per-map overrides (startMoney/lives) before first reset
try{ buildPath(canvas); }catch(_e){}
// Sync State money/lives with Admin defaults (may be overridden by active map in buildPath)
try{ State.money = State.money || 0; State.lives = State.lives || 0; }catch(_e){}
// Apply theme variables from Visuals (presets + accent) to CSS vars
(function applyThemeFromVisuals(){
  try{
    const THEMES = {
      light: { '--bg':'#f5f7fb','--panel':'#ffffff','--panel2':'#f7f9fc','--edge':'#d6dbe7','--txt':'#0b1020','--muted':'#5c6680','--btn2':'#dde3f0','--accent':'#3b82f6' },
      dim:   { '--bg':'#0f0f10','--panel':'#151515','--panel2':'#101010','--edge':'#2a2a2a','--txt':'#eeeeee','--muted':'#aaaaaa','--btn2':'#3a3a3a','--accent':'#2d6' },
      neon:  { '--bg':'#0a0b14','--panel':'#0f1022','--panel2':'#0c0d1a','--edge':'#1b1c2b','--txt':'#e7f0ff','--muted':'#8ea2c6','--btn2':'#1b1e34','--accent':'#00e5ff' }
    };
    const theme = Visuals.theme || 'dim';
    const base = THEMES[theme] || THEMES.dim;
    const root = document.documentElement;
    for(const k in base){ root.style.setProperty(k, base[k]); }
    if(Visuals._accent){ root.style.setProperty('--accent', Visuals._accent); }
    if(typeof Visuals._radius==='number'){ root.style.setProperty('--radius', Visuals._radius+'px'); }
    if(typeof Visuals._scale==='number'){ root.style.setProperty('--ui-scale', String(Visuals._scale)); }
    if(Visuals._compact){ document.body.classList.add('hud-compact'); } else { document.body.classList.remove('hud-compact'); }
  }catch(_e){}
})();
// Optional: auto-load XML only if explicitly enabled
try{
  const enable = localStorage.getItem('td-auto-xml') === '1';
  if(enable){ await tryAutoLoadXML(); }
}catch(e){}
resetGame();
// Lightweight seeded RNG (mulberry32) and seed bootstrap
function createRng(seed){
  let t = (seed>>>0) || 0x9e3779b9;
  const rand = () => {
    t += 0x6D2B79F5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
  return { random: rand };
}
if(typeof State.seed!=='number'){ State.seed = Math.floor(Math.random()*1e9)>>>0; }
State.rng = createRng(State.seed);
// Global setter for debugging/replay
window.__TD_SET_SEED = (s)=>{ try{ const n=Number(s)>>>0; State.seed=n; State.rng=createRng(n); console.log('Seed set to', n); }catch(e){} };

function rebuildForSettings(){
  buildPath(canvas);
  initBackground(canvas);
}

// Build again in case reset cleared path-dependent visuals
buildPath(canvas);
initBackground(canvas);
let ui = { drawOverlay: ()=>{}, updateLabels: ()=>{}, showWaveReport: ()=>{} };
try{
  ui = wireUI() || ui;
}catch(err){
  try{ console.error('UI init failed:', err); }catch(_e){}
  try{ alert('UI-problem upptäckt – laddar spelet med förenklad UI.'); }catch(_e){}
}
const spatial = new SpatialHash(80);
// Keep a small rolling history of last waves for ROI/stats panel
const WaveHistory = [];
// DPS sampling accumulator (250ms)
let _dpsSampleAcc = 0;

// Soft-apply settings when coming back from Admin (no full reload needed)
window.addEventListener('focus',()=>{ try{ loadSettingsApply(); rebuildForSettings(); }catch(e){} });

let last = performance.now();
function loop(t){
  const dt = Math.min(0.05, (t-last)/1000);
  // Advance deterministic time scaled by game speed (clamped dt already)
  State.gameTime = (State.gameTime||0) + dt * Math.max(0, Settings.gameSpeed||0);

  // Spawning (skip while paused)
  if(Settings.gameSpeed>0){ handleSpawning(dt); }

  // Update entities
  spatial.clear();
  for(const e of State.enemies){ spatial.insert(e.pos.x, e.pos.y, e); }
  if(Settings.gameSpeed>0){ for(const e of State.enemies) e.update(dt); }
  for(let i=State.enemies.length-1;i>=0;i--){
    const e=State.enemies[i];
    if(e.hp<=0){
      // Award kill to last hitting tower, if any
      const killer = e._lastHitBy; if(killer){ killer._kills = (killer._kills||0) + 1; killer._waveKills = (killer._waveKills||0) + 1; }
      {
        let bountyMul = (Skills.bountyMul||1);
        if(State.bountyBoostActive){ bountyMul *= 1.25; }
        State.money += Math.floor(e.worth * bountyMul);
      }
      if(e.boss){
        // Reward: skill point + profile XP + boss drop
        Skills.points = (Skills.points||0) + 1;
        try{ localStorage.setItem('td-settings-v1', JSON.stringify({ ...(JSON.parse(localStorage.getItem('td-settings-v1')||'{}')), Skills: { ...Skills }, ts: Date.now() })); }catch(_e){}
        try{
          grantXP(Profile, 50);
          updateUnlocksForProfile(Profile);
          saveProfile(Profile);
          const drop = rollBossDrop(State.rng);
          addItem(Profile, drop);
        }catch(_e){}
      }
      // slime split: spawn two smaller if flagged
      if(e.slime){
        for(let k=0;k<2;k++){
          const child = new (e.constructor)(Math.max(4, Math.floor(e.maxHp*0.35)), e.speed*1.2, Math.max(1, Math.floor(e.worth*0.4)));
          child.pathIndex = e.pathIndex; child.pos = {x:e.pos.x + (k?8:-8), y:e.pos.y}; child.slow = 1;
          State.enemies.push(child);
        }
      }
      State.enemies.splice(i,1);
    } else if(e.reached){ State.lives--; State.enemies.splice(i,1); }
  }
  if(Settings.gameSpeed>0){
    for(const t of State.towers) t.update(dt, State.enemies, State.projectiles, spatial);
    for(const p of State.projectiles) p.update(dt, State.enemies);
  }
  for(let i=State.projectiles.length-1;i>=0;i--){ const p=State.projectiles[i]; if(p.hit||p.lost) State.projectiles.splice(i,1); }

  // Draw
  ctx.clearRect(0,0,canvas.width,canvas.height);
  drawWorld(ctx, canvas);
  if(Visuals.showAllRanges){ try{ drawRangesCached(ctx, canvas, State.towers); }catch(_e){} }
  for(const t of State.towers) t.draw(ctx);
  for(const e of State.enemies) e.draw(ctx);
  for(const p of State.projectiles) p.draw(ctx);
  // Matrix rain as top overlay (overlaps gameplay)
  try{ drawMatrixTop(ctx, canvas); }catch(_e){}
  ui.drawOverlay();

  // UI labels
  ui.updateLabels();

  // DPS sampling: compute recent DPS every 250ms and cache on towers
  _dpsSampleAcc += dt;
  if(_dpsSampleAcc >= 0.25){
    _dpsSampleAcc = 0;
    const now=performance.now();
    for(const t of State.towers){
      if(t.def?.income) { t._dpsNow = 0; continue; }
      const log=t._dmgLog||[]; let sum=0;
      for(let i=log.length-1;i>=0;i--){ const it=log[i]; if(now - it.t <= 3000) sum+=it.amount; else break; }
      t._dpsNow = sum/3;
    }
  }

  if(State.lives <= 0){ alert('Game Over!'); resetGame(); }

  // End-of-wave passive income from Bank towers (when no enemies and not spawning), once per wave
  if(!State.waveInProgress && State.spawnQueue.length===0 && State.enemies.length===0){
    const waveId = State.currentWave; // 0 at start
    if(waveId !== State.lastPayoutWave){
  // Wave completed — snapshot tower stats for report
  // ROI: for banks, income per wave vs invested
  const banks = State.towers.filter(t=>t.def?.income).map(t=>({ id:t.type, income: Math.floor(t.getIncomePerRound()), invested: Math.floor((t._spent||t.def.cost||0)), ref:t }));
  const report = { wave: waveId, towers: State.towers.filter(t=>!t.def?.income).map(t=>({ id:t.type, dmg:t._waveDamage||0, kills:t._waveKills||0, ref:t })), banks };
  // Find MVP by damage
  report.mvp = report.towers.slice().sort((a,b)=>b.dmg-a.dmg)[0] || null;
  // Push to rolling history (5 entries)
  WaveHistory.push({ wave: report.wave, towers: report.towers.map(({id,dmg,kills})=>({id,dmg,kills})), banks: report.banks.map(({id,income,invested})=>({id,income,invested})) });
  while(WaveHistory.length>5) WaveHistory.shift();
  ui.showWaveReport && ui.showWaveReport({ ...report, history: WaveHistory.slice().reverse() });
  // Reset per-wave counters for next wave
  for(const t of State.towers){ t._waveDamage=0; t._waveKills=0; }
      // Compute bank income with soft cap
      let totalIncome = 0;
      for(const t of State.towers){ if(t?.def?.income && typeof t.getIncomePerRound==='function'){ totalIncome += t.getIncomePerRound(); } }
      const cap = MapSettings.bankIncomeCap||0; const softness = (MapSettings.bankCapSoftness ?? 0.5);
      if(cap>0 && totalIncome>cap){
        const over = totalIncome - cap; totalIncome = Math.floor(cap + over * Math.max(0, Math.min(1, softness)));
      } else { totalIncome = Math.floor(totalIncome); }
      if(totalIncome>0){ State.money += totalIncome; State.lastRoundIncome = totalIncome; }
  // Mutator reward application (once, when wave just finished)
    if(State.activeWaveMutator){
      const r = State.activeWaveMutator.reward || {};
      if(r.money){ State.money += r.money; }
      if(r.sp){ Skills.points = (Skills.points||0) + (r.sp||0); }
      // Temporary per-wave boosts like bounty/bank were already applied implicitly to entities; for simplicity, we apply these as one-time bonuses at end
      State.activeWaveMutator = null; // reset after applying
      try{ localStorage.setItem('td-settings-v1', JSON.stringify({ ...(JSON.parse(localStorage.getItem('td-settings-v1')||'{}')), Skills: { ...Skills }, ts: Date.now() })); }catch(_e){}
    }
  // Progression skills: small point drip every 3 waves completed and bounty boost every 5
  if(State.currentWave>0 && State.currentWave % 3 === 0){ Skills.points = (Skills.points||0) + 1; try{ localStorage.setItem('td-settings-v1', JSON.stringify({ ...(JSON.parse(localStorage.getItem('td-settings-v1')||'{}')), Skills: { ...Skills }, ts: Date.now() })); }catch(_e){} }
  if(State.currentWave>0 && State.currentWave % 5 === 0){ State.bountyBoostNext = (State.bountyBoostNext||0) + 1; }
  // Wave just ended: clear temporary active flags
  State.bountyBoostActive = false;
  // Mark payout done for this waveId
  State.lastPayoutWave = waveId;
  try{ grantXP(Profile, 10); updateUnlocksForProfile(Profile); saveProfile(Profile); }catch(_e){}
    }
    // Victory condition when maxWaves reached and not endless
    if(!MapSettings.endless && MapSettings.maxWaves && State.currentWave >= MapSettings.maxWaves){
      try{
        // Unlock a new map based on difficulty progression
        const order = ['ring','maze','figure8','zigzag','spiral','riverNoise'];
        const prof = Profile;
        let next = order.find(id => !prof.unlockedMaps[id]);
        if(next){ unlockMap(prof, next); saveProfile(prof); }
      }catch(_e){}
      alert('Grattis! Du klarade alla vågor.');
      resetGame();
    }
  }

  last = t; requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
