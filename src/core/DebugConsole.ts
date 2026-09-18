import { bus } from './EventBus';
import { rng } from './RNG';
import { getGame } from './gameSingleton';
import { t } from './Localization';
import { InventorySystem } from '../systems/InventorySystem';
import { SkillsSystem } from '../systems/SkillsSystem';
import { ReputationSystem } from '../systems/ReputationSystem';
import { QuestSystem } from '../systems/QuestSystem';
import { WeatherSystem } from '../systems/WeatherSystem';
import { CrimeSystem } from '../systems/CrimeSystem';
import { DebtSystem } from '../systems/DebtSystem';
import { NotesSystem } from '../systems/NotesSystem';
import { NPCActor } from '../entities/NPCActor';
import { EnemyActor } from '../entities/EnemyActor';
import { TILE } from '../world/TileMap';

/* ============================================================================
   KONSOLA DEBUG — wymagana w briefie (sekcja 8) do testowania questów.
   Otwierana klawiszem ` (Backquote). Nie jest częścią świata gry — to narzędzie.
   ========================================================================== */

export interface CmdDef { name: string; args: string; help: string; run: (args: string[]) => string | void }

export class DebugConsole {
  el!: HTMLElement; logEl!: HTMLElement; inputEl!: HTMLInputElement;
  open = false;
  history: string[] = [];
  histIdx = -1;
  cmds: Record<string, CmdDef> = {};

  init() {
    this.el = document.getElementById('console')!;
    this.logEl = document.getElementById('con-log')!;
    this.inputEl = document.getElementById('con-input') as HTMLInputElement;
    this.inputEl.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') { const v = this.inputEl.value.trim(); this.inputEl.value = ''; if (v) this.exec(v); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); this.histIdx = Math.min(this.history.length - 1, this.histIdx + 1); if (this.histIdx >= 0) this.inputEl.value = this.history[this.history.length - 1 - this.histIdx]; }
      else if (e.key === 'ArrowDown') { e.preventDefault(); this.histIdx = Math.max(-1, this.histIdx - 1); this.inputEl.value = this.histIdx >= 0 ? this.history[this.history.length - 1 - this.histIdx] : ''; }
      else if (e.key === 'Escape') this.toggle(false);
    });
    this.inputEl.addEventListener('focus', () => { getGame().input.typing = true; });
    this.inputEl.addEventListener('blur', () => { getGame().input.typing = false; });
    this.register();
    this.print('ELENEM dev console — ' + t('console.hello'));
  }

  toggle(force?: boolean) {
    this.open = force !== undefined ? force : !this.open;
    this.el.style.display = this.open ? 'flex' : 'none';
    if (this.open) { this.inputEl.focus(); getGame().state.time.paused = true; }
    else { this.inputEl.blur(); getGame().state.time.paused = false; }
  }

  print(text: string, cls = '') {
    const div = document.createElement('div');
    div.className = 'con-line ' + cls;
    div.textContent = text;
    this.logEl.appendChild(div);
    this.logEl.scrollTop = this.logEl.scrollHeight;
    while (this.logEl.children.length > 300) this.logEl.removeChild(this.logEl.firstChild!);
  }

  exec(line: string) {
    this.history.push(line); this.histIdx = -1;
    this.print('> ' + line, 'con-in');
    const parts = line.split(/\s+/);
    const name = parts.shift()!.toLowerCase();
    const cmd = this.cmds[name];
    if (!cmd) { this.print(t('console.unknown', { cmd: name }), 'con-err'); return; }
    try {
      const out = cmd.run(parts);
      if (out !== undefined) this.print(String(out));
    } catch (e: any) { this.print('[!] ' + (e?.message || e), 'con-err'); }
  }

  register() {
    const g = () => getGame();
    const add = (name: string, args: string, help: string, run: (a: string[]) => string | void) => { this.cmds[name] = { name, args, help, run }; };

    add('help', '', 'lista komend', () => {
      for (const c of Object.values(this.cmds)) this.print(`${c.name} ${c.args} — ${c.help}`);
    });
    add('give', '<itemId> [qty]', 'dodaj przedmiot', (a) => { InventorySystem.add(a[0], Number(a[1] || 1)); return `+${a[1] || 1} ${a[0]}`; });
    add('take', '<itemId> [qty]', 'zabierz przedmiot', (a) => { InventorySystem.remove(a[0], Number(a[1] || 1)); return `-${a[1] || 1} ${a[0]}`; });
    add('gold', '<amount>', 'ustaw złoto', (a) => { g().state.gold = Math.max(0, Number(a[0])); return `gold=${g().state.gold}`; });
    add('addgold', '<amount>', 'dodaj złoto', (a) => { g().state.gold += Number(a[0]); return `gold=${g().state.gold}`; });
    add('debt', '[pay <n>|set <n>|days <n>|extend <n>]', 'operacje na długu', (a) => {
      const s = g().state;
      if (a[0] === 'pay') { DebtSystem.pay(Number(a[1])); return `paid ${a[1]}, left ${Math.round(s.debtRemaining)}`; }
      if (a[0] === 'set') { s.debt.principal = Number(a[1]); s.debt.paid = 0; return `debt=${s.debt.principal}`; }
      if (a[0] === 'days') { s.debt.dueDay = s.time.day + Number(a[1]); return `due day ${s.debt.dueDay}`; }
      if (a[0] === 'extend') { DebtSystem.extend(Number(a[1]), 0); return `extended ${a[1]}`; }
      return `left=${Math.round(s.debtRemaining)} due=${s.debt.dueDay} day=${s.time.day}`;
    });
    add('time', '<hour> [minute]', 'ustaw godzinę', (a) => {
      const s = g().state;
      s.time.minute = Number(a[0]) * 60 + Number(a[1] || 0);
      s.time.paused = false;
      g().onMinuteTick(true);
      return s.time.dateLabel();
    });
    add('day', '<n>', 'przeskocz do dnia n', (a) => {
      const s = g().state; const target = Math.max(1, Number(a[0]) || 1);
      let guard = 0;
      while (s.time.day < target && guard++ < 400) {
        s.time.minute = 6 * 60; s.time.day++; g().advanceDay(true);
      }
      return `day ${s.time.day}`;
    });
    add('advance', '[minutes]', 'przewiń czas (domyślnie 60)', (a) => { g().state.time.advanceMinutes(Number(a[0]) || 60); g().onMinuteTick(true); return g().state.time.dateLabel(); });
    add('weather', '<clear|cloudy|rain|storm|fog|snow|heat>', 'ustaw pogodę', (a) => {
      g().state.weather.kind = a[0] as any; g().state.weather.intensity = 0.7;
      WeatherSystem.roll(true);
      g().state.weather.kind = a[0] as any;
      bus.emit('weather:changed', { kind: a[0] });
      return a[0];
    });
    add('plague', '[on|off]', 'epidemia', (a) => { g().state.weather.plague = a[0] !== 'off'; return `plague=${g().state.weather.plague}`; });
    add('tp', '<regionKey|x y>', 'teleport', (a) => {
      const w = g().world; const s = g().state;
      if (a.length >= 2 && !isNaN(Number(a[0]))) {
        w.player.x = Number(a[0]); w.player.y = Number(a[1]);
        g().renderer?.camera?.follow(w.player.x, w.player.y, 0, true);
        return `${a[0]},${a[1]}`;
      }
      const key = a[0];
      const region = w.scene.regions.find(r => r.nameKey.includes(key));
      const ft = w.loaded.fastTravel.find(f => f.id.includes(key) || f.nameKey.includes(key));
      if (region) {
        w.player.x = (region.x + region.w / 2) * TILE; w.player.y = (region.y + region.h / 2) * TILE;
        g().renderer?.camera?.follow(w.player.x, w.player.y, 0, true);
        return t(region.nameKey);
      }
      if (ft) {
        w.player.x = ft.x; w.player.y = ft.y;
        g().renderer?.camera?.follow(w.player.x, w.player.y, 0, true);
        return t(ft.nameKey);
      }
      return 'nie znaleziono: ' + key;
    });
    add('scene', '<world|int_x>', 'zmień scenę', (a) => { g().world.travel(a[0]); return a[0]; });
    add('quest', '[list|start <id>|advance <id>|complete <id>|fail <id>]', 'questy', (a) => {
      const s = g().state;
      if (!a[0] || a[0] === 'list') return s.quests.map(q => `${q.id}: ${q.state} stage=${q.stageIdx}`).join('\n');
      if (a[0] === 'start') { QuestSystem.start(a[1]); return 'started ' + a[1]; }
      if (a[0] === 'advance') { QuestSystem.advance(a[1]); return 'advanced'; }
      if (a[0] === 'complete') { QuestSystem.complete(a[1]); return 'completed'; }
      if (a[0] === 'fail') { QuestSystem.fail(a[1]); return 'failed'; }
      return '?';
    });
    add('skill', '<id> [level]', 'ustaw poziom umiejętności', (a) => {
      const s = g().state;
      const table = [0, 40, 100, 190, 320, 500, 740, 1050, 1450, 2000];
      const lv = Number(a[1] || 1);
      s.skills.xp[a[0]] = table[Math.max(0, Math.min(9, lv - 1))];
      return `${a[0]} → ${SkillsSystem.level(a[0])}`;
    });
    add('perk', '<id>', 'naucz perka natychmiast', (a) => {
      g().state.skills.perks.push(a[0]); return 'perk ' + a[0];
    });
    add('rep', '<faction> <amount>', 'zmień reputację', (a) => { const f = a[0] as any; ReputationSystem.add(f, Number(a[1])); const rep = g().state.reputation as any; return `${a[0]}=${rep[f]}`; });
    add('rel', '<npcId> <amount>', 'zmień relację', (a) => { ReputationSystem.addRelation(a[0], Number(a[1])); return `${a[0]}=${ReputationSystem.relation(a[0])}`; });
    add('flag', '<key> [value]', 'ustaw flagę', (a) => { g().state.flags[a[0]] = a.length > 1 ? (isNaN(Number(a[1])) ? a[1] === 'true' : Number(a[1])) : true; return `${a[0]}=${g().state.flags[a[0]]}`; });
    add('flags', '', 'lista flag', () => Object.entries(g().state.flags).map(([k, v]) => `${k}=${v}`).join('\n'));
    add('crime', '<type>', 'zgłoś przestępstwo (test świadków)', (a) => {
      const w = g().world;
      const near = w.npcs.filter((n: NPCActor) => !n.hidden && Math.hypot(n.x - w.player.x, n.y - w.player.y) < 200);
      if (!near.length) return 'brak świadków w pobliżu';
      near[0].witnessCrime(a[0], w.player.x, w.player.y);
      return `świadek: ${near[0].name} (${a[0]})`;
    });
    add('wanted', '[0-5]', 'poziom poszukiwania', (a) => { g().state.crime.wanted = Number(a[0] ?? 3); g().state.crime.bounty = 60; return `wanted=${g().state.crime.wanted}`; });
    add('clear', '', 'wyczyść przestępstwa', () => { const c = g().state.crime; c.wanted = 0; c.bounty = 0; c.witnesses = []; return 'clean'; });
    add('spawn', '<npcId|creature|bandit...>', 'przywołaj aktora', (a) => {
      const w = g().world;
      const id = a[0];
      if (['wolf', 'boar', 'dog', 'rat', 'crow', 'goose', 'horse', 'wildKnight', 'deer', 'pike'].includes(id)) {
        const e = new EnemyActor(id, 'creature', w.player.x + 80, w.player.y, { seed: rng.int(1, 9999) });
        e.scene = g().state.scene; w.enemies.push(e); w.actors.push(e); return `spawned ${id}`;
      }
      if (['bandit', 'bandit_weak', 'bandit_boss', 'guard', 'knight_squire', 'drunk'].includes(id)) {
        const kind = id === 'guard' ? 'guard' : id === 'knight_squire' ? 'knight' : 'bandit';
        const e = new EnemyActor(id, kind as any, w.player.x + 80, w.player.y, { seed: rng.int(1, 9999) });
        e.scene = g().state.scene; w.enemies.push(e); w.actors.push(e); return `spawned ${id}`;
      }
      const n = new NPCActor(id, w.player.x + 40, w.player.y);
      n.scene = g().state.scene; n.hidden = false;
      w.npcs.push(n); w.actors.push(n);
      return `spawned npc ${id}`;
    });
    add('kill', '<npcId>', 'zabij NPC (test reakcji świata)', (a) => {
      const n = g().world.npcs.find((x: NPCActor) => x.npcId === a[0]);
      if (!n) return 'nie ma takiego: ' + a[0];
      n.die(false); return 'dead: ' + n.name;
    });
    add('revive', '<npcId>', 'przywróć NPC', (a) => {
      const s = g().state;
      delete s.npcState[a[0]];
      g().world.spawnAll(); return 'revived ' + a[0];
    });
    add('hurt', '<amount>', 'zadaj sobie obrażenia', (a) => { g().world.player.receiveHit(Number(a[0]), g().world.player.x + 20, g().world.player.y); return `-${a[0]} hp`; });
    add('heal', '', 'ulecz się', () => { const n = g().state.needs; n.health = n.maxHealth; n.stamina = n.maxStamina; n.hunger = 100; n.thirst = 100; n.fatigue = 0; return 'ok'; });
    add('injure', '[part] [type]', 'dodaj ranę', (a) => { g().world.player.receiveHit(18, g().world.player.x + 20, g().world.player.y, { part: (a[0] as any) || 'armL' }); return 'injured'; });
    add('note', '<text>', 'dodaj wpis do notatnika', (a) => { NotesSystem.writeCustom(a.join(' ')); return 'ok'; });
    add('notebook', '', 'daj notatnik i pióro', () => { NotesSystem.acquireNotebook(); InventorySystem.add('quill_ink', 1); InventorySystem.add('map_port', 1); NotesSystem.acquireMap('map_port'); return 'ok'; });
    add('map', '', 'daj wszystkie mapy', () => { for (const id of ['map_port', 'map_island']) { InventorySystem.add(id, 1); NotesSystem.acquireMap(id); } return 'ok'; });
    add('reveal', '', 'odkryj całą mapę', () => {
      const s = g().state;
      const { GRID_W, GRID_H } = NotesSystem.gridDims();
      s.maps.visited[s.scene === 'world' ? 'port_dolne_miasto' : s.scene] = new Array(GRID_W * GRID_H).fill('1').join('');
      return 'revealed';
    });
    add('rumor', '<textKey>', 'zasiej plotkę', (a) => { bus.emit('rumor:seedEvent', { textKey: a[0], severity: 3 }); return a[0]; });
    add('ending', '<id>', 'wymuś zakończenie', (a) => { QuestSystem.triggerEnding(a[0]); return a[0]; });
    add('lang', '<pl|en>', 'zmień język', (a) => { bus.emit('lang:set', { lang: a[0] }); return a[0]; });
    add('stats', '', 'statystyki gry', () => JSON.stringify(g().state.stats, null, 1));
    add('fps', '', 'pokaż/ukryj licznik fps', () => { g().renderer.showDebug = !g().renderer.showDebug; return `debug=${g().renderer.showDebug}`; });
    add('save', '[slot]', 'zapisz', (a) => { g().save(a[0] || 'quick'); return 'saved'; });
    add('load', '[slot]', 'wczytaj', (a) => { g().load(a[0] || 'quick'); return 'loaded'; });
    add('seed', '[n]', 'ziarno RNG', (a) => { if (a[0]) rng.setSeed(Number(a[0])); return `seed=${rng.serialize()}`; });
    add('npcs', '', 'lista NPC i ich zajęcia', () => g().world.npcs.filter((n: NPCActor) => !n.isPasserby).map((n: NPCActor) => `${n.npcId}: ${n.activity} @${n.scene} ${n.hidden ? '(hidden)' : Math.round(n.x) + ',' + Math.round(n.y)} hp=${n.hp}`).join('\n'));
    add('godmode', '[on|off]', 'nieśmiertelność (test)', (a) => { g().state.flags.godmode = a[0] !== 'off'; return `godmode=${!!g().state.flags.godmode}`; });
  }
}
