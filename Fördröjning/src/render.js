import { TILE, Visuals } from './constants.js';
import { path, samples, pathStart, pathGoal, routes, activeMapEnv } from './path.js';

let bgCanvas = null, bgCtx = null;
let rangesCanvas = null, rangesCtx = null, lastRangesSig = '';

// Lightweight Matrix rain overlay state (per-canvas)
let matrixState = {
  w: 0, h: 0, cols: 0, colW: 18, y: [],
  font: '14px monospace', glyphs: '01', speedMin: 80, speedMax: 160,
  speeds: [], lastTs: 0
};

function ensureMatrixState(canvas){
  if(!canvas) return;
  const w = canvas.width|0, h = canvas.height|0;
  if(matrixState.w !== w || matrixState.h !== h){
    matrixState.w = w; matrixState.h = h;
    matrixState.cols = Math.max(10, Math.floor(w / matrixState.colW));
    matrixState.y = new Array(matrixState.cols).fill(0).map(() => -Math.random()*h);
    matrixState.speeds = new Array(matrixState.cols).fill(0).map(() => matrixState.speedMin + Math.random()*(matrixState.speedMax-matrixState.speedMin));
    matrixState.lastTs = 0;
  }
}

function drawMatrixRain(ctx, canvas){
  try{
    const mx = activeMapEnv?.matrix; if(!mx?.on || !mx?.rain) return;
    ensureMatrixState(canvas);
    const now = performance.now();
    if(!matrixState.lastTs) matrixState.lastTs = now;
    const dt = Math.min(0.05, (now - matrixState.lastTs) / 1000); // clamp
    matrixState.lastTs = now;
    const cols = matrixState.cols, w = matrixState.w, h = matrixState.h;
    const colW = matrixState.colW; const glyphs = matrixState.glyphs;
    ctx.save();
    ctx.font = matrixState.font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    // Slightly fade previous frame for trailing effect
    ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillRect(0,0,w,h);
    for(let i=0;i<cols;i++){
      const x = Math.floor(i*colW + colW*0.5);
      // advance
      matrixState.y[i] += matrixState.speeds[i] * dt;
      let y = matrixState.y[i];
      // draw a short chain of glyphs
      const chain = 8; // keep light
      for(let k=0;k<chain;k++){
        const yy = Math.floor(y - k*16);
        if(yy>=-20 && yy<h+20){
          const ch = glyphs[(i + k) % glyphs.length];
          const alpha = Math.max(0, 0.08 + (1 - k/chain)*0.35);
          ctx.fillStyle = `rgba(120, 255, 120, ${alpha})`;
          ctx.fillText(ch, x, yy);
        }
      }
      if(y > h + 60){
        matrixState.y[i] = -Math.random()*h*0.5;
        matrixState.speeds[i] = matrixState.speedMin + Math.random()*(matrixState.speedMax-matrixState.speedMin);
      }
    }
    ctx.restore();
  }catch(_e){}
}

// Public wrapper to render Matrix rain as a TOP overlay (after entities)
export function drawMatrixTop(ctx, canvas){
  drawMatrixRain(ctx, canvas);
}

export function drawGrid(ctx, canvas){
  if(!Visuals.showGrid) return;
  ctx.strokeStyle = '#131313'; ctx.lineWidth=1;
  for(let x=0;x<canvas.width;x+=TILE){ ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,canvas.height); ctx.stroke(); }
  for(let y=0;y<canvas.height;y+=TILE){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(canvas.width,y); ctx.stroke(); }
}

export function initBackground(canvas){
  bgCanvas = document.createElement('canvas');
  bgCanvas.width = canvas.width; bgCanvas.height = canvas.height;
  bgCtx = bgCanvas.getContext('2d');
  // draw static background once
  drawGrid(bgCtx, canvas);
  // Draw smooth path(s) using samples
  const allRoutes = (routes && routes.length) ? routes : [{ samples, points: path }];
  if(allRoutes[0].samples && allRoutes[0].samples.length>1){
    const w = Visuals.pathWidth;
    for(const r of allRoutes){
      const smp = r.samples||[]; if(smp.length<2) continue;
      bgCtx.save();
      // base
      bgCtx.strokeStyle='#2a2a2a'; bgCtx.lineWidth=w; bgCtx.lineCap='round';
      bgCtx.beginPath(); bgCtx.moveTo(smp[0].x, smp[0].y);
      for(const s of smp){ bgCtx.lineTo(s.x, s.y); }
      bgCtx.stroke();
      // inner highlight
      bgCtx.strokeStyle='rgba(255,255,255,0.06)'; bgCtx.lineWidth=Math.max(6, w*0.55);
      bgCtx.beginPath(); bgCtx.moveTo(smp[0].x, smp[0].y);
      for(const s of smp){ bgCtx.lineTo(s.x, s.y); }
      bgCtx.stroke();
      // edge strokes for depth
      bgCtx.strokeStyle='rgba(0,0,0,0.35)'; bgCtx.lineWidth=Math.max(4, w*0.08);
      bgCtx.beginPath(); bgCtx.moveTo(smp[0].x, smp[0].y);
      for(const s of smp){ bgCtx.lineTo(s.x, s.y); }
      bgCtx.stroke();
      bgCtx.restore();
    }
  } else {
    // fallback to polyline path
    const pr = (routes && routes.length) ? routes : [{ points: path }];
    for(const r of pr){ const pts=r.points||[]; if(pts.length<2) continue; bgCtx.save(); bgCtx.strokeStyle='#2a2a2a'; bgCtx.lineWidth=Visuals.pathWidth; bgCtx.lineCap='round'; bgCtx.beginPath(); bgCtx.moveTo(pts[0].x,pts[0].y); for(const p of pts){ bgCtx.lineTo(p.x,p.y); } bgCtx.stroke(); bgCtx.restore(); }
  }
}

export function drawWorld(ctx, canvas){
  if(bgCanvas && bgCanvas.width===canvas.width && bgCanvas.height===canvas.height){
    ctx.drawImage(bgCanvas, 0, 0);
  } else {
    // fallback if sizes changed
    drawGrid(ctx, canvas);
    const allRoutes = (routes && routes.length) ? routes : [{ samples, points: path }];
    if(allRoutes[0].samples && allRoutes[0].samples.length>1){
      const w = Visuals.pathWidth; ctx.save();
      for(const r of allRoutes){ const smp=r.samples||[]; if(smp.length<2) continue; ctx.strokeStyle='#2a2a2a'; ctx.lineWidth=w; ctx.lineCap='round'; ctx.beginPath(); ctx.moveTo(smp[0].x, smp[0].y); for(const s of smp){ ctx.lineTo(s.x,s.y); } ctx.stroke(); ctx.strokeStyle='rgba(255,255,255,0.06)'; ctx.lineWidth=Math.max(6, w*0.55); ctx.beginPath(); ctx.moveTo(smp[0].x, smp[0].y); for(const s of smp){ ctx.lineTo(s.x,s.y); } ctx.stroke(); ctx.strokeStyle='rgba(0,0,0,0.35)'; ctx.lineWidth=Math.max(4, w*0.08); ctx.beginPath(); ctx.moveTo(smp[0].x, smp[0].y); for(const s of smp){ ctx.lineTo(s.x,s.y); } ctx.stroke(); }
      ctx.restore();
    } else {
      const pr=(routes && routes.length) ? routes : [{ points: path }];
      for(const r of pr){ const pts=r.points||[]; if(pts.length<2) continue; ctx.save(); ctx.strokeStyle='#2a2a2a'; ctx.lineWidth=Visuals.pathWidth; ctx.lineCap='round'; ctx.beginPath(); ctx.moveTo(pts[0].x,pts[0].y); for(const p of pts){ ctx.lineTo(p.x,p.y); } ctx.stroke(); ctx.restore(); }
    }
  }
  // Matrix tint background overlay (per-map)
  try{
    const mx = activeMapEnv?.matrix; if(mx?.on){
      ctx.save();
      // Stronger visible effect: base multiply + subtle screen to push green
      const tint = mx.tint || '#113311';
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = (tint + 'cc'); // ~80% strength
      ctx.fillRect(0,0,canvas.width,canvas.height);
      // Light screen pass for glow
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = (tint + '22');
      ctx.fillRect(0,0,canvas.width,canvas.height);
      // Optional scanlines for Matrix vibe
      ctx.globalCompositeOperation = 'overlay';
      ctx.strokeStyle = 'rgba(80,255,120,0.06)';
      ctx.lineWidth = 1;
      for(let y=2;y<canvas.height;y+=4){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(canvas.width,y); ctx.stroke(); }
      ctx.restore();
    }
  }catch(_e){}
  // Note: Matrix rain is drawn as a top overlay from main loop
  // Bridges: draw as lighter asphalt bands to suggest overpass
  try{
    const br = activeMapEnv?.bridges; if(Array.isArray(br)){
      for(const b of br){
        ctx.save();
        // Stronger, obvious bridge style with diagonal hatching
        ctx.fillStyle = 'rgba(120,180,240,0.18)';
        ctx.strokeStyle = 'rgba(150,210,255,0.7)';
        ctx.lineWidth = 3;
        ctx.fillRect(b.x, b.y, b.w, b.h);
        ctx.strokeRect(b.x, b.y, b.w, b.h);
        // Hatching
        ctx.save();
        ctx.beginPath();
        ctx.rect(b.x, b.y, b.w, b.h);
        ctx.clip();
        ctx.strokeStyle = 'rgba(150,210,255,0.35)';
        ctx.lineWidth = 1;
        for(let x=b.x- b.h; x<b.x+b.w+b.h; x+=10){
          ctx.beginPath(); ctx.moveTo(x, b.y); ctx.lineTo(x+b.h, b.y+b.h); ctx.stroke();
        }
        ctx.restore();
        // Label
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.font = 'bold 12px system-ui';
        ctx.textAlign = 'center'; ctx.textBaseline='middle';
        ctx.fillText('BRO', b.x + b.w/2, b.y + b.h/2);
        ctx.restore();
      }
    }
  }catch(_e){}
  // Static environment props (trees, pillars, consoles, emitters)
  try{
    const objs = activeMapEnv?.objects; if(Array.isArray(objs)){
      for(const o of objs){
        if(o.type==='bridge') continue; // already drawn via bridges above
        if(o.w && o.h){
          ctx.save();
          ctx.fillStyle = o.color || 'rgba(60,200,255,0.15)';
          ctx.strokeStyle = 'rgba(140,200,255,0.35)';
          ctx.lineWidth = 1.5;
          ctx.fillRect(o.x, o.y, o.w, o.h);
          ctx.strokeRect(o.x, o.y, o.w, o.h);
          ctx.restore();
        } else {
          const r = Math.max(3, Math.floor((o.r||10)));
          ctx.save();
          ctx.beginPath(); ctx.arc(o.x, o.y, r, 0, Math.PI*2);
          ctx.fillStyle = o.color || (o.type==='tree' ? 'rgba(45,227,108,0.35)' : 'rgba(150,180,255,0.25)');
          ctx.fill();
          ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth=1; ctx.stroke();
          ctx.restore();
        }
      }
    }
  }catch(_e){}
  // Start/Goal markers (on top of background)
  try{
    const pr = (routes && routes.length) ? routes : [{ start: pathStart||path[0], goal: pathGoal||path[path.length-1] }];
    const r = Math.max(10, Math.min(18, Math.floor((Visuals.pathWidth||24)*0.45)));
    for(let i=0;i<pr.length;i++){
      const start = pr[i].start; const goal = pr[i].goal; if(!start||!goal) continue;
      // Start: green circle with S (and small index badge when multiple)
      ctx.save();
      ctx.beginPath(); ctx.arc(start.x, start.y, r, 0, Math.PI*2);
      ctx.fillStyle = '#1e8e3e'; ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = `${Math.max(10, Math.floor(r*0.9))}px system-ui`; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText('S', start.x, start.y+1);
      if(pr.length>1){ ctx.fillText(String(i+1), start.x, start.y - r - 10); }
      ctx.restore();
      // Goal: red bullseye
      ctx.save();
      ctx.lineWidth = 3; ctx.strokeStyle = '#fff';
      ctx.beginPath(); ctx.arc(goal.x, goal.y, r+4, 0, Math.PI*2); ctx.stroke();
      ctx.strokeStyle = '#c5221f';
      ctx.beginPath(); ctx.arc(goal.x, goal.y, r, 0, Math.PI*2); ctx.stroke();
      ctx.beginPath(); ctx.arc(goal.x, goal.y, Math.max(4, Math.floor(r*0.45)), 0, Math.PI*2); ctx.fillStyle='#c5221f'; ctx.fill();
      ctx.restore();
    }
  }catch(_e){}
}

// Cached draw of all tower ranges into an offscreen canvas.
// towers: array of towers with {x,y,def,getStats}
export function drawRangesCached(ctx, canvas, towers){
  try{
    if(!towers || !towers.length) return;
    // Build a simple signature from tower positions and ranges (rounded) and canvas size
    let sigParts = [canvas.width, canvas.height];
    for(const t of towers){
      if(t?.def?.income) continue;
      let r = 0; try{ const s = typeof t.getStats==='function' ? t.getStats() : { range: t.def?.range||0 }; r = Math.max(0, Math.round(s.range||0)); }catch(_e){}
      sigParts.push(t.x|0, t.y|0, r|0);
    }
    const sig = sigParts.join(',');
    if(!rangesCanvas || rangesCanvas.width!==canvas.width || rangesCanvas.height!==canvas.height){
      rangesCanvas = document.createElement('canvas'); rangesCanvas.width=canvas.width; rangesCanvas.height=canvas.height; rangesCtx = rangesCanvas.getContext('2d'); lastRangesSig='';
    }
    if(sig !== lastRangesSig){
      lastRangesSig = sig;
      const rctx = rangesCtx; rctx.clearRect(0,0,rangesCanvas.width,rangesCanvas.height);
      // Style mirrors the previous overlay implementation
      rctx.save(); rctx.setLineDash([6,5]); rctx.strokeStyle='rgba(180,220,255,0.35)'; rctx.lineWidth=1.25; rctx.fillStyle='rgba(120,180,255,0.02)';
      for(const t of towers){
        if(t?.def?.income) continue;
        let rr = 0; try{ const s = typeof t.getStats==='function' ? t.getStats() : { range: t.def?.range||0 }; rr = Math.max(0, Math.round(s.range||0)); }catch(_e){}
        if(rr>0){ rctx.beginPath(); rctx.arc(t.x, t.y, rr, 0, Math.PI*2); rctx.fill(); rctx.stroke(); }
      }
      rctx.restore();
    }
    ctx.drawImage(rangesCanvas, 0, 0);
  }catch(_e){}
}

export function rebuildBackground(canvas){ initBackground(canvas); lastRangesSig=''; }
