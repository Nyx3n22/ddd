import { rng } from '../core/RNG';
import { TILE } from '../world/TileMap';
import type { Scene } from '../world/Scene';

/* ============================================================================
   KLIMAT ŚWIATA
   Mewy nad portem i ptaki nad miastem (z cieniem na ziemi), motyle przy
   kwiatach w dzień, świetliki nocą, cienie chmur i tęcza po deszczu.
   Nic z tego nie wpływa na rozgrywkę — to powietrze, którym oddycha wyspa.
   ========================================================================== */

interface Bird { x: number; y: number; vx: number; vy: number; alt: number; flap: number; gull: boolean }
interface Bug { x: number; y: number; ox: number; oy: number; t: number; seed: number; life: number; kind: 'firefly' | 'butterfly'; color: string }
interface Cloud { x: number; y: number; r: number }

export class Ambient {
  birds: Bird[] = [];
  bugs: Bug[] = [];
  clouds: Cloud[] = [];
  rainbow = 0;            // 0..1 — siła tęczy
  private blob: HTMLCanvasElement | null = null;
  private lastWeather = '';

  /** Sygnał zmiany pogody: po deszczu w dzień — tęcza. */
  weatherChanged(kind: string, isDay: boolean) {
    if ((this.lastWeather === 'rain' || this.lastWeather === 'storm') && (kind === 'clear' || kind === 'cloudy') && isDay) this.rainbow = 1;
    this.lastWeather = kind;
  }

  update(dt: number, o: { camX: number; camY: number; viewW: number; viewH: number; outdoor: boolean; night: boolean; darkness: number; wind: number; weather: string; scene: Scene }) {
    const { camX, camY, viewW, viewH } = o;
    if (!o.outdoor) { this.birds.length = 0; this.bugs.length = 0; return; }
    this.rainbow = Math.max(0, this.rainbow - dt / 50);
    const wind = o.wind || 0.3;

    /* ptaki: w dzień, nie w burzy; mewy nad wodą i portem (dół mapy) */
    const wantBirds = !o.night && o.weather !== 'storm' ? 7 : 0;
    while (this.birds.length < wantBirds) {
      const fromLeft = rng.chance(0.5);
      const y = camY + rng.range(-40, viewH + 40);
      this.birds.push({
        x: fromLeft ? camX - 60 : camX + viewW + 60, y,
        vx: (fromLeft ? 1 : -1) * rng.range(28, 52) + wind * 10, vy: rng.range(-6, 6),
        alt: rng.range(40, 90), flap: rng.range(0, 6), gull: y > 82 * TILE || rng.chance(0.3)
      });
    }
    for (let i = this.birds.length - 1; i >= 0; i--) {
      const b = this.birds[i];
      b.x += b.vx * dt; b.y += b.vy * dt; b.flap += dt * (b.gull ? 5 : 9);
      b.vy += Math.sin(b.flap * 0.3) * dt * 4;
      if (b.x < camX - 120 || b.x > camX + viewW + 120 || b.y < camY - 140 || b.y > camY + viewH + 140) this.birds.splice(i, 1);
    }

    /* robaczki: świetliki nocą (bez deszczu), motyle w dzień przy kwiatach */
    const night = o.night && o.weather !== 'rain' && o.weather !== 'storm';
    const day = !o.night && o.darkness < 0.3 && (o.weather === 'clear' || o.weather === 'cloudy' || o.weather === 'heat');
    if (night && this.bugs.filter(b => b.kind === 'firefly').length < 22 && rng.chance(dt * 12)) {
      const x = camX + rng.range(0, viewW), y = camY + rng.range(0, viewH);
      const gr = o.scene.tilemap.groundAtPx(x, y);
      if (gr === 'grass' || gr === 'grassTall' || gr === 'swamp' || gr === 'field') {
        this.bugs.push({ x, y, ox: x, oy: y, t: 0, seed: rng.range(0, 99), life: rng.range(4, 9), kind: 'firefly', color: '#e8f88a' });
      }
    }
    if (day && this.bugs.filter(b => b.kind === 'butterfly').length < 6 && rng.chance(dt * 2)) {
      const flowers = o.scene.objects.filter(ob => (ob.type === 'flowers' || ob.type === 'flowerBed') && ob.x > camX && ob.x < camX + viewW && ob.y > camY && ob.y < camY + viewH);
      if (flowers.length) {
        const f = rng.pick(flowers);
        this.bugs.push({ x: f.x, y: f.y - 10, ox: f.x, oy: f.y - 10, t: 0, seed: rng.range(0, 99), life: rng.range(6, 12), kind: 'butterfly', color: rng.pick(['#f0d28a', '#f2f0e4', '#c9503c', '#8fb0d8']) });
      }
    }
    for (let i = this.bugs.length - 1; i >= 0; i--) {
      const b = this.bugs[i];
      b.t += dt;
      if (b.kind === 'firefly') {
        b.x = b.ox + Math.sin(b.t * 0.7 + b.seed) * 14 + wind * b.t * 2;
        b.y = b.oy + Math.cos(b.t * 0.9 + b.seed * 2) * 8;
      } else {
        b.x = b.ox + Math.sin(b.t * 1.3 + b.seed) * 22 + Math.sin(b.t * 4.1) * 3;
        b.y = b.oy + Math.cos(b.t * 1.7 + b.seed) * 12 - Math.abs(Math.sin(b.t * 6)) * 3;
      }
      if (b.t > b.life || (b.kind === 'firefly' && !o.night) || (b.kind === 'butterfly' && o.night)) this.bugs.splice(i, 1);
    }

    /* cienie chmur: przy pochmurnej i pogodnej pogodzie w dzień */
    const wantClouds = o.night ? 0 : o.weather === 'cloudy' ? 5 : o.weather === 'clear' ? 2 : 0;
    while (this.clouds.length < wantClouds) this.clouds.push({ x: camX + rng.range(-400, viewW), y: camY + rng.range(-200, viewH), r: rng.range(90, 170) });
    if (this.clouds.length > wantClouds) this.clouds.length = wantClouds;
    for (const c of this.clouds) {
      c.x += (8 + wind * 16) * dt; c.y += 2 * dt;
      if (c.x - c.r > camX + viewW + 200 || c.y - c.r > camY + viewH + 200) { c.x = camX - c.r - rng.range(0, 200); c.y = camY + rng.range(-150, viewH); }
    }
  }

  /** Przed oświetleniem: cienie chmur, ptaki z cieniem, motyle. */
  drawWorld(ctx: CanvasRenderingContext2D, camX: number, camY: number) {
    if (this.clouds.length) {
      if (!this.blob) this.blob = softBlob();
      ctx.save();
      ctx.globalAlpha = 0.16;
      for (const c of this.clouds) ctx.drawImage(this.blob, Math.round(c.x - c.r - camX), Math.round(c.y - c.r * 0.6 - camY), c.r * 2, c.r * 1.2);
      ctx.restore();
    }
    for (const b of this.birds) {
      const sx = Math.round(b.x - camX), sy = Math.round(b.y - camY);
      // cień na ziemi (przesunięty o wysokość lotu)
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(sx - 3, sy + Math.round(b.alt * 0.5), 6, 2);
      const up = Math.sin(b.flap) > 0;
      const dir = b.vx < 0 ? -1 : 1;
      ctx.fillStyle = b.gull ? '#efeae0' : '#2a2420';
      const by = sy - Math.round(b.alt * 0.4);
      ctx.fillRect(sx - 1, by, 3, 2);
      ctx.fillRect(sx + dir * 2, by, 1, 1);                            // dziób/głowa
      if (up) { ctx.fillRect(sx - 4, by - 2, 3, 1); ctx.fillRect(sx + 2, by - 2, 3, 1); ctx.fillRect(sx - 2, by - 1, 1, 1); ctx.fillRect(sx + 2, by - 1, 1, 1); }
      else { ctx.fillRect(sx - 4, by + 1, 3, 1); ctx.fillRect(sx + 2, by + 1, 3, 1); }
      if (b.gull) { ctx.fillStyle = '#8a8a8a'; ctx.fillRect(sx - 4, by + (up ? -2 : 1), 1, 1); ctx.fillRect(sx + 4, by + (up ? -2 : 1), 1, 1); }
    }
    for (const b of this.bugs) {
      if (b.kind !== 'butterfly') continue;
      const sx = Math.round(b.x - camX), sy = Math.round(b.y - camY);
      const open = Math.sin(b.t * 18) > 0;
      ctx.fillStyle = b.color;
      if (open) { ctx.fillRect(sx - 2, sy - 1, 2, 2); ctx.fillRect(sx + 1, sy - 1, 2, 2); }
      else { ctx.fillRect(sx - 1, sy - 2, 1, 2); ctx.fillRect(sx + 1, sy - 2, 1, 2); }
      ctx.fillStyle = '#2a1e12'; ctx.fillRect(sx, sy - 1, 1, 2);
    }
  }

  /** Po oświetleniu: świecące świetliki i tęcza. */
  drawGlow(ctx: CanvasRenderingContext2D, camX: number, camY: number, viewW: number, viewH: number) {
    ctx.save();
    for (const b of this.bugs) {
      if (b.kind !== 'firefly') continue;
      const on = (Math.sin(b.t * 3 + b.seed) + 1) / 2;
      if (on < 0.3) continue;
      const sx = Math.round(b.x - camX), sy = Math.round(b.y - camY);
      ctx.globalAlpha = on * 0.35; ctx.fillStyle = b.color; ctx.fillRect(sx - 2, sy - 2, 5, 5);
      ctx.globalAlpha = on; ctx.fillRect(sx, sy, 1, 1);
    }
    if (this.rainbow > 0.01) {
      const cols = ['#e05a4a', '#f0a040', '#f0e070', '#7ac070', '#6a9ad8', '#8a6ac8'];
      ctx.globalAlpha = Math.min(1, this.rainbow * 1.5) * 0.18;
      ctx.lineWidth = 4;
      cols.forEach((c, i) => {
        ctx.strokeStyle = c;
        ctx.beginPath();
        ctx.arc(viewW * 0.62, viewH * 1.25, viewH * 1.05 - i * 4, Math.PI * 1.12, Math.PI * 1.62);
        ctx.stroke();
      });
    }
    ctx.restore();
  }
}

function softBlob(): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = 128; c.height = 128;
  const x = c.getContext('2d')!;
  const g = x.createRadialGradient(64, 64, 8, 64, 64, 64);
  g.addColorStop(0, 'rgba(10,14,24,1)'); g.addColorStop(0.6, 'rgba(10,14,24,0.6)'); g.addColorStop(1, 'rgba(10,14,24,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  return c;
}
