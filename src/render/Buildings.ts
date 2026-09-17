import { PAL, shade, mix } from './Palette';
import { mk, rect, px, ellipsePx, linePx, outlineCanvas, TILE } from './Art';
import { hash2 } from '../core/RNG';

/* ============================================================================
   BUDYNKI — rzut 3/4: widać ścianę frontową i połać dachu (brief, sekcja 2).
   Detal: dachówka/strzecha, komin, okiennice, szyld, balkon, schody, mur pruski.
   Każdy budynek jest pre-renderowany raz; pozycje okien trafiają do systemu
   oświetlenia (w nocy palą się okna i latarnie).
   ========================================================================== */

export interface BuildingDef {
  id: string;
  /** lewy-dolny róg rzutu w pikselach świata */
  x: number; y: number;
  /** szerokość i głębokość rzutu w pikselach świata */
  w: number; d: number;
  /** wysokość ściany frontowej */
  wallH: number;
  roof: 'tile' | 'thatch' | 'shingle' | 'flat';
  wall: string;
  trim: string;
  roofColor?: string;
  halfTimber?: boolean;
  stories?: number;
  chimney?: boolean;
  balcony?: boolean;
  stairs?: boolean;
  doorX?: number;      // środek drzwi w px od lewej krawędzi budynku
  doorW?: number;
  windows?: number;
  sign?: { textKey: string; color: string };
  flowerBoxes?: boolean;
  ruin?: boolean;
  /** id wnętrza (osobna scena) */
  interior?: string;
}

export interface BuildingLight { x: number; y: number; r: number; color: string; flicker: number }
export interface RenderedBuilding {
  canvas: HTMLCanvasElement;
  /** przesunięcie lewego-górnego rogu canvasu względem (def.x, def.y) */
  ox: number; oy: number;
  lights: BuildingLight[];
  /** prostokąt drzwi w współrzędnych świata (do detekcji wejścia) */
  door: { x: number; y: number; w: number; h: number } | null;
  /** prostokąt rzutu (kolizja) */
  footprint: { x: number; y: number; w: number; h: number };
}

const cache = new Map<string, RenderedBuilding>();

export function renderBuilding(def: BuildingDef, seed = 0): RenderedBuilding {
  const key = `${def.id}|${def.x}|${def.y}|${def.w}|${def.d}|${def.wallH}|${def.roof}|${def.wall}|${def.ruin ? 1 : 0}|${seed}`;
  const hit = cache.get(key); if (hit) return hit;

  const overhang = 7;
  const roofH = Math.round(def.d * 0.62) + 6;
  const topPad = roofH + (def.chimney ? 16 : 6);
  const cw = def.w + overhang * 2 + 6;
  const ch = def.wallH + topPad + 8;
  const [c, x] = mk(cw, ch);
  const baseX = overhang + 3;             // lewa krawędź ściany na canvasie
  const baseY = ch - 6;                   // dolna krawędź ściany (poziom gruntu)
  const wallTop = baseY - def.wallH;

  const lights: BuildingLight[] = [];

  // --- fundament ---
  rect(x, baseX - 2, baseY - 4, def.w + 4, 5, PAL.stone0);
  rect(x, baseX - 2, baseY - 4, def.w + 4, 2, PAL.stone1);
  for (let i = 0; i < Math.floor(def.w / 6); i++) px(x, baseX + i * 6, baseY - 2, PAL.stone2);

  // --- ściana frontowa ---
  const wallC = def.ruin ? mix(def.wall, PAL.stone1, 0.5) : def.wall;
  rect(x, baseX, wallTop, def.w, def.wallH, wallC);
  // tekstura tynku
  for (let i = 0; i < def.w * def.wallH * 0.05; i++) {
    const nx = baseX + Math.floor(hash2(i, seed, 101) * def.w);
    const ny = wallTop + Math.floor(hash2(i, seed, 103) * def.wallH);
    px(x, nx, ny, shade(wallC, hash2(i, seed, 107) > 0.5 ? 0.07 : -0.07));
  }
  // cieniowanie: prawa strona ciemniejsza, dół ciemniejszy (światło z lewej-góry)
  rect(x, baseX + def.w - 6, wallTop, 6, def.wallH, shade(wallC, -0.14));
  rect(x, baseX, baseY - 8, def.w, 8, shade(wallC, -0.08));
  rect(x, baseX, wallTop, def.w, 2, shade(wallC, 0.12));

  // --- mur pruski (belki) ---
  if (def.halfTimber) {
    const tr = def.trim;
    rect(x, baseX, wallTop, def.w, 3, tr);
    rect(x, baseX, baseY - 4, def.w, 4, tr);
    rect(x, baseX, wallTop, 3, def.wallH, tr);
    rect(x, baseX + def.w - 3, wallTop, 3, def.wallH, shade(tr, -0.2));
    const bays = Math.max(2, Math.floor(def.w / 26));
    for (let i = 1; i < bays; i++) {
      const bx = baseX + Math.round(i * def.w / bays);
      rect(x, bx - 1, wallTop, 3, def.wallH, tr);
      linePx(x, bx, wallTop + 4, bx + Math.round(def.w / bays / 2), baseY - 6, shade(tr, -0.1));
    }
    // pozioma belka międzypiętrowa
    if ((def.stories ?? 1) > 1) rect(x, baseX, wallTop + Math.round(def.wallH * 0.52), def.w, 3, tr);
  }

  // --- drzwi ---
  const doorW = def.doorW ?? 14;
  const doorX = baseX + (def.doorX ?? def.w / 2) - doorW / 2;
  const doorH = Math.min(24, def.wallH - 6);
  let doorRect: RenderedBuilding['door'] = null;
  if (!def.ruin) {
    rect(x, doorX - 2, baseY - doorH - 3, doorW + 4, doorH + 3, def.trim);
    rect(x, doorX - 2, baseY - doorH - 3, doorW + 4, 2, shade(def.trim, 0.2));
    rect(x, doorX, baseY - doorH, doorW, doorH, shade(PAL.wood1, -0.12));
    for (let i = 0; i < 3; i++) rect(x, doorX + 1 + i * Math.floor(doorW / 3), baseY - doorH + 1, Math.floor(doorW / 3) - 1, doorH - 2, i % 2 ? PAL.wood1 : PAL.wood2);
    rect(x, doorX, baseY - doorH + 4, doorW, 2, PAL.metal0);
    rect(x, doorX, baseY - 10, doorW, 2, PAL.metal0);
    px(x, doorX + doorW - 3, baseY - doorH / 2, PAL.clothYel1);
    px(x, doorX + doorX % 1 + 2, baseY - doorH / 2, PAL.clothYel1);
    // próg i schody
    rect(x, doorX - 3, baseY - 1, doorW + 6, 3, PAL.stone1);
    if (def.stairs) {
      rect(x, doorX - 5, baseY + 1, doorW + 10, 2, PAL.stone2);
      rect(x, doorX - 7, baseY + 3, doorW + 14, 2, PAL.stone1);
    }
    doorRect = { x: def.x + (doorX - baseX), y: def.y - 2, w: doorW, h: 8 };
  } else {
    rect(x, doorX, baseY - doorH, doorW, doorH, PAL.ink0);
    for (let i = 0; i < 4; i++) px(x, doorX + 2 + i * 3, baseY - doorH + 3 + i * 4, PAL.wood0);
  }

  // --- okna (+ światło w nocy) ---
  const winCount = def.windows ?? Math.max(1, Math.floor(def.w / 30));
  const winW = 11, winH = 12;
  const winY = wallTop + Math.round(def.wallH * 0.28);
  for (let i = 0; i < winCount; i++) {
    const span = def.w - 20;
    let wx = baseX + 10 + (winCount === 1 ? span / 2 : (i * span) / (winCount - 1)) - winW / 2;
    if (Math.abs(wx + winW / 2 - (doorX + doorW / 2)) < 12) wx += 16;
    wx = Math.max(baseX + 4, Math.min(baseX + def.w - winW - 4, Math.round(wx)));
    drawWindow(x, wx, winY, winW, winH, def.trim, !!def.ruin);
    const lx = def.x + (wx - baseX) + winW / 2;
    const ly = def.y - def.wallH + (winY - wallTop) + winH / 2;
    lights.push({ x: lx, y: ly, r: 46, color: PAL.fire3, flicker: 0.12 });
    if (def.flowerBoxes && !def.ruin) {
      rect(x, wx - 1, winY + winH + 1, winW + 2, 3, PAL.wood1);
      for (let f = 0; f < 4; f++) {
        px(x, wx + f * 3, winY + winH, f % 2 ? PAL.clothRed2 : PAL.clothYel2);
        px(x, wx + 1 + f * 3, winY + winH + 1, PAL.leaf2);
      }
    }
    // drugie piętro
    if ((def.stories ?? 1) > 1) {
      const wy2 = wallTop + Math.round(def.wallH * 0.06);
      drawWindow(x, wx, wy2, winW - 1, winH - 2, def.trim, !!def.ruin);
      lights.push({ x: def.x + (wx - baseX) + winW / 2, y: def.y - def.wallH + (wy2 - wallTop) + winH / 2, r: 38, color: PAL.fire2, flicker: 0.15 });
    }
  }

  // --- balkon ---
  if (def.balcony) {
    const by = wallTop + Math.round(def.wallH * 0.5);
    rect(x, baseX + 8, by, def.w - 16, 3, def.trim);
    for (let i = 0; i < Math.floor((def.w - 16) / 5); i++) rect(x, baseX + 10 + i * 5, by - 8, 2, 8, shade(def.trim, -0.1));
    rect(x, baseX + 8, by - 9, def.w - 16, 2, def.trim);
  }

  // --- dach ---
  drawRoof(x, baseX - overhang, wallTop, def.w + overhang * 2, roofH, def, seed);

  // --- komin ---
  if (def.chimney) {
    const cxp = baseX + def.w * 0.72, cyp = wallTop - roofH * 0.72;
    rect(x, cxp, cyp - 16, 9, 20, PAL.stone1);
    rect(x, cxp - 1, cyp - 18, 11, 3, PAL.stone2);
    rect(x, cxp + 7, cyp - 16, 2, 20, PAL.stone0);
    for (let i = 0; i < 4; i++) rect(x, cxp, cyp - 14 + i * 5, 9, 1, PAL.stone0);
  }

  // --- szyld ---
  if (def.sign && !def.ruin) {
    const sx = baseX + def.w - 18, sy = wallTop + 6;
    rect(x, sx, sy + 1, 3, 8, PAL.metal0);
    rect(x, sx + 2, sy + 8, 16, 12, def.sign.color);
    rect(x, sx + 2, sy + 8, 16, 2, shade(def.sign.color, 0.2));
    rect(x, sx + 2, sy + 18, 16, 2, shade(def.sign.color, -0.25));
    rect(x, sx + 5, sy + 11, 10, 6, shade(def.sign.color, -0.1));
  }

  // --- zniszczenia / ruina ---
  if (def.ruin) {
    for (let i = 0; i < 26; i++) {
      const rx = baseX + Math.floor(hash2(i, seed, 211) * def.w);
      const ry = wallTop + Math.floor(hash2(i, seed, 213) * def.wallH);
      px(x, rx, ry, PAL.stone0); px(x, rx + 1, ry, PAL.stone1);
    }
    for (let i = 0; i < 8; i++) {
      const rx = baseX + Math.floor(hash2(i, seed, 223) * def.w);
      linePx(x, rx, wallTop, rx + 2, wallTop + 10, PAL.leaf1);
    }
  }

  // --- mech i brud u podstawy ---
  for (let i = 0; i < 10; i++) {
    const rx = baseX + Math.floor(hash2(i, seed, 307) * def.w);
    px(x, rx, baseY - 1 - Math.floor(hash2(i, seed, 311) * 3), PAL.leaf0);
  }

  const outlined = outlineCanvas(c, PAL.ink0);
  const res: RenderedBuilding = {
    canvas: outlined,
    ox: -(overhang + 3) - 1,
    oy: -(def.wallH + topPad) - 1,
    lights,
    door: doorRect,
    footprint: { x: def.x, y: def.y - def.d, w: def.w, h: def.d }
  };
  cache.set(key, res);
  return res;
}

function drawWindow(x: CanvasRenderingContext2D, wx: number, wy: number, w: number, h: number, trim: string, ruin: boolean) {
  rect(x, wx - 1, wy - 1, w + 2, h + 2, trim);
  rect(x, wx, wy, w, h, ruin ? PAL.ink0 : PAL.ink1);
  if (!ruin) {
    rect(x, wx + 1, wy + 1, w - 2, h - 2, mix(PAL.water0, PAL.ink1, 0.4));
    rect(x, wx + 1, wy + 1, w - 2, 3, mix(PAL.water3, PAL.fire3, 0.25));
    rect(x, wx + Math.floor(w / 2), wy, 1, h, trim);
    rect(x, wx, wy + Math.floor(h / 2), w, 1, trim);
  }
  // okiennice
  rect(x, wx - 4, wy - 1, 3, h + 2, shade(trim, -0.15));
  rect(x, wx + w + 1, wy - 1, 3, h + 2, shade(trim, -0.15));
  px(x, wx - 3, wy + 2, PAL.metal1); px(x, wx + w + 2, wy + 2, PAL.metal1);
  // parapet
  rect(x, wx - 2, wy + h + 1, w + 4, 2, PAL.stone2);
}

function drawRoof(x: CanvasRenderingContext2D, rx: number, eavesY: number, rw: number, rh: number,
  def: BuildingDef, seed: number) {
  const c0 = def.roofColor ?? (def.roof === 'thatch' ? PAL.thatch1 : def.roof === 'shingle' ? PAL.wood1 : PAL.tile1);
  const c1 = shade(c0, 0.12), c2 = shade(c0, -0.18), c3 = shade(c0, -0.34);
  const insetTop = rw * 0.22;   // wierzchołek dachu węższy — perspektywa 3/4
  if (def.roof === 'flat') {
    rect(x, rx, eavesY - 8, rw, 8, c2);
    rect(x, rx, eavesY - 10, rw, 3, c1);
    for (let i = 0; i < rw / 4; i++) px(x, rx + i * 4, eavesY - 6, c0);
    rect(x, rx, eavesY - 12, rw, 2, def.trim);
    return;
  }
  const ridgeY = eavesY - rh;
  // połać przednia (trapez) — rysowana pasami od okapu do kalenicy
  for (let row = 0; row < rh; row++) {
    const t = row / rh;
    const lx = rx + insetTop * t;
    const wdt = rw - insetTop * 2 * t;
    const yy = eavesY - row;
    const band = def.roof === 'thatch'
      ? (row % 3 === 0 ? c1 : row % 3 === 1 ? c0 : c2)
      : (row % 4 < 2 ? c1 : c0);
    rect(x, lx, yy, wdt, 1, shade(band, -t * 0.18));
    // rzędy dachówek / strzechy
    if (def.roof !== 'thatch' && row % 4 === 0) {
      const tiles = Math.max(3, Math.floor(wdt / 7));
      for (let i = 0; i < tiles; i++) {
        const txp = lx + (i * wdt) / tiles;
        rect(x, txp, yy - 1, Math.max(1, wdt / tiles - 1), 2, shade(c1, -0.05 + hash2(i, row, seed) * 0.1));
        px(x, txp, yy + 1, c3);
      }
    }
    if (def.roof === 'thatch' && row % 2 === 0) {
      for (let i = 0; i < 8; i++) {
        const txp = lx + hash2(i, row, seed + 5) * wdt;
        linePx(x, txp, yy, txp + (hash2(i, row, seed + 9) - 0.5) * 3, yy - 3, c2);
      }
    }
  }
  // kalenica
  rect(x, rx + insetTop - 2, ridgeY - 2, rw - insetTop * 2 + 4, 4, c2);
  rect(x, rx + insetTop - 2, ridgeY - 2, rw - insetTop * 2 + 4, 2, c1);
  if (def.roof === 'thatch') for (let i = 0; i < (rw - insetTop * 2) / 3; i++) px(x, rx + insetTop + i * 3, ridgeY - 3, c1);
  // krawędzie (wiatrownice)
  linePx(x, rx, eavesY, rx + insetTop, ridgeY, c3);
  linePx(x, rx + rw, eavesY, rx + rw - insetTop, ridgeY, c3);
  // okap
  rect(x, rx - 1, eavesY - 1, rw + 2, 3, def.trim);
  rect(x, rx - 1, eavesY - 1, rw + 2, 1, shade(def.trim, 0.2));
  // deszczowanie / brud
  for (let i = 0; i < 20; i++) {
    const dx = rx + hash2(i, seed, 401) * rw;
    const dy = eavesY - hash2(i, seed, 403) * rh;
    px(x, dx, dy, c3);
  }
  if (def.ruin) {
    for (let i = 0; i < 12; i++) {
      const dx = rx + hash2(i, seed, 501) * rw;
      const dy = eavesY - hash2(i, seed, 503) * rh;
      rect(x, dx, dy, 3 + hash2(i, seed, 507) * 4, 2 + hash2(i, seed, 509) * 3, PAL.ink0);
    }
  }
}

/** Cień budynku rzucany spójnie w jednym kierunku (brief, sekcja 2). */
export function drawBuildingShadow(ctx: CanvasRenderingContext2D, b: RenderedBuilding, def: BuildingDef, sunDir: { x: number; y: number }, darkness: number) {
  ctx.save();
  ctx.globalAlpha = 0.22 + darkness * 0.2;
  ctx.fillStyle = '#000';
  const len = 16 + def.wallH * 0.35;
  const ox = sunDir.x * len, oy = Math.abs(sunDir.y) * len * 0.45 + 4;
  ctx.beginPath();
  ctx.moveTo(def.x - 2, def.y);
  ctx.lineTo(def.x + def.w + 2, def.y);
  ctx.lineTo(def.x + def.w + 2 + ox, def.y + oy);
  ctx.lineTo(def.x - 2 + ox, def.y + oy);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/* ============================================================================
   WNĘTRZA — oddzielne sceny z płynnym przejściem (przyciemnienie 0,3 s)
   ========================================================================== */

export interface InteriorDef {
  id: string;
  nameKey: string;
  w: number; h: number;            // w kaflach
  floor: 'floorWood' | 'floorStone' | 'rug';
  wall: string;
  props: Array<[string, number, number, number?]>;
  lights: Array<[number, number, number, string]>;
  exits: Array<{ tx: number; ty: number; w: number; to: string; spawnX?: number; spawnY?: number }>;
  stations?: Array<{ tx: number; ty: number; kind: string; labelKey: string; npc?: string }>;
  npcs?: string[];
}

export function renderInteriorWalls(def: InteriorDef): HTMLCanvasElement {
  const [c, x] = mk(def.w * TILE, def.h * TILE);
  const wallH = 44;
  // podłoga
  for (let j = 0; j < def.h; j++) for (let i = 0; i < def.w; i++) {
    const v = (i + j * 3) % 3;
    const tone = (i + j) % 2 === 0 ? PAL.wood2 : shade(PAL.wood2, 0.05);
    rect(x, i * TILE, j * TILE, TILE, TILE, def.floor === 'floorStone' ? ((i + j) % 2 ? PAL.stone2 : PAL.stone3) : tone);
  }
  if (def.floor === 'rug') {
    rect(x, def.w * TILE / 2 - 48, def.h * TILE / 2 - 30, 96, 60, PAL.clothRed0);
    rect(x, def.w * TILE / 2 - 44, def.h * TILE / 2 - 26, 88, 52, PAL.clothRed1);
    rect(x, def.w * TILE / 2 - 38, def.h * TILE / 2 - 20, 76, 40, PAL.clothYel0);
  }
  for (let i = 0; i < def.w * def.h * 2; i++) {
    const nx = Math.floor(hash2(i, 1, def.w) * def.w * TILE), ny = Math.floor(hash2(i, 2, def.h) * def.h * TILE);
    px(x, nx, ny, 'rgba(0,0,0,0.08)');
  }
  // ściany (góra i boki)
  rect(x, 0, 0, def.w * TILE, wallH, def.wall);
  rect(x, 0, wallH - 4, def.w * TILE, 4, shade(def.wall, -0.3));
  rect(x, 0, 0, def.w * TILE, 3, shade(def.wall, 0.15));
  rect(x, 0, 0, 10, def.h * TILE, shade(def.wall, -0.15));
  rect(x, def.w * TILE - 10, 0, 10, def.h * TILE, shade(def.wall, -0.25));
  // belki
  for (let i = 1; i < 5; i++) rect(x, (i * def.w * TILE) / 5, 0, 5, wallH, shade(def.wall, -0.25));
  return c;
}

export function clearBuildingCache() { cache.clear(); }
