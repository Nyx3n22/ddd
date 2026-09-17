import ITEMS from '../data/items.json';
import { bus } from '../core/EventBus';
import { rng } from '../core/RNG';
import { getGame } from '../core/gameSingleton';
import type { ItemStack } from '../core/GameState';
import { t } from '../core/Localization';

/* ============================================================================
   EKWIPUNEK — realny plecak: waga (kg), objętość (litry), stosy, kradzione,
   jakość wykonania. Bez torby podręcznej — rzeczy poza nią leżą w świecie.
   ========================================================================== */

export interface WeaponStats {
  dmg: number; stam: number; speed: number; reach: number; arc: number;
  vsArmor: number; skill: string; parryWindow: number;
  ranged?: boolean; ammo?: string; reload?: number;
}
export interface ArmorStats { mit: number; stamPen: number; block: number }

export interface ItemDef {
  id: string; nameKey: string; descKey: string; icon: string;
  weight: number; volume: number; value: number;
  cat: string; tags: string[]; stack: number;
  weapon?: WeaponStats;
  armor?: ArmorStats;
  feed?: number; quench?: number; warmth?: number; courage?: number;
  heal?: number; stopsBleeding?: boolean; curesInfection?: boolean; curesDisease?: boolean;
  fixes?: string; burns?: number; uses?: number;
  craft?: string[]; mapRegion?: string;
}

const DEFS: Record<string, ItemDef> = {};
for (const it of ITEMS.items as any[]) DEFS[it.id] = it;

export function itemDef(id: string): ItemDef | undefined { return DEFS[id]; }
export function itemName(id: string): string { return DEFS[id] ? t(DEFS[id].nameKey) : id; }
export function allItemDefs(): ItemDef[] { return Object.values(DEFS); }

export class InventorySystem {
  /** Ile wolnego ciężaru / objętości. */
  static usage(): { kg: number; kgMax: number; L: number; LMax: number } {
    const s = getGame().state;
    let kg = 0, L = 0;
    for (const st of s.inventory.items) {
      const d = DEFS[st.id]; if (!d) continue;
      kg += d.weight * st.qty; L += d.volume * st.qty;
    }
    // wyposażone nie liczy się do objętości plecaka, ale liczy do ciężaru
    const eq = s.inventory.equipped;
    for (const k of Object.keys(eq) as Array<keyof typeof eq>) {
      const id = eq[k]; if (!id) continue;
      const d = DEFS[id]; if (d) kg += d.weight;
    }
    return { kg, kgMax: s.inventory.capacityKg, L, LMax: s.inventory.capacityL };
  }

  static overEncumbered(): boolean {
    const u = this.usage();
    return u.kg > u.kgMax * 1.15 || u.L > u.LMax * 1.2;
  }

  static count(id: string): number {
    const s = getGame().state;
    let n = 0;
    for (const st of s.inventory.items) if (st.id === id) n += st.qty;
    return n;
  }

  static has(id: string, qty = 1): boolean { return this.count(id) >= qty; }

  static add(id: string, qty = 1, opts?: Partial<ItemStack>): boolean {
    const g = getGame(), s = g.state;
    const d = DEFS[id];
    if (!d) { console.warn('[inv] nieznany przedmiot', id); return false; }
    const u = this.usage();
    const needKg = d.weight * qty, needL = d.volume * qty;
    const kgFull = u.kg + needKg > u.kgMax * 1.2;
    const volFull = u.L + needL > u.LMax * 1.2;
    if (kgFull || volFull) {
      bus.emit('inventory:full', { id, qty, kgFull, volFull, msg: t('inv.full', { what: t(d.nameKey) }) });
      return false;
    }
    if (d.stack > 1) {
      let left = qty;
      for (const st of s.inventory.items) {
        if (st.id !== id) continue;
        const room = d.stack - st.qty;
        if (room <= 0) continue;
        const put = Math.min(room, left);
        st.qty += put; left -= put;
        if (left <= 0) break;
      }
      while (left > 0) {
        const put = Math.min(d.stack, left);
        s.inventory.items.push({ id, qty: put, ...opts });
        left -= put;
      }
    } else {
      for (let i = 0; i < qty; i++) s.inventory.items.push({ id, qty: 1, ...opts });
    }
    if (!s.notes.items.includes(id) && !s.notes.blurred.includes(id)) {
      s.notes.items.push(id);
      bus.emit('notes:discovered', { kind: 'item', id });
    }
    bus.emit('inventory:changed', { added: id, qty });
    return true;
  }

  static remove(id: string, qty = 1, onlyStolen = false): number {
    const s = getGame().state;
    let left = qty, removed = 0;
    for (let i = s.inventory.items.length - 1; i >= 0 && left > 0; i--) {
      const st = s.inventory.items[i];
      if (st.id !== id) continue;
      if (onlyStolen && !st.stolen) continue;
      const take = Math.min(st.qty, left);
      st.qty -= take; left -= take; removed += take;
      if (st.qty <= 0) s.inventory.items.splice(i, 1);
    }
    if (removed > 0) {
      // zdjęcie z wyposażenia jeśli nie ma już ani jednej sztuki
      if (this.count(id) === 0) {
        const eq = s.inventory.equipped;
        for (const k of Object.keys(eq) as Array<keyof typeof eq>) if (eq[k] === id) eq[k] = null;
      }
      bus.emit('inventory:changed', { removed: id, qty: removed });
    }
    return removed;
  }

  static equip(id: string): boolean {
    const s = getGame().state;
    const d = DEFS[id];
    if (!d || !this.has(id)) return false;
    const eq = s.inventory.equipped;
    if (d.tags.includes('shield')) eq.offhand = id;
    else if (d.tags.includes('light')) eq.offhand = id;
    else if (d.weapon) eq.weapon = id;
    else if (d.tags.includes('head')) eq.head = id;
    else if (d.tags.includes('body') || d.cat === 'armor' || d.cat === 'clothing') eq.body = id;
    else return false;
    bus.emit('inventory:equip', { id });
    bus.emit('inventory:changed', {});
    return true;
  }

  static unequip(slot: 'weapon' | 'offhand' | 'body' | 'head') {
    const s = getGame().state;
    if (s.inventory.equipped[slot]) { s.inventory.equipped[slot] = null; bus.emit('inventory:changed', {}); }
  }

  static equippedDef(slot: 'weapon' | 'offhand' | 'body' | 'head'): ItemDef | undefined {
    const id = getGame().state.inventory.equipped[slot];
    return id ? DEFS[id] : undefined;
  }

  static use(id: string): boolean {
    const g = getGame(), s = g.state;
    const d = DEFS[id];
    if (!d || !this.has(id)) return false;

    if (d.feed) {
      s.needs.hunger = Math.min(100, s.needs.hunger + d.feed);
      if (d.tags.includes('riskPoison') && rng.chance(0.18)) {
        s.diseases.push({ id: 'stomach', severity: 0.4, dayStart: s.time.day, treated: false });
        bus.emit('hud:toast', { text: t('msg.poisonedFood'), tone: 'bad' });
      }
      this.remove(id, 1);
      bus.emit('hud:toast', { text: t('msg.ate', { what: t(d.nameKey) }) });
      return true;
    }
    if (d.quench) {
      s.needs.thirst = Math.min(100, s.needs.thirst + d.quench);
      if (d.courage) {
        s.flags.drunk = Math.min(1, (s.flags.drunk || 0) + d.courage);
        bus.emit('player:drunk', { level: s.flags.drunk });
      }
      // bukłak zostaje, piwo nie
      if (!d.tags.includes('reusable')) this.remove(id, 1);
      bus.emit('hud:toast', { text: t('msg.drank', { what: t(d.nameKey) }) });
      return true;
    }
    if (d.heal || d.stopsBleeding || d.curesInfection || d.curesDisease) {
      if (d.heal) s.needs.health = Math.min(s.needs.maxHealth, s.needs.health + d.heal);
      for (const inj of s.injuries) {
        if (d.stopsBleeding) { inj.bleeding = 0; inj.bandaged = true; }
        if (d.curesInfection) inj.infected = false;
        if (d.fixes && inj.type === d.fixes) { inj.splinted = true; inj.severity = Math.max(0.1, inj.severity - 0.5); }
      }
      if (d.curesDisease) for (const dis of s.diseases) dis.treated = true;
      this.remove(id, 1);
      bus.emit('hud:toast', { text: t('msg.usedMedicine'), tone: 'good' });
      return true;
    }
    if (d.warmth) {
      s.needs.warmth = Math.min(100, s.needs.warmth + d.warmth);
      bus.emit('hud:toast', { text: t('msg.warmed') });
      return true;
    }
    if (d.tags.includes('light')) {
      s.needs.torchLit = !s.needs.torchLit;
      if (s.needs.torchLit) {
        if (s.needs.torchFuel <= 0) {
          if (!this.has('flint_steel')) { bus.emit('hud:toast', { text: t('msg.noFlint'), tone: 'bad' }); s.needs.torchLit = false; return false; }
          s.needs.torchFuel = d.burns || 60;
          this.remove(id, 1);
        }
        this.equip('torch');
      }
      bus.emit('player:torch', { lit: s.needs.torchLit });
      bus.emit('hud:toast', { text: s.needs.torchLit ? t('msg.torchOn') : t('msg.torchOff') });
      return true;
    }
    if (d.weapon || d.cat === 'armor' || d.cat === 'clothing' || d.tags.includes('shield')) {
      const eq = s.inventory.equipped;
      const cur = d.weapon ? eq.weapon : d.tags.includes('head') ? eq.head : eq.body;
      if (cur === id) { this.unequip(d.weapon ? 'weapon' : d.tags.includes('head') ? 'head' : 'body'); return true; }
      return this.equip(id);
    }
    if (d.tags.includes('notes') || d.tags.includes('map')) return true;   // otwierane klawiszem w świecie
    if (d.cat === 'document') { bus.emit('notes:read', { id }); return true; }
    bus.emit('hud:toast', { text: t('msg.cantUse', { what: t(d.nameKey) }) });
    return false;
  }

  /** Upuszczenie przedmiotu na ziemię (tworzy obiekt świata). */
  static drop(id: string, qty = 1, x?: number, y?: number): boolean {
    const removed = this.remove(id, qty);
    if (removed <= 0) return false;
    bus.emit('world:dropItem', { id, qty: removed, x, y });
    return true;
  }

  /** Wartość całego ekwipunku (do podsumowań / zastawu). */
  static totalValue(onlyStolen = false): number {
    const s = getGame().state;
    let v = 0;
    for (const st of s.inventory.items) {
      if (onlyStolen && !st.stolen) continue;
      const d = DEFS[st.id]; if (!d) continue;
      v += d.value * st.qty;
    }
    return Math.round(v);
  }

  static sort() {
    const s = getGame().state;
    s.inventory.items.sort((a, b) => {
      const da = DEFS[a.id], db = DEFS[b.id];
      if (!da || !db) return 0;
      if (da.cat !== db.cat) return da.cat < db.cat ? -1 : 1;
      return t(da.nameKey).localeCompare(t(db.nameKey));
    });
  }
}
