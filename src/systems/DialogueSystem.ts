import PL from '../data/dialogues/pl.json';
import EN from '../data/dialogues/en.json';
import { bus } from '../core/EventBus';
import { rng } from '../core/RNG';
import { getGame } from '../core/gameSingleton';
import { t, getLang, setLang } from '../core/Localization';
import { InventorySystem, itemDef } from './InventorySystem';
import { SkillsSystem } from './SkillsSystem';
import { ReputationSystem } from './ReputationSystem';
import { CrimeSystem } from './CrimeSystem';
import { QuestSystem } from './QuestSystem';
import { RumorSystem } from './RumorSystem';
import { NotesSystem } from './NotesSystem';
import { DebtSystem } from './DebtSystem';
import { EconomySystem } from './EconomySystem';
import { npcDef, npcName } from './ReputationSystem';

/* ============================================================================
   DIALOGI
   Drzewa dialogowe w całości w plikach JSON (PL/EN). Kod tylko je interpretuje:
   warunki, wymagania i skutki. Każda rozmowa jest zdarzeniem w świecie —
   świadkowie słyszą, reputacja się zmienia, plotki idą dalej.
   ========================================================================== */

export interface DialogueCond {
  flag?: string; noFlag?: string;
  skill?: string; min?: number;
  gold?: number; noGold?: number;
  item?: string; qty?: number; noItem?: string;
  relation?: Record<string, number>;
  rep?: Record<string, number>;
  injured?: boolean;
  quest?: { id: string; state?: string };
  time?: { from?: number; to?: number };
  weather?: string;
  night?: boolean; day?: boolean;
  wanted?: boolean;
  alive?: string; dead?: string;
  hasPerk?: string;
}

export interface DialogueEffect {
  openService?: string; openTrade?: string; openCraft?: string; openGamble?: any;
  openDebt?: boolean; openJournal?: boolean; openBoard?: string;
  gold?: number; give?: string; giveQty?: number; take?: string; qty?: number;
  rep?: Record<string, number>; relation?: Record<string, number>;
  quest?: { action: 'start' | 'advance' | 'fail' | 'complete' | 'startBoard'; id: string };
  note?: string; entry?: { kind: string; id: string };
  xp?: Record<string, number>; rumor?: string;
  crime?: { type: string; witnesses?: number; location?: string };
  flag?: string; flagValue?: any;
  train?: { perk: string }; spar?: string; heal?: number; cureInfection?: boolean;
  sleep?: { to: number; cost: number; place: string };
  flee?: boolean; payFine?: boolean; punish?: string; openGate?: string;
  debtExtend?: number; loan?: { principal: number; due: number };
  combat?: string; hygiene?: number; gambler?: string;
  teach?: string; end?: string;
}

export interface DialogueOption { text: string; cond?: DialogueCond; reqKey?: string; goto: string; effects?: DialogueEffect[] }
export interface DialogueNode { portrait?: string; emotion?: string; text: string; options: DialogueOption[]; once?: boolean }

const TREES: Record<string, Record<string, DialogueNode>> = { pl: (PL as any).nodes, en: (EN as any).nodes };

export function dialogueTree() { return TREES[getLang()] || TREES.pl; }
export function dialogueNode(id: string): DialogueNode | undefined { return dialogueTree()[id]; }
export function hasNode(id: string) { return !!dialogueTree()[id]; }

export interface DialogueSession {
  npcId: string; rootId: string; nodeId: string; node: DialogueNode;
  history: string[]; usedOnce: string[];
}

export class DialogueSystem {
  static session: DialogueSession | null = null;

  static open(npcId: string, rootId?: string): boolean {
    const s = getGame().state;
    if (!s.alive(npcId)) { bus.emit('hud:toast', { text: t('dialogue.dead', { who: npcName(npcId) }), tone: 'bad' }); return false; }
    const def = npcDef(npcId);
    const root = rootId || def?.dialogue || 'passerby_root';
    if (!dialogueNode(root)) { console.warn('[dialogue] brak węzła', root); return false; }
    this.session = { npcId, rootId: root, nodeId: root, node: this.fillPlaceholders(root, npcId), history: [root], usedOnce: [] };
    s.time.paused = true;   // rozmowa zatrzymuje świat — to świadoma decyzja projektowa
    bus.emit('dialogue:open', { npcId, root, session: this.session });
    return true;
  }

  static forceNode(npcId: string, nodeId: string) {
    if (!dialogueNode(nodeId)) return false;
    this.session = { npcId, rootId: nodeId, nodeId, node: this.fillPlaceholders(nodeId, npcId), history: [nodeId], usedOnce: [] };
    getGame().state.time.paused = true;
    bus.emit('dialogue:open', { npcId, root: nodeId, session: this.session });
    return true;
  }

  static close() {
    if (!this.session) return;
    const npcId = this.session.npcId;
    this.session = null;
    bus.emit('dialogue:close', { npcId });
  }

  static goto(nodeId: string) {
    const ses = this.session; if (!ses) return;
    if (nodeId === 'exit') { this.close(); return; }
    if (!dialogueNode(nodeId)) { console.warn('[dialogue] brak węzła', nodeId); this.close(); return; }
    ses.nodeId = nodeId;
    ses.node = this.fillPlaceholders(nodeId, ses.npcId);
    ses.history.push(nodeId);
    bus.emit('dialogue:node', { session: ses });
  }

  /** Wybranie opcji: sprawdź warunki, wykonaj skutki, przejdź dalej. */
  static choose(index: number): boolean {
    const ses = this.session; if (!ses) return false;
    const opt = ses.node.options[index];
    if (!opt) return false;
    const check = this.checkCond(opt.cond);
    if (!check.ok) {
      bus.emit('hud:toast', { text: check.reason || t('dialogue.cant'), tone: 'bad' });
      return false;
    }
    if (opt.effects) for (const e of opt.effects) this.apply(e, ses.npcId);
    SkillsSystem.use('persuade', 3, true);
    this.goto(opt.goto);
    return true;
  }

  /** Widoczne opcje: niespełnione warunki pokazujemy z powodem (nie ukrywamy). */
  static visibleOptions(): Array<{ text: string; ok: boolean; reason?: string; index: number }> {
    const ses = this.session; if (!ses) return [];
    return ses.node.options.map((o, i) => {
      const c = this.checkCond(o.cond);
      return { text: o.text, ok: c.ok, reason: c.ok ? undefined : (o.reqKey ? t(o.reqKey) : c.reason), index: i };
    });
  }

  static checkCond(c?: DialogueCond): { ok: boolean; reason?: string } {
    if (!c) return { ok: true };
    const s = getGame().state;
    if (c.flag && !s.flags[c.flag]) return { ok: false, reason: t('cond.flag') };
    if (c.noFlag && s.flags[c.noFlag]) return { ok: false, reason: t('cond.noFlag') };
    if (c.skill) {
      const lv = SkillsSystem.level(c.skill);
      if (lv < (c.min || 1)) return { ok: false, reason: t('cond.skill', { skill: t('skill.' + c.skill), level: c.min || 1, have: lv }) };
    }
    if (c.gold !== undefined && s.gold < c.gold) return { ok: false, reason: t('cond.gold', { gold: c.gold, have: s.gold }) };
    if (c.noGold !== undefined && s.gold >= c.noGold) return { ok: false, reason: t('cond.noGold') };
    if (c.item && !InventorySystem.has(c.item, c.qty || 1)) return { ok: false, reason: t('cond.item', { what: t(itemNameKey(c.item)), qty: c.qty || 1 }) };
    if (c.noItem && InventorySystem.has(c.noItem)) return { ok: false, reason: t('cond.noItem', { what: t(itemNameKey(c.noItem)) }) };
    if (c.relation) for (const id in c.relation) {
      if (ReputationSystem.relation(id) < c.relation[id]) return { ok: false, reason: t('cond.relation', { who: npcName(id), need: c.relation[id], have: ReputationSystem.relation(id) }) };
    }
    if (c.rep) for (const f in c.rep) {
      if ((s.reputation as any)[f] < c.rep[f]) return { ok: false, reason: t('cond.rep', { faction: t('faction.' + f), need: c.rep[f] }) };
    }
    if (c.injured && s.injuries.length === 0) return { ok: false, reason: t('cond.injured') };
    if (c.quest) {
      const q = QuestSystem.get(c.quest.id);
      if (!q) return { ok: false, reason: t('cond.quest') };
      if (c.quest.state && q.state !== c.quest.state) return { ok: false, reason: t('cond.questState') };
    }
    if (c.time) {
      const h = s.time.hour;
      if (c.time.from !== undefined && h < c.time.from) return { ok: false, reason: t('cond.time') };
      if (c.time.to !== undefined && h >= c.time.to) return { ok: false, reason: t('cond.time') };
    }
    if (c.weather && s.weather.kind !== c.weather) return { ok: false, reason: t('cond.weather') };
    if (c.night && !s.time.isNight()) return { ok: false, reason: t('cond.night') };
    if (c.day && s.time.isNight()) return { ok: false, reason: t('cond.day') };
    if (c.wanted && !CrimeSystem.isWanted()) return { ok: false, reason: t('cond.wanted') };
    if (c.alive && !s.alive(c.alive)) return { ok: false, reason: t('cond.dead') };
    if (c.dead && s.alive(c.dead)) return { ok: false, reason: t('cond.alive') };
    if (c.hasPerk && !SkillsSystem.hasPerk(c.hasPerk)) return { ok: false, reason: t('cond.perk') };
    return { ok: true };
  }

  /** Skutek wybrany w rozmowie — zawsze dotyka świata. */
  static apply(e: DialogueEffect, npcId: string) {
    const g = getGame(), s = g.state;
    if (e.gold) {
      if (e.gold > 0) { s.gold += e.gold; s.stats.earned += e.gold; }
      else {
        const cost = Math.min(s.gold, -e.gold);
        s.gold -= cost; s.stats.spent += cost;
      }
      bus.emit('hud:gold', { amount: e.gold });
    }
    if (e.give) InventorySystem.add(e.give, e.giveQty || 1);
    if (e.take) InventorySystem.remove(e.take, e.qty || 1);
    if (e.rep) for (const f in e.rep) ReputationSystem.add(f as any, e.rep[f], 'rep.reason.dialogue');
    if (e.relation) for (const id in e.relation) ReputationSystem.addRelation(id, e.relation[id], 'dialogue');
    if (e.flag) s.flags[e.flag] = e.flagValue !== undefined ? e.flagValue : true;
    if (e.xp) for (const sk in e.xp) SkillsSystem.use(sk, e.xp[sk]);
    if (e.note) bus.emit('hud:toast', { text: t('notes.hint') });
    if (e.entry) NotesSystem.addEntry(e.entry.kind as any, e.entry.id);
    if (e.rumor) RumorSystem.seed(e.rumor, { witness: npcId });
    if (e.hygiene) s.needs.hygiene = Math.min(100, s.needs.hygiene + e.hygiene);
    if (e.heal) s.needs.health = Math.min(s.needs.maxHealth, s.needs.health + e.heal);
    if (e.cureInfection) { for (const i of s.injuries) i.infected = false; bus.emit('hud:toast', { text: t('needs.infectionCured'), tone: 'good' }); }
    if (e.crime) {
      const w = e.crime.witnesses ?? 1;
      for (let i = 0; i < w; i++) bus.emit('crime:witnessEvent', { type: e.crime.type, npcId, location: e.crime.location });
    }
    if (e.quest) {
      if (e.quest.action === 'start') QuestSystem.start(e.quest.id);
      else if (e.quest.action === 'advance') { const q = QuestSystem.get(e.quest.id); if (!q) QuestSystem.start(e.quest.id); else QuestSystem.advance(e.quest.id); }
      else if (e.quest.action === 'fail') QuestSystem.fail(e.quest.id);
      else if (e.quest.action === 'complete') QuestSystem.complete(e.quest.id);
      else if (e.quest.action === 'startBoard') QuestSystem.startBoard(e.quest.id);
    }
    if (e.train) { SkillsSystem.startTraining(e.train.perk, npcId); }
    if (e.spar) bus.emit('combat:spar', { npcId: e.spar });
    if (e.combat) bus.emit('combat:start', { target: npcId, reason: 'dialogue' });
    if (e.flee) { CrimeSystem.flee(); bus.emit('player:flee', {}); }
    if (e.payFine) CrimeSystem.payFine();
    if (e.punish) { const days = CrimeSystem.punish(e.punish === 'stocks' ? 1 : 2); bus.emit('time:skip', { hours: days * 24, reason: 'jail' }); }
    if (e.openGate) bus.emit('world:openGate', { id: e.openGate });
    if (e.debtExtend) DebtSystem.extend(e.debtExtend, 1000);
    if (e.loan) DebtSystem.takeLoan(npcName(npcId), e.loan.principal);
    if (e.sleep) bus.emit('time:sleep', { to: e.sleep.to, place: e.sleep.place });
    // otwarcia interfejsów — wszystkie mają fizyczny odpowiednik w świecie
    if (e.openService) bus.emit('ui:openService', { id: e.openService, npcId });
    if (e.openTrade) bus.emit('ui:openTrade', { id: e.openTrade, npcId });
    if (e.openCraft) bus.emit('ui:openCraft', { id: e.openCraft, npcId });
    if (e.openGamble) bus.emit('ui:openGamble', { ...e.openGamble, npcId });
    if (e.openDebt) bus.emit('ui:openDebt', { npcId });
    if (e.openJournal) bus.emit('ui:openJournal', {});
    if (e.openBoard) bus.emit('ui:openBoard', { id: e.openBoard });
    if (e.end) bus.emit('game:endingRequest', { id: e.end });
    bus.emit('dialogue:effect', { effect: e, npcId });
  }

  /** Uzupełnianie {placeholder} w tekście węzła. */
  static fillPlaceholders(nodeId: string, npcId: string): DialogueNode {
    const s = getGame().state;
    const node = dialogueNode(nodeId)!;
    const rep = (str: string) => str
      .replace(/\{name\}/g, t(npcDef(npcId)?.nameKey || 'npc.stranger'))
      .replace(/\{role\}/g, npcDef(npcId)?.roleKey ? t(npcDef(npcId)!.roleKey) : '')
      .replace(/\{greeting\}/g, this.greeting(npcId))
      .replace(/\{hourAnswer\}/g, this.hourAnswer())
      .replace(/\{rumor\}/g, t(RumorSystem.dailyAmbient()))
      .replace(/\{gold\}/g, String(s.gold))
      .replace(/\{debt\}/g, String(Math.round(s.debtRemaining)))
      .replace(/\{days\}/g, String(s.time.daysLeft))
      .replace(/\{day\}/g, String(s.time.day))
      .replace(/\{weather\}/g, t('weather.' + s.weather.kind))
      .replace(/\{player\}/g, t('player.name'));
    return { ...node, text: rep(node.text), options: node.options.map(o => ({ ...o, text: rep(o.text) })) };
  }

  static greeting(npcId: string): string {
    const s = getGame().state;
    const def = npcDef(npcId);
    if (!def) return t('npc.greeting.stranger');
    const rel = ReputationSystem.relation(npcId);
    const pool: string[] = [];
    if (rel >= 40) pool.push('npc.greeting.friend');
    else if (rel >= 10) pool.push('npc.greeting.warm');
    else if (rel <= -40) pool.push('npc.greeting.hostile');
    else if (rel <= -10) pool.push('npc.greeting.cold');
    else pool.push('npc.greeting.neutral');
    if (s.crime.wanted >= 2) pool.push('npc.greeting.wanted');
    if (s.time.isNight()) pool.push('npc.greeting.night');
    if (def.greetingKeys?.length && rng.chance(0.4)) return t(rng.pick(def.greetingKeys));
    return t(rng.pick(pool));
  }

  static hourAnswer(): string {
    const s = getGame().state;
    if (!InventorySystem.has('pocket_watch') && !s.flags.owns_watch) return t('time.unknownAnswer');
    return t('time.knownAnswer', { hour: s.time.knownHour });
  }
}

function itemNameKey(id: string) {
  return itemDef(id)?.nameKey || ('item.' + id);
}

/* re-eksport dla wygody UI */
export { npcName, npcDef };
