import { PAL, shade, mix, hex2rgb, rgb2css } from './Palette';
import { hash2 } from '../core/RNG';

/* ============================================================================
   NARZĘDZIA RYSOWANIA PIXEL ART
   Wszystko rysujemy proceduralnie na offscreenowych canvasach — zero assetów
   binarnych w repozytorium, pełna kontrola nad paletą i rozmiarem kafla.
   ========================================================================== */

export const TILE = 32;

export function mk(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h));
  const x = c.getContext('2d')!;
  x.imageSmoothingEnabled = false;
  return [c, x];
}

export function rect(x: CanvasRenderingContext2D, px: number, py: number, w: number, h: number, c: string) {
  x.fillStyle = c; x.fillRect(px | 0, py | 0, Math.ceil(w), Math.ceil(h));
}
export function px(x: CanvasRenderingContext2D, px: number, py: number, c: string) {
  x.fillStyle = c; x.fillRect(px | 0, py | 0, 1, 1);
}
/** Prostokąt z ciemną obwódką (czytelność na każdym tle). */
export function box(x: CanvasRenderingContext2D, px_: number, py_: number, w: number, h: number, fill: string, outline = PAL.ink1) {
  if (outline) { rect(x, px_ - 1, py_ - 1, w + 2, h + 2, outline); }
  rect(x, px_, py_, w, h, fill);
}
/** Elipsa "pikselowa" — przez skanowanie (daje twardą krawędź, bez antyaliasingu). */
export function ellipsePx(x: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, c: string) {
  x.fillStyle = c;
  for (let j = -Math.ceil(ry); j <= Math.ceil(ry); j++) {
    const w = Math.floor(rx * Math.sqrt(Math.max(0, 1 - (j * j) / (ry * ry))));
    if (w > 0) x.fillRect(Math.round(cx - w), Math.round(cy + j), w * 2 + 1, 1);
  }
}
export function linePx(x: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, c: string) {
  x.strokeStyle = c; x.lineWidth = 1; x.beginPath();
  x.moveTo(Math.floor(x0) + 0.5, Math.floor(y0) + 0.5); x.lineTo(Math.floor(x1) + 0.5, Math.floor(y1) + 0.5); x.stroke();
}
/** Szum/dithering na powierzchni — faktura podłoża. */
export function noiseFill(x: CanvasRenderingContext2D, w: number, h: number, seed: number, colors: string[], density = 0.5, ox = 0, oy = 0) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const r = hash2(i + ox, j + oy, seed);
    if (r < density) {
      const c = colors[Math.floor(hash2(i + ox, j + oy, seed + 991) * colors.length) % colors.length];
      px(x, i, j, c);
    }
  }
}
/** Kontur sylwetki: przerysowuje piksele sąsiadujące z przezroczystością. */
export function outlineCanvas(src: HTMLCanvasElement, color = PAL.ink0, alphaThreshold = 40): HTMLCanvasElement {
  const [c, x] = mk(src.width + 2, src.height + 2);
  const s = src.getContext('2d')!;
  const d = s.getImageData(0, 0, src.width, src.height);
  const at = (i: number, j: number) => {
    if (i < 0 || j < 0 || i >= src.width || j >= src.height) return 0;
    return d.data[(j * src.width + i) * 4 + 3];
  };
  const out = x.createImageData(src.width + 2, src.height + 2);
  for (let j = 0; j < src.height + 2; j++) for (let i = 0; i < src.width + 2; i++) {
    const si = i - 1, sj = j - 1;
    const selfA = at(si, sj);
    const idx = (j * (src.width + 2) + i) * 4;
    if (selfA >= alphaThreshold) {
      const p = (si + sj * src.width) * 4;
      out.data[idx] = d.data[p]; out.data[idx + 1] = d.data[p + 1];
      out.data[idx + 2] = d.data[p + 2]; out.data[idx + 3] = d.data[p + 3];
    } else {
      const near = at(si - 1, sj) >= alphaThreshold || at(si + 1, sj) >= alphaThreshold ||
        at(si, sj - 1) >= alphaThreshold || at(si, sj + 1) >= alphaThreshold;
      if (near) { const [r, g, b] = hex2rgb(color); out.data[idx] = r; out.data[idx + 1] = g; out.data[idx + 2] = b; out.data[idx + 3] = 255; }
    }
  }
  x.putImageData(out, 0, 0);
  return c;
}

/* ============================================================================
   PODŁOŻA — kafle 32×32, odróżnialne kolorem i teksturą (brief, sekcja 2)
   ========================================================================== */

export type GroundType =
  | 'grass' | 'grassTall' | 'dirt' | 'cobble' | 'sand' | 'mud' | 'planks' | 'stone'
  | 'water' | 'waterDeep' | 'gravel' | 'snow' | 'floorWood' | 'floorStone' | 'rug'
  | 'field' | 'swamp' | 'ash' | 'road';

const groundCache = new Map<string, HTMLCanvasElement[]>();

export function groundVariants(type: GroundType, variants = 3): HTMLCanvasElement[] {
  const hit = groundCache.get(type); if (hit) return hit;
  const out: HTMLCanvasElement[] = [];
  for (let v = 0; v < variants; v++) out.push(paintGround(type, v));
  groundCache.set(type, out);
  return out;
}

function paintGround(type: GroundType, v: number): HTMLCanvasElement {
  const [c, x] = mk(TILE, TILE);
  const seed = v * 7919 + 13;
  switch (type) {
    case 'grass': {
      rect(x, 0, 0, TILE, TILE, PAL.grass1);
      noiseFill(x, TILE, TILE, seed, [PAL.grass2, PAL.grass0, PAL.grass3], 0.55);
      for (let i = 0; i < 7; i++) {
        const gx = Math.floor(hash2(i, v, seed + 3) * 30) + 1, gy = Math.floor(hash2(i, v, seed + 77) * 28) + 2;
        px(x, gx, gy, PAL.grass3); px(x, gx, gy - 1, PAL.grass4); px(x, gx + 1, gy, PAL.grass0);
      }
      break;
    }
    case 'grassTall': {
      rect(x, 0, 0, TILE, TILE, PAL.grass0);
      noiseFill(x, TILE, TILE, seed, [PAL.grass1, PAL.grass2, PAL.leaf1], 0.7);
      for (let i = 0; i < 14; i++) {
        const gx = Math.floor(hash2(i, v, seed + 5) * 31), gy = Math.floor(hash2(i, v, seed + 11) * 24) + 6;
        linePx(x, gx, gy, gx + (hash2(i, v, 9) - 0.5) * 4, gy - 6, PAL.grass3);
      }
      break;
    }
    case 'dirt': {
      rect(x, 0, 0, TILE, TILE, PAL.dirt2);
      noiseFill(x, TILE, TILE, seed, [PAL.dirt1, PAL.dirt3, PAL.dirt0, PAL.dirt4], 0.5);
      for (let i = 0; i < 4; i++) {
        const gx = Math.floor(hash2(i, v, seed + 21) * 26) + 2, gy = Math.floor(hash2(i, v, seed + 31) * 26) + 2;
        ellipsePx(x, gx, gy, 2, 1, PAL.dirt1);
      }
      break;
    }
    case 'road': {
      rect(x, 0, 0, TILE, TILE, PAL.dirt3);
      noiseFill(x, TILE, TILE, seed, [PAL.dirt2, PAL.dirt4, PAL.dirt1], 0.6);
      // koleiny
      rect(x, 4, 0, 3, TILE, shade(PAL.dirt2, -0.12)); rect(x, 24, 0, 3, TILE, shade(PAL.dirt2, -0.12));
      noiseFill(x, TILE, TILE, seed + 5, [PAL.dirt1], 0.14);
      break;
    }
    case 'cobble': {
      rect(x, 0, 0, TILE, TILE, PAL.stone1);
      for (let r = 0; r < 4; r++) for (let cc = 0; cc < 4; cc++) {
        const ox = (r % 2) * 4;
        const bx = cc * 8 + ox + Math.floor(hash2(cc, r, seed) * 2) - 1;
        const by = r * 8 + Math.floor(hash2(cc, r, seed + 4) * 2);
        const w = 6 + Math.floor(hash2(cc, r, seed + 8) * 2), h = 6;
        const tone = hash2(cc, r, seed + 12) > 0.6 ? PAL.stone3 : (hash2(cc, r, seed + 16) > 0.5 ? PAL.stone2 : PAL.stone1);
        rect(x, bx + 1, by + 1, w, h, tone);
        px(x, bx + 1, by + 1, shade(tone, 0.16));
        px(x, bx + w, by + h, shade(tone, -0.22));
      }
      noiseFill(x, TILE, TILE, seed + 33, [PAL.stone0], 0.1);
      break;
    }
    case 'stone': {
      rect(x, 0, 0, TILE, TILE, PAL.stone2);
      for (let i = 0; i < 5; i++) {
        const bx = Math.floor(hash2(i, v, seed) * 24), by = Math.floor(hash2(i, v, seed + 2) * 24);
        const w = 6 + Math.floor(hash2(i, v, seed + 6) * 6), h = 5 + Math.floor(hash2(i, v, seed + 9) * 5);
        rect(x, bx, by, w, h, i % 2 ? PAL.stone3 : PAL.stone1);
        rect(x, bx, by, w, 1, PAL.stone4); rect(x, bx, by + h - 1, w, 1, PAL.stone0);
      }
      noiseFill(x, TILE, TILE, seed + 41, [PAL.stone0, PAL.stone4], 0.22);
      break;
    }
    case 'gravel': {
      rect(x, 0, 0, TILE, TILE, PAL.stone1);
      noiseFill(x, TILE, TILE, seed, [PAL.stone2, PAL.stone0, PAL.stone3, PAL.dirt1], 0.75);
      break;
    }
    case 'sand': {
      rect(x, 0, 0, TILE, TILE, PAL.sand1);
      noiseFill(x, TILE, TILE, seed, [PAL.sand2, PAL.sand0, PAL.sand3], 0.5);
      for (let i = 0; i < 3; i++) {
        const gy = Math.floor(hash2(i, v, seed + 3) * 28) + 2;
        linePx(x, 0, gy, TILE, gy + (hash2(i, v, 5) - .5) * 4, PAL.sand2);
      }
      break;
    }
    case 'mud': {
      rect(x, 0, 0, TILE, TILE, PAL.mud1);
      noiseFill(x, TILE, TILE, seed, [PAL.mud2, PAL.mud0, PAL.mud3], 0.6);
      for (let i = 0; i < 3; i++) {
        const bx = Math.floor(hash2(i, v, seed + 7) * 20) + 4, by = Math.floor(hash2(i, v, seed + 13) * 20) + 4;
        ellipsePx(x, bx, by, 4, 2, PAL.mud0); ellipsePx(x, bx, by - 1, 3, 1, mix(PAL.water0, PAL.mud0, .5));
      }
      break;
    }
    case 'swamp': {
      rect(x, 0, 0, TILE, TILE, PAL.mud0);
      noiseFill(x, TILE, TILE, seed, [PAL.mud1, PAL.leaf0, PAL.grass0], 0.7);
      for (let i = 0; i < 5; i++) {
        const gx = Math.floor(hash2(i, v, seed + 17) * 30), gy = Math.floor(hash2(i, v, seed + 19) * 28) + 3;
        linePx(x, gx, gy, gx, gy - 5, PAL.leaf1); linePx(x, gx + 1, gy, gx + 2, gy - 4, PAL.grass1);
      }
      break;
    }
    case 'planks': {
      rect(x, 0, 0, TILE, TILE, PAL.wood1);
      for (let r = 0; r < 4; r++) {
        const tone = r % 2 ? PAL.wood2 : shade(PAL.wood2, -0.08);
        rect(x, 0, r * 8, TILE, 7, tone);
        rect(x, 0, r * 8 + 7, TILE, 1, PAL.wood0);
        for (let i = 0; i < 5; i++) {
          const gx = Math.floor(hash2(i, r, seed) * 30);
          px(x, gx, r * 8 + Math.floor(hash2(i, r, seed + 2) * 6), shade(tone, -0.18));
        }
        px(x, 3, r * 8 + 3, PAL.metal0); px(x, 28, r * 8 + 3, PAL.metal0);
      }
      break;
    }
    case 'floorWood': {
      rect(x, 0, 0, TILE, TILE, PAL.wood2);
      for (let i = 0; i < 4; i++) {
        rect(x, i * 8, 0, 7, TILE, i % 2 ? PAL.wood2 : shade(PAL.wood2, 0.06));
        rect(x, i * 8 + 7, 0, 1, TILE, PAL.wood0);
        for (let j = 0; j < 6; j++) px(x, i * 8 + Math.floor(hash2(i, j, seed) * 6), j * 5 + Math.floor(hash2(i, j, seed + 1) * 4), shade(PAL.wood2, -0.14));
      }
      break;
    }
    case 'floorStone': {
      rect(x, 0, 0, TILE, TILE, PAL.stone2);
      for (let r = 0; r < 2; r++) for (let cc = 0; cc < 2; cc++) {
        rect(x, cc * 16 + 1, r * 16 + 1, 14, 14, (r + cc) % 2 ? PAL.stone3 : PAL.stone2);
        rect(x, cc * 16, r * 16, 16, 1, PAL.stone1); rect(x, cc * 16, r * 16, 1, 16, PAL.stone1);
      }
      noiseFill(x, TILE, TILE, seed + 55, [PAL.stone1], 0.12);
      break;
    }
    case 'rug': {
      rect(x, 0, 0, TILE, TILE, PAL.clothRed1);
      rect(x, 2, 2, TILE - 4, TILE - 4, PAL.clothRed0);
      rect(x, 5, 5, TILE - 10, TILE - 10, PAL.clothYel0);
      for (let i = 0; i < 4; i++) { px(x, 8 + i * 5, 16, PAL.clothYel2); px(x, 16, 8 + i * 5, PAL.clothYel2); }
      rect(x, 0, 0, TILE, 1, PAL.ink2); rect(x, 0, TILE - 1, TILE, 1, PAL.ink2);
      break;
    }
    case 'water': case 'waterDeep': {
      const base = type === 'waterDeep' ? PAL.water0 : PAL.water1;
      rect(x, 0, 0, TILE, TILE, base);
      noiseFill(x, TILE, TILE, seed, [shade(base, 0.08), shade(base, -0.12)], 0.45);
      for (let i = 0; i < 4; i++) {
        const wy = Math.floor(hash2(i, v, seed + 23) * 26) + 3;
        const wx = Math.floor(hash2(i, v, seed + 29) * 16);
        linePx(x, wx, wy, wx + 8 + Math.floor(hash2(i, v, seed + 31) * 8), wy, PAL.water3);
        px(x, wx + 1, wy - 1, PAL.water4);
      }
      break;
    }
    case 'snow': {
      rect(x, 0, 0, TILE, TILE, PAL.clothWhite1);
      noiseFill(x, TILE, TILE, seed, [PAL.clothWhite2, PAL.clothWhite0, PAL.stone3], 0.5);
      break;
    }
    case 'field': {
      rect(x, 0, 0, TILE, TILE, PAL.dirt2);
      for (let r = 0; r < 4; r++) {
        rect(x, 0, r * 8 + 2, TILE, 4, PAL.dirt3);
        for (let i = 0; i < 6; i++) {
          const gx = i * 5 + Math.floor(hash2(i, r, seed) * 3);
          px(x, gx, r * 8 + 2, PAL.grass2); px(x, gx, r * 8 + 1, PAL.clothYel1); px(x, gx + 1, r * 8 + 3, PAL.grass1);
        }
      }
      break;
    }
    case 'ash': {
      rect(x, 0, 0, TILE, TILE, PAL.stone0);
      noiseFill(x, TILE, TILE, seed, ['#2a2724', '#3b3733', '#57534c'], 0.7);
      for (let i = 0; i < 3; i++) {
        const bx = Math.floor(hash2(i, v, seed + 3) * 24), by = Math.floor(hash2(i, v, seed + 8) * 24);
        rect(x, bx, by, 5, 2, PAL.wood0); px(x, bx + 1, by - 1, PAL.fire0);
      }
      break;
    }
  }
  return c;
}

/** Woda animowana: 4 klatki przesunięte w czasie. */
export function waterFrames(deep = false): HTMLCanvasElement[] {
  const key = deep ? 'waterDeepAnim' : 'waterAnim';
  const hit = groundCache.get(key); if (hit) return hit;
  const frames: HTMLCanvasElement[] = [];
  for (let f = 0; f < 4; f++) frames.push(paintGround(deep ? 'waterDeep' : 'water', f));
  groundCache.set(key, frames);
  return frames;
}

/* ============================================================================
   OBIEKTY ŚWIATA (props) — konkretne rzeczy, nie symbole (brief, sekcja 2)
   ========================================================================== */

export interface PropArt {
  /** szerokość/wysokość canvasu */ w: number; h: number;
  /** przesunięcie punktu kotwicy (stopy/środek podstawy) względem canvasu */ ox: number; oy: number;
  /** czy obiekt zasłania postać (rysowany w warstwie wysokiej) */ tall: boolean;
  /** czy blokuje ruch */ solid: boolean;
  /** czy można go chwycić/przesunąć (F) */ grabbable: boolean;
  /** cień: elipsa pod obiektem */ shadow: boolean;
  draw(x: CanvasRenderingContext2D, variant: number): void;
}

export const PROPS: Record<string, PropArt> = {};

function def(name: string, w: number, h: number, draw: (x: CanvasRenderingContext2D, v: number) => void,
  opts: Partial<PropArt> = {}) {
  PROPS[name] = {
    w, h, ox: Math.round(w / 2), oy: h - 4, tall: opts.tall ?? h > 30, solid: opts.solid ?? true,
    grabbable: opts.grabbable ?? false, shadow: opts.shadow ?? true, draw
  };
}

/* --- beczka --- */
def('barrel', 20, 26, (x, v) => {
  const c0 = v % 2 ? PAL.wood1 : PAL.wood2;
  rect(x, 4, 4, 12, 18, c0);
  rect(x, 3, 6, 14, 14, shade(c0, 0.05));
  rect(x, 4, 4, 12, 2, shade(c0, 0.18));          // wieko
  ellipsePx(x, 10, 5, 6, 2, shade(c0, 0.12));
  rect(x, 3, 8, 14, 2, PAL.metal1); rect(x, 3, 16, 14, 2, PAL.metal1);  // obręcze
  rect(x, 3, 8, 14, 1, PAL.metal2); rect(x, 3, 16, 14, 1, PAL.metal2);
  for (let i = 0; i < 3; i++) rect(x, 6 + i * 3, 6, 1, 14, shade(c0, -0.18)); // klepki
  rect(x, 4, 21, 12, 1, PAL.wood0);
}, { grabbable: true });

def('barrelStack', 26, 34, (x) => {
  for (const [ox, oy] of [[0, 8], [12, 8], [6, -2]] as const) {
    const c = PAL.wood2;
    rect(x, 2 + ox, 6 + oy, 11, 16, c);
    ellipsePx(x, 7.5 + ox, 7 + oy, 5.5, 2, shade(c, 0.12));
    rect(x, 2 + ox, 10 + oy, 11, 2, PAL.metal1); rect(x, 2 + ox, 17 + oy, 11, 2, PAL.metal1);
    rect(x, 2 + ox, 21 + oy, 11, 1, PAL.wood0);
  }
}, { tall: true });

/* --- skrzynia --- */
def('crate', 20, 18, (x) => {
  rect(x, 2, 4, 16, 12, PAL.wood2);
  rect(x, 2, 4, 16, 2, PAL.wood3);
  rect(x, 2, 14, 16, 2, PAL.wood0);
  linePx(x, 2, 4, 18, 16, PAL.wood1); linePx(x, 18, 4, 2, 16, PAL.wood1);
  rect(x, 2, 9, 16, 1, PAL.wood1);
  px(x, 3, 5, PAL.metal1); px(x, 16, 5, PAL.metal1); px(x, 3, 14, PAL.metal1); px(x, 16, 14, PAL.metal1);
}, { grabbable: true });

def('crateStack', 24, 34, (x) => {
  rect(x, 2, 14, 20, 16, PAL.wood1);
  rect(x, 4, 2, 16, 14, PAL.wood2);
  for (const [ox, oy, w, h] of [[2, 14, 20, 16], [4, 2, 16, 14]] as const) {
    rect(x, ox, oy, w, 2, PAL.wood3); rect(x, ox, oy + h - 2, w, 2, PAL.wood0);
    linePx(x, ox, oy, ox + w, oy + h, shade(PAL.wood1, -0.1));
  }
}, { tall: true });

/* --- wory zboża / sól --- */
def('sack', 18, 18, (x, v) => {
  const c = v % 2 ? PAL.clothWhite0 : PAL.parch1;
  ellipsePx(x, 9, 12, 7, 5, c);
  rect(x, 5, 4, 8, 5, c); rect(x, 6, 3, 6, 2, shade(c, -0.15));
  linePx(x, 6, 6, 12, 6, PAL.wood1);
  noiseFill(x, 18, 18, v * 31, [shade(c, -0.2), shade(c, 0.2)], 0.18);
}, { grabbable: true });

/* --- wóz z kołem --- */
def('cart', 46, 34, (x) => {
  rect(x, 4, 10, 38, 12, PAL.wood1);
  rect(x, 4, 10, 38, 2, PAL.wood3);
  for (let i = 0; i < 6; i++) rect(x, 6 + i * 6, 12, 1, 10, PAL.wood0);
  rect(x, 2, 8, 42, 3, PAL.wood2);
  // koła
  for (const cx of [10, 34]) {
    ellipsePx(x, cx, 24, 7, 7, PAL.wood0);
    ellipsePx(x, cx, 24, 6, 6, PAL.wood2);
    for (let a = 0; a < 6; a++) linePx(x, cx, 24, cx + Math.cos(a * Math.PI / 3) * 6, 24 + Math.sin(a * Math.PI / 3) * 6, PAL.wood1);
    ellipsePx(x, cx, 24, 2, 2, PAL.metal1);
    ellipsePx(x, cx, 24, 7, 7, 'rgba(0,0,0,0)');
  }
  rect(x, 40, 14, 6, 2, PAL.wood1); // dyszel
  // towar
  rect(x, 12, 4, 10, 7, PAL.clothWhite0); rect(x, 24, 5, 9, 6, PAL.parch1);
}, { tall: true, grabbable: true });

/* --- studnia z żurawiem --- */
def('well', 40, 48, (x) => {
  // ocembrowanie
  ellipsePx(x, 20, 38, 15, 6, PAL.stone0);
  rect(x, 6, 28, 28, 10, PAL.stone2);
  ellipsePx(x, 20, 28, 14, 5, PAL.stone3);
  ellipsePx(x, 20, 28, 10, 3.4, PAL.water0);
  ellipsePx(x, 20, 29, 8, 2.6, PAL.water1);
  for (let i = 0; i < 7; i++) rect(x, 6 + i * 4, 29, 1, 9, PAL.stone1);
  // słupki i żuraw
  rect(x, 8, 8, 3, 22, PAL.wood1); rect(x, 29, 8, 3, 22, PAL.wood1);
  rect(x, 6, 6, 28, 3, PAL.wood2);
  linePx(x, 20, 8, 34, 3, PAL.wood2); linePx(x, 34, 3, 34, 12, PAL.wood0);
  rect(x, 33, 12, 3, 3, PAL.metal1); // wiadro
  rect(x, 12, 16, 16, 2, PAL.wood3); // daszek-belka
  // daszek
  for (let i = 0; i < 7; i++) rect(x, 6 + i, 6 - Math.min(i, 6 - i), 28 - i * 2, 2, i % 2 ? PAL.tile1 : PAL.tile2);
}, { tall: true, solid: true });

/* --- stóg siana --- */
def('haystack', 40, 36, (x) => {
  ellipsePx(x, 20, 30, 17, 7, PAL.thatch0);
  for (let i = 0; i < 8; i++) {
    const w = 34 - i * 3.6, y = 28 - i * 3;
    ellipsePx(x, 20, y, w / 2, 4, i % 2 ? PAL.thatch1 : PAL.thatch2);
  }
  for (let i = 0; i < 40; i++) {
    const a = hash2(i, 3, 77) * Math.PI * 2, r = hash2(i, 5, 13) * 15;
    px(x, 20 + Math.cos(a) * r, 22 + Math.sin(a) * r * 0.6, PAL.thatch3);
  }
}, { tall: true });

/* --- piec chlebowy --- */
def('oven', 44, 40, (x) => {
  rect(x, 4, 18, 36, 18, PAL.stone1);
  ellipsePx(x, 22, 18, 18, 12, PAL.stone2);
  ellipsePx(x, 22, 16, 16, 10, PAL.stone3);
  rect(x, 15, 24, 14, 12, PAL.ink0);
  ellipsePx(x, 22, 24, 7, 5, PAL.ink0);
  rect(x, 17, 30, 10, 6, PAL.fire1); rect(x, 19, 28, 6, 4, PAL.fire2);
  rect(x, 20, 32, 4, 3, PAL.fire3);
  rect(x, 34, 4, 5, 16, PAL.stone1); rect(x, 33, 2, 7, 3, PAL.stone2); // komin
  noiseFill(x, 44, 40, 5, [PAL.stone0], 0.1);
}, { tall: true });

/* --- stragan z płótnem --- */
def('stall', 52, 44, (x, v) => {
  const cloth = [PAL.clothRed1, PAL.clothBlue1, PAL.clothYel1, PAL.clothWhite1][v % 4];
  rect(x, 4, 24, 44, 4, PAL.wood2);            // blat
  rect(x, 6, 28, 3, 12, PAL.wood1); rect(x, 43, 28, 3, 12, PAL.wood1);
  rect(x, 8, 30, 36, 8, PAL.wood0);
  for (let i = 0; i < 5; i++) rect(x, 6 + i * 9, 10, 3, 16, PAL.wood1); // słupki
  // płótno falujące
  for (let i = 0; i < 12; i++) {
    const yy = 6 + Math.round(Math.sin(i * 0.7) * 1.5);
    rect(x, 4 + i * 4, yy, 4, 6, i % 2 ? cloth : shade(cloth, 0.1));
  }
  rect(x, 2, 4, 48, 3, shade(cloth, -0.25));
  rect(x, 2, 12, 48, 1, PAL.ink2);
  // towar na blacie
  for (let i = 0; i < 4; i++) {
    const tx = 8 + i * 10;
    if (v % 3 === 0) { ellipsePx(x, tx + 2, 22, 3, 2, PAL.clothYel2); px(x, tx + 2, 20, PAL.clothYel1); } // bochny
    else if (v % 3 === 1) { ellipsePx(x, tx + 2, 22, 3, 2, PAL.clothRed2); rect(x, tx, 20, 5, 2, PAL.leaf1); } // warzywa
    else { rect(x, tx, 20, 6, 3, PAL.metal2); px(x, tx + 2, 19, PAL.metal3); } // ryby/narzędzia
  }
}, { tall: true });

/* --- płot --- */
def('fence', 32, 20, (x) => {
  rect(x, 0, 6, 32, 3, PAL.wood2); rect(x, 0, 13, 32, 3, PAL.wood2);
  for (let i = 0; i < 4; i++) {
    const fx = 2 + i * 9;
    rect(x, fx, 2, 3, 16, PAL.wood1); rect(x, fx, 2, 3, 1, PAL.wood3);
    px(x, fx + 1, 8, PAL.wood0);
  }
  rect(x, 0, 17, 32, 1, PAL.wood0);
}, { tall: false });

def('gate', 34, 30, (x) => {
  rect(x, 0, 0, 4, 30, PAL.stone1); rect(x, 30, 0, 4, 30, PAL.stone1);
  rect(x, 0, 0, 4, 2, PAL.stone3); rect(x, 30, 0, 4, 2, PAL.stone3);
  for (let i = 0; i < 4; i++) rect(x, 5 + i * 6, 6, 3, 20, PAL.wood1);
  rect(x, 4, 10, 26, 3, PAL.wood2); rect(x, 4, 20, 26, 3, PAL.wood2);
  rect(x, 14, 14, 6, 6, PAL.metal1); px(x, 16, 17, PAL.ink0);
}, { tall: true });

/* --- latarnia --- */
def('lampPost', 16, 44, (x) => {
  rect(x, 6, 12, 3, 30, PAL.metal0); rect(x, 7, 12, 1, 30, PAL.metal1);
  rect(x, 3, 40, 9, 3, PAL.stone1);
  rect(x, 3, 6, 9, 8, PAL.metal1); rect(x, 4, 7, 7, 6, PAL.fire3);
  rect(x, 5, 8, 5, 4, PAL.fire4);
  rect(x, 2, 4, 11, 2, PAL.metal0); rect(x, 6, 1, 3, 3, PAL.metal0);
}, { tall: true, solid: true });

def('torchStand', 14, 32, (x) => {
  rect(x, 6, 12, 3, 18, PAL.wood1);
  rect(x, 4, 8, 7, 5, PAL.wood0);
  rect(x, 5, 2, 5, 7, PAL.fire1); rect(x, 6, 1, 3, 5, PAL.fire2); rect(x, 6, 0, 2, 3, PAL.fire3);
}, { tall: true });

/* --- szyld / tablica ogłoszeń --- */
def('signPost', 20, 34, (x, v) => {
  rect(x, 8, 10, 3, 22, PAL.wood1);
  rect(x, 1, 4, 18, 10, PAL.wood2); rect(x, 1, 4, 18, 2, PAL.wood3); rect(x, 1, 12, 18, 2, PAL.wood0);
  for (let i = 0; i < 3; i++) rect(x, 3, 7 + i * 2, 14, 1, v % 2 ? PAL.ink2 : PAL.clothRed1);
  rect(x, 9, 1, 2, 3, PAL.metal1);
}, { tall: true });

def('noticeBoard', 40, 36, (x) => {
  rect(x, 4, 14, 4, 20, PAL.wood1); rect(x, 32, 14, 4, 20, PAL.wood1);
  rect(x, 2, 4, 36, 22, PAL.wood2); rect(x, 2, 4, 36, 2, PAL.wood3);
  rect(x, 4, 7, 32, 17, PAL.wood0);
  // kartki
  const spots = [[6, 9], [16, 8], [26, 10], [9, 16], [21, 16]];
  spots.forEach(([sx, sy], i) => {
    rect(x, sx, sy, 8, 9, i % 2 ? PAL.parch2 : PAL.parch3);
    for (let l = 0; l < 4; l++) rect(x, sx + 1, sy + 2 + l * 2, 6, 1, PAL.parch4);
    px(x, sx + 4, sy, PAL.metal2);
  });
  for (let i = 0; i < 4; i++) rect(x, 2 + i * 12, 2, 3, 4, PAL.tile1); // daszek
}, { tall: true });

/* --- drzewa --- */
def('treeOak', 56, 76, (x, v) => {
  rect(x, 24, 44, 8, 26, PAL.wood0); rect(x, 25, 44, 3, 26, PAL.wood1);
  for (let i = 0; i < 3; i++) linePx(x, 28, 50, 20 + i * 8, 42, PAL.wood0);
  const blobs = [[28, 24, 22, 16], [14, 32, 14, 11], [42, 32, 14, 11], [28, 38, 18, 10], [20, 18, 12, 9], [38, 18, 12, 9]];
  blobs.forEach(([cx, cy, rx, ry], i) => {
    ellipsePx(x, cx, cy, rx, ry, i % 2 ? PAL.leaf0 : PAL.leaf1);
    ellipsePx(x, cx - 2, cy - 3, rx * 0.7, ry * 0.6, PAL.leaf2);
    ellipsePx(x, cx - 4, cy - 5, rx * 0.4, ry * 0.35, PAL.leaf3);
  });
  for (let i = 0; i < 30; i++) px(x, 6 + Math.floor(hash2(i, v, 3) * 44), 6 + Math.floor(hash2(i, v, 9) * 40), PAL.leaf3);
}, { tall: true });

def('treePine', 40, 72, (x, v) => {
  rect(x, 17, 52, 6, 18, PAL.wood0);
  for (let i = 0; i < 5; i++) {
    const w = 30 - i * 5, y = 52 - i * 10;
    ellipsePx(x, 20, y, w / 2, 7, i % 2 ? PAL.leaf0 : PAL.leaf1);
    ellipsePx(x, 20 - 2, y - 2, w / 2 - 3, 4, PAL.leaf2);
  }
  for (let i = 0; i < 16; i++) px(x, 8 + Math.floor(hash2(i, v, 21) * 24), 10 + Math.floor(hash2(i, v, 23) * 44), PAL.leaf3);
}, { tall: true });

def('bush', 26, 20, (x, v) => {
  ellipsePx(x, 13, 13, 11, 7, PAL.leaf0);
  ellipsePx(x, 11, 11, 8, 5, PAL.leaf1);
  ellipsePx(x, 9, 9, 5, 3, PAL.leaf2);
  for (let i = 0; i < 8; i++) px(x, 4 + Math.floor(hash2(i, v, 41) * 18), 6 + Math.floor(hash2(i, v, 43) * 10), PAL.leaf3);
  if (v % 3 === 0) { px(x, 15, 12, PAL.clothRed1); px(x, 9, 14, PAL.clothRed1); }
}, { tall: false });

def('rock', 24, 18, (x, v) => {
  ellipsePx(x, 12, 12, 10, 6, PAL.stone0);
  ellipsePx(x, 12, 10, 9, 6, PAL.stone1);
  ellipsePx(x, 10, 8, 6, 4, PAL.stone2);
  ellipsePx(x, 9, 7, 3, 2, PAL.stone3);
  for (let i = 0; i < 10; i++) px(x, 4 + Math.floor(hash2(i, v, 51) * 16), 6 + Math.floor(hash2(i, v, 53) * 9), PAL.stone0);
}, { tall: false });

/* --- łódź --- */
def('boat', 64, 34, (x) => {
  ellipsePx(x, 32, 24, 30, 8, PAL.wood0);
  rect(x, 4, 16, 56, 8, PAL.wood1);
  ellipsePx(x, 32, 16, 28, 6, PAL.wood2);
  ellipsePx(x, 32, 17, 24, 4, PAL.wood0);
  for (let i = 0; i < 8; i++) rect(x, 6 + i * 7, 16, 1, 8, PAL.wood0);
  rect(x, 20, 12, 24, 2, PAL.wood3); // wiosła
  linePx(x, 12, 12, 26, 20, PAL.wood2); linePx(x, 52, 12, 38, 20, PAL.wood2);
  rect(x, 30, 4, 2, 12, PAL.wood1);
}, { tall: false, solid: true });

/* --- dyby (kara) --- */
def('stocks', 34, 26, (x) => {
  rect(x, 2, 16, 30, 6, PAL.wood1);
  rect(x, 2, 6, 30, 6, PAL.wood2);
  for (let i = 0; i < 3; i++) ellipsePx(x, 7 + i * 10, 12, 4, 4, PAL.ink0);
  rect(x, 0, 20, 4, 6, PAL.wood0); rect(x, 30, 20, 4, 6, PAL.wood0);
  px(x, 16, 8, PAL.metal2);
}, { tall: false });

/* --- ławka / stół --- */
def('bench', 30, 20, (x) => {
  rect(x, 2, 8, 26, 4, PAL.wood2); rect(x, 2, 6, 26, 2, PAL.wood3);
  rect(x, 4, 12, 3, 7, PAL.wood1); rect(x, 23, 12, 3, 7, PAL.wood1);
}, { tall: false, grabbable: true });

def('table', 36, 26, (x) => {
  rect(x, 2, 8, 32, 5, PAL.wood2); rect(x, 2, 6, 32, 3, PAL.wood3);
  rect(x, 4, 13, 4, 11, PAL.wood1); rect(x, 28, 13, 4, 11, PAL.wood1);
  rect(x, 4, 20, 28, 2, PAL.wood0);
  // kufel i kości
  rect(x, 12, 2, 4, 5, PAL.metal2); rect(x, 12, 2, 4, 1, PAL.metal3); rect(x, 16, 3, 2, 2, PAL.metal1);
  px(x, 22, 5, PAL.clothWhite2); px(x, 24, 6, PAL.clothWhite2); px(x, 22, 5, PAL.clothWhite1);
}, { tall: false, grabbable: true });

/* --- kuźnia: kowadło, palenisko, miechy --- */
def('anvil', 22, 18, (x) => {
  rect(x, 4, 12, 14, 5, PAL.wood0);
  rect(x, 6, 8, 10, 4, PAL.metal0);
  rect(x, 3, 4, 14, 4, PAL.metal1);
  rect(x, 3, 4, 14, 1, PAL.metal3);
  rect(x, 16, 5, 5, 2, PAL.metal1);
}, { tall: false, grabbable: true });

def('forge', 44, 40, (x) => {
  rect(x, 4, 14, 36, 24, PAL.stone1);
  rect(x, 4, 14, 36, 3, PAL.stone2);
  rect(x, 12, 24, 20, 14, PAL.ink0);
  rect(x, 14, 30, 16, 8, PAL.fire1); rect(x, 16, 26, 12, 6, PAL.fire2); rect(x, 19, 28, 6, 4, PAL.fire3);
  rect(x, 30, 4, 8, 12, PAL.stone1); rect(x, 29, 2, 10, 3, PAL.stone2);
  noiseFill(x, 44, 40, 9, [PAL.stone0], 0.12);
}, { tall: true });

def('grindstone', 26, 24, (x) => {
  rect(x, 4, 14, 18, 8, PAL.wood1);
  ellipsePx(x, 13, 10, 8, 8, PAL.stone1); ellipsePx(x, 13, 10, 6, 6, PAL.stone2);
  ellipsePx(x, 13, 10, 2, 2, PAL.metal1);
  rect(x, 20, 6, 5, 2, PAL.wood2); rect(x, 24, 4, 2, 6, PAL.wood2);
}, { tall: false });

/* --- stos drewna / narzędzia --- */
def('logPile', 34, 22, (x) => {
  for (let r = 0; r < 3; r++) for (let i = 0; i < 4 - r; i++) {
    const lx = 2 + i * 8 + r * 4, ly = 16 - r * 6;
    rect(x, lx, ly, 8, 5, PAL.wood1); ellipsePx(x, lx + 7, ly + 2, 2, 2, PAL.wood3);
    px(x, lx + 7, ly + 2, PAL.wood0);
  }
}, { tall: false });

def('toolRack', 30, 34, (x) => {
  rect(x, 2, 4, 26, 3, PAL.wood1); rect(x, 2, 18, 26, 3, PAL.wood1);
  rect(x, 4, 4, 3, 30, PAL.wood0); rect(x, 23, 4, 3, 30, PAL.wood0);
  // narzędzia
  linePx(x, 8, 7, 8, 20, PAL.wood2); rect(x, 6, 20, 5, 4, PAL.metal2);
  linePx(x, 14, 7, 14, 22, PAL.wood2); rect(x, 12, 6, 4, 3, PAL.metal1);
  linePx(x, 20, 8, 20, 20, PAL.wood2); ellipsePx(x, 20, 22, 3, 3, PAL.metal1);
}, { tall: true });

/* --- skrzynia na łup / stojak na broń (baza gracza) --- */
def('chest', 22, 18, (x) => {
  rect(x, 2, 6, 18, 10, PAL.wood1);
  rect(x, 2, 3, 18, 5, PAL.wood2); ellipsePx(x, 11, 4, 9, 3, PAL.wood3);
  rect(x, 10, 5, 3, 6, PAL.metal1); px(x, 11, 8, PAL.ink0);
  rect(x, 2, 10, 18, 1, PAL.metal0);
}, { grabbable: true });

def('weaponRack', 34, 34, (x) => {
  rect(x, 2, 24, 30, 4, PAL.wood1); rect(x, 4, 8, 3, 18, PAL.wood0); rect(x, 27, 8, 3, 18, PAL.wood0);
  rect(x, 4, 8, 26, 3, PAL.wood2);
  // miecze
  linePx(x, 10, 6, 10, 24, PAL.metal2); rect(x, 8, 22, 5, 2, PAL.wood1); rect(x, 9, 4, 3, 3, PAL.metal3);
  linePx(x, 18, 8, 18, 24, PAL.metal1); rect(x, 16, 22, 5, 2, PAL.wood1);
  // topór
  linePx(x, 25, 8, 25, 24, PAL.wood2); ellipsePx(x, 23, 10, 4, 3, PAL.metal2);
}, { tall: true });

/* --- kapliczka --- */
def('shrine', 24, 40, (x) => {
  rect(x, 8, 20, 8, 18, PAL.stone1);
  rect(x, 4, 8, 16, 14, PAL.stone2);
  rect(x, 6, 10, 12, 10, PAL.ink1);
  rect(x, 10, 4, 4, 12, PAL.wood1); rect(x, 7, 8, 10, 3, PAL.wood1);
  ellipsePx(x, 12, 14, 3, 4, PAL.clothYel1);
  rect(x, 2, 6, 20, 3, PAL.tile1);
  px(x, 12, 24, PAL.fire3);
}, { tall: true });

/* --- ognisko --- */
def('campfire', 26, 20, (x) => {
  for (let i = 0; i < 5; i++) linePx(x, 4 + i * 4, 16, 12 + (i % 3) * 2, 10, PAL.wood0);
  ellipsePx(x, 13, 16, 9, 3, PAL.stone0);
  rect(x, 9, 8, 8, 6, PAL.fire1); rect(x, 10, 5, 6, 5, PAL.fire2); rect(x, 11, 3, 4, 4, PAL.fire3);
}, { tall: false });

/* --- zwierzęta i ptaki (animowane tło) --- */
def('chicken', 14, 14, (x, v) => {
  ellipsePx(x, 7, 8, 5, 4, v % 2 ? PAL.clothWhite1 : PAL.clothYel1);
  ellipsePx(x, 10, 5, 3, 3, v % 2 ? PAL.clothWhite1 : PAL.clothYel1);
  px(x, 12, 4, PAL.clothRed1); px(x, 13, 5, PAL.clothYel2);
  px(x, 11, 5, PAL.ink0);
  linePx(x, 6, 12, 6, 13, PAL.clothYel2); linePx(x, 8, 12, 8, 13, PAL.clothYel2);
}, { tall: false, solid: false });

def('dog', 22, 16, (x, v) => {
  const c = v % 2 ? PAL.wood3 : PAL.clothGrey1;
  ellipsePx(x, 11, 9, 8, 4, c);
  ellipsePx(x, 18, 6, 4, 3, c);
  px(x, 20, 4, shade(c, -0.2)); px(x, 16, 4, shade(c, -0.2));
  px(x, 20, 6, PAL.ink0); px(x, 19, 8, PAL.ink1);
  for (const lx of [6, 9, 13, 16]) rect(x, lx, 12, 2, 4, shade(c, -0.15));
  linePx(x, 3, 8, 1, 5, c);
}, { tall: false, solid: false });

def('cat', 18, 14, (x, v) => {
  const c = v % 2 ? PAL.ink2 : PAL.clothGrey2;
  ellipsePx(x, 9, 8, 6, 3, c); ellipsePx(x, 14, 5, 3, 3, c);
  px(x, 12, 2, c); px(x, 16, 2, c); px(x, 15, 5, PAL.clothYel1);
  for (const lx of [5, 7, 11, 13]) rect(x, lx, 10, 1, 3, shade(c, -0.1));
  linePx(x, 3, 7, 1, 3, c);
}, { tall: false, solid: false });

def('pig', 24, 18, (x) => {
  ellipsePx(x, 12, 10, 9, 5, '#c98f8a');
  ellipsePx(x, 19, 9, 4, 3, '#d8a19b');
  px(x, 21, 9, '#a86f6a'); px(x, 21, 10, '#a86f6a');
  px(x, 18, 7, PAL.ink1);
  for (const lx of [7, 10, 14, 17]) rect(x, lx, 14, 2, 3, '#b07d78');
  linePx(x, 3, 8, 2, 5, '#c98f8a');
}, { tall: false, solid: false });

def('horse', 44, 44, (x, v) => {
  const c = v % 2 ? PAL.wood1 : PAL.clothGrey1;
  rect(x, 10, 18, 24, 12, c);                       // tułów
  ellipsePx(x, 12, 22, 6, 6, c);
  rect(x, 30, 6, 6, 16, c);                           // szyja
  ellipsePx(x, 35, 6, 6, 4, c);                       // głowa
  px(x, 37, 5, PAL.ink0); px(x, 39, 7, PAL.ink1);
  for (let i = 0; i < 5; i++) px(x, 30 + i, 4 + i, PAL.ink2); // grzywa
  rect(x, 28, 2, 8, 4, PAL.ink2);
  for (const lx of [12, 17, 25, 30]) { rect(x, lx, 30, 3, 12, shade(c, -0.12)); rect(x, lx, 41, 3, 2, PAL.ink1); }
  linePx(x, 8, 20, 4, 30, shade(c, -0.2));            // ogon
  rect(x, 14, 16, 16, 3, PAL.clothRed1);              // derka
}, { tall: true });

def('crow', 12, 10, (x) => {
  ellipsePx(x, 6, 6, 4, 3, PAL.ink1);
  ellipsePx(x, 9, 4, 2, 2, PAL.ink1); px(x, 11, 4, PAL.clothYel1);
  linePx(x, 2, 5, 0, 3, PAL.ink2); linePx(x, 4, 4, 3, 1, PAL.ink2);
}, { tall: false, solid: false, shadow: false });

/* --- stosy towarów portowych --- */
def('netPile', 28, 18, (x) => {
  ellipsePx(x, 14, 12, 12, 5, PAL.clothGrey1);
  for (let i = 0; i < 8; i++) for (let j = 0; j < 4; j++) px(x, 4 + i * 3, 8 + j * 3, PAL.clothGrey2);
  rect(x, 8, 6, 12, 3, PAL.wood1);
}, { tall: false });

def('anchor', 18, 22, (x) => {
  rect(x, 8, 2, 2, 16, PAL.metal0);
  rect(x, 3, 5, 12, 2, PAL.metal0);
  ellipsePx(x, 9, 17, 7, 5, 'rgba(0,0,0,0)');
  linePx(x, 9, 18, 3, 14, PAL.metal1); linePx(x, 9, 18, 15, 14, PAL.metal1);
  px(x, 3, 13, PAL.metal2); px(x, 15, 13, PAL.metal2);
  ellipsePx(x, 9, 3, 3, 3, PAL.metal1);
}, { tall: false });

def('saltPile', 30, 20, (x) => {
  ellipsePx(x, 15, 14, 13, 6, PAL.clothWhite1);
  ellipsePx(x, 15, 11, 9, 5, PAL.clothWhite2);
  ellipsePx(x, 14, 8, 5, 3, PAL.parch3);
  noiseFill(x, 30, 20, 3, [PAL.stone3], 0.1);
}, { tall: false });

def('fishCrate', 24, 16, (x) => {
  rect(x, 2, 4, 20, 10, PAL.wood1); rect(x, 2, 4, 20, 2, PAL.wood2);
  for (let i = 0; i < 3; i++) { ellipsePx(x, 7 + i * 5, 8, 3, 1.6, PAL.metal3); px(x, 5 + i * 5, 8, PAL.ink1); }
}, { grabbable: true, tall: false });

def('clothesline', 44, 30, (x) => {
  rect(x, 2, 4, 3, 24, PAL.wood1); rect(x, 39, 4, 3, 24, PAL.wood1);
  linePx(x, 3, 6, 41, 8, PAL.clothGrey0);
  const items = [PAL.clothWhite1, PAL.clothRed1, PAL.clothBlue1, PAL.clothYel1];
  items.forEach((c, i) => {
    const sx = 7 + i * 9, sy = 7 + (i % 2);
    rect(x, sx, sy, 6, 10, c); rect(x, sx, sy, 6, 1, shade(c, 0.15));
    px(x, sx + 2, sy - 1, PAL.wood2);
  });
}, { tall: true });

def('gallows', 48, 56, (x) => {
  rect(x, 6, 44, 36, 6, PAL.stone1);
  rect(x, 10, 8, 5, 38, PAL.wood0); rect(x, 34, 8, 5, 38, PAL.wood0);
  rect(x, 8, 6, 33, 5, PAL.wood1);
  linePx(x, 18, 11, 18, 20, PAL.clothGrey0); linePx(x, 30, 11, 30, 18, PAL.clothGrey0);
  ellipsePx(x, 18, 23, 4, 4, PAL.clothGrey1); rect(x, 15, 26, 6, 10, PAL.clothGrey1);
  rect(x, 28, 21, 5, 5, PAL.clothWhite0); rect(x, 27, 26, 7, 9, PAL.clothWhite0);
}, { tall: true });

def('tent', 54, 44, (x, v) => {
  const c = v % 2 ? PAL.clothWhite0 : PAL.clothYel0;
  for (let i = 0; i < 12; i++) rect(x, 4 + i * 2, 40 - i * 3, 46 - i * 4, 3, i % 2 ? c : shade(c, -0.08));
  rect(x, 24, 24, 8, 18, PAL.ink1);
  linePx(x, 27, 2, 27, 8, PAL.wood1);
  rect(x, 24, 2, 6, 4, PAL.clothRed1);
}, { tall: true });

def('wellBucket', 12, 12, (x) => {
  rect(x, 3, 3, 7, 8, PAL.wood1); rect(x, 3, 3, 7, 1, PAL.wood3); rect(x, 3, 5, 7, 1, PAL.metal1);
  linePx(x, 3, 3, 6, 0, PAL.metal2); linePx(x, 10, 3, 6, 0, PAL.metal2);
}, { tall: false, grabbable: true });

def('bed', 40, 26, (x) => {
  rect(x, 2, 10, 36, 12, PAL.wood1);
  rect(x, 2, 4, 4, 18, PAL.wood0); rect(x, 34, 4, 4, 18, PAL.wood0);
  rect(x, 5, 8, 30, 8, PAL.clothWhite1);
  rect(x, 5, 8, 12, 7, PAL.clothRed1);
  ellipsePx(x, 10, 9, 5, 3, PAL.clothWhite2);
  rect(x, 5, 15, 30, 2, PAL.clothBlue1);
}, { tall: false });

def('cauldron', 22, 20, (x) => {
  ellipsePx(x, 11, 12, 8, 6, PAL.metal0);
  ellipsePx(x, 11, 9, 8, 4, PAL.metal1);
  ellipsePx(x, 11, 9, 6, 3, PAL.leaf1);
  rect(x, 3, 6, 2, 4, PAL.metal0); rect(x, 17, 6, 2, 4, PAL.metal0);
  linePx(x, 4, 5, 18, 5, PAL.metal2);
}, { tall: false });

def('barrelRain', 20, 26, (x) => {
  rect(x, 4, 6, 12, 16, PAL.wood1); ellipsePx(x, 10, 6, 6, 2.5, PAL.water1);
  rect(x, 3, 10, 14, 2, PAL.metal1); rect(x, 3, 17, 14, 2, PAL.metal1);
}, { tall: false, grabbable: true });

def('quarryCart', 40, 28, (x) => {
  rect(x, 4, 8, 32, 12, PAL.metal0); rect(x, 4, 8, 32, 2, PAL.metal1);
  for (let i = 0; i < 5; i++) ellipsePx(x, 9 + i * 5, 8, 3, 2, PAL.stone2);
  for (const cx of [10, 30]) { ellipsePx(x, cx, 22, 5, 5, PAL.metal0); ellipsePx(x, cx, 22, 4, 4, PAL.metal1); ellipsePx(x, cx, 22, 1, 1, PAL.ink0); }
}, { tall: false, grabbable: true });

def('statue', 26, 48, (x) => {
  rect(x, 4, 38, 18, 8, PAL.stone1); rect(x, 6, 34, 14, 5, PAL.stone2);
  rect(x, 10, 14, 7, 22, PAL.stone3);
  ellipsePx(x, 13, 10, 5, 6, PAL.stone3);
  rect(x, 6, 18, 4, 12, PAL.stone2); rect(x, 17, 18, 4, 10, PAL.stone2);
  px(x, 11, 10, PAL.stone1); px(x, 15, 10, PAL.stone1);
  for (let i = 0; i < 8; i++) px(x, 6 + Math.floor(hash2(i, 2, 61) * 14), 12 + Math.floor(hash2(i, 3, 63) * 24), PAL.leaf1);
}, { tall: true });

def('signInn', 26, 30, (x) => {
  rect(x, 12, 2, 3, 26, PAL.wood0);
  rect(x, 0, 6, 14, 12, PAL.wood2); rect(x, 0, 6, 14, 2, PAL.wood3);
  ellipsePx(x, 7, 12, 4, 4, PAL.clothYel1); rect(x, 5, 10, 4, 5, PAL.metal2);
  rect(x, 2, 4, 10, 2, PAL.tile1);
}, { tall: true });

def('crateCustoms', 22, 20, (x) => {
  rect(x, 2, 4, 18, 14, PAL.wood1); rect(x, 2, 4, 18, 2, PAL.wood2);
  rect(x, 6, 8, 10, 6, PAL.parch2);
  for (let i = 0; i < 3; i++) rect(x, 7, 9 + i * 2, 8, 1, PAL.parch4);
  px(x, 16, 6, PAL.clothRed1);
}, { grabbable: true, tall: false });

def('smugglingCrate', 22, 20, (x) => {
  rect(x, 2, 4, 18, 14, PAL.wood0); rect(x, 2, 4, 18, 2, PAL.wood1);
  rect(x, 4, 8, 14, 1, PAL.clothWhite0); rect(x, 4, 12, 14, 1, PAL.clothWhite0);
  for (let i = 0; i < 4; i++) px(x, 5 + i * 4, 10, PAL.clothWhite1);
  px(x, 3, 5, PAL.metal1); px(x, 18, 17, PAL.metal1);
}, { grabbable: true, tall: false });

def('hayBale', 26, 20, (x) => {
  rect(x, 2, 4, 22, 14, PAL.thatch1);
  rect(x, 2, 4, 22, 2, PAL.thatch2); rect(x, 2, 16, 22, 2, PAL.thatch0);
  for (let i = 0; i < 8; i++) linePx(x, 3 + i * 3, 6, 4 + i * 3, 16, PAL.thatch0);
}, { tall: false, grabbable: true });

def('waterTrough', 34, 16, (x) => {
  rect(x, 2, 4, 30, 10, PAL.wood1); rect(x, 2, 4, 30, 2, PAL.wood2);
  rect(x, 4, 6, 26, 6, PAL.water1); rect(x, 4, 6, 26, 1, PAL.water3);
}, { tall: false });

/* ============================================================================
   WNĘTRZA — meble i stanowiska pracy
   ========================================================================== */

def('barCounter', 76, 30, (x) => {
  rect(x, 2, 10, 72, 16, PAL.wood1);
  rect(x, 2, 8, 72, 4, PAL.wood3);
  rect(x, 2, 22, 72, 4, PAL.wood0);
  for (let i = 0; i < 9; i++) rect(x, 4 + i * 8, 12, 1, 12, shade(PAL.wood1, -0.15));
  rect(x, 2, 8, 72, 1, PAL.wood4);
  // kufle i butelki na blacie
  for (let i = 0; i < 4; i++) { rect(x, 8 + i * 16, 3, 4, 6, PAL.metal2); rect(x, 8 + i * 16, 3, 4, 1, PAL.metal3); }
  rect(x, 30, 2, 3, 7, PAL.leaf0); rect(x, 36, 2, 3, 7, PAL.wood2); rect(x, 42, 3, 3, 6, PAL.clothRed0);
}, { tall: false, solid: true });

def('keg', 22, 24, (x) => {
  rect(x, 4, 4, 14, 18, PAL.wood1);
  ellipsePx(x, 11, 5, 7, 3, PAL.wood2);
  rect(x, 3, 8, 16, 2, PAL.metal1); rect(x, 3, 16, 16, 2, PAL.metal1);
  px(x, 11, 12, PAL.metal2); rect(x, 9, 11, 4, 3, PAL.metal0);
}, { tall: false, grabbable: true });

def('shelf', 40, 30, (x, v) => {
  rect(x, 2, 2, 36, 26, PAL.wood1);
  rect(x, 4, 4, 32, 2, PAL.wood2); rect(x, 4, 13, 32, 2, PAL.wood2); rect(x, 4, 22, 32, 2, PAL.wood2);
  const goods = [PAL.clothRed1, PAL.leaf1, PAL.clothYel1, PAL.metal2, PAL.parch2, PAL.water2];
  for (let s = 0; s < 3; s++) for (let i = 0; i < 5; i++) {
    const g = goods[(i + s * 2 + v) % goods.length];
    rect(x, 6 + i * 6, 6 + s * 9, 4, 5, g);
    rect(x, 6 + i * 6, 6 + s * 9, 4, 1, shade(g, 0.2));
  }
}, { tall: true });

def('bookshelf', 40, 34, (x, v) => {
  rect(x, 2, 2, 36, 30, PAL.wood0);
  for (let s = 0; s < 3; s++) {
    rect(x, 4, 4 + s * 10, 32, 2, PAL.wood1);
    for (let i = 0; i < 7; i++) {
      const c = [PAL.clothRed0, PAL.clothBlue0, PAL.clothGreen0, PAL.wood2, PAL.parch1, PAL.ink2][(i + s + v) % 6];
      const bh = 6 + Math.floor(hash2(i, s, v + 3) * 2);
      rect(x, 5 + i * 4.4, 6 + s * 10 + (7 - bh), 3.6, bh, c);
      rect(x, 5 + i * 4.4, 6 + s * 10 + (7 - bh), 3.6, 1, shade(c, 0.25));
    }
  }
}, { tall: true });

def('desk', 44, 28, (x) => {
  rect(x, 2, 8, 40, 5, PAL.wood2); rect(x, 2, 8, 40, 2, PAL.wood3);
  rect(x, 4, 13, 4, 12, PAL.wood1); rect(x, 36, 13, 4, 12, PAL.wood1);
  rect(x, 6, 16, 32, 6, PAL.wood0);
  rect(x, 8, 4, 12, 6, PAL.parch2); rect(x, 8, 4, 12, 1, PAL.parch3);
  for (let i = 0; i < 3; i++) rect(x, 9, 6 + i * 1.6, 10, 1, PAL.parch4);
  rect(x, 26, 3, 2, 7, PAL.clothWhite1); px(x, 27, 2, PAL.ink1);
  rect(x, 32, 5, 6, 4, PAL.ink1); rect(x, 32, 5, 6, 1, PAL.metal2);
}, { tall: false });

def('stool', 16, 16, (x) => {
  ellipsePx(x, 8, 6, 7, 4, PAL.wood2); ellipsePx(x, 8, 5, 6, 3, PAL.wood3);
  rect(x, 3, 8, 2, 7, PAL.wood1); rect(x, 11, 8, 2, 7, PAL.wood1); rect(x, 7, 8, 2, 7, PAL.wood0);
}, { tall: false, grabbable: true });

def('tableRound', 34, 24, (x) => {
  ellipsePx(x, 17, 8, 15, 7, PAL.wood1);
  ellipsePx(x, 17, 7, 14, 6, PAL.wood2);
  ellipsePx(x, 17, 6, 11, 4, PAL.wood3);
  rect(x, 15, 12, 4, 9, PAL.wood0);
  ellipsePx(x, 17, 21, 7, 3, PAL.wood1);
  rect(x, 10, 3, 5, 4, PAL.metal2); rect(x, 10, 3, 5, 1, PAL.clothWhite1);
  px(x, 20, 4, PAL.clothWhite2); px(x, 22, 5, PAL.clothWhite2); px(x, 21, 4, PAL.ink0); px(x, 23, 5, PAL.ink0);
}, { tall: false, grabbable: true });

def('fireplace', 44, 40, (x) => {
  rect(x, 2, 6, 40, 32, PAL.stone1);
  rect(x, 2, 6, 40, 3, PAL.stone2); rect(x, 6, 4, 32, 4, PAL.stone2);
  rect(x, 10, 18, 24, 20, PAL.ink0);
  rect(x, 12, 28, 20, 10, PAL.fire1); rect(x, 15, 22, 14, 10, PAL.fire2); rect(x, 18, 18, 8, 8, PAL.fire3);
  rect(x, 20, 14, 4, 6, PAL.fire4);
  rect(x, 8, 36, 28, 2, PAL.stone0);
  for (let i = 0; i < 6; i++) rect(x, 12 + i * 4, 34, 3, 3, PAL.wood0);
  noiseFill(x, 44, 40, 17, [PAL.stone0], 0.1);
}, { tall: true });

def('quenchBarrel', 20, 22, (x) => {
  rect(x, 3, 6, 14, 14, PAL.wood1); ellipsePx(x, 10, 6, 7, 3, PAL.water1);
  rect(x, 2, 9, 16, 2, PAL.metal1); rect(x, 2, 15, 16, 2, PAL.metal1);
  px(x, 7, 5, PAL.water3); px(x, 12, 5, PAL.water3);
}, { tall: false });

def('rack', 40, 34, (x) => {
  rect(x, 2, 4, 36, 3, PAL.wood1); rect(x, 2, 18, 36, 3, PAL.wood1);
  rect(x, 3, 4, 3, 28, PAL.wood0); rect(x, 34, 4, 3, 28, PAL.wood0);
  const w = [PAL.metal2, PAL.metal1, PAL.metal3];
  for (let i = 0; i < 5; i++) {
    linePx(x, 8 + i * 6, 7, 8 + i * 6, 17, w[i % 3]);
    rect(x, 6 + i * 6, 16, 5, 2, PAL.wood1);
    rect(x, 7 + i * 6, 5, 3, 3, w[(i + 1) % 3]);
  }
  for (let i = 0; i < 3; i++) { ellipsePx(x, 12 + i * 9, 25, 4, 4, PAL.metal1); rect(x, 10 + i * 9, 28, 5, 3, PAL.wood1); }
}, { tall: true });

def('hideRack', 44, 34, (x) => {
  rect(x, 2, 2, 40, 3, PAL.wood1); rect(x, 2, 30, 40, 3, PAL.wood1);
  for (let i = 0; i < 4; i++) {
    const c = [PAL.wood2, PAL.wood3, PAL.mud2, PAL.dirt3][i];
    rect(x, 5 + i * 10, 5, 8, 24, c);
    rect(x, 5 + i * 10, 5, 8, 2, shade(c, 0.15));
    for (let j = 0; j < 3; j++) px(x, 6 + i * 10 + j * 2, 10 + j * 6, shade(c, -0.25));
  }
}, { tall: true });

def('altar', 48, 36, (x) => {
  rect(x, 6, 16, 36, 18, PAL.stone2);
  rect(x, 4, 14, 40, 4, PAL.stone3); rect(x, 4, 30, 40, 4, PAL.stone1);
  rect(x, 14, 20, 20, 10, PAL.clothWhite1); rect(x, 14, 20, 20, 2, PAL.clothYel1);
  rect(x, 22, 2, 4, 14, PAL.clothYel1); rect(x, 17, 6, 14, 4, PAL.clothYel1);
  rect(x, 22, 2, 4, 2, PAL.clothYel2); rect(x, 17, 6, 2, 4, PAL.clothYel2);
  rect(x, 8, 8, 3, 8, PAL.metal2); rect(x, 8, 6, 3, 3, PAL.fire3);
  rect(x, 37, 8, 3, 8, PAL.metal2); rect(x, 37, 6, 3, 3, PAL.fire3);
}, { tall: true });

def('pew', 36, 22, (x) => {
  rect(x, 2, 8, 32, 4, PAL.wood2); rect(x, 2, 4, 32, 5, PAL.wood1);
  rect(x, 2, 12, 3, 8, PAL.wood0); rect(x, 31, 12, 3, 8, PAL.wood0);
  rect(x, 2, 4, 32, 1, PAL.wood3);
}, { tall: false });

def('tub', 30, 22, (x) => {
  ellipsePx(x, 15, 12, 13, 8, PAL.wood1);
  ellipsePx(x, 15, 11, 11, 6, PAL.water2);
  ellipsePx(x, 15, 10, 9, 5, PAL.water3);
  rect(x, 2, 8, 26, 2, PAL.metal1);
  for (let i = 0; i < 5; i++) px(x, 8 + i * 4, 8, PAL.water4);
}, { tall: false });

/* ============================================================================
   MURY MIEJSKIE — kafle łączone bezszwowo (rysowane bez obwódki)
   ========================================================================== */

def('wallH', 32, 42, (x, v) => {
  // korpus
  rect(x, 0, 14, 32, 28, PAL.stone1);
  for (let r = 0; r < 5; r++) for (let i = 0; i < 4; i++) {
    const bx = i * 8 + ((r % 2) ? -4 : 0), by = 16 + r * 5;
    const tone = hash2(i + v * 4, r, 991) > 0.6 ? PAL.stone3 : hash2(i, r + v, 993) > 0.5 ? PAL.stone2 : PAL.stone1;
    rect(x, bx + 1, by, 7, 4, tone);
    rect(x, bx + 1, by, 7, 1, shade(tone, 0.14));
    rect(x, bx + 1, by + 4, 7, 1, PAL.stone0);
  }
  // gzyms i blanki
  rect(x, 0, 11, 32, 3, PAL.stone3);
  for (let i = 0; i < 4; i++) { rect(x, i * 8, 5, 6, 7, PAL.stone2); rect(x, i * 8, 5, 6, 1, PAL.stone4); rect(x, i * 8 + 6, 5, 2, 7, PAL.stone0); }
  rect(x, 0, 39, 32, 3, PAL.stone0);
  // mech i brud
  for (let i = 0; i < 6; i++) { const mx = Math.floor(hash2(i, v, 1201) * 30), my = 30 + Math.floor(hash2(i, v, 1203) * 8); px(x, mx, my, PAL.leaf0); }
}, { tall: true, solid: true, shadow: true });

def('wallV', 26, 42, (x, v) => {
  rect(x, 0, 14, 26, 28, PAL.stone1);
  for (let r = 0; r < 5; r++) for (let i = 0; i < 3; i++) {
    const bx = i * 9 + ((r % 2) ? -4 : 0), by = 16 + r * 5;
    const tone = hash2(i, r + v, 1301) > 0.6 ? PAL.stone3 : PAL.stone2;
    rect(x, bx + 1, by, 8, 4, tone); rect(x, bx + 1, by + 4, 8, 1, PAL.stone0);
  }
  rect(x, 0, 11, 26, 3, PAL.stone3);
  for (let i = 0; i < 3; i++) rect(x, i * 9, 5, 7, 7, PAL.stone2);
  rect(x, 20, 5, 6, 37, shade(PAL.stone1, -0.22));
  rect(x, 0, 39, 26, 3, PAL.stone0);
}, { tall: true, solid: true, shadow: true });

def('wallTower', 40, 62, (x) => {
  rect(x, 4, 18, 32, 44, PAL.stone1);
  for (let r = 0; r < 8; r++) for (let i = 0; i < 4; i++) {
    const bx = 5 + i * 8 + ((r % 2) ? -4 : 0), by = 20 + r * 5;
    rect(x, bx, by, 7, 4, hash2(i, r, 1401) > .6 ? PAL.stone3 : PAL.stone2);
    rect(x, bx, by + 4, 7, 1, PAL.stone0);
  }
  rect(x, 2, 14, 36, 4, PAL.stone3);
  for (let i = 0; i < 5; i++) { rect(x, 3 + i * 7, 8, 5, 7, PAL.stone2); rect(x, 3 + i * 7, 8, 5, 1, PAL.stone4); }
  rect(x, 16, 30, 8, 10, PAL.ink0); rect(x, 17, 31, 6, 8, PAL.ink1);
  rect(x, 16, 48, 8, 12, PAL.ink0);
  rect(x, 2, 58, 36, 4, PAL.stone0);
  for (let i = 0; i < 8; i++) px(x, 6 + Math.floor(hash2(i, 1, 1501) * 28), 30 + Math.floor(hash2(i, 2, 1503) * 26), PAL.leaf0);
}, { tall: true, solid: true });

def('cityGate', 96, 74, (x, v) => {
  // wieże boczne
  for (const tx of [0, 72]) {
    rect(x, tx, 22, 24, 52, PAL.stone1);
    for (let r = 0; r < 9; r++) for (let i = 0; i < 3; i++) {
      rect(x, tx + 1 + i * 8 + ((r % 2) ? -3 : 0), 24 + r * 5, 7, 4, hash2(i, r + tx, 1601) > .6 ? PAL.stone3 : PAL.stone2);
      rect(x, tx + 1 + i * 8, 28 + r * 5, 7, 1, PAL.stone0);
    }
    rect(x, tx - 2, 18, 28, 4, PAL.stone3);
    for (let i = 0; i < 4; i++) rect(x, tx - 1 + i * 7, 12, 5, 7, PAL.stone2);
    rect(x, tx + 8, 34, 7, 9, PAL.ink0);
    rect(x, tx + 8, 52, 7, 9, PAL.ink0);
  }
  // mur między wieżami z łukiem bramy
  rect(x, 24, 30, 48, 44, PAL.stone1);
  for (let r = 0; r < 8; r++) for (let i = 0; i < 6; i++) {
    rect(x, 25 + i * 8 + ((r % 2) ? -4 : 0), 32 + r * 5, 7, 4, hash2(i, r, 1701) > .55 ? PAL.stone3 : PAL.stone2);
    rect(x, 25 + i * 8, 36 + r * 5, 7, 1, PAL.stone0);
  }
  rect(x, 22, 26, 52, 4, PAL.stone3);
  for (let i = 0; i < 7; i++) rect(x, 23 + i * 7, 20, 5, 7, PAL.stone2);
  // łuk
  rect(x, 36, 44, 24, 30, PAL.ink0);
  ellipsePx(x, 48, 46, 12, 10, PAL.ink0);
  for (let a = 0; a <= 12; a++) {
    const ang = Math.PI * (a / 12);
    px(x, 48 + Math.cos(ang) * 13, 46 - Math.sin(ang) * 11, PAL.stone3);
    px(x, 48 + Math.cos(ang) * 14, 46 - Math.sin(ang) * 12, PAL.stone2);
  }
  // wrota (otwarte/zamknięte — wariant)
  if (v % 2 === 0) {
    rect(x, 38, 48, 20, 26, PAL.wood0);
    for (let i = 0; i < 4; i++) rect(x, 39 + i * 5, 48, 4, 26, PAL.wood1);
    rect(x, 38, 54, 20, 2, PAL.metal0); rect(x, 38, 64, 20, 2, PAL.metal0);
    px(x, 47, 60, PAL.metal2); px(x, 49, 60, PAL.metal2);
  } else {
    rect(x, 36, 44, 4, 30, PAL.wood0); rect(x, 56, 44, 4, 30, PAL.wood0);
  }
  // herb / chorągiew
  rect(x, 44, 12, 8, 12, v % 3 === 0 ? PAL.clothRed1 : PAL.clothBlue1);
  rect(x, 44, 12, 8, 2, PAL.clothYel1);
  px(x, 47, 17, PAL.clothYel2); px(x, 48, 18, PAL.clothYel2);
}, { tall: true, solid: false });

def('palisade', 32, 30, (x) => {
  for (let i = 0; i < 5; i++) {
    const px0 = 1 + i * 6, h = 20 + Math.floor(hash2(i, 1, 1801) * 6);
    rect(x, px0, 28 - h, 5, h, PAL.wood1);
    rect(x, px0, 28 - h, 5, 1, PAL.wood3);
    rect(x, px0, 28 - h, 1, h, PAL.wood2);
    rect(x, px0 + 4, 28 - h, 1, h, PAL.wood0);
  }
  rect(x, 0, 16, 32, 2, PAL.wood0); rect(x, 0, 24, 32, 2, PAL.wood0);
}, { tall: true, solid: true });

def('trainingDummy', 22, 34, (x) => {
  rect(x, 9, 12, 4, 20, PAL.wood1);
  rect(x, 3, 16, 16, 3, PAL.wood2);
  ellipsePx(x, 11, 8, 5, 5, PAL.thatch1); ellipsePx(x, 11, 7, 4, 4, PAL.thatch2);
  rect(x, 6, 12, 10, 8, PAL.clothGrey1);
  px(x, 9, 6, PAL.ink0); px(x, 13, 6, PAL.ink0);
  rect(x, 6, 30, 10, 2, PAL.wood0);
}, { tall: true });

def('signScribe', 22, 26, (x) => {
  rect(x, 10, 12, 3, 12, PAL.wood0);
  rect(x, 1, 4, 16, 10, PAL.clothBlue1); rect(x, 1, 4, 16, 2, PAL.clothBlue2);
  rect(x, 4, 7, 10, 5, PAL.parch2); linePx(x, 5, 8, 12, 11, PAL.parch4);
}, { tall: true });

def('signSmith', 22, 26, (x) => {
  rect(x, 10, 12, 3, 12, PAL.wood0);
  rect(x, 1, 4, 16, 10, PAL.clothGrey0); rect(x, 1, 4, 16, 2, PAL.clothGrey1);
  ellipsePx(x, 8, 9, 4, 3, PAL.metal2); rect(x, 6, 6, 4, 2, PAL.metal3);
}, { tall: true });

def('marketUmbrella', 40, 40, (x, v) => {
  const c = [PAL.clothRed1, PAL.clothYel1, PAL.clothBlue1, PAL.clothGreen1][v % 4];
  rect(x, 19, 14, 3, 26, PAL.wood1);
  for (let i = 0; i < 8; i++) {
    const t = i / 7;
    const w = 4 + Math.sin(t * Math.PI) * 16;
    rect(x, 20 - w / 2, 6 + i, w, 1, i % 2 ? c : shade(c, 0.12));
  }
  rect(x, 4, 13, 32, 2, shade(c, -0.2));
  px(x, 20, 4, PAL.clothYel2);
}, { tall: true });

def('pileOfSalt', 30, 22, (x) => {
  ellipsePx(x, 15, 16, 13, 6, PAL.clothWhite0);
  ellipsePx(x, 15, 12, 10, 6, PAL.clothWhite1);
  ellipsePx(x, 15, 8, 6, 4, PAL.clothWhite2);
  noiseFill(x, 30, 22, 7, [PAL.stone3], 0.12);
}, { tall: false });

def('corpse', 30, 14, (x, v) => {
  rect(x, 4, 6, 20, 7, v % 2 ? PAL.clothGrey0 : PAL.clothRed0);
  ellipsePx(x, 6, 9, 4, 4, PAL.skin1);
  rect(x, 22, 8, 6, 4, PAL.wood1);
  ellipsePx(x, 14, 12, 10, 2, PAL.blood0);
}, { tall: false, solid: false, grabbable: true });

/** Zwraca gotowy (obramowany) sprite propsa; cache'owany per wariant. */
const propCache = new Map<string, HTMLCanvasElement>();
export function getProp(name: string, variant = 0, outline = true): HTMLCanvasElement | null {
  const d = PROPS[name]; if (!d) return null;
  const key = `${name}|${variant}|${outline}`;
  const hit = propCache.get(key); if (hit) return hit;
  const [c, x] = mk(d.w + 4, d.h + 6);
  x.save(); x.translate(2, 2); d.draw(x, variant); x.restore();
  const out = outline ? outlineCanvas(c, PAL.ink0) : c;
  propCache.set(key, out);
  return out;
}
/** Przesunięcie rysowania sprite'a względem kotwicy (środek podstawy) — uwzględnia margines obwódki. */
export function propOffset(name: string): { dx: number; dy: number } {
  const d = PROPS[name];
  if (!d) return { dx: 0, dy: 0 };
  return { dx: -(d.ox + 3), dy: -(d.oy + 3) };
}
export function propDef(name: string) { return PROPS[name]; }
export function propNames() { return Object.keys(PROPS); }
