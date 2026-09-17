import { TILE } from './TileMap';
import { Scene, type SceneObject } from './Scene';
import { loadDistrict, applyGateState, type LoadedWorld } from './Loaders';
import { Actor } from '../entities/Actor';
import { Player } from '../entities/Player';
import { NPCActor, spawnPasserby } from '../entities/NPCActor';
import { EnemyActor } from '../entities/EnemyActor';
import { bus } from '../core/EventBus';
import { rng } from '../core/RNG';
import { getGame } from '../core/gameSingleton';
import { t } from '../core/Localization';
import { npcDef, allNpcDefs, ReputationSystem } from '../systems/ReputationSystem';
import { InventorySystem, itemDef, itemName } from '../systems/InventorySystem';
import { SkillsSystem } from '../systems/SkillsSystem';
import { NeedsSystem } from '../systems/NeedsSystem';
import { CrimeSystem } from '../systems/CrimeSystem';
import { QuestSystem } from '../systems/QuestSystem';
import { RumorSystem } from '../systems/RumorSystem';
import { NotesSystem } from '../systems/NotesSystem';
import { DialogueSystem } from '../systems/DialogueSystem';
import { EconomySystem, merchantAtStation } from '../systems/EconomySystem';
import { WeatherSystem } from '../systems/WeatherSystem';
import { DebtSystem } from '../systems/DebtSystem';
import { CraftingSystem } from '../systems/CraftingSystem';
import { GamblingSystem } from '../systems/GamblingSystem';

/* ============================================================================
   ŚWIAT
   Zarządza scenami (dzielnica + wnętrza), aktorami, interakcjami, walką,
   upływem dni i stanem dynamicznym zapisywanym do sejwu.
   ========================================================================== */

export interface GroundItem { id: string; x: number; y: number; qty: number; obj: SceneObject; stolen?: boolean }

export interface WorldDynamic {
  scene: string;
  player: { x: number; y: number; dir: number };
  doors: Record<string, boolean>;
  gates: Record<string, boolean>;
  containers: Record<string, string[]>;
  ground: Array<{ scene: string; id: string; x: number; y: number; qty: number; stolen?: boolean }>;
  npcs: Record<string, { x: number; y: number; alive: boolean }>;
  enemies: Array<{ typeId: string; kind: any; x: number; y: number; hp: number; alive: boolean; scene: string }>;
  rngSeed: number;
}

export class World {
  loaded!: LoadedWorld;
  district!: Scene;
  interiors = new Map<string, Scene>();
  scene!: Scene;
  player = new Player();
  actors: Actor[] = [];
  npcs: NPCActor[] = [];
  enemies: EnemyActor[] = [];
  groundItems: GroundItem[] = [];
  containers: Record<string, string[]> = {};
  doors: Record<string, boolean> = {};
  gates: Record<string, boolean> = {};
  fade = 0;
  transitioning = false;
  private boundEvents = false;

  init(fromSave?: WorldDynamic) {
    this.loaded = loadDistrict();
    this.district = this.loaded.district;
    this.interiors = this.loaded.interiors;
    const g = getGame(), s = g.state;
    if (fromSave) {
      rng.deserialize(fromSave.rngSeed);
      this.doors = fromSave.doors || {};
      this.gates = fromSave.gates || {};
      this.containers = fromSave.containers || {};
    }
    // stan początkowy bram
    for (const [id, obj] of this.loaded.gates) {
      const open = fromSave?.gates?.[id] ?? this.gateDefaultOpen(id);
      this.gates[id] = open;
      applyGateState(this.district, obj, open);
    }
    for (const [id, open] of Object.entries(this.doors)) {
      const d = this.district.byInteract('door:' + id) || this.district.byId(id);
      if (d) d.data = { ...(d.data || {}), open };
    }
    this.setActiveScene(fromSave?.scene || s.scene || 'world', true);
    // (0,0) w stanie oznacza „John jeszcze nie został postawiony w świecie” —
    // wtedy bierzemy punkt wejścia z danych dzielnicy (keja, po zejściu ze statku).
    const placed = (s.playerPos.x > 0 && s.playerPos.y > 0) ? s.playerPos : null;
    const sv = fromSave?.player ?? null;
    this.player.x = sv?.x ?? placed?.x ?? this.loaded.spawn.x;
    this.player.y = sv?.y ?? placed?.y ?? this.loaded.spawn.y;
    this.player.dir = (sv?.dir ?? placed?.dir ?? this.loaded.spawn.dir ?? 3) as any;
    this.spawnAll(fromSave);
    if (fromSave?.ground) for (const gi of fromSave.ground) this.addGroundItem(gi.id, gi.x, gi.y, gi.qty, gi.scene, gi.stolen);
    if (!this.boundEvents) { this.bindEvents(); this.boundEvents = true; }
  }

  gateDefaultOpen(id: string): boolean {
    const s = getGame().state;
    if (id === 'gate_customs') return s.time.hour >= 6 && s.time.hour < 21;
    if (id === 'gate_north') return false;
    return true;
  }

  setActiveScene(id: string, silent = false) {
    const s = getGame().state;
    const target = id === 'world' ? this.district : this.interiors.get(id);
    if (!target) { console.warn('[world] brak sceny', id); return; }
    this.scene = target;
    s.scene = id;
    // aktorzy należący do tej sceny
    for (const a of this.actors) a.hidden = a.scene !== id;
    this.player.hidden = false;
    this.player.scene = id;
    for (const e of this.enemies) e.hidden = e.scene !== id;
    if (!silent) {
      bus.emit('world:sceneChanged', { id, name: t(target.nameKey) });
      bus.emit('hud:place', { nameKey: target.nameKey });
    } else bus.emit('hud:place', { nameKey: target.nameKey });
    this.refreshNPCVisibility();
  }

  refreshNPCVisibility() {
    const s = getGame().state;
    for (const n of this.npcs) {
      const st = s.npcState[n.npcId];
      if (st && st.alive === false) { n.alive = false; n.hidden = false; n.setAction('death'); continue; }
      n.applySchedule(s.time.hour + s.time.minuteOfHour / 60, s.scene);
      if (st?.x !== undefined && st.scene === s.scene) { n.x = st.x; n.y = st.y!; }
    }
  }

  spawnAll(fromSave?: WorldDynamic) {
    const s = getGame().state;
    this.actors = []; this.npcs = []; this.enemies = [];
    this.actors.push(this.player);
    // nazwani mieszkańcy
    for (const def of allNpcDefs()) {
      if (s.npcState[def.id]?.alive === false) {
        // ciało zostaje w świecie przez kilka dni
        const st = s.npcState[def.id];
        const n = new NPCActor(def.id, st?.x ?? 2000, st?.y ?? 2000);
        n.alive = false; n.hp = 0; n.setAction('death');
        n.scene = st?.scene || 'world';
        n.hidden = n.scene !== s.scene;
        this.npcs.push(n); this.actors.push(n);
        continue;
      }
      const e = def.schedule?.[0];
      const at = e?.at || [60, 44];
      const n = new NPCActor(def.id, at[0] * TILE + TILE / 2, at[1] * TILE + TILE / 2);
      n.scene = e?.scene || 'world';
      n.applySchedule(s.time.hour, n.scene);
      this.npcs.push(n); this.actors.push(n);
    }
    // przechodnie ze spawnerów
    const sp = this.loaded.spawners;
    if (sp.passerby) {
      const areas = sp.passerby.areas as number[][];
      for (let i = 0; i < sp.passerby.count; i++) {
        const a = areas[i % areas.length];
        const tx = rng.int(a[0], a[0] + a[2]), ty = rng.int(a[1], a[1] + a[3]);
        const free = this.district.tilemap.nearestFree(tx, ty, 4);
        if (!free) continue;
        const n = spawnPasserby(i, free.x, free.y);
        n.scene = 'world';
        this.npcs.push(n); this.actors.push(n);
      }
    }
    // straż, bandyci, patrole rycerskie
    const spawnGroup = (points: number[][], typeIds: string[], kind: any, sceneId = 'world') => {
      for (let i = 0; i < points.length; i++) {
        const [tx, ty] = points[i];
        const typeId = typeIds[i % typeIds.length];
        const free = this.district.tilemap.nearestFree(tx, ty, 3);
        const e = new EnemyActor(typeId, kind, free ? free.x : tx * TILE, free ? free.y : ty * TILE, { seed: i * 31 + 7 });
        e.scene = sceneId;
        this.enemies.push(e); this.actors.push(e);
      }
    };
    if (sp.guards) spawnGroup(sp.guards.points as number[][], ['guard'], 'guard');
    if (sp.bandits) spawnGroup(sp.bandits.points as number[][], ['bandit_weak', 'bandit', 'bandit_boss'], 'bandit');
    if (sp.knightPatrol) spawnGroup(sp.knightPatrol.points as number[][], ['knight_squire'], 'knight');
    // zwierzęta na obrzeżach: wilki w nocy, psy, szczury w zaułkach
    const creatureSpots: Array<[string, number, number, string]> = [
      ['dog', 88, 44, 'yard'], ['dog', 34, 62, 'market'],
      ['rat', 12, 58, 'alley'], ['rat', 118, 50, 'tannery'], ['rat', 66, 88, 'pier'],
      ['crow', 74, 30, 'gallows'], ['crow', 62, 20, 'gate'], ['crow', 20, 70, 'swamp'],
      ['goose', 96, 74, 'water'], ['horse', 104, 40, 'stable']
    ];
    for (const [typeId, tx, ty] of creatureSpots) {
      const free = this.district.tilemap.nearestFree(tx, ty, 3);
      const e = new EnemyActor(typeId, 'creature', free ? free.x : tx * TILE, free ? free.y : ty * TILE, { seed: tx * 977 + ty });
      e.scene = 'world';
      this.enemies.push(e); this.actors.push(e);
    }
    // wilki przychodzą nocą z bagien
    this.rollNightPredators();
    if (fromSave?.enemies) {
      for (const se of fromSave.enemies) {
        const e = new EnemyActor(se.typeId, se.kind, se.x, se.y, { seed: Math.round(se.x + se.y) });
        e.hp = se.hp; e.alive = se.alive; e.scene = se.scene;
        if (!se.alive) e.setAction('death');
        e.hidden = e.scene !== getGame().state.scene;
        this.enemies.push(e); this.actors.push(e);
      }
    }
    for (const e of this.enemies) e.hidden = e.scene !== getGame().state.scene;
  }

  rollNightPredators() {
    const s = getGame().state;
    if (!s.time.isNight()) return;
    const count = s.weather.kind === 'fog' ? 4 : 2;
    for (let i = 0; i < count; i++) {
      const spots: Array<[number, number]> = [[8, 56], [130, 66], [112, 46], [20, 84]];
      const [tx, ty] = spots[i % spots.length];
      const free = this.district.tilemap.nearestFree(tx, ty, 4);
      const e = new EnemyActor('wolf', 'creature', free ? free.x : tx * TILE, free ? free.y : ty * TILE, { packId: 'nightpack', seed: i * 131 + s.time.day });
      e.scene = 'world';
      e.hidden = s.scene !== 'world';
      this.enemies.push(e); this.actors.push(e);
    }
    bus.emit('hud:toast', { text: t('world.wolvesNight') });
  }

  /* ---------------- pętla ---------------- */

  update(dt: number, input: any) {
    const g = getGame(), s = g.state;
    if (!this.scene) return;
    if (!s.time.paused) this.player.update(dt, input);
    else this.player.update(0, { mx: 0, my: 0, sneakHeld: false, runHeld: false, attackPressed: false, blockHeld: false, dodgePressed: false, mouseWorld: this.player.mouse });
    const map = this.scene.tilemap;
    const living = this.actors.filter(a => a.alive && !a.hidden);
    for (const n of this.npcs) {
      if (n.hidden || !n.alive) { n.update(0, this.player, map, living); continue; }
      n.talking = DialogueSystem.session?.npcId === n.npcId;
      n.update(dt, this.player, map, living);
    }
    for (const e of this.enemies) {
      if (e.hidden || !e.alive) { e.update(0, this.player, map, living); continue; }
      e.update(dt, this.player, map, living);
    }
    // zapis pozycji gracza w stanie
    s.playerPos = { x: Math.round(this.player.x), y: Math.round(this.player.y), dir: this.player.dir };
  }

  lightLevel(x: number, y: number): number {
    const s = getGame().state;
    const darkness = s.scene === 'world' ? s.time.darkness() : 1 - this.scene.interiorAmbient;
    const lamp = this.scene.lightLevelAt(x, y, darkness);
    const torch = s.needs.torchLit && Math.hypot(this.player.x - x, this.player.y - y) < 90 ? 0.45 : 0;
    return Math.max(0, Math.min(1, lamp + torch));
  }

  /* ---------------- interakcja (E) ---------------- */

  interact() {
    const g = getGame(), s = g.state;
    const p = this.player;
    // 1) człowiek
    const near = this.actors.filter(a => a !== p && a.alive && !a.hidden && Math.hypot(a.x - p.x, a.y - p.y) < 30);
    if (near.length) {
      const a = near.sort((x, y) => Math.hypot(x.x - p.x, x.y - p.y) - Math.hypot(y.x - p.x, y.y - p.y))[0];
      if (a instanceof NPCActor) {
        p.faceTowards(a.x, a.y);
        a.faceTowards(p.x, p.y);
        a.talking = true;
        DialogueSystem.open(a.npcId);
        QuestSystem.notify('talk', { npcId: a.npcId });
        SkillsSystem.use('persuade', 4, true);
        return;
      }
      if (a instanceof EnemyActor) {
        // rozmowa z wrogiem = prowokacja
        bus.emit('hud:toast', { text: t('interact.hostile', { what: a.name }), tone: 'bad' });
        return;
      }
    }
    // 2) obiekt sceny
    const t2 = p.interactTarget;
    if (!t2) { bus.emit('hud:toast', { text: t('interact.nothing') }); return; }
    const obj = this.scene.byInteract(t2.id) || this.scene.byId(t2.id) || this.findNearbyObject(t2.id);
    if (!obj) { bus.emit('hud:toast', { text: t('interact.nothing') }); return; }
    p.faceTowards(obj.x, obj.y);
    this.useObject(obj);
  }

  findNearbyObject(interactId: string): SceneObject | undefined {
    return this.scene.near(this.player.x, this.player.y, 44).find(o => o.interactId === interactId || o.id === interactId);
  }

  useObject(obj: SceneObject) {
    const g = getGame(), s = g.state;
    const id = obj.interactId || '';
    if (obj.kind === 'exit') {
      const to = obj.data?.to || 'world';
      this.travel(to, obj.data?.spawnX, obj.data?.spawnY);
      return;
    }
    if (obj.kind === 'door') {
      const interior = id.split(':')[1];
      if (obj.data?.locked && !s.flags['unlocked_' + interior]) {
        // konsekwencja, nie blokada: można wyważyć, wyłamać zamek albo poszukać klucza
        if (InventorySystem.has('lockpick_set') && SkillsSystem.level('lockpick') >= 2) {
          bus.emit('ui:confirm', {
            text: t('interact.lockpick', { what: t(obj.nameKey || 'prop.door') }),
            onYes: () => this.pickLock(interior, obj)
          });
          return;
        }
        bus.emit('hud:toast', { text: t('interact.locked', { what: t(obj.nameKey || 'prop.door') }), tone: 'bad' });
        SkillsSystem.use('lockpick', 3);
        CrimeSystem.leaveEvidence('prying', obj.x, obj.y, s.scene);
        return;
      }
      this.travel(interior);
      return;
    }
    if (obj.kind === 'gate') {
      const gateId = id.split(':')[1];
      const def = obj.data?.def;
      const open = this.gates[gateId];
      if (open) { bus.emit('hud:toast', { text: t('interact.gateOpen') }); return; }
      // strażnik przy bramie wymaga przepustki, łapówki albo siły
      const hours = def?.hoursOpen;
      if (hours && (s.time.hour < hours[0] || s.time.hour >= hours[1])) {
        bus.emit('hud:toast', { text: t('interact.gateClosedHours', { from: hours[0], to: hours[1] }), tone: 'bad' });
        return;
      }
      if (def?.needsPass && !InventorySystem.has(def.passItem)) {
        if (def.guardNpc) {
          const guard = this.npcs.find(n => n.npcId === def.guardNpc && !n.hidden);
          if (guard && Math.hypot(guard.x - this.player.x, guard.y - this.player.y) < 90) {
            DialogueSystem.open(def.guardNpc, 'guard_root');
            return;
          }
        }
        bus.emit('hud:toast', { text: t('interact.needPass', { what: itemName(def.passItem) }), tone: 'bad' });
        return;
      }
      this.openGate(gateId);
      return;
    }
    if (obj.kind === 'station') { this.useStation(obj); return; }
    if (obj.grabbable) { this.player.toggleCarry(obj.id); return; }
    if (obj.type === 'sign' || obj.type === 'notice' || obj.type === 'board') {
      if (obj.type === 'board') { bus.emit('ui:openBoard', { id: 'board' }); return; }
      bus.emit('ui:showSign', { text: t(obj.nameKey || 'prop.sign') });
      SkillsSystem.use('reading', 6);
      return;
    }
    if (obj.type === 'chest' || obj.type === 'crate' || obj.type === 'barrel' || obj.type === 'sack' || obj.type === 'corpse') {
      this.searchObject(obj);
      return;
    }
    if (obj.type === 'bed' || obj.type === 'straw') {
      bus.emit('ui:openSleep', { obj });
      return;
    }
    if (obj.type === 'well' || obj.type === 'water' || obj.type === 'trough') {
      s.needs.thirst = Math.min(100, s.needs.thirst + 45);
      if (InventorySystem.has('waterskin')) { bus.emit('hud:toast', { text: t('interact.filledSkin') }); }
      if (rng.chance(s.weather.plague ? 0.25 : 0.05)) {
        s.diseases.push({ id: 'flux', severity: 0.25, dayStart: s.time.day, treated: false });
        bus.emit('hud:toast', { text: t('needs.badWater'), tone: 'bad' });
      }
      bus.emit('hud:toast', { text: t('interact.drank') });
      return;
    }
    if (obj.type === 'gallows') { bus.emit('ui:showSign', { text: t('interact.gallows') }); NotesSystem.addEntry('place', 'gallows'); return; }
    if (obj.type === 'altar') { this.useStation(obj); return; }
    if (obj.type === 'herb' || obj.type === 'plant' || obj.type === 'bush' || obj.type === 'mushroom') { this.gather(obj); return; }
    if (obj.type === 'trainingDummy') { this.spar('vagn'); return; }
    if (obj.type === 'anvil' || obj.type === 'forge' || obj.type === 'workbench' || obj.type === 'vat' || obj.type === 'hearth' || obj.type === 'fireplace') {
      const st = CraftingSystem.stationAt(s.scene, obj.type);
      if (st) { bus.emit('ui:openCraftStation', { id: st.id }); return; }
    }
    bus.emit('ui:showSign', { text: t(obj.nameKey || ('prop.' + obj.type)) });
  }

  pickLock(interior: string, obj: SceneObject) {
    const s = getGame().state;
    const lvl = SkillsSystem.level('lockpick');
    const chance = 0.25 + lvl * 0.12 + SkillsSystem.effect('concealBonus') * 0.05;
    if (rng.chance(chance)) {
      s.flags['unlocked_' + interior] = true;
      obj.data = { ...(obj.data || {}), locked: false };
      SkillsSystem.use('lockpick', 30);
      bus.emit('hud:toast', { text: t('interact.unlocked'), tone: 'good' });
      CrimeSystem.leaveEvidence('prying', obj.x, obj.y, s.scene);
      this.travel(interior);
    } else {
      SkillsSystem.use('lockpick', 10);
      InventorySystem.remove('lockpick_set', 1);
      bus.emit('hud:toast', { text: t('interact.lockpickBroke'), tone: 'bad' });
      bus.emit('crime:publicAct', { type: 'trespass', x: obj.x, y: obj.y });
    }
  }

  useStation(obj: SceneObject) {
    const g = getGame(), s = g.state;
    const kind = obj.type;
    const d = obj.data || {};
    // stacja przypisana do konkretnego człowieka
    const npcId = d.npc as string | undefined;
    const merchant = merchantAtStation(kind, s.scene) || (npcId ? EconomySystem && merchantAtStation('shop', s.scene) : undefined);
    switch (kind) {
      case 'bar':
      case 'shop':
      case 'hides':
      case 'rack':
      case 'confiscated':
        if (npcId && s.alive(npcId)) { DialogueSystem.open(npcId); return; }
        if (merchant) { bus.emit('ui:openTrade', { id: merchant.id }); return; }
        bus.emit('hud:toast', { text: t('interact.nobody'), tone: 'bad' });
        return;
      case 'gambleTable':
        if (npcId && s.alive(npcId) && !s.flags.table_welcome) { bus.emit('hud:toast', { text: t('gamble.notWelcome'), tone: 'bad' }); DialogueSystem.open(npcId === 'gambler_night' ? 'gracz_pankracy' : 'graczka_cecylia'); return; }
        bus.emit('ui:openGamble', { game: kind === 'gambleTable' ? 'dice' : 'dice', npcId: d.npc === 'gambler_day' ? 'graczka_cecylia' : 'gracz_pankracy' });
        return;
      case 'medic':
        if (npcId && s.alive(npcId)) { DialogueSystem.open(npcId); return; }
        bus.emit('ui:openService', { id: 'treat' });
        return;
      case 'teacher':
        if (npcId && s.alive(npcId)) { DialogueSystem.open(npcId); return; }
        bus.emit('ui:openSkills', {});
        return;
      case 'writeDesk':
        if (!NotesSystem.hasNotebook()) { bus.emit('hud:toast', { text: t('notes.noNotebook'), tone: 'bad' }); return; }
        bus.emit('ui:openWrite', {});
        return;
      case 'chest': {
        const key = `${s.scene}:${obj.id}`;
        bus.emit('ui:openChest', { key });
        return;
      }
      case 'bed':
      case 'straw':
        bus.emit('ui:openSleep', { obj, cost: d.cost || 0 });
        return;
      case 'hearth':
        s.needs.warmth = Math.min(100, s.needs.warmth + 25);
        if (!s.needs.torchLit && InventorySystem.has('torch')) { s.needs.torchLit = true; s.needs.torchFuel = itemDef('torch')?.burns || 90; bus.emit('player:torch', { lit: true }); }
        bus.emit('hud:toast', { text: t('interact.warmed'), tone: 'good' });
        return;
      case 'bath':
        if (EconomySystem.useService('bath', npcId)) NeedsSystem.wash(70);
        return;
      case 'alms':
        if (EconomySystem.useService('alms')) ReputationSystem.add('church', 5, 'rep.reason.alms');
        return;
      case 'altar':
        DialogueSystem.open('teodor', 'teodor_root');
        return;
      case 'customsDesk':
      case 'guardDesk':
      case 'guildDesk':
      case 'hideout':
      case 'search':
      case 'stocks':
      case 'tanVat':
      case 'forgeWork':
      case 'workbench': {
        const craft = CraftingSystem.stationAt(s.scene, kind === 'tanVat' ? 'vat' : kind);
        if (craft) { bus.emit('ui:openCraftStation', { id: craft.id }); return; }
        if (kind === 'hideout') { bus.emit('ui:openChest', { key: 'hideout' }); return; }
        if (kind === 'search') { this.searchObject(obj); return; }
        if (kind === 'stocks') { bus.emit('ui:showSign', { text: t('interact.stocks') }); return; }
        if (npcId && s.alive(npcId)) { DialogueSystem.open(npcId); return; }
        bus.emit('ui:showSign', { text: t(obj.nameKey || 'station.' + kind) });
        return;
      }
      default:
        if (npcId && s.alive(npcId)) { DialogueSystem.open(npcId); return; }
        bus.emit('ui:showSign', { text: t(obj.nameKey || 'station.' + kind) });
    }
  }

  /** Przeszukiwanie: skrzynie, beczki, zwłoki. Ryzykowne w miejscu publicznym. */
  searchObject(obj: SceneObject) {
    const g = getGame(), s = g.state;
    const key = `${s.scene}:${obj.id}`;
    if (this.containers[key]?.length === 0 && this.containers[key] !== undefined) {
      bus.emit('hud:toast', { text: t('interact.empty') });
      return;
    }
    // czy ktoś widzi
    const witnesses = this.actors.filter(a => a !== this.player && a.alive && !a.hidden && a instanceof NPCActor && Math.hypot(a.x - this.player.x, a.y - this.player.y) < 150) as unknown as NPCActor[];
    const publicAct = witnesses.length > 0 && !s.time.isNight();
    if (publicAct) {
      bus.emit('crime:publicAct', { type: 'trespass', x: obj.x, y: obj.y });
      bus.emit('hud:toast', { text: t('interact.searchSeen', { who: witnesses[0].name }), tone: 'bad' });
    }
    // zawartość: stała dla danego obiektu, losowana deterministycznie
    if (!this.containers[key]) {
      const seedVal = hashStr(key);
      const lootTable = obj.data?.loot || defaultLoot(obj.type, seedVal);
      this.containers[key] = lootTable;
    }
    const loot = this.containers[key];
    s.time.advanceMinutes(3);
    SkillsSystem.use('streetwise', 6);
    this.player.setAction('search');
    if (loot.length === 0) { bus.emit('hud:toast', { text: t('interact.empty') }); return; }
    const found: string[] = [];
    for (const itemId of loot.splice(0)) {
      if (InventorySystem.add(itemId, 1, { stolen: publicAct || obj.type === 'corpse' })) found.push(itemName(itemId));
    }
    bus.emit('hud:toast', { text: t('interact.found', { what: found.join(', ') || t('interact.nothing') }), tone: found.length ? 'good' : 'neutral' });
    if (obj.type === 'corpse') NeedsSystem.exposureCheck(0, false, true);
    bus.emit('search:done', { obj: obj.id, found });
  }

  /** Zbieranie ziół/grzybów z obiektów świata. */
  gather(obj: SceneObject) {
    const s = getGame().state;
    const type = obj.type;
    const table: Record<string, string[]> = {
      herb: ['herb_yarrow'], mushroom: ['mushroom_common'], bush: ['garlic_braid', 'herb_yarrow'],
      plant: ['herb_yarrow', 'willow_bark'], reeds: ['linen_thread']
    };
    const key = `gather:${obj.id}`;
    if (s.flags[key]) { bus.emit('hud:toast', { text: t('interact.alreadyGathered') }); return; }
    const items = table[type] || table.plant;
    const pick = rng.pick(items);
    if (InventorySystem.add(pick, 1)) {
      s.flags[key] = true;
      SkillsSystem.use('foraging', 18);
      if (SkillsSystem.hasPerk('herbarium') && rng.chance(0.4)) { InventorySystem.add(rng.pick(items), 1); }
      NotesSystem.addEntry('plant', type === 'mushroom' ? 'chanterelle' : 'yarrow');
      bus.emit('hud:toast', { text: t('interact.gathered', { what: itemName(pick) }), tone: 'good' });
    }
    obj.hidden = true;
    obj.dynamic = true;
  }

  /* ---------------- podróż między scenami ---------------- */

  travel(to: string, spawnX?: number, spawnY?: number) {
    const g = getGame(), s = g.state;
    if (this.transitioning) return;
    if (to !== 'world' && !this.interiors.has(to)) { bus.emit('hud:toast', { text: t('interact.cantEnter'), tone: 'bad' }); return; }
    this.transitioning = true;
    bus.emit('world:fade', { dir: 1 });
    setTimeout(() => {
      this.setActiveScene(to);
      if (to === 'world') {
        // wyjście z budynku: przed drzwiami, z których wszedł
        const door = s.flags.lastDoor as string | undefined;
        const d = door ? this.district.byInteract('door:' + door) : undefined;
        if (d) { this.player.x = d.x; this.player.y = d.y + 18; }
        else if (spawnX !== undefined) { this.player.x = spawnX; this.player.y = spawnY!; }
      } else {
        const sc = this.interiors.get(to)!;
        const exit = sc.exits[0];
        // wejście: tuż przy drzwiach wyjściowych, żeby gracz wiedział którędy wrócić
        if (exit) { this.player.x = exit.x; this.player.y = exit.y - 20; }
        else { this.player.x = sc.tilemap.w / 2 * TILE; this.player.y = (sc.tilemap.h - 2) * TILE; }
        s.flags.lastDoor = to;
        QuestSystem.notify('enter', { interior: to });
      }
      this.refreshNPCVisibility();
      bus.emit('world:fade', { dir: -1 });
      this.transitioning = false;
      bus.emit('hud:place', { nameKey: this.scene.nameKey });
    }, 260);
  }

  openGate(gateId: string) {
    const obj = this.loaded.gates.get(gateId);
    if (!obj) return;
    this.gates[gateId] = true;
    applyGateState(this.district, obj, true);
    bus.emit('hud:toast', { text: t('interact.gateOpened') });
  }

  /* ---------------- przedmioty na ziemi ---------------- */

  addGroundItem(itemId: string, x: number, y: number, qty = 1, scene?: string, stolen?: boolean) {
    const sc = scene ? (scene === 'world' ? this.district : this.interiors.get(scene)) : this.scene;
    if (!sc) return;
    const obj = sc.add({
      kind: 'marker', type: 'groundItem', x, y, sortY: y, art: null,
      nameKey: itemDef(itemId)?.nameKey, interactId: `ground:${itemId}`,
      grabbable: false, dynamic: true, data: { itemId, qty, stolen }
    });
    this.groundItems.push({ id: itemId, x, y, qty, obj, stolen });
  }

  pickupGround(obj: SceneObject) {
    const idx = this.groundItems.findIndex(g => g.obj === obj);
    if (idx < 0) return false;
    const gi = this.groundItems[idx];
    if (InventorySystem.add(gi.id, gi.qty, { stolen: gi.stolen })) {
      this.scene.remove(gi.obj);
      this.groundItems.splice(idx, 1);
      return true;
    }
    return false;
  }

  dropLoot(x: number, y: number, loot: string[], purse: number) {
    for (const id of loot) if (rng.chance(0.8)) this.addGroundItem(id, x + rng.range(-10, 10), y + rng.range(-6, 6), 1);
    if (purse > 0) {
      const obj = this.scene.add({ kind: 'marker', type: 'groundItem', x, y, sortY: y, nameKey: 'item.coinPurse', interactId: `ground:purse`, dynamic: true, data: { gold: purse } });
      this.groundItems.push({ id: 'crown', x, y, qty: purse, obj });
    }
  }

  /* ---------------- zdarzenia ---------------- */

  bindEvents() {
    // cios gracza
    bus.on('player:swing', (e: any) => this.resolvePlayerSwing(e));
    // ataki przeciwników i wrogich NPC
    bus.on('enemy:attack', (e: any) => this.resolveEnemyAttack(e));
    bus.on('npc:attack', (e: any) => this.resolveEnemyAttack(e));
    bus.on('enemy:callPack', (e: any) => {
      for (const en of this.enemies) if (en.packId === e.packId) en.callPack(e.x, e.y);
    });
    bus.on('world:openGate', (e: any) => this.openGate(e.id));
    bus.on('world:dropItem', (e: any) => this.addGroundItem(e.id, e.x ?? this.player.x + 10, e.y ?? this.player.y + 6, e.qty || 1));
    bus.on('world:putDown', (e: any) => {
      const obj = this.scene.byId(e.id);
      if (obj) { obj.hidden = false; obj.x = e.x; obj.y = e.y; obj.sortY = e.y; this.scene.invalidate(); }
    });
    bus.on('crime:publicAct', (e: any) => {
      if (!e.type) return;
      const s = getGame().state;
      const witnesses = this.actors.filter(a => a !== this.player && a.alive && !a.hidden && a instanceof NPCActor && Math.hypot(a.x - this.player.x, a.y - this.player.y) < 180) as unknown as NPCActor[];
      if (witnesses.length === 0) return;
      for (const w of witnesses) w.witnessCrime(e.type, e.x ?? this.player.x, e.y ?? this.player.y);
      s.stats.crimesCommitted += 1;
    });
    bus.on('crime:witnessEvent', (e: any) => {
      const n = this.npcs.find(x => x.npcId === e.npcId);
      if (n) n.witnessCrime(e.type, n.x, n.y);
      else CrimeSystem.report(e.npcId, e.type);
    });
    bus.on('combat:start', (e: any) => {
      const n = this.npcs.find(x => x.npcId === e.target);
      if (n && n.alive) {
        n.hostile = true;
        if (!n.combatStats) n.combatStats = { hp: n.maxHp, dmg: 8, speed: 44, reach: 20, armor: 0, attackTime: 0.8, telegraph: 0.5, fleeAt: 0.3 };
        bus.emit('hud:toast', { text: t('combat.started', { who: n.name }), tone: 'bad' });
      }
    });
    bus.on('combat:spar', (e: any) => this.startSpar(e.npcId));
    bus.on('rumor:seedEvent', (e: any) => RumorSystem.seed(e.textKey, { witness: e.witness, severity: e.severity }));
    bus.on('notes:add', (e: any) => NotesSystem.addEntry(e.kind || 'note', e.key));
    bus.on('player:died', () => this.onPlayerDeath());
    bus.on('npc:died', (e: any) => this.dropLoot(e.x, e.y, e.loot || [], e.purse || 0));
    bus.on('enemy:died', (e: any) => this.dropLoot(e.x, e.y, e.loot || [], 0));
    bus.on('ending:trigger', (e: any) => QuestSystem.triggerEnding(e.id));
    bus.on('ending:check', () => { const end = QuestSystem.checkEndings(); if (end) QuestSystem.triggerEnding(end.id); });
    bus.on('rep:add', (e: any) => ReputationSystem.add(e.faction, e.amount, e.reason));
    bus.on('rep:addRelation', (e: any) => ReputationSystem.addRelation(e.npcId, e.amount, e.reason));
  }

  resolvePlayerSwing(e: any) {
    const dirVec = e.dir === 1 ? [-1, 0] : e.dir === 2 ? [1, 0] : e.dir === 3 ? [0, -1] : [0, 1];
    const reach = e.reach + 10;
    let hitAny = false;
    for (const a of this.actors) {
      if (a === this.player || !a.alive || a.hidden) continue;
      const dx = a.x - this.player.x, dy = (a.y - this.player.y) * 1.35;
      const d = Math.hypot(dx, dy);
      if (d > reach + a.radius) continue;
      const dot = (dx * dirVec[0] + dy * dirVec[1]) / (d || 1);
      if (dot < Math.cos(e.arc * 1.1)) continue;
      hitAny = true;
      if (a instanceof EnemyActor) a.takeHit(e.dmg, { vsArmor: e.vsArmor, fromX: this.player.x, fromY: this.player.y, skill: e.weaponSkill });
      else if (a instanceof NPCActor) {
        const real = Math.max(1, Math.round(e.dmg * (1 - (a.combatStats?.armor || 0))));
        a.damage(real, this.player.x, this.player.y);
        bus.emit('fx:damageNumber', { x: a.x, y: a.y - 34, amount: real });
        if (!a.alive) { a.die(true); }
        else {
          a.hostile = true;
          if (!a.combatStats) a.combatStats = { hp: a.maxHp, dmg: 9, speed: 44, reach: 20, armor: 0.05, attackTime: 0.85, telegraph: 0.5, fleeAt: 0.35 };
          a.witnessCrime('assault', this.player.x, this.player.y);
        }
      }
      SkillsSystem.use(e.weaponSkill, 12);
    }
    // trafienie w obiekt (beczka, skrzynia) — hałas i ślad
    if (!hitAny) {
      for (const o of this.scene.near(this.player.x + dirVec[0] * reach * 0.6, this.player.y + dirVec[1] * reach * 0.6, 16, ['prop'])) {
        if (o.type === 'barrel' || o.type === 'crate' || o.type === 'pot') {
          bus.emit('fx:hit', { x: o.x, y: o.y });
          bus.emit('player:step', { x: this.player.x, y: this.player.y, noise: 2.4, ground: 'planks', sneaking: false });
          if (rng.chance(0.35)) this.searchObject(o);
          break;
        }
      }
      SkillsSystem.use(e.weaponSkill, 4);
    }
    bus.emit('fx:swing', { x: this.player.x, y: this.player.y, dir: e.dir, reach });
  }

  resolveEnemyAttack(e: any) {
    const from: Actor = e.from;
    const dx = this.player.x - from.x, dy = this.player.y - from.y;
    const d = Math.hypot(dx, dy);
    if (d > (e.reach || 24) + this.player.radius + 8) return;      // chybiony: gracz odszedł
    this.player.receiveHit(e.dmg, from.x, from.y, { pierceArmor: e.pierceArmor, part: rollPart() });
    bus.emit('fx:hit', { x: this.player.x, y: this.player.y });
    // ugryzienie szczura/wilka = ryzyko choroby
    if (e.type === 'rat' || e.type === 'dog' || e.type === 'wolf') NeedsSystem.exposureCheck(0, false, e.type === 'rat');
  }

  spar(npcId: string) {
    const n = this.npcs.find(x => x.npcId === npcId);
    const s = getGame().state;
    if (!n) { bus.emit('hud:toast', { text: t('combat.noSpar'), tone: 'bad' }); return; }
    s.flags.spar_vagn = true;
    QuestSystem.notify('flag', { flag: 'spar_vagn' });
    bus.emit('ui:openSpar', { npcId });
    // uproszczony sparing: 3 wymiany, liczy się parowanie i unik
    const skill = SkillsSystem.level('parry') + SkillsSystem.level('sword');
    const wins = Math.min(3, Math.max(0, Math.round(skill / 2) + (rng.int(-1, 1))));
    const dmg = Math.max(2, 14 - wins * 4);
    NeedsSystem.damage(dmg, 'spar');
    s.needs.stamina = Math.max(0, s.needs.stamina - 30);
    SkillsSystem.use('parry', 20 + wins * 8);
    SkillsSystem.use('sword', 16 + wins * 6);
    ReputationSystem.addRelation(npcId, 4 + wins * 4, 'spar');
    s.time.advanceMinutes(25);
    bus.emit('hud:toast', { text: t('combat.sparResult', { wins, dmg }), tone: wins >= 2 ? 'good' : 'neutral' });
  }

  startSpar(npcId: string) { this.spar(npcId); }

  onPlayerDeath() {
    const s = getGame().state;
    s.needs.dead = true;
    bus.emit('world:fade', { dir: 1 });
    setTimeout(() => {
      if (s.hardcore) { bus.emit('game:ending', { id: 'end_death', name: t('ending.death'), summary: t('ending.hardcore') }); return; }
      // miłosierdzie: John budzi się u medyka bez części złota — konsekwencja, nie reset
      const lost = Math.round(s.gold * 0.4);
      s.gold -= lost;
      s.needs.dead = false;
      s.needs.health = Math.round(s.needs.maxHealth * 0.55);
      s.needs.fatigue = 70;
      s.scene = 'int_bath';
      this.setActiveScene('int_bath');
      this.player.x = 5 * TILE; this.player.y = 4 * TILE;
      bus.emit('world:fade', { dir: -1 });
      bus.emit('hud:toast', { text: t('death.revived', { gold: lost }), tone: 'bad' });
      s.addLog(`revived at medic, lost ${lost}`);
    }, 900);
  }

  /* ---------------- zmiana dnia ---------------- */

  dayTick() {
    const g = getGame(), s = g.state;
    WeatherSystem.roll(true);
    WeatherSystem.plagueCheck();
    EconomySystem.dailyTick();
    DebtSystem.dailyTick();
    QuestSystem.dailyTick();
    CrimeSystem.dailyTick();
    RumorSystem.spreadDaily();
    SkillsSystem.advanceTraining();
    GamblingSystem.dailyConsequence();
    // bramy na nowo
    for (const [id, obj] of this.loaded.gates) {
      const open = this.gateDefaultOpen(id) || this.gates[id];
      this.gates[id] = open;
      applyGateState(this.district, obj, open);
    }
    // wilki znikają o świcie
    this.enemies = this.enemies.filter(e => !(e.typeId === 'wolf' && e.packId === 'nightpack' && !s.time.isNight()));
    this.actors = this.actors.filter(a => !(a instanceof EnemyActor && a.typeId === 'wolf' && a.packId === 'nightpack' && !s.time.isNight()));
    this.rollNightPredators();
    // notatnik schnie
    NotesSystem.dry();
    s.stats.daysPlayed += 1;
    // ciała znikają po 3 dniach (ktoś je zabrał)
    for (const [id, st] of Object.entries(s.npcState)) {
      if (st.alive === false && st.killed && s.time.day - st.killed > 3) {
        const n = this.npcs.find(x => x.npcId === id);
        if (n) n.hidden = true;   // ciało zabrał grabarz
      }
    }
    this.refreshNPCVisibility();
    bus.emit('world:dayTick', { day: s.time.day });
  }

  /* ---------------- zapis świata ---------------- */

  serialize(): WorldDynamic {
    const s = getGame().state;
    return {
      scene: s.scene,
      player: { x: Math.round(this.player.x), y: Math.round(this.player.y), dir: this.player.dir },
      doors: this.doors,
      gates: this.gates,
      containers: this.containers,
      ground: this.groundItems.map(g => ({ scene: s.scene, id: g.id, x: g.x, y: g.y, qty: g.qty, stolen: g.stolen })),
      npcs: Object.fromEntries(this.npcs.filter(n => !n.isPasserby).map(n => [n.npcId, { x: Math.round(n.x), y: Math.round(n.y), alive: n.alive }])),
      enemies: this.enemies.filter(e => e.kind !== 'creature').map(e => ({ typeId: e.typeId, kind: e.kind, x: Math.round(e.x), y: Math.round(e.y), hp: e.hp, alive: e.alive, scene: e.scene })),
      rngSeed: rng.serialize()
    };
  }
}

function rollPart(): any {
  return rng.pick(['torso', 'torso', 'armL', 'armR', 'legL', 'legR', 'head']);
}

function hashStr(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function defaultLoot(type: string, seed: number): string[] {
  const table: Record<string, string[][]> = {
    barrel: [['beer_mug'], ['salt_bag'], ['fish_smoked', 'fish_smoked'], []],
    crate: [['salt_sack'], ['iron_nails'], ['linen_cloth'], ['plank_oak'], []],
    chest: [['coin_purse_small'], ['bandage_linen', 'salve_wiera'], ['quill_ink'], ['lockpick_set'], ['permit_port']],
    sack: [['grain_sack'], ['turnip'], ['wheat_sack'], []],
    corpse: [['coin_purse_small'], ['dagger_iron'], ['rag_linen'], []],
    shelf: [['candle'], ['book_hours'], []],
    default: [['rag_linen'], [], ['candle'], ['bread_loaf']]
  };
  const opts = table[type] || table.default;
  const pick = opts[seed % opts.length];
  return pick ? [...pick] : [];
}
