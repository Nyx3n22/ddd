import { bus } from '../core/EventBus';
import { rng } from '../core/RNG';
import { getGame } from '../core/gameSingleton';
import { t } from '../core/Localization';
import { npcDef } from './ReputationSystem';

/* ============================================================================
   PLOTKI
   Informacja rozchodzi się przez ludzi: świadek → rozmówca → następny dzień.
   Gracz może ją usłyszeć w karczmie, kupić od żebraka albo sam ją zasiał.
   ========================================================================== */

export interface RumorDef {
  id: string; textKey: string; severity: number; spreadDays: number;
  rep?: Record<string, number>; flag?: string;
}

const RUMOR_DEFS: Record<string, RumorDef> = {
  'rumor.customsMissing':  { id: 'customsMissing', textKey: 'rumor.customsMissing', severity: 3, spreadDays: 2, flag: 'knows_salt_missing' },
  'rumor.johnThreatened':  { id: 'johnThreatened', textKey: 'rumor.johnThreatened', severity: 2, spreadDays: 1, rep: { villagers: -4 } },
  'rumor.johnBetrayed':    { id: 'johnBetrayed',   textKey: 'rumor.johnBetrayed',   severity: 4, spreadDays: 1, rep: { smugglers: -10 } },
  'rumor.johnLied':        { id: 'johnLied',       textKey: 'rumor.johnLied',       severity: 2, spreadDays: 2 },
  'rumor.guardBullied':    { id: 'guardBullied',   textKey: 'rumor.guardBullied',   severity: 3, spreadDays: 1, rep: { cityGuard: -6 } },
  'rumor.johnHelped':      { id: 'johnHelped',     textKey: 'rumor.johnHelped',     severity: 2, spreadDays: 2, rep: { villagers: 3 } },
  'rumor.johnOffended':    { id: 'johnOffended',   textKey: 'rumor.johnOffended',   severity: 2, spreadDays: 2, rep: { villagers: -3 } },
  'rumor.johnFled':        { id: 'johnFled',       textKey: 'rumor.johnFled',       severity: 3, spreadDays: 1, rep: { cityGuard: -5 } },
  'rumor.crimeSeen':       { id: 'crimeSeen',      textKey: 'rumor.crimeSeen',      severity: 3, spreadDays: 1, rep: { villagers: -3 } },
  'rumor.execution':       { id: 'execution',      textKey: 'rumor.execution',      severity: 2, spreadDays: 3 },
  'rumor.plague':          { id: 'plague',         textKey: 'rumor.plague',         severity: 4, spreadDays: 2, rep: { church: 2 } },
  'rumor.knightsLevy':     { id: 'knightsLevy',    textKey: 'rumor.knightsLevy',    severity: 3, spreadDays: 2, rep: { wildKnights: -3 } },
  'rumor.shipArrives':     { id: 'shipArrives',    textKey: 'rumor.shipArrives',    severity: 1, spreadDays: 1 },
  'rumor.martaSatchel':    { id: 'martaSatchel',   textKey: 'rumor.martaSatchel',   severity: 2, spreadDays: 2, flag: 'knows_marta_satchel' },
  'rumor.wolves':          { id: 'wolves',         textKey: 'rumor.wolves',         severity: 2, spreadDays: 3 },
  'rumor.abbeyLight':      { id: 'abbeyLight',     textKey: 'rumor.abbeyLight',     severity: 3, spreadDays: 4 }
};

export function rumorDef(id: string) { return RUMOR_DEFS[id]; }
export function allRumorDefs() { return Object.values(RUMOR_DEFS); }

export class RumorSystem {
  /** Zasianie plotki — przez świadka lub przez świat. */
  static seed(textKey: string, opts: { witness?: string; severity?: number } = {}) {
    const s = getGame().state;
    const def = Object.values(RUMOR_DEFS).find(r => r.textKey === textKey);
    if (s.rumors.some(r => r.textKey === textKey && r.known)) return;
    s.rumors.push({
      textKey, day: s.time.day, spreadDay: s.time.day + (def?.spreadDays ?? 1),
      known: false, severity: opts.severity ?? def?.severity ?? 2,
      witness: opts.witness, faction: def?.rep ? (Object.keys(def.rep)[0] as any) : undefined
    });
    bus.emit('rumor:added', { textKey });
  }

  /** Plotka staje się powszechna — wpływa na świat. */
  static spreadDaily() {
    const s = getGame().state;
    for (const r of s.rumors) {
      if (r.known) continue;
      if (s.time.day >= r.spreadDay) {
        r.known = true;
        const def = Object.values(RUMOR_DEFS).find(x => x.textKey === r.textKey);
        if (def?.rep) for (const f in def.rep) {
          bus.emit('rep:add', { faction: f, amount: def.rep![f], reason: 'rep.reason.rumor' });
        }
        if (def?.flag && !s.flags[def.flag]) s.flags[def.flag] = true;
        bus.emit('rumor:spread', { textKey: r.textKey });
      }
    }
    // plotki gasną po 6 dniach
    s.rumors = s.rumors.filter(r => s.time.day - r.day <= 6);
  }

  /** Losowa plotka na dziś — do podsłuchania w karczmie i na rynku. */
  static dailyAmbient(): string {
    const s = getGame().state;
    const pool: string[] = [];
    for (const r of s.rumors) if (r.known) pool.push(r.textKey);
    if (s.weather.plague) pool.push('rumor.plague');
    if (s.crime.wanted > 0) pool.push('rumor.johnFled');
    if (s.time.day % 5 === 0) pool.push('rumor.knightsLevy');
    if (s.economy.events.length) pool.push('rumor.shipArrives');
    if (s.flags.knows_execution) pool.push('rumor.execution');
    pool.push('rumor.wolves', 'rumor.customsMissing', 'rumor.abbeyLight', 'rumor.martaSatchel');
    const key = rng.pick(pool);
    const def = Object.values(RUMOR_DEFS).find(x => x.textKey === key);
    if (def && !s.rumors.some(r => r.textKey === key)) this.seed(key, {});
    return key;
  }

  /** Czy John zna tę plotkę (może ją wykorzystać w dialogu). */
  static known(textKey: string): boolean {
    const s = getGame().state;
    const r = s.rumors.find(x => x.textKey === textKey);
    if (r?.known) return true;
    const def = Object.values(RUMOR_DEFS).find(x => x.textKey === textKey);
    return !!(def?.flag && s.flags[def.flag]);
  }

  static text(textKey: string): string { return t(textKey); }

  /** Ile plotek krąży o Johnie — wpływa na to, jak jest witany. */
  static aboutJohn(): number {
    return getGame().state.rumors.filter(r => r.known && /john/i.test(r.textKey)).length;
  }

  static witnessName(id?: string) { return id && npcDef(id) ? t(npcDef(id)!.nameKey) : t('npc.someone'); }
}
