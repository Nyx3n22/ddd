import CRAFT from '../data/crafting.json';
import { bus } from '../core/EventBus';
import { rng } from '../core/RNG';
import { getGame } from '../core/gameSingleton';
import { t } from '../core/Localization';
import { InventorySystem, itemDef, itemName } from './InventorySystem';
import { SkillsSystem } from './SkillsSystem';

/* ============================================================================
   RZEMIOSŁO
   Bez skrótu klawiszowego. Trzeba podejść do kowadła, stołu, kotła albo
   paleniska i nacisnąć E. Jakość wyniku zależy od umiejętności, narzędzia,
   materiałów i tego, czy John się spieszy (brief 0 i 6).
   ========================================================================== */

export interface StationDef {
  id: string; nameKey: string; scene: string; prop: string;
  skill: string; tool: string | null; fuel: string | null; timeMin: number;
}
export interface RecipeIngredient { id: string; qty: number }
export interface RecipeDef {
  id: string; station: string; out: string; qty: number; in: RecipeIngredient[];
  skillLevel: number; qualityBase: number; repair?: string;
}

const STATIONS: Record<string, StationDef> = {};
for (const s of CRAFT.stations as any[]) STATIONS[s.id] = s;
const RECIPES: Record<string, RecipeDef> = {};
for (const r of CRAFT.recipes as any[]) RECIPES[r.id] = r;

export function stationDef(id: string) { return STATIONS[id]; }
export function allStations() { return Object.values(STATIONS); }
export function recipesFor(stationId: string) { return Object.values(RECIPES).filter(r => r.station === stationId); }

export class CraftingSystem {
  static canCraft(recipeId: string): { ok: boolean; reason?: string; quality?: number } {
    const s = getGame().state;
    const r = RECIPES[recipeId];
    if (!r) return { ok: false, reason: t('craft.unknown') };
    const st = STATIONS[r.station];
    if (!st) return { ok: false, reason: t('craft.noStation') };
    if (s.flags['station_locked_' + st.id] === false || (st.id === 'forgeWork' && !s.flags.station_forgeWork && !s.flags.coal_delivered)) {
      // kowadło Orlika odblokowuje się po dostawie węgla (quest) — konsekwencja, nie blokada
    }
    const lvl = SkillsSystem.level(st.skill);
    if (lvl < r.skillLevel) return { ok: false, reason: t('craft.reqSkill', { skill: t('skill.' + st.skill), level: r.skillLevel, have: lvl }) };
    if (st.tool && !InventorySystem.has(st.tool)) return { ok: false, reason: t('craft.reqTool', { what: itemName(st.tool) }) };
    if (st.fuel && !InventorySystem.has(st.fuel)) return { ok: false, reason: t('craft.reqFuel', { what: itemName(st.fuel) }) };
    for (const ing of r.in) {
      if (!InventorySystem.has(ing.id, ing.qty)) return { ok: false, reason: t('craft.reqMaterial', { what: itemName(ing.id), qty: ing.qty, have: InventorySystem.count(ing.id) }) };
    }
    if (s.needs.stamina < 12) return { ok: false, reason: t('craft.tired') };
    if (s.needs.fatigue > 92) return { ok: false, reason: t('craft.exhausted') };
    return { ok: true, quality: this.quality(r, st) };
  }

  static quality(r: RecipeDef, st: StationDef): number {
    const s = getGame().state;
    const lvl = SkillsSystem.level(st.skill);
    const perk = 1 + SkillsSystem.effect('craftQuality');
    const light = s.time.isNight() && !s.needs.torchLit ? 0.75 : 1;
    const fatigue = s.needs.fatigue > 75 ? 0.9 : 1;
    const drunk = s.flags.drunk ? 1 - s.flags.drunk * 0.35 : 1;
    const pain = 1 - Math.min(0.4, s.injuries.reduce((a, i) => a + i.severity * 0.12, 0));
    const base = r.qualityBase + (lvl - r.skillLevel) * 0.09;
    return Math.max(0.05, Math.min(1, base * perk * light * fatigue * drunk * pain));
  }

  static craft(recipeId: string): boolean {
    const g = getGame(), s = g.state;
    const check = this.canCraft(recipeId);
    if (!check.ok) { bus.emit('hud:toast', { text: check.reason!, tone: 'bad' }); return false; }
    const r = RECIPES[recipeId];
    const st = STATIONS[r.station];
    for (const ing of r.in) InventorySystem.remove(ing.id, ing.qty);
    if (st.fuel) InventorySystem.remove(st.fuel, 1);
    s.needs.stamina = Math.max(0, s.needs.stamina - 14);
    s.needs.fatigue = Math.min(100, s.needs.fatigue + 4);
    s.time.advanceMinutes(st.timeMin);
    SkillsSystem.use(st.skill, 18 + r.skillLevel * 6);

    if (r.repair) {
      const q = check.quality!;
      if (rng.chance(0.35 + q * 0.6)) {
        InventorySystem.remove(r.out, 1);
        InventorySystem.add(r.repair, 1, { quality: q });
        bus.emit('hud:toast', { text: t('craft.repaired', { what: itemName(r.repair) }), tone: 'good' });
      } else {
        bus.emit('hud:toast', { text: t('craft.repairFailed', { what: itemName(r.out) }), tone: 'bad' });
        InventorySystem.add('scrap_iron', 1);
      }
    } else {
      const q = check.quality!;
      const bonus = rng.chance(q * 0.5) ? 1 : 0;
      InventorySystem.add(r.out, r.qty + bonus, { quality: q });
      bus.emit('hud:toast', {
        text: t('craft.made', {
          what: itemName(r.out), qty: r.qty + bonus,
          quality: t(q > 0.75 ? 'craft.qFine' : q > 0.45 ? 'craft.qGood' : q > 0.25 ? 'craft.qPoor' : 'craft.qShoddy')
        }), tone: q > 0.4 ? 'good' : 'neutral'
      });
    }
    s.stats.crafted += 1;
    bus.emit('craft:done', { recipeId, station: st.id });
    return true;
  }

  /** Dopasowanie stanowiska po nazwie obiektu w scenie (prop lub id stanowiska). */
  static stationAt(scene: string, propId: string): StationDef | undefined {
    return Object.values(STATIONS).find(st => (st.prop === propId || st.id === propId) && (st.scene === scene || st.scene === 'world'));
  }
}
