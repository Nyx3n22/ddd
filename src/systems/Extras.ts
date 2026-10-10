import { bus } from '../core/EventBus';
import { rng } from '../core/RNG';
import { getGame } from '../core/gameSingleton';
import { t } from '../core/Localization';
import { settings } from '../core/Settings';
import { ReputationSystem, npcName } from './ReputationSystem';
import { RumorSystem } from './RumorSystem';
import { InventorySystem } from './InventorySystem';

/* ============================================================================
   DODATKI ROZGRYWKI
   - samouczek kontekstowy: jedna podpowiedź przy pierwszej okazji
   - osiągnięcia: wspólne dla wszystkich rozgrywek (pamięć przeglądarki)
   - kwestie NPC w dymkach przy mijaniu
   - dziennik ostatnich rozmów (do wglądu w dzienniku J)
   ========================================================================== */

/* ---------------- samouczek ---------------- */
const TIPS = ['night', 'wound', 'hunger', 'enemy', 'sneak', 'tavern', 'wanted', 'gold', 'map', 'board'] as const;
type Tip = typeof TIPS[number];

export class Tutorial {
  static show(id: Tip) {
    const s = getGame().state;
    if (!settings.data.showTutorial || s.flags['tut_' + id]) return;
    s.flags['tut_' + id] = true;
    bus.emit('hud:hint', { text: t('tut.' + id) });
  }

  /** Sprawdzane co minutę gry — tanie warunki na stanie. */
  static tick() {
    const g = getGame(), s = g.state;
    if (!g.started) return;
    if (s.scene === 'world' && s.time.isNight() && !s.needs.torchLit) this.show('night');
    if (s.injuries.some(i => i.bleeding > 0)) this.show('wound');
    if (s.needs.hunger < 30) this.show('hunger');
    if (s.crime.wanted > 0) this.show('wanted');
    if (s.gold >= 400 && s.debtRemaining > 0) this.show('gold');
    if (g.world?.player.sneak) this.show('sneak');
  }

  static bind() {
    bus.on('enemy:aggro', (e: any) => { if (e.kind !== 'creature' || e.type === 'wolf') this.show('enemy'); });
    bus.on('world:sceneChanged', (e: any) => { if (e.id === 'int_tavern') this.show('tavern'); });
    bus.on('ui:openBoard', () => this.show('board'));
    bus.on('inventory:changed', (e: any) => { if (e?.added && String(e.added).startsWith('map')) this.show('map'); });
  }
}

/* ---------------- osiągnięcia ---------------- */
interface Ach { id: string; check?: () => boolean }
const ACH_KEY = 'elenem.achievements';

export const ACHIEVEMENTS: Ach[] = [
  { id: 'first_blood', check: () => getGame().state.stats.killed >= 1 },
  { id: 'parry5', check: () => getGame().state.stats.parries >= 5 },
  { id: 'dodge20', check: () => getGame().state.stats.dodges >= 20 },
  { id: 'paid1000', check: () => getGame().state.debt.paid >= 1000 },
  { id: 'debt_free', check: () => getGame().state.debtRemaining <= 0 },
  { id: 'rich', check: () => getGame().state.gold >= 1500 },
  { id: 'night_owl', check: () => { const s = getGame().state; return s.scene === 'world' && s.time.hour === 3; } },
  { id: 'scholar', check: () => InventorySystem.has('notebook') },
  { id: 'cartographer', check: () => getGame().state.maps.owned.length > 0 },
  { id: 'week', check: () => getGame().state.time.day >= 8 },
  { id: 'survivor', check: () => getGame().state.time.day >= 20 },
  { id: 'quests5', check: () => getGame().state.stats.questsDone >= 5 },
  { id: 'friend', check: () => Object.keys(getGame().state.relations || {}).some(k => ReputationSystem.relation(k) >= 40) },
  { id: 'fisher' }, { id: 'pious' }, { id: 'ledger' }, { id: 'sneak_attack' }, { id: 'two_endings' }
];

export class Achievements {
  static unlocked(): string[] {
    try { return JSON.parse(localStorage.getItem(ACH_KEY) || '[]'); } catch { return []; }
  }
  static unlock(id: string) {
    const list = this.unlocked();
    if (list.includes(id)) return;
    list.push(id);
    try { localStorage.setItem(ACH_KEY, JSON.stringify(list)); } catch { /* brak pamięci */ }
    bus.emit('hud:toast', { text: t('ach.unlocked', { what: t('ach.' + id) }), tone: 'good' });
    bus.emit('sfx:achievement', {});
  }
  static tick() {
    const have = this.unlocked();
    for (const a of ACHIEVEMENTS) if (a.check && !have.includes(a.id)) { try { if (a.check()) this.unlock(a.id); } catch { /* stan w trakcie ładowania */ } }
  }
  static bind() {
    bus.on('fish:caught', () => {
      const s = getGame().state;
      s.flags.fish_caught = (Number(s.flags.fish_caught) || 0) + 1;
      if (Number(s.flags.fish_caught) >= 5) this.unlock('fisher');
    });
    bus.on('player:prayed', () => {
      const s = getGame().state;
      s.flags.prayers = (Number(s.flags.prayers) || 0) + 1;
      if (Number(s.flags.prayers) >= 3) this.unlock('pious');
    });
    bus.on('combat:sneakAttack', () => this.unlock('sneak_attack'));
    bus.on('inventory:changed', (e: any) => { if (e?.added === 'ledger_raven') this.unlock('ledger'); });
    bus.on('game:ending', () => {
      try { if ((JSON.parse(localStorage.getItem('elenem.endings') || '[]') as string[]).length >= 2) this.unlock('two_endings'); } catch { /* */ }
    });
  }
}

/* ---------------- kwestie NPC ---------------- */
export class Barks {
  private static cooldown = new Map<string, number>();

  /** Wywoływane co klatkę: ktoś w pobliżu czasem coś powie. */
  static update(dt: number) {
    const g = getGame(), s = g.state, w = g.world;
    if (!g.started || s.time.paused || !settings.data.showBarks) return;
    const p = w.player;
    for (const [k, v] of this.cooldown) this.cooldown.set(k, v - dt);
    for (const n of w.npcs) {
      if (n.hidden || !n.alive || n.hostile || n.talking) continue;
      const d = Math.hypot(n.x - p.x, n.y - p.y);
      if (d > 56 || d < 12) continue;
      if ((this.cooldown.get(n.npcId) ?? 0) > 0) continue;
      this.cooldown.set(n.npcId, rng.range(40, 90));
      if (!rng.chance(0.55)) continue;
      g.renderer.hud.say(n, this.line(n));
      break;
    }
  }

  static line(n: any): string {
    const s = getGame().state;
    const rel = n.isPasserby ? 0 : ReputationSystem.relation(n.npcId);
    const pool: string[] = [];
    if (s.crime.wanted >= 2) pool.push('bark.wanted1', 'bark.wanted2');
    if (s.weather.kind === 'rain' || s.weather.kind === 'storm') pool.push('bark.rain1', 'bark.rain2');
    if (s.time.isNight()) pool.push('bark.night1', 'bark.night2');
    if (s.needs.hygiene < 25) pool.push('bark.dirty');
    if (s.injuries.length) pool.push('bark.hurt');
    if (s.time.daysLeft <= 5 && s.debtRemaining > 0) pool.push('bark.debt');
    if (rel >= 20) pool.push('bark.friend1', 'bark.friend2');
    else if (rel <= -20) pool.push('bark.cold1', 'bark.cold2');
    pool.push('bark.greet1', 'bark.greet2', 'bark.greet3', 'bark.greet4');
    if (rng.chance(0.25)) return t(RumorSystem.dailyAmbient());
    return t(rng.pick(pool));
  }
}

/* ---------------- dziennik rozmów ---------------- */
export class TalkLog {
  static bind() {
    bus.on('dialogue:open', (e: any) => this.push(e.npcId, e.session?.node?.text));
    bus.on('dialogue:node', (e: any) => this.push(e.session?.npcId, e.session?.node?.text));
  }
  static push(npcId: string, text?: string) {
    if (!text) return;
    const s = getGame().state;
    const log: Array<[number, string, string]> = (s.flags._talkLog as any) || [];
    log.push([s.time.day, npcName(npcId), text.slice(0, 220)]);
    while (log.length > 30) log.shift();
    s.flags._talkLog = log as any;
  }
  static entries(): Array<[number, string, string]> { return ((getGame().state.flags._talkLog as any) || []).slice().reverse(); }
}
