import { Actor } from './Actor';
import { TILE } from '../world/TileMap';
import { bus } from '../core/EventBus';
import { rng } from '../core/RNG';
import { getGame } from '../core/gameSingleton';
import { t } from '../core/Localization';
import { InventorySystem, itemDef } from '../systems/InventorySystem';
import { SkillsSystem } from '../systems/SkillsSystem';
import { NeedsSystem } from '../systems/NeedsSystem';
import { CrimeSystem } from '../systems/CrimeSystem';
import { NotesSystem } from '../systems/NotesSystem';
import { QuestSystem } from '../systems/QuestSystem';
import type { Dir } from '../render/Characters';

/* ============================================================================
   JOHN — postać gracza
   Ośmiokierunkowy ruch, skradanie, bieg, unik/przeskok (Space — nie skok!),
   kierunkowy atak lewym przyciskiem, blok i okno parowania prawym.
   Każda akcja ma koszt: stamina, hałas, świadkowie.
   ========================================================================== */

export interface PlayerCombatState {
  attacking: boolean; attackT: number; attackDir: Dir; attackArc: number; attackReach: number;
  blocking: boolean; blockT: number; parryWindow: number; parried: boolean; riposteReady: number;
  dodging: boolean; dodgeT: number; dodgeDx: number; dodgeDy: number; invuln: number;
  comboT: number; combo: number; hitCooldown: number; swingDone: boolean;
}

export class Player extends Actor {
  stamina = 100;
  moveInput = { x: 0, y: 0 };
  sneak = false;
  run = false;
  mouse = { x: 0, y: 0 };      // pozycja kursora w świecie
  combat: PlayerCombatState = {
    attacking: false, attackT: 0, attackDir: 0, attackArc: 1, attackReach: 26,
    blocking: false, blockT: 0, parryWindow: 0.22, parried: false, riposteReady: 0,
    dodging: false, dodgeT: 0, dodgeDx: 0, dodgeDy: 0, invuln: 0,
    comboT: 0, combo: 0, hitCooldown: 0, swingDone: false
  };
  interactTarget: { id: string; nameKey: string; kind: string; prompt: string } | null = null;
  carryTarget: { id: string; nameKey: string } | null = null;
  carrying: string | null = null;
  stepTimer = 0;
  lastRegion = '';
  breathTimer = 0;

  constructor() {
    super('john', 2016, 3260, 'john', { weapon: 'sword', cloak: true, beard: false, bulk: 1, height: 0 });
    this.speed = 52;
    this.hp = 100; this.maxHp = 100;
    this.name = 'John';
  }

  get weaponDef() { return InventorySystem.equippedDef('weapon'); }
  get offhandDef() { return InventorySystem.equippedDef('offhand'); }
  get bodyDef() { return InventorySystem.equippedDef('body'); }

  syncFromState() {
    const g = getGame(), s = g.state;
    this.hp = s.needs.health; this.maxHp = s.needs.maxHealth;
    this.stamina = s.needs.stamina;
    this.alive = !s.needs.dead;
    const w = this.weaponDef;
    this.look.weapon = w ? (w.tags.includes('bow') ? 'bow' : w.tags.includes('blunt') || w.weapon?.skill === 'blunt' ? 'hammer' : w.weapon?.skill === 'axe' ? 'axe' : w.weapon?.reach && w.weapon.reach < 18 ? 'dagger' : 'sword') : 'none';
    const off = this.offhandDef;
    this.look.offhand = off ? (off.tags.includes('shield') ? 'shield' : off.tags.includes('light') ? 'torch' : 'none') : (s.needs.torchLit ? 'torch' : 'none');
    this.look.cloak = !!s.inventory.equipped.body && (itemDef(s.inventory.equipped.body!)?.tags.includes('warm') || true);
    this.look.helmet = s.inventory.equipped.head ? 'kettle' : 'none';
    this.wet = s.weather.kind === 'rain' || s.weather.kind === 'storm';
    const pen = NeedsSystem.penalties();
    this.speed = 52 * (1 - pen.speed) * (this.sneak ? 0.55 : 1) * (this.run && this.stamina > 5 ? 1.45 : 1) * (1 - (InventorySystem.overEncumbered() ? 0.25 : 0));
    this.noise = 1 + pen.carry * 0.2;
  }

  update(dt: number, input: {
    mx: number; my: number; sneakHeld: boolean; runHeld: boolean;
    attackPressed: boolean; blockHeld: boolean; dodgePressed: boolean;
    mouseWorld: { x: number; y: number };
  }) {
    const g = getGame(), s = g.state;
    this.syncFromState();
    const c = this.combat;
    const pen = NeedsSystem.penalties();
    const stunned = s.time.paused || s.needs.dead || c.dodging;

    this.sneak = input.sneakHeld && !this.run;
    this.run = input.runHeld && !this.sneak && this.stamina > 6 && (input.mx !== 0 || input.my !== 0);
    this.mouse = input.mouseWorld;

    /* --- unik / przeskok (Space) --- */
    if (input.dodgePressed && !c.dodging && this.stamina >= 18 && !stunned) {
      const dirx = input.mx || (this.dir === 1 ? -1 : this.dir === 2 ? 1 : 0);
      const diry = input.my || (this.dir === 0 ? 1 : this.dir === 3 ? -1 : 0);
      const len = Math.hypot(dirx, diry) || 1;
      c.dodging = true; c.dodgeT = 0.26;
      c.dodgeDx = (dirx / len) * 150; c.dodgeDy = (diry / len) * 150;
      c.invuln = 0.24;
      this.stamina -= 18;
      s.stats.dodges += 1;
      SkillsSystem.use('endurance', 5, true);
      bus.emit('player:dodge', { x: this.x, y: this.y });
      // przeskok przez niską przeszkodę: jeśli przed nami obiekt grabbable/niski — przeskocz
      const map = g.world?.scene?.tilemap;
      if (map) {
        const ahead = map.groundAtPx(this.x + c.dodgeDx * 0.2, this.y + c.dodgeDy * 0.2);
        if (ahead === 'water' || ahead === 'grassTall') bus.emit('fx:vault', { x: this.x, y: this.y });
      }
    }
    if (c.dodging) {
      c.dodgeT -= dt; c.invuln -= dt;
      const map = g.world?.scene?.tilemap;
      if (map) this.move(c.dodgeDx * dt, c.dodgeDy * dt, map, g.world?.actors || []);
      c.dodgeDx *= 0.9; c.dodgeDy *= 0.9;
      this.setAction('sneak');
      if (c.dodgeT <= 0) { c.dodging = false; c.invuln = Math.max(0, c.invuln); }
    }

    /* --- ruch --- */
    if (!stunned) {
      const map = g.world?.scene?.tilemap;
      let mx = input.mx, my = input.my;
      const len = Math.hypot(mx, my);
      if (len > 1) { mx /= len; my /= len; }
      this.moveInput = { x: mx, y: my };
      if (map && (mx !== 0 || my !== 0) && !c.attacking) {
        const spd = this.speed * (1 - pen.speed * 0.4);
        const res = this.move(mx * spd * dt, my * spd * dt, map, g.world?.actors || []);
        // kierunek ruchu (8-dir → 4-dir sprite + płynne odwracanie)
        if (Math.abs(mx) > Math.abs(my) * 1.6) this.dir = mx < 0 ? 1 : 2;
        else if (Math.abs(my) > Math.abs(mx) * 1.6) this.dir = my < 0 ? 3 : 0;
        else if (my !== 0) this.dir = my < 0 ? 3 : 0;
        this.setAction(this.sneak ? 'sneak' : this.run ? 'run' : 'walk');
        s.stats.walked += spd * dt;
        // hałas kroków → wykrycie
        this.stepTimer -= dt * (this.run ? 2.2 : this.sneak ? 0.6 : 1.2);
        if (this.stepTimer <= 0) {
          this.stepTimer = 0.42;
          const ground = map.groundAtPx(this.x, this.y);
          const noise = this.noiseLevel(this.action, ground, this.sneak) * (1 + SkillsSystem.effect('noiseMul'));
          bus.emit('player:step', { x: this.x, y: this.y, noise, ground, sneaking: this.sneak });
          s.flags.inSwamp = ground === 'swamp';
          if (ground === 'swamp' || ground === 'mud') NeedsSystem.exposureCheck(0, ground === 'swamp', false);
          if (ground === 'water' && rng.chance(0.02)) NotesSystem.soak(0.06);
        }
        if (res.hitX || res.hitY) bus.emit('player:bump', { x: this.x, y: this.y });
      } else if (!c.attacking) {
        this.setAction(c.blocking ? 'block' : this.carrying ? 'carry' : 'idle');
      }
    }

    /* --- blok i parowanie --- */
    c.blocking = input.blockHeld && !c.dodging && !stunned && !c.attacking;
    if (c.blocking) {
      c.blockT += dt;
      this.setAction('block');
      const shield = this.offhandDef?.armor?.block || 0;
      this.stamina = Math.max(0, this.stamina - (4 + shield * 1.5) * dt);
      c.parryWindow = Math.max(0.1, (this.weaponDef?.weapon?.parryWindow || 0.18) + SkillsSystem.effect('parryWindow'));
      if (c.blockT < c.parryWindow && !c.parried) c.parryWindow = c.parryWindow; // okno liczone od rozpoczęcia bloku
    } else { c.blockT = 0; c.parried = false; }
    if (c.riposteReady > 0) c.riposteReady -= dt;
    if (c.hitCooldown > 0) c.hitCooldown -= dt;
    if (c.comboT > 0) { c.comboT -= dt; if (c.comboT <= 0) c.combo = 0; }

    /* --- atak --- */
    if (input.attackPressed && !c.attacking && !stunned && !c.blocking) this.startAttack();
    if (c.attacking) {
      c.attackT += dt;
      this.setAction('attack');
      const speed = this.weaponDef?.weapon?.speed || 1;
      const dur = 0.42 / speed * (1 - pen.aim * 0.2);
      // moment trafienia w połowie zamachu
      if (!c.swingDone && c.attackT >= dur * 0.45) {
        c.swingDone = true;
        bus.emit('player:swing', {
          x: this.x, y: this.y, dir: c.attackDir, arc: c.attackArc, reach: c.attackReach,
          dmg: this.attackDamage(), weaponSkill: this.weaponDef?.weapon?.skill || 'brawl',
          vsArmor: this.weaponDef?.weapon?.vsArmor || 1, combo: c.combo
        });
      }
      if (c.attackT >= dur) { c.attacking = false; c.attackT = 0; c.swingDone = false; }
    }

    /* --- stamina i potrzeby --- */
    if (!c.blocking && !this.run && !c.attacking && !c.dodging) this.stamina = Math.min(this.maxStamina(), this.stamina + 16 * dt);
    s.needs.stamina = this.stamina;
    s.needs.health = this.hp;

    /* --- interakcja: szukamy najbliższego obiektu/aktora --- */
    this.updateInteractables();

    /* --- region i odkrywanie mapy --- */
    const region = g.world?.scene?.regionAt(this.tx, this.ty);
    if (region && region.nameKey !== this.lastRegion) {
      this.lastRegion = region.nameKey;
      bus.emit('world:region', { nameKey: region.nameKey });
      QuestSystem.notify('area', { region: region.nameKey, night: s.time.isNight() });
      // wpis w notatniku tylko wtedy, gdy dzielnica ma swój opis w bestiarium
      if (region.noteId) NotesSystem.addEntry('place', region.noteId);
    }
    NotesSystem.discover(this.tx, this.ty, this.sneak ? 7 : 10, g.world?.scene?.id || 'port_dolne_miasto');

    super.update(dt);
    if (this.action === 'hit' && this.hurtFlash <= 0) this.setAction('idle');
  }

  maxStamina() { return getGame().state.needs.maxStamina; }

  attackDamage(): number {
    const w = this.weaponDef;
    const pen = NeedsSystem.penalties();
    let dmg = w?.weapon?.dmg || 6;                     // pięści
    const skill = w?.weapon?.skill || 'brawl';
    dmg *= 1 + (SkillsSystem.level(skill) - 1) * 0.07;
    dmg *= 1 - pen.aim * 0.5;
    if (this.combat.combo >= 2) dmg *= 1.12;
    if (this.combat.riposteReady > 0 && SkillsSystem.hasPerk('riposte')) dmg *= 1.8;
    if (getGame().state.flags.drunk) dmg *= 1.1 - getGame().state.flags.drunk * 0.2;
    if ((w as any)?.quality !== undefined) dmg *= 0.85 + (w as any).quality * 0.3;
    return Math.max(1, Math.round(dmg * rng.range(0.85, 1.15)));
  }

  startAttack() {
    const g = getGame(), s = g.state;
    const c = this.combat;
    const w = this.weaponDef;
    const cost = (w?.weapon?.stam || 10) * (1 + NeedsSystem.penalties().carry * 0.3);
    if (this.stamina < cost) { bus.emit('hud:toast', { text: t('combat.tired'), tone: 'bad' }); return; }
    this.stamina -= cost;
    // kierunek z kursora (mysz) — atak jest kierunkowy, nie „w stronę ruchu”
    const dx = this.mouse.x - this.x, dy = this.mouse.y - this.y;
    if (this.mouse.x === 0 && this.mouse.y === 0) c.attackDir = this.dir;
    else if (Math.abs(dx) > Math.abs(dy)) c.attackDir = dx < 0 ? 1 : 2;
    else c.attackDir = dy < 0 ? 3 : 0;
    this.dir = c.attackDir;
    c.attacking = true; c.attackT = 0; c.swingDone = false;
    c.attackArc = w?.weapon?.arc || 1.0;
    c.attackReach = w?.weapon?.reach || 20;
    c.combo = Math.min(3, c.combo + 1); c.comboT = 0.9;
    s.time.paused = false;
    bus.emit('player:attack', { dir: c.attackDir, weapon: w?.id || 'fists' });
    // atak w miejscu publicznym jest widziany
    bus.emit('crime:publicAct', { type: this.isWeaponDrawnPublicly() ? 'assault' : null, x: this.x, y: this.y });
    SkillsSystem.use(w?.weapon?.skill || 'brawl', 4, true);
  }

  isWeaponDrawnPublicly(): boolean {
    const g = getGame();
    const nearby = (g.world?.actors || []).filter(a => a !== this && a.alive && !a.hidden && Math.hypot(a.x - this.x, a.y - this.y) < 160);
    return nearby.length > 0;
  }

  /** Otrzymanie ciosu — blok, parowanie albo rana. */
  receiveHit(amount: number, fromX: number, fromY: number, opts: { pierceArmor?: number; part?: any; unblockable?: boolean } = {}) {
    const g = getGame(), s = g.state;
    const c = this.combat;
    if (c.invuln > 0 || c.dodging) { bus.emit('combat:dodged', { amount }); SkillsSystem.use('endurance', 8); return; }
    this.faceTowards(fromX, fromY);
    let dmg = amount;
    // parowanie: blok rozpoczęty w oknie czasowym
    if (c.blocking && !opts.unblockable && c.blockT <= c.parryWindow) {
      c.parried = true; c.riposteReady = 1.4; c.blockT = 0;
      s.stats.parries += 1;
      SkillsSystem.use('parry', 26);
      bus.emit('combat:parried', { x: this.x, y: this.y, riposte: SkillsSystem.hasPerk('riposte') });
      bus.emit('hud:toast', { text: t('combat.parried'), tone: 'good' });
      bus.emit('fx:parry', { x: this.x, y: this.y });
      return;
    }
    if (c.blocking && !opts.unblockable) {
      const shield = this.offhandDef?.armor?.block || 0;
      const reduction = 0.45 + shield * 0.35 + SkillsSystem.level('parry') * 0.02;
      dmg *= Math.max(0.12, 1 - reduction);
      this.stamina = Math.max(0, this.stamina - amount * 0.9);
      if (this.stamina <= 0) { c.blocking = false; bus.emit('combat:guardBroken', {}); bus.emit('hud:toast', { text: t('combat.guardBroken'), tone: 'bad' }); dmg *= 1.4; }
      SkillsSystem.use('parry', 8);
    } else {
      dmg *= 1 - NeedsSystem.mitigation(opts.part);
      if (opts.pierceArmor) dmg *= 1 + opts.pierceArmor;
    }
    dmg = Math.max(1, Math.round(dmg));
    this.hp -= dmg;
    this.hurtFlash = 0.25;
    this.setAction('hit');
    this.knockback.x += (this.x - fromX) * 0.35; this.knockback.y += (this.y - fromY) * 0.35;
    s.needs.health = this.hp;
    bus.emit('player:hit', { amount: dmg, fromX, fromY });
    bus.emit('fx:damageNumber', { x: this.x, y: this.y - 34, amount: dmg, crit: false, self: true });
    // rany: ciężkie ciosy ranią konkretną część ciała
    if (dmg >= 12 && rng.chance(0.45)) {
      const parts: any[] = ['torso', 'armL', 'armR', 'legL', 'legR', 'head'];
      const part = opts.part || rng.pick(parts);
      const type = rng.chance(0.5) ? 'cut' : 'bruise';
      NeedsSystem.injure(part, type, Math.min(1, dmg / 34), dmg >= 18 ? rng.range(0.05, 0.2) : 0);
      CrimeSystem.leaveEvidence('blood', this.x, this.y, s.scene);
    }
    if (this.hp <= 0) { this.hp = 0; s.needs.health = 0; NeedsSystem.die('combat'); }
  }

  updateInteractables() {
    const g = getGame();
    const scene = g.world?.scene;
    this.interactTarget = null; this.carryTarget = null;
    if (!scene) return;
    const near = scene.near(this.x, this.y, 34, ['station', 'exit', 'door', 'gate', 'prop', 'building', 'marker']);
    let best = Infinity;
    for (const o of near) {
      if (o.hidden) continue;
      const d = Math.hypot(o.x - this.x, o.y - this.y);
      if (d > best) continue;
      // interakcja tylko dla obiektów z identyfikatorem interakcji
      if (!o.interactId && o.kind !== 'exit' && o.kind !== 'door' && o.kind !== 'gate' && o.kind !== 'station' && !(o.grabbable)) continue;
      best = d;
      const nameKey = o.nameKey || `prop.${o.type}`;
      this.interactTarget = {
        id: o.interactId || o.id, nameKey, kind: o.kind,
        prompt: o.kind === 'exit' ? t('prompt.enter', { what: t(nameKey) })
          : o.kind === 'door' ? t('prompt.door', { what: t(nameKey) })
          : o.kind === 'gate' ? t('prompt.gate', { what: t(nameKey) })
          : o.kind === 'station' ? t('prompt.station', { what: t(nameKey) })
          : t('prompt.use', { what: t(nameKey) })
      };
      if (o.grabbable) this.carryTarget = { id: o.id, nameKey };
    }
    // aktorzy: rozmowa
    const actors = (g.world?.actors || []).filter(a => a !== this && a.alive && !a.hidden && Math.hypot(a.x - this.x, a.y - this.y) < 30);
    if (actors.length) {
      const a = actors.sort((p, q) => Math.hypot(p.x - this.x, p.y - this.y) - Math.hypot(q.x - this.x, q.y - this.y))[0];
      const d = Math.hypot(a.x - this.x, a.y - this.y);
      if (d < best) {
        this.interactTarget = { id: a.id, nameKey: a.name || 'npc.stranger', kind: 'npc', prompt: t('prompt.talk', { who: a.name || t('npc.stranger') }) };
        this.carryTarget = null;
      }
    }
    bus.emit('player:prompt', { target: this.interactTarget, carry: this.carryTarget });
  }

  /** Podniesienie / odłożenie ciężkiego przedmiotu (F). */
  toggleCarry(objId?: string) {
    const g = getGame();
    if (this.carrying) {
      bus.emit('world:putDown', { id: this.carrying, x: this.x + Math.cos(this.dir === 2 ? 0 : this.dir === 1 ? Math.PI : this.dir === 0 ? Math.PI / 2 : -Math.PI / 2) * 14, y: this.y + 8 });
      this.carrying = null;
      this.setAction('idle');
      bus.emit('hud:toast', { text: t('carry.putDown') });
      return;
    }
    const id = objId || this.carryTarget?.id;
    if (!id) return;
    const obj = g.world?.scene?.byId(id);
    if (!obj || !obj.grabbable) { bus.emit('hud:toast', { text: t('carry.cant'), tone: 'bad' }); return; }
    if (NeedsSystem.penalties().carry > 0.6) { bus.emit('hud:toast', { text: t('carry.tooHurt'), tone: 'bad' }); return; }
    this.carrying = id;
    obj.hidden = true;
    this.setAction('carry');
    SkillsSystem.use('endurance', 8);
    bus.emit('hud:toast', { text: t('carry.pickedUp', { what: t(obj.nameKey || 'prop.' + obj.type) }) });
    bus.emit('world:carrying', { id });
  }

  tileAt() { return getGame().world?.scene?.tilemap.groundAtPx(this.x, this.y) || 'grass'; }

  worldToScreenTile() { return { tx: Math.floor(this.x / TILE), ty: Math.floor(this.y / TILE) }; }
}
