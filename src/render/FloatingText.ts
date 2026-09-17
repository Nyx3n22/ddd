import { rng } from '../core/RNG';
import { PAL } from './Palette';

/* ============================================================================
   LICZBY PŁYWAJĄCE
   Obrażenia, parowania, nazwy zdobytych przedmiotów — wszystko w pikselowej
   czcionce systemowej, krótko i czytelnie. Bez nich walka jest nieprzejrzysta.
   ========================================================================== */

export interface FloatText {
  x: number; y: number; vy: number; life: number; maxLife: number;
  text: string; color: string; size: number; screen?: boolean; outline?: string;
}

export class FloatingText {
  list: FloatText[] = [];
  private max = 40;

  damage(x: number, y: number, amount: number, opts: { crit?: boolean; self?: boolean; blocked?: boolean; parried?: boolean } = {}) {
    const color = opts.parried ? PAL.clothBlue1 : opts.blocked ? '#c8c2b4' : opts.crit ? '#ffb45a' : opts.self ? '#e05a4a' : '#f0e6d2';
    const text = opts.parried ? '!' : opts.blocked ? String(Math.round(amount)) : String(Math.round(amount));
    this.push({
      x: x + rng.range(-4, 4), y, vy: opts.crit ? -46 : -34, life: 0, maxLife: opts.crit ? 1.0 : 0.75,
      text, color, size: opts.crit ? 12 : opts.self ? 10 : 9, outline: PAL.ink0
    });
  }

  heal(x: number, y: number, amount: number) {
    this.push({ x, y, vy: -26, life: 0, maxLife: 0.9, text: '+' + Math.round(amount), color: '#8fc47a', size: 9, outline: PAL.ink0 });
  }

  label(x: number, y: number, text: string, color = '#e8d6a8', size = 8, maxLife = 1.4) {
    this.push({ x, y, vy: -16, life: 0, maxLife, text, color, size, outline: PAL.ink0 });
  }

  gold(x: number, y: number, amount: number) {
    const text = (amount >= 0 ? '+' : '') + amount + '⊙';
    this.push({ x, y, vy: -30, life: 0, maxLife: 1.1, text, color: amount >= 0 ? '#e6c269' : '#c07a5a', size: 9, outline: PAL.ink0 });
  }

  private push(t: FloatText) {
    if (this.list.length >= this.max) this.list.shift();
    this.list.push(t);
  }

  update(dt: number) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const t = this.list[i];
      t.life += dt;
      t.y += t.vy * dt;
      t.vy += 34 * dt;
      if (t.life >= t.maxLife) this.list.splice(i, 1);
    }
  }

  draw(ctx: CanvasRenderingContext2D, camX: number, camY: number) {
    for (const t of this.list) {
      const k = t.life / t.maxLife;
      const alpha = k < 0.15 ? k / 0.15 : k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
      const sx = Math.round(t.screen ? t.x : t.x - camX);
      const sy = Math.round(t.screen ? t.y : t.y - camY);
      ctx.save();
      ctx.globalAlpha = Math.max(0, alpha);
      ctx.font = `bold ${t.size}px "EB Garamond", Georgia, serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (t.outline) { ctx.lineWidth = 3; ctx.strokeStyle = t.outline; ctx.strokeText(t.text, sx, sy); }
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, sx, sy);
      ctx.restore();
    }
  }

  clear() { this.list.length = 0; }
}
