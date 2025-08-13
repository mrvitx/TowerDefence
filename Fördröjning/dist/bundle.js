/* Minimal non-module fallback to ensure local file open works */
(function(){
  window.__TD_BOOTED = true;
  // Read persisted settings from START.html (file:// compatible)
  var settingsRaw = null; try{ settingsRaw = JSON.parse(localStorage.getItem('td-settings-v1')||'{}') }catch(e){}
  var _Map = (settingsRaw && settingsRaw.MapSettings) || { preset:'ring', difficulty:1, endless:false };
  // Apply defaults for new map economy/progression fields
  if(_Map.bankIncomeCap==null) _Map.bankIncomeCap = 200;
  if(_Map.bankCapSoftness==null) _Map.bankCapSoftness = 0.5;
  if(_Map.act1End==null) _Map.act1End = 10;
  if(_Map.act2End==null) _Map.act2End = 20;
  var _Set = (settingsRaw && settingsRaw.Settings) || { buildMode:'paint', maxSpeed:5 };
  var _Vis = (settingsRaw && settingsRaw.Visuals) || { pathWidth:24, showGrid:true };
  var _Admin = (settingsRaw && settingsRaw.Admin) || { startMoney:100, startLives:10, upgCost:{dmg:30,range:25,rate:35} };

  const TILE=40;
  function iconSize(){ return Math.max(20, Math.floor(TILE * ( (Visuals && typeof Visuals._tiScale==='number') ? Visuals._tiScale : 1.0 ))); }
  try{ window.__TD_ICON_SIZE = iconSize(); }catch(_e){}
  let Visuals = {
    pathWidth: _Vis.pathWidth||24,
    showGrid: _Vis.showGrid!==false,
    showAllRanges: !!(_Vis && _Vis.showAllRanges),
    showDps: !!(_Vis && _Vis.showDps),
    colorblindMode: !!(_Vis && _Vis.colorblindMode),
    reducedMotion: !!(_Vis && _Vis.reducedMotion),
    // UI theme + styling
    _accent: _Vis._accent || null,
    _radius: (typeof _Vis._radius==='number') ? _Vis._radius : null,
    _scale: (typeof _Vis._scale==='number') ? _Vis._scale : null,
  _tiScale: (typeof _Vis._tiScale==='number') ? _Vis._tiScale : 1.0,
    _compact: !!_Vis._compact,
    theme: _Vis.theme || 'dim'
  };
  const defaultHotkeys = { startWave:' ', pause:'p', speedUp:'+', speedDown:'-', toggleRanges:'r', toggleDps:'d', sellAll:'Delete', skills:'k', admin:'F12', restart:null, menu:'m', select1:'1', select2:'2', select3:'3', upgradeDamage:'u', cancel:'Escape', undo:'z' };
  let Settings={gameSpeed:1,maxSpeed:_Set.maxSpeed||5, buildMode: _Set.buildMode||'paint', hotkeys: { ...(defaultHotkeys), ...(_Set.hotkeys||{}) } };
  function persistSettings(part){ try{ var raw=JSON.parse(localStorage.getItem('td-settings-v1')||'{}'); if(part==='Visuals'){ raw.Visuals = { ...(raw.Visuals||{}), ...Visuals }; } else if(part==='Settings'){ raw.Settings = { ...(raw.Settings||{}), maxSpeed:Settings.maxSpeed, buildMode:Settings.buildMode, hotkeys:Settings.hotkeys }; } raw.ts=Date.now(); localStorage.setItem('td-settings-v1', JSON.stringify(raw)); }catch(e){} }
  let Admin={ startMoney: _Admin.startMoney||100, startLives: _Admin.startLives||10, upgCost: _Admin.upgCost||{dmg:30,range:25,rate:35} };
  const canvas=document.getElementById('canvas'); if(!canvas)return; const ctx=canvas.getContext('2d');
  const overlay=document.getElementById('towerOverlay');
  // Apply theme variables early from persisted Visuals
  try{
    const THEMES_BOOT = {
      light: { '--bg':'#f5f7fb','--panel':'#ffffff','--panel2':'#f7f9fc','--edge':'#d6dbe7','--txt':'#0b1020','--muted':'#5c6680','--btn2':'#dde3f0','--accent':'#3b82f6' },
      dim:   { '--bg':'#0f0f10','--panel':'#151515','--panel2':'#101010','--edge':'#2a2a2a','--txt':'#eeeeee','--muted':'#aaaaaa','--btn2':'#3a3a3a','--accent':'#2d6' },
      neon:  { '--bg':'#0a0b14','--panel':'#0f1022','--panel2':'#0c0d1a','--edge':'#1b1c2b','--txt':'#e7f0ff','--muted':'#8ea2c6','--btn2':'#1b1e34','--accent':'#00e5ff' }
    };
    const theme = Visuals.theme || 'dim';
    const base = THEMES_BOOT[theme] || THEMES_BOOT.dim;
    for(const k in base){ document.documentElement.style.setProperty(k, base[k]); }
    if(Visuals._accent){ document.documentElement.style.setProperty('--accent', Visuals._accent); }
    if(typeof Visuals._radius==='number'){ document.documentElement.style.setProperty('--radius', Visuals._radius+'px'); }
    if(typeof Visuals._scale==='number'){ document.documentElement.style.setProperty('--ui-scale', String(Visuals._scale)); }
    if(Visuals._compact){ document.body && document.body.classList.add('hud-compact'); }
  }catch(_e){}
  const moneyEl=document.getElementById('money'), livesEl=document.getElementById('lives'), waveEl=document.getElementById('wave'), speedLbl=document.getElementById('speedLbl');
  const incomeEl=document.getElementById('income');
  const skillPtsEl=document.getElementById('skillPts');
  const startWaveBtn=document.getElementById('startWave'), sellAllBtn=document.getElementById('sellAll'), btnSpeed=document.getElementById('btnSpeed');
  const btnPause=document.getElementById('btnPause');
  const btnRanges=document.getElementById('btnRanges');
  const btnDps=document.getElementById('btnDps');
  const btnSettings=document.getElementById('btnSettings');
  const towerBtns=document.getElementById('towerBtns');
  const selInfo=document.getElementById('selInfo'), upgControls=document.getElementById('upgControls');
  if(upgControls){ upgControls.classList.add('hidden'); }
  const upgDmg=document.getElementById('upgDmg'), upgRange=document.getElementById('upgRange'), upgRate=document.getElementById('upgRate'), sellBtn=document.getElementById('sellBtn');
  const admin=document.getElementById('admin');
  const adminStartMoney=document.getElementById('adminStartMoney');
  const adminStartLives=document.getElementById('adminStartLives');
  const adminMaxSpeed=document.getElementById('adminMaxSpeed');
  const newName=document.getElementById('newName'), newCost=document.getElementById('newCost'), newRange=document.getElementById('newRange'), newDmg=document.getElementById('newDmg'), newRate=document.getElementById('newRate'), newColor=document.getElementById('newColor');
  const btnAddTower=document.getElementById('btnAddTower'), costDmg=document.getElementById('costDmg'), costRange=document.getElementById('costRange'), costRate=document.getElementById('costRate'), applyAdmin=document.getElementById('applyAdmin'), closeAdmin=document.getElementById('closeAdmin');
  const path=[]; const Routes=[]; const COLS=Math.floor(canvas.width/TILE); const ROWS=Math.floor(canvas.height/TILE);
  // Active environment (Matrix effects, bridges) for fallback runtime
  let ActiveEnv = null;
  // Apply high-contrast UI class early
  try{ if(Visuals.colorblindMode){ document.documentElement.classList.add('td-hc'); document.body && document.body.classList.add('td-hc'); } }catch(_e){}
  // Bygg endast path från localStorage (td-maps-v1) och ta bort all preset/hårdkodad logik
  // Om ingen karta finns i localStorage, skapa och spara en default "ring"-karta
  let mapFound = false;
  try {
    let mapsRaw = localStorage.getItem('td-maps-v1');
    let maps = [];
    if (mapsRaw) {
      maps = JSON.parse(mapsRaw) || [];
    }
    // Om inga maps finns, skapa två default‑kartor (ring och maze) med id
    if (!maps || !Array.isArray(maps) || maps.length === 0) {
      // Bygg klassisk ring-bana
      const ring = [];
      for(let i=0;i<COLS;i++) ring.push({x:i*TILE+TILE/2,y:TILE*1.5});
      for(let r=2;r<ROWS-2;r++) ring.push({x:(COLS-1)*TILE+TILE/2,y:r*TILE+TILE/2});
      for(let i=COLS-1;i>=0;i--) ring.push({x:i*TILE+TILE/2,y:(ROWS-2)*TILE+TILE/2});
      // Enkel "maze"-orm som snokar varje rad
      const maze = [];
      for(let r=1;r<ROWS-1;r++){
        if((r%2)===1){ for(let c=1;c<COLS-1;c++) maze.push({x:c*TILE+TILE/2, y:r*TILE+TILE/2}); }
        else { for(let c=COLS-2;c>=1;c--) maze.push({x:c*TILE+TILE/2, y:r*TILE+TILE/2}); }
      }
      maps = [
        { id: 'ring', name: 'ring', type:'default', points: ring },
        { id: 'maze', name: 'maze', type:'default', points: maze }
      ];
      localStorage.setItem('td-maps-v1', JSON.stringify(maps));
    }
    // Försök hitta rätt karta (sök primärt på id, fallback på name)
    const sel = _Map && _Map.preset;
    const found = maps.find(function(m){
      if(!m) return false;
      const idMatch = (m.id && m.id === sel);
      const nameMatch = (!idMatch && m.name && m.name === sel);
      const hasPoints = Array.isArray(m.points) && m.points.length>1;
      const hasRoutes = Array.isArray(m.routes) && m.routes.length>0 && Array.isArray(m.routes[0] && m.routes[0].points) && m.routes[0].points.length>1;
      return (idMatch || nameMatch) && (hasPoints || hasRoutes);
    });
    // Hämta punkter från points eller routes[0].points
    const pts = (found && Array.isArray(found.points) && found.points.length>1)
      ? found.points
      : (found && Array.isArray(found.routes) && found.routes[0] && Array.isArray(found.routes[0].points) ? found.routes[0].points : null);
    if (pts && pts.length > 1) {
      for (const pt of pts) {
        if (typeof pt.x === 'number' && typeof pt.y === 'number') path.push({x: pt.x, y: pt.y});
      }
      // Collect all routes for rendering/build-blocking
      try{
        if(found && Array.isArray(found.routes)){
          for(var ri=0; ri<found.routes.length; ri++){
            var rr = found.routes[ri]; var arr = rr && rr.points; if(Array.isArray(arr) && arr.length>1){
              var pts2=[]; for(var k=0;k<arr.length;k++){ var p=arr[k]; if(p&&typeof p.x==='number'&&typeof p.y==='number') pts2.push({x:p.x,y:p.y}); }
              if(pts2.length>1) Routes.push({ points: pts2, start: pts2[0], goal: pts2[pts2.length-1] });
            }
          }
        } else if(found && Array.isArray(found.points) && found.points.length>1){
          Routes.push({ points: path.slice(), start: path[0], goal: path[path.length-1] });
        }
      }catch(_e){}
      mapFound = path.length > 1;
      // Per‑map overrides (partial support in fallback)
      try{
        if(found && found.settings){
          if(typeof found.settings.pathWidth==='number'){ Visuals.pathWidth = Math.max(8, Math.min(64, found.settings.pathWidth|0)); }
          if(typeof found.settings.startMoney==='number'){ Admin.startMoney = Math.max(0, found.settings.startMoney|0); }
          if(typeof found.settings.startLives==='number'){ Admin.startLives = Math.max(1, found.settings.startLives|0); }
          if(typeof found.settings.endless==='boolean'){ /* used later in wave logic if present */ }
        }
        // Load environment (Matrix, bridges) if present
        if(found && found.environment){
          ActiveEnv = JSON.parse(JSON.stringify(found.environment));
        } else { ActiveEnv = null; }
      }catch(_e){}
    }
  } catch (e) {}
  if (!mapFound) {
    // Visa felmeddelande och stoppa spelet om ingen karta hittas
    alert('Ingen giltig karta hittades i localStorage för id/namn: ' + (_Map && _Map.preset) + '\nSkapa och spara en karta i ADMIN.html!');
    throw new Error('Ingen giltig karta hittades i localStorage.');
  }
  function dist(a,b){return Math.hypot(a.x-b.x,a.y-b.y)}
  // Default towers, then merge persisted ones
  let TOWER_TYPES={
    cannon:{id:'cannon',label:'Kanon',cost:40,range:100,dmg:6,fireRate:0.9,sellFactor:0.7,color:'#7f5'},
    rapid:{id:'rapid',label:'Snabb',cost:70,range:80,dmg:2,fireRate:0.25,sellFactor:0.7,color:'#59f'},
    splash:{id:'splash',label:'Splash',cost:90,range:70,dmg:4,fireRate:1.6,aoe:28,sellFactor:0.7,color:'#f9a'},
    frost:{id:'frost',label:'Frost',cost:85,range:90,dmg:1,fireRate:0.6,slow:0.6,slowTime:1.6,sellFactor:0.7,color:'#9ef'},
    poison:{id:'poison',label:'Poison',cost:80,range:85,dmg:1,fireRate:0.15,dot:2,dotTime:2.5,sellFactor:0.7,color:'#6f6'},
    chain:{id:'chain',label:'Kedja',cost:110,range:95,dmg:8,fireRate:0.7,chain:{max:4,range:120,falloff:0.7},sellFactor:0.7,color:'#bdf'},
  spotter:{id:'spotter',label:'Observatör',cost:90,range:110,dmg:0,fireRate:0.6,mark:{mult:1.2,duration:2.5},reveal:true,sellFactor:0.7,color:'#ffb'},
  bank:{id:'bank',label:'Bank',cost:120,range:0,dmg:0,fireRate:1.5,income:15,sellFactor:0.7,color:'#fc6'},
  // New towers
  sniper:{id:'sniper',label:'Sniper',cost:140,range:220,dmg:28,fireRate:2.2,sellFactor:0.7,color:'#ddd'},
  laser:{id:'laser',label:'Laser',cost:130,range:120,dmg:4,fireRate:0.12,sellFactor:0.7,color:'#0ff'},
  rocket:{id:'rocket',label:'Raket',cost:160,range:150,dmg:10,fireRate:1.8,aoe:42,sellFactor:0.7,color:'#f84'},
  flame:{id:'flame',label:'Flamma',cost:120,range:90,dmg:0.5,fireRate:0.08,dot:3,dotTime:2.0,sellFactor:0.7,color:'#fa4'},
  mortar:{id:'mortar',label:'Mortel',cost:180,range:200,dmg:12,fireRate:2.6,aoe:56,sellFactor:0.7,color:'#bbb'}
  };
  if(settingsRaw && settingsRaw.TOWER_TYPES){
    try{ for(const id in settingsRaw.TOWER_TYPES){ TOWER_TYPES[id] = { ...(TOWER_TYPES[id]||{}), ...settingsRaw.TOWER_TYPES[id], id }; } }catch(e){}
  }
  let State={money:Admin.startMoney,lives:Admin.startLives,currentWave:0,waveInProgress:false,enemies:[],towers:[],projectiles:[],spawnQueue:[],spawnTimer:0,lastRoundIncome:0,lastPayoutWave:0,bountyBoostNext:0,bountyBoostActive:false};
  // Unlock rules per tower id (simple wave-based unlocks)
  const UNLOCKS = {
    sniper: { wave: 4, note: 'Våg ≥ 4' },
    laser:  { wave: 3, note: 'Våg ≥ 3' },
    rocket: { wave: 6, note: 'Våg ≥ 6' },
    flame:  { wave: 5, note: 'Våg ≥ 5' },
    mortar: { wave: 7, note: 'Våg ≥ 7' }
  };
  function towerIdFromName(name){ name=String(name||'').toLowerCase(); for(const id in TOWER_TYPES){ const d=TOWER_TYPES[id]; const lab=String((d&&d.label)||'').toLowerCase(); if(lab===name||id===name) return id; } return name; }
  function isLockedByWave(id){ const rule=UNLOCKS[id]; if(!rule) return null; const need=rule.wave||0; const ok = (State.currentWave||0) >= need; return ok? null : (rule.note||('Våg ≥ '+need)); }
  try{ window.__TD_IS_LOCKED = function(name){ try{ const id=towerIdFromName(name); const reason=isLockedByWave(id); return reason? {locked:true, reason} : {locked:false}; }catch(_e){ return {locked:false}; } }; }catch(_e){}
  // Map tower name/id to an icon symbol id from SPEL.HTML
  function iconForTower(def){
    try{
      if(window.__TD_ICON_FOR) return window.__TD_ICON_FOR(def && (def.label||def.id||''));
    }catch(_e){}
    const n = String((def&&def.label)||def&&def.id||'').toLowerCase();
    if(/sniper|precision|prick/.test(n)) return 'i-sniper';
    if(/laser|beam|stråle/.test(n)) return 'i-laser';
    if(/flame|eld|fire|bränn/.test(n)) return 'i-flame';
    if(/shock|chain|blixt|tesla|kedja/.test(n)) return 'i-lightning2';
    if(/poison|acid|gift/.test(n)) return 'i-poison';
    if(/freeze|ice|frost/.test(n)) return 'i-freeze';
    if(/splash|aoe|bomb|splas/.test(n)) return 'i-splash';
    if(/rocket|missile|raket/.test(n)) return 'i-rocket';
  if(/mortar|mortel/.test(n)) return 'i-rocket';
    if(/bank|income|farm|ekonomi|peng|guld/.test(n)) return 'i-bank';
    if(/buff|aura|support|stöd/.test(n)) return 'i-buff';
    if(/mine|trap|min/.test(n)) return 'i-mine';
    return 'i-cannon';
  }
  let Skills={
    points: (settingsRaw&&settingsRaw.Skills&&settingsRaw.Skills.points)||0,
    dmgMul: (settingsRaw&&settingsRaw.Skills&&settingsRaw.Skills.dmgMul)||1,
    rangeMul: (settingsRaw&&settingsRaw.Skills&&settingsRaw.Skills.rangeMul)||1,
    critAdd: (settingsRaw&&settingsRaw.Skills&&settingsRaw.Skills.critAdd)||0,
    bankMul: (settingsRaw&&settingsRaw.Skills&&settingsRaw.Skills.bankMul)||1,
    bountyMul: (settingsRaw&&settingsRaw.Skills&&settingsRaw.Skills.bountyMul)||1
  };
  function saveSkills(){ try{ var raw=JSON.parse(localStorage.getItem('td-settings-v1')||'{}'); raw.Skills={ points:Skills.points||0, dmgMul:Skills.dmgMul||1, rangeMul:Skills.rangeMul||1, critAdd:Skills.critAdd||0, bankMul:Skills.bankMul||1, bountyMul:Skills.bountyMul||1 }; raw.ts=Date.now(); localStorage.setItem('td-settings-v1', JSON.stringify(raw)); }catch(e){} }
  class Enemy{constructor(hp,speed,worth,route){this.hp=hp;this.maxHp=hp;this.speed=speed;this.worth=worth;this.route=Array.isArray(route)&&route.length>1?route:path;this.pathIndex=0;this.pos={...this.route[0]};this.reached=false;this.slow=1;this._slowUntil=0;this._poison=null;this._markedUntil=0;this._revealedUntil=0;this.stealth=false;this.immuneSlow=false;this.boss=false;}update(dt){if(this.reached)return;const now=performance.now();if(this._slowUntil&&now>=this._slowUntil){this.slow=1;this._slowUntil=0}if(this._poison){this.hp-=this._poison.dps*dt;if(now>=this._poison.until)this._poison=null}let remaining=dt*Settings.gameSpeed*this.slow;const R=this.route;while(remaining>0&&!this.reached){const target=R[this.pathIndex+1]||R[this.pathIndex];const dx=target.x-this.pos.x,dy=target.y-this.pos.y;const d=Math.hypot(dx,dy)||1e-6;const step=Math.min(remaining*this.speed,d);this.pos.x+=dx/d*step;this.pos.y+=dy/d*step;remaining-=step/this.speed;if(step>=d-1e-6){if(this.pathIndex<R.length-1)this.pathIndex++;else{this.reached=true;}}}}draw(ctx){const now=performance.now();const isRev=(this._revealedUntil||0)>now;const r=this.boss?16:12;ctx.save();if(this.stealth&&!isRev){ctx.globalAlpha=0.35}ctx.fillStyle=this.boss?(Visuals.colorblindMode?'#7d3cff':'#a3c'):(Visuals.colorblindMode?'#ff6b6b':'#c33');ctx.beginPath();ctx.arc(this.pos.x,this.pos.y,r,0,Math.PI*2);ctx.fill();const w=26,hpPct=Math.max(0,Math.min(1,this.hp/this.maxHp));ctx.fillStyle='#000';ctx.fillRect(this.pos.x-w/2,this.pos.y-18,w,4);ctx.fillStyle=Visuals.colorblindMode?'#00d3ff':'#4caf50';ctx.fillRect(this.pos.x-w/2,this.pos.y-18,w*hpPct,4);ctx.restore();}}
  class Tower{constructor(x,y,def){this.x=x;this.y=y;this.type=def.id;this.def=JSON.parse(JSON.stringify(def));this.timer=0;this.levels={dmg:0,range:0,rate:0};this.targetMode='first';this._manualTarget=null;this._dmgLog=[];
      // Create DOM icon to represent this tower visually (replaces old canvas disc)
      try{
        if(overlay){
          const iconId = iconForTower(def);
          const node = document.createElement('div');
          const cr = canvas.getBoundingClientRect();
          const or = overlay.getBoundingClientRect();
          const s = (cr.width/ canvas.width) || 1;
          const cs = getComputedStyle(canvas);
          const bL = parseFloat(cs.borderLeftWidth)||0;
          const bT = parseFloat(cs.borderTopWidth)||0;
          node.style.position='absolute';
          node.style.left = ((cr.left - or.left) + bL + this.x * s) + 'px';
          node.style.top  = ((cr.top  - or.top ) + bT + this.y * s) + 'px';
          node.style.transform='translate(-50%, -50%)';
          const sPx = (cr.width/ canvas.width) || 1;
          const px = Math.round(iconSize() * sPx);
          node.innerHTML = '<svg viewBox="0 0 24 24" width="'+px+'" height="'+px+'" style="fill:var(--accent);filter:drop-shadow(0 0 1px rgba(0,0,0,.5))"><use href="#'+iconId+'" xlink:href="#'+iconId+'"/></svg>';
          overlay.appendChild(node);
          this._node = node;
        }
      }catch(_e){}
    }getStats(){let dmg=this.def.dmg*(1+0.5*this.levels.dmg);let range=this.def.range+10*this.levels.range;const fireRate=Math.max(0.05,this.def.fireRate*(1-0.12*this.levels.rate));dmg*=((Skills&&Skills.dmgMul)||1);range*=((Skills&&Skills.rangeMul)||1);return{dmg,range,fireRate}}update(dt){this.timer-=dt*Settings.gameSpeed;const stats=this.getStats();if(this.timer<=0){let target=null;const now=performance.now();
      // prune old dmg logs
      if(this._dmgLog && this._dmgLog.length){ const cutoff=now-5000; let i=0; while(i<this._dmgLog.length && this._dmgLog[i].t<cutoff) i++; if(i>0) this._dmgLog=this._dmgLog.slice(i); }
      // Prefer manual focus if valid
      if(this._manualTarget && !this._manualTarget.reached && this._manualTarget.hp>0){ const md=dist({x:this.x,y:this.y}, this._manualTarget.pos); if(md<=stats.range){ if(!(this._manualTarget.stealth && (this._manualTarget._revealedUntil||0)<=now && !this.def.reveal)) target=this._manualTarget; } }
      // Select target by mode
      if(!target){
        let bestVal = (this.targetMode==='last')?1e9:-1e9; let best=null;
        for(const e of State.enemies){ if(e.reached) continue; if(e.stealth && (e._revealedUntil||0)<=now && !this.def.reveal) continue; const d=dist({x:this.x,y:this.y},e.pos); if(d>stats.range) continue; let score=0;
          if(this.targetMode==='strong') score = e.hp;
          else if(this.targetMode==='close') score = -d; // higher is better, so invert distance
          else if(this.targetMode==='last') score = -(e.pathIndex||0);
          else score = (e.pathIndex||0); // 'first'
          if(this.targetMode==='last'){ if(score<bestVal){ bestVal=score; best=e; } }
          else{ if(score>bestVal){ bestVal=score; best=e; } }
        }
        target = best;
      }
  if(target){const mult=((target._markedUntil||0)>now)?1.2:1.0;if(this.def.aoe)State.projectiles.push(new Projectile(this.x,this.y,target,stats.dmg*mult,'splash',this.def.aoe,this));else if(this.def.slow)State.projectiles.push(new Projectile(this.x,this.y,target,stats.dmg*mult,'frost',0,this));else if(this.def.dot){const p=new Projectile(this.x,this.y,target,stats.dmg*mult,'poison',0,this);p.dotDps=this.def.dot;p.dotTime=(this.def.dotTime||2.5)*1000;State.projectiles.push(p);}else if(this.def.chain){const p=new Projectile(this.x,this.y,target,stats.dmg*mult,'chain',0,this);p.chain=this.def.chain;State.projectiles.push(p);}else if(this.def.mark){const p=new Projectile(this.x,this.y,target,0,'mark',0,this);p.mark=this.def.mark;p.reveal=!!this.def.reveal;State.projectiles.push(p);}else State.projectiles.push(new Projectile(this.x,this.y,target,stats.dmg*mult,'bullet',0,this));this.timer=stats.fireRate}}}draw(ctx){/* replaced old canvas disc with DOM SVG icon via this._node; keep draw as no-op */}}
  class Projectile{constructor(x,y,target,dmg,type='bullet',aoe=0,source=null){this.x=x;this.y=y;this.target=target;this.dmg=dmg;this.type=type;this.aoe=aoe;this.speed=520;this.hit=false;this.lost=false;this.source=source}update(dt){if(!this.target||this.target.reached||this.target.hp<=0){this.lost=true;return}const dx=this.target.pos.x-this.x,dy=this.target.pos.y-this.y;const d=Math.hypot(dx,dy);if(d<6){const now=performance.now();const log=(amt)=>{ if(this.source&&amt>0){ this.source._dmgLog = this.source._dmgLog||[]; this.source._dmgLog.push({t:now,dmg:amt}); } };
      if(this.type==='splash'){
        for(const e of State.enemies){ if(dist(e.pos,this.target.pos)<=this.aoe){ e.hp-=this.dmg; log(this.dmg); } }
      }else if(this.type==='frost'){
        this.target.hp-=this.dmg; log(this.dmg); if(!this.target.immuneSlow){this.target.slow=Math.min(this.target.slow,0.6);this.target._slowUntil=Math.max(this.target._slowUntil||0,now+1600);} 
      }else if(this.type==='poison'){
        this.target.hp-=this.dmg; log(this.dmg); const dps=this.dotDps||2;const until=now+(this.dotTime||2500);this.target._poison={dps,until:Math.max(until,(this.target._poison&&this.target._poison.until)||0)}
      }else if(this.type==='chain'){
        this.target.hp-=this.dmg; log(this.dmg); let prev=this.target;let remain=Math.max(0,(this.chain&&this.chain.max||0)-1);let dmg=this.dmg;const range=(this.chain&&this.chain.range)||100;const fall=(this.chain&&this.chain.falloff)||0.7;const used=new Set([prev]);while(remain>0){let best=null,bestD=1e9;for(const e of State.enemies){if(!e||e.reached||used.has(e))continue;const dd=dist(prev.pos,e.pos);if(dd<=range&&dd<bestD){best=e;bestD=dd}}if(!best)break;dmg*=fall;best.hp-=dmg; log(dmg); used.add(best);prev=best;remain--;}
      }else if(this.type==='mark'){
        const dur=(this.mark&&this.mark.duration)||2.5;this.target._markedUntil=Math.max(this.target._markedUntil||0,now+dur*1000);if(this.reveal)this.target._revealedUntil=Math.max(this.target._revealedUntil||0,now+dur*1000);
      }else{
        this.target.hp-=this.dmg; log(this.dmg);
      }
      this.hit=true;return}
  const step=this.speed*dt*Settings.gameSpeed;this.x+=dx/d*step;this.y+=dy/d*step}draw(ctx){let col='#ffd';if(this.type==='splash')col=Visuals.colorblindMode?'#ff1493':'#faa';if(this.type==='frost')col=Visuals.colorblindMode?'#00bfff':'#9ef';if(this.type==='poison')col=Visuals.colorblindMode?'#7cfc00':'#9f9';if(this.type==='chain')col=Visuals.colorblindMode?'#ff8c00':'#cdf';if(this.type==='mark')col=Visuals.colorblindMode?'#ffffff':'#ffb';ctx.fillStyle=col;ctx.beginPath();ctx.arc(this.x,this.y,4,0,Math.PI*2);ctx.fill()}}
  function drawGrid(){ if(!Visuals.showGrid) return; ctx.strokeStyle=Visuals.colorblindMode?'#222':'#131313';ctx.lineWidth=1;for(let x=0;x<canvas.width;x+=TILE){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,canvas.height);ctx.stroke()}for(let y=0;y<canvas.height;y+=TILE){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(canvas.width,y);ctx.stroke()} }
  function drawPath(){
    // Draw non-primary routes dimmed
    if(Routes && Routes.length>0){
      for(var ri=0;ri<Routes.length;ri++){
        var rp = Routes[ri].points; if(!rp || rp.length<2) continue;
        // skip the primary if identical to path
        if(rp===path) continue; if(rp.length===path.length && rp[0]&&path[0]&&rp[0].x===path[0].x&&rp[0].y===path[0].y) continue;
        ctx.save();
        ctx.strokeStyle = Visuals.colorblindMode?'#2f2f2f':'#232323';
        ctx.lineCap='round'; ctx.lineJoin='round';
        ctx.lineWidth = Math.max(8,(Visuals.pathWidth||24)*0.9);
        ctx.beginPath(); ctx.moveTo(rp[0].x, rp[0].y); for(var ii=1;ii<rp.length;ii++){ var p=rp[ii]; ctx.lineTo(p.x,p.y);} ctx.stroke();
        ctx.globalAlpha = 0.4; ctx.strokeStyle='rgba(255,255,255,0.08)'; ctx.lineWidth=Math.max(4,(Visuals.pathWidth||24)*0.5);
        ctx.beginPath(); ctx.moveTo(rp[0].x, rp[0].y); for(var jj=1;jj<rp.length;jj++){ var p2=rp[jj]; ctx.lineTo(p2.x,p2.y);} ctx.stroke();
        ctx.restore();
      }
    }
    // Draw primary route (path)
    ctx.strokeStyle=Visuals.colorblindMode?'#3a3a3a':'#2a2a2a';ctx.lineWidth=Visuals.pathWidth||24;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(path[0].x,path[0].y);for(const p of path){ctx.lineTo(p.x,p.y)}ctx.stroke();
    // Start/Goal markers for all routes
    var r=Math.max(10, Math.min(18, Math.floor(((Visuals.pathWidth||24))*0.45)));
    function drawMarkers(s,g,primary){
      // Start
      ctx.beginPath(); ctx.arc(s.x,s.y, r*(primary?1:0.85),0,Math.PI*2);
      ctx.fillStyle=primary?(Visuals.colorblindMode?'#00c853':'#1e8e3e'):'rgba(30,142,62,0.7)'; ctx.fill(); ctx.lineWidth=3; ctx.strokeStyle='#fff'; if(primary) ctx.stroke();
      ctx.fillStyle='#fff'; ctx.font=`${Math.max(9, Math.floor(r*(primary?0.9:0.75)))}px system-ui`; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('S', s.x, s.y+1);
      // Goal
      ctx.lineWidth=3; ctx.strokeStyle='#fff'; if(primary){ ctx.beginPath(); ctx.arc(g.x,g.y,r+4,0,Math.PI*2); ctx.stroke(); }
      ctx.strokeStyle=Visuals.colorblindMode?'#ffab00':'#c5221f'; ctx.beginPath(); ctx.arc(g.x,g.y, r*(primary?1:0.85),0,Math.PI*2); ctx.stroke();
      ctx.beginPath(); ctx.arc(g.x,g.y, Math.max(4,Math.floor(r*(primary?0.45:0.38))),0,Math.PI*2); ctx.fillStyle=Visuals.colorblindMode?'#ffab00':'#c5221f'; ctx.fill();
    }
    if(path.length>1){ drawMarkers(path[0], path[path.length-1], true); }
    if(Routes && Routes.length>0){
      for(var rk=0; rk<Routes.length; rk++){
        var s=Routes[rk].start, g=Routes[rk].goal; if(!s||!g) continue;
        // Skip duplicate of primary
        if(path.length>1 && s.x===path[0].x && s.y===path[0].y && g.x===path[path.length-1].x && g.y===path[path.length-1].y) continue;
        drawMarkers(s,g,false);
      }
    }
  }
  function isOnPath(x,y){
    // Allow building on bridge rectangles
    try{
      if(ActiveEnv && Array.isArray(ActiveEnv.bridges)){
        for(const b of ActiveEnv.bridges){ if(x>=b.x && x<=b.x+b.w && y>=b.y && y<=b.y+b.h) return false; }
      }
    }catch(_e){}
    const r=(Visuals.pathWidth||24)/2;
    // Check primary path
    for(const p of path){ if(Math.hypot(p.x-x,p.y-y)<r+6) return true; }
    // Check additional routes
    if(Routes && Routes.length){
      for(var ri=0;ri<Routes.length;ri++){
        var rp = Routes[ri].points; if(!rp) continue;
        for(var i=0;i<rp.length;i++){ var q=rp[i]; if(Math.hypot(q.x-x,q.y-y)<r+6) return true; }
      }
    }
    return false
  }

  // Matrix tint and scanlines + optional rain
  function drawMatrixOverlay(){
    const mx = ActiveEnv && ActiveEnv.matrix;
    if(!mx || !mx.on) return;
    // base tint multiply
    try{
      ctx.save();
      ctx.globalCompositeOperation='multiply';
      ctx.fillStyle='rgba(0, 80, 0, 0.16)';
      ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.globalCompositeOperation='screen';
      ctx.fillStyle='rgba(0, 255, 120, 0.05)';
      ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.restore();
    }catch(_e){}
    // scanlines
    try{
      ctx.save();
      ctx.globalAlpha = 0.08;
      ctx.fillStyle = '#0f0';
      const spacing = 3;
      for(let y=0;y<canvas.height;y+=spacing){ ctx.fillRect(0, y, canvas.width, 1); }
      ctx.restore();
    }catch(_e){}
  }
  function drawMatrixRain(){
    const mx = ActiveEnv && ActiveEnv.matrix;
    if(!mx || !mx.rain) return;
    try{
      const now = performance.now();
      const speed = 120; // px/s
      ctx.save();
      ctx.globalAlpha = 0.22;
      ctx.strokeStyle = 'rgba(0,255,170,0.55)';
      ctx.lineWidth = 1.2;
      const cols = Math.ceil(canvas.width/22);
      for(let i=0;i<cols;i++){
        const x = i*22 + 10;
        const seed = (i*9973)%1000;
        const y = ((now*0.001*speed + seed) % (canvas.height+60)) - 60;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y+48); ctx.stroke();
      }
      ctx.restore();
    }catch(_e){}
  }

  // Bridges drawing (visual cue where building over path is allowed)
  function drawBridges(){
    const br = ActiveEnv && ActiveEnv.bridges; if(!Array.isArray(br) || !br.length) return;
    try{
      ctx.save();
      for(const b of br){
        ctx.fillStyle='rgba(200,200,200,0.12)';
        ctx.strokeStyle='rgba(255,255,255,0.55)';
        ctx.lineWidth=1.2;
        ctx.beginPath(); ctx.rect(b.x+0.5,b.y+0.5,b.w-1,b.h-1); ctx.fill(); ctx.stroke();
        // hatch
        ctx.save();
        ctx.strokeStyle='rgba(255,255,255,0.25)'; ctx.lineWidth=1;
        const step=6; for(let xx=b.x; xx<b.x+b.w; xx+=step){ ctx.beginPath(); ctx.moveTo(xx, b.y); ctx.lineTo(xx+b.h, b.y+b.h); ctx.stroke(); }
        ctx.restore();
        // label
        const cx=b.x+b.w/2, cy=b.y+b.h/2;
        ctx.save(); ctx.font='bold 12px system-ui'; ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillStyle='rgba(0,0,0,0.6)'; ctx.fillText('BRO', cx+1, cy+1);
        ctx.fillStyle='rgba(255,255,255,0.9)'; ctx.fillText('BRO', cx, cy);
        ctx.restore();
      }
      ctx.restore();
    }catch(_e){}
  }
  // Static environment props (non-bridge) from ActiveEnv.objects
  function drawEnvObjects(){
    var objs = ActiveEnv && ActiveEnv.objects; if(!Array.isArray(objs) || !objs.length) return;
    try{
      for(var i=0;i<objs.length;i++){
        var o = objs[i]; if(!o || o.type==='bridge') continue;
        if(o.w && o.h){
          ctx.save();
          ctx.fillStyle = o.color || 'rgba(60,200,255,0.15)';
          ctx.strokeStyle = 'rgba(140,200,255,0.35)';
          ctx.lineWidth = 1.2;
          ctx.fillRect(o.x, o.y, o.w, o.h);
          ctx.strokeRect(o.x, o.y, o.w, o.h);
          ctx.restore();
        } else {
          var r = Math.max(3, (o.r||10));
          ctx.save();
          ctx.beginPath(); ctx.arc(o.x, o.y, r, 0, Math.PI*2);
          ctx.fillStyle = o.color || (o.type==='tree' ? 'rgba(45,227,108,0.35)' : 'rgba(150,180,255,0.25)');
          ctx.fill();
          ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth=1; ctx.stroke();
          ctx.restore();
        }
      }
    }catch(_e){}
  }
  function refreshTowerButtons(){
    towerBtns.innerHTML='';let i=1;
    for(const k in TOWER_TYPES){const def=TOWER_TYPES[k];const wrap=document.createElement('div');wrap.style.textAlign='center';const c=document.createElement('canvas');c.width=64;c.height=64;c.style.background='#111';c.style.display='block';c.style.marginBottom='6px';const ctx2=c.getContext('2d');
      if(def.income){ctx2.fillStyle='#2b2b2b';ctx2.beginPath();ctx2.arc(32,32,18,0,Math.PI*2);ctx2.fill();ctx2.fillStyle=def.color||'#fc6';ctx2.strokeStyle='#000';for(let k2=0;k2<3;k2++){const off=8-k2*6;ctx2.beginPath();ctx2.ellipse(32,32+off,12,6,0,0,Math.PI*2);ctx2.fill();ctx2.stroke()}ctx2.fillStyle='#000';ctx2.font='bold 11px system-ui';ctx2.textAlign='center';ctx2.textBaseline='middle';ctx2.fillText('¤',32,30)}
      else{ctx2.fillStyle=def.color;ctx2.beginPath();ctx2.arc(32,32,18,0,Math.PI*2);ctx2.fill();ctx2.fillStyle='#000';ctx2.fillRect(22,28,20,8)}
      const lockedReason = isLockedByWave(def.id);
      const btn=document.createElement('button');btn.setAttribute('data-id', def.id); btn.textContent=`${i} ${def.label} (${def.cost})`;btn.style.display='block';btn.style.width='100%';
      if(lockedReason){ btn.disabled=true; btn.setAttribute('data-locked','true'); btn.title = 'Låst – '+lockedReason; }
      btn.onclick=()=>{ if(btn.disabled) return; selectedTool=def.id };
      const info=document.createElement('div');info.className='small';
      if(lockedReason){ info.textContent = `Låst – ${lockedReason}`; }
      else if(def.income){info.textContent=`Income: ${def.income}/våg`;}else{info.textContent=`DMG:${def.dmg} RNG:${def.range} ROF:${def.fireRate}s`}
      wrap.appendChild(c);wrap.appendChild(btn);wrap.appendChild(info);towerBtns.appendChild(wrap);i++}
  }
  function changeSpeed(v){Settings.gameSpeed=Math.max(0.25,Math.min(Settings.maxSpeed,v));speedLbl.textContent=Settings.gameSpeed.toFixed(2)+'×';btnSpeed.textContent='×'+Math.round(Settings.gameSpeed); if(btnPause){ btnPause.textContent = (Settings.gameSpeed>0?'Pausa':'Fortsätt'); }}
  function prepareWave(n){
    State.spawnQueue.length=0; State._spawnedCount=0;
    const base = 6+n*3;
    const diffMul = Math.max(1, _Map.difficulty||1);
    const count = Math.floor(base * (1 + 0.15*(diffMul-1)));
    // Build a blueprint of the wave once
    const blueprint = [];
    for(let i=0;i<count;i++){
      if(i%17===0) blueprint.push({hp:Math.floor((40+n*10)*diffMul),speed:30+n*1,worth:20,boss:true,immuneSlow:true});
      else if(i%7===0) blueprint.push({hp:Math.floor((18+n*6)*diffMul),speed:32+n*3,worth:8});
      else if(i%5===0) blueprint.push({hp:Math.floor((10+n*3)*diffMul),speed:70+n*4,worth:4});
      else blueprint.push({hp:Math.floor((8+n*2)*diffMul),speed:50+n*3,worth:3,stealth:(n>=3)&&(i%9===0)});
    }
    // Duplicate for each route so every route gets the same composition
    const rc = Math.max(1, (Routes && Routes.length) || 0);
    for(let i=0;i<blueprint.length;i++){
      for(let r=0;r<rc;r++){
        const s = blueprint[i];
        State.spawnQueue.push({hp:s.hp, speed:s.speed, worth:s.worth, boss:!!s.boss, immuneSlow:!!s.immuneSlow, stealth:!!s.stealth, routeIndex:r});
      }
    }
    State.spawnTimer=0.6
  }
  function handleSpawning(dt){if(State.spawnQueue.length>0){State.spawnTimer-=dt*Settings.gameSpeed;if(State.spawnTimer<=0){const s=State.spawnQueue.shift();
      // Choose a route: use tagged routeIndex when present; else spread evenly
      var routeList = (Routes && Routes.length>0) ? Routes : [{points:path}];
      var idx = (typeof s.routeIndex==='number') ? Math.max(0, Math.min(routeList.length-1, s.routeIndex))
                : ((State._spawnedCount||0) % routeList.length);
      if(typeof s.routeIndex!=='number'){ State._spawnedCount=(State._spawnedCount||0)+1; }
      var chosen = routeList[idx].points || path;
      const e=new Enemy(s.hp,s.speed,s.worth, chosen); if(s.boss){e.boss=true;e.immuneSlow=true} if(s.stealth){e.stealth=true}
      State.enemies.push(e); State.spawnTimer=0.7}}else if(State.waveInProgress&&State.enemies.length===0){State.waveInProgress=false}}
  let selectedTool='cannon', hoverPos=null, selectedTower=null;
  // Upgrade popup under Skills button
  var upgPopup=null; function ensureUpgPopup(){ if(upgPopup) return; upgPopup=document.createElement('div'); upgPopup.className='hidden'; upgPopup.style.position='fixed'; upgPopup.style.background='rgba(10,10,10,0.95)'; upgPopup.style.border='1px solid #333'; upgPopup.style.borderRadius='10px'; upgPopup.style.padding='10px'; upgPopup.style.zIndex='999'; document.body.appendChild(upgPopup); }
  function positionUpgPopup(){ if(!upgPopup || upgPopup.classList.contains('hidden')) return; var anchor = document.getElementById('btnSkills'); if(!anchor){ upgPopup.style.left='14px'; upgPopup.style.top='14px'; return; } var r=anchor.getBoundingClientRect(); upgPopup.style.left = Math.round(r.left)+'px'; upgPopup.style.top = Math.round(r.bottom+6)+'px'; }
  function showUpgPopup(){ ensureUpgPopup(); if(!selectedTower){ hideUpgPopup(); return; } var def=selectedTower.def; var nextUpgCost=function(tw,stat){ var base=(Admin.upgCost&&Admin.upgCost[stat])||0; var lvl=(tw&&tw.levels&&tw.levels[stat])||0; return Math.max(1, Math.floor(base * Math.pow(1.4, lvl))); }; var html='<div style="font-weight:600;margin-bottom:6px">Uppgradera: '+(def.label||'Torn')+'</div>'; html+='<div id="upgStats" class="small" style="background:#0e0e0f;border:1px solid #333;border-radius:8px;padding:8px;margin-bottom:8px;line-height:1.35"></div>'; if(def.income){ var base=def.income; var L=selectedTower.levels; var bankMul=(Skills&&Skills.bankMul)||1; var inc=Math.floor(base*(1+0.2*L.dmg)*(1+0.1*L.range)*(1+0.15*L.rate)*bankMul); html+='<div class="small" style="display:grid;grid-template-columns:1fr auto;gap:6px;align-items:center">'; html+='<span>Avkastning +20% ('+nextUpgCost(selectedTower,'dmg')+')</span><button id="ppDmg">Köp</button>'; html+='<span>Avkastning +10% ('+nextUpgCost(selectedTower,'range')+')</span><button id="ppRange">Köp</button>'; html+='<span>Avkastning +15% ('+nextUpgCost(selectedTower,'rate')+')</span><button id="ppRate">Köp</button>'; html+='</div>'; } else { html+='<div class="small" style="display:grid;grid-template-columns:1fr auto;gap:6px;align-items:center">'; html+='<span>+DMG ('+nextUpgCost(selectedTower,'dmg')+')</span><button id="ppDmg">Köp</button>'; html+='<span>+Range ('+nextUpgCost(selectedTower,'range')+')</span><button id="ppRange">Köp</button>'; html+='<span>+Rate ('+nextUpgCost(selectedTower,'rate')+')</span><button id="ppRate">Köp</button>'; html+='</div>'; html+='<div class="small" style="display:grid;grid-template-columns:auto 1fr;gap:6px;margin-top:8px;align-items:center">'; html+='<span>Fokus:</span><div>'; html+='<button class="btn-secondary" id="focusFirst">Första</button> '; html+='<button class="btn-secondary" id="focusLast">Sista</button> '; html+='<button class="btn-secondary" id="focusStrong">Starkast</button> '; html+='<button class="btn-secondary" id="focusClose">Närmast</button> '; html+='<button class="btn-secondary" id="focusClear">Rensa mål</button>'; html+='</div></div>'; } html+='<div style="margin-top:8px;text-align:right"><button id="ppSell" class="btn-secondary">Sälj</button></div>'; upgPopup.innerHTML=html; upgPopup.classList.remove('hidden'); positionUpgPopup(); var stats=document.getElementById('upgStats'); if(stats){ if(def.income){ var parts=['Bas '+base,'× (1+20%×'+L.dmg+')','× (1+10%×'+L.range+')','× (1+15%×'+L.rate+')','× Bank x'+bankMul.toFixed(2)]; var sum=L.dmg+L.range+L.rate; var sell=Math.floor(def.cost*def.sellFactor*(1+sum*0.2)); stats.innerHTML='<div>Income nu: <b>+'+inc+'</b> / våg</div><div style="color:#bbb">'+parts.join(' ')+'</div><div style="margin-top:6px">Nivåer D/R/Rt: '+L.dmg+'/'+L.range+'/'+L.rate+' • Säljvärde: '+sell+'</div>'; } else { var dmg=selectedTower.def.dmg*(1+0.5*selectedTower.levels.dmg)*(((Skills&&Skills.dmgMul)||1)); var range=(selectedTower.def.range+10*selectedTower.levels.range)*(((Skills&&Skills.rangeMul)||1)); var fireRate=Math.max(0.05, selectedTower.def.fireRate*(1-0.12*selectedTower.levels.rate)); var dps=fireRate>0?(dmg/fireRate):dmg; var lines=['Skada: <b>'+dmg.toFixed(1)+'</b>','DPS: <b>'+dps.toFixed(1)+'</b>','Räckvidd: <b>'+Math.round(range)+'</b>','Eldhast: <b>'+fireRate.toFixed(2)+'s</b>']; if(def.aoe) lines.push('Splash-radie: <b>'+def.aoe+'</b>'); if(def.chain) lines.push('Kedja: <b>'+def.chain.max+'</b> mål • räckvidd '+def.chain.range); if(def.slow) lines.push('Frost: <b>'+Math.round((1-def.slow)*100)+'%</b> i '+(def.slowTime||1.2)+'s'); if(def.dot) lines.push('Gift: <b>'+(def.dot)+'/s</b> i '+(def.dotTime||2.5)+'s'); if(def.mark) lines.push('Mark: <b>'+((def.mark.mult||1.2).toFixed(2))+'x</b> i '+(def.mark.duration||2.5)+'s'+(def.reveal?' • avslöjar stealth':'') ); var sum2=selectedTower.levels.dmg+selectedTower.levels.range+selectedTower.levels.rate; var sell2=Math.floor(def.cost*def.sellFactor*(1+sum2*0.2)); stats.innerHTML='<div>'+lines.join(' • ')+'</div><div style="margin-top:6px">Nivåer D/R/Rt: '+selectedTower.levels.dmg+'/'+selectedTower.levels.range+'/'+selectedTower.levels.rate+'</div><div>Säljvärde: '+sell2+'</div>'; } }
    var f1=document.getElementById('focusFirst'); if(f1) f1.onclick=function(){ if(selectedTower){ selectedTower.targetMode='first'; showUpgPopup(); }};
    var f2=document.getElementById('focusLast'); if(f2) f2.onclick=function(){ if(selectedTower){ selectedTower.targetMode='last'; showUpgPopup(); }};
    var f3=document.getElementById('focusStrong'); if(f3) f3.onclick=function(){ if(selectedTower){ selectedTower.targetMode='strong'; showUpgPopup(); }};
    var f4=document.getElementById('focusClose'); if(f4) f4.onclick=function(){ if(selectedTower){ selectedTower.targetMode='close'; showUpgPopup(); }};
    var f5=document.getElementById('focusClear'); if(f5) f5.onclick=function(){ if(selectedTower){ selectedTower._manualTarget=null; showUpgPopup(); }};
  var bD=document.getElementById('ppDmg'); if(bD) bD.onclick=function(){ if(!selectedTower) return; var cost=(function(t){ var base=(Admin.upgCost&&Admin.upgCost.dmg)||0; var lvl=(t&&t.levels&&t.levels.dmg)||0; return Math.max(1, Math.floor(base * Math.pow(1.4, lvl))); })(selectedTower); if(State.money>=cost){ State.money-=cost; selectedTower.levels.dmg++; showSelectedInfo(); showUpgPopup(); } };
  var bR=document.getElementById('ppRange'); if(bR) bR.onclick=function(){ if(!selectedTower) return; var cost=(function(t){ var base=(Admin.upgCost&&Admin.upgCost.range)||0; var lvl=(t&&t.levels&&t.levels.range)||0; return Math.max(1, Math.floor(base * Math.pow(1.4, lvl))); })(selectedTower); if(State.money>=cost){ State.money-=cost; selectedTower.levels.range++; showSelectedInfo(); showUpgPopup(); } };
  var bRt=document.getElementById('ppRate'); if(bRt) bRt.onclick=function(){ if(!selectedTower) return; var cost=(function(t){ var base=(Admin.upgCost&&Admin.upgCost.rate)||0; var lvl=(t&&t.levels&&t.levels.rate)||0; return Math.max(1, Math.floor(base * Math.pow(1.4, lvl))); })(selectedTower); if(State.money>=cost){ State.money-=cost; selectedTower.levels.rate++; showSelectedInfo(); showUpgPopup(); } };
    var bS=document.getElementById('ppSell'); if(bS) bS.onclick=function(){ if(!selectedTower) return; var t=selectedTower; hideUpgPopup(); sellTower(t); };
  }
  function hideUpgPopup(){ if(upgPopup) upgPopup.classList.add('hidden'); }
  canvas.addEventListener('mousemove',e=>{const r=canvas.getBoundingClientRect();const mx=e.clientX-r.left,my=e.clientY-r.top;hoverPos={x:Math.floor(mx/TILE)*TILE+TILE/2,y:Math.floor(my/TILE)*TILE+TILE/2}});
  canvas.addEventListener('mouseleave',()=>{hoverPos=null});
  canvas.addEventListener('click',(e)=>{const r=canvas.getBoundingClientRect();const mx=e.clientX-r.left,my=e.clientY-r.top; if(selectedTower){
      // Manual focus: click near an enemy to focus
      let best=null,bd=1e9; for(const en of State.enemies){ const dd=Math.hypot(en.pos.x-mx,en.pos.y-my); if(dd<bd&&dd<=22){ bd=dd; best=en; } } if(best){ selectedTower._manualTarget=best; showUpgPopup(); return; }
    }
    if(!hoverPos)return;for(const t of State.towers){if(Math.abs(hoverPos.x-t.x)<=TILE/2&&Math.abs(hoverPos.y-t.y)<=TILE/2){selectedTower=t;showSelectedInfo(); showUpgPopup(); return}}if(isOnPath(hoverPos.x,hoverPos.y))return;const def=TOWER_TYPES[selectedTool];if(!def)return;if(State.money>=def.cost){State.money-=def.cost;State.towers.push(new Tower(hoverPos.x,hoverPos.y,def)); hideUpgPopup(); }});
  canvas.addEventListener('contextmenu', function(e){ e.preventDefault(); selectedTower=null; showSelectedInfo(); hideUpgPopup(); });
  window.addEventListener('pointerdown', function(e){ if(!upgPopup || upgPopup.classList.contains('hidden')) return; if(e.target===upgPopup || upgPopup.contains(e.target) || e.target===canvas) return; hideUpgPopup(); });
  function showSelectedInfo(){
    if(!selectedTower){ selInfo.textContent='Inget torn valt.'; if(upgControls) upgControls.classList.add('hidden'); return }
    const def=selectedTower.def;
    if(def.income){ selInfo.textContent=`Torn: ${def.label} | Income/våg: ${Math.floor(def.income*(1+0.2*selectedTower.levels.dmg)*(1+0.1*selectedTower.levels.range)*(1+0.15*selectedTower.levels.rate)*((Skills&&Skills.bankMul)||1))} | Nivåer D/R/Rt: ${selectedTower.levels.dmg}/${selectedTower.levels.range}/${selectedTower.levels.rate}`; if(upgControls) upgControls.classList.add('hidden'); }
  else { const dmg=(def.dmg*(1+0.5*selectedTower.levels.dmg)*((Skills&&Skills.dmgMul)||1)).toFixed(1); const rng=Math.round((def.range+10*selectedTower.levels.range)*((Skills&&Skills.rangeMul)||1)); const rof=Math.max(0.05,def.fireRate*(1-0.12*selectedTower.levels.rate)).toFixed(2); const focus=(selectedTower.targetMode||'first'); let dps3='0.0'; if(selectedTower._dmgLog&&selectedTower._dmgLog.length){ const now=performance.now(); let sum=0; for(const ev of selectedTower._dmgLog){ if(ev.t>=now-3000) sum+=ev.dmg||0; } dps3=(sum/3).toFixed(1); } selInfo.textContent=`Torn: ${def.label} | DMG:${dmg} RNG:${rng} ROF:${rof}s • DPS:${dps3} • Fokus: ${focus} | Nivåer D/R/Rt: ${selectedTower.levels.dmg}/${selectedTower.levels.range}/${selectedTower.levels.rate}`; if(upgControls) upgControls.classList.add('hidden'); }
  }
  function startWave(){ if(State.waveInProgress)return; if(Settings.gameSpeed===0){ changeSpeed(1); } if((State.bountyBoostNext||0)>0){ State.bountyBoostActive=true; State.bountyBoostNext--; } State.currentWave++; try{ refreshTowerButtons && refreshTowerButtons(); }catch(_e){} State.waveInProgress=true;State.lastRoundIncome=0;prepareWave(State.currentWave); }
  // Rebuild tower shop when a new wave starts to reveal unlocks
  startWaveBtn.addEventListener('click', function(){ try{ setTimeout(refreshTowerButtons, 0); }catch(_e){} });
  startWaveBtn.addEventListener('click', startWave);
  sellAllBtn.addEventListener('click',()=>{for(const t of State.towers){const def=t.def;const sum=(t.levels?.dmg||0)+(t.levels?.range||0)+(t.levels?.rate||0);State.money+=Math.floor(def.cost*def.sellFactor*(1+sum*0.2)); try{ if(t._node && t._node.remove) t._node.remove(); }catch(_e){} } if(overlay) try{ overlay.innerHTML=''; }catch(_e){} State.towers.length=0;selectedTower=null;State.lastSell=null;showSelectedInfo()});
  btnSpeed.addEventListener('click',()=>{let next=Settings.gameSpeed>=Settings.maxSpeed?1:Math.min(Settings.maxSpeed,Settings.gameSpeed+1);changeSpeed(next)});
  if(btnPause){ btnPause.textContent = (Settings.gameSpeed>0?'Pausa':'Fortsätt'); btnPause.addEventListener('click',()=>{ const pausing=Settings.gameSpeed>0; if(pausing){ Settings.gameSpeed=0; } else { Settings.gameSpeed=1; } speedLbl.textContent=Settings.gameSpeed.toFixed(2)+'×'; btnSpeed.textContent='×'+Math.max(1,Math.round(Settings.gameSpeed)); btnPause.textContent=(Settings.gameSpeed>0?'Pausa':'Fortsätt'); }); }
  if(btnRanges){
    const sync=()=>{ btnRanges.textContent = Visuals.showAllRanges ? 'Dölj räckvidd' : 'Visa räckvidd'; };
    sync();
    btnRanges.addEventListener('click',()=>{
      Visuals.showAllRanges = !Visuals.showAllRanges; sync();
  persistSettings('Visuals');
    });
  }
  if(btnDps){
    const syncD=()=>{ btnDps.textContent = Visuals.showDps ? 'Dölj DPS' : 'Visa DPS'; };
    syncD();
    btnDps.addEventListener('click',()=>{
  Visuals.showDps = !Visuals.showDps; syncD();
  persistSettings('Visuals');
    });
  }
  // Settings panel (UI/theme and visuals)
  (function(){
    if(!btnSettings) return;
    let panel=null;
    // Theme presets mapped to CSS variables
    const THEMES = {
      light: { '--bg':'#f5f7fb','--panel':'#ffffff','--panel2':'#f7f9fc','--edge':'#d6dbe7','--txt':'#0b1020','--muted':'#5c6680','--btn2':'#dde3f0','--accent':'#3b82f6' },
      dim:   { '--bg':'#0f0f10','--panel':'#151515','--panel2':'#101010','--edge':'#2a2a2a','--txt':'#eeeeee','--muted':'#aaaaaa','--btn2':'#3a3a3a','--accent':'#2d6' },
      neon:  { '--bg':'#0a0b14','--panel':'#0f1022','--panel2':'#0c0d1a','--edge':'#1b1c2b','--txt':'#e7f0ff','--muted':'#8ea2c6','--btn2':'#1b1e34','--accent':'#00e5ff' }
    };
    function applyThemeVars(vars){ try{ const root=document.documentElement; for(const k in vars){ root.style.setProperty(k, vars[k]); } }catch(_e){} }
    function ensure(){ if(panel) return panel; panel=document.createElement('div'); panel.style.position='fixed'; panel.style.right='14px'; panel.style.bottom='14px'; panel.style.zIndex='1001'; panel.style.background='rgba(10,10,10,0.97)'; panel.style.border='1px solid #333'; panel.style.borderRadius='10px'; panel.style.padding='10px'; panel.style.minWidth='280px'; panel.className='hidden'; panel.innerHTML='\
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:6px">\
        <div style="font-weight:600">Inställningar</div>\
        <button id="uiClose" class="btn-secondary">Stäng</button>\
      </div>\
      <div class="small" style="margin-bottom:6px">Tema</div>\
      <div class="small" style="display:grid;grid-template-columns:1fr auto;gap:6px;align-items:center">\
        <label>Tema</label><select id="uiTheme"><option value="dim">Mörk (Dim)</option><option value="light">Ljus</option><option value="neon">Neon</option><option value="custom">Custom</option></select>\
        <label>Accentfärg</label><input id="uiAccent" type="color" value="#22aa66"/>\
        <label>Hörnradie</label><input id="uiRadius" type="range" min="4" max="18" step="1"/>\
        <label>UI‑skala</label><input id="uiScale" type="range" min="0.8" max="1.4" step="0.01"/>\
  <label>Ikonstorlek</label><input id="uiTileIcon" type="range" min="0.8" max="1.4" step="0.02"/>\
        <label>Kompakt HUD</label><input id="uiCompact" type="checkbox"/>\
      </div>\
      <hr style="border:none;border-top:1px solid #222;margin:10px 8px"/>\
      <div class="small" style="margin-bottom:6px">Grafik</div>\
      <div class="small" style="display:grid;grid-template-columns:1fr auto;gap:6px;align-items:center">\
        <label>Rutnät</label><input id="uiGrid" type="checkbox"/>\
        <label>Väg‑bredd</label><input id="uiPathW" type="range" min="10" max="40" step="1"/>\
      </div>';
      document.body.appendChild(panel); bind(panel); applyUI(); return panel; }
    function applyUI(){ try{
      // Apply theme preset first
      const cur = (Visuals.theme || 'dim');
      const base = THEMES[cur] || THEMES.dim;
      const vars = { ...base };
      if(Visuals._accent){ vars['--accent'] = Visuals._accent; }
      applyThemeVars(vars);
      // Then apply shape/scale
      const root=document.documentElement; root.style.setProperty('--radius', (Visuals._radius!=null? (Visuals._radius+'px'):'10px'));
      root.style.setProperty('--ui-scale', String(Visuals._scale||1));
      if(Visuals._compact){ document.body.classList.add('hud-compact'); } else { document.body.classList.remove('hud-compact'); }
    }catch(_e){} }
    function bind(host){
  const q=(id)=>host.querySelector('#'+id);
  const thm=q('uiTheme'), acc=q('uiAccent'), rad=q('uiRadius'), scl=q('uiScale'), tis=q('uiTileIcon'), cmp=q('uiCompact'), grd=q('uiGrid'), pw=q('uiPathW'), cls=q('uiClose');
      // init values
      thm && (thm.value = (Visuals.theme||'dim'));
      acc && (acc.value = Visuals._accent || (THEMES[Visuals.theme||'dim'] && THEMES[Visuals.theme||'dim']['--accent']) || '#22aa66');
      rad && (rad.value = String(Visuals._radius||10));
      scl && (scl.value = String(Visuals._scale||1));
  cmp && (cmp.checked = !!Visuals._compact);
  tis && (tis.value = String( (typeof Visuals._tiScale==='number')? Visuals._tiScale : 0.8 ));
      grd && (grd.checked = Visuals.showGrid!==false);
      pw && (pw.value = String(Visuals.pathWidth||24));
  const save=()=>{ try{ var raw=JSON.parse(localStorage.getItem('td-settings-v1')||'{}'); raw.Visuals = raw.Visuals||{}; raw.Visuals.theme = Visuals.theme; raw.Visuals._accent=Visuals._accent; raw.Visuals._radius=Visuals._radius; raw.Visuals._scale=Visuals._scale; raw.Visuals._tiScale=Visuals._tiScale; raw.Visuals._compact=Visuals._compact; raw.Visuals.showGrid=Visuals.showGrid; raw.Visuals.pathWidth=Visuals.pathWidth; raw.Visuals.colorblindMode=Visuals.colorblindMode; raw.Visuals.reducedMotion=Visuals.reducedMotion; raw.Visuals.showAllRanges=Visuals.showAllRanges; raw.Visuals.showDps=Visuals.showDps; raw.ts=Date.now(); localStorage.setItem('td-settings-v1', JSON.stringify(raw)); }catch(e){} };
      thm && thm.addEventListener('change', ()=>{ Visuals.theme = thm.value || 'dim'; applyUI(); save(); });
      acc && acc.addEventListener('input', ()=>{ Visuals._accent=acc.value; // switch to custom when user tweaks accent
        if(thm){ thm.value='custom'; }
        Visuals.theme = 'custom'; applyUI(); save(); });
      rad && rad.addEventListener('input', ()=>{ Visuals._radius=parseInt(rad.value)||10; applyUI(); save(); });
      scl && scl.addEventListener('input', ()=>{ Visuals._scale=parseFloat(scl.value)||1; applyUI(); save(); });
  tis && tis.addEventListener('input', ()=>{ Visuals._tiScale=Math.max(0.6, Math.min(1.1, parseFloat(tis.value)||0.8)); save(); try{ window.__TD_ICON_SIZE = iconSize(); }catch(_e){}; try{ if(State && State.towers){ const r = canvas.getBoundingClientRect(); const cssScale=(r.width/canvas.width)||1; const base=iconSize(); const px=Math.round(base*cssScale); for(const tw of State.towers){ const svg = tw && tw._node && tw._node.querySelector('svg'); if(svg){ svg.setAttribute('width', String(px)); svg.setAttribute('height', String(px)); } } } }catch(_e){} });
      cmp && cmp.addEventListener('change', ()=>{ Visuals._compact=!!cmp.checked; applyUI(); save(); });
      grd && grd.addEventListener('change', ()=>{ Visuals.showGrid=!!grd.checked; save(); });
      pw && pw.addEventListener('input', ()=>{ Visuals.pathWidth=Math.max(10, Math.min(40, parseInt(pw.value)||24)); save(); });
      cls && cls.addEventListener('click', ()=>host.classList.add('hidden'));
    }
    btnSettings.addEventListener('click', ()=>{ const p=ensure(); p.classList.toggle('hidden'); });
  })();
  if(upgDmg){ upgDmg.addEventListener('click',()=>{if(!selectedTower)return;if(State.money>=Admin.upgCost.dmg){State.money-=Admin.upgCost.dmg;selectedTower.levels.dmg++;showSelectedInfo()}}); }
  if(upgRange){ upgRange.addEventListener('click',()=>{if(!selectedTower)return;if(State.money>=Admin.upgCost.range){State.money-=Admin.upgCost.range;selectedTower.levels.range++;showSelectedInfo()}}); }
  if(upgRate){ upgRate.addEventListener('click',()=>{if(!selectedTower)return;if(State.money>=Admin.upgCost.rate){State.money-=Admin.upgCost.rate;selectedTower.levels.rate++;showSelectedInfo()}}); }
  // Sell helpers with undo grace
  let toast=null; function ensureToast(){ if(toast) return toast; toast=document.createElement('div'); toast.style.position='fixed'; toast.style.left='12px'; toast.style.bottom='12px'; toast.style.background='rgba(10,10,10,0.95)'; toast.style.border='1px solid #333'; toast.style.borderRadius='10px'; toast.style.padding='8px 10px'; toast.style.zIndex='1002'; toast.style.fontSize='12px'; toast.className='td-toast hidden'; document.body.appendChild(toast); return toast; }
  function showToast(msg, withUndo){ const el=ensureToast(); el.innerHTML=''; const span=document.createElement('span'); span.textContent=msg; el.appendChild(span); if(withUndo){ const b=document.createElement('button'); b.textContent='Ångra'; b.className='btn-secondary'; b.style.marginLeft='8px'; b.onclick=()=>undoLastSell(); el.appendChild(b); } el.classList.remove('hidden'); clearTimeout(showToast._t); showToast._t=setTimeout(()=>{ el.classList.add('hidden'); }, 3200); }
  function sellTower(t){ if(!t) return; const def=t.def; const sum=(t.levels?.dmg||0)+(t.levels?.range||0)+(t.levels?.rate||0); const val=Math.floor(def.cost*def.sellFactor*(1+sum*0.2)); State.money+=val; const idx=State.towers.indexOf(t); if(idx>=0) State.towers.splice(idx,1); try{ if(t._node && t._node.remove) t._node.remove(); }catch(_e){} State.lastSell={ at:Date.now(), refund:val, defId:t.def.id, x:t.x, y:t.y, levels:{...t.levels} }; showToast('Såld +'+val,'undo'); selectedTower=null; showSelectedInfo(); }
  function undoLastSell(){ const s=State.lastSell; if(!s) return; const age=Date.now()-s.at; if(age>3000){ showToast('Ångra tidsgräns passerad'); State.lastSell=null; return; } const def=TOWER_TYPES[s.defId]; if(!def) { showToast('Kan inte ångra'); State.lastSell=null; return; } if(State.money>=s.refund){ State.money-=s.refund; const tw=new Tower(s.x,s.y,def); tw.levels={...s.levels}; State.towers.push(tw); State.lastSell=null; showToast('Ångrade försäljning'); } else { showToast('Inte tillräckligt med pengar'); }
  }
  if(sellBtn){ sellBtn.addEventListener('click',()=>{ if(!selectedTower) return; sellTower(selectedTower); }); }
  function matchKey(e, action){ const want=(Settings.hotkeys && Settings.hotkeys[action]) || (defaultHotkeys[action]); if(!want) return false; const k=e.key; // normalize single-char keys
    if(want.length===1){ return k.toLowerCase()===want.toLowerCase(); }
    return k===want; }
  window.addEventListener('keydown',e=>{
    if(matchKey(e,'select1')){ selectedTool=Object.keys(TOWER_TYPES)[0]; }
    if(matchKey(e,'select2')){ selectedTool=Object.keys(TOWER_TYPES)[1]; }
    if(matchKey(e,'select3')){ selectedTool=Object.keys(TOWER_TYPES)[2]; }
    if(matchKey(e,'upgradeDamage')){ if(selectedTower&&State.money>=Admin.upgCost.dmg){State.money-=Admin.upgCost.dmg;selectedTower.levels.dmg++;showSelectedInfo()} }
    if(matchKey(e,'speedUp')){ changeSpeed(Math.min(Settings.maxSpeed,Settings.gameSpeed+0.25)); }
    if(matchKey(e,'speedDown')){ changeSpeed(Math.max(0.25,Settings.gameSpeed-0.25)); }
    if(matchKey(e,'admin')){ admin && admin.classList.toggle('hidden'); }
    if(matchKey(e,'cancel')){ selectedTower=null; showSelectedInfo(); }
    if(matchKey(e,'startWave')){ startWave(); }
    if(matchKey(e,'pause')){ if(btnPause){ const pausing=Settings.gameSpeed>0; if(pausing){ Settings.gameSpeed=0; } else { Settings.gameSpeed=1; } speedLbl.textContent=Settings.gameSpeed.toFixed(2)+'×'; btnSpeed.textContent='×'+Math.max(1,Math.round(Settings.gameSpeed)); btnPause.textContent=(Settings.gameSpeed>0?'Pausa':'Fortsätt'); } }
    if(matchKey(e,'toggleRanges')){ if(btnRanges){ btnRanges.click(); } }
    if(matchKey(e,'toggleDps')){ if(btnDps){ btnDps.click(); } }
    if(matchKey(e,'sellAll')){ sellAllBtn && sellAllBtn.click(); }
    if(matchKey(e,'skills')){ const b=document.getElementById('btnSkills'); if(b){ b.click(); } }
    if(matchKey(e,'menu')){ const b=document.getElementById('btnMenu'); if(b){ b.click(); } }
    if(matchKey(e,'undo')){ undoLastSell(); }
  });
  if(closeAdmin) closeAdmin.addEventListener('click',()=>{admin && admin.classList.add('hidden')});
  if(applyAdmin) applyAdmin.addEventListener('click',()=>{Admin.upgCost.dmg=parseInt(costDmg.value)||Admin.upgCost.dmg;Admin.upgCost.range=parseInt(costRange.value)||Admin.upgCost.range;Admin.upgCost.rate=parseInt(costRate.value)||Admin.upgCost.rate;Settings.maxSpeed=Math.max(1,parseFloat(adminMaxSpeed.value)||Settings.maxSpeed);if(Settings.gameSpeed>Settings.maxSpeed){changeSpeed(Settings.maxSpeed)}alert('Admin inställningar uppdaterade.')});
  if(adminStartMoney) adminStartMoney.addEventListener('change',()=>{Admin.startMoney=parseInt(adminStartMoney.value)||Admin.startMoney;State.money=Admin.startMoney;moneyEl.textContent=State.money});
  if(adminStartLives) adminStartLives.addEventListener('change',()=>{Admin.startLives=parseInt(adminStartLives.value)||Admin.startLives;State.lives=Admin.startLives;livesEl.textContent=State.lives});
  if(adminMaxSpeed) adminMaxSpeed.addEventListener('change',()=>{Settings.maxSpeed=Math.max(1,parseFloat(adminMaxSpeed.value)||Settings.maxSpeed);if(Settings.gameSpeed>Settings.maxSpeed){changeSpeed(Settings.maxSpeed)}});
  function drawOverlay(){
    if(hoverPos&&selectedTool){
      const def=TOWER_TYPES[selectedTool];
      // Tile highlight at hover (snapped), turns red if invalid placement
      try{
        const onPath = isOnPath(hoverPos.x, hoverPos.y);
        const cost = (def && def.cost) || 0;
        const afford = State.money >= cost;
        const invalid = onPath || !afford;
        ctx.save();
        ctx.lineWidth = 1;
        if(invalid){
          ctx.fillStyle = 'rgba(255, 60, 60, 0.10)';
          ctx.strokeStyle = 'rgba(255, 90, 90, 0.70)';
        } else {
          ctx.fillStyle = 'rgba(255,255,255,0.05)';
          ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        }
        ctx.beginPath();
        ctx.rect(hoverPos.x - TILE/2 + 0.5, hoverPos.y - TILE/2 + 0.5, TILE-1, TILE-1);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }catch(_e){}
      
      
      if(!def.income){
        var previewRange=(def.range||0) * (((Skills&&Skills.rangeMul)||1));
        if(previewRange>0){ ctx.save(); ctx.beginPath(); ctx.arc(hoverPos.x,hoverPos.y, previewRange, 0, Math.PI*2); ctx.fillStyle=Visuals.colorblindMode?'rgba(255,255,0,0.03)':'rgba(120,180,255,0.02)'; ctx.fill(); ctx.setLineDash([6,5]); ctx.strokeStyle=Visuals.colorblindMode?'rgba(255,255,0,0.7)':'rgba(160,210,255,0.35)'; ctx.lineWidth=1.25; ctx.stroke();
          // Build-ghost: show projected total DPS within ring (sum of nearby towers DPS + new tower base DPS)
          let sumDps=0; const now=performance.now();
          for(const t of State.towers){ if(!t||!t._dmgLog||!t._dmgLog.length) continue; // overlap check: ring intersects tower range
            let tRange=((t.def&&t.def.range)||0) + 10*((t.levels&&t.levels.range)||0); tRange*=((Skills&&Skills.rangeMul)||1);
            const d=Math.hypot(t.x-hoverPos.x, t.y-hoverPos.y);
            if(d <= (previewRange + tRange)){
              let sum=0; for(const ev of t._dmgLog){ if(ev.t>=now-3000) sum+=ev.dmg||0; }
              sumDps += sum/3;
            }
          }
          // estimate new tower DPS (base)
          const baseDmg=(def.dmg||0)*(((Skills&&Skills.dmgMul)||1)); const baseFire=Math.max(0.05,(def.fireRate||1)); const baseDps=baseFire>0?(baseDmg/baseFire):baseDmg; sumDps += baseDps;
          const label='≈ '+Math.round(sumDps)+' DPS'; ctx.font='12px system-ui'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillStyle=Visuals.colorblindMode?'#fff':'rgba(255,255,255,0.95)'; ctx.strokeStyle='rgba(0,0,0,0.6)'; ctx.lineWidth=3; ctx.strokeText(label, hoverPos.x, hoverPos.y + Math.max(24, Math.min(60, previewRange*0.3)) ); ctx.fillText(label, hoverPos.x, hoverPos.y + Math.max(24, Math.min(60, previewRange*0.3)) );
          ctx.restore(); }
      }
    }
    if(selectedTower){
      ctx.strokeStyle='#fff'; ctx.lineWidth=2; ctx.strokeRect(selectedTower.x-20,selectedTower.y-20,40,40);
      if(!selectedTower.def||!selectedTower.def.income){
        var range=selectedTower.def?selectedTower.def.range:0;
        range = (range + 10*(selectedTower.levels?selectedTower.levels.range:0)) * (((Skills&&Skills.rangeMul)||1));
        var rr = Math.max(0, Math.round(range));
        if(rr>0){ ctx.save(); ctx.beginPath(); ctx.arc(selectedTower.x,selectedTower.y, rr, 0, Math.PI*2); ctx.fillStyle=Visuals.colorblindMode?'rgba(255,255,0,0.04)':'rgba(120,180,255,0.03)'; ctx.fill(); ctx.setLineDash([6,5]); ctx.strokeStyle=Visuals.colorblindMode?'rgba(255,255,0,0.8)':'rgba(180,220,255,0.45)'; ctx.lineWidth=1.5; ctx.stroke(); ctx.restore(); }
      }
    }
    if(Visuals.showAllRanges){
      ctx.save(); ctx.setLineDash([6,5]); ctx.strokeStyle=Visuals.colorblindMode?'rgba(255,255,0,0.7)':'rgba(180,220,255,0.35)'; ctx.lineWidth=1.25; ctx.fillStyle=Visuals.colorblindMode?'rgba(255,255,0,0.03)':'rgba(120,180,255,0.02)';
      for(const t of State.towers){ if(!t||!t.def||t.def.income) continue; var range=(t.def.range||0) + 10*((t.levels&&t.levels.range)||0); range *= (((Skills&&Skills.rangeMul)||1)); var rr=Math.max(0,Math.round(range)); if(rr>0){ ctx.beginPath(); ctx.arc(t.x,t.y, rr, 0, Math.PI*2); ctx.fill(); ctx.stroke(); } }
      ctx.restore();
    }
    // DPS overlay (clamped with background)
    if(Visuals.showDps){ const now=performance.now(); ctx.save(); ctx.font='12px system-ui'; ctx.textAlign='center'; ctx.textBaseline='middle';
      for(const t of State.towers){ if(!t||!t._dmgLog||!t._dmgLog.length) continue; const cutoff=now-3000; let sum=0; const kept=[]; for(const ev of t._dmgLog){ if(ev.t>=cutoff){ sum+=ev.dmg||0; kept.push(ev); } } t._dmgLog=kept; const txt = (sum>0? (sum/3).toFixed(0) : '0');
        var tx=t.x, ty=t.y-24; var padX=5, padY=3, h=16; var w=Math.ceil(ctx.measureText(txt).width)+padX*2; var rx=Math.max(2, Math.min(canvas.width - w - 2, tx - w/2)); var ry=Math.max(2, Math.min(canvas.height - h - 2, ty - h/2)); var cx=rx+w/2, cy=ry+h/2;
        ctx.save(); ctx.fillStyle='rgba(0,0,0,0.55)'; ctx.strokeStyle='rgba(255,255,255,0.18)'; ctx.lineWidth=1; var r=6; ctx.beginPath(); ctx.moveTo(rx+r,ry); ctx.lineTo(rx+w-r,ry); ctx.quadraticCurveTo(rx+w,ry, rx+w,ry+r); ctx.lineTo(rx+w,ry+h-r); ctx.quadraticCurveTo(rx+w,ry+h, rx+w-r,ry+h); ctx.lineTo(rx+r,ry+h); ctx.quadraticCurveTo(rx,ry+h, rx,ry+h-r); ctx.lineTo(rx,ry+r); ctx.quadraticCurveTo(rx,ry, rx+r,ry); ctx.closePath(); ctx.fill(); ctx.stroke();
        if(!Visuals.reducedMotion && (Math.abs(cx-tx)>1 || Math.abs(cy-ty)>1)){ ctx.strokeStyle='rgba(255,255,255,0.25)'; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(t.x, t.y-14); ctx.lineTo(cx, cy+h*0.55); ctx.stroke(); }
        ctx.fillStyle='rgba(255,255,255,0.95)'; ctx.fillText(txt, cx, cy); ctx.restore();
      }
      ctx.restore(); }
    positionUpgPopup();
  }
  var btnAdmin=document.getElementById('btnAdmin');
  // Minimal Dev overlay for fallback (file://) so you can tweak live without leaving the game
  function ensureDevPanel(){
    var panel=document.getElementById('devPanel'); if(panel) return panel;
    panel=document.createElement('div'); panel.id='devPanel';
    panel.style.position='fixed'; panel.style.left='14px'; panel.style.top='14px'; panel.style.zIndex='1001';
    panel.style.background='rgba(10,10,10,0.96)'; panel.style.border='1px solid #333'; panel.style.borderRadius='10px';
    panel.style.padding='10px'; panel.style.minWidth='280px'; panel.className='';
    panel.innerHTML = '<div id="devHandle" style="display:flex;justify-content:space-between;align-items:center;gap:8px;cursor:move">\
      <div style="font-weight:600">Dev-verktyg (fallback)</div>\
      <button id="devClose" class="btn-secondary">Stäng</button>\
    </div>\
    <div class="small" style="margin-top:6px">Live-balansering</div>\
    <div class="small">DMG <input id="slDmg" type="range" min="0.5" max="2" step="0.01"> <span id="slDmgV"></span></div>\
    <div class="small">RNG <input id="slRange" type="range" min="0.5" max="2" step="0.01"> <span id="slRangeV"></span></div>\
    <div class="small">Bank <input id="slBank" type="range" min="0.5" max="3" step="0.01"> <span id="slBankV"></span></div>\
    <div class="small">Bounty <input id="slBounty" type="range" min="0.5" max="3" step="0.01"> <span id="slBountyV"></span></div>\
    <div style="margin-top:8px;display:flex;gap:6px"><button id="snapSave" class="btn-secondary">Snapshot</button><button id="snapLoad" class="btn-secondary">Restore</button></div>\
    <hr style="border:none;border-top:1px solid #222;margin:10px 0"/>\
    <div class="small" style="font-weight:600;margin-bottom:6px">Admininställningar</div>\
    <div class="small" style="display:grid;grid-template-columns:1fr auto;gap:6px;align-items:center">\
      <label for="devStartMoney">Startpengar</label><input id="devStartMoney" type="number" min="0" style="width:110px"/>\
      <label for="devStartLives">Startliv</label><input id="devStartLives" type="number" min="1" style="width:110px"/>\
      <label for="devMaxSpeed">Max hastighet</label><input id="devMaxSpeed" type="number" step="0.25" min="1" style="width:110px"/>\
    </div>\
    <div class="small" style="margin-top:8px;font-weight:600">Uppgraderingskostnader</div>\
    <div class="small" style="display:grid;grid-template-columns:1fr auto;gap:6px;align-items:center">\
      <label for="devCostDmg">Skada</label><input id="devCostDmg" type="number" min="1" style="width:110px"/>\
      <label for="devCostRange">Räckvidd</label><input id="devCostRange" type="number" min="1" style="width:110px"/>\
      <label for="devCostRate">Eldhast</label><input id="devCostRate" type="number" min="1" style="width:110px"/>\
    </div>\
    <div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">\
      <button id="devApplyAdmin" class="btn-secondary">Verkställ</button>\
      <button id="devToggleRanges" class="btn-secondary"></button>\
      <button id="devToggleDps" class="btn-secondary"></button>\
      <button id="devToggleHC" class="btn-secondary"></button>\
      <button id="devToggleMotion" class="btn-secondary"></button>\
      <button id="devOpenAdmin" class="btn-secondary">Öppna ADMIN</button>\
    </div>\
    <div class="small" id="rpStatus" style="margin-top:6px;color:#bbb"></div>\
    <hr style="border:none;border-top:1px solid #222;margin:10px 0"/>\
    <div class="small" style="font-weight:600;margin-bottom:6px">Snabbkommandon</div>\
    <div id="hkList" class="small" style="display:grid;grid-template-columns:1fr auto auto;gap:6px;align-items:center"></div>';
    document.body.appendChild(panel);
    function fmt(v){ return 'x'+(v||1).toFixed(2); }
    function refreshVals(){ var id=function(s){ return document.getElementById(s); };
      if(id('slDmg')){ id('slDmg').value=String((Skills&&Skills.dmgMul)||1); id('slDmgV').textContent=fmt((Skills&&Skills.dmgMul)||1); }
      if(id('slRange')){ id('slRange').value=String((Skills&&Skills.rangeMul)||1); id('slRangeV').textContent=fmt((Skills&&Skills.rangeMul)||1); }
      if(id('slBank')){ id('slBank').value=String((Skills&&Skills.bankMul)||1); id('slBankV').textContent=fmt((Skills&&Skills.bankMul)||1); }
      if(id('slBounty')){ id('slBounty').value=String((Skills&&Skills.bountyMul)||1); id('slBountyV').textContent=fmt((Skills&&Skills.bountyMul)||1); }
      // Admin fields
      var sm=document.getElementById('devStartMoney'); if(sm) sm.value=String(Admin.startMoney||0);
      var sl=document.getElementById('devStartLives'); if(sl) sl.value=String(Admin.startLives||10);
      var ms=document.getElementById('devMaxSpeed'); if(ms) ms.value=String(Settings.maxSpeed||5);
      var cd=document.getElementById('devCostDmg'); if(cd) cd.value=String((Admin.upgCost&&Admin.upgCost.dmg)||30);
      var cr=document.getElementById('devCostRange'); if(cr) cr.value=String((Admin.upgCost&&Admin.upgCost.range)||25);
      var ct=document.getElementById('devCostRate'); if(ct) ct.value=String((Admin.upgCost&&Admin.upgCost.rate)||35);
  // Toggle button labels
      var tr=document.getElementById('devToggleRanges'); if(tr) tr.textContent = (Visuals.showAllRanges? 'Dölj räckvidd':'Visa räckvidd');
      var td=document.getElementById('devToggleDps'); if(td) td.textContent = (Visuals.showDps? 'Dölj DPS':'Visa DPS');
  var thc=document.getElementById('devToggleHC'); if(thc) thc.textContent = (Visuals.colorblindMode? 'Högkontrast: På':'Högkontrast: Av');
  var tm=document.getElementById('devToggleMotion'); if(tm) tm.textContent = (Visuals.reducedMotion? 'Minska rörelse: På':'Minska rörelse: Av');
    }
    function saveSnap(){ try{ var raw=JSON.parse(localStorage.getItem('td-settings-v1')||'{}'); raw._snapshot={ Skills: { ...(Skills||{}) } }; raw.ts=Date.now(); localStorage.setItem('td-settings-v1', JSON.stringify(raw)); }catch(e){} }
    function loadSnap(){ try{ var raw=JSON.parse(localStorage.getItem('td-settings-v1')||'{}'); var s=raw._snapshot; if(!s||!s.Skills) return; try{ Object.assign(Skills, s.Skills); }catch(_e){} if(typeof saveSkills==='function') saveSkills(); refreshVals(); }catch(e){} }
    var byId=function(id){ return document.getElementById(id); };
    var bind=function(id,key){ var el=byId(id); if(!el) return; el.addEventListener('input', function(){ var v=parseFloat(el.value)||1; try{ Skills[key]=v; if(typeof saveSkills==='function') saveSkills(); }catch(_e){} refreshVals(); }); };
    bind('slDmg','dmgMul'); bind('slRange','rangeMul'); bind('slBank','bankMul'); bind('slBounty','bountyMul');
    var btnClose=byId('devClose'); if(btnClose){ btnClose.addEventListener('click', function(){ panel.classList.add('hidden'); }); }
    var bS=byId('snapSave'), bL=byId('snapLoad'); if(bS) bS.onclick=saveSnap; if(bL) bL.onclick=loadSnap;
    // Admin: handlers
    var apply=byId('devApplyAdmin'); if(apply){ apply.addEventListener('click', function(){
      var cd=byId('devCostDmg'), cr=byId('devCostRange'), ct=byId('devCostRate');
      var ms=byId('devMaxSpeed');
      if(Admin.upgCost){
        Admin.upgCost.dmg = parseInt(cd && cd.value)||Admin.upgCost.dmg;
        Admin.upgCost.range = parseInt(cr && cr.value)||Admin.upgCost.range;
        Admin.upgCost.rate = parseInt(ct && ct.value)||Admin.upgCost.rate;
      }
      Settings.maxSpeed = Math.max(1, parseFloat(ms && ms.value)||Settings.maxSpeed);
      if(Settings.gameSpeed>Settings.maxSpeed){ if(typeof changeSpeed==='function'){ changeSpeed(Settings.maxSpeed); } else { Settings.gameSpeed=Settings.maxSpeed; } }
      alert('Admin inställningar uppdaterade.');
      refreshVals();
    }); }
    var sm=byId('devStartMoney'); if(sm){ sm.addEventListener('change', function(){ Admin.startMoney = parseInt(sm.value)||Admin.startMoney; State.money = Admin.startMoney; if(typeof moneyEl!=='undefined' && moneyEl){ moneyEl.textContent = State.money; } }); }
    var sl=byId('devStartLives'); if(sl){ sl.addEventListener('change', function(){ Admin.startLives = parseInt(sl.value)||Admin.startLives; State.lives = Admin.startLives; if(typeof livesEl!=='undefined' && livesEl){ livesEl.textContent = State.lives; } }); }
    var ms=byId('devMaxSpeed'); if(ms){ ms.addEventListener('change', function(){ Settings.maxSpeed = Math.max(1, parseFloat(ms.value)||Settings.maxSpeed); if(Settings.gameSpeed>Settings.maxSpeed){ if(typeof changeSpeed==='function'){ changeSpeed(Settings.maxSpeed); } else { Settings.gameSpeed=Settings.maxSpeed; } } refreshVals(); }); }
    var tR=byId('devToggleRanges'); if(tR){ tR.addEventListener('click', function(){ Visuals.showAllRanges = !Visuals.showAllRanges; try{ var raw=JSON.parse(localStorage.getItem('td-settings-v1')||'{}'); raw.Visuals = raw.Visuals||{}; raw.Visuals.showAllRanges = Visuals.showAllRanges; raw.ts=Date.now(); localStorage.setItem('td-settings-v1', JSON.stringify(raw)); }catch(e){} refreshVals(); }); }
    var tD=byId('devToggleDps'); if(tD){ tD.addEventListener('click', function(){ Visuals.showDps = !Visuals.showDps; try{ var raw=JSON.parse(localStorage.getItem('td-settings-v1')||'{}'); raw.Visuals = raw.Visuals||{}; raw.Visuals.showDps = Visuals.showDps; raw.ts=Date.now(); localStorage.setItem('td-settings-v1', JSON.stringify(raw)); }catch(e){} refreshVals(); }); }
    var tHC=byId('devToggleHC'); if(tHC){ tHC.addEventListener('click', function(){ Visuals.colorblindMode = !Visuals.colorblindMode; try{ var raw=JSON.parse(localStorage.getItem('td-settings-v1')||'{}'); raw.Visuals = raw.Visuals||{}; raw.Visuals.colorblindMode = Visuals.colorblindMode; raw.ts=Date.now(); localStorage.setItem('td-settings-v1', JSON.stringify(raw)); }catch(e){} try{ if(Visuals.colorblindMode){ document.documentElement.classList.add('td-hc'); document.body && document.body.classList.add('td-hc'); } else { document.documentElement.classList.remove('td-hc'); document.body && document.body.classList.remove('td-hc'); } }catch(_e){} refreshVals(); }); }
    var tRM=byId('devToggleMotion'); if(tRM){ tRM.addEventListener('click', function(){ Visuals.reducedMotion = !Visuals.reducedMotion; try{ var raw=JSON.parse(localStorage.getItem('td-settings-v1')||'{}'); raw.Visuals = raw.Visuals||{}; raw.Visuals.reducedMotion = Visuals.reducedMotion; raw.ts=Date.now(); localStorage.setItem('td-settings-v1', JSON.stringify(raw)); }catch(e){} refreshVals(); }); }
    var openAdm=byId('devOpenAdmin'); if(openAdm){ openAdm.addEventListener('click', function(){ try{ window.open('./ADMIN.html','_blank'); }catch(_e){ location.href='./ADMIN.html'; } }); }
    // Hotkeys list and rebinders
    (function(){ var host=byId('hkList'); if(!host) return; const entries=[
      ['startWave','Start våg'],['pause','Pausa/Fortsätt'],['toggleRanges','Visa räckvidd'],['toggleDps','Visa DPS'],['sellAll','Sälj alla'],['skills','Skills'],['admin','Admin'],['menu','Meny'],['undo','Ångra'],['select1','Välj torn 1'],['select2','Välj torn 2'],['select3','Välj torn 3'],['upgradeDamage','Uppgradera +DMG'],['cancel','Avbryt']
    ]; host.innerHTML=''; entries.forEach(function([key,label]){ const row=document.createElement('div'); row.style.display='contents'; const l=document.createElement('div'); l.textContent=label; const v=document.createElement('div'); v.id='hk_'+key; v.textContent=(Settings.hotkeys&&Settings.hotkeys[key])|| (defaultHotkeys[key]||''); const b=document.createElement('button'); b.className='btn-secondary'; b.textContent='Byt'; b.addEventListener('click', function(){ b.textContent='Tryck tangent…'; const onKey=function(ev){ ev.preventDefault(); const name=ev.key; Settings.hotkeys[key]=name; try{ persistSettings('Settings'); }catch(_e){} v.textContent=name; b.textContent='Byt'; window.removeEventListener('keydown', onKey, true); updateButtonTitles && updateButtonTitles(); }; window.addEventListener('keydown', onKey, true); }); host.appendChild(l); host.appendChild(v); host.appendChild(b); }); })();
    // Draggable panel
    (function(){
      var handle=byId('devHandle'); if(!handle) return; var dragging=false, offX=0, offY=0;
      var onMove=function(e){ if(!dragging) return; var x=e.clientX - offX; var y=e.clientY - offY; var maxX=window.innerWidth - panel.offsetWidth; var maxY=window.innerHeight - panel.offsetHeight; x=Math.max(0, Math.min(maxX, x)); y=Math.max(0, Math.min(maxY, y)); panel.style.left=x+'px'; panel.style.top=y+'px'; };
      var endDrag=function(){ dragging=false; document.removeEventListener('mousemove', onMove); };
      handle.addEventListener('mousedown', function(e){ if(e.button!==0) return; var r=panel.getBoundingClientRect(); dragging=true; offX=e.clientX - r.left; offY=e.clientY - r.top; document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', endDrag, { once:true }); e.preventDefault(); });
    })();
    refreshVals();
    return panel;
  }
  if(btnAdmin){ try{ btnAdmin.title='Klick: Dev-panel • Shift/Högerklick: Admin-sida'; }catch(_e){} }
  if(btnAdmin){
    btnAdmin.addEventListener('click', function(e){
      if(e.shiftKey){ e.preventDefault(); location.href='./ADMIN.html'; return; }
      e.preventDefault();
      var p=ensureDevPanel(); p.classList.toggle('hidden');
    });
    btnAdmin.addEventListener('contextmenu', function(e){ e.preventDefault(); location.href='./ADMIN.html'; });
    btnAdmin.addEventListener('auxclick', function(e){ if(e.button===1){ window.open('./ADMIN.html','_blank'); } });
  }
  var btnSkills=document.getElementById('btnSkills');
  var skillPanel=null; function ensureSkillPanel(){ if(skillPanel) return; skillPanel=document.createElement('div'); skillPanel.style.position='fixed'; skillPanel.style.background='rgba(10,10,10,0.95)'; skillPanel.style.border='1px solid #333'; skillPanel.style.borderRadius='10px'; skillPanel.style.padding='10px'; skillPanel.style.zIndex='999'; skillPanel.style.minWidth='220px'; skillPanel.className='hidden'; skillPanel.innerHTML='<div style="font-weight:600;margin-bottom:6px">Skills <span id="skPtsLbl">('+(Skills.points||0)+')</span></div>\
<div class="small" style="margin-bottom:6px;color:#bbb">Klicka för att spendera 1 SP.</div>\
<div style="display:grid;grid-template-columns:1fr auto auto;gap:6px;align-items:center">\
  <span>DMG</span><span id="skDmgVal">x'+(Skills.dmgMul||1).toFixed(2)+'</span><button id="skDmgUp">+1%</button>\
  <span>Range</span><span id="skRangeVal">x'+(Skills.rangeMul||1).toFixed(2)+'</span><button id="skRangeUp">+1%</button>\
  <span>Crit</span><span id="skCritVal">+'+(((Skills.critAdd||0)*100).toFixed(1))+'%</span><button id="skCritUp">+0.1%</button>\
  <span>Bank</span><span id="skBankVal">x'+(Skills.bankMul||1).toFixed(2)+'</span><button id="skBankUp">+1%</button>\
  <span>Bounty</span><span id="skBountyVal">x'+(Skills.bountyMul||1).toFixed(2)+'</span><button id="skBountyUp">+1%</button>\
</div>';
    document.body.appendChild(skillPanel);
    var pts=function(){ var val=(Skills.points||0); var lbl=document.getElementById('skPtsLbl'); if(lbl) lbl.textContent='('+val+')'; if(skillPtsEl) skillPtsEl.textContent=val; };
    var refresh=function(){ var fx=function(v){return 'x'+(v||1).toFixed(2)}; var px=function(v){return ((v||0)*100).toFixed(1)+'%'}; var D=document.getElementById('skDmgVal'); if(D) D.textContent=fx(Skills.dmgMul||1); var R=document.getElementById('skRangeVal'); if(R) R.textContent=fx(Skills.rangeMul||1); var C=document.getElementById('skCritVal'); if(C) C.textContent='+'+px(Skills.critAdd||0); var B=document.getElementById('skBankVal'); if(B) B.textContent=fx(Skills.bankMul||1); var Bo=document.getElementById('skBountyVal'); if(Bo) Bo.textContent=fx(Skills.bountyMul||1); var dis=((Skills.points||0)<=0); ['skDmgUp','skRangeUp','skCritUp','skBankUp','skBountyUp'].forEach(function(id){ var b=document.getElementById(id); if(b) b.disabled=dis; }); pts(); };
    var spend=function(cost, apply){ cost=cost||1; if((Skills.points||0)<cost) return; Skills.points-=cost; if(apply) apply(); saveSkills && saveSkills(); refresh(); };
    var _d=document.getElementById('skDmgUp'); if(_d) _d.onclick=function(){ spend(1, function(){ Skills.dmgMul=(Skills.dmgMul||1)+0.01; }); };
    var _r=document.getElementById('skRangeUp'); if(_r) _r.onclick=function(){ spend(1, function(){ Skills.rangeMul=(Skills.rangeMul||1)+0.01; }); };
    var _c=document.getElementById('skCritUp'); if(_c) _c.onclick=function(){ spend(1, function(){ Skills.critAdd=(Skills.critAdd||0)+0.001; }); };
    var _b=document.getElementById('skBankUp'); if(_b) _b.onclick=function(){ spend(1, function(){ Skills.bankMul=(Skills.bankMul||1)+0.01; }); };
    var _bo=document.getElementById('skBountyUp'); if(_bo) _bo.onclick=function(){ spend(1, function(){ Skills.bountyMul=(Skills.bountyMul||1)+0.01; }); };
    skillPanel._refresh = refresh;
    window.addEventListener('pointerdown', function(e){ if(!skillPanel || skillPanel.classList.contains('hidden')) return; if(e.target===skillPanel || skillPanel.contains(e.target) || e.target===btnSkills) return; skillPanel.classList.add('hidden'); });
  }
  if(btnSkills){ btnSkills.addEventListener('click',function(){ ensureSkillPanel(); var r = btnSkills.getBoundingClientRect(); skillPanel.style.left = Math.round(r.left)+'px'; skillPanel.style.top = Math.round(r.bottom+6)+'px'; skillPanel.classList.toggle('hidden'); if(!skillPanel.classList.contains('hidden') && skillPanel._refresh){ skillPanel._refresh(); } var lbl=document.getElementById('skPtsLbl'); if(lbl) lbl.textContent='('+(Skills.points||0)+')'; if(skillPtsEl) skillPtsEl.textContent = Skills.points||0; }); }
  var btnMenu=document.getElementById('btnMenu'); if(btnMenu){ btnMenu.addEventListener('click',()=>{ location.href='./START.html'; }); }
  var btnRestart=document.getElementById('btnRestart'); if(btnRestart){ btnRestart.addEventListener('click',()=>{ if(!confirm('Starta om spelet och återställ till standardvärden?')) return; try{ localStorage.removeItem('td-settings-v1'); }catch(e){} location.reload(); }); }
  var btnReloadSettings=document.getElementById('btnReloadSettings'); if(btnReloadSettings){ btnReloadSettings.addEventListener('click',()=>{ try{ const raw=JSON.parse(localStorage.getItem('td-settings-v1')||'{}'); if(raw){
      _Map = raw.MapSettings || _Map; _Set = raw.Settings || _Set; _Vis = raw.Visuals || _Vis; _Admin = raw.Admin || _Admin;
      Settings.maxSpeed = _Set.maxSpeed||Settings.maxSpeed; Settings.buildMode = _Set.buildMode||Settings.buildMode;
      Visuals.pathWidth = _Vis.pathWidth||Visuals.pathWidth; Visuals.showGrid = (_Vis.showGrid!==undefined)?_Vis.showGrid:Visuals.showGrid;
      Admin.startMoney = _Admin.startMoney||Admin.startMoney; Admin.startLives = _Admin.startLives||Admin.startLives; Admin.upgCost = _Admin.upgCost||Admin.upgCost;
      if(raw.TOWER_TYPES){ for(const id in raw.TOWER_TYPES){ TOWER_TYPES[id] = { ...(TOWER_TYPES[id]||{}), ...raw.TOWER_TYPES[id], id }; } }
    }
    alert('Inställningar laddades (fallback).'); }catch(e){ alert('Kunde inte ladda inställningar.'); } }); }
  var btnBuildMode=document.getElementById('btnBuildMode'); if(btnBuildMode){ btnBuildMode.addEventListener('click',()=>{ btnBuildMode.textContent = (btnBuildMode.textContent.includes('Paint')?'Bygg-läge: Single':'Bygg-läge: Paint'); }); }
  // Hotkey tooltips for main buttons
  function updateButtonTitles(){ try{
    if(startWaveBtn) startWaveBtn.title = 'Starta våg ['+((Settings.hotkeys&&Settings.hotkeys.startWave)||defaultHotkeys.startWave||'')+']';
    if(btnPause) btnPause.title = 'Pausa/Fortsätt ['+((Settings.hotkeys&&Settings.hotkeys.pause)||defaultHotkeys.pause||'')+']';
    if(btnSpeed) btnSpeed.title = 'Hastighet ± ['+((Settings.hotkeys&&Settings.hotkeys.speedUp)||'+')+'/'+((Settings.hotkeys&&Settings.hotkeys.speedDown)||'-')+']';
    if(btnRanges) btnRanges.title = 'Visa räckvidd ['+((Settings.hotkeys&&Settings.hotkeys.toggleRanges)||defaultHotkeys.toggleRanges||'')+']';
    if(btnDps) btnDps.title = 'Visa DPS ['+((Settings.hotkeys&&Settings.hotkeys.toggleDps)||defaultHotkeys.toggleDps||'')+']';
    if(sellAllBtn) sellAllBtn.title = 'Sälj alla ['+((Settings.hotkeys&&Settings.hotkeys.sellAll)||defaultHotkeys.sellAll||'')+']';
    var bSk=document.getElementById('btnSkills'); if(bSk) bSk.title = 'Skills ['+((Settings.hotkeys&&Settings.hotkeys.skills)||defaultHotkeys.skills||'')+']';
    if(btnAdmin) btnAdmin.title = 'Dev/Admin ['+((Settings.hotkeys&&Settings.hotkeys.admin)||defaultHotkeys.admin||'')+']';
    if(btnMenu) btnMenu.title = 'Meny ['+((Settings.hotkeys&&Settings.hotkeys.menu)||defaultHotkeys.menu||'')+']';
  }catch(_e){} }
  updateButtonTitles();
  function updateLabels(){moneyEl.textContent=Math.max(0,Math.floor(State.money));livesEl.textContent=State.lives;waveEl.textContent=State.currentWave;speedLbl.textContent=Settings.gameSpeed.toFixed(2)+'×'; if(incomeEl){ incomeEl.textContent = State.lastRoundIncome?('+'+State.lastRoundIncome):'0'; } if(skillPtsEl){ skillPtsEl.textContent = Skills.points||0; } var bb=document.getElementById('bountyBoost'); if(bb){ bb.style.display = State.bountyBoostActive? '':'none'; }}
  refreshTowerButtons();
  function loop(){const t=performance.now();let dt=Math.min(0.05,(t-(loop._last||t))/1000);loop._last=t;handleSpawning(dt);for(const e of State.enemies)e.update(dt);for(let i=State.enemies.length-1;i>=0;i--){const e=State.enemies[i];if(e.hp<=0){var bmul=(Skills&&Skills.bountyMul)||1; if(State.bountyBoostActive) bmul*=1.25; State.money+=Math.floor(e.worth*bmul); if(e.boss){ Skills.points=(Skills.points||0)+1; } State.enemies.splice(i,1)}else if(e.reached){State.lives--;State.enemies.splice(i,1)}}for(const tt of State.towers)tt.update(dt);for(const p of State.projectiles)p.update(dt);for(let i=State.projectiles.length-1;i>=0;i--){const p=State.projectiles[i];if(p.hit||p.lost)State.projectiles.splice(i,1)}
    // simple end-of-wave bank payout (once per wave)
  if(!State.waveInProgress&&State.spawnQueue.length===0&&State.enemies.length===0){ const waveId=State.currentWave; if(waveId!==State.lastPayoutWave){ let inc=0; for(const t2 of State.towers){ if(t2&&t2.def&&t2.def.income){ inc += Math.floor(t2.def.income*(1+0.2*t2.levels.dmg)*(1+0.1*t2.levels.range)*(1+0.15*t2.levels.rate)); } } inc=Math.floor(inc*((Skills&&Skills.bankMul)||1)); if(_Map.bankIncomeCap>0 && inc>_Map.bankIncomeCap){ var over=inc-_Map.bankIncomeCap; inc = Math.floor(_Map.bankIncomeCap + over * Math.max(0, Math.min(1, _Map.bankCapSoftness==null?0.5:_Map.bankCapSoftness))); } if(inc>0){ State.money+=inc; State.lastRoundIncome=inc; } if(State.currentWave>0&&State.currentWave%3===0){ Skills.points=(Skills.points||0)+1; } if(State.currentWave>0&&State.currentWave%5===0){ State.bountyBoostNext=(State.bountyBoostNext||0)+1; } State.bountyBoostActive=false; State.lastPayoutWave=waveId; } }
    // Keep DOM icons aligned to the canvas position
    try{
      if(overlay && State.towers && State.towers.length){
  const cr = canvas.getBoundingClientRect();
  const or = overlay.getBoundingClientRect();
  const s = (cr.width/ canvas.width) || 1;
  const cs = getComputedStyle(canvas);
  const bL = parseFloat(cs.borderLeftWidth)||0;
  const bT = parseFloat(cs.borderTopWidth)||0;
  for(const tw of State.towers){ if(!tw || !tw._node) continue; tw._node.style.left = ((cr.left - or.left) + bL + tw.x * s) + 'px'; tw._node.style.top = ((cr.top - or.top) + bT + tw.y * s) + 'px'; }
      }
    }catch(_e){}
    ctx.clearRect(0,0,canvas.width,canvas.height);
    drawGrid();
    drawPath();
    for(const tt of State.towers)tt.draw(ctx);
    for(const e of State.enemies)e.draw(ctx);
    for(const p of State.projectiles)p.draw(ctx);
    // Environment overlays
    drawBridges();
  drawEnvObjects();
    drawMatrixOverlay();
    drawMatrixRain();
    // UI overlays
    drawOverlay();
    updateLabels();
    if(State.lives<=0){alert('Game Over!');try{ if(overlay) overlay.innerHTML=''; }catch(_e){} State.money=Admin.startMoney;State.lives=Admin.startLives;State.currentWave=0;State.waveInProgress=false;State.enemies.length=0;State.towers.length=0;State.projectiles.length=0;State.spawnQueue.length=0;State.spawnTimer=0}
    requestAnimationFrame(loop)
  }
  changeSpeed(1); requestAnimationFrame(loop);
})();
