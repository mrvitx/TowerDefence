// src/profiles/gating.js
// Central place for progression rules: map level requirements, drop tables, etc.

import { unlockMap } from './profile.js';

// Known map ids and their suggested unlock levels
export const MAP_LEVEL_REQ = {
  ring: 1,
  maze: 1,
  figure8: 2,
  zigzag: 3,
  spiral: 4,
  riverNoise: 5,
  river: 3,
  spiralCore: 5,
  overpass8: 4,
  twinLanes: 3,
  forkMerge: 4,
  islands: 4,
  portals: 5,
  pockets: 6,
};

export const KNOWN_MAP_IDS = Object.keys(MAP_LEVEL_REQ);

export function getMapRequiredLevel(mapId){
  return MAP_LEVEL_REQ[mapId] || 1;
}

export function isUnlockedForProfile(profile, mapId){
  if(!profile || !mapId) return true;
  if(profile.unlockedMaps && profile.unlockedMaps[mapId]) return true;
  return (profile.level||1) >= getMapRequiredLevel(mapId);
}

export function updateUnlocksForProfile(profile, mapIds=KNOWN_MAP_IDS){
  if(!profile) return 0;
  // Merge in any per-map requiredLevel from map storage at runtime
  try{
    if(typeof window!=="undefined" && window.Maps && typeof window.Maps.loadMaps==='function'){
      const maps = window.Maps.loadMaps();
      for(const m of maps){
        const req = Math.max(1, (m.settings && m.settings.requiredLevel) ? m.settings.requiredLevel : (MAP_LEVEL_REQ[m.id]||1));
        MAP_LEVEL_REQ[m.id] = req; // update dynamic registry
        if(!KNOWN_MAP_IDS.includes(m.id)) KNOWN_MAP_IDS.push(m.id);
      }
    }
  }catch(_e){}
  let changed = 0;
  for(const id of mapIds){
    const req = getMapRequiredLevel(id);
    if((profile.level||1) >= req && !(profile.unlockedMaps&&profile.unlockedMaps[id])){
      unlockMap(profile, id); changed++;
    }
  }
  return changed;
}
