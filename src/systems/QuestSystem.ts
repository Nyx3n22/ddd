import QUESTS from '../data/quests.json';
import { bus } from '../core/EventBus';
import { rng } from '../core/RNG';
import { getGame } from '../core/gameSingleton';
import { t } from '../core/Localization';
import type { QuestState } from '../core/GameState';
import { ReputationSystem } from './ReputationSystem';
import { SkillsSystem } from './SkillsSystem';
import { InventorySystem, itemName } from './InventorySystem';

/* ============================================================================
   QUESTY
   Zapis w dzienniku (J) jest wyłącznie opisem — nigdy mechaniką. Cele
   realizują się przez czyny w świecie: rozmowę, wejście do wnętrza, zebranie
   przedmiotu, dotarcie w nocy, zabójstwo, wygraną, zapłatę.
   ========================================================================== */

export interface Objective {
  type: 'talk' | 'collect' | 'kill' | 'reachArea' | 'enterInterior' | 'custom' | 'debtPaid' | 'gamble' | 'payGold' | 'escort' | 'deliver';
  npc?: string; item?: string; count?: number; target?: string; region?: string;
  interior?: string; flag?: string; amount?: number; wins?: number; nightOnly?: boolean;
}
export interface QuestStage { id: string; descKey: string; objective: Objective }
export interface QuestRewards {
  crowns?: number; rep?: Record<string, number>; xp?: Record<string, number>;
  items?: string[]; noteKey?: string; unlockStation?: string; unlockTeacher?: string; flag?: string;
}
export interface QuestDef {
  id: string; titleKey: string; type: string; giver: string | null; autoStart?: boolean;
  journalKey: string; stages: QuestStage[]; rewards?: QuestRewards; failCondition?: string;
}
export interface BoardDef {
  id: string; titleKey: string; descKeys: string[]; type: string;
  pay: [number, number]; rep: Record<string, number>; xp: Record<string, number>; items?: string[];
}
export interface EndingDef { id: string; nameKey: string; cond: Record<string, any> }

const QUEST_DEFS: Record<string, QuestDef> = {};
for (const q of QUESTS.quests as any[]) QUEST_DEFS[q.id] = q;
const BOARD_DEFS = QUESTS.board as unknown as BoardDef[];
const ENDINGS = QUESTS.endings as unknown as EndingDef[];

export function questDef(id: string) { return QUEST_DEFS[id]; }
export function allQuestDefs() { return Object.values(QUEST_DEFS); }
export function allEndings() { return ENDINGS; }

export class QuestSystem {
  static active(): QuestState[] { return getGame().state.quests.filter(q => q.state === 'active'); }
  static get(id: string) { return getGame().state.quests.find(q => q.id === id); }
  static def(id: string) { return QUEST_DEFS[id]; }

  static start(id: string): boolean {
    const s = getGame().state;
    const def = QUEST_DEFS[id];
    if (!def) { console.warn('[quest] nieznany quest', id); return false; }
    if (this.get(id)) return false;
    const q: QuestState = { id, stageIdx: 0, state: 'active', startedDay: s.time.day, data: {} };
    s.quests.push(q);
    bus.emit('quest:started', { id, title: t(def.titleKey) });
    bus.emit('hud:toast', { text: t('quest.started', { title: t(def.titleKey) }), tone: 'good' });
    s.addLog(`quest+ ${def.titleKey}`);
    this.checkStage(q);
    return true;
  }

  /** Zdarzenie ze świata może posunąć cel do przodu. */
  static notify(kind: string, payload: any) {
    for (const q of this.active()) {
      const def = QUEST_DEFS[q.id]; if (!def) continue;
      const stage = def.stages[q.stageIdx]; if (!stage) continue;
      const o = stage.objective;
      if (kind === 'talk' && o.type === 'talk' && o.npc === payload.npcId) this.advance(q.id);
      else if (kind === 'collect' && o.type === 'collect' && o.item === payload.itemId) this.progress(q.id, payload.qty || 1, o.count || 1);
      else if (kind === 'kill' && o.type === 'kill' && o.target === payload.target) this.progress(q.id, 1, o.count || 1);
      else if (kind === 'enter' && o.type === 'enterInterior' && o.interior === payload.interior) this.advance(q.id);
      else if (kind === 'area' && o.type === 'reachArea' && o.region === payload.region && (!o.nightOnly || payload.night)) this.advance(q.id);
      else if (kind === 'flag' && o.type === 'custom' && o.flag === payload.flag) this.progress(q.id, 1, o.count || 1);
      else if (kind === 'debtPaid' && o.type === 'debtPaid' && payload.amount >= (o.amount || 1)) this.advance(q.id);
      else if (kind === 'gamble' && o.type === 'gamble' && payload.won) this.progress(q.id, 1, o.wins || 1);
      else if (kind === 'payGold' && o.type === 'payGold' && payload.amount >= (o.amount || 1)) this.advance(q.id);
    }
  }

  static progress(id: string, amount: number, target: number) {
    const q = this.get(id); if (!q || q.state !== 'active') return;
    q.data.count = Math.min(target, (q.data.count || 0) + amount);
    bus.emit('quest:progress', { id, count: q.data.count, target });
    if (q.data.count >= target) this.advance(id);
  }

  static advance(id: string) {
    const s = getGame().state;
    const q = this.get(id); if (!q || q.state !== 'active') return;
    const def = QUEST_DEFS[id]; if (!def) return;
    q.stageIdx += 1;
    q.data.count = 0;
    if (q.stageIdx >= def.stages.length) { this.complete(id); return; }
    const stage = def.stages[q.stageIdx];
    bus.emit('quest:stageChanged', { id, stage: stage.id, desc: t(stage.descKey) });
    bus.emit('hud:toast', { text: t('quest.newObjective', { what: t(stage.descKey) }) });
    s.addLog(`quest> ${def.titleKey}`);
    this.checkStage(q);
  }

  /** Cele pasywne (collect / custom) sprawdzamy od razu po wejściu w etap. */
  static checkStage(q: QuestState) {
    const def = QUEST_DEFS[q.id]; if (!def) return;
    const o = def.stages[q.stageIdx]?.objective; if (!o) return;
    if (o.type === 'collect') {
      const have = InventorySystem.count(o.item || '');
      if (have >= (o.count || 1)) { q.data.count = o.count || 1; this.advance(q.id); }
    } else if (o.type === 'custom') {
      if (getGame().state.flags[o.flag!]) this.advance(q.id);
    } else if (o.type === 'debtPaid') {
      if (getGame().state.debt.paid >= (o.amount || 1)) this.advance(q.id);
    }
  }

  static complete(id: string) {
    const g = getGame(), s = g.state;
    const q = this.get(id); if (!q) return;
    const def = QUEST_DEFS[id]; if (!def) return;
    q.state = 'done'; q.endedDay = s.time.day;
    s.stats.questsDone += 1;
    const r = def.rewards || {};
    if (r.crowns) { s.gold += r.crowns; s.stats.earned += r.crowns; }
    if (r.items) for (const it of r.items) InventorySystem.add(it, 1);
    if (r.rep) for (const f in r.rep) ReputationSystem.add(f as any, r.rep[f], 'rep.reason.quest');
    if (r.xp) for (const sk in r.xp) SkillsSystem.use(sk, r.xp[sk]);
    if (r.unlockStation) { s.flags['station_' + r.unlockStation] = true; bus.emit('hud:toast', { text: t('quest.stationUnlocked', { what: t('station.' + r.unlockStation) }), tone: 'good' }); }
    if (r.unlockTeacher) { s.flags['teacher_' + r.unlockTeacher] = true; bus.emit('hud:toast', { text: t('quest.teacherUnlocked', { who: t('npc.' + r.unlockTeacher + '.name') }), tone: 'good' }); }
    if (r.flag) s.flags[r.flag] = true;
    if (r.noteKey) bus.emit('notes:add', { key: r.noteKey, kind: 'quest' });
    bus.emit('quest:completed', { id, title: t(def.titleKey) });
    bus.emit('hud:toast', { text: t('quest.done', { title: t(def.titleKey), gold: r.crowns || 0 }), tone: 'good' });
    s.addLog(`quest! ${def.titleKey}`);
  }

  static fail(id: string, reason = 'quest.failed.generic') {
    const s = getGame().state;
    const q = this.get(id); if (!q || q.state !== 'active') return;
    q.state = 'failed'; q.endedDay = s.time.day;
    bus.emit('quest:failed', { id, reason });
    bus.emit('hud:toast', { text: t('quest.failed', { title: t(QUEST_DEFS[id].titleKey), reason: t(reason) }), tone: 'bad' });
  }

  /** Questy z tablicy ogłoszeń — generowane proceduralnie z szablonu. */
  static generateBoard(templateId?: string): { questId: string; title: string; pay: number; desc: string } {
    const s = getGame().state;
    const tpl = templateId ? BOARD_DEFS.find(b => b.id === templateId) : rng.pick(BOARD_DEFS);
    if (!tpl) throw new Error('[quest] brak szablonu tablicy');
    const pay = rng.int(tpl.pay[0], tpl.pay[1]);
    const descKey = rng.pick(tpl.descKeys);
    const questId = `board_${tpl.id}_${s.time.day}`;
    const target = rng.pick(tpl.items || ['bread_loaf']);
    QUEST_DEFS[questId] = {
      id: questId, titleKey: tpl.titleKey, type: tpl.type, giver: 'board',
      journalKey: descKey,
      stages: [{ id: 's1', descKey, objective: { type: 'collect', item: target, count: 1 } }],
      rewards: { crowns: pay, rep: tpl.rep, xp: tpl.xp, noteKey: 'quest.board.note' }
    };
    this.start(questId);
    return { questId, title: t(tpl.titleKey), pay, desc: t(descKey, { what: itemName(target), gold: pay }) };
  }

  static startBoard(templateId: string) { return this.generateBoard(templateId); }

  /** Zakończenia — sprawdzane gdy dług spłacony, gdy John uciekł, gdy umarł. */
  static checkEndings(): EndingDef | null {
    const s = getGame().state;
    const cond = (c: Record<string, any>): boolean => {
      if (c.dead && !s.needs.dead) return false;
      if (c.debtPaid === true && s.debtRemaining > 0) return false;
      if (c.debtPaid === false && s.debtRemaining <= 0) return false;
      if (c.crimeLow && s.stats.crimesCommitted > 3) return false;
      if (c.crimeHigh && s.stats.crimesCommitted < 6) return false;
      if (c.escaped && !s.flags.escaped_island) return false;
      if (c.deadline && s.time.day <= s.debt.dueDay) return false;
      if (c.flag && !s.flags[c.flag]) return false;
      if (c.rep) for (const f in c.rep) if (s.reputation[f as keyof typeof s.reputation] < c.rep[f]) return false;
      return true;
    };
    const order = ['end_death', 'end_captive', 'end_escape', 'end_overthrow', 'end_knights', 'end_crime', 'end_honest'];
    for (const id of order) {
      const e = ENDINGS.find(x => x.id === id);
      if (e && cond(e.cond)) return e;
    }
    return null;
  }

  static triggerEnding(id: string) {
    const s = getGame().state;
    const e = ENDINGS.find(x => x.id === id) || this.checkEndings();
    if (!e || s.ending) return;
    s.ending = e.id;
    bus.emit('game:ending', { id: e.id, name: t(e.nameKey), summary: ReputationSystem.summary() });
  }

  static dailyTick() {
    const s = getGame().state;
    for (const q of this.active()) {
      const def = QUEST_DEFS[q.id];
      if (!def) continue;
      if (def.failCondition === 'deadline' && s.time.day > s.debt.dueDay) this.fail(q.id, 'quest.failed.deadline');
      this.checkStage(q);
    }
  }
}
