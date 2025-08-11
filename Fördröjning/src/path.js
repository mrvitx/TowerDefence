
import { TILE, MapSettings, Visuals, MapModifiers } from './constants.js';
import { State } from './state.js';

// --- Custom map loader ---
function getCustomMapPoints(preset) {
  try {
    const raw = localStorage.getItem('td-maps-v1');
    if (!raw) return null;
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return null;
    const found = arr.find(m => m.id === preset && Array.isArray(m.points) && m.points.length >= 2);
    return found ? found.points : null;
  } catch (e) { return null; }
}

export const path = [];
export let pathStart = null;
export let pathGoal = null;
export let samples = []; // smoothed samples along center line
export let totalLen = 0; // total length of smoothed path (pixels)
// Fast lookup grid for placement checks (cells near the path)
const _blockedTiles = new Set();
export function isCellNearPath(c, r){ return _blockedTiles.has(c+','+r); }

function rebuildBlockedTiles(canvas){
  _blockedTiles.clear();
  if(!samples.length) return;
  const radius = Math.max(1, (Visuals && typeof Visuals.pathWidth==='number' ? Visuals.pathWidth : 24) / 2);
  // For each sample, mark tiles whose centers lie within radius+6 of the sample point
  const pad = radius + 8 + TILE; // extra to ensure coverage for tile centers
  for(const pt of samples){
    const c0 = Math.max(0, Math.floor((pt.x - pad) / TILE));
    const c1 = Math.floor((pt.x + pad) / TILE);
    const r0 = Math.max(0, Math.floor((pt.y - pad) / TILE));
    const r1 = Math.floor((pt.y + pad) / TILE);
    for(let c=c0;c<=c1;c++){
      for(let r=r0;r<=r1;r++){
        const cx = c*TILE + TILE/2, cy = r*TILE + TILE/2;
        if(Math.hypot(pt.x - cx, pt.y - cy) < radius + 6){
          _blockedTiles.add(c+','+r);
        }
      }
    }
  }
}

function catmullRom(p0,p1,p2,p3,t){
  // centripetal Catmull-Rom (alpha = 0.5) to reduce overshoot / self-intersections
  const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y) || 1e-6;
  const alpha=0.5;
  const t0=0;
  const t1=t0 + Math.pow(dist(p0,p1), alpha);
  const t2=t1 + Math.pow(dist(p1,p2), alpha);
  const t3=t2 + Math.pow(dist(p2,p3), alpha);
  const tt = t1 + (t2 - t1) * Math.max(0, Math.min(1, t));
  const lerp=(a,b,tv)=>({ x: a.x + (b.x-a.x)*tv, y: a.y + (b.y-a.y)*tv });
  const A1 = lerp(p0,p1, (tt - t0)/(t1 - t0));
  const A2 = lerp(p1,p2, (tt - t1)/(t2 - t1));
  const A3 = lerp(p2,p3, (tt - t2)/(t3 - t2));
  const B1 = lerp(A1,A2, (tt - t1)/(t2 - t1));
  const B2 = lerp(A2,A3, (tt - t2)/(t3 - t2));
  const C  = lerp(B1,B2, (tt - t2)/(t2 - t1));
  return C;
}

function buildSamples(){
  samples = [];
  if(path.length<2){ totalLen=0; return; }
  const pts = path;
  const step = Math.max(4, Math.floor(TILE/8)); // denser sampling for stability (~4-6px)
  let prev = pts[0]; samples.push({x:prev.x,y:prev.y, s:0, nx:0, ny:-1, tx:1, ty:0});
  let acc = 0;
  for(let i=0;i<pts.length-1;i++){
    const p0 = pts[Math.max(0,i-1)], p1=pts[i], p2=pts[i+1], p3=pts[Math.min(pts.length-1, i+2)];
    // approximate segment length to decide subdivisions
    const segLen = Math.hypot(p2.x-p1.x, p2.y-p1.y);
    const sub = Math.max(5, Math.ceil(segLen / step));
    for(let k=1;k<=sub;k++){
      const t = Math.max(0, Math.min(1, k/sub));
      const pt = catmullRom(p0,p1,p2,p3,t);
      const dx = pt.x - prev.x, dy = pt.y - prev.y; const d = Math.hypot(dx,dy); if(d<=0.001) continue;
      acc += d; const tx = dx/d, ty = dy/d; const nx = -ty, ny = tx;
      samples.push({ x: pt.x, y: pt.y, s: acc, tx, ty, nx, ny });
      prev = pt;
    }
  }
  totalLen = acc;
  // Update blocked tiles grid after sampling
  try{ rebuildBlockedTiles(null); }catch(_e){}
}

export function sampleAt(dist, laneOffset=0){
  if(samples.length===0){ return {x:0,y:0,tx:1,ty:0,nx:0,ny:-1, done:true}; }
  if(dist<=0){ const p=samples[0]; return {x:p.x + p.nx*laneOffset, y:p.y + p.ny*laneOffset, tx:p.tx,ty:p.ty,nx:p.nx,ny:p.ny, done:false}; }
  if(dist>=totalLen){ const p=samples[samples.length-1]; return {x:p.x + p.nx*laneOffset, y:p.y + p.ny*laneOffset, tx:p.tx,ty:p.ty,nx:p.nx,ny:p.ny, done:true}; }
  // binary search by s
  let lo=0, hi=samples.length-1;
  while(lo<hi){ const mid=(lo+hi)>>1; if(samples[mid].s<dist) lo=mid+1; else hi=mid; }
  const b = samples[lo], a = samples[lo-1]||b; const span = Math.max(1e-6, b.s - a.s); const t = (dist - a.s)/span;
  const x = a.x + (b.x-a.x)*t; const y = a.y + (b.y-a.y)*t;
  const tx = a.tx + (b.tx-a.tx)*t, ty = a.ty + (b.ty-a.ty)*t; const n = Math.hypot(tx,ty)||1; const ntx=tx/n, nty=ty/n; const nx=-nty, ny=ntx;
  return { x: x + nx*laneOffset, y: y + ny*laneOffset, tx:ntx, ty:nty, nx, ny, done:false };
}

export function buildPath(canvas){
  // Build according to MapSettings.preset
  path.length = 0;
  // Try to load custom map points from localStorage
  let customPoints = getCustomMapPoints(MapSettings.preset);
  if (customPoints && Array.isArray(customPoints) && customPoints.length >= 2) {
    for (let i = 0; i < customPoints.length; i++) path.push({ x: customPoints[i].x, y: customPoints[i].y });
  } else {
    const COLS = Math.floor(canvas.width / TILE);
    const ROWS = Math.floor(canvas.height / TILE);
    const margin = 2;
    const L = margin, R = COLS-1-margin, T = margin, B = ROWS-1-margin;
    // Backward compatibility
    if(MapSettings.preset === 'spiral'){ MapSettings.preset = 'riverMeander'; }
    if(MapSettings.preset === 'ring'){
      for(let c=L;c<=R;c++) path.push({ x: c*TILE+TILE/2, y: T*TILE+TILE/2 });
      for(let r=T+1;r<=B;r++) path.push({ x: R*TILE+TILE/2, y: r*TILE+TILE/2 });
      for(let c=R-1;c>=L;c--) path.push({ x: c*TILE+TILE/2, y: B*TILE+TILE/2 });
      for(let r=B-1;r>=T;r--) path.push({ x: L*TILE+TILE/2, y: r*TILE+TILE/2 });
    } else if(MapSettings.preset === 'maze'){
      // snake every row with walls implied by path only
      for(let r=T;r<=B;r++){
        if((r-T)%2===0){ for(let c=L;c<=R;c++) path.push({ x:c*TILE+TILE/2, y:r*TILE+TILE/2 }); }
        else { for(let c=R;c>=L;c--) path.push({ x:c*TILE+TILE/2, y:r*TILE+TILE/2 }); }
      }
    } else if(MapSettings.preset === 'figure8'){
      const midY = Math.floor((T+B)/2);
      const midX = Math.floor((L+R)/2);
      // top loop
      for(let c=L+1;c<=R-1;c++) path.push({ x:c*TILE+TILE/2, y:(midY-3)*TILE+TILE/2 });
      for(let r=midY-3;r<=midY-1;r++) path.push({ x:(R-1)*TILE+TILE/2, y:r*TILE+TILE/2 });
      for(let c=R-1;c>=L+1;c--) path.push({ x:c*TILE+TILE/2, y:(midY-1)*TILE+TILE/2 });
      for(let r=midY-1;r>=midY-3;r--) path.push({ x:(L+1)*TILE+TILE/2, y:r*TILE+TILE/2 });
      // connector
      for(let r=midY-2;r<=midY+2;r++) path.push({ x: midX*TILE+TILE/2, y:r*TILE+TILE/2 });
      // bottom loop
      for(let c=L+1;c<=R-1;c++) path.push({ x:c*TILE+TILE/2, y:(midY+3)*TILE+TILE/2 });
      for(let r=midY+3;r<=midY+5;r++) path.push({ x:(R-1)*TILE+TILE/2, y:r*TILE+TILE/2 });
      for(let c=R-1;c>=L+1;c--) path.push({ x:c*TILE+TILE/2, y:(midY+5)*TILE+TILE/2 });
      for(let r=midY+5;r>=midY+3;r--) path.push({ x:(L+1)*TILE+TILE/2, y:r*TILE+TILE/2 });
    } else if(MapSettings.preset === 'zigzag'){
      // Column-wise snake: goes down then up forming tall zigzags
      for(let c=L;c<=R;c++){
        if((c-L)%2===0){ for(let r=T;r<=B;r++){ path.push({ x:c*TILE+TILE/2, y:r*TILE+TILE/2 }); } }
        else { for(let r=B;r>=T;r--){ path.push({ x:c*TILE+TILE/2, y:r*TILE+TILE/2 }); } }
      }
    } else if(MapSettings.preset === 'river'){
      // S-curve across the map left->right using sinusoidal midline
      const mid = Math.floor((T+B)/2);
      const amp = Math.max(2, Math.floor((B-T)/3));
      for(let c=L;c<=R;c++){
        const y = Math.max(T, Math.min(B, mid + Math.round(Math.sin((c-L)/3)*amp)));
        path.push({ x:c*TILE+TILE/2, y:y*TILE+TILE/2 });
        // thicken by adding immediate neighbor to reduce sharp gaps
        if(c<R){ const y2 = Math.max(T, Math.min(B, mid + Math.round(Math.sin((c+0.5-L)/3)*amp))); path.push({ x:(c+0.5)*TILE+TILE/2, y:y2*TILE+TILE/2 }); }
      }
    } else if(MapSettings.preset === 'riverWide'){
      const mid = Math.floor((T+B)/2);
      const amp = Math.max(2, Math.floor((B-T)/2.5));
      for(let c=L;c<=R;c++){
        const y = Math.max(T, Math.min(B, mid + Math.round(Math.sin((c-L)/3.2)*amp)));
        path.push({ x:c*TILE+TILE/2, y:y*TILE+TILE/2 });
        if(c<R){ const y2 = Math.max(T, Math.min(B, mid + Math.round(Math.sin((c+0.6-L)/3.2)*amp))); path.push({ x:(c+0.5)*TILE+TILE/2, y:y2*TILE+TILE/2 }); }
      }
    } else if(MapSettings.preset === 'riverTight'){
      const mid = Math.floor((T+B)/2);
      const amp = Math.max(2, Math.floor((B-T)/4));
      for(let c=L;c<=R;c++){
        const y = Math.max(T, Math.min(B, mid + Math.round(Math.sin((c-L)/2.0)*amp)));
        path.push({ x:c*TILE+TILE/2, y:y*TILE+TILE/2 });
        if(c<R){ const y2 = Math.max(T, Math.min(B, mid + Math.round(Math.sin((c+0.4-L)/2.0)*amp))); path.push({ x:(c+0.5)*TILE+TILE/2, y:y2*TILE+TILE/2 }); }
      }
    } else if(MapSettings.preset === 'riverMeander'){
      const mid = Math.floor((T+B)/2);
      const amp = Math.max(2, Math.floor((B-T)/2.8));
      for(let c=L;c<=R;c++){
        const y = Math.max(T, Math.min(B, mid + Math.round(Math.sin((c-L)/4.6)*amp*0.9 + Math.sin((c-L)/1.9)*amp*0.28)));
        path.push({ x:c*TILE+TILE/2, y:y*TILE+TILE/2 });
        if(c<R){ const y2 = Math.max(T, Math.min(B, mid + Math.round(Math.sin((c+0.5-L)/4.6)*amp*0.9 + Math.sin((c+0.5-L)/1.9)*amp*0.28))); path.push({ x:(c+0.5)*TILE+TILE/2, y:y2*TILE+TILE/2 }); }
      }
    } else if(MapSettings.preset === 'riverBraided'){
      // Single centerline with braided feel via combined sinusoids; no vertical zigzags
      const mid = Math.floor((T+B)/2);
      const amp = Math.max(2, Math.floor((B-T)/3));
      for(let c=L;c<=R;c++){
        const y = mid + Math.round(
          Math.sin((c-L)/3.0)*amp*0.85 +
          Math.sin((c-L)/1.6 + Math.PI/3)*amp*0.25
        );
        path.push({ x:c*TILE+TILE/2, y:Math.max(T,Math.min(B,y))*TILE+TILE/2 });
      }
    } else if(MapSettings.preset === 'riverDelta'){
      // Single meandering centerline that fans out visually (kept center for pathing)
      const mid = Math.floor((T+B)/2);
      const amp = Math.max(2, Math.floor((B-T)/3));
      for(let c=L;c<=R;c++){
        const t = (c-L)/(R-L+1);
        const y = mid + Math.round(Math.sin((c-L)/3.4)*amp*0.65 + Math.sin((c-L)/1.4)*amp*0.18);
        path.push({ x:c*TILE+TILE/2, y:Math.max(T, Math.min(B, y))*TILE+TILE/2 });
      }
    } else if(MapSettings.preset === 'random'){
      // Biased random walk from left margin to right margin
      let c=L, r=Math.floor((T+B)/2); path.push({ x:c*TILE+TILE/2, y:r*TILE+TILE/2 });
      let guards=0; while(c<R && guards<COLS*ROWS*4){
        guards++;
        const roll=(State.rng?.random?.()||Math.random());
        if(roll<0.55){ c=Math.min(R, c+1); }
        else if(roll<0.77){ r=Math.max(T, r-1); }
        else { r=Math.min(B, r+1); }
        path.push({ x:c*TILE+TILE/2, y:r*TILE+TILE/2 });
      }
      // ensure we end at right margin
      while(c<R){ c++; path.push({ x:c*TILE+TILE/2, y:r*TILE+TILE/2 }); }
    } else if(MapSettings.preset === 'clover'){
      // 4-leaf clover (rose curve r = R*cos(2θ)) centered
      const cx = canvas.width/2, cy = canvas.height/2;
      const R = Math.max(TILE*3, Math.min(canvas.width, canvas.height)*0.32);
      const steps = 180;
      for(let i=0;i<=steps;i++){
        const t = i/steps * Math.PI*2;
        const r = R * Math.cos(2*t);
        const x = cx + r*Math.cos(t);
        const y = cy + r*Math.sin(t);
        path.push({ x, y });
      }
    } else if(MapSettings.preset === 'stadium'){
      // Elliptical loop (stadium/oval track)
      const cx = canvas.width/2, cy = canvas.height/2;
      const rx = Math.max(TILE*4, canvas.width*0.42);
      const ry = Math.max(TILE*3, canvas.height*0.32);
      const steps = 160;
      for(let i=0;i<=steps;i++){
        const t = i/steps * Math.PI*2;
        const x = cx + Math.cos(t)*rx;
        const y = cy + Math.sin(t)*ry;
        path.push({ x, y });
      }
    } else if(MapSettings.preset === 'twinLanes'){
      // Two near-parallel lanes in opposite directions that meet near the end
      const midY = Math.floor((T+B)/2);
      const top = Math.max(T, midY-5), bot = Math.min(B, midY+5);
      // upper lane left -> right
      for(let c=L;c<=R-2;c++) path.push({ x:c*TILE+TILE/2, y: top*TILE+TILE/2 });
      // down to bottom lane
      for(let r=top;r<=bot;r++) path.push({ x:(R-2)*TILE+TILE/2, y:r*TILE+TILE/2 });
      // bottom lane right -> left (partially)
      for(let c=R-2;c>=L+3;c--) path.push({ x:c*TILE+TILE/2, y: bot*TILE+TILE/2 });
      // curve back up toward a shared goal near right side
      let c=L+3; const goalY = midY;
      while(c<=R-1){
        const t = (c-(L+3)) / Math.max(1,(R-1-(L+3)));
        const y = Math.round(bot + (goalY-bot)*t);
        path.push({ x:c*TILE+TILE/2, y:y*TILE+TILE/2 });
        c++;
      }
    } else if(MapSettings.preset === 'forkMerge'){
      // Early split loops (A/B) with different lengths then rejoin mid-map
      const midX = Math.floor((L+R)/2), midY=Math.floor((T+B)/2);
      // entry
      for(let c=L;c<=midX-2;c++) path.push({ x:c*TILE+TILE/2, y: midY*TILE+TILE/2 });
      // branch A (short, upper loop) and return
      for(let r=midY-1;r>=T+2;r--) path.push({ x:(midX-2)*TILE+TILE/2, y:r*TILE+TILE/2 });
      for(let c=midX-2;c<=midX+1;c++) path.push({ x:c*TILE+TILE/2, y:(T+2)*TILE+TILE/2 });
      for(let r=T+2;r<=midY;r++) path.push({ x:(midX+1)*TILE+TILE/2, y:r*TILE+TILE/2 });
      // branch B (longer, lower loop) and return
      for(let r=midY+1;r<=B-2;r++) path.push({ x:(midX+1)*TILE+TILE/2, y:r*TILE+TILE/2 });
      for(let c=midX+1;c>=midX-1;c--) path.push({ x:c*TILE+TILE/2, y:(B-2)*TILE+TILE/2 });
      for(let r=B-2;r>=midY;r--) path.push({ x:(midX-1)*TILE+TILE/2, y:r*TILE+TILE/2 });
      // merged run to goal
      for(let c=midX-1;c<=R;c++) path.push({ x:c*TILE+TILE/2, y: midY*TILE+TILE/2 });
    } else if(MapSettings.preset === 'overpass8'){
      // Figure-8 variant with two distinct crossings
      const midY = Math.floor((T+B)/2);
      const midX = Math.floor((L+R)/2);
      const off = 4;
      // top loop
      for(let c=L+2;c<=R-2;c++) path.push({ x:c*TILE+TILE/2, y:(midY-off)*TILE+TILE/2 });
      for(let r=midY-off;r<=midY-1;r++) path.push({ x:(R-2)*TILE+TILE/2, y:r*TILE+TILE/2 });
      for(let c=R-2;c>=L+2;c--) path.push({ x:c*TILE+TILE/2, y:(midY-1)*TILE+TILE/2 });
      for(let r=midY-1;r>=midY-off;r--) path.push({ x:(L+2)*TILE+TILE/2, y:r*TILE+TILE/2 });
      // cross down
      for(let r=midY-off;r<=midY+off;r++) path.push({ x: midX*TILE+TILE/2, y:r*TILE+TILE/2 });
      // bottom loop
      for(let c=L+2;c<=R-2;c++) path.push({ x:c*TILE+TILE/2, y:(midY+off)*TILE+TILE/2 });
      for(let r=midY+off;r<=midY+off+2;r++) path.push({ x:(R-2)*TILE+TILE/2, y:r*TILE+TILE/2 });
      for(let c=R-2;c>=L+2;c--) path.push({ x:c*TILE+TILE/2, y:(midY+off+2)*TILE+TILE/2 });
      for(let r=midY+off+2;r>=midY+off;r--) path.push({ x:(L+2)*TILE+TILE/2, y:r*TILE+TILE/2 });
      // cross up again to exit
      for(let r=midY+off;r>=midY;r--) path.push({ x: (midX+2)*TILE+TILE/2, y:r*TILE+TILE/2 });
      for(let c=midX+2;c<=R;c++) path.push({ x:c*TILE+TILE/2, y: midY*TILE+TILE/2 });
    } else if(MapSettings.preset === 'spiralCore'){
      // Spiral inward to center then a straight final runway
      const cx = canvas.width/2, cy = canvas.height/2;
      const maxR = Math.min(canvas.width, canvas.height)*0.42;
      const turns = 2.5, steps = 220;
      for(let i=0;i<=steps;i++){
        const t = i/steps;
        const ang = t * Math.PI*2*turns;
        const r = maxR * (1 - t*0.85);
        const x = cx + Math.cos(ang)*r;
        const y = cy + Math.sin(ang)*r;
        path.push({ x, y });
      }
      // runway to the right
      for(let x=path[path.length-1].x; x<=canvas.width - TILE*1.5; x+=TILE*0.8){ path.push({ x, y: path[path.length-1].y }); }
    } else if(MapSettings.preset === 'switchbacks'){
      // Long horizontal runs with short vertical connectors (terraces)
      const stepR = 3; // rows between switchbacks
      let r = T+1;
      let leftToRight = true;
      while(r <= B-1){
        if(leftToRight){ for(let c=L;c<=R;c++) path.push({ x:c*TILE+TILE/2, y:r*TILE+TILE/2 }); }
        else { for(let c=R;c>=L;c--) path.push({ x:c*TILE+TILE/2, y:r*TILE+TILE/2 }); }
        // drop to next terrace
        const r2 = Math.min(B-1, r+stepR);
        for(let rr=r; rr<=r2; rr++) path.push({ x:(leftToRight? R: L)*TILE+TILE/2, y: rr*TILE+TILE/2 });
        r = r2;
        leftToRight = !leftToRight;
        r += 1;
      }
    } else if(MapSettings.preset === 'islands'){
      // Meandering path with lots of open water; we also place a few boost pads as "islands"
      const mid = Math.floor((T+B)/2);
      const amp = Math.max(2, Math.floor((B-T)/3));
      for(let c=L;c<=R;c++){
        const y = Math.max(T, Math.min(B, mid + Math.round(Math.sin((c-L)/3.2)*amp*0.85 + Math.sin((c-L)/1.6)*amp*0.25)));
        path.push({ x:c*TILE+TILE/2, y:y*TILE+TILE/2 });
      }
      // Minimal per-preset modifiers: a few build "islands" as boost pads near path
      try{
        const pads = [];
        const addPad = (xpx, ypx)=>{ pads.push({ c: Math.round(xpx/TILE), r: Math.round(ypx/TILE) }); };
        for(let i=20;i<path.length-20;i+=Math.floor((path.length-40)/6)){
          const p = path[i]; addPad(p.x + 2*TILE, p.y - 1*TILE); addPad(p.x - 2*TILE, p.y + 1*TILE);
        }
        MapModifiers.boostPads = pads;
      }catch(_e){}
    } else if(MapSettings.preset === 'portals'){
      // Central entry, faux teleport jump to a new lane, then to goal
      const cx = Math.floor((L+R)/2), cy = Math.floor((T+B)/2);
      // approach center from left
      for(let c=L;c<=cx;c++) path.push({ x:c*TILE+TILE/2, y: cy*TILE+TILE/2 });
      // spiral tiny loop to suggest portal swirl
      for(let a=0;a<=Math.PI*2;a+=Math.PI/12){ const r=TILE*3; path.push({ x: cx*TILE+TILE/2 + Math.cos(a)*r, y: cy*TILE+TILE/2 + Math.sin(a)*r }); }
      // exit far upper-right lane
      const targetY = T+2;
      for(let c=cx+1;c<=R-2;c++){ const t=(c-(cx+1))/(R-(cx+1)); const y=Math.round(cy + (targetY-cy)*t); path.push({ x:c*TILE+TILE/2, y:y*TILE+TILE/2 }); }
      // final glide to goal
      for(let c=R-2;c<=R;c++) path.push({ x:c*TILE+TILE/2, y: (targetY+2)*TILE+TILE/2 });
    } else if(MapSettings.preset === 'pockets'){
      // Labyrinth with pockets: orbit center area multiple times
      const cx = canvas.width/2, cy = canvas.height/2;
      const rx = Math.max(TILE*4, canvas.width*0.38);
      const ry = Math.max(TILE*3, canvas.height*0.28);
      const laps = 3, steps=140;
      for(let lap=0; lap<laps; lap++){
        const shrink = 1 - lap*0.18;
        for(let i=0;i<=steps;i++){
          const t=i/steps * Math.PI*2;
          const x = cx + Math.cos(t)*rx*shrink;
          const y = cy + Math.sin(t)*ry*shrink;
          path.push({ x, y });
        }
        // small offset so we re-visit pockets from different angles
        for(let k=0;k<5;k++) path.push({ x: cx + (k*4), y: cy + (k*3) });
      }
    }

    // Safety: if preset wasn't recognized or produced no points, fall back to 'ring'
    if(path.length === 0){
      try{ console.warn('Unknown map preset:', MapSettings.preset, '— falling back to ring'); }catch(_e){}
      const COLS = Math.floor(canvas.width / TILE);
      const ROWS = Math.floor(canvas.height / TILE);
      const margin = 2; const L = margin, R = COLS-1-margin, T = margin, B = ROWS-1-margin;
      for(let c=L;c<=R;c++) path.push({ x: c*TILE+TILE/2, y: T*TILE+TILE/2 });
      for(let r=T+1;r<=B;r++) path.push({ x: R*TILE+TILE/2, y: r*TILE+TILE/2 });
      for(let c=R-1;c>=L;c--) path.push({ x: c*TILE+TILE/2, y: B*TILE+TILE/2 });
      for(let r=B-1;r>=T;r--) path.push({ x: L*TILE+TILE/2, y: r*TILE+TILE/2 });
    }
  }

  pathStart = path[0];
  pathGoal = path[path.length-1];
  buildSamples();
  // Ensure blocked grid reflects latest samples/width
  try{ rebuildBlockedTiles(canvas); }catch(_e){}
}

export function drawPath(ctx){
  // Not used; kept for compatibility
  ctx.save();
  ctx.strokeStyle='#2a2a2a'; ctx.lineWidth=Visuals.pathWidth; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(path[0].x,path[0].y);
  for(const p of path){ ctx.lineTo(p.x,p.y); }
  ctx.stroke(); ctx.restore();
}
