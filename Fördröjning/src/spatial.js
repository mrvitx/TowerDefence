// Simple spatial hash for 2D queries
export class SpatialHash{
  constructor(cellSize=80){ this.cellSize = cellSize; this.map = new Map(); }
  _key(cx, cy){ return cx+','+cy; }
  clear(){ this.map.clear(); }
  insert(x,y,obj){ const cs=this.cellSize; const cx=Math.floor(x/cs), cy=Math.floor(y/cs); const key=this._key(cx,cy); let arr=this.map.get(key); if(!arr){ arr=[]; this.map.set(key,arr);} arr.push(obj); }
  // Query approximate circle by visiting overlapped cells
  queryCircle(x,y,r){ const cs=this.cellSize; const minX = Math.floor((x-r)/cs), maxX=Math.floor((x+r)/cs); const minY=Math.floor((y-r)/cs), maxY=Math.floor((y+r)/cs); const out=[]; for(let cy=minY; cy<=maxY; cy++){ for(let cx=minX; cx<=maxX; cx++){ const arr=this.map.get(this._key(cx,cy)); if(arr){ out.push(...arr); } } } return out; }
}
