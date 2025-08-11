// Persistence utilities for settings and game saves
import { Settings, Admin, Visuals, MapSettings, Audio, Skills, SKILL_TREE } from './constants.js';
import { TOWER_TYPES, ensureBuiltInTowers } from './towers.js';
import { State, resetGame } from './state.js';
import { Tower } from './entities.js';

const SETTINGS_KEY = 'td-settings-v1';
const SAVE_KEY = 'td-save-v1';

export function loadSettingsApply(){
  try{
    const raw = localStorage.getItem(SETTINGS_KEY);
    if(!raw) return;
    const data = JSON.parse(raw);
    if(data.Admin){ Object.assign(Admin, data.Admin); }
    if(data.Settings){
      Settings.maxSpeed = data.Settings.maxSpeed ?? Settings.maxSpeed;
      if(data.Settings.buildMode) Settings.buildMode = data.Settings.buildMode;
    }
    if(data.Visuals){ Object.assign(Visuals, data.Visuals); }
    if(data.MapSettings){ Object.assign(MapSettings, data.MapSettings); }
    if(data.Audio){ Object.assign(Audio, data.Audio); }
  if(data.Skills){ Object.assign(Skills, data.Skills); }
    if(data.TOWER_TYPES){
      // Merge tower types; don't remove existing, override by id
      for(const id of Object.keys(data.TOWER_TYPES)){
        TOWER_TYPES[id] = { ...TOWER_TYPES[id], ...data.TOWER_TYPES[id], id };
      }
    }
  }catch(e){ console.warn('Failed to load settings', e); }
  // Recompute flat multipliers from skill tree
  try{
    // reset to base
    Skills.dmgMul = Skills.dmgMul||1; Skills.rangeMul = Skills.rangeMul||1; Skills.critAdd = Skills.critAdd||0; Skills.bankMul = Skills.bankMul||1; Skills.bountyMul = Skills.bountyMul||1; Skills.rofMul = Skills.rofMul||1;
    let base = { dmgMul:1, rangeMul:1, critAdd:0, bankMul:1, bountyMul:1, rofMul:1 };
    const lv = (Skills.tree && Skills.tree.lv) || {};
    for(const tier of SKILL_TREE){
      for(const n of tier.nodes){
        const l = lv[n.id]||0; if(l<=0) continue;
        if(n.effects.dmgMul){ base.dmgMul += n.effects.dmgMul * l; }
        if(n.effects.rangeMul){ base.rangeMul += n.effects.rangeMul * l; }
        if(n.effects.critAdd){ base.critAdd += n.effects.critAdd * l; }
        if(n.effects.bankMul){ base.bankMul += n.effects.bankMul * l; }
        if(n.effects.bountyMul){ base.bountyMul += n.effects.bountyMul * l; }
        if(n.effects.rofMul){ base.rofMul += n.effects.rofMul * l; } // note: negative makes faster
      }
    }
    Skills.dmgMul = base.dmgMul; Skills.rangeMul = base.rangeMul; Skills.critAdd = base.critAdd; Skills.bankMul = base.bankMul; Skills.bountyMul = base.bountyMul; Skills.rofMul = Math.max(0.5, base.rofMul);
  }catch(_e){}
  // Always re-ensure built-in towers exist (e.g., Bank)
  try{ ensureBuiltInTowers(); }catch(_e){}
}

export function saveSettingsDump(){
  const payload = {
    Admin: { ...Admin },
    Settings: { maxSpeed: Settings.maxSpeed, buildMode: Settings.buildMode },
    Visuals: { ...Visuals },
    MapSettings: { ...MapSettings },
  Audio: { ...Audio },
  Skills: { ...Skills },
    TOWER_TYPES: { ...TOWER_TYPES },
    ts: Date.now(),
  };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(payload));
}

// --- XML export/import ---
function esc(str){ return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

export function settingsToXML(){
  const t = Object.values(TOWER_TYPES).map(def=>{
    return `    <Tower id="${esc(def.id)}" label="${esc(def.label)}" cost="${def.cost}" range="${def.range}" dmg="${def.dmg}" fireRate="${def.fireRate}" color="${esc(def.color||'#ccc')}" sellFactor="${def.sellFactor??0.7}"${def.aoe?` aoe="${def.aoe}"`:''}${def.slow?` slow="${def.slow}"`:''}${def.slowTime?` slowTime="${def.slowTime}"`:''}/>`;
  }).join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<kaffekatten>
  <Admin startMoney="${Admin.startMoney}" startLives="${Admin.startLives}">
    <upgCost dmg="${Admin.upgCost.dmg}" range="${Admin.upgCost.range}" rate="${Admin.upgCost.rate}" />
  </Admin>
  <Settings maxSpeed="${Settings.maxSpeed}" buildMode="${esc(Settings.buildMode)}" />
  <Visuals showGrid="${!!Visuals.showGrid}" pathWidth="${Visuals.pathWidth}" showDps="${!!Visuals.showDps}" showHeatmap="${!!Visuals.showHeatmap}" fogEnabled="${!!Visuals.fogEnabled}" showAllRanges="${!!Visuals.showAllRanges}" reducedFX="${!!Visuals.reducedFX}" cbMode="${esc(Visuals.cbMode||'none')}" fontScale="${Visuals.fontScale||1}" theme="${esc(Visuals.theme||'dim')}" accent="${esc(Visuals._accent||'')}" radius="${typeof Visuals._radius==='number'?Visuals._radius:''}" scale="${typeof Visuals._scale==='number'?Visuals._scale:''}" compact="${!!Visuals._compact}" />
  <Map preset="${esc(MapSettings.preset)}" difficulty="${MapSettings.difficulty}" endless="${!!MapSettings.endless}" />
  <Audio muted="${!!Audio.muted}" sfxVolume="${Audio.sfxVolume}" />
  <Skills points="${Skills.points}" dmgMul="${Skills.dmgMul}" rangeMul="${Skills.rangeMul}" critAdd="${Skills.critAdd}" bankMul="${Skills.bankMul}" bountyMul="${Skills.bountyMul}">
    ${(function(){ const lv=Skills.tree?.lv||{}; return Object.keys(lv).map(id=>`    <Node id="${esc(id)}" level="${lv[id]}" />`).join('\n'); })()}
  </Skills>
  <Towers>\n${t}\n  </Towers>
  <timestamp>${Date.now()}</timestamp>
</kaffekatten>`;
  return xml;
}

export function saveSettingsAsXML(filename='kaffekatten-settings.xml'){
  try{
    const xml = settingsToXML();
    const blob = new Blob([xml], {type:'application/xml'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 0);
    return true;
  }catch(e){ console.warn('XML save failed', e); return false; }
}

export function applySettingsFromXMLDoc(doc){
  try{
    const get = sel => doc.querySelector(sel);
    const adminEl = get('kaffekatten > Admin');
    if(adminEl){
      const sm = parseInt(adminEl.getAttribute('startMoney'));
      const sl = parseInt(adminEl.getAttribute('startLives'));
      if(!isNaN(sm)) Admin.startMoney = sm;
      if(!isNaN(sl)) Admin.startLives = sl;
      const upg = get('kaffekatten > Admin > upgCost');
      if(upg){
        const d=parseInt(upg.getAttribute('dmg')), r=parseInt(upg.getAttribute('range')), rt=parseInt(upg.getAttribute('rate'));
        if(!isNaN(d)) Admin.upgCost.dmg=d; if(!isNaN(r)) Admin.upgCost.range=r; if(!isNaN(rt)) Admin.upgCost.rate=rt;
      }
    }
    const setEl = get('kaffekatten > Settings');
    if(setEl){
      const ms = parseFloat(setEl.getAttribute('maxSpeed'));
      const bm = setEl.getAttribute('buildMode')||Settings.buildMode;
      if(!isNaN(ms)) Settings.maxSpeed = ms;
      if(bm) Settings.buildMode = bm;
    }
    const visEl = get('kaffekatten > Visuals');
    if(visEl){
  Visuals.showGrid = visEl.getAttribute('showGrid') === 'true';
  const pw = parseInt(visEl.getAttribute('pathWidth')); if(!isNaN(pw)) Visuals.pathWidth = pw;
  const sd = visEl.getAttribute('showDps'); if(sd!==null) Visuals.showDps = sd==='true';
  const sh = visEl.getAttribute('showHeatmap'); if(sh!==null) Visuals.showHeatmap = sh==='true';
  const fe = visEl.getAttribute('fogEnabled'); if(fe!==null) Visuals.fogEnabled = fe==='true';
  const ar = visEl.getAttribute('showAllRanges'); if(ar!==null) Visuals.showAllRanges = ar==='true';
  const rfx = visEl.getAttribute('reducedFX'); if(rfx!==null) Visuals.reducedFX = rfx==='true';
  const cb = visEl.getAttribute('cbMode'); if(cb) Visuals.cbMode = cb;
  const fs = parseFloat(visEl.getAttribute('fontScale')); if(!isNaN(fs)) Visuals.fontScale = fs;
  const th = visEl.getAttribute('theme'); if(th) Visuals.theme = th;
  const ac = visEl.getAttribute('accent'); if(ac!==null) Visuals._accent = ac || undefined;
  const rad = parseFloat(visEl.getAttribute('radius')); if(!isNaN(rad)) Visuals._radius = rad;
  const sc = parseFloat(visEl.getAttribute('scale')); if(!isNaN(sc)) Visuals._scale = sc;
  const cp = visEl.getAttribute('compact'); if(cp!==null) Visuals._compact = cp==='true';
    }
    const mapEl = get('kaffekatten > Map');
    if(mapEl){
      const pr = mapEl.getAttribute('preset')||MapSettings.preset;
      const df = parseInt(mapEl.getAttribute('difficulty'));
      const en = mapEl.getAttribute('endless') === 'true';
      MapSettings.preset = pr; if(!isNaN(df)) MapSettings.difficulty = df; MapSettings.endless = en;
    }
    const audEl = get('kaffekatten > Audio');
  if(audEl){ Audio.muted = audEl.getAttribute('muted') === 'true'; const sv=parseFloat(audEl.getAttribute('sfxVolume')); if(!isNaN(sv)) Audio.sfxVolume=sv; }
  const skEl = get('kaffekatten > Skills');
  if(skEl){ const pd = parseFloat(skEl.getAttribute('dmgMul')); if(!isNaN(pd)) Skills.dmgMul=pd; const pr=parseFloat(skEl.getAttribute('rangeMul')); if(!isNaN(pr)) Skills.rangeMul=pr; const ca=parseFloat(skEl.getAttribute('critAdd')); if(!isNaN(ca)) Skills.critAdd=ca; const bm=parseFloat(skEl.getAttribute('bankMul')); if(!isNaN(bm)) Skills.bankMul=bm; const bo=parseFloat(skEl.getAttribute('bountyMul')); if(!isNaN(bo)) Skills.bountyMul=bo; const pts=parseInt(skEl.getAttribute('points')); if(!isNaN(pts)) Skills.points=pts; 
    // nodes
    Skills.tree = Skills.tree || {lv:{}}; const nodes = skEl.querySelectorAll('Node'); nodes.forEach(n=>{ const id=n.getAttribute('id'); const lv=parseInt(n.getAttribute('level')); if(id && !isNaN(lv)) Skills.tree.lv[id]=lv; });
  }
    // Towers
    const towers = doc.querySelectorAll('kaffekatten > Towers > Tower');
    if(towers && towers.length){
      towers.forEach(el=>{
        const id = el.getAttribute('id'); if(!id) return;
        const def = TOWER_TYPES[id] || { id };
        def.id=id; def.label=el.getAttribute('label')||id;
        const num = name => parseFloat(el.getAttribute(name));
        const str = name => el.getAttribute(name);
        const bool = name => { const v = el.getAttribute(name); return v==='true' ? true : v==='false' ? false : undefined; };
        const ni = name => { const v = parseFloat(el.getAttribute(name)); return isNaN(v) ? undefined : v; };
        const merged = {
          ...def,
          cost: ni('cost') ?? def.cost ?? 50,
          range: ni('range') ?? def.range ?? 80,
          dmg: ni('dmg') ?? def.dmg ?? 5,
          fireRate: ni('fireRate') ?? def.fireRate ?? 1,
          color: str('color') || def.color || '#ccc',
          sellFactor: ni('sellFactor') ?? def.sellFactor ?? 0.7,
          aoe: ni('aoe') ?? def.aoe,
          slow: ni('slow') ?? def.slow,
          slowTime: ni('slowTime') ?? def.slowTime,
        };
        TOWER_TYPES[id] = merged;
      });
    }
  }catch(e){ console.warn('XML parse/apply failed', e); }
}

export async function tryAutoLoadXML(relativePath='./kaffekatten-settings.xml'){
  try{
    const res = await fetch(relativePath, { cache:'no-store' });
    if(!res.ok) return false;
    const text = await res.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'application/xml');
    if(doc.querySelector('parsererror')) return false;
    applySettingsFromXMLDoc(doc);
    saveSettingsDump();
    return true;
  }catch(e){ return false; }
}

export async function importSettingsXMLFromText(text){
  try{
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'application/xml');
    if(doc.querySelector('parsererror')) throw new Error('XML parse error');
    applySettingsFromXMLDoc(doc);
    saveSettingsDump();
    return true;
  }catch(e){ console.warn('XML import failed', e); return false; }
}

export function saveGame(){
  const towers = State.towers.map(t=>({ x:t.x, y:t.y, type:t.type, levels:{...t.levels} }));
  const save = {
    money: State.money,
    lives: State.lives,
    currentWave: State.currentWave,
    waveInProgress: false,
    towers,
    timestamp: Date.now(),
  };
  localStorage.setItem(SAVE_KEY, JSON.stringify(save));
}

export function loadGame(){
  try{
    const raw = localStorage.getItem(SAVE_KEY); if(!raw) return false;
    const data = JSON.parse(raw);
    resetGame();
    State.money = data.money ?? State.money;
    State.lives = data.lives ?? State.lives;
    State.currentWave = data.currentWave ?? 0;
    State.waveInProgress = false;
    State.towers.length = 0;
    for(const td of (data.towers||[])){
      const def = TOWER_TYPES[td.type];
      if(!def) continue;
      const tw = new Tower(td.x, td.y, def);
      if(td.levels) tw.levels = { ...tw.levels, ...td.levels };
      State.towers.push(tw);
    }
    return true;
  }catch(e){ console.warn('Failed to load save', e); return false; }
}
