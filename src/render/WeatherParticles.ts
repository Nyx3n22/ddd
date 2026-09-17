import { rng } from '../core/RNG';

/* ============================================================================
   CZĄSTECZKI POGODY I ŚWIATA
   Deszcz, śnieg, mgła, liście, kurz spod butów, dym z kominów, rozbryzgi krwi,
   iskry z kuźni. Wszystko rysowane w pikselach na buforze 640×360.
   ========================================================================== */

export type ParticleKind = 'rain' | 'snow' | 'fog' | 'leaf' | 'dust' | 'smoke' | 'spark' | 'blood' | 'splash' | 'feather' | 'ember' | 'fly';

export interface Particle {
  kind: ParticleKind; x: number; y: number; vx: number; vy: number;
  life: number; maxLife: number; size: number; color: string; alpha: number;
  screen: boolean;   // true = współrzędne ekranowe, false = świata
}

const COLORS: Record<ParticleKind, string[]> = {
  rain: ['#9fb4c9', '#c3d4e2'],
  snow: ['#f2f5f8', '#dfe6ec'],
  fog: ['#c8ccd0', '#b6bcc2'],
  leaf: ['#8a6a32', '#a8763a', '#6f7a34'],
  dust: ['#c2ab86', '#a89272'],
  smoke: ['#6d6a66', '#8a8681'],
  spark: ['#ffcf6a', '#ff9a3c'],
  blood: ['#8a1f1a', '#5e1412'],
  splash: ['#9fb4c9', '#e0e8ee'],
  feather: ['#e8e2d4', '#c8c2b4'],
  ember: ['#ff8a3c', '#ffb45a'],
  fly: ['#3a3a34', '#55554c']
};

export class WeatherParticles {
  list: Particle[] = [];
  max = 420;
  rainAmount = 0;
  snowAmount = 0;
  fogAmount = 0;
  windX = 0;
  private fogBlobs: Array<{ x: number; y: number; r: number; a: number; vx: number }> = [];

  setWeather(kind: string, intensity: number, wind: number) {
    this.rainAmount = kind === 'rain' ? intensity : kind === 'storm' ? Math.min(1, intensity * 1.3) : 0;
    this.snowAmount = kind === 'snow' ? intensity : 0;
    this.fogAmount = kind === 'fog' ? 0.35 + intensity * 0.5 : kind === 'storm' ? 0.12 : 0;
    this.windX = wind;
    const target = Math.round(this.fogAmount * 14);
    while (this.fogBlobs.length < target) {
      this.fogBlobs.push({ x: rng.range(0, 700), y: rng.range(0, 400), r: rng.range(50, 130), a: rng.range(0.06, 0.18), vx: rng.range(2, 9) * (wind >= 0 ? 1 : -1) });
    }
    while (this.fogBlobs.length > target) this.fogBlobs.pop();
  }

  spawn(kind: ParticleKind, x: number, y: number, count = 1, opts: Partial<Particle> = {}) {
    for (let i = 0; i < count; i++) {
      if (this.list.length >= this.max) this.list.shift();
      const colors = COLORS[kind];
      const p: Particle = {
        kind, x, y,
        vx: opts.vx ?? rng.range(-14, 14), vy: opts.vy ?? rng.range(-30, -4),
        life: 0, maxLife: opts.maxLife ?? rng.range(0.5, 1.6),
        size: opts.size ?? (kind === 'blood' ? 1 : kind === 'smoke' ? 3 : 1),
        color: opts.color ?? rng.pick(colors), alpha: opts.alpha ?? 1,
        screen: opts.screen ?? false
      };
      this.list.push(p);
    }
  }

  /** Kroki w błocie/piasku → kurz; deszcz → rozbryzgi. */
  footstep(x: number, y: number, ground: string, running: boolean) {
    if (ground === 'mud' || ground === 'dirt' || ground === 'sand' || ground === 'ash') {
      this.spawn('dust', x + rng.range(-4, 4), y, running ? 4 : 2, { vy: rng.range(-16, -4), maxLife: 0.5, color: rng.pick(COLORS.dust) });
    } else if (ground === 'water' || ground === 'swamp') {
      this.spawn('splash', x, y, running ? 6 : 3, { vy: rng.range(-40, -12), maxLife: 0.55 });
    } else if (ground === 'grassTall') {
      this.spawn('leaf', x, y - 2, 1, { vy: rng.range(-10, -2), maxLife: 0.8 });
    }
  }

  update(dt: number, camX: number, camY: number, viewW: number, viewH: number, smokeSources: Array<{ x: number; y: number }>) {
    // deszcz/śnieg — cząsteczki ekranowe, odnawiane stale
    const want = Math.round(this.rainAmount * 150 + this.snowAmount * 90);
    let have = 0;
    for (const p of this.list) if (p.screen && (p.kind === 'rain' || p.kind === 'snow')) have++;
    if (have < want) {
      const n = Math.min(12, want - have);
      for (let i = 0; i < n; i++) {
        const isRain = this.rainAmount > 0 && rng.chance(this.rainAmount / Math.max(0.01, this.rainAmount + this.snowAmount));
        this.list.push({
          kind: isRain ? 'rain' : 'snow', x: rng.range(-40, viewW + 40), y: rng.range(-40, viewH),
          vx: this.windX * (isRain ? 60 : 16), vy: isRain ? rng.range(300, 420) : rng.range(26, 52),
          life: 0, maxLife: 4, size: isRain ? 1 : rng.int(1, 2), color: rng.pick(COLORS[isRain ? 'rain' : 'snow']),
          alpha: isRain ? 0.55 : 0.85, screen: true
        });
      }
    }
    // dym z kominów (świat)
    if (rng.chance(dt * 26)) {
      const src = rng.pick(smokeSources.length ? smokeSources : [{ x: camX + viewW / 2, y: camY + viewH / 2 }]);
      this.spawn('smoke', src.x + rng.range(-3, 3), src.y, 1, { vy: rng.range(-14, -6), vx: this.windX * 8, maxLife: rng.range(2.4, 4.5), size: 3, alpha: 0.5 });
    }
    // muchy nad bagnem/zwłokami
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.life += dt;
      if (p.life >= p.maxLife) { this.list.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.kind === 'smoke') { p.vy *= 0.995; p.size += dt * 1.4; p.alpha = Math.max(0, p.alpha - dt * 0.16); }
      if (p.kind === 'blood' || p.kind === 'splash' || p.kind === 'spark') p.vy += 220 * dt;
      if (p.kind === 'dust') { p.vy += 20 * dt; p.alpha = Math.max(0, 1 - p.life / p.maxLife) * 0.7; }
      if (p.kind === 'leaf' || p.kind === 'feather') { p.vx += Math.sin(p.life * 6) * 12 * dt; p.vy += 26 * dt; }
      if (p.kind === 'ember') { p.vy -= 20 * dt; p.alpha = Math.max(0, 1 - p.life / p.maxLife); }
      if (p.screen) {
        if (p.y > viewH + 20) { p.y = -10; p.x = rng.range(-40, viewW + 40); p.life = 0; }
        if (p.x < -60) p.x = viewW + 20;
        if (p.x > viewW + 60) p.x = -20;
      }
    }
    // mgła
    for (const f of this.fogBlobs) {
      f.x += f.vx * dt;
      if (f.x > viewW + f.r) f.x = -f.r;
      if (f.x < -f.r) f.x = viewW + f.r;
    }
  }

  drawWorld(ctx: CanvasRenderingContext2D, camX: number, camY: number) {
    for (const p of this.list) {
      if (p.screen) continue;
      const sx = p.x - camX, sy = p.y - camY;
      if (sx < -20 || sy < -20 || sx > 660 || sy > 380) continue;
      ctx.globalAlpha = p.alpha * (p.kind === 'smoke' ? 0.5 : 1);
      ctx.fillStyle = p.color;
      const s = Math.max(1, Math.round(p.size));
      ctx.fillRect(Math.round(sx), Math.round(sy), s, s);
    }
    ctx.globalAlpha = 1;
  }

  drawScreen(ctx: CanvasRenderingContext2D, viewW: number, viewH: number) {
    // deszcz i śnieg
    for (const p of this.list) {
      if (!p.screen) continue;
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      if (p.kind === 'rain') ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 5);
      else ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    }
    ctx.globalAlpha = 1;
    // mgła
    if (this.fogAmount > 0) {
      for (const f of this.fogBlobs) {
        const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r);
        g.addColorStop(0, `rgba(206,210,214,${f.a * this.fogAmount * 2})`);
        g.addColorStop(1, 'rgba(206,210,214,0)');
        ctx.fillStyle = g;
        ctx.fillRect(f.x - f.r, f.y - f.r, f.r * 2, f.r * 2);
      }
      ctx.fillStyle = `rgba(198,203,208,${this.fogAmount * 0.24})`;
      ctx.fillRect(0, 0, viewW, viewH);
    }
  }

  clear() { this.list.length = 0; this.fogBlobs.length = 0; }
}
