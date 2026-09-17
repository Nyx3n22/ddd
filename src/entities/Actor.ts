import { TILE, type TileMap } from '../world/TileMap';
import { drawActor, drawActorShadow, lookOf, FRAME_COUNTS, type ActorAction, type ActorLook, type Dir } from '../render/Characters';
import { rng } from '../core/RNG';

/* ============================================================================
   AKTOR — wspólna baza dla Johna, NPC i przeciwników.
   Pozycja w pikselach świata, kotwica „stopy”, ruch z kolizją po siatce,
   Y-sorting względem obiektów sceny (brief 2: postać chowa się za budynkiem).
   ========================================================================== */

export type ActorState = 'idle' | 'walk' | 'run' | 'sneak' | 'attack' | 'block' | 'hit' | 'death' | 'work' | 'sit' | 'sleep' | 'carry' | 'talk' | 'search' | 'point' | 'flee';

export interface ActorHitbox { w: number; h: number }

export abstract class Actor {
  id: string;
  name = '';
  x: number; y: number;              // stopy w pikselach świata
  dir: Dir = 0;
  action: ActorAction = 'idle';
  frame = 0;
  animTime = 0;
  speed = 42;                        // px/s
  radius = 6;                        // promień kolizji
  look: ActorLook;
  hp = 30; maxHp = 30;
  alive = true;
  hurtFlash = 0;
  wet = false;
  /** scenowy identyfikator (world / int_...) — aktor żyje w jednej scenie */
  scene = 'world';
  /** czy postać jest schowana (śpi wewnątrz, za drzwiami) */
  hidden = false;
  /** podświetlenie celu interakcji */
  highlighted = 0;
  /** ostatnia znana pozycja celu (dla AI) */
  targetX = 0; targetY = 0;
  /** droga wyznaczona przez A* */
  path: Array<{ x: number; y: number }> | null = null;
  pathIdx = 0;
  repathCooldown = 0;
  /** cień rysowany względem kąta słońca */
  shadow = true;
  /** mnożnik głośności kroków */
  noise = 1;
  knockback = { x: 0, y: 0 };
  deathTime = 0;
  telegraph = 0;

  constructor(id: string, x: number, y: number, palette = 'peasantM', extra: Partial<ActorLook> = {}) {
    this.id = id;
    this.x = x; this.y = y;
    this.look = lookOf(palette, extra);
  }

  get tx() { return Math.floor(this.x / TILE); }
  get ty() { return Math.floor(this.y / TILE); }
  get sortY() { return this.y; }

  setAction(a: ActorAction) {
    if (this.action !== a) { this.action = a; this.frame = 0; this.animTime = 0; }
  }

  faceTowards(x: number, y: number) {
    const dx = x - this.x, dy = y - this.y;
    if (Math.abs(dx) > Math.abs(dy)) this.dir = dx < 0 ? 1 : 2;
    else this.dir = dy < 0 ? 3 : 0;
  }

  /** Ruch z kolizją po mapie kafelków; zwraca info o zablokowaniu osi. */
  move(dx: number, dy: number, map: TileMap, avoid: Actor[] = []): { hitX: boolean; hitY: boolean } {
    if (!this.alive) return { hitX: false, hitY: false };
    // odrzut
    dx += this.knockback.x; dy += this.knockback.y;
    this.knockback.x *= 0.78; this.knockback.y *= 0.78;
    if (Math.abs(this.knockback.x) < 0.4) this.knockback.x = 0;
    if (Math.abs(this.knockback.y) < 0.4) this.knockback.y = 0;
    const res = map.tryMove({ x: this.x, y: this.y }, dx, dy, this.radius);
    this.x = res.x; this.y = res.y;
    // unikanie tłumu — miękkie odpychanie, żeby postacie nie stały w sobie
    for (const o of avoid) {
      if (o === this || !o.alive || o.hidden) continue;
      const ox = this.x - o.x, oy = (this.y - o.y) * 1.7;
      const d2 = ox * ox + oy * oy;
      const min = (this.radius + o.radius) * 1.15;
      if (d2 > 0.01 && d2 < min * min) {
        const d = Math.sqrt(d2), push = (min - d) * 0.5;
        this.x += (ox / d) * push; this.y += (oy / d) * push * 0.6;
      }
    }
    return { hitX: res.hitX, hitY: res.hitY };
  }

  /** Podążanie ścieżką A* (w pikselach). */
  followPath(dt: number, map: TileMap, avoid: Actor[] = []): boolean {
    if (!this.path || this.path.length === 0) return false;
    const node = this.path[this.pathIdx];
    if (!node) { this.path = null; return false; }
    const dx = node.x * TILE + TILE / 2 - this.x;
    const dy = node.y * TILE + TILE / 2 - this.y;
    const d = Math.hypot(dx, dy);
    if (d < 5) { this.pathIdx++; if (this.pathIdx >= this.path.length) { this.path = null; return false; } return true; }
    const step = this.speed * dt;
    this.move((dx / d) * step, (dy / d) * step, map, avoid);
    this.faceTowards(node.x * TILE + TILE / 2, node.y * TILE + TILE / 2);
    return true;
  }

  seekTo(x: number, y: number, map: TileMap, avoid: Actor[] = []): boolean {
    this.repathCooldown -= 1;
    const d = Math.hypot(x - this.x, y - this.y);
    if (d < 8) { this.path = null; return true; }
    if (!this.path || this.repathCooldown <= 0) {
      const p = map.findPath(this.tx, this.ty, Math.floor(x / TILE), Math.floor(y / TILE), 900);
      this.path = p && p.length > 1 ? p.slice(1) : null;
      this.pathIdx = 0;
      this.repathCooldown = 45;
      if (!this.path) {
        // brak ścieżki — idź w przybliżeniu, żeby nie stać w miejscu
        const step = this.speed * (1 / 60);
        this.move(((x - this.x) / d) * step, ((y - this.y) / d) * step, map, avoid);
        this.faceTowards(x, y);
      }
    }
    if (this.path) this.followPath(1 / 60, map, avoid);
    return false;
  }

  update(dt: number, ..._args: any[]): void {
    if (!this.alive) {
      this.setAction('death');
      this.deathTime += dt;
      this.animTime += dt;
      this.frame = Math.min(FRAME_COUNTS.death - 1, Math.floor(this.deathTime * 8));
      return;
    }
    if (this.hurtFlash > 0) this.hurtFlash -= dt;
    if (this.highlighted > 0) this.highlighted = Math.max(0, this.highlighted - dt);
    if (this.telegraph > 0) this.telegraph = Math.max(0, this.telegraph - dt * 3);
    // animacja
    const moving = this.action === 'walk' || this.action === 'run' || this.action === 'sneak' || this.action === 'carry' || this.action === 'search';
    const rate = this.action === 'run' ? 11 : this.action === 'walk' || this.action === 'carry' ? 8 : this.action === 'sneak' || this.action === 'search' ? 5 : this.action === 'attack' ? 16 : 4;
    this.animTime += dt * rate;
    const max = FRAME_COUNTS[this.action] || 4;
    if (this.action === 'attack') {
      this.frame = Math.min(max - 1, Math.floor(this.animTime));
      if (this.animTime >= max) this.setAction(moving ? 'walk' : 'idle');
    } else if (this.action === 'hit') {
      this.frame = Math.min(max - 1, Math.floor(this.animTime * 2));
      if (this.animTime >= 1) this.setAction('idle');
    } else {
      this.frame = Math.floor(this.animTime) % max;
    }
  }

  damage(amount: number, _fromX?: number, _fromY?: number) {
    if (!this.alive) return;
    this.hp -= amount;
    this.hurtFlash = 0.22;
    if (this.hp <= 0) { this.hp = 0; this.alive = false; this.setAction('death'); this.deathTime = 0; }
    else this.setAction('hit');
  }

  draw(ctx: CanvasRenderingContext2D, sunDir: { x: number; y: number }) {
    if (this.hidden) return;
    if (this.shadow && this.alive) drawActorShadow(ctx, this.x, this.y, sunDir.x, this.action === 'sneak' ? 9 : 12, 4, 0.3);
    drawActor(ctx, this.x, this.y, {
      dir: this.dir, action: this.action, frame: this.frame, look: this.look,
      hurt: Math.max(0, Math.min(1, 1 - this.hp / Math.max(1, this.maxHp))) * 0.8 + (this.hurtFlash > 0 ? 0.2 : 0),
      wet: this.wet, telegraph: this.telegraph, alpha: this.hidden ? 0 : 1
    });
  }

  /** Głośność kroków — podstawa wykrywania przez straż i zwierzęta. */
  noiseLevel(action: ActorAction, ground: string, sneaking: boolean): number {
    let n = action === 'run' ? 1.5 : action === 'walk' ? 1.0 : action === 'sneak' ? 0.35 : 0.5;
    const mul: Record<string, number> = { water: 1.6, swamp: 1.8, mud: 1.5, planks: 1.35, gravel: 1.25, cobble: 0.9, road: 0.85, stone: 0.8, grass: 0.7, grassTall: 0.55, sand: 0.6, dirt: 0.8, ash: 0.85, field: 0.75, floorWood: 1.1, floorStone: 0.85, rug: 0.5 };
    n *= mul[ground] ?? 1;
    if (sneaking) n *= 0.6;
    return n * this.noise;
  }

  static randomDir(): Dir { return rng.int(0, 3) as Dir; }
}
