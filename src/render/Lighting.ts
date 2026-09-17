import { PAL, rgba } from './Palette';
import type { Scene, SceneLight } from '../world/Scene';

/* ============================================================================
   OŚWIETLENIE 2D
   Bufor światła w niskiej rozdzielczości (1/4), nakładany mnożeniem.
   Źródła: słońce/pora dnia, latarnie, okna, pochodnia Johna, ogień w palenisku,
   błyskawice. Ciemność ma konsekwencje — w nocy widać mniej i słyszą cię lepiej.
   ========================================================================== */

const SCALE = 0.25;      // bufor światła: 160×90 dla widoku 640×360

export class Lighting {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  w = 160; h = 90;
  flicker = 0;
  lightning = 0;
  private lampCache = new Map<string, HTMLCanvasElement>();

  constructor(viewW = 640, viewH = 360) {
    this.w = Math.ceil(viewW * SCALE); this.h = Math.ceil(viewH * SCALE);
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.w; this.canvas.height = this.h;
    this.ctx = this.canvas.getContext('2d')!;
  }

  /** ambient: [r,g,b] 0..255 i poziom 0..1 (0 = czarna noc). */
  render(opts: {
    camX: number; camY: number; viewW: number; viewH: number;
    ambient: [number, number, number]; ambientLevel: number;
    darkness: number; scene: Scene; playerX: number; playerY: number;
    torchLit: boolean; torchFuel: number; time: number;
  }) {
    const c = this.ctx;
    const s = SCALE;
    c.globalCompositeOperation = 'source-over';
    const [ar, ag, ab] = opts.ambient;
    const lvl = Math.max(0.06, Math.min(1, opts.ambientLevel));
    c.fillStyle = `rgb(${Math.round(ar * lvl)},${Math.round(ag * lvl)},${Math.round(ab * lvl)})`;
    c.fillRect(0, 0, this.w, this.h);

    // światła sceny (latarnie, okna, ognie)
    c.globalCompositeOperation = 'lighter';
    this.flicker = 0.9 + Math.sin(opts.time * 7.3) * 0.04 + Math.sin(opts.time * 17.1) * 0.03;
    for (const L of opts.scene.lights) {
      if (L.onlyDark && opts.darkness < 0.25) continue;
      const sx = (L.x - opts.camX) * s, sy = (L.y - opts.camY) * s;
      const fl = L.flicker > 0 ? (1 - L.flicker * 0.5 + L.flicker * 0.5 * this.flicker) : 1;
      const r = L.r * s * fl;
      if (sx < -r || sy < -r || sx > this.w + r || sy > this.h + r) continue;
      this.stamp(sx, sy, r, L.color, Math.min(1.3, fl));
    }
    // pochodnia gracza
    if (opts.torchLit) {
      const sx = (opts.playerX - opts.camX) * s, sy = (opts.playerY - opts.camY - 14) * s;
      const fuel = Math.max(0.35, Math.min(1, opts.torchFuel / 60));
      this.stamp(sx, sy, 78 * s * fuel * this.flicker, '#ffab4a', 1.25 * fuel);
      this.stamp(sx, sy, 34 * s * fuel, '#ffe0a0', 0.8 * fuel);
    }
    // błyskawica
    if (this.lightning > 0) {
      c.fillStyle = `rgba(226,236,255,${this.lightning * 0.55})`;
      c.fillRect(0, 0, this.w, this.h);
      this.lightning = Math.max(0, this.lightning - 0.08);
    }
    c.globalCompositeOperation = 'source-over';
  }

  private stamp(x: number, y: number, r: number, color: string, intensity: number) {
    const key = color + '|' + Math.round(r * 2);
    let img = this.lampCache.get(key);
    if (!img) {
      const size = Math.max(4, Math.ceil(r * 2));
      img = document.createElement('canvas');
      img.width = size; img.height = size;
      const g = img.getContext('2d')!;
      const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      grad.addColorStop(0, rgba(color, 1));
      grad.addColorStop(0.35, rgba(color, 0.55));
      grad.addColorStop(0.7, rgba(color, 0.18));
      grad.addColorStop(1, rgba(color, 0));
      g.fillStyle = grad;
      g.fillRect(0, 0, size, size);
      this.lampCache.set(key, img);
    }
    const size = Math.max(4, Math.ceil(r * 2));
    this.ctx.save();
    this.ctx.globalAlpha = Math.min(1, intensity);
    this.ctx.drawImage(img, Math.round(x - size / 2), Math.round(y - size / 2), size, size);
    this.ctx.restore();
  }

  strike(power = 1) { this.lightning = power; }
}

export type { SceneLight };
export { PAL };
