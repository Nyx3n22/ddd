import { Actor } from './Actor';
import { bus } from '../core/EventBus';
import { rng } from '../core/RNG';
import { getGame } from '../core/gameSingleton';
import { t } from '../core/Localization';
import { SkillsSystem } from '../systems/SkillsSystem';
import { NeedsSystem } from '../systems/NeedsSystem';
import { NotesSystem } from '../systems/NotesSystem';
import { QuestSystem } from '../systems/QuestSystem';
import { ReputationSystem } from '../systems/ReputationSystem';
import ENEMIES from '../data/enemies.json';
import { randomPasserbyLook, lookOf } from '../render/Characters';

/* ============================================================================
   PRZECIWNICY I ZWIERZĘTA
   Statystyki w enemies.json. Zachowanie: terytorium, teleport ataku
   (czytelny dla gracza), ucieczka przy niskim zdrowiu, wataha wilków.
   ========================================================================== */

const CREATURES = (ENEMIES as any).creatures as Record<string, any>;
const HUMANS = (ENEMIES as any).humans as Record<string, any>;
const DIFFICULTY = (ENEMIES as any).difficulty as Record<string, any>;

export function creatureStat(id: string) { return CREATURES[id]; }
export function humanStat(id: string) { return HUMANS[id]; }
export function difficultyMod(level: string) { return DIFFICULTY[level] || DIFFICULTY.normal; }

export type EnemyKind = 'creature' | 'bandit' | 'guard' | 'knight';

export class EnemyActor extends Actor {
  kind: EnemyKind;
  typeId: string;
  stats: any;
  home = { x: 0, y: 0 };
  leash = 420;
  aggroTarget: Actor | null = null;
  attackCooldown = 0;
  combat = { attacking: false, t: 0, telegraphDone: false };
  alertRadius: number;
  packId?: string;
  noise = 1;
  loot: string[] = [];
  crimeOnKill?: string;
  factionRep?: string;
  lastSeen = { x: 0, y: 0, day: 0 };
  wanderTimer = 0;
  wanderTarget = { x: 0, y: 0 };

  constructor(typeId: string, kind: EnemyKind, x: number, y: number, opts: { packId?: string; seed?: number } = {}) {
    const stats = kind === 'creature' ? CREATURES[typeId] : HUMANS[typeId];
    const palette = kind === 'creature' ? (typeId === 'wildKnight' ? 'knight' : typeId) : (stats?.palette || 'bandit');
    super(`${typeId}_${Math.round(x)}_${Math.round(y)}`, x, y, palette, (stats?.look || {}) as any);
    this.kind = kind;
    this.typeId = typeId;
    this.stats = stats || CREATURES.wolf;
    const diff = difficultyMod(getGame().state.flags.difficulty || 'normal');
    this.maxHp = Math.round(this.stats.hp * diff.enemyHp);
    this.hp = this.maxHp;
    this.speed = this.stats.speed;
    this.home = { x, y };
    this.alertRadius = this.stats.aggro || 0;
    this.packId = opts.packId;
    this.loot = this.stats.loot || [];
    this.crimeOnKill = this.stats.crimeOnKill;
    this.name = kind === 'creature' ? t('bestiary.' + (typeId === 'wildKnight' ? 'knight' : typeId)) : t('enemy.' + typeId);
    this.radius = kind === 'creature' && (typeId === 'horse' || typeId === 'boar' || typeId === 'wildKnight') ? 8 : 6;
    this.noise = kind === 'creature' ? 1.2 : 1;
    if (kind === 'knight') this.factionRep = 'wildKnights';
    if (kind === 'guard') this.factionRep = 'cityGuard';
    const job = kind === 'guard' ? 'guard' : kind === 'knight' ? 'knight' : 'bandit';
    this.look = kind === 'creature'
      ? lookOf(palette, {} as any)
      : { ...randomPasserbyLook(opts.seed ?? rng.int(1, 99999), job), ...(this.stats.look || {}) } as any;
    this.targetX = x; this.targetY = y;
    this.wanderTarget = { x, y };
  }

  update(dt: number, player: Actor, map: any, actors: Actor[]) {
    const g = getGame(), s = g.state;
    if (!this.alive) { super.update(dt); return; }
    this.attackCooldown -= dt;
    const st = this.stats;
    const dist = Math.hypot(player.x - this.x, player.y - this.y);
    const diff = difficultyMod(s.flags.difficulty || 'normal');

    /* --- percepcja --- */
    const light = g.world?.lightLevel(player.x, player.y) ?? 1;
    let sense = (st.aggro || 0) * (0.5 + light * 0.6);
    if (st.nightBold && s.time.isNight()) sense *= 1.5;
    if (s.weather.kind === 'fog') sense *= 0.6;
    if (player.action === 'sneak') sense *= 0.55;
    if (s.needs.torchLit) sense *= 1.35;
    if (s.needs.hygiene < 25) sense *= 1.15;         // psy i wilki czują krew i brud
    if (s.injuries.some(i => i.bleeding > 0)) sense *= 1.6;
    if (dist < sense && !this.aggroTarget && !st.skittish) {
      this.aggroTarget = player;
      bus.emit('enemy:aggro', { id: this.id, type: this.typeId, kind: this.kind });
      if (this.packId && st.packs) bus.emit('enemy:callPack', { packId: this.packId, x: player.x, y: player.y });
      if (this.kind === 'creature') NotesSystem.addEntry('creature', this.typeId === 'wildKnight' ? 'knight' : this.typeId);
    }
    if (st.skittish && dist < (st.aggro ? 60 : 90)) {
      this.aggroTarget = null;
      this.fleeFrom(player.x, player.y, map, actors);
      super.update(dt);
      return;
    }

    /* --- ucieczka --- */
    if (st.fleeAt > 0 && this.hp / this.maxHp < st.fleeAt) {
      this.aggroTarget = null;
      this.fleeFrom(player.x, player.y, map, actors);
      super.update(dt);
      return;
    }

    /* --- walka --- */
    if (this.aggroTarget && this.aggroTarget.alive) {
      const tx = this.aggroTarget.x, ty = this.aggroTarget.y;
      const d = Math.hypot(tx - this.x, ty - this.y);
      this.lastSeen = { x: tx, y: ty, day: s.time.day };
      if (d > (st.reach || 16) + 4) {
        const done = this.seekTo(tx, ty, map, actors);
        this.setAction(d ? 'run' : 'walk');
        this.faceTowards(tx, ty);
        if (d > this.leash && Math.hypot(this.home.x - this.x, this.home.y - this.y) > this.leash) {
          this.aggroTarget = null;   // zgubił trop poza swoim terytorium
          bus.emit('enemy:leash', { id: this.id });
        }
      } else {
        this.path = null;
        this.faceTowards(tx, ty);
        if (!this.combat.attacking && this.attackCooldown <= 0) {
          this.combat.attacking = true; this.combat.t = 0; this.combat.telegraphDone = false;
          this.setAction('attack');
          this.telegraph = 1;
        }
        if (this.combat.attacking) {
          this.combat.t += dt;
          if (!this.combat.telegraphDone && this.combat.t >= st.telegraph) {
            this.combat.telegraphDone = true;
            bus.emit('enemy:attack', { from: this, dmg: st.dmg * diff.enemyDmg, x: this.x, y: this.y, reach: st.reach, pierceArmor: st.armor, type: this.typeId, kind: this.kind });
          }
          if (this.combat.t >= st.attackTime) {
            this.combat.attacking = false;
            this.attackCooldown = rng.range(0.55, 1.35);
            this.setAction('idle');
          }
        }
      }
    } else {
      /* --- patrol / wędrówka wokół domu --- */
      this.wanderTimer -= dt;
      if (this.wanderTimer <= 0 || Math.hypot(this.wanderTarget.x - this.x, this.wanderTarget.y - this.y) < 8) {
        this.wanderTimer = rng.range(2.5, 7);
        const a = rng.range(0, Math.PI * 2), r = rng.range(20, 130);
        this.wanderTarget = { x: this.home.x + Math.cos(a) * r, y: this.home.y + Math.sin(a) * r };
      }
      const arrived = this.seekTo(this.wanderTarget.x, this.wanderTarget.y, map, actors);
      this.setAction(arrived ? 'idle' : (this.stats.guardDog ? 'walk' : 'walk'));
      if (!this.aggroTarget && this.lastSeen.day === s.time.day && Math.hypot(this.lastSeen.x - this.x, this.lastSeen.y - this.y) < 300) {
        this.seekTo(this.lastSeen.x, this.lastSeen.y, map, actors);
        this.setAction('search');
      }
    }
    super.update(dt);
  }

  fleeFrom(x: number, y: number, map: any, actors: Actor[]) {
    const dx = this.x - x, dy = this.y - y;
    const d = Math.hypot(dx, dy) || 1;
    const tx = this.x + (dx / d) * 220, ty = this.y + (dy / d) * 220;
    this.seekTo(tx, ty, map, actors);
    this.setAction('run');
  }

  /** Przyjęcie ciosu od gracza. */
  takeHit(dmg: number, opts: { vsArmor?: number; fromX?: number; fromY?: number; skill?: string } = {}) {
    const s = getGame().state;
    const diff = difficultyMod(s.flags.difficulty || 'normal');
    let real = dmg * diff.playerDmg;
    const armor = (this.stats.armor || 0) / Math.max(0.3, opts.vsArmor || 1);
    real *= 1 - Math.min(0.75, armor);
    // blok/parowanie przeciwnika
    if (this.stats.blocks && rng.chance(0.18 + SkillsSystem.level('sword') * -0.01)) real *= 0.35;
    if (this.stats.parries && rng.chance(0.1)) { real = 0; bus.emit('combat:enemyParried', { id: this.id }); }
    real = Math.max(1, Math.round(real));
    this.damage(real, opts.fromX, opts.fromY);
    if (opts.fromX !== undefined) {
      this.knockback.x += (this.x - opts.fromX) * 0.5;
      this.knockback.y += (this.y - (opts.fromY ?? this.y)) * 0.5;
    }
    this.aggroTarget = getGame().world?.player || this.aggroTarget;
    bus.emit('fx:damageNumber', { x: this.x, y: this.y - 34, amount: real, crit: real >= dmg * 1.4 });
    bus.emit('enemy:hit', { id: this.id, dmg: real, hp: this.hp });
    if (!this.alive) this.onDeath();
    return real;
  }

  onDeath() {
    const g = getGame(), s = g.state;
    s.stats.killed += 1;
    QuestSystem.notify('kill', { target: this.typeId, count: 1 });
    if (this.typeId === 'bandit_boss') QuestSystem.notify('kill', { target: 'bandit_marta', count: 1 });
    if (this.kind === 'creature') NotesSystem.addEntry('creature', this.typeId === 'wildKnight' ? 'knight' : this.typeId);
    if (this.kind === 'creature') {
      SkillsSystem.use('beasts', 20);
      bus.emit('hud:toast', { text: t('combat.killedBeast', { what: this.name }), tone: 'good' });
    } else {
      SkillsSystem.use('sword', 24);
      ReputationSystem.add((this.factionRep as any) || 'villagers', -8, 'rep.reason.killed');
      bus.emit('hud:toast', { text: t('combat.killedMan', { what: this.name }), tone: 'bad' });
      bus.emit('crime:publicAct', { type: 'murder', x: this.x, y: this.y });
    }
    if (this.typeId === 'wildKnight' || this.kind === 'knight') {
      ReputationSystem.add('wildKnights', -20, 'rep.reason.knightKilled');
      s.debt.principal += 0;   // śmierć rycerza nie kasuje długu — świat o niej pamięta
      bus.emit('rumor:seedEvent', { textKey: 'rumor.knightSlain', severity: 5 });
    }
    bus.emit('enemy:died', { id: this.id, typeId: this.typeId, kind: this.kind, x: this.x, y: this.y, loot: this.loot });
  }

  callPack(x: number, y: number) {
    this.lastSeen = { x, y, day: getGame().state.time.day };
    if (!this.aggroTarget) this.aggroTarget = getGame().world?.player || null;
  }
}

/** Rany zadane przez przeciwnika — konkretna część ciała. */
export function rollHitPart(): any {
  const parts = ['torso', 'torso', 'armL', 'armR', 'legL', 'legR', 'head'];
  return rng.pick(parts);
}

export function infectionRiskFrom(kind: string): number {
  if (kind === 'rat') return 0.35;
  if (kind === 'dog' || kind === 'wolf') return 0.18;
  return 0.05;
}

export { NeedsSystem };
