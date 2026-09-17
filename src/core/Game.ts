import { bus } from './EventBus';
import { rng } from './RNG';
import { settings } from './Settings';
import { InputManager } from './InputManager';
import { GameState } from './GameState';
import { SaveSystem } from './SaveSystem';
import { DebugConsole } from './DebugConsole';
import { audio } from './AudioSystem';
import { setGame } from './gameSingleton';
import { t, setLang } from './Localization';
import { Renderer } from '../render/Renderer';
import { World } from '../world/World';
import { UIManager } from '../ui/UIManager';
import { InventorySystem } from '../systems/InventorySystem';
import { NeedsSystem } from '../systems/NeedsSystem';
import { WeatherSystem } from '../systems/WeatherSystem';
import { DebtSystem } from '../systems/DebtSystem';
import { QuestSystem } from '../systems/QuestSystem';
import { RumorSystem } from '../systems/RumorSystem';
import { CrimeSystem } from '../systems/CrimeSystem';
import { EconomySystem } from '../systems/EconomySystem';
import { SkillsSystem } from '../systems/SkillsSystem';
import { NotesSystem } from '../systems/NotesSystem';
import { DialogueSystem } from '../systems/DialogueSystem';

/* ============================================================================
   GRA — orkiestrator pętli
   Kolejność w klatce: wejście → czas → świat/aktorzy → HUD → render.
   Wszystkie systemy rozmawiają przez EventBus; Game tylko je taktuje.
   ========================================================================== */

export class Game {
  state = new GameState();
  input = new InputManager();
  renderer!: Renderer;
  world!: World;
  ui!: UIManager;
  debug = new DebugConsole();
  running = false;
  started = false;
  lastTs = 0;
  acc = 0;
  private minuteAcc = 0;
  private lastDay = 1;
  private lastHour = -1;
  fpsSmooth = 60;
  loopErrors = 0;
  bootError: string | null = null;

  constructor() { setGame(this); }

  async boot(canvas: HTMLCanvasElement) {
    try {
      setLang(settings.data.lang);
      this.renderer = new Renderer(canvas);
      this.world = new World();
      this.ui = new UIManager(this);
      audio.init();
      audio.bindEvents();
      this.debug.init();
      this.ui.init();
      this.bindEvents();
      this.state.newGame(settings.data.hardcore);
      this.world.init();
      this.renderer.camera.follow(this.world.player.x, this.world.player.y, 0, true);
      this.ui.showTitle();
      this.running = true;
      requestAnimationFrame((ts) => this.loop(ts));
    } catch (e: any) {
      this.bootError = e?.message || String(e);
      console.error('[boot]', e);
      const el = document.getElementById('title');
      if (el) el.innerHTML = `<div class="tt">BŁĄD / ERROR</div><div class="sub">${this.bootError}</div>`;
    }
  }

  newGame(hardcore = false) {
    settings.data.hardcore = hardcore;
    this.state.newGame(hardcore);
    rng.setSeed(1430 + Math.floor(Math.random() * 99991));
    this.world.init();
    this.renderer.camera.follow(this.world.player.x, this.world.player.y, 0, true);
    this.lastDay = this.state.time.day;
    this.lastHour = this.state.time.hour;
    this.started = true;
    this.state.time.paused = false;
    this.ui.hideTitle();
    bus.emit('game:started', {});
    bus.emit('hud:toast', { text: t('prolog.arrival') });
    bus.emit('hud:toast', { text: t('prolog.debt', { gold: Math.round(this.state.debtRemaining), days: this.state.time.daysLeft }), tone: 'bad' });
    QuestSystem.start('q_prolog_debt');
    NotesSystem.addJohnNote('note_arrival');
    NotesSystem.addJohnNote('note_debt');
  }

  save(slot = 'quick') { return SaveSystem.write(slot); }
  load(slot = 'quick') {
    const ok = SaveSystem.load(slot);
    if (ok) { this.started = true; this.ui.hideTitle(); this.state.time.paused = false; }
    return ok;
  }

  refreshAfterLoad() {
    this.lastDay = this.state.time.day;
    this.lastHour = this.state.time.hour;
    this.renderer.camera.follow(this.world.player.x, this.world.player.y, 0, true);
    this.renderer.weather.clear();
    this.ui.refreshAll();
  }

  /* ---------------- pętla ---------------- */

  loop(ts: number) {
    if (!this.running) return;
    requestAnimationFrame((t2) => this.loop(t2));
    const dt = Math.min(0.05, (ts - this.lastTs) / 1000 || 0.016);
    this.lastTs = ts;
    this.fpsSmooth = this.fpsSmooth * 0.92 + (1 / Math.max(0.0001, dt)) * 0.08;
    try {
      this.handleInput(dt);
      if (this.started) {
        this.updateTime(dt);
        this.world.update(dt, this.collectInput());
        this.updateAudio(dt);
      }
      this.render(dt);
      this.ui.tick(dt);
      this.loopErrors = 0;
    } catch (e) {
      // Pojedynczy błąd (np. odmowa WebAudio przed odblokowaniem) nie może
      // zatrzymać gry na stałe — licznik pozwala na trzy wpadki z rzędu.
      this.loopErrors++;
      console.error('[loop]', e);
      if (this.loopErrors >= 3) {
        this.running = false;
        this.ui.fatal(String((e as any)?.message || e));
      }
    }
    this.input.endFrame();
  }

  collectInput() {
    const i = this.input;
    const axis = i.moveAxis();
    return {
      mx: axis.x, my: axis.y,
      sneakHeld: settings.data.sneakMode === 'toggle' ? i.getToggle('sneak') : i.down('sneak'),
      runHeld: settings.data.runMode === 'toggle' ? i.getToggle('run') : i.down('run'),
      attackPressed: i.pressed('attack'),
      blockHeld: i.down('block'),
      dodgePressed: i.pressed('dodge'),
      mouseWorld: this.renderer.camera.screenToWorld(
        i.mousePos().x / Math.max(1, this.renderer.scale),
        i.mousePos().y / Math.max(1, this.renderer.scale)
      )
    };
  }

  handleInput(dt: number) {
    const i = this.input;
    if (i.typing) return;
    if (i.pressed('console')) { this.debug.toggle(); return; }
    if (this.debug.open) return;

    if (!this.started) {
      if (i.pressed('interact') || i.pressed('pause')) this.ui.titleActivate();
      return;
    }
    // dialog i nakładki przechwytują klawisze
    if (DialogueSystem.session) { this.ui.dialogInput(i); return; }
    if (this.ui.radialOpen) { this.ui.radialInput(i); return; }
    if (this.ui.anyOverlayOpen()) { this.ui.overlayInput(i); return; }

    if (i.pressed('pause')) { this.ui.togglePause(); return; }
    if (this.ui.paused) return;

    if (i.pressed('interact')) { this.world.interact(); return; }
    if (i.pressed('grab')) { this.world.player.toggleCarry(); return; }
    if (i.pressed('torch')) { InventorySystem.use('torch'); return; }
    if (i.pressed('quickbelt')) { this.ui.toggleRadial(); return; }
    if (i.pressed('inventory')) { this.ui.openInventory(); return; }

    /* --- klawisze diegetyczne: działają tylko, jeśli John ma przedmiot --- */
    if (i.pressed('notes')) {
      if (!NotesSystem.hasNotebook()) { bus.emit('hud:toast', { text: t('diegetic.noNotebook'), tone: 'bad' }); return; }
      this.ui.openNotes();
      return;
    }
    if (i.pressed('skills')) {
      if (!NotesSystem.hasNotebook()) { bus.emit('hud:toast', { text: t('diegetic.noNotebook'), tone: 'bad' }); return; }
      this.ui.openSkills();
      return;
    }
    if (i.pressed('map')) {
      const regions = NotesSystem.ownedRegions();
      if (!regions.length) { bus.emit('hud:toast', { text: t('diegetic.noMap'), tone: 'bad' }); return; }
      this.ui.openMap();
      return;
    }
    if (i.pressed('journal')) { this.ui.openJournal(); return; }
    if (i.pressed('clock')) { this.lookAtClock(); return; }

    if (i.pressed('quicksave')) {
      if (settings.data.hardcore) { bus.emit('hud:toast', { text: t('save.hardcoreBlocked'), tone: 'bad' }); return; }
      this.save('quick');
    }
    if (i.pressed('quickload')) {
      if (settings.data.hardcore) { bus.emit('hud:toast', { text: t('save.hardcoreBlocked'), tone: 'bad' }); return; }
      this.load('quick');
    }
    const wheel = i.mouseWheel();
    if (wheel) this.ui.zoomCamera(wheel);
  }

  /** T — John patrzy na słońce albo nasłuchuje dzwonu. Bez zegarka zna godzinę w przybliżeniu. */
  lookAtClock() {
    const s = this.state;
    const owns = InventorySystem.has('pocket_watch');
    if (owns) { s.time.knownHour = s.time.hour; s.time.knownHourExact = true; }
    else {
      s.time.knownHour = s.time.hour;
      s.time.knownHourExact = false;
      // w dzień: z słońca; w nocy lub we wnętrzu: tylko z dzwonu
      if (s.time.isNight() || s.scene !== 'world') {
        bus.emit('hud:toast', { text: t('time.cantTellNight'), tone: 'bad' });
        return;
      }
    }
    this.ui.showClockDial(true);
    bus.emit('hud:toast', { text: owns ? t('time.exact', { hour: s.time.hour }) : t('time.approx', { hour: s.time.hour }) });
    bus.emit('ui:page', {});
    SkillsSystem.use('streetwise', 1, true);
  }

  /* ---------------- czas ---------------- */

  updateTime(dt: number) {
    const s = this.state;
    if (s.time.paused || s.needs.dead) return;
    const before = s.time.minute;
    s.time.update(dt);
    // co minutę gry
    const minutesPassed = s.time.minute - before + (s.time.day !== this.lastDay ? 1440 : 0);
    this.minuteAcc += minutesPassed;
    while (this.minuteAcc >= 1) {
      this.minuteAcc -= 1;
      this.onMinuteTick();
    }
    // zmiana godziny — dzwon
    if (s.time.hour !== this.lastHour) {
      this.lastHour = s.time.hour;
      bus.emit('hourChime', { hour: s.time.hour });
      s.time.knownHour = s.time.hour;
      if (s.time.hour % 3 === 0) bus.emit('hud:toast', { text: t('time.bell', { hour: s.time.hour }) });
      // bramy otwierają się i zamykają o swoich godzinach
      for (const [id] of this.world.loaded.gates) {
        const open = this.world.gateDefaultOpen(id) || this.world.gates[id];
        if (open !== this.world.gates[id]) { this.world.gates[id] = open; this.world.openGate(id); }
      }
    }
    // zmiana dnia
    if (s.time.day !== this.lastDay) this.advanceDay();
  }

  onMinuteTick(force = false) {
    const s = this.state;
    const indoors = s.scene !== 'world';
    NeedsSystem.tickMinutes(1, {
      indoors,
      lightLevel: this.world.lightLevel(this.world.player.x, this.world.player.y),
      tempC: WeatherSystem.tempC()
    });
    if (s.flags.godmode) { s.needs.health = s.needs.maxHealth; }
    bus.emit('minuteTick', { day: s.time.day, hour: s.time.hour, minute: s.time.minuteOfHour });
    // co 15 minut: drobne zdarzenia świata
    if (s.time.minuteOfHour % 15 === 0 || force) {
      if (rng.chance(0.12)) bus.emit('rumor:seedEvent', { textKey: RumorSystem.dailyAmbient(), severity: 1 });
      if (s.time.isNight() && rng.chance(0.08)) bus.emit('sfx:wolf', {});
      if (rng.chance(0.05)) bus.emit('sfx:dog', {});
      if (s.weather.kind === 'storm' && rng.chance(0.08)) { bus.emit('sfx:thunder', {}); this.renderer.lighting.strike(settings.data.disableFlashing ? 0.2 : 1); }
    }
    // świadek, który widzi Johna z poszukiwaniem
    if (s.crime.wanted >= 2 && rng.chance(0.05)) {
      const guard = this.world.npcs.find(n => !n.hidden && n.faction === 'cityGuard' && Math.hypot(n.x - this.world.player.x, n.y - this.world.player.y) < 220);
      if (guard) CrimeSystem.confront(guard.npcId);
    }
  }

  /** Reakcja na zmianę dnia — zegar przewinął się sam, tu tylko skutki. */
  advanceDay(quiet = false) {
    const s = this.state;
    this.lastDay = s.time.day;
    this.world.dayTick();
    bus.emit('dayChanged', { day: s.time.day, daysLeft: s.time.daysLeft });
    if (!quiet) {
      bus.emit('hud:toast', { text: t('day.changed', { day: s.time.day, left: s.time.daysLeft }), tone: s.time.daysLeft <= 5 ? 'bad' : 'neutral' });
      SaveSystem.autosave();
    }
    const end = QuestSystem.checkEndings();
    if (end) QuestSystem.triggerEnding(end.id);
  }

  updateAudio(dt: number) {
    const s = this.state;
    const indoors = s.scene !== 'world';
    const crowd = this.world.actors.filter(a => a.alive && !a.hidden && Math.hypot(a.x - this.world.player.x, a.y - this.world.player.y) < 200).length;
    audio.setAmbient({
      weather: s.weather.kind, intensity: s.weather.intensity, wind: s.weather.wind,
      indoors, crowd, night: s.time.isNight()
    });
    audio.updateMusic(dt, s.scene === 'int_tavern' && !s.time.isNight());
    audio.setVolume(settings.data.masterVolume);
  }

  render(dt: number) {
    const s = this.state;
    const sc = this.world.scene;
    if (!sc) return;
    const p = this.world.player;
    const darkness = s.scene === 'world' ? s.time.darkness() : 1 - sc.interiorAmbient;
    const ambient = s.scene === 'world' ? s.time.ambientColor() : ([228, 200, 150] as [number, number, number]);
    const weatherMul = WeatherSystem.lightMul();
    const ambientLevel = s.scene === 'world'
      ? Math.max(0.12, (1 - darkness * 0.86) * weatherMul)
      : Math.max(0.28, sc.interiorAmbient + 0.42);
    const it = p.interactTarget;
    const target = it ? this.world.findNearbyObject(it.id) : null;
    this.renderer.draw({
      scene: sc,
      actors: this.world.actors.filter(a => a !== p),
      player: p,
      darkness,
      ambient,
      ambientLevel,
      sunDir: s.time.sunDirection(),
      time: performance.now() / 1000,
      weatherKind: s.scene === 'world' ? s.weather.kind : 'clear',
      weatherIntensity: s.weather.intensity,
      wind: s.weather.wind,
      torchLit: s.needs.torchLit,
      torchFuel: s.needs.torchFuel,
      interactTarget: target ? { x: target.x, y: target.y, label: it!.prompt } : (p.interactTarget?.kind === 'npc' ? this.npcTargetPos(p.interactTarget.id) : null),
      dt
    });
    // HUD aktualizujemy co klatkę — jest tani (tylko DOM text)
    this.ui.updateHud(dt);
  }

  npcTargetPos(npcId: string): { x: number; y: number; label: string } | null {
    const a = this.world.actors.find(x => x.id === npcId);
    return a ? { x: a.x, y: a.y - 8, label: a.name } : null;
  }

  /* ---------------- zdarzenia globalne ---------------- */

  bindEvents() {
    bus.on('hud:toast', (e: any) => this.ui.toast(e.text, e.tone));
    bus.on('hud:gold', () => this.ui.updateHud(0));
    bus.on('world:fade', (e: any) => this.ui.fade(e.dir));
    bus.on('dialogue:open', (e: any) => this.ui.openDialogue(e));
    bus.on('dialogue:node', (e: any) => this.ui.updateDialogue(e.session));
    bus.on('dialogue:close', () => this.ui.closeDialogue());
    bus.on('dialogue:force', (e: any) => DialogueSystem.forceNode(e.npcId, e.node));
    bus.on('ui:openTrade', (e: any) => this.ui.openTrade(e.id, e.npcId));
    bus.on('ui:openService', (e: any) => this.useServiceFromUi(e.id, e.npcId));
    bus.on('ui:openCraft', (e: any) => this.ui.openCraft(e.id));
    bus.on('ui:openCraftStation', (e: any) => this.ui.openCraft(e.id));
    bus.on('ui:openGamble', (e: any) => this.ui.openGamble(e));
    bus.on('ui:openDebt', () => this.ui.openDebt());
    bus.on('ui:openJournal', () => this.ui.openJournal());
    bus.on('ui:openBoard', () => this.ui.openBoard());
    bus.on('ui:openSkills', () => this.ui.openSkills());
    bus.on('ui:openWrite', () => this.ui.openWrite());
    bus.on('ui:openChest', (e: any) => this.ui.openChest(e.key));
    bus.on('ui:openSleep', (e: any) => this.ui.openSleep(e.cost || 0, e.obj?.nameKey));
    bus.on('ui:showSign', (e: any) => this.ui.showSign(e.text));
    bus.on('ui:confirm', (e: any) => this.ui.confirm(e.text, e.onYes));
    bus.on('ui:page', () => {});
    bus.on('fx:damageNumber', (e: any) => this.renderer.floats.damage(e.x, e.y, e.amount, { crit: e.crit, self: e.self }));
    bus.on('fx:parry', (e: any) => { this.renderer.floats.label(e.x, e.y - 40, t('combat.parry'), '#8fc4e8', 10, 0.8); if (!settings.data.disableCameraShake) this.renderer.camera.kick(2); });
    bus.on('fx:hit', () => { if (!settings.data.disableCameraShake) this.renderer.camera.kick(1.6); });
    bus.on('fx:swing', () => {});
    bus.on('combat:parried', () => { if (!settings.data.disableCameraShake) this.renderer.camera.kick(2.4); });
    bus.on('player:died', () => { if (!settings.data.disableCameraShake) this.renderer.camera.kick(5); });
    bus.on('player:step', (e: any) => this.renderer.weather.footstep(e.x, e.y, e.ground, false));
    bus.on('game:ending', (e: any) => this.ui.showEnding(e));
    bus.on('lang:set', (e: any) => { setLang(e.lang); settings.data.lang = e.lang; settings.save(); this.ui.refreshAll(); });
    bus.on('rep:add', (e: any) => {});
    bus.on('time:skip', (e: any) => this.skipTime(e.hours * 60, e.reason));
    bus.on('time:sleep', (e: any) => this.sleepUntil(e.to, e.place));
    bus.on('save:written', () => {});
    bus.on('quest:completed', () => audio.questDone());
    bus.on('skill:levelUp', () => audio.levelUp());
    bus.on('inventory:changed', () => this.ui.updateBelt());
    bus.on('inventory:full', (e: any) => this.ui.toast(e.msg, 'bad'));
  }

  useServiceFromUi(id: string, npcId?: string) {
    const ok = EconomySystem.useService(id, npcId);
    if (!ok) return;
    const s = this.state;
    switch (id) {
      case 'room': this.sleepUntil(6, 'room'); break;
      case 'treat': NeedsSystem.treatAll(25); break;
      case 'set_bone': NeedsSystem.setBone(); break;
      case 'stitch': NeedsSystem.bandage(); break;
      case 'bath': case 'wash': NeedsSystem.wash(60); break;
      case 'confess': s.flags.confessed = true; bus.emit('hud:toast', { text: t('service.confessed'), tone: 'good' }); break;
      case 'pass': InventorySystem.add('permit_port', 1); break;
      case 'contract': bus.emit('ui:openBoard', {}); break;
      default: break;
    }
  }

  skipTime(minutes: number, reason?: string) {
    const s = this.state;
    const target = s.time.minute + minutes;
    const step = 10;
    for (let m = 0; m < minutes; m += step) {
      s.time.advanceMinutes(step);
      this.onMinuteTick(true);
      if (s.time.day !== this.lastDay) this.advanceDay(true);
      this.lastHour = s.time.hour;
    }
    if (reason === 'jail') bus.emit('hud:toast', { text: t('time.jail', { minutes }), tone: 'bad' });
    this.ui.updateHud(0);
  }

  sleepUntil(hour: number, place?: string) {
    const s = this.state;
    const cur = s.time.hour + s.time.minuteOfHour / 60;
    let hours = hour - cur;
    if (hours <= 0) hours += 24;
    const quality = place === 'room' ? 1 : place === 'almshouse' ? 0.8 : place === 'straw' ? 0.55 : 0.4;
    s.flags.sleeping = true;
    this.ui.fade(1);
    this.skipTime(hours * 60, 'sleep');
    s.flags.sleeping = false;
    NeedsSystem.sleep(hours, quality);
    s.time.paused = false;
    this.ui.fade(-1);
    bus.emit('hud:toast', { text: t('needs.slept', { hours: Math.round(hours), quality: Math.round(quality * 100) }) });
    // sen w miejscu publicznym = ryzyko kradzieży
    if (quality <= 0.55 && rng.chance(0.35)) {
      const stolen = InventorySystem.count('notebook') && rng.chance(0.25);
      if (stolen) NotesSystem.loseNotebook('stolen');
      const gold = Math.min(s.gold, rng.int(3, 18));
      s.gold -= gold;
      bus.emit('hud:toast', { text: t('sleep.robbed', { gold }), tone: 'bad' });
    }
    SaveSystem.autosave();
  }
}
