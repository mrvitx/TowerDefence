// src/profiles/profile.js
// Lightweight profile system with inventory and progression.
// Storage: localStorage now; later replace with DB by swapping storage layer.

const PROF_KEY = 'td-profile-v1';

export const DEFAULT_PROFILE = {
  id: 'local',
  name: 'Spelare',
  xp: 0,
  level: 1,
  shards: 0, // soft currency from boss drops
  // inventory: array of items
  // item: { id, type: 'part'|'mod'|'consumable', rarity: 'c'|'u'|'r'|'e', qty: 1, meta: {} }
  inventory: [],
  // towerBlueprints: custom designs crafted from parts (future)
  // blueprint: { id, name, base: 'cannon'|..., color, parts: { barrel: 'x', core:'y', modIds:[] } }
  towerBlueprints: [],
  // map unlocks: { [mapId]: true }
  unlockedMaps: { ring: true, maze: true },
  // preferences per profile
  prefs: { lastMap: 'ring' },
  // audit
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }

export function xpToNext(level){
  // simple curve: grows ~quadratic
  return 100 + Math.floor(level * level * 50);
}

export function loadProfile(){
  try{
    const raw = localStorage.getItem(PROF_KEY);
    if(!raw) return { ...DEFAULT_PROFILE };
    const data = JSON.parse(raw);
    // basic migration/merge
    const prof = { ...DEFAULT_PROFILE, ...data };
    prof.unlockedMaps = { ...DEFAULT_PROFILE.unlockedMaps, ...(data.unlockedMaps||{}) };
    prof.inventory = Array.isArray(data.inventory) ? data.inventory.slice() : [];
    prof.towerBlueprints = Array.isArray(data.towerBlueprints) ? data.towerBlueprints.slice() : [];
    return prof;
  }catch(e){ return { ...DEFAULT_PROFILE }; }
}

export function saveProfile(prof){
  try{
    const payload = { ...prof, updatedAt: Date.now() };
    localStorage.setItem(PROF_KEY, JSON.stringify(payload));
    return true;
  }catch(e){ return false; }
}

export function grantXP(prof, amount){
  if(!(amount>0)) return false;
  prof.xp = (prof.xp||0) + Math.floor(amount);
  let leveled = false;
  while(prof.xp >= xpToNext(prof.level)){
    prof.xp -= xpToNext(prof.level);
    prof.level = (prof.level||1) + 1;
    leveled = true;
  }
  if(leveled) saveProfile(prof); else saveProfile(prof);
  return leveled;
}

export function addItem(prof, item){
  if(!item || !item.id) return false;
  // stack by id for simple types
  const idx = prof.inventory.findIndex(i=> i.id===item.id && i.rarity===item.rarity && i.type===item.type);
  if(idx>=0){ prof.inventory[idx].qty = (prof.inventory[idx].qty||0) + (item.qty||1); }
  else { prof.inventory.push({ ...item, qty: item.qty||1 }); }
  saveProfile(prof); return true;
}

export function removeItem(prof, itemId, qty=1){
  const idx = prof.inventory.findIndex(i=>i.id===itemId);
  if(idx<0) return false;
  prof.inventory[idx].qty = Math.max(0, (prof.inventory[idx].qty||0) - qty);
  if(prof.inventory[idx].qty===0) prof.inventory.splice(idx,1);
  saveProfile(prof); return true;
}

export function unlockMap(prof, mapId){
  if(!mapId) return false;
  prof.unlockedMaps[mapId] = true;
  saveProfile(prof); return true;
}

export function isMapUnlocked(prof, mapId){
  if(!mapId) return false;
  return !!prof.unlockedMaps[mapId];
}

export function ensureProfile(){
  const p = loadProfile();
  // Ensure base maps always unlocked
  p.unlockedMaps = { ring:true, maze:true, ...(p.unlockedMaps||{}) };
  saveProfile(p);
  return p;
}

// Boss drop helper: returns a random item with rarity weighting
export function rollBossDrop(rng=Math){
  const r = (rng.random ? rng.random() : Math.random)();
  const rarity = r<0.60? 'c' : r<0.88? 'u' : r<0.975? 'r' : 'e';
  const id = `part_${rarity}_${Math.floor((rng.random?rng.random():Math.random)()*10000)}`;
  return { id, type:'part', rarity, qty:1, meta:{} };
}

// Simple blueprint creation stub
export function createBlueprintFromParts(prof, name, base='cannon', color='#7f5', parts={}){
  const id = 'bp_' + Math.floor(Math.random()*1e9);
  const bp = { id, name: name||'Mitt torn', base, color, parts: parts||{}, createdAt: Date.now() };
  prof.towerBlueprints.push(bp);
  saveProfile(prof);
  return bp;
}
