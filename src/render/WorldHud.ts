import { getGame } from '../core/gameSingleton';
import { t } from '../core/Localization';
import { TILE } from '../world/TileMap';
import { NPCActor } from '../entities/NPCActor';
import { EnemyActor } from '../entities/EnemyActor';
import { ReputationSystem } from '../systems/ReputationSystem';
import { QuestSystem, questDef } from '../systems/QuestSystem';
import { NotesSystem } from '../systems/NotesSystem';
import type { Actor } from '../entities/Actor';
import { PAL } from './Palette';
import { settings } from '../core/Settings';

/* ============================================================================
   HUD W ŚWIECIE (rysowany w buforze 640×360, nad oświetleniem)
   Imiona nad głowami, dymki z kwestiami, „!” nad świadkami, stożki widzenia
   straży i oko widoczności przy skradaniu, strzałka do celu zadania,
   minimapa. Wszystko małe i czytelne — gra ma być o patrzeniu na świat.
   ========================================================================== */

interface Bubble { actor: Actor; text: string; life: number; maxLife: number }

export interface QuestTarget { x: number; y: number; label: string }

export class WorldHud {
  bubbles: Bubble[] = [];
  private minimap: HTMLCanvasElement | null = null;
  private minimapScene = '';
  private pulse = 0;

  say(actor: Actor, text: string, seconds = 3.2) {
    this.bubbles = this.bubbles.filter(b => b.actor !== actor);
    if (this.bubbles.length > 5) this.bubbles.shift();
    this.bubbles.push({ actor, text, life: 0, maxLife: seconds });
  }

  update(dt: number) {
    this.pulse += dt;
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const b = this.bubbles[i];
      b.life += dt;
      if (b.life >= b.maxLife || b.actor.hidden || !b.actor.alive) this.bubbles.splice(i, 1);
    }
  }

  draw(ctx: CanvasRenderingContext2D, camX: number, camY: number, viewW: number, viewH: number) {
    const g = getGame(), s = g.state, w = g.world;
    if (!w?.scene) return;
    const p = w.player;
    ctx.save();
    ctx.textBaseline = 'alphabetic';

    /* --- stożki widzenia straży (tylko przy skradaniu) --- */
    if (p.sneak && settings.data.showVisionCones) {
      for (const a of w.actors) {
        if (a === p || a.hidden || !a.alive) continue;
        const guard = (a instanceof NPCActor && (a.faction === 'cityGuard' || a.faction === 'wildKnights'))
          || (a instanceof EnemyActor && (a.kind === 'guard' || a.kind === 'knight'));
        if (!guard) continue;
        const d = Math.hypot(a.x - p.x, a.y - p.y);
        if (d > 300) continue;
        const light = w.lightLevel(p.x, p.y);
        const range = 190 * (0.45 + light * 0.75) * 0.6;
        const base = a.dir === 1 ? Math.PI : a.dir === 2 ? 0 : a.dir === 3 ? -Math.PI / 2 : Math.PI / 2;
        const sx = a.x - camX, sy = a.y - 10 - camY;
        const sees = a instanceof NPCActor ? a.canSee(p, d, w.scene.tilemap) : d < range;
        ctx.globalAlpha = sees ? 0.22 : 0.1;
        ctx.fillStyle = sees ? '#e0402a' : '#f0dca8';
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.arc(sx, sy, range, base - 0.9, base + 0.9);
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    /* --- imiona nad głowami pobliskich ludzi, kolor wg relacji --- */
    ctx.font = '8px Georgia, serif';
    ctx.textAlign = 'center';
    for (const a of w.npcs) {
      if (!settings.data.showNameplates) break;
      if (a.hidden || !a.alive) continue;
      const d = Math.hypot(a.x - p.x, a.y - p.y);
      if (d > 74) continue;
      const rel = a.isPasserby ? 0 : ReputationSystem.relation(a.npcId);
      const col = a.hostile ? '#ff6a4a' : rel >= 20 ? '#a8dc8a' : rel <= -20 ? '#e8906a' : '#efe2c2';
      const alpha = Math.min(1, (74 - d) / 24);
      ctx.globalAlpha = alpha;
      const name = a.name || t('npc.stranger');
      outlined(ctx, name, Math.round(a.x - camX), Math.round(a.y - camY - 44), col);
    }
    ctx.globalAlpha = 1;

    /* --- „!” nad świadkami i zaniepokojonymi --- */
    for (const a of w.npcs) {
      if (a.hidden || !a.alive || a.aware < 0.35) continue;
      const bob = Math.sin(this.pulse * 8) * 1.5;
      const x = Math.round(a.x - camX), y = Math.round(a.y - camY - 56 + bob);
      ctx.fillStyle = PAL.ink0; ctx.fillRect(x - 2, y - 9, 5, 12);
      ctx.fillStyle = a.aware > 0.7 ? '#ff5a3c' : '#f0c040';
      ctx.fillRect(x - 1, y - 8, 3, 7); ctx.fillRect(x - 1, y, 3, 2);
    }

    /* --- dymki z kwestiami --- */
    ctx.font = '8px Georgia, serif';
    for (const b of this.bubbles) {
      const a = b.actor;
      const k = b.life / b.maxLife;
      ctx.globalAlpha = k < 0.1 ? k / 0.1 : k > 0.85 ? (1 - k) / 0.15 : 1;
      const lines = wrap(ctx, b.text, 118);
      const wMax = Math.max(...lines.map(l => ctx.measureText(l).width)) + 10;
      const h = lines.length * 10 + 6;
      const x = Math.round(Math.max(4, Math.min(viewW - wMax - 4, a.x - camX - wMax / 2)));
      const y = Math.round(a.y - camY - 60 - h);
      ctx.fillStyle = 'rgba(240,228,198,0.95)';
      ctx.fillRect(x, y, wMax, h);
      ctx.fillStyle = PAL.ink1;
      ctx.fillRect(x, y, wMax, 1); ctx.fillRect(x, y + h - 1, wMax, 1); ctx.fillRect(x, y, 1, h); ctx.fillRect(x + wMax - 1, y, 1, h);
      const tx = Math.round(a.x - camX);
      ctx.fillStyle = 'rgba(240,228,198,0.95)'; ctx.fillRect(tx - 2, y + h, 5, 2); ctx.fillRect(tx - 1, y + h + 2, 3, 2);
      ctx.fillStyle = '#2a1e12';
      ctx.textAlign = 'left';
      lines.forEach((l, i) => ctx.fillText(l, x + 5, y + 11 + i * 10));
      ctx.textAlign = 'center';
    }
    ctx.globalAlpha = 1;

    /* --- oko widoczności przy skradaniu --- */
    if (p.sneak && !p.hidden) {
      const light = w.lightLevel(p.x, p.y);
      const x = Math.round(p.x - camX), y = Math.round(p.y - camY - 52);
      const open = light > 0.62 ? 2 : light > 0.32 ? 1 : 0;
      ctx.fillStyle = PAL.ink0; ctx.fillRect(x - 7, y - 4, 15, 9);
      ctx.fillStyle = open === 2 ? '#f0e2c0' : open === 1 ? '#b0a58a' : '#5a5246';
      ctx.fillRect(x - 6, y - (open ? 2 : 0), 13, open ? 5 : 1);
      if (open) { ctx.fillStyle = open === 2 ? '#c0402a' : '#3a3026'; ctx.fillRect(x - 1, y - 1, 3, 3); }
    }

    /* --- cel zadania: znacznik albo strzałka przy krawędzi --- */
    const target = settings.data.showQuestMarkers ? this.questTarget() : null;
    if (target) {
      const sx = target.x - camX, sy = target.y - camY;
      const margin = 18;
      if (sx > margin && sy > margin && sx < viewW - margin && sy < viewH - margin) {
        const bob = Math.sin(this.pulse * 4) * 2;
        drawDiamond(ctx, Math.round(sx), Math.round(sy - 54 + bob));
      } else {
        const cx = viewW / 2, cy = viewH / 2;
        const ang = Math.atan2(sy - cy, sx - cx);
        const ex = Math.max(margin, Math.min(viewW - margin, cx + Math.cos(ang) * (viewW / 2 - margin)));
        const ey = Math.max(margin + 40, Math.min(viewH - margin - 40, cy + Math.sin(ang) * (viewH / 2 - margin)));
        ctx.save();
        ctx.translate(Math.round(ex), Math.round(ey));
        ctx.rotate(ang);
        ctx.fillStyle = PAL.ink0;
        ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-6, -7); ctx.lineTo(-6, 7); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#e6c269';
        ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-4, -5); ctx.lineTo(-4, 5); ctx.closePath(); ctx.fill();
        ctx.restore();
        const dist = Math.round(Math.hypot(target.x - p.x, target.y - p.y) / TILE);
        ctx.font = '8px Georgia, serif';
        outlined(ctx, `${target.label} · ${dist} m`, Math.round(ex - Math.cos(ang) * 18), Math.round(ey - Math.sin(ang) * 14 + 3), '#e6c269');
      }
    }

    /* --- minimapa (tylko z mapą w sakwie, tylko na zewnątrz) --- */
    if (settings.data.showMinimap && s.scene === 'world' && NotesSystem.ownedRegions().length) this.drawMinimap(ctx, viewW, viewH, target);
    ctx.restore();
  }

  /** Gdzie jest cel bieżącego etapu śledzonego zadania (w tej scenie albo drzwi do niej). */
  questTarget(): QuestTarget | null {
    const g = getGame(), s = g.state, w = g.world;
    const tracked = [...s.quests].reverse().find(q => q.state === 'active' && questDef(q.id));
    if (!tracked) return null;
    const def = questDef(tracked.id)!;
    const stage: any = def.stages[tracked.stageIdx];
    if (!stage) return null;
    const label = t(def.titleKey);
    const tg = stage.target || {};
    const o = stage.objective || {};
    const npcId: string | undefined = tg.npc || (o.type === 'talk' ? o.npc : undefined);
    if (npcId) {
      const n = w.npcs.find(x => x.npcId === npcId);
      if (n && !n.hidden && n.scene === s.scene) return { x: n.x, y: n.y, label };
      if (n && n.scene !== s.scene) return this.doorTo(n.scene, label);
      return null;
    }
    if (tg.interior || tg.station) {
      if (tg.interior && tg.interior !== s.scene) return this.doorTo(tg.interior, label);
      const st = w.scene.stations.find(x => x.type === tg.station);
      if (st) return { x: st.x, y: st.y, label };
    }
    if (tg.tx !== undefined && s.scene === 'world') return { x: tg.tx * TILE + 16, y: tg.ty * TILE + 16, label };
    if (tg.tx !== undefined && s.scene !== 'world') return this.doorTo('world', label);
    if (o.type === 'kill') {
      const e = w.enemies.find(x => x.typeId === o.target && x.alive && x.scene === s.scene);
      if (e) return { x: e.x, y: e.y, label };
    }
    return null;
  }

  private doorTo(scene: string, label: string): QuestTarget | null {
    const w = getGame().world, s = getGame().state;
    if (s.scene !== 'world') {
      // jesteśmy we wnętrzu: najpierw wyjście
      const ex = w.scene.exits.find(e => e.data?.to === scene) || w.scene.exits.find(e => e.data?.to === 'world');
      return ex ? { x: ex.x, y: ex.y, label } : null;
    }
    if (scene === 'world') return null;
    const d = w.district.byInteract('door:' + scene);
    if (d) return { x: d.x, y: d.y, label };
    if (scene === 'int_room_john') { const t2 = w.district.byInteract('door:int_tavern'); if (t2) return { x: t2.x, y: t2.y, label }; }
    return null;
  }

  private drawMinimap(ctx: CanvasRenderingContext2D, viewW: number, viewH: number, target: QuestTarget | null) {
    const g = getGame(), w = g.world, s = g.state;
    const map = w.district.tilemap;
    if (!this.minimap || this.minimapScene !== w.district.id) {
      // jedna kropka na kafel, kolory jak na papierowej mapie
      const c = document.createElement('canvas'); c.width = map.w; c.height = map.h;
      const x = c.getContext('2d')!;
      const col: Record<string, string> = {
        grass: '#8f9a5c', grassTall: '#7d8a4e', dirt: '#b39a6a', road: '#a68c5c', cobble: '#9a9284', stone: '#8c867a',
        sand: '#d8c393', mud: '#8a7452', swamp: '#6f7448', water: '#5f87a0', waterDeep: '#476d86', planks: '#8a6438',
        field: '#c2a65e', gravel: '#9a9488', ash: '#5a554e'
      };
      for (let ty = 0; ty < map.h; ty++) for (let tx = 0; tx < map.w; tx++) {
        x.fillStyle = map.isBlocked(tx, ty) && !map.isWater(tx, ty) ? '#5a4632' : (col[map.groundAt(tx, ty)] || '#a08c64');
        x.fillRect(tx, ty, 1, 1);
      }
      this.minimap = c; this.minimapScene = w.district.id;
    }
    const W = 104, H = 78, x0 = viewW - W - 6, y0 = viewH - H - 42;
    // wycinek wokół gracza (skala 1 kafel = 1 px, czyli ~1/32 widoku)
    const ptx = w.player.x / TILE, pty = w.player.y / TILE;
    const sx = Math.max(0, Math.min(map.w - W, ptx - W / 2)), sy = Math.max(0, Math.min(map.h - H, pty - H / 2));
    ctx.fillStyle = '#17120c'; ctx.fillRect(x0 - 3, y0 - 3, W + 6, H + 6);
    ctx.fillStyle = '#c9b489'; ctx.fillRect(x0 - 2, y0 - 2, W + 4, H + 4);
    ctx.drawImage(this.minimap, Math.floor(sx), Math.floor(sy), W, H, x0, y0, W, H);
    // mgła: nieodkryte komórki przykrywamy pergaminem
    const bits: string | undefined = s.maps.visited['port_dolne_miasto'];
    if (bits) {
      const cell = 4, gw = Math.ceil(map.w / cell);
      ctx.fillStyle = 'rgba(201,180,137,0.92)';
      for (let cy = Math.floor(sy / cell); cy * cell < sy + H; cy++) for (let cx = Math.floor(sx / cell); cx * cell < sx + W; cx++) {
        if (bits[cy * gw + cx] === '1') continue;
        const rx = x0 + cx * cell - sx, ry = y0 + cy * cell - sy;
        const l = Math.max(x0, rx), tp = Math.max(y0, ry);
        const r = Math.min(x0 + W, rx + cell), b = Math.min(y0 + H, ry + cell);
        if (r > l && b > tp) ctx.fillRect(l, tp, r - l, b - tp);
      }
    }
    // cel i gracz
    if (target) {
      const mx = x0 + target.x / TILE - sx, my = y0 + target.y / TILE - sy;
      if (mx >= x0 && my >= y0 && mx < x0 + W && my < y0 + H) { ctx.fillStyle = '#b8302a'; ctx.fillRect(Math.round(mx) - 2, Math.round(my) - 2, 4, 4); }
    }
    const blink = Math.sin(this.pulse * 6) > 0;
    ctx.fillStyle = blink ? '#f8f0d8' : '#2a1e12';
    ctx.fillRect(Math.round(x0 + ptx - sx) - 1, Math.round(y0 + pty - sy) - 1, 3, 3);
    // kompas
    ctx.font = '7px Georgia, serif'; ctx.textAlign = 'center';
    outlined(ctx, t('map.north'), x0 + W / 2, y0 + 8, '#2a1e12', '#e6d7b1');
  }
}

function outlined(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, outline = '#120d08') {
  ctx.fillStyle = outline;
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) ctx.fillText(text, x + dx, y + dy);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

function drawDiamond(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = '#120d08';
  ctx.beginPath(); ctx.moveTo(x, y - 7); ctx.lineTo(x + 6, y); ctx.lineTo(x, y + 7); ctx.lineTo(x - 6, y); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#e6c269';
  ctx.beginPath(); ctx.moveTo(x, y - 5); ctx.lineTo(x + 4, y); ctx.lineTo(x, y + 5); ctx.lineTo(x - 4, y); ctx.closePath(); ctx.fill();
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = '';
  for (const wd of words) {
    const test = cur ? cur + ' ' + wd : wd;
    if (ctx.measureText(test).width > maxW && cur) { lines.push(cur); cur = wd; } else cur = test;
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 4);
}

