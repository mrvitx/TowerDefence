export let TOWER_TYPES = {
  cannon: {id:'cannon',label:'Kanon', cost:40, range:100, dmg:6, fireRate:0.9, sellFactor:0.7, color:'#7f5', builtIn:true},
  rapid:  {id:'rapid', label:'Snabb', cost:70, range:80, dmg:2, fireRate:0.25, sellFactor:0.7, color:'#59f', builtIn:true},
  splash: {id:'splash', label:'Splash', cost:90, range:70, dmg:4, fireRate:1.6, aoe:28, sellFactor:0.7, color:'#f9a', builtIn:true},
  frost:  {id:'frost',  label:'Frost', cost:85, range:90, dmg:1, fireRate:0.6, slow:0.6, slowTime:1.6, sellFactor:0.7, color:'#9ef', builtIn:true},
  poison: {id:'poison', label:'Poison', cost:80, range:85, dmg:1, fireRate:0.15, dot:2, dotTime:2.5, sellFactor:0.7, color:'#6f6', builtIn:true},
  chain:  {id:'chain',  label:'Kedja', cost:110, range:95, dmg:8, fireRate:0.7, chain:{max:4, range:120, falloff:0.7}, sellFactor:0.7, color:'#bdf', builtIn:true},
  spotter:{id:'spotter',label:'Observatör', cost:90, range:110, dmg:0, fireRate:0.6, mark:{mult:1.2, duration:2.5}, reveal:true, sellFactor:0.7, color:'#ffb', builtIn:true},
  bank:   {id:'bank',   label:'Bank',  cost:120, range:0,   dmg:0, fireRate:1.5, income:15, sellFactor:0.7, color:'#fc6', builtIn:true}
};

export function addTowerType(def){
  const id = (def.id||def.label||'tower').toLowerCase();
  if(TOWER_TYPES[id]) return false;
  TOWER_TYPES[id] = { id, label:def.label||id, cost:def.cost||50, range:def.range||80, dmg:def.dmg||5, fireRate:def.fireRate||1, color:def.color||'#ccc', sellFactor:def.sellFactor??0.7, aoe:def.aoe };
  return true;
}

// Ensure essentials exist even if external settings removed them
export function ensureBuiltInTowers(){
  const builtIns = [
    TOWER_TYPES.cannon,
    TOWER_TYPES.rapid,
    TOWER_TYPES.splash,
    TOWER_TYPES.frost,
    TOWER_TYPES.poison,
    TOWER_TYPES.chain,
    TOWER_TYPES.spotter,
    TOWER_TYPES.bank,
  ];
  for(const def of builtIns){ if(!def) continue; TOWER_TYPES[def.id] = { ...def, builtIn:true }; }
}
