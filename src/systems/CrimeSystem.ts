import { bus } from '../core/EventBus';
import { rng } from '../core/RNG';
import { getGame } from '../core/gameSingleton';
import { t } from '../core/Localization';
import { ReputationSystem, npcDef } from './ReputationSystem';
import { SkillsSystem } from './SkillsSystem';
import { InventorySystem, itemName } from './InventorySystem';

/* ============================================================================
   PRZESTĘPSTWO I STRAŻ
   Nie ma „poziomu poszukiwania” z powietrza: jest świadek, jest czyn, jest
   reakcja. Kara to konsekwencja (grzywna / dyby / ucieczka), nie blokada UI.
   ========================================================================== */

export interface CrimeDef {
  id: string; nameKey: string; fine: number; rep: number; heat: number;
  jailDays?: number; needsWitness?: boolean;
}

export const CRIMES: Record<string, CrimeDef> = {
  theft:       { id: 'theft',       nameKey: 'crime.theft',       fine: 30,  rep: -8,  heat: 1 },
  pickpocket:  { id: 'pickpocket',  nameKey: 'crime.pickpocket',  fine: 20,  rep: -6,  heat: 1 },
  murder:      { id: 'murder',      nameKey: 'crime.murder',      fine: 200, rep: -35, heat: 5, jailDays: 2 },
  assault:     { id: 'assault',     nameKey: 'crime.assault',     fine: 60,  rep: -18, heat: 3 },
  trespass:    { id: 'trespass',    nameKey: 'crime.trespass',    fine: 15,  rep: -3,  heat: 1 },
  smuggling:   { id: 'smuggling',   nameKey: 'crime.smuggling',   fine: 120, rep: -12, heat: 3, jailDays: 1 },
  bribery:     { id: 'bribery',     nameKey: 'crime.bribery',     fine: 40,  rep: -10, heat: 2 },
  threat:      { id: 'threat',      nameKey: 'crime.threat',      fine: 25,  rep: -8,  heat: 1 },
  insult:      { id: 'insult',      nameKey: 'crime.insult',      fine: 10,  rep: -4,  heat: 0 },
  informing:   { id: 'informing',   nameKey: 'crime.informing',   fine: 0,   rep: 0,   heat: 0 },
  possession:  { id: 'possession',  nameKey: 'crime.possession',  fine: 50,  rep: -8,  heat: 2 },
  vandalism:   { id: 'vandalism',   nameKey: 'crime.vandalism',   fine: 25,  rep: -6,  heat: 1 }
};

export class CrimeSystem {
  static def(id: string) { return CRIMES[id] || CRIMES.theft; }

  /** Ktoś zobaczył czyn. */
  static witness(npcId: string, crimeType: string, x: number, y: number) {
    const s = getGame().state;
    if (!npcId || !s.alive(npcId)) return;
    const already = s.crime.witnesses.find(w => w.npcId === npcId && w.crimeType === crimeType);
    if (already) return;
    s.crime.witnesses.push({ npcId, crimeType, day: s.time.day, x, y, reported: false });
    bus.emit('crime:witnessed', { npcId, crimeType });
    bus.emit('hud:toast', { text: t('crime.seen', { who: t(npcDef(npcId)?.nameKey || 'npc.stranger'), what: t(this.def(crimeType).nameKey) }), tone: 'bad' });
    // świadek biegnie do straży albo rozpowiada
    const def = npcDef(npcId);
    // odwaga: strażnicy i ludzie o wysokiej postawie biegną po straże
    const stance = typeof def?.stance === 'number' ? def.stance : 0;
    const brave = def?.faction === 'cityGuard' || def?.faction === 'wildKnights' || stance <= -40;
    if (brave || rng.chance(0.55)) this.report(npcId, crimeType);
    else bus.emit('rumor:seed', { textKey: 'rumor.crimeSeen', witness: npcId, severity: this.def(crimeType).heat });
  }

  static report(npcId: string, crimeType: string) {
    const s = getGame().state;
    const w = s.crime.witnesses.find(x => x.npcId === npcId && x.crimeType === crimeType);
    if (w) w.reported = true;
    const def = this.def(crimeType);
    s.crime.wanted = Math.min(5, s.crime.wanted + def.heat);
    s.crime.bounty += def.fine;
    s.crime.crimes.push({ type: crimeType, day: s.time.day, location: s.scene });
    s.stats.crimesCommitted += 1;
    ReputationSystem.add('cityGuard', def.rep, 'rep.reason.' + crimeType);
    ReputationSystem.add('villagers', Math.round(def.rep * 0.4), 'rep.reason.' + crimeType);
    bus.emit('crime:reported', { npcId, crimeType, wanted: s.crime.wanted });
    bus.emit('hud:toast', { text: t('crime.reported', { what: t(def.nameKey) }), tone: 'bad' });
    if (s.crime.wanted >= 3) bus.emit('world:guardsAlerted', { level: s.crime.wanted });
  }

  static isWanted() { return getGame().state.crime.wanted > 0; }

  /** Strażnik zatrzymuje Johna — trzy wyjścia zamiast twardego bloku. */
  static confront(guardNpcId: string) {
    const s = getGame().state;
    if (!this.isWanted()) return false;
    bus.emit('dialogue:force', { npcId: guardNpcId, node: 'guard_confront' });
    return true;
  }

  static fineTotal() {
    const s = getGame().state;
    let total = s.crime.bounty;
    for (const w of s.crime.witnesses) if (w.reported) total += Math.round(this.def(w.crimeType).fine * 0.5);
    return total;
  }

  static payFine(): boolean {
    const g = getGame(), s = g.state;
    const total = this.fineTotal();
    if (s.gold < total) { bus.emit('hud:toast', { text: t('crime.cantPay', { gold: total }), tone: 'bad' }); return false; }
    s.gold -= total; s.crime.bounty = 0; s.crime.wanted = 0;
    s.crime.witnesses = s.crime.witnesses.filter(w => !w.reported);
    s.crime.finesPaid += total;
    s.stats.spent += total;
    // konfiskata rzeczy oznaczonych jako kradzione
    const stolen = s.inventory.items.filter(i => i.stolen);
    for (const st of stolen) InventorySystem.remove(st.id, st.qty, true);
    if (stolen.length) bus.emit('hud:toast', { text: t('crime.confiscated', { what: stolen.map(x => itemName(x.id)).join(', ') }), tone: 'bad' });
    bus.emit('hud:toast', { text: t('crime.finePaid', { gold: total }), tone: 'good' });
    bus.emit('crime:cleared', { how: 'fine' });
    return true;
  }

  /** Dyby / noc w lochu: strata dni, ale czysta karta. */
  static punish(days = 1) {
    const g = getGame(), s = g.state;
    s.crime.wanted = 0; s.crime.bounty = 0; s.crime.witnesses = [];
    s.crime.arrests += 1; s.stats.arrests += 1;
    s.crime.jailUntilDay = s.time.day + days;
    const stolen = s.inventory.items.filter(i => i.stolen);
    for (const st of stolen) InventorySystem.remove(st.id, st.qty, true);
    // strażnik zabiera też część złota „na opłaty sądowe”
    const fee = Math.round(s.gold * 0.15);
    s.gold -= fee;
    ReputationSystem.add('villagers', -4, 'rep.reason.punished');
    bus.emit('crime:punished', { days, fee });
    bus.emit('hud:toast', { text: t('crime.punished', { days, fee }), tone: 'bad' });
    return days;
  }

  static inJail() { return getGame().state.time.day < getGame().state.crime.jailUntilDay; }

  /** Dowody zostają w świecie — ktoś może je znaleźć. */
  static leaveEvidence(kind: string, x: number, y: number, scene: string) {
    const s = getGame().state;
    s.crime.evidence.push({ kind, x, y, scene, day: s.time.day });
    bus.emit('crime:evidence', { kind, x, y });
  }

  /** Codziennie: świadkowie rozpowiadają, straż patroluje, sprawy przedawniają się. */
  static dailyTick() {
    const s = getGame().state;
    // przedawnienie: po 4 dniach bez nowego czynu sprawa cichnie
    const lastCrime = s.crime.crimes[s.crime.crimes.length - 1]?.day ?? 0;
    if (s.crime.wanted > 0 && s.time.day - lastCrime >= 4) {
      s.crime.wanted = Math.max(0, s.crime.wanted - 1);
      if (s.crime.wanted === 0) {
        s.crime.bounty = 0; s.crime.witnesses = [];
        bus.emit('hud:toast', { text: t('crime.cooled') });
      }
    }
    // dowody starsze niż 3 dni giną w błocie
    s.crime.evidence = s.crime.evidence.filter(e => s.time.day - e.day <= 3);
    // strażnik, który znalazł dowód, zgłasza
    for (const e of s.crime.evidence) {
      if (rng.chance(0.12) && !s.crime.witnesses.some(w => w.crimeType === 'evidence_' + e.kind)) {
        s.crime.wanted = Math.min(5, s.crime.wanted + 1);
        bus.emit('hud:toast', { text: t('crime.evidenceFound', { what: t('crime.' + e.kind) }), tone: 'bad' });
      }
    }
    SkillsSystem.use('streetwise', this.isWanted() ? 0 : 2, true);
  }

  /** Ucieczka przed strażą — kosztowna i widoczna. */
  static flee() {
    const s = getGame().state;
    ReputationSystem.add('cityGuard', -12, 'rep.reason.fled');
    s.crime.wanted = Math.min(5, s.crime.wanted + 1);
    bus.emit('rumor:seed', { textKey: 'rumor.johnFled', severity: 3 });
    bus.emit('hud:toast', { text: t('crime.fled'), tone: 'bad' });
  }
}
