import { Camera } from './Camera';
import { Lighting } from './Lighting';
import { WeatherParticles } from './WeatherParticles';
import { FloatingText } from './FloatingText';
import { PAL, rgba } from './Palette';
import { TILE } from '../world/TileMap';
import type { Scene, SceneObject } from '../world/Scene';
import type { Actor } from '../entities/Actor';

/* ============================================================================
   RENDERER 2D
   Bufor wewnętrzny 640×360 skalowany całkowitą wielokrotnością na canvas
   wyświetlacza (imageSmoothing = false → ostre piksele).
   Y-sorting łączy obiekty sceny i aktorów w jedną listę — postać wchodzi
   za budynek, beczkę i stragan (brief 2: Y-sorting obowiązkowy).
   ========================================================================== */

export const VIEW_W = 640;
export const VIEW_H = 360;

type DrawEntry = { y: number; obj?: SceneObject; actor?: Actor };

export class Renderer {
  buffer: HTMLCanvasElement;
  bctx: CanvasRenderingContext2D;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  camera = new Camera();
  lighting = new Lighting(VIEW_W, VIEW_H);
  weather = new WeatherParticles();
  floats = new FloatingText();
  scale = 1;
  time = 0;
  private entries: DrawEntry[] = [];
  showDebug = false;
  fps = 0;
  private fpsAcc = 0; private fpsFrames = 0;
  /** migający znacznik interakcji */
  interactPulse = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.buffer = document.createElement('canvas');
    this.buffer.width = VIEW_W; this.buffer.height = VIEW_H;
    this.bctx = this.buffer.getContext('2d', { alpha: false })!;
    this.bctx.imageSmoothingEnabled = false;
    this.camera.viewW = VIEW_W; this.camera.viewH = VIEW_H;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  /** Całkowite skalowanie: 640×360 → okno, zawsze w liczbach całkowitych. */
  resize() {
    const dpr = 1;   // piksel-art: ignorujemy devicePixelRatio, skalujemy CSS-em
    const w = Math.floor(window.innerWidth), h = Math.floor(window.innerHeight);
    this.scale = Math.max(1, Math.min(Math.floor(w / VIEW_W), Math.floor(h / VIEW_H)) || 1);
    const cssW = VIEW_W * this.scale, cssH = VIEW_H * this.scale;
    this.canvas.width = cssW * dpr; this.canvas.height = cssH * dpr;
    this.canvas.style.width = cssW + 'px'; this.canvas.style.height = cssH + 'px';
    this.ctx.imageSmoothingEnabled = false;
    document.documentElement.style.setProperty('--ui-scale', String(this.scale));
  }

  clientToWorld(clientX: number, clientY: number) {
    const rect = this.canvas.getBoundingClientRect?.();
    if (rect && rect.width > 0 && rect.height > 0) {
      const sx = (clientX - rect.left) * (VIEW_W / rect.width);
      const sy = (clientY - rect.top) * (VIEW_H / rect.height);
      return this.camera.screenToWorld(sx, sy);
    }
    const sx = clientX / Math.max(1, this.scale);
    const sy = clientY / Math.max(1, this.scale);
    return this.camera.screenToWorld(sx, sy);
  }

  draw(opts: {
    scene: Scene; actors: Actor[]; player: Actor;
    darkness: number; ambient: [number, number, number]; ambientLevel: number;
    sunDir: { x: number; y: number }; time: number; weatherKind: string;
    weatherIntensity: number; wind: number; torchLit: boolean; torchFuel: number;
    interactTarget: { x: number; y: number; label: string } | null;
    dt: number;
  }) {
    const dt = opts.dt;
    this.time = opts.time;
    this.interactPulse += dt * 4;
    this.fpsAcc += dt; this.fpsFrames++;
    if (this.fpsAcc >= 0.5) { this.fps = Math.round(this.fpsFrames / this.fpsAcc); this.fpsAcc = 0; this.fpsFrames = 0; }
    this.camera.update(dt);
    this.camera.follow(opts.player.x, opts.player.y - 12, dt);
    this.camera.setBounds(opts.scene.tilemap.w, opts.scene.tilemap.h);

    const ctx = this.bctx;
    const camX = Math.round(this.camera.x + this.camera.ox);
    const camY = Math.round(this.camera.y + this.camera.oy);

    this.weather.setWeather(opts.weatherKind, opts.weatherIntensity, opts.wind);
    this.weather.update(dt, camX, camY, VIEW_W, VIEW_H, opts.scene.smokeSources.map(s => ({ x: s.x, y: s.y })));
    this.floats.update(dt);

    /* ---- 1. podłoże ---- */
    ctx.fillStyle = PAL.ink0;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    opts.scene.tilemap.draw(ctx, camX, camY, VIEW_W, VIEW_H, this.time, this.weather.rainAmount, this.weather.snowAmount > 0);

    /* ---- 2. wspólna lista Y-sort ---- */
    const list = this.entries;
    list.length = 0;
    const sorted = opts.scene.sortedObjects();
    for (const o of sorted) {
      if (o.hidden) continue;
      if (!this.camera.visible(o.x, o.y, 96)) continue;
      if (o.tall) continue;                       // wysokie rysujemy po aktorach
      list.push({ y: o.sortY, obj: o });
    }
    for (const a of opts.actors) {
      if (a.hidden) continue;
      if (!this.camera.visible(a.x, a.y, 64)) continue;
      list.push({ y: a.sortY, actor: a });
    }
    if (opts.player && !opts.player.hidden && this.camera.visible(opts.player.x, opts.player.y, 64)) {
      list.push({ y: opts.player.sortY, actor: opts.player });
    }
    list.sort((p, q) => p.y - q.y || (p.obj ? -1 : 1));

    for (const e of list) {
      if (e.obj) this.drawObject(ctx, e.obj, camX, camY);
      else if (e.actor) e.actor.draw(ctx, opts.sunDir, camX, camY);
    }

    /* ---- 3. aktorzy i obiekty wysokie ---- */
    for (const o of sorted) {
      if (o.hidden || !o.tall) continue;
      if (!this.camera.visible(o.x, o.y, 120)) continue;
      this.drawObject(ctx, o, camX, camY);
    }

    /* ---- 4. cząsteczki świata (dym, krew, kurz) ---- */
    this.weather.drawWorld(ctx, camX, camY);

    /* ---- 5. znacznik interakcji ---- */
    if (opts.interactTarget) {
      const sx = Math.round(opts.interactTarget.x - camX), sy = Math.round(opts.interactTarget.y - camY);
      const pulse = (Math.sin(this.interactPulse) + 1) * 0.5;
      ctx.save();
      ctx.globalAlpha = 0.45 + pulse * 0.4;
      ctx.strokeStyle = '#f0dca8';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(sx, sy - 40 - pulse * 2);
      ctx.lineTo(sx - 3, sy - 44 - pulse * 2);
      ctx.moveTo(sx, sy - 40 - pulse * 2);
      ctx.lineTo(sx + 3, sy - 44 - pulse * 2);
      ctx.moveTo(sx, sy - 40 - pulse * 2);
      ctx.lineTo(sx, sy - 48 - pulse * 2);
      ctx.stroke();
      ctx.restore();
    }

    /* ---- 6. światło ---- */
    this.lighting.render({
      camX, camY, viewW: VIEW_W, viewH: VIEW_H,
      ambient: opts.ambient, ambientLevel: opts.ambientLevel,
      darkness: opts.darkness, scene: opts.scene,
      playerX: opts.player.x, playerY: opts.player.y - 14,
      torchLit: opts.torchLit, torchFuel: opts.torchFuel, time: this.time
    });
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.lighting.canvas, 0, 0, VIEW_W, VIEW_H);
    ctx.restore();

    /* ---- 7. pogoda na wierzchu + winieta nocy ---- */
    this.weather.drawScreen(ctx, VIEW_W, VIEW_H);
    if (opts.darkness > 0.25) {
      const g = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.32, VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.78);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, rgba(PAL.ink0, Math.min(0.55, opts.darkness * 0.6)));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }

    /* ---- 8. liczby pływające ---- */
    this.floats.draw(ctx, camX, camY);

    /* ---- 9. debug ---- */
    if (this.showDebug) this.drawDebug(ctx, opts, camX, camY);

    /* ---- na ekran ---- */
    this.ctx.imageSmoothingEnabled = false;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.drawImage(this.buffer, 0, 0, this.canvas.width, this.canvas.height);
  }

  private drawObject(ctx: CanvasRenderingContext2D, o: SceneObject, camX: number, camY: number) {
    const sx = Math.round(o.x + o.dx - camX), sy = Math.round(o.y + o.dy - camY);
    if (o.alpha < 1) { ctx.save(); ctx.globalAlpha = o.alpha; }
    if (o.art) {
      ctx.drawImage(o.art, sx, sy);
    } else if (o.kind === 'marker' && o.type === 'groundItem') {
      // przedmioty leżące na ziemi: mała ikona + cień
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(sx - 4, sy - 2, 8, 3);
      ctx.fillStyle = '#c9a24a';
      ctx.fillRect(sx - 3, sy - 6, 6, 5);
      ctx.fillStyle = '#e6c269';
      ctx.fillRect(sx - 3, sy - 6, 6, 1);
    }
    if (o.alpha < 1) ctx.restore();
  }

  private drawDebug(ctx: CanvasRenderingContext2D, opts: any, camX: number, camY: number) {
    ctx.save();
    ctx.globalAlpha = 0.5;
    // siatka kafelków
    ctx.strokeStyle = '#3a5a8a';
    ctx.lineWidth = 1;
    const x0 = Math.floor(camX / TILE) * TILE - camX, y0 = Math.floor(camY / TILE) * TILE - camY;
    ctx.beginPath();
    for (let x = x0; x < VIEW_W; x += TILE) { ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, VIEW_H); }
    for (let y = y0; y < VIEW_H; y += TILE) { ctx.moveTo(0, y + 0.5); ctx.lineTo(VIEW_W, y + 0.5); }
    ctx.stroke();
    // prostokąty kolizji
    ctx.strokeStyle = '#c0503a';
    for (const o of opts.scene.objects) {
      if (!o.box || o.hidden) continue;
      ctx.strokeRect(o.box.x - camX + 0.5, o.box.y - camY + 0.5, o.box.w, o.box.h);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#e8d6a8';
    ctx.font = '10px monospace';
    ctx.fillText(`fps ${this.fps}  objects ${opts.scene.objects.length}  actors ${opts.actors.length}  cam ${camX},${camY}`, 6, 12);
    ctx.restore();
  }
}
