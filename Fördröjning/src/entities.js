import { Settings, Visuals, MapModifiers, Skills } from './constants.js';
import { TILE } from './constants.js';
import { sampleAt, totalLen } from './path.js';
import { dist } from './math.js';
import { State } from './state.js';

export class Enemy{
  constructor(hp,speed,worth){
  this.hp=hp; this.maxHp=hp; this.speed=speed; this.worth=worth;
  // spline-based travel along distance s on centerline with lane offset
  this.s=0; { const r = (State.rng?.random?.()||Math.random()); this.lane = ((r<0.5)?-1:1) * 6; } // subtle lane offset
  const p0 = sampleAt(0, this.lane); this.pos={x:p0.x,y:p0.y}; this.reached=false; this.slow=1;
  this._carry=0; // legacy
  this._poison = null; // {dps, until}
  this._markedUntil = 0; // mark debuff (spotter)
  this._revealedUntil = 0; // reveal stealth (not yet using stealth flag)
  this.stealth = false; // invisible to non-reveal towers unless revealed
  this.immuneSlow = false; // boss/elite immunity to slows
  this.boss = false; // draw bigger and give bonus worth
  }
  update(dt){
    if(this.reached) return;
  // Handle thaw: reset slow when expired
  if(this._slowUntil && performance.now() >= this._slowUntil){ this.slow = 1; this._slowUntil = 0; }
  // Poison tick
  if(this._poison){ this.hp -= this._poison.dps * dt; if(performance.now() >= this._poison.until){ this._poison=null; } }
    const step = dt * Settings.gameSpeed * this.speed * this.slow;
    this.s += step; const p = sampleAt(this.s, this.lane); this.pos.x=p.x; this.pos.y=p.y; if(this.s >= totalLen-2){ this.reached=true; }
  }
  draw(ctx){
  const now = performance.now();
  const isRevealed = (this._revealedUntil||0) > now;
  const baseR = this.boss ? 16 : 12;
  const r = baseR;
  ctx.save();
  // drop shadow for depth
  ctx.fillStyle='rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(this.pos.x, this.pos.y+4, r*0.9, r*0.6, 0, 0, Math.PI*2); ctx.fill();
  // body
  if(this.stealth && !isRevealed){ ctx.globalAlpha = 0.35; }
  ctx.fillStyle = this.boss ? '#a3c' : '#c33';
  ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(this.pos.x,this.pos.y,r,0,Math.PI*2); ctx.fill(); ctx.stroke();
  // hp bar
  const w=26; const hpPct=Math.max(0, this.hp/this.maxHp); ctx.fillStyle='rgba(0,0,0,0.7)'; ctx.fillRect(this.pos.x-w/2,this.pos.y-18,w,4);
  ctx.fillStyle= hpPct>0.5 ? '#4caf50' : (hpPct>0.25 ? '#f9c74f' : '#f94144'); ctx.fillRect(this.pos.x-w/2,this.pos.y-18,w*hpPct,4);
  ctx.restore();
  }
}

export class Tower{
  constructor(x,y,def){ this.x=x; this.y=y; this.type=def.id; this.def=JSON.parse(JSON.stringify(def)); this.timer=0; this.levels={dmg:0,range:0,rate:0}; this._scanCooldown=0; this._candidates=null; 
    this.targetMode = 'first'; // 'first' | 'last' | 'strong' | 'close'
    this._manualTarget = null; // Enemy or null
    this._dmgLog = []; // [{t,amount}] for DPS overlay
  this._spent = def.cost||0; // money invested into this tower (base + upgrades)
  // Stats
  this._totalDamage = 0;
  this._waveDamage = 0;
  this._kills = 0;
  this._waveKills = 0;
    // Map modifiers
    const c = Math.floor(this.x / TILE), r = Math.floor(this.y / TILE);
    this._boost = Array.isArray(MapModifiers?.boostPads) && MapModifiers.boostPads.some(t=>t.c===c && t.r===r);
    this._cursed = Array.isArray(MapModifiers?.cursedTiles) && MapModifiers.cursedTiles.some(t=>t.c===c && t.r===r);
  }
  getStats(){ let dmg=this.def.dmg*(1+0.5*this.levels.dmg) * (Skills.dmgMul||1); let range=(this.def.range+10*this.levels.range) * (Skills.rangeMul||1); let fireRate=Math.max(0.05,this.def.fireRate*(1-0.12*this.levels.rate)); fireRate*= Math.max(0.5, (Skills.rofMul||1)); const critChance=(this.def.critChance||0) + (Skills.critAdd||0); const critMult=(this.def.critMult||1.5);
    if(this._boost){ const b=MapModifiers?.boost||{rangeMul:1,rofMul:1}; range*= (b.rangeMul||1); fireRate*= (b.rofMul||1); }
    return {dmg,range,fireRate,critChance,critMult}; }
  // Income per round for bank-like towers; upgrades increase income instead of combat stats
  getIncomePerRound(){
    if(!this.def.income) return 0;
    // Base scaling: dmg +20% each, range +10% each, rate +15% each
    const mul = (1 + 0.20*this.levels.dmg) * (1 + 0.10*this.levels.range) * (1 + 0.15*this.levels.rate);
    let inc = this.def.income * mul * (Skills.bankMul||1);
    if(this._boost){ const b=MapModifiers?.boost||{}; if(b.incomeMul) inc *= b.incomeMul; }
    return inc;
  }
  _logDamage(amount){
    if(!(amount>0)) return; const now=performance.now(); this._dmgLog.push({t:now,amount});
    // prune > 3s old
    while(this._dmgLog.length && now - this._dmgLog[0].t > 3000) this._dmgLog.shift();
  // accumulate totals
  this._totalDamage += amount;
  this._waveDamage += amount;
  }
  _pickTarget(cands, stats){
    const now=performance.now();
    // Prefer manual target if valid
    if(this._manualTarget && !this._manualTarget.reached && this._manualTarget.hp>0){
      if(!(this._manualTarget.stealth && (this._manualTarget._revealedUntil||0) <= now && !this.def.reveal)){
        const d = dist({x:this.x,y:this.y}, this._manualTarget.pos); if(d <= stats.range) return this._manualTarget;
      }
    }
    let best=null, bestScore=-1e9;
    for(const e of cands){
      if(!e || e.reached) continue;
      if(e.stealth && (e._revealedUntil||0) <= now && !this.def.reveal) continue;
      const d = dist({x:this.x,y:this.y}, e.pos); if(d>stats.range) continue;
      let score=0;
      switch(this.targetMode){
        case 'first': score = (e.s||0); break;
        case 'last': score = -(e.s||0); break;
        case 'strong': score = e.hp; break;
        case 'close': default: score = -d; break;
      }
      if(score>bestScore){ bestScore=score; best=e; }
    }
    return best;
  }
  update(dt, enemies, projectiles, spatial){
    // Banks (income towers) do not attack
    if(this.def.income){ return; }
    this.timer -= dt * Settings.gameSpeed;
    // Re-scan less often using spatial hash to reduce O(N^2)
    this._scanCooldown -= dt * Settings.gameSpeed;
    const stats = this.getStats();
    if(this._scanCooldown <= 0){
      if(spatial){ this._candidates = spatial.queryCircle(this.x, this.y, stats.range); }
      else { this._candidates = enemies; }
      this._scanCooldown = Math.max(0.05, stats.fireRate * 0.5);
    }
    if(this.timer <= 0){
      const source = this._candidates || enemies;
      const target = this._pickTarget(source, stats);
      if(target){
        if(this.def.aoe) projectiles.push(new Projectile(this.x,this.y,target,stats.dmg * dmgMult(target),'splash',this.def.aoe,1,0,this));
        else if(this.def.slow) projectiles.push(new Projectile(this.x,this.y,target,stats.dmg * dmgMult(target),'frost',0,this.def.slow,this.def.slowTime||1.2,this));
        else if(this.def.dot) { const p=new Projectile(this.x,this.y,target,stats.dmg * dmgMult(target),'poison',0,1,0,this); p.dotDps=this.def.dot; p.dotTime=(this.def.dotTime||2.5)*1000; projectiles.push(p); }
        else if(this.def.chain){ const p=new Projectile(this.x,this.y,target,stats.dmg * dmgMult(target),'chain',0,1,0,this); p.chain=this.def.chain; projectiles.push(p); }
        else if(this.def.mark){ const p=new Projectile(this.x,this.y,target,0,'mark',0,1,0,this); p.mark=this.def.mark; p.reveal=!!this.def.reveal; projectiles.push(p); }
        else {
          const p=new Projectile(this.x,this.y,target,stats.dmg * dmgMult(target),'bullet',0,1,0,this);
          p.critChance = (this.def.critChance||0); p.critMult=(this.def.critMult||1.5);
          projectiles.push(p);
        }
        this.timer = stats.fireRate;
      }
    }
  }
  draw(ctx){
    // Special design for income tower: coin stack icon
    if(this.def.income){
      ctx.save();
      // Base pad
      ctx.fillStyle='#2b2b2b'; ctx.beginPath(); ctx.arc(this.x,this.y,18,0,Math.PI*2); ctx.fill();
      // Coin body
      ctx.fillStyle=this.def.color||'#fc6';
      ctx.strokeStyle='#000';
      for(let i=0;i<3;i++){
        const off = 8 - i*6;
        ctx.beginPath(); ctx.ellipse(this.x, this.y+off, 12, 6, 0, 0, Math.PI*2); ctx.fill(); ctx.stroke();
      }
      // Currency mark
      ctx.fillStyle='#000'; ctx.font='bold 12px system-ui'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('¤', this.x, this.y-2);
      ctx.restore();
    } else {
      ctx.fillStyle=this.def.color; ctx.beginPath(); ctx.arc(this.x,this.y,18,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#111'; ctx.fillRect(this.x-8,this.y-6,16,12);
    }
    const lvl=this.levels.dmg+this.levels.range+this.levels.rate; if(lvl>0){ ctx.fillStyle='gold'; ctx.beginPath(); ctx.arc(this.x+12,this.y-12,6,0,Math.PI*2); ctx.fill(); ctx.fillStyle='#000'; ctx.font='10px monospace'; ctx.fillText(lvl,this.x+10,this.y-9); }
  }
}

export class Projectile{
  constructor(x,y,target,dmg,type='bullet',aoe=0,slowFactor=1, slowTime=0, sourceTower=null){ this.x=x; this.y=y; this.target=target; this.dmg=dmg; this.type=type; this.aoe=aoe; this.slowFactor=slowFactor; this.slowTime=slowTime; this.speed=520; this.hit=false; this.lost=false; this.critChance=0; this.critMult=1.5; this._source=sourceTower; }
  update(dt, enemies){
    if(!this.target || this.target.reached || this.target.hp<=0){ this.lost=true; return; }
    const dx=this.target.pos.x-this.x, dy=this.target.pos.y-this.y; const d=Math.hypot(dx,dy);
    if(d<6){
      const addDn = (e, dmg, color='#fff')=>{
        if(!Visuals.showDamageNumbers) return;
        e._dn = e._dn || [];
        e._dn.push({t:0,x:e.pos.x,y:e.pos.y-16,val:Math.round(dmg),col:color});
        if(e._dn.length>8) e._dn.shift();
      };
      const applyCrit = (base)=>{
        // Mark/Frost synergy: slight crit bonus if marked or slowed
        const now=performance.now();
        let bonus=0;
        if((this.target._markedUntil||0)>now) bonus += 0.1;
        if(this.target.slow<1) bonus += 0.05;
        const chance = Math.min(0.9, (this.critChance||0) + bonus);
        {
          const r = (State.rng?.random?.()||Math.random());
          if(r<chance){ return {dmg:base*(this.critMult||1.5), crit:true}; }
        }
        return {dmg:base, crit:false};
      };
  if(this.type==='splash'){ for(const e of enemies){ if(dist(e.pos,this.target.pos) <= this.aoe){ e.hp -= this.dmg; e._lastHitBy = this._source || e._lastHitBy; addDn(e,this.dmg,'#ffb'); if(this._source) this._source._logDamage(this.dmg); } } }
      else if(this.type==='frost'){
  this.target.hp -= this.dmg; this.target._lastHitBy = this._source || this.target._lastHitBy; addDn(this.target,this.dmg,'#bdf'); if(this._source) this._source._logDamage(this.dmg);
        if(!this.target.immuneSlow){
          this.target.slow = Math.min(this.target.slow, this.slowFactor);
          const resetAt = performance.now() + this.slowTime*1000;
          // simple timeout via flag check in update; not using setTimeout to keep deterministic
          this.target._slowUntil = Math.max(this.target._slowUntil||0, resetAt);
        }
      }
      else if(this.type==='chain'){
        // deal to primary
  this.target.hp -= this.dmg; this.target._lastHitBy = this._source || this.target._lastHitBy; addDn(this.target,this.dmg,'#cdf'); if(this._source) this._source._logDamage(this.dmg);
        // jump to nearby enemies up to max
        let prev = this.target; let remain = Math.max(0, (this.chain?.max||0)-1); let dmg=this.dmg; const range=this.chain?.range||100; const fall=this.chain?.falloff||0.7;
        const used = new Set([prev]);
        while(remain>0){
          let best=null, bestD=1e9;
          for(const e of enemies){ if(!e||e.reached||used.has(e)) continue; const dd=dist(prev.pos,e.pos); if(dd<=range && dd<bestD){ best=e; bestD=dd; } }
          if(!best) break; dmg*=fall; best.hp -= dmg; addDn(best,dmg,'#cfe'); if(this._source) this._source._logDamage(dmg); used.add(best); prev=best; remain--; }
      }
      else if(this.type==='mark'){
        const now=performance.now(); this.target._markedUntil=Math.max(this.target._markedUntil||0, now + (this.mark?.duration||2.5)*1000);
        if(this.reveal) this.target._revealedUntil=Math.max(this.target._revealedUntil||0, now + (this.mark?.duration||2.5)*1000);
      }
      else if(this.type==='poison'){
  this.target.hp -= this.dmg; this.target._lastHitBy = this._source || this.target._lastHitBy; addDn(this.target,this.dmg,'#cfc'); if(this._source) this._source._logDamage(this.dmg);
        const now = performance.now();
        const dps = this.dotDps || 2; const dur = this.dotTime || 2500;
        const until = now + dur;
        this.target._poison = { dps, until: Math.max(until, (this.target._poison?.until||0)) };
      }
      else {
        const res = applyCrit(this.dmg);
  this.target.hp -= res.dmg; this.target._lastHitBy = this._source || this.target._lastHitBy; addDn(this.target,res.dmg, res.crit ? '#ff8' : '#ffd'); if(this._source) this._source._logDamage(res.dmg);
        // hit flash circle
        this._fx = {t:0,x:this.target.pos.x,y:this.target.pos.y, r:10, col: res.crit?'rgba(255,255,80,0.5)':'rgba(255,255,255,0.35)'};
      }
      this.hit=true; return;
    }
    const step = this.speed * dt * Settings.gameSpeed;
    this.x += dx/d * step; this.y += dy/d * step;
  }
  draw(ctx){ let col='#ffd'; if(this.type==='splash') col='#faa'; if(this.type==='frost') col='#9ef'; if(this.type==='poison') col='#9f9'; if(this.type==='chain') col='#cdf'; if(this.type==='mark') col='#ffb'; ctx.fillStyle=col; ctx.beginPath(); ctx.arc(this.x,this.y,4,0,Math.PI*2); ctx.fill(); if(this._fx){ this._fx.t+=1/60; const a=Math.max(0,1-this._fx.t*2); if(a>0){ ctx.save(); ctx.globalAlpha=a; ctx.strokeStyle=this._fx.col; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(this._fx.x,this._fx.y, this._fx.r*(1+this._fx.t*2), 0, Math.PI*2); ctx.stroke(); ctx.restore(); } else { this._fx=null; } } }
}

function dmgMult(e){
  const now=performance.now();
  const marked = (e._markedUntil||0) > now ? 1.2 : 1.0;
  return marked;
}

// Extend Enemy prototype to render damage numbers (lightweight; avoids circular import)
Enemy.prototype.draw = (function(orig){
  return function(ctx){
    orig.call(this, ctx);
    if(!Visuals.showDamageNumbers) return;
    const arr = this._dn; if(!arr || !arr.length) return;
    for(let i=arr.length-1;i>=0;i--){ const dn=arr[i]; dn.t+= (16/1000); dn.y -= 18*(1/60); const a=Math.max(0,1-dn.t*0.9); if(a<=0){ arr.splice(i,1); continue; } ctx.globalAlpha=a; ctx.fillStyle=dn.col||'#fff'; ctx.font='12px monospace'; ctx.fillText(String(dn.val), dn.x-6, dn.y); ctx.globalAlpha=1; }
  }
})(Enemy.prototype.draw);
