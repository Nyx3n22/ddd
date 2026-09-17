import SKILLS from '../data/skills.json';
import NPCS from '../data/npcs.json';
import { bus } from '../core/EventBus';
import { rng } from '../core/RNG';
import { getGame } from '../core/gameSingleton';
import { t } from '../core/Localization';

/* ============================================================================
   UMIEJĘTNOŚCI I PERKI
   Umiejętności rosną z użycia (nigdy z menu). Perki kupuje się wyłącznie
   u żywego nauczyciela, za złoto i reputację, i uczą się przez N dni
   (brief 0: G otwiera stronę notatnika, nie „drzewko rozwoju”).
   ========================================================================== */

export interface SkillDef { id: string; branch: string; nameKey: string; descKey: string; useKey: string }
export interface PerkEffect { type: string; value: number }
export interface PerkDef {
  id: string; skill: string; nameKey: string; descKey: string;
  reqLevel: number; teacher: string; crowns: number;
  reputation?: Record<string, number>; days: number; effects: PerkEffect[];
}
export interface BranchDef { id: string; nameKey: string; descKey: string }
const BRANCHES = SKILLS.branches as unknown as BranchDef[];
const SKILL_DEFS = SKILLS.skills as SkillDef[];
const PERK_DEFS = SKILLS.perks as PerkDef[];
const LEVEL_XP = SKILLS.levelXp as number[];

const SKILL_MAP: Record<string, SkillDef> = {};
for (const s of SKILL_DEFS) SKILL_MAP[s.id] = s;
const PERK_MAP: Record<string, PerkDef> = {};
for (const p of PERK_DEFS) PERK_MAP[p.id] = p;
const TEACHERS: Record<string, string[]> = {};
for (const n of NPCS.npcs as any[]) if (Array.isArray(n.teacher)) TEACHERS[n.id] = n.teacher;

export function skillDef(id: string) { return SKILL_MAP[id]; }
export function perkDef(id: string) { return PERK_MAP[id]; }
export function allSkills() { return SKILL_DEFS; }
export function allPerks() { return PERK_DEFS; }
export function allBranches() { return BRANCHES; }
export function levelXpTable() { return LEVEL_XP; }
export function perksFor(skillId: string) { return PERK_DEFS.filter(p => p.skill === skillId); }
/** Perki, których ten NPC może nauczyć (wg skills.json: perk.teacher). */
export function perksOfTeacher(npcId: string) { return PERK_DEFS.filter(p => p.teacher === npcId); }
/** Umiejętności, w których ten NPC się specjalizuje (wg npcs.json: teacher). */
export function skillsOfTeacher(npcId: string) { return TEACHERS[npcId] || []; }

export class SkillsSystem {
  static xp(id: string): number { return getGame().state.skills.xp[id] || 0; }

  static level(id: string): number {
    const xp = this.xp(id);
    let lv = 1;
    for (let i = 0; i < LEVEL_XP.length; i++) if (xp >= LEVEL_XP[i]) lv = i + 2;
    return Math.min(10, lv);
  }

  static progress(id: string): number {
    const lv = this.level(id);
    if (lv >= 10) return 1;
    const prev = LEVEL_XP[lv - 2] || 0;
    const next = LEVEL_XP[lv - 1];
    return Math.max(0, Math.min(1, (this.xp(id) - prev) / Math.max(1, next - prev)));
  }

  static hasPerk(id: string) { return getGame().state.skills.perks.includes(id); }

  /** Suma wartości efektu perka (np. parryWindow, priceMod). */
  static effect(type: string): number {
    let v = 0;
    for (const pid of getGame().state.skills.perks) {
      const p = PERK_MAP[pid]; if (!p) continue;
      for (const e of p.effects) if (e.type === type) v += e.value;
    }
    return v;
  }

  /** Użycie umiejętności w świecie — jedyna droga do XP. */
  static use(id: string, amount = 10, silent = false) {
    const s = getGame().state;
    if (!SKILL_MAP[id]) return;
    const before = this.level(id);
    const dim = Math.max(0.2, 1 - (before - 1) * 0.08);   // wyższy poziom = wolniejszy przyrost
    const gain = amount * dim * (0.75 + rng.float() * 0.5);
    s.skills.xp[id] = (s.skills.xp[id] || 0) + gain;
    const after = this.level(id);
    if (after > before) {
      bus.emit('skill:levelUp', { id, level: after, name: t(SKILL_MAP[id].nameKey) });
      if (!silent) bus.emit('hud:toast', { text: t('msg.skillUp', { skill: t(SKILL_MAP[id].nameKey), level: after }), tone: 'good' });
    }
    bus.emit('skill:used', { id, gain });
  }

  /** Czy John może uczyć się perka u danego nauczyciela (spełnione wymagania). */
  static canLearn(perkId: string, npcId: string): { ok: boolean; reason?: string } {
    const s = getGame().state;
    const p = PERK_MAP[perkId];
    if (!p) return { ok: false, reason: 'unknown' };
    if (p.teacher !== npcId) return { ok: false, reason: 'wrongTeacher' };
    if (this.hasPerk(perkId)) return { ok: false, reason: 'known' };
    if (this.level(p.skill) < p.reqLevel) return { ok: false, reason: t('train.reqLevel', { level: p.reqLevel }) };
    if (s.gold < p.crowns) return { ok: false, reason: t('train.reqGold', { gold: p.crowns }) };
    if (s.skills.training) return { ok: false, reason: t('train.busy') };
    for (const f in (p.reputation || {})) {
      if ((s.reputation as any)[f] < (p.reputation as any)[f]) return { ok: false, reason: t('train.reqRep') };
    }
    return { ok: true };
  }

  static startTraining(perkId: string, npcId: string): boolean {
    const s = getGame().state;
    const check = this.canLearn(perkId, npcId);
    if (!check.ok) { bus.emit('hud:toast', { text: check.reason || t('train.no'), tone: 'bad' }); return false; }
    const p = PERK_MAP[perkId];
    s.gold -= p.crowns;
    s.skills.training = { perkId, daysLeft: p.days, teacher: npcId };
    bus.emit('hud:toast', { text: t('train.started', { perk: t(p.nameKey), days: p.days }) });
    bus.emit('training:start', { perkId, npcId, days: p.days });
    return true;
  }

  /** Wywoływane o świcie — trening trwa przez kolejne dni. */
  static advanceTraining() {
    const s = getGame().state;
    const tr = s.skills.training;
    if (!tr) return;
    tr.daysLeft -= 1;
    if (tr.daysLeft <= 0) {
      s.skills.perks.push(tr.perkId);
      const p = PERK_MAP[tr.perkId];
      s.skills.training = null;
      bus.emit('hud:toast', { text: t('train.done', { perk: t(p.nameKey) }), tone: 'good' });
      bus.emit('training:done', { perkId: tr.perkId });
    } else {
      bus.emit('hud:toast', { text: t('train.progress', { days: tr.daysLeft }) });
    }
  }
}
