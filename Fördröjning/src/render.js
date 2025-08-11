import { TILE, Visuals } from './constants.js';
import { path, samples, pathStart, pathGoal } from './path.js';

let bgCanvas = null, bgCtx = null;
let rangesCanvas = null, rangesCtx = null, lastRangesSig = '';

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
  // Draw smooth path using samples
  if(samples.length>1){
    const w = Visuals.pathWidth;
    bgCtx.save();
    // base
    bgCtx.strokeStyle='#2a2a2a'; bgCtx.lineWidth=w; bgCtx.lineCap='round';
    bgCtx.beginPath(); bgCtx.moveTo(samples[0].x, samples[0].y);
    for(const s of samples){ bgCtx.lineTo(s.x, s.y); }
    bgCtx.stroke();
    // inner highlight
    bgCtx.strokeStyle='rgba(255,255,255,0.06)'; bgCtx.lineWidth=Math.max(6, w*0.55);
    bgCtx.beginPath(); bgCtx.moveTo(samples[0].x, samples[0].y);
    for(const s of samples){ bgCtx.lineTo(s.x, s.y); }
    bgCtx.stroke();
    // edge strokes for depth
    bgCtx.strokeStyle='rgba(0,0,0,0.35)'; bgCtx.lineWidth=Math.max(4, w*0.08);
    bgCtx.beginPath(); bgCtx.moveTo(samples[0].x, samples[0].y);
    for(const s of samples){ bgCtx.lineTo(s.x, s.y); }
    bgCtx.stroke();
    bgCtx.restore();
  } else {
    // fallback to polyline path
    bgCtx.save(); bgCtx.strokeStyle='#2a2a2a'; bgCtx.lineWidth=Visuals.pathWidth; bgCtx.lineCap='round';
    bgCtx.beginPath(); bgCtx.moveTo(path[0].x,path[0].y); for(const p of path){ bgCtx.lineTo(p.x,p.y); } bgCtx.stroke(); bgCtx.restore();
  }
}

export function drawWorld(ctx, canvas){
  if(bgCanvas && bgCanvas.width===canvas.width && bgCanvas.height===canvas.height){
    ctx.drawImage(bgCanvas, 0, 0);
  } else {
    // fallback if sizes changed
    drawGrid(ctx, canvas);
    if(samples.length>1){
      const w = Visuals.pathWidth; ctx.save();
      ctx.strokeStyle='#2a2a2a'; ctx.lineWidth=w; ctx.lineCap='round'; ctx.beginPath(); ctx.moveTo(samples[0].x, samples[0].y); for(const s of samples){ ctx.lineTo(s.x,s.y); } ctx.stroke();
      ctx.strokeStyle='rgba(255,255,255,0.06)'; ctx.lineWidth=Math.max(6, w*0.55); ctx.beginPath(); ctx.moveTo(samples[0].x, samples[0].y); for(const s of samples){ ctx.lineTo(s.x,s.y); } ctx.stroke();
      ctx.strokeStyle='rgba(0,0,0,0.35)'; ctx.lineWidth=Math.max(4, w*0.08); ctx.beginPath(); ctx.moveTo(samples[0].x, samples[0].y); for(const s of samples){ ctx.lineTo(s.x,s.y); } ctx.stroke();
      ctx.restore();
    } else {
      ctx.save(); ctx.strokeStyle='#2a2a2a'; ctx.lineWidth=Visuals.pathWidth; ctx.lineCap='round'; ctx.beginPath(); ctx.moveTo(path[0].x,path[0].y); for(const p of path){ ctx.lineTo(p.x,p.y); } ctx.stroke(); ctx.restore();
    }
  }
  // Start/Goal markers (on top of background)
  try{
    if(path && path.length>1){
      const start = pathStart || path[0];
      const goal = pathGoal || path[path.length-1];
      const r = Math.max(10, Math.min(18, Math.floor((Visuals.pathWidth||24)*0.45)));
      // Start: green circle with S
      ctx.save();
      ctx.beginPath(); ctx.arc(start.x, start.y, r, 0, Math.PI*2);
      ctx.fillStyle = '#1e8e3e'; ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = `${Math.max(10, Math.floor(r*0.9))}px system-ui`; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText('S', start.x, start.y+1);
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
