import { TileMap, TILE } from './TileMap';
import type { Scene } from './Scene';
import { getProp, propOffset, propDef, type GroundType } from '../render/Art';
import { hash2 } from '../core/RNG';
import npcsJson from '../data/npcs.json';

/* ============================================================================
   ZAGOSPODAROWANIE DZIELNICY
   Dane dzielnicy opisują ulice, budynki i ważne obiekty. Ten moduł dokłada
   to, czego nikt nie układa ręcznie: trawę na podwórkach z dala od ruchu,
   wydeptane ścieżki pod drzwi, drzewa za murami, krzewy, kwiaty, trzciny
   przy wodzie. Wszystko deterministyczne (hash pozycji), więc mapa jest
   za każdym razem taka sama i zgodna z zapisem gry.
   ========================================================================== */

const HARD: GroundType[] = ['cobble', 'road', 'planks', 'stone', 'floorStone', 'floorWood'];

export interface DecorBounds { wallX0: number; wallX1: number; wallY0: number; wallY1: number }

export function decorateDistrict(tm: TileMap, scene: Scene, walls: DecorBounds, extraReserved: Array<[number, number]>, forests: Array<[number, number, number, number, number]> = []) {
  const forestAt = (tx: number, ty: number) => { for (const f of forests) if (tx >= f[0] && ty >= f[1] && tx < f[0] + f[2] && ty < f[1] + f[3]) return f[4]; return 0; };
  const W = tm.w, H = tm.h;
  const reserved = new Uint8Array(W * H);
  const reserve = (tx: number, ty: number, r = 0) => {
    for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
      const x = tx + i, y = ty + j;
      if (tm.inside(x, y)) reserved[y * W + x] = 1;
    }
  };
  for (const [tx, ty] of extraReserved) reserve(tx, ty, 1);
  // miejsca, w których stoją i chodzą NPC — tam nic nie stawiamy
  for (const n of ((npcsJson as any).npcs ?? npcsJson) as any[]) {
    for (const e of n.schedule ?? []) {
      if (e.scene !== 'world') continue;
      reserve(e.at[0], e.at[1], 1);
      for (const wp of e.waypoints ?? []) reserve(wp[0], wp[1], 1);
    }
  }
  // istniejące obiekty: drzwi (z zapasem na podejście), propsy, stacje
  for (const o of scene.objects) {
    const tx = Math.floor(o.x / TILE), ty = Math.floor((o.y - 1) / TILE);
    if (o.kind === 'door') { reserve(tx, ty, 1); reserve(tx, ty + 2, 1); }
    else if (o.kind === 'prop' || o.kind === 'station' || o.kind === 'gate') reserve(tx, ty, 1);
  }

  /* --- 1. odległość od „ruchu”: zabudowa, ulice, pomosty --- */
  const dist = new Int16Array(W * H).fill(999);
  const queue: number[] = [];
  for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) {
    const g = tm.groundAt(tx, ty);
    const water = g === 'water' || g === 'waterDeep';
    if ((tm.isBlocked(tx, ty) && !water) || HARD.includes(g)) { dist[ty * W + tx] = 0; queue.push(ty * W + tx); }
  }
  for (let qi = 0; qi < queue.length; qi++) {
    const i = queue[qi], tx = i % W, ty = (i / W) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = tx + dx, ny = ty + dy;
      if (!tm.inside(nx, ny)) continue;
      const ni = ny * W + nx;
      if (dist[ni] > dist[i] + 1) { dist[ni] = dist[i] + 1; queue.push(ni); }
    }
  }

  /* --- 2. podwórka zarastają: ziemia daleko od ruchu staje się trawą --- */
  for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) {
    if (tm.groundAt(tx, ty) !== 'dirt') continue;
    const d = dist[ty * W + tx];
    const n = smoothNoise(tx, ty, 7, 913) * 0.8 + hash2(tx, ty, 914) * 0.2;
    if ((d >= 2 && n > 0.62) || (d >= 3 && n > 0.48) || (d >= 5 && n > 0.3) || d >= 7) tm.setGround(tx, ty, 'grass');
  }

  /* --- 3. wydeptane ścieżki od drzwi do najbliższej ulicy --- */
  for (const door of scene.doors) {
    const sx = Math.floor(door.x / TILE), sy = Math.floor(door.y / TILE);
    carvePath(tm, sx, sy);
  }

  /* --- 4. roślinność i drobiazgi --- */
  const inside = (tx: number, ty: number) => tx > walls.wallX0 && tx < walls.wallX1 && ty > walls.wallY0 && ty < walls.wallY1;
  const place = (type: string, tx: number, ty: number, variant: number) => {
    const d = propDef(type); const art = getProp(type, variant, type !== 'tuft' && type !== 'pebbles');
    if (!d || !art) return;
    const ox = Math.round((hash2(tx, ty, 71) - 0.5) * 14), oy = Math.round((hash2(tx, ty, 72) - 0.5) * 8);
    const ax = tx * TILE + TILE / 2 + ox, ay = (ty + 1) * TILE - 6 + oy;
    const off = propOffset(type);
    const bw = Math.max(8, Math.round(d.w * 0.35)), bh = 6;
    const trunk = type === 'treeOak' || type === 'treePine';
    scene.add({
      kind: d.solid ? 'prop' : 'decal', type, id: `decor_${type}_${tx}_${ty}`, x: ax, y: ay,
      box: d.solid ? (trunk ? { x: ax - 6, y: ay - 8, w: 12, h: 8 } : { x: ax - bw / 2, y: ay - bh, w: bw, h: bh }) : null,
      sortY: d.solid ? ay : ay - 20, tall: d.tall, art, dx: off.dx, dy: off.dy, variant,
      solid: d.solid, nameKey: `prop.${type}`,
      interactId: type === 'bush' ? `prop:bush:${tx}_${ty}` : undefined
    });
    reserve(tx, ty, d.solid ? 1 : 0);
  };
  for (let ty = 1; ty < H - 1; ty++) for (let tx = 1; tx < W - 1; tx++) {
    const i = ty * W + tx;
    if (reserved[i] || tm.isBlocked(tx, ty)) continue;
    const g = tm.groundAt(tx, ty);
    const d = dist[i];
    const r = hash2(tx, ty, 4242), v = Math.floor(hash2(tx, ty, 4243) * 4);
    const nearWater = [[0, 1], [0, -1], [1, 0], [-1, 0]].some(([dx, dy]) => tm.isWater(tx + dx, ty + dy));
    const inTown = inside(tx, ty);
    const fd = forestAt(tx, ty);
    if (fd > 0 && (g === 'grass' || g === 'grassTall')) {
      // las: gęsto drzew, pod nimi paprocie, grzyby i krzaki
      if (d >= 2 && r < fd) place(hash2(tx, ty, 5) < 0.55 ? 'treePine' : 'treeOak', tx, ty, v);
      else if (r < fd + 0.06) place('bush', tx, ty, v);
      else if (r < fd + 0.16) place('fern', tx, ty, v);
      else if (r < fd + 0.2) place('mushrooms', tx, ty, v);
      else if (r < fd + 0.23 && d >= 2) place(hash2(tx, ty, 6) < 0.6 ? 'stump' : 'rock', tx, ty, v);
      continue;
    }
    if (g === 'grass' || g === 'grassTall') {
      if (!inTown && d >= 3 && r < 0.075) place(hash2(tx, ty, 5) < 0.6 ? 'treeOak' : 'treePine', tx, ty, v);
      else if (inTown && d >= 4 && r < 0.018) place('treeOak', tx, ty, v);
      else if (d >= 2 && r < (inTown ? 0.045 : 0.1)) place('bush', tx, ty, v);
      else if (!inTown && d >= 3 && r < 0.115) place(hash2(tx, ty, 6) < 0.5 ? 'rock' : 'stump', tx, ty, v);
      else if (r < 0.2) place('tuft', tx, ty, v);
      else if (r < (inTown ? 0.26 : 0.24)) place('flowers', tx, ty, v);
      else if (g === 'grassTall' && r < 0.32) place('fern', tx, ty, v);
      else if (!inTown && r < 0.27 && d >= 3) place('mushrooms', tx, ty, v);
    } else if (g === 'sand') {
      if (nearWater && r < 0.3) place('reeds', tx, ty, v);
      else if (r < 0.06) place('pebbles', tx, ty, v);
    } else if (g === 'swamp' || g === 'mud') {
      if (r < 0.14) place('reeds', tx, ty, v);
      else if (r < 0.18) place('mushrooms', tx, ty, v);
    } else if (g === 'dirt' && d >= 1) {
      if (r < 0.04) place('pebbles', tx, ty, v);
      else if (r < 0.07) place('tuft', tx, ty, v);
    }
  }
}

/** Szum wartości z interpolacją — łagodne plamy zamiast szachownicy. */
function smoothNoise(x: number, y: number, scale: number, seed: number): number {
  const gx = x / scale, gy = y / scale;
  const x0 = Math.floor(gx), y0 = Math.floor(gy);
  const fx = gx - x0, fy = gy - y0;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = hash2(x0, y0, seed), b = hash2(x0 + 1, y0, seed), c = hash2(x0, y0 + 1, seed), d = hash2(x0 + 1, y0 + 1, seed);
  return (a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy;
}

/** BFS od drzwi do najbliższego twardego podłoża; po drodze zostawia ubitą ziemię. */
function carvePath(tm: TileMap, sx: number, sy: number) {
  const W = tm.w;
  const prev = new Map<number, number>();
  const start = sy * W + sx;
  const q = [start]; prev.set(start, -1);
  let goal = -1;
  for (let qi = 0; qi < q.length && qi < 4000; qi++) {
    const i = q[qi], tx = i % W, ty = (i / W) | 0;
    if (i !== start && HARD.includes(tm.groundAt(tx, ty))) { goal = i; break; }
    // najpierw w dół (od frontu budynku), potem na boki
    for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1]]) {
      const nx = tx + dx, ny = ty + dy;
      if (!tm.inside(nx, ny) || tm.isBlocked(nx, ny)) continue;
      const ni = ny * W + nx;
      if (prev.has(ni)) continue;
      prev.set(ni, i); q.push(ni);
    }
  }
  if (goal < 0) return;
  let cur = prev.get(goal)!;
  while (cur !== undefined && cur >= 0) {
    const tx = cur % W, ty = (cur / W) | 0;
    const g = tm.groundAt(tx, ty);
    if (g === 'grass' || g === 'grassTall' || g === 'sand' || g === 'field') tm.setGround(tx, ty, 'dirt');
    cur = prev.get(cur)!;
  }
}
