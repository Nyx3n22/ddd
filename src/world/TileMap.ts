import { GroundType, groundVariants, waterFrames, TILE } from '../render/Art';
export { TILE };
import { hash2 } from '../core/RNG';

/* ============================================================================
   MAPA KAFELKOWA — warstwy: podłoże → obiekty niskie → postacie → obiekty
   wysokie → dachy → oświetlenie → pogoda → UI (brief, sekcja 8).
   Świat dzielony na chunki 16×16 kafli; rysujemy tylko chunki w kadrze.
   ========================================================================== */

export const GROUND_TYPES: GroundType[] = [
  'grass', 'grassTall', 'dirt', 'cobble', 'sand', 'mud', 'planks', 'stone',
  'water', 'waterDeep', 'gravel', 'snow', 'floorWood', 'floorStone', 'rug',
  'field', 'swamp', 'ash', 'road'
];
const GIDX: Record<string, number> = {};
GROUND_TYPES.forEach((g, i) => GIDX[g] = i);

export const CHUNK = 16;

/** Jak głośne jest podłoże (skradanie) i jak szybkie (ruch). */
export const GROUND_STATS: Record<GroundType, { noise: number; speed: number; step: string }> = {
  grass: { noise: 0.25, speed: 1.0, step: 'grass' },
  grassTall: { noise: 0.4, speed: 0.92, step: 'grass' },
  dirt: { noise: 0.3, speed: 1.0, step: 'dirt' },
  road: { noise: 0.35, speed: 1.06, step: 'dirt' },
  cobble: { noise: 0.72, speed: 1.0, step: 'stone' },
  stone: { noise: 0.7, speed: 1.0, step: 'stone' },
  sand: { noise: 0.42, speed: 0.94, step: 'sand' },
  mud: { noise: 0.5, speed: 0.78, step: 'mud' },
  swamp: { noise: 0.55, speed: 0.7, step: 'mud' },
  planks: { noise: 0.62, speed: 1.0, step: 'wood' },
  water: { noise: 0.8, speed: 0.55, step: 'water' },
  waterDeep: { noise: 0.9, speed: 0.4, step: 'water' },
  gravel: { noise: 0.66, speed: 0.96, step: 'stone' },
  snow: { noise: 0.45, speed: 0.86, step: 'snow' },
  floorWood: { noise: 0.6, speed: 1.0, step: 'wood' },
  floorStone: { noise: 0.68, speed: 1.0, step: 'stone' },
  rug: { noise: 0.18, speed: 1.0, step: 'grass' },
  field: { noise: 0.35, speed: 0.95, step: 'grass' },
  ash: { noise: 0.4, speed: 0.95, step: 'dirt' }
};

export class TileMap {
  readonly w: number; readonly h: number;
  ground: Uint8Array;
  variant: Uint8Array;
  blocked: Uint8Array;
  /** nakładki: kałuże, krew, ślady stóp, śnieg */
  overlay: Uint8Array;
  overlayTint: Float32Array;
  private chunkDirty: Uint8Array;
  readonly chunksX: number; readonly chunksY: number;

  constructor(w: number, h: number, base: GroundType = 'grass') {
    this.w = w; this.h = h;
    this.chunksX = Math.ceil(w / CHUNK); this.chunksY = Math.ceil(h / CHUNK);
    this.ground = new Uint8Array(w * h).fill(GIDX[base]);
    this.variant = new Uint8Array(w * h);
    this.blocked = new Uint8Array(w * h);
    this.overlay = new Uint8Array(w * h);
    this.overlayTint = new Float32Array(w * h);
    this.chunkDirty = new Uint8Array(this.chunksX * this.chunksY).fill(1);
    for (let i = 0; i < w * h; i++) this.variant[i] = Math.floor(hash2(i % w, Math.floor(i / w), 7) * 3);
  }

  idx(tx: number, ty: number) { return ty * this.w + tx; }
  inside(tx: number, ty: number) { return tx >= 0 && ty >= 0 && tx < this.w && ty < this.h; }

  groundAt(tx: number, ty: number): GroundType {
    if (!this.inside(tx, ty)) return 'waterDeep';
    return GROUND_TYPES[this.ground[this.idx(tx, ty)]];
  }
  groundAtPx(x: number, y: number): GroundType { return this.groundAt(Math.floor(x / TILE), Math.floor(y / TILE)); }

  setGround(tx: number, ty: number, type: GroundType, variant?: number) {
    if (!this.inside(tx, ty)) return;
    const i = this.idx(tx, ty);
    this.ground[i] = GIDX[type] ?? 0;
    if (variant !== undefined) this.variant[i] = variant;
    this.markChunk(tx, ty);
  }
  fillRect(tx: number, ty: number, w: number, h: number, type: GroundType) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.setGround(tx + i, ty + j, type);
  }
  isWater(tx: number, ty: number) { const g = this.groundAt(tx, ty); return g === 'water' || g === 'waterDeep'; }
  isBlocked(tx: number, ty: number) {
    if (!this.inside(tx, ty)) return true;
    return this.blocked[this.idx(tx, ty)] === 1;
  }
  setBlocked(tx: number, ty: number, v: boolean) {
    if (!this.inside(tx, ty)) return;
    this.blocked[this.idx(tx, ty)] = v ? 1 : 0;
    this.markChunk(tx, ty);
  }
  blockRect(tx: number, ty: number, w: number, h: number, v = true) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.setBlocked(tx + i, ty + j, v);
  }
  setOverlay(tx: number, ty: number, kind: number, tint = 1) {
    if (!this.inside(tx, ty)) return;
    const i = this.idx(tx, ty);
    this.overlay[i] = kind; this.overlayTint[i] = tint; this.markChunk(tx, ty);
  }
  private markChunk(tx: number, ty: number) {
    const cx = Math.floor(tx / CHUNK), cy = Math.floor(ty / CHUNK);
    if (cx >= 0 && cy >= 0 && cx < this.chunksX && cy < this.chunksY) this.chunkDirty[cy * this.chunksX + cx] = 1;
  }

  /** Kolizja koła z siatką — zwraca true, jeśli pozycja jest wolna. */
  freeCircle(x: number, y: number, r: number): boolean {
    const x0 = Math.floor((x - r) / TILE), x1 = Math.floor((x + r) / TILE);
    const y0 = Math.floor((y - r) / TILE), y1 = Math.floor((y + r) / TILE);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      if (!this.inside(tx, ty)) return false;
      if (this.blocked[this.idx(tx, ty)]) {
        // dokładny test koło-prostokąt na kaflu
        const cx = Math.max(tx * TILE, Math.min(x, tx * TILE + TILE));
        const cy = Math.max(ty * TILE, Math.min(y, ty * TILE + TILE));
        if ((cx - x) ** 2 + (cy - y) ** 2 < r * r) return false;
      }
    }
    return true;
  }

  /** Ruch z poślizgiem po przeszkodach (osobno X i Y). */
  tryMove(pos: { x: number; y: number }, dx: number, dy: number, r: number): { x: number; y: number; hitX: boolean; hitY: boolean } {
    let hitX = false, hitY = false;
    let nx = pos.x + dx;
    if (!this.freeCircle(nx, pos.y, r)) { nx = pos.x; hitX = true; }
    let ny = pos.y + dy;
    if (!this.freeCircle(nx, ny, r)) { ny = pos.y; hitY = true; }
    return { x: nx, y: ny, hitX, hitY };
  }

  /* ------------------- wyszukiwanie ścieżki (A*) ------------------- */
  findPath(sx: number, sy: number, gx: number, gy: number, maxNodes = 1600): Array<{ x: number; y: number }> | null {
    if (!this.inside(sx, sy) || !this.inside(gx, gy)) return null;
    if (this.isBlocked(gx, gy)) {
      const near = this.nearestFree(gx, gy, 4);
      if (!near) return null;
      gx = near.x; gy = near.y;
    }
    const key = (x: number, y: number) => y * this.w + x;
    const open: number[] = [key(sx, sy)];
    const gScore = new Map<number, number>();
    const came = new Map<number, number>();
    const f = new Map<number, number>();
    gScore.set(key(sx, sy), 0);
    f.set(key(sx, sy), Math.abs(gx - sx) + Math.abs(gy - sy));
    let nodes = 0;
    while (open.length && nodes++ < maxNodes) {
      // wybór najmniejszego f (kopiec liniowy — przy małych dystansach wystarczy)
      let bi = 0;
      for (let i = 1; i < open.length; i++) if ((f.get(open[i]) ?? 1e9) < (f.get(open[bi]) ?? 1e9)) bi = i;
      const cur = open.splice(bi, 1)[0];
      const cx = cur % this.w, cy = Math.floor(cur / this.w);
      if (cx === gx && cy === gy) {
        const path: Array<{ x: number; y: number }> = [];
        let c: number | undefined = cur;
        while (c !== undefined) { path.push({ x: c % this.w, y: Math.floor(c / this.w) }); c = came.get(c); }
        return path.reverse();
      }
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]] as const) {
        const nx = cx + dx, ny = cy + dy;
        if (!this.inside(nx, ny) || this.isBlocked(nx, ny)) continue;
        if (dx !== 0 && dy !== 0 && (this.isBlocked(cx + dx, cy) || this.isBlocked(cx, cy + dy))) continue;
        const nk = key(nx, ny);
        const step = (dx !== 0 && dy !== 0 ? 1.414 : 1) * (GROUND_STATS[this.groundAt(nx, ny)].speed < 0.9 ? 1.25 : 1);
        const tentative = (gScore.get(cur) ?? 1e9) + step;
        if (tentative < (gScore.get(nk) ?? 1e9)) {
          came.set(nk, cur); gScore.set(nk, tentative);
          f.set(nk, tentative + Math.abs(gx - nx) + Math.abs(gy - ny));
          if (!open.includes(nk)) open.push(nk);
        }
      }
    }
    return null;
  }

  nearestFree(tx: number, ty: number, radius = 6): { x: number; y: number } | null {
    for (let r = 1; r <= radius; r++) {
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const nx = tx + dx, ny = ty + dy;
        if (this.inside(nx, ny) && !this.isBlocked(nx, ny)) return { x: nx, y: ny };
      }
    }
    return null;
  }

  /* ------------------- rysowanie chunków ------------------- */
  draw(ctx: CanvasRenderingContext2D, camX: number, camY: number, viewW: number, viewH: number, time: number, rain: number, snow: boolean) {
    const tx0 = Math.max(0, Math.floor(camX / TILE)), ty0 = Math.max(0, Math.floor(camY / TILE));
    const tx1 = Math.min(this.w - 1, Math.ceil((camX + viewW) / TILE));
    const ty1 = Math.min(this.h - 1, Math.ceil((camY + viewH) / TILE));
    const waterA = waterFrames(false), waterB = waterFrames(true);
    const wf = Math.floor(time * 4) % 4;
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        const i = this.idx(tx, ty);
        const g = GROUND_TYPES[this.ground[i]];
        const sx = tx * TILE - camX, sy = ty * TILE - camY;
        let img: HTMLCanvasElement;
        if (g === 'water') img = waterA[wf];
        else if (g === 'waterDeep') img = waterB[wf];
        else img = groundVariants(g, 3)[this.variant[i] % 3];
        ctx.drawImage(img, sx | 0, sy | 0);
        // kałuże w deszczu
        if (rain > 0.3 && (g === 'dirt' || g === 'cobble' || g === 'road' || g === 'mud') && hash2(tx, ty, 55) < rain * 0.25) {
          ctx.fillStyle = 'rgba(40,60,80,0.34)';
          const r = 4 + hash2(tx, ty, 56) * 7;
          ctx.beginPath(); ctx.ellipse(sx + 16, sy + 16, r, r * 0.55, 0, 0, Math.PI * 2); ctx.fill();
        }
        if (snow && (g === 'grass' || g === 'dirt' || g === 'cobble' || g === 'road') && hash2(tx, ty, 77) < 0.7) {
          ctx.fillStyle = 'rgba(233,236,240,0.4)';
          ctx.fillRect(sx, sy, TILE, TILE);
        }
        // nakładki (krew, ślady)
        const ov = this.overlay[i];
        if (ov) {
          const a = this.overlayTint[i];
          if (ov === 1) { ctx.fillStyle = `rgba(90,16,10,${0.55 * a})`; ctx.beginPath(); ctx.ellipse(sx + 16, sy + 16, 7, 4, 0, 0, Math.PI * 2); ctx.fill(); }
          else if (ov === 2) { ctx.fillStyle = `rgba(30,22,14,${0.4 * a})`; ctx.fillRect(sx + 12, sy + 14, 8, 4); }
          else if (ov === 3) { ctx.fillStyle = `rgba(20,16,10,${0.3 * a})`; ctx.fillRect(sx + 13, sy + 15, 6, 3); }
        }
      }
    }
  }
}
