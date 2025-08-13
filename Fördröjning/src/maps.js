// src/maps.js
// Advanced map storage and editing logic for Kaffekatten TD
// All maps (default and custom) are stored in localStorage as JSON

var MAPS_KEY = 'td-maps-v1';

// Default maps (can be restored if user deletes all)
var DEFAULT_MAPS = [
  {
    id: 'ring',
    name: 'Outer Ring',
  points: [], // Built on load to guarantee availability
    type: 'default',
    description: 'Standard ringbana',
    created: Date.now(),
    modified: Date.now(),
  },
  {
    id: 'maze',
    name: 'Maze',
  points: [], // Built on load
    type: 'default',
    description: 'Klassisk labyrint',
    created: Date.now(),
    modified: Date.now(),
  },
  // ...lägg till fler standardkartor här om du vill
];

// Build points for core defaults if missing
function _buildDefaultPointsById(id){
  try{
    if(id==='ring') return generatePresetPoints('ring', 1200, 800, 40, { complexity: 2 });
    if(id==='maze') return generatePresetPoints('maze', 1200, 800, 40, { complexity: 2 });
  }catch(_e){}
  return [];
}
function _ensureCoreDefaults(maps){
  var changed = false;
  function ensureOne(def){
    var idx = maps.findIndex(function(m){ return m && m.id === def.id; });
    if(idx === -1){
      var pts = _buildDefaultPointsById(def.id);
      var obj = Object.assign({}, def, { points: pts, created: Date.now(), modified: Date.now(), type: 'default' });
      maps.push(obj); changed = true; return;
    }
    var m = maps[idx];
    if(!Array.isArray(m.points) || m.points.length < 2){
      m.points = _buildDefaultPointsById(m.id); m.modified = Date.now(); changed = true;
    }
    if(m.type !== 'default'){ m.type = 'default'; changed = true; }
  }
  ensureOne(DEFAULT_MAPS[0]);
  ensureOne(DEFAULT_MAPS[1]);
  return changed;
}

// Load all maps from localStorage (or fall back to defaults) and repair core defaults
function loadMaps() {
  try {
    var raw = localStorage.getItem(MAPS_KEY);
    var arr;
    if (!raw) {
      arr = DEFAULT_MAPS.slice();
    } else {
      arr = JSON.parse(raw);
      if (!Array.isArray(arr) || !arr.length) arr = DEFAULT_MAPS.slice();
    }
    // Ensure the two core defaults always exist and have points
    if(_ensureCoreDefaults(arr)) saveMaps(arr);
    return arr;
  } catch (e) {
    var arr = DEFAULT_MAPS.slice();
    if(_ensureCoreDefaults(arr)) saveMaps(arr);
    return arr;
  }
}

// Save all maps to localStorage
function saveMaps(maps) {
  try {
    localStorage.setItem(MAPS_KEY, JSON.stringify(maps));
    return true;
  } catch (e) {
    return false;
  }
}

// Add or update a map (by id)
function upsertMap(map) {
  var maps = loadMaps();
  var idx = maps.findIndex(function(m) { return m.id === map.id; });
  if (idx >= 0) {
    maps[idx] = Object.assign({}, maps[idx], map, { modified: Date.now() });
  } else {
    maps.push(Object.assign({}, map, { created: Date.now(), modified: Date.now() }));
  }
  saveMaps(maps);
}

// Delete a map by id
function deleteMap(id) {
  var maps = loadMaps().filter(function(m) { return m.id !== id; });
  saveMaps(maps);
}

// Get a map by id
function getMap(id) {
  var found = loadMaps().find(function(m) { return m.id === id; });
  return found || null;
}

// Restore all default maps (danger: overwrites custom) and ensure they are built
function restoreDefaults() {
  var arr = DEFAULT_MAPS.slice();
  _ensureCoreDefaults(arr);
  saveMaps(arr);
}

// Utility: generate a unique id
function generateMapId(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Math.floor(Math.random()*1e6);
}

// Utility: create a new empty map
function createEmptyMap(name) {
  if (!name) name = 'Ny karta';
  return {
    id: generateMapId(name),
    name: name,
    points: [],
    type: 'custom',
    description: '',
    created: Date.now(),
    modified: Date.now(),
  };
}

// --- Advanced generators and path utilities (file:// friendly) ---
function _rng(seed){ let t=(seed>>>0)||0x9e3779b9; return ()=>{ t += 0x6D2B79F5; let x=t; x=Math.imul(x^(x>>>15), x|1); x^= x + Math.imul(x^(x>>>7), x|61); return ((x^(x>>>14))>>>0)/4294967296; }; }
function _valueNoise1(seed){ const off=(seed>>>0)*0.1; return function(x){ const i=Math.floor(x), f=x-i; const r0=Math.sin(i*12.9898+off)*43758.5453; const r1=Math.sin((i+1)*12.9898+off)*43758.5453; const v0=r0-Math.floor(r0); const v1=r1-Math.floor(r1); const u=f*f*(3-2*f); return v0*(1-u)+v1*u; }; }
function _fractal(n1, x, oct){ let a=0, amp=1, fr=1, sum=0; for(let o=0;o<oct;o++){ a+= n1(x*fr)*amp; sum+=amp; amp*=0.5; fr*=2; } return a/sum; }
function _clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
function _rdp(points, eps){ if(points.length<=2) return points.slice(); const d2=(a,b,p)=>{ const x=b.x-a.x, y=b.y-a.y; const l2=x*x+y*y||1; let t=((p.x-a.x)*x + (p.y-a.y)*y)/l2; t=_clamp(t,0,1); const px=a.x+t*x, py=a.y+t*y; const dx=p.x-px, dy=p.y-py; return dx*dx+dy*dy; }; function rec(arr, s, e, out){ let maxD=-1, idx=-1; for(let i=s+1;i<e;i++){ const d=d2(arr[s],arr[e],arr[i]); if(d>maxD){ maxD=d; idx=i; } } if(maxD>eps*eps){ rec(arr,s,idx,out); out.pop(); rec(arr,idx,e,out); } else { out.push(arr[s]); out.push(arr[e]); } } const out=[]; rec(points,0,points.length-1,out); const res=[out[0]]; for(let i=1;i<out.length;i++){ const p=out[i], q=res[res.length-1]; if(Math.hypot(p.x-q.x,p.y-q.y)>1e-6) res.push(p); } return res; }
function _chaikin(points, iterations){ let cur=points.slice(); for(let it=0;it<iterations;it++){ if(cur.length<3) break; const res=[cur[0]]; for(let i=0;i<cur.length-1;i++){ const a=cur[i], b=cur[i+1]; const Q={x:0.75*a.x+0.25*b.x,y:0.75*a.y+0.25*b.y}; const R={x:0.25*a.x+0.75*b.x,y:0.25*a.y+0.75*b.y}; res.push(Q,R); } res.push(cur[cur.length-1]); cur=res; } return cur; }
function _equalize(points, step){ if(points.length<2) return points.slice(); const res=[{...points[0]}]; let acc=0; for(let i=0;i<points.length-1;i++){ let a=points[i], b=points[i+1]; let dx=b.x-a.x, dy=b.y-a.y; let seg=Math.hypot(dx,dy); while(acc+seg>=step){ const t=(step-acc)/seg; const nx=a.x+dx*t, ny=a.y+dy*t; res.push({x:nx,y:ny}); a={x:nx,y:ny}; dx=b.x-a.x; dy=b.y-a.y; seg=Math.hypot(dx,dy); acc=0; } acc+=seg; } res.push({...points[points.length-1]}); return res; }
function _jitter(points, rng, amt){ return points.map(p=>({ x: p.x + (rng()*2-1)*amt, y: p.y + (rng()*2-1)*amt })); }
function _warp(points, seed, amount=8, freq=0.05){
  const n1=_valueNoise1((seed>>>0)||12345); const out=[]; const N=points.length;
  function dir(i){ const a=points[Math.max(0,i-1)], b=points[Math.min(N-1,i+1)]; const dx=b.x-a.x, dy=b.y-a.y; const L=Math.hypot(dx,dy)||1; return {x:dx/L,y:dy/L}; }
  for(let i=0;i<N;i++){
    const p=points[i]; const d=dir(i); // perpendicular
    const nx = (n1(i*freq)*2-1), ny = (n1((i+1000)*freq)*2-1); // two noise fields
    const k = ((nx+ny)/2); const px = -d.y, py = d.x; // perp vector
    out.push({ x: p.x + px*amount*k, y: p.y + py*amount*k });
  }
  return out;
}

function generatePresetPoints(preset, width=1200, height=800, tile=40, opts={}){
  const PAD=24; const L=PAD, R=width-PAD, T=PAD, B=height-PAD; const COLS=Math.floor(width/tile), ROWS=Math.floor(height/tile);
  const seed=(opts.seed>>>0)||0; const rng=_rng(seed||123456789); const vn=_valueNoise1(seed||98765);
  const complexity=Math.max(1, Math.min(5, opts.complexity||2));
  const pts=[];
  if(preset==='ring'){
    pts.push({x:L,y:T}); pts.push({x:R,y:T}); pts.push({x:R,y:B}); pts.push({x:L,y:B}); pts.push({x:L,y:T});
  } else if(preset==='spiral'){
    const cx=(L+R)/2, cy=(T+B)/2; const turns=2+complexity; const maxRad=Math.min(R-L,B-T)*0.45;
    const steps = 220 + complexity*60;
    for(let i=0;i<=steps;i++){
      const t=i/steps; const ang= t*turns*2*Math.PI; const r = t*maxRad;
      const x=cx + r*Math.cos(ang), y=cy + r*Math.sin(ang);
      pts.push({ x:_clamp(x,L,R), y:_clamp(y,T,B) });
    }
  } else if(preset==='figure8'){
    const cx=(L+R)/2, cy=(T+B)/2; const a=(R-L)*0.35, b=(B-T)*0.25; const steps=360;
    for(let i=0;i<=steps;i++){
      const t=i/steps*2*Math.PI; const x=cx + a*Math.sin(t); const y=cy + b*Math.sin(2*t);
      pts.push({ x:_clamp(x,L,R), y:_clamp(y,T,B) });
    }
  } else if(preset==='zigzag'){
    const rows = 6 + complexity*2; const dy=(B-T)/rows; let dir=1;
    for(let r=0;r<=rows;r++){
      const y=T + r*dy; const x = dir>0? R : L; pts.push({x, y}); dir*=-1;
    }
  } else if(preset==='sBends'){
    const mid=(T+B)/2; const amp=(B-T)*(0.18 + 0.06*complexity); const waves=1+complexity; const k=waves*Math.PI/(R-L);
    for(let x=L; x<=R; x+=tile*0.5){ const y=mid + Math.sin((x-L)*k)*amp; pts.push({ x, y:_clamp(y,T,B) }); }
  } else if(preset==='bezier'){
    const segs = 2 + complexity; const cx=L + (R-L)*0.1, cy=T + (B-T)*0.5;
    function cubic(a,b,c,d,t){ const it=1-t; const x=it*it*it*a.x + 3*it*it*t*b.x + 3*it*t*t*c.x + t*t*t*d.x; const y=it*it*it*a.y + 3*it*it*t*b.y + 3*it*t*t*c.y + t*t*t*d.y; return {x,y}; }
    // create random control points across the playfield
    const cps=[{ x:L+tile, y:T+tile }];
    for(let i=0;i<segs;i++){
      cps.push({ x: L + rng()*(R-L), y: T + rng()*(B-T) });
    }
    cps.push({ x:R-tile, y:B-tile });
    // sample each cubic segment (using consecutive groups of 4 with shared endpoints)
    for(let i=0;i<cps.length-3;i+=1){
      const a=cps[i], b=cps[i+1], c=cps[i+2], d=cps[i+3];
      const steps=32 + complexity*16;
      for(let s=0;s<=steps;s++){
        const t=s/steps; const p=cubic(a,b,c,d,t); pts.push({ x:_clamp(p.x,L,R), y:_clamp(p.y,T,B) });
      }
    }
  } else if(preset==='heart'){
    // Parametric heart curve scaled to playfield
    const cx=(L+R)/2, cy=(T+B)/2; const s=Math.min(R-L,B-T)*0.035*(2+complexity*0.6); const steps=480;
    for(let i=0;i<=steps;i++){
      const t=i/steps*Math.PI*2; const x = 16*Math.pow(Math.sin(t),3); const y = 13*Math.cos(t)-5*Math.cos(2*t)-2*Math.cos(3*t)-Math.cos(4*t);
      const px=cx + x*s, py=cy - y*s; pts.push({ x:_clamp(px,L,R), y:_clamp(py,T,B) });
    }
  } else if(preset==='rose'){
    // Rose curve r = a * cos(k*theta), choose odd k from complexity
    const k = [3,5,7,9,11][Math.max(0,Math.min(4, complexity-1))];
    const a = Math.min(R-L,B-T)*0.38; const cx=(L+R)/2, cy=(T+B)/2; const steps=900;
    for(let i=0;i<=steps;i++){
      const th = i/steps * Math.PI*2; const r = a*Math.cos(k*th);
      const x = cx + r*Math.cos(th); const y = cy + r*Math.sin(th);
      pts.push({ x:_clamp(x,L,R), y:_clamp(y,T,B) });
    }
  } else if(preset==='maze'){
    const rows=10+complexity*4; const cols=14+complexity*4; const cellW=(R-L)/cols, cellH=(B-T)/rows;
    for(let r=0;r<rows;r++){
      if(r%2===0){ for(let c=0;c<cols;c++){ pts.push({ x:L+c*cellW, y:T+r*cellH }); } }
      else { for(let c=cols-1;c>=0;c--){ pts.push({ x:L+c*cellW, y:T+r*cellH }); } }
    }
  } else if(preset==='riverNoise'){
    const mid=(T+B)/2; const amp=(B-T)/3; const oct=complexity; for(let x=L;x<=R;x+=tile*0.5){ const y=mid + ((_fractal(vn, (x-L)/60, oct)*2 - 1) * amp); pts.push({x, y:_clamp(y,T,B)}); }
  } else if(preset==='aStarSnake'){
    const gC=Math.max(10, Math.floor(COLS/2)), gR=Math.max(8, Math.floor(ROWS/2)); const start={c:1, r:Math.floor(gR/2)}, goal={c:gC-2, r:Math.floor(gR/2)}; const key=(c,r)=>c+','+r; const h=(c,r)=>Math.abs(goal.c-c)+Math.abs(goal.r-r);
    const blocked=new Set(); const obstacles=complexity*Math.floor((gC*gR)/22); for(let i=0;i<obstacles;i++){ const cc=Math.floor(1+rng()*(gC-2)); const rr=Math.floor(1+rng()*(gR-2)); blocked.add(key(cc,rr)); }
    const open=[{c:start.c,r:start.r,f:0}], came=new Map(), g=new Map(); g.set(key(start.c,start.r),0); const neigh=[[1,0],[-1,0],[0,1],[0,-1]];
    while(open.length){ open.sort((a,b)=>a.f-b.f); const cur=open.shift(); if(cur.c===goal.c&&cur.r===goal.r) break; for(const d of neigh){ const nc=cur.c+d[0], nr=cur.r+d[1]; if(nc<0||nr<0||nc>=gC||nr>=gR) continue; const k=key(nc,nr); const w=blocked.has(k)?5:1; const cg=(g.get(key(cur.c,cur.r))||1e9)+w; if(cg<(g.get(k)||1e9)){ came.set(k,key(cur.c,cur.r)); g.set(k,cg); open.push({c:nc,r:nr,f:cg+h(nc,nr)}); } } }
    let k=key(goal.c,goal.r); const rev=[]; let guard=0; while(k && k!==key(start.c,start.r) && guard++<gC*gR){ const [cc,rr]=k.split(',').map(Number); rev.push({c:cc,r:rr}); k=came.get(k); }
    rev.push(start); rev.reverse(); const cellW=(R-L)/(gC-1), cellH=(B-T)/(gR-1); for(const p of rev){ pts.push({ x:L + p.c*cellW, y:T + p.r*cellH }); }
  } else {
    for(let x=L;x<=R;x+=tile){ const t=(x-L)/(R-L); const y=T + t*(B-T); pts.push({x,y}); }
  }
  return pts;
}
function simplifyPath(points, epsilon=8){ return _rdp(points, epsilon); }
function smoothPath(points, iterations=2){ return _chaikin(points, iterations); }
function equalizeSpacing(points, step=40){ return _equalize(points, step); }
function jitterPath(points, seed=0, amount=6){ const r=_rng(seed||0xDEADBEEF); return _jitter(points, r, amount); }
function warpPath(points, seed=0, amount=8, freq=0.05){ return _warp(points, seed, amount, freq); }
function closeLoop(points){ if(points.length<2) return points.slice(); const res=points.slice(); const a=res[0], b=res[res.length-1]; if(Math.hypot(a.x-b.x,a.y-b.y)>1){ res.push({x:a.x,y:a.y}); } return res; }
function reversePath(points){ return points.slice().reverse(); }

// Geometric transforms relative to canvas center
function _center(width, height){ return { cx: width/2, cy: height/2 }; }
function flipPoints(points, width=1200, height=800, axis='h'){ const {cx,cy}=_center(width,height); return points.map(p=> axis==='h'? { x: 2*cx - p.x, y: p.y } : { x: p.x, y: 2*cy - p.y }); }
function rotatePoints(points, deg=0, width=1200, height=800){ const {cx,cy}=_center(width,height); const rad=deg*Math.PI/180; const c=Math.cos(rad), s=Math.sin(rad); return points.map(p=>{ const x=p.x-cx, y=p.y-cy; return { x: cx + x*c - y*s, y: cy + x*s + y*c }; }); }
function scalePoints(points, factor=1, width=1200, height=800){ const {cx,cy}=_center(width,height); return points.map(p=>({ x: cx + (p.x-cx)*factor, y: cy + (p.y-cy)*factor })); }
function snapEndpointsToEdges(points, width=1200, height=800, pad=24){ if(points.length<2) return points.slice(); const res=points.slice(); const L=pad, R=width-pad; res[0]={ x:L, y:res[0].y }; res[res.length-1]={ x:R, y:res[res.length-1].y }; return res; }

// --- Path analysis & building helpers ---
function _dedupe(points){ const out=[]; let prev=null; for(const p of points){ if(!prev || Math.hypot(p.x-prev.x,p.y-prev.y)>1e-6){ out.push({x:p.x,y:p.y}); prev=p; } } return out; }
function _clipToBounds(points, width=1200, height=800, pad=24){ const L=pad, R=width-pad, T=pad, B=height-pad; return points.map(p=>({ x: _clamp(p.x,L,R), y: _clamp(p.y,T,B) })); }
function _removeVeryShort(points, minLen=2){ if(points.length<2) return points.slice(); const res=[points[0]]; for(let i=1;i<points.length;i++){ const a=res[res.length-1], b=points[i]; if(Math.hypot(b.x-a.x,b.y-a.y) >= minLen){ res.push(b); } }
  return res.length>=2? res : points.slice(); }
function _removeNearlyCollinear(points, deg=178){ if(points.length<3) return points.slice(); const th = Math.cos((180-deg)*Math.PI/180); const res=[points[0]]; for(let i=1;i<points.length-1;i++){ const a=res[res.length-1], b=points[i], c=points[i+1]; const abx=b.x-a.x, aby=b.y-a.y, bcx=c.x-b.x, bcy=c.y-b.y; const la=Math.hypot(abx,aby)||1, lb=Math.hypot(bcx,bcy)||1; const dot=(abx/la)*(bcx/lb)+(aby/la)*(bcy/lb); if(dot < th){ res.push(b); } }
  res.push(points[points.length-1]); return res; }

function analyzePath(points){
  const N = Array.isArray(points)? points.length : 0; if(N<2) return { points:N, length:0, bends:0, avgTurn:0, bbox:{w:0,h:0}, difficulty:0 };
  let len=0, bends=0, turnSum=0; let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for(let i=0;i<N;i++){ const p=points[i]; if(p.x<minX)minX=p.x; if(p.y<minY)minY=p.y; if(p.x>maxX)maxX=p.x; if(p.y>maxY)maxY=p.y; if(i<N-1){ const q=points[i+1]; len += Math.hypot(q.x-p.x,q.y-p.y); } if(i>0 && i<N-1){ const a=points[i-1], b=p, c=points[i+1]; const ang1=Math.atan2(b.y-a.y,b.x-a.x), ang2=Math.atan2(c.y-b.y,c.x-b.x); let d=ang2-ang1; d=((d+Math.PI)%(2*Math.PI))-Math.PI; const t=Math.abs(d); turnSum+=t; if(t>0.3) bends++; } }
  const bboxW=Math.max(0,maxX-minX), bboxH=Math.max(0,maxY-minY);
  const avgTurn = (N>2)? (turnSum/(N-2)) : 0;
  // crude difficulty heuristic
  const difficulty = Math.min(10, (len/900) + bends*0.15 + avgTurn*0.8);
  return { points:N, length:len, bends, avgTurn, bbox:{w:bboxW,h:bboxH}, difficulty };
}

function optimizePath(points, opts={}){
  const minLen = opts.minSegment||3; const colDeg = opts.collinearDeg||178; const bounds = opts.bounds||{width:1200,height:800,pad:24};
  let res = _dedupe(points||[]);
  res = _clipToBounds(res, bounds.width, bounds.height, bounds.pad);
  res = _removeVeryShort(res, minLen);
  res = _removeNearlyCollinear(res, colDeg);
  if(opts.epsilon) res = _rdp(res, opts.epsilon);
  if(opts.smooth) res = _chaikin(res, opts.smooth);
  if(opts.step) res = _equalize(res, opts.step);
  return res;
}

function autoBuildPath(preset='ring', width=1200, height=800, tile=40, opts={}){
  const gen = generatePresetPoints(preset, width, height, tile, opts);
  const optimized = optimizePath(gen, { epsilon: opts.epsilon||2, smooth: opts.smooth||0, step: opts.step||0, minSegment: opts.minSegment||2, collinearDeg: 179, bounds:{width,height,pad:24} });
  return optimized;
}

// --- Quality checks and advanced builders ---
function _segIntersect(a,b,c,d){
  // Returns {hit:true, x, y} for proper intersections (excludes touching at endpoints)
  const eps=1e-9;
  const bax=b.x-a.x, bay=b.y-a.y, dcx=d.x-c.x, dcy=d.y-c.y, acx=a.x-c.x, acy=a.y-c.y;
  const denom = bax*dcy - bay*dcx; if(Math.abs(denom) < eps) return {hit:false};
  const t = (acx*dcy - acy*dcx) / denom; const u = (acx*bay - acy*bax) / denom;
  if(t>eps && t<1-eps && u>eps && u<1-eps){ return {hit:true, x:a.x + t*bax, y:a.y + t*bay}; }
  return {hit:false};
}
function detectSelfIntersections(points){
  const out=[]; const n=points.length; if(n<4) return {count:0, points:out};
  for(let i=0;i<n-1;i++){
    const a=points[i], b=points[i+1];
    for(let j=i+2;j<n-1;j++){
      // Skip adjacent and the wrap-around pair (i==0 with j==n-2)
      if(j===i+1) continue; if(i===0 && j===n-2) continue;
      const c=points[j], d=points[j+1]; const r=_segIntersect(a,b,c,d);
      if(r.hit) out.push({i,j,x:r.x,y:r.y});
    }
  }
  return {count:out.length, points:out};
}
function capTurnAngles(points, maxDeg=60){
  if(points.length<3) return points.slice(); const maxRad = maxDeg*Math.PI/180;
  const res=[points[0]];
  for(let i=1;i<points.length-1;i++){
    const a=points[i-1], b=points[i], c=points[i+1];
    const ang1=Math.atan2(b.y-a.y,b.x-a.x), ang2=Math.atan2(c.y-b.y,c.x-b.x);
    let d=ang2-ang1; d=((d+Math.PI)%(2*Math.PI))-Math.PI; const turn=Math.abs(d);
    if(turn>maxRad){
      // Insert two helper points to soften the corner near b
      const q1={ x: a.x + (b.x-a.x)*0.7, y: a.y + (b.y-a.y)*0.7 };
      const q2={ x: b.x + (c.x-b.x)*0.3, y: b.y + (c.y-b.y)*0.3 };
      res.push(q1, q2);
    } else {
      res.push(b);
    }
  }
  res.push(points[points.length-1]);
  return res;
}
function autoBuildToDifficulty(preset='riverNoise', width=1200, height=800, tile=40, opts={}){
  const target = _clamp(opts.target||5, 0.5, 10); const tol = opts.tolerance||0.4; const maxIter = opts.maxIter||18; const baseSeed = opts.seed||0;
  let best=null, bestDiff=1e9;
  let complexity = opts.complexity || 3;
  for(let k=0;k<maxIter;k++){
    const seed = baseSeed ? (baseSeed + k*1013904223)>>>0 : (Math.random()*2**31)|0;
    // Adjust knobs depending on last result
    const localComplex = Math.max(1, Math.min(5, Math.round(complexity + (Math.random()*2-1)) ));
    let eps = opts.epsilon ?? 2; let smooth = opts.smooth ?? 1; let step = opts.step ?? 0;
    // Explore: scale epsilon vs smooth oppositely to probe space
    eps = Math.max(1, eps + (Math.random()*2-1)*2);
    smooth = Math.max(0, Math.min(4, smooth + (Math.random()*2-1)*1));
    const gen = generatePresetPoints(preset, width, height, tile, { seed, complexity: localComplex });
    let path = optimizePath(gen, { epsilon: eps, smooth: smooth, step, minSegment: 2, collinearDeg: 179, bounds:{width,height,pad:24} });
    // Cap extreme sharp turns a bit
    path = capTurnAngles(path, 75);
    const info = analyzePath(path); const d=info.difficulty;
    const diff = Math.abs(d - target);
    if(diff < bestDiff){ best = path; bestDiff=diff; }
    // Early exit if good enough
    if(diff <= tol) break;
    // Simple hill-climb: nudge complexity toward target
    if(d < target) complexity += 1; else complexity -= 1;
    complexity = Math.max(1, Math.min(5, complexity));
  }
  return best || autoBuildPath(preset, width, height, tile, opts);
}

// Expose as global for file:// compatibility
window.Maps = {
  DEFAULT_MAPS: DEFAULT_MAPS,
  loadMaps: loadMaps,
  saveMaps: saveMaps,
  upsertMap: upsertMap,
  deleteMap: deleteMap,
  getMap: getMap,
  restoreDefaults: restoreDefaults,
  generateMapId: generateMapId,
  createEmptyMap: createEmptyMap,
  generatePresetPoints: generatePresetPoints,
  simplifyPath: simplifyPath,
  smoothPath: smoothPath,
  equalizeSpacing: equalizeSpacing,
  jitterPath: jitterPath,
  warpPath: warpPath,
  closeLoop: closeLoop,
  reversePath: reversePath,
  flipPoints: flipPoints,
  rotatePoints: rotatePoints,
  scalePoints: scalePoints,
  snapEndpointsToEdges: snapEndpointsToEdges
  ,analyzePath: analyzePath
  ,optimizePath: optimizePath
  ,autoBuildPath: autoBuildPath
  ,autoBuildToDifficulty: autoBuildToDifficulty
  ,capTurnAngles: capTurnAngles
  ,detectSelfIntersections: detectSelfIntersections
};
