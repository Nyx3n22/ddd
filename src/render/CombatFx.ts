import type { Actor } from '../entities/Actor';
import type { Dir } from './Characters';

/* ============================================================================
   EFEKTY WALKI
   Ślad cięcia (łuk przed postacią w kierunku ciosu) i paski zdrowia nad
   rannymi lub wrogimi przeciwnikami. Bez tego w rzucie z góry nie widać,
   gdzie poszedł cios ani ile wrogowi zostało.
   ========================================================================== */

interface Slash { x: number; y: number; dir: Dir; reach: number; life: number; maxLife: number; hit: boolean }

const DIR_ANGLE: Record<number, number> = { 0: Math.PI / 2, 1: Math.PI, 2: 0, 3: -Math.PI / 2 };

export class CombatFx {
  private slashes: Slash[] = [];

  swing(x: number, y: number, dir: Dir, reach: number, hit = false) {
    if (this.slashes.length > 12) this.slashes.shift();
    this.slashes.push({ x, y, dir, reach, life: 0, maxLife: 0.18, hit });
  }

  update(dt: number) {
    for (let i = this.slashes.length - 1; i >= 0; i--) {
      const s = this.slashes[i];
      s.life += dt;
      if (s.life >= s.maxLife) this.slashes.splice(i, 1);
    }
  }

  /** Łuk cięcia — rysowany w kadrze nad postaciami. */
  drawSlashes(ctx: CanvasRenderingContext2D, camX: number, camY: number) {
    for (const s of this.slashes) {
      const k = s.life / s.maxLife;
      const base = DIR_ANGLE[s.dir] ?? 0;
      // łuk „przesuwa się” w trakcie ciosu: od -60° do +60° względem kierunku
      const sweep = Math.PI * 0.66;
      const a0 = base - sweep / 2, a1 = a0 + sweep * Math.min(1, k * 1.6 + 0.2);
      const cx = Math.round(s.x - camX), cy = Math.round(s.y - 12 - camY);
      const r = Math.max(14, s.reach * 0.8);
      ctx.save();
      ctx.globalAlpha = (1 - k) * 0.9;
      ctx.strokeStyle = s.hit ? '#ffe2a0' : '#e8e2d4';
      ctx.lineWidth = 2;
      ctx.beginPath();
      // w rzucie 3/4 łuk jest spłaszczony w pionie
      for (let i = 0; i <= 10; i++) {
        const a = a0 + (a1 - a0) * (i / 10);
        const px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r * 0.7;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.globalAlpha = (1 - k) * 0.35;
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.restore();
    }
  }

  /** Paski zdrowia nad wrogami, którzy walczą albo dostali cios. */
  drawHealthBars(ctx: CanvasRenderingContext2D, actors: Actor[], camX: number, camY: number) {
    for (const a of actors) {
      if (a.hidden || !a.alive) continue;
      const anyA = a as any;
      const hostile = !!anyA.aggroTarget || !!anyA.hostile;
      if (!hostile && a.hp >= a.maxHp) continue;
      const w = 18, h = 3;
      const x = Math.round(a.x - camX - w / 2), y = Math.round(a.y - camY - 46);
      const pct = Math.max(0, Math.min(1, a.hp / Math.max(1, a.maxHp)));
      ctx.fillStyle = 'rgba(10,8,6,0.85)';
      ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
      ctx.fillStyle = '#3a1712';
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = pct > 0.5 ? '#c04a34' : pct > 0.25 ? '#c8862e' : '#e0402a';
      ctx.fillRect(x, y, Math.max(1, Math.round(w * pct)), h);
      // wróg szykuje cios — czerwony znak nad paskiem
      if (a.telegraph > 0.05) {
        ctx.globalAlpha = Math.min(1, a.telegraph);
        ctx.fillStyle = '#ff5a3c';
        ctx.fillRect(Math.round(a.x - camX) - 1, y - 7, 2, 4);
        ctx.fillRect(Math.round(a.x - camX) - 1, y - 2, 2, 1);
        ctx.globalAlpha = 1;
      }
    }
  }
}
