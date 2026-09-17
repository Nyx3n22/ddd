import NPCS from '../data/npcs.json';
import { bus } from '../core/EventBus';
import { getGame } from '../core/gameSingleton';
import { t } from '../core/Localization';
import type { FactionId } from '../core/GameState';

/* ============================================================================
   REPUTACJA I RELACJE
   Sześć frakcji (−100..+100) i osobiste relacje z każdym NPC. Zmiany są zawsze
   skutkiem konkretnego czynu widzianego przez kogoś lub opowiedzianego.
   ========================================================================== */

export interface NpcDef {
  id: string; nameKey: string; roleKey: string; age: number; gender: string;
  palette: string; look: any; faction: string; stance: string; important: boolean;
  dialogue: string; merchant?: string; teacher?: string[]; addressKey: string;
  desireKey?: string; secretKey?: string; greetingKeys: string[]; schedule: any[];
}

const NPC_DEFS: Record<string, NpcDef> = {};
for (const n of NPCS.npcs as any[]) NPC_DEFS[n.id] = n;
const NAME_POOL = (NPCS.namePool as any) || {};

export function npcDef(id: string): NpcDef | undefined { return NPC_DEFS[id]; }
export function allNpcDefs() { return Object.values(NPC_DEFS); }
export function namePool() { return NAME_POOL; }
export function npcName(id: string) { return NPC_DEFS[id] ? t(NPC_DEFS[id].nameKey) : t('npc.stranger'); }
export function npcRole(id: string) { return NPC_DEFS[id] ? t(NPC_DEFS[id].roleKey) : ''; }

export const REP_TIERS: Array<{ min: number; key: string }> = [
  { min: 80, key: 'rep.hero' }, { min: 50, key: 'rep.ally' }, { min: 20, key: 'rep.friendly' },
  { min: -19, key: 'rep.neutral' }, { min: -49, key: 'rep.disliked' }, { min: -79, key: 'rep.hostile' },
  { min: -1000, key: 'rep.enemy' }
];

export class ReputationSystem {
  static tier(faction: FactionId): string {
    const v = getGame().state.reputation[faction];
    for (const tier of REP_TIERS) if (v >= tier.min) return t(tier.key);
    return t('rep.enemy');
  }

  static value(faction: FactionId): number { return getGame().state.reputation[faction]; }

  static add(faction: FactionId, amount: number, reason?: string) {
    const s = getGame().state;
    if (!amount) return;
    const before = s.reputation[faction];
    s.reputation[faction] = Math.max(-100, Math.min(100, before + amount));
    const after = s.reputation[faction];
    bus.emit('rep:changed', { faction, amount, before, after, reason });
    if (reason && Math.abs(amount) >= 5) {
      bus.emit('hud:toast', { text: t('rep.toast', { faction: t('faction.' + faction), amount: amount > 0 ? '+' + amount : String(amount), reason: t(reason) }), tone: amount > 0 ? 'good' : 'bad' });
    }
    if (after <= -60 && before > -60) bus.emit('rep:threshold', { faction, tier: 'hostile' });
    if (after >= 60 && before < 60) bus.emit('rep:threshold', { faction, tier: 'ally' });
  }

  /** Relacja z konkretnym człowiekiem (−100..+100). */
  static relation(npcId: string): number { return getGame().state.relations[npcId] || 0; }

  static addRelation(npcId: string, amount: number, reason?: string) {
    const s = getGame().state;
    if (!amount) return;
    s.relations[npcId] = Math.max(-100, Math.min(100, (s.relations[npcId] || 0) + amount));
    bus.emit('relation:changed', { npcId, amount, value: s.relations[npcId], reason });
    // świadek zmienia zdanie o Johnie — plotka niesie się dalej
    if (Math.abs(amount) >= 12 && NPC_DEFS[npcId]) {
      bus.emit('rumor:seed', {
        textKey: amount > 0 ? 'rumor.johnHelped' : 'rumor.johnOffended',
        witness: npcId, severity: Math.min(5, Math.abs(amount) / 8)
      });
    }
  }

  /** Uogólniona reakcja świata: wszyscy w promieniu widzą i zmieniają zdanie. */
  static witnessesReact(witnesses: string[], amount: number, faction?: FactionId, reason?: string) {
    for (const w of witnesses) {
      this.addRelation(w, amount, reason);
      const f = (faction || NPC_DEFS[w]?.faction) as FactionId | undefined;
      if (f) this.add(f, Math.round(amount * 0.35), reason);
    }
  }

  /** Ostateczna ocena świata dla epilogu. */
  static summary(): string {
    const s = getGame().state;
    const pos = (Object.keys(s.reputation) as FactionId[]).filter(f => s.reputation[f] >= 20);
    const neg = (Object.keys(s.reputation) as FactionId[]).filter(f => s.reputation[f] <= -20);
    return t('rep.summary', {
      friends: pos.map(f => t('faction.' + f)).join(', ') || t('rep.none'),
      enemies: neg.map(f => t('faction.' + f)).join(', ') || t('rep.none')
    });
  }
}
