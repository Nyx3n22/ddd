import { Actor } from './Actor';
import { TILE } from '../world/TileMap';
import { bus } from '../core/EventBus';
import { rng } from '../core/RNG';
import { SkillsSystem } from '../systems/SkillsSystem';
import { getGame } from '../core/gameSingleton';
import { t } from '../core/Localization';
import { npcDef, ReputationSystem, type NpcDef } from '../systems/ReputationSystem';
import { namePool } from '../systems/ReputationSystem';
import { randomPasserbyLook, lookOf, type ActorAction } from '../render/Characters';
import { CrimeSystem } from '../systems/CrimeSystem';
import { RumorSystem } from '../systems/RumorSystem';
import { QuestSystem } from '../systems/QuestSystem';
import ENEMIES from '../data/enemies.json';

/* ============================================================================
   MIESZKAŃCY
   Każdy NPC ma imię, zawód, dom, rozkład dnia i powód, by istnieć (brief 0).
   Rozkład jest w npcs.json — kod tylko go odgrywa: o 5:00 Hanna jest w
   karczmie, o 14:00 idzie na rynek, o 23:00 śpi na piętrze.
   ========================================================================== */

export interface ScheduleEntry {
  from: number; to: number; scene: string; at: [number, number];
  activity: string; action: ActorAction; waypoints?: number[][]; patrol?: boolean; inside?: boolean;
}

export interface NpcLoot { items: Array<{ id: string; chance: number }>; gold: [number, number] }

const HUMAN_STATS = (ENEMIES as any).humans as Record<string, any>;

export class NPCActor extends Actor {
  def?: NpcDef;
  npcId: string;
  faction = 'villagers';
  dialogueRoot = 'passerby_root';
  schedule: ScheduleEntry[] = [];
  entry: ScheduleEntry | null = null;
  wpIndex = 0;
  waitTimer = 0;
  aware = 0;               // 0..1 — jak bardzo jest zaniepokojony
  alerted = false;
  fleeing = false;
  fleeTarget: { x: number; y: number } | null = null;
  activity = '';
  isPasserby = false;
  job = '';
  home = '';
  loot: NpcLoot = { items: [], gold: [0, 3] };
  combatStats: any = null;
  attackCooldown = 0;
  hostile = false;
  talking = false;
  greetCooldown = 0;
  /** czy postać może być okradziona (kieszonkowiec) */
  purse = 0;

  constructor(npcId: string, x: number, y: number, opts: { passerby?: boolean; job?: string; seed?: number } = {}) {
    const def = npcDef(npcId);
    const palette = def?.palette || (opts.passerby ? 'peasantM' : 'peasantM');
    super(npcId, x, y, palette, (def?.look as any) || {});
    this.npcId = npcId;
    this.isPasserby = !!opts.passerby;
    this.job = opts.job || def?.roleKey || '';
    this.def = def;
    if (def) {
      this.name = t(def.nameKey);
      this.faction = def.faction;
      this.dialogueRoot = def.dialogue || 'passerby_root';
      this.schedule = (def.schedule || []) as ScheduleEntry[];
      this.home = def.addressKey ? t(def.addressKey) : '';
      this.speed = def.age > 60 ? 34 : def.age < 18 ? 46 : 42;
      this.hp = this.maxHp = def.important ? 60 : 34;
      // jeden szkielet, wiele palet: wygląd nazwanych mieszkańców jest w npcs.json
      this.look = lookOf(def.palette, (def.look || {}) as any);
      this.purse = rng.int(1, 14);
      const st = HUMAN_STATS[this.combatArchetype()];
      if (st) { this.combatStats = st; this.hp = this.maxHp = st.hp; this.speed = st.speed; }
    } else {
      const pool = namePool() as any;
      const male = rng.chance(0.55);
      const first = rng.pick(male ? pool.male : pool.female);
      const last = rng.pick(pool.surnames);
      this.name = `${first} ${last}`;
      this.look = randomPasserbyLook(opts.seed ?? rng.int(1, 99999), 'passerby');
      this.hp = this.maxHp = 26;
      this.speed = rng.range(34, 46);
      this.purse = rng.int(0, 9);
      this.dialogueRoot = 'passerby_root';
      this.faction = 'villagers';
    }
  }

  combatArchetype(): string {
    const f = this.faction;
    if (f === 'cityGuard') return this.npcId === 'baltazar_kat' ? 'bandit_boss' : 'guard';
    if (f === 'wildKnights') return 'knight_squire';
    return 'drunk';
  }

  /** Wpis rozkładu na daną godzinę (obsługa okien przechodzących przez północ). */
  entryAt(hour: number): ScheduleEntry | null {
    if (!this.schedule.length) return null;
    for (const e of this.schedule) {
      if (e.from <= e.to) { if (hour >= e.from && hour < e.to) return e; }
      else { if (hour >= e.from || hour < e.to) return e; }
    }
    return this.schedule[0];
  }

  applySchedule(hour: number, scene: string) {
    const e = this.entryAt(hour);
    if (!e) { this.hidden = true; return; }
    const changed = this.entry !== e;
    this.entry = e;
    this.scene = e.scene;
    this.activity = e.activity;
    this.hidden = !!e.inside || e.scene !== scene;
    if (changed) {
      this.wpIndex = 0;
      this.path = null;
      const tx = e.at[0] * TILE + TILE / 2, ty = e.at[1] * TILE + TILE / 2;
      if (!this.hidden && Math.hypot(tx - this.x, ty - this.y) > 400) { this.x = tx; this.y = ty; } // daleka podróż: teleport „za kulisami”
    }
    if (this.hidden) return;
    const act = e.action || 'idle';
    if (!this.fleeing && !this.hostile && !this.talking) this.setAction(act === 'walk' || act === 'sneak' || act === 'carry' ? act : act);
  }

  update(dt: number, player: Actor, map: any, actors: Actor[]) {
    const g = getGame(), s = g.state;
    if (!s.alive(this.npcId) || !this.alive) { super.update(dt); return; }
    this.applySchedule(s.time.hour + s.time.minuteOfHour / 60, s.scene);
    if (this.hidden) { super.update(dt); return; }
    this.attackCooldown -= dt;
    this.greetCooldown -= dt;

    /* --- reakcje społeczne --- */
    const dist = Math.hypot(player.x - this.x, player.y - this.y);
    const sees = this.canSee(player, dist, map);
    if (sees && s.crime.wanted >= 1 && this.faction === 'cityGuard' && !this.hostile) {
      this.hostile = true;
      bus.emit('npc:alerted', { npcId: this.npcId, reason: 'wanted' });
      bus.emit('hud:toast', { text: t('npc.guardAlerted', { who: this.name }), tone: 'bad' });
    }
    this.aware = Math.max(0, this.aware - dt * 0.15);

    if (this.fleeing) {
      if (!this.fleeTarget) this.fleeTarget = { x: this.x + (this.x - player.x) * 3, y: this.y + (this.y - player.y) * 3 };
      const done = this.seekTo(this.fleeTarget.x, this.fleeTarget.y, map, actors);
      this.setAction('run');
      if (done || Math.hypot(player.x - this.x, player.y - this.y) > 420) { this.fleeing = false; this.fleeTarget = null; }
      super.update(dt);
      return;
    }

    if (this.hostile && this.combatStats) {
      this.updateCombat(dt, player, map, actors);
      super.update(dt);
      return;
    }

    /* --- rozkład dnia --- */
    const e = this.entry;
    if (e && e.waypoints && e.waypoints.length) {
      const wp = e.waypoints[this.wpIndex % e.waypoints.length];
      const tx = wp[0] * TILE + TILE / 2, ty = wp[1] * TILE + TILE / 2;
      const arrived = this.seekTo(tx, ty, map, actors);
      this.setAction(e.action || 'walk');
      if (arrived || Math.hypot(tx - this.x, ty - this.y) < 6) {
        this.wpIndex++;
        this.waitTimer = e.patrol ? 0 : rng.range(1.2, 4.5);
        this.path = null;
      }
      if (this.waitTimer > 0) {
        this.waitTimer -= dt;
        this.setAction(e.action === 'sneak' ? 'sneak' : 'idle');
      }
    } else if (e && !e.patrol) {
      // stoi w miejscu i wykonuje czynność
      const tx = e.at[0] * TILE + TILE / 2, ty = e.at[1] * TILE + TILE / 2;
      if (Math.hypot(tx - this.x, ty - this.y) > 12) { this.seekTo(tx, ty, map, actors); this.setAction('walk'); }
      else {
        this.path = null;
        this.setAction(e.action || 'idle');
        if ((e.action === 'work' || e.action === 'search') && rng.chance(dt * 0.5)) this.dir = Actor.randomDir();
      }
    } else if (!e) {
      // brak rozkładu: przechodzień krąży
      if (this.waitTimer <= 0) {
        this.waitTimer = rng.range(2, 6);
        this.targetX = this.x + rng.range(-140, 140);
        this.targetY = this.y + rng.range(-110, 110);
      } else this.waitTimer -= dt;
      const arrived = this.seekTo(this.targetX, this.targetY, map, actors);
      this.setAction(arrived ? 'idle' : 'walk');
    }
    // patrzy na Johna, gdy ten jest blisko
    if (dist < 70 && !this.combat.attackingFlag) this.faceTowards(player.x, player.y);
    super.update(dt);
  }

  combat = { attacking: false, t: 0, telegraphDone: false, attackingFlag: false };

  updateCombat(dt: number, player: Actor, map: any, actors: Actor[]) {
    const st = this.combatStats;
    const dist = Math.hypot(player.x - this.x, player.y - this.y);
    if (st.fleeAt > 0 && this.hp / this.maxHp < st.fleeAt) {
      this.hostile = false; this.fleeing = true;
      bus.emit('npc:fled', { npcId: this.npcId });
      return;
    }
    if (dist > st.reach + 6) {
      this.seekTo(player.x, player.y, map, actors);
      this.setAction('run');
      this.faceTowards(player.x, player.y);
    } else {
      this.path = null;
      this.faceTowards(player.x, player.y);
      if (!this.combat.attacking && this.attackCooldown <= 0) {
        this.combat.attacking = true; this.combat.t = 0; this.combat.telegraphDone = false;
        this.combat.attackingFlag = true;
        this.setAction('attack');
        this.telegraph = 1;
      }
      if (this.combat.attacking) {
        this.combat.t += dt;
        if (!this.combat.telegraphDone && this.combat.t >= st.telegraph) {
          this.combat.telegraphDone = true;
          bus.emit('npc:attack', { from: this, dmg: st.dmg, x: this.x, y: this.y, pierceArmor: st.armor, skill: st.skill });
        }
        if (this.combat.t >= st.attackTime) {
          this.combat.attacking = false; this.combat.attackingFlag = false;
          this.attackCooldown = rng.range(0.5, 1.2);
          this.setAction('idle');
        }
      }
    }
  }

  canSee(player: Actor, dist: number, map: any): boolean {
    const g = getGame(), s = g.state;
    if (!this.alive || this.hidden) return false;
    const light = s.scene === 'world' ? g.world?.lightLevel(player.x, player.y) ?? 1 : 1;
    let range = 190 * (0.45 + light * 0.75);
    if (player.action === 'sneak') range *= 0.6;
    if (s.weather.kind === 'fog') range *= 0.55;
    if (s.weather.kind === 'rain' || s.weather.kind === 'storm') range *= 0.8;
    if (dist > range) return false;
    // pole widzenia: musi być mniej więcej zwrócony w stronę gracza
    const dx = player.x - this.x, dy = player.y - this.y;
    const facing = this.dir === 1 ? [-1, 0] : this.dir === 2 ? [1, 0] : this.dir === 3 ? [0, -1] : [0, 1];
    const dot = (dx * facing[0] + dy * facing[1]) / (Math.hypot(dx, dy) || 1);
    return dot > -0.2;
  }

  /** Świadek czynu — reakcja zależna od frakcji i odwagi. */
  witnessCrime(crimeType: string, x: number, y: number) {
    const g = getGame(), s = g.state;
    if (!this.alive || this.hidden) return;
    const dist = Math.hypot(x - this.x, y - this.y);
    if (dist > 240) return;
    this.aware = 1;
    CrimeSystem.witness(this.npcId, crimeType, x, y);
    const stance = typeof this.def?.stance === 'number' ? this.def.stance : 0;
    if (this.faction === 'cityGuard' || this.faction === 'wildKnights' || stance <= -40) {
      if (this.combatStats) { this.hostile = true; bus.emit('npc:alerted', { npcId: this.npcId, reason: crimeType }); }
      else this.fleeing = true;
    } else if (crimeType === 'murder' || crimeType === 'assault') {
      this.fleeing = true;
      bus.emit('hud:toast', { text: t('npc.screamed', { who: this.name }), tone: 'bad' });
      RumorSystem.seed('rumor.crimeSeen', { witness: this.npcId, severity: 3 });
    } else if (rng.chance(0.4)) {
      RumorSystem.seed('rumor.crimeSeen', { witness: this.npcId, severity: 2 });
    }
    s.addLog(`witness ${this.npcId} ${crimeType}`);
  }

  /** Kieszonkowiec: próba okradzenia NPC. */
  pickPocket(): { ok: boolean; gold: number; item?: string; caught: boolean } {
    const g = getGame(), s = g.state;
    const skill = SkillsSystem.level('pickpocket');
    const chance = 0.3 + skill * 0.07 + SkillsSystem.effect('concealBonus') * 0.1 - (this.aware > 0.3 ? 0.35 : 0);
    const caught = !rng.chance(Math.max(0.05, Math.min(0.92, chance)));
    const gold = Math.min(this.purse, rng.int(1, 6 + skill * 2));
    this.purse -= gold;
    SkillsSystem.use('pickpocket', caught ? 8 : 22);
    if (caught) {
      this.aware = 1;
      this.witnessCrime('pickpocket', this.x, this.y);
      bus.emit('hud:toast', { text: t('crime.pickpocketCaught', { who: this.name }), tone: 'bad' });
      return { ok: false, gold: 0, caught: true };
    }
    s.gold += gold; s.stats.earned += gold;
    bus.emit('hud:toast', { text: t('crime.pickpocketOk', { gold }), tone: 'good' });
    return { ok: true, gold, caught: false };
  }

  die(killerIsPlayer: boolean) {
    const g = getGame(), s = g.state;
    if (!this.alive) return;
    this.alive = false;
    this.hp = 0;
    this.setAction('death');
    s.npcState[this.npcId] = { ...(s.npcState[this.npcId] || {}), alive: false, killed: s.time.day };
    if (killerIsPlayer) {
      s.stats.killed += 1;
      if (this.isPasserby || this.def) {
        CrimeSystem.witness(this.npcId, 'murder', this.x, this.y);
        ReputationSystem.add(this.faction as any, -25, 'rep.reason.murder');
        ReputationSystem.add('villagers', -12, 'rep.reason.murder');
        bus.emit('rumor:seedEvent', { textKey: 'rumor.johnKilled', severity: 5, witness: this.npcId });
      }
      QuestSystem.notify('kill', { target: this.npcId, count: 1 });
    }
    bus.emit('npc:died', { npcId: this.npcId, name: this.name, x: this.x, y: this.y, loot: this.loot, purse: this.purse });
    CrimeSystem.leaveEvidence('body', this.x, this.y, s.scene);
    s.addLog(`death ${this.npcId}`);
  }

  greet(): string { return t(this.def?.greetingKeys?.length ? rng.pick(this.def.greetingKeys) : 'npc.greeting.neutral'); }
}

function hashId(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** Tworzenie przechodniów z definicji spawnerów w district_port.json. */
export function spawnPasserby(index: number, x: number, y: number): NPCActor {
  const npc = new NPCActor(`passerby_${index}`, x, y, { passerby: true, seed: index * 7919 + 13 });
  npc.isPasserby = true;
  const pool = namePool() as any;
  const male = rng.chance(0.55);
  npc.name = `${rng.pick(male ? pool.male : pool.female)} ${rng.pick(pool.surnames)}`;
  const jobs = ['job.farmer', 'job.fisher', 'job.porter', 'job.weaver', 'job.mason', 'job.servant', 'job.peddler', 'job.shepherd'];
  npc.job = rng.pick(jobs);
  npc.look = randomPasserbyLook(index * 104729 + 7, index % 7 === 0 ? 'guard' : 'passerby');
  npc.hp = npc.maxHp = rng.int(22, 34);
  npc.speed = rng.range(32, 46);
  npc.purse = rng.int(0, 8);
  return npc;
}
