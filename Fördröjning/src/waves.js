import { Settings, MapSettings } from './constants.js';
import { State } from './state.js';
import { Enemy } from './entities.js';
import { getRouteCount } from './path.js';

export function prepareWave(n){
  State.spawnQueue.length=0;
  State._spawnedCount = 0;
  const diff = Math.max(1, MapSettings.difficulty||1);
  const endlessBoost = MapSettings.endless ? Math.floor(n/5) : 0;
  // Wave size scales by difficulty and pacing target (roundSeconds)
  const baseCount = (6 + n*3);
  const diffMul = (0.9 + 0.1*diff);
  const pace = Math.max(10, Math.min(120, MapSettings.roundSeconds||25));
  const paceMul = pace/25; // longer roundSeconds => fler spawns
  const count = Math.floor(baseCount * diffMul * paceMul) + endlessBoost;
  const m = State.activeWaveMutator; const hpMul=m?.enemy?.hpMul||1; const spMul=m?.enemy?.speedMul||1; const worthMul=m?.enemy?.worthMul||1; const stealthAdd = m?.enemy?.stealthAdd||0;
  const spawnMul = m?.wave?.spawnRateMul || 1;
  // Build a single-route blueprint once, then duplicate per route
  const blueprint = [];
  for(let i=0;i<count;i++){
    if(i % 13 === 0) blueprint.push({hp:Math.floor((22 + n*6)*diff*hpMul), speed:(36 + n*2)*spMul, worth:Math.floor(10*worthMul), slime:true});
    else if(i % 17 === 0) blueprint.push({hp:Math.floor((40 + n*10)*diff*hpMul), speed:(30 + n*1)*spMul, worth:Math.floor(20*worthMul), boss:true, immuneSlow:true});
    else if(i % 7 === 0) blueprint.push({hp:Math.floor((18 + n*6)*diff*hpMul) + endlessBoost*10, speed:(32 + n*3)*spMul, worth:Math.floor(8*worthMul)});
    else if(i % 5 === 0) blueprint.push({hp:Math.floor((10 + n*3)*diff*hpMul) + endlessBoost*6, speed:(70 + n*4)*spMul, worth:Math.floor(4*worthMul)});
    else {
  let stealth = (n>=3) && (i % 9 === 0);
  // mutator-added stealth; prefer seeded RNG when available
  if((State.rng && State.rng.random && State.rng.random() < stealthAdd) || (!State.rng && Math.random()<stealthAdd)) stealth = true;
      blueprint.push({hp:Math.floor((8 + n*2)*diff*hpMul) + endlessBoost*5, speed:(50 + n*3)*spMul, worth: stealth?Math.floor(4*worthMul):Math.floor(3*worthMul), stealth});
    }
  }
  // Duplicate per route so each route gets the full wave composition
  const rc = Math.max(1, getRouteCount());
  for(let i=0;i<blueprint.length;i++){
    for(let r=0;r<rc;r++){
      const s = blueprint[i];
      State.spawnQueue.push({hp:s.hp, speed:s.speed, worth:s.worth, boss:!!s.boss, immuneSlow:!!s.immuneSlow, stealth:!!s.stealth, routeIndex:r});
    }
  }
  // Spawn cadence: shorter roundSeconds => tätare spawns
  const paceTimer = Math.max(0.35, Math.min(1.0, (MapSettings.roundSeconds||25)/25 * 0.6));
  State.spawnTimer = paceTimer * spawnMul; // seconds; scaled in update
}

export function handleSpawning(dt){
  if(State.spawnQueue.length>0){
    State.spawnTimer -= dt * Settings.gameSpeed;
    if(State.spawnTimer <= 0){
      const s = State.spawnQueue.shift();
      const e = new Enemy(s.hp,s.speed,s.worth);
      const rc = getRouteCount();
      // Use explicit routeIndex if provided; else round-robin
      if(typeof s.routeIndex==='number'){
        e.pathIndex = Math.max(0, Math.min(rc-1, s.routeIndex));
      } else if(rc>1){
        const spawned = (State._spawnedCount||0); e.pathIndex = spawned % rc; State._spawnedCount = spawned + 1;
      } else { e.pathIndex = 0; }
      // Slightly vary lane for variety when multiple starts
      if(rc>1){ const r=(State.rng?.random?.()||Math.random()); e.lane = (r<0.33?-1:(r<0.66?0:1)) * 6; }
      if(s.stealth){ e.stealth=true; }
      if(s.boss){ e.boss=true; }
      if(s.immuneSlow){ e.immuneSlow=true; }
      State.enemies.push(e);
      State.spawnTimer = 0.7;
    }
  } else if(State.waveInProgress && State.enemies.length===0){ State.waveInProgress=false; }
}

export function previewNextWave(n){
  // Return a small composition summary for UI: counts of types
  const diff = Math.max(1, MapSettings.difficulty||1);
  const endlessBoost = MapSettings.endless ? Math.floor(n/5) : 0;
  const count = Math.floor((6 + n*3) * (0.9 + 0.1*diff)) + endlessBoost;
  let comp = { basic:0, fast:0, heavy:0, slime:0, stealth:0, boss:0 };
  for(let i=0;i<count;i++){
    if(i % 13 === 0){ comp.slime++; }
    else if(i % 17 === 0){ comp.boss++; }
    else if(i % 7 === 0){ comp.heavy++; }
    else if(i % 5 === 0){ comp.fast++; }
    else { if((n>=3) && (i%9===0)) comp.stealth++; else comp.basic++; }
  }
  return comp;
}
