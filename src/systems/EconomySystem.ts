import MERCHANTS from '../data/merchants.json';
import { bus } from '../core/EventBus';
import { rng } from '../core/RNG';
import { getGame } from '../core/gameSingleton';
import { t } from '../core/Localization';
import { itemDef, InventorySystem } from './InventorySystem';
import { SkillsSystem } from './SkillsSystem';
import { NotesSystem } from './NotesSystem';

/* ============================================================================
   EKONOMIA — ceny zmieniają się z popytem, podażą i wydarzeniami.
   Handel to rozmowa z człowiekiem, nie tabela (brief 0 i 6).
   ========================================================================== */

export interface MerchantDef {
  id: string; nameKey: string; npc: string; station: string; scene?: string;
  cash: number; hours?: [number, number]; priceMod: number;
  buyCats?: string[]; sellCats?: string[]; stock: string[];
  services?: string[]; flavorKey?: string; wants?: string[];
}

export interface ServiceDef {
  id: string; cost: number; labelKey: string; hours?: [number, number];
  feed?: number; quench?: number; heal?: number; wash?: number;
  sleepTo?: number; effect?: string; needsItem?: string; value?: number;
}

const MERCHANT_DEFS: Record<string, MerchantDef> = {};
for (const m of MERCHANTS.merchants as any[]) MERCHANT_DEFS[m.id] = m;
const SERVICE_DEFS: Record<string, ServiceDef> = {};
for (const [id, v] of Object.entries(MERCHANTS.services as Record<string, any>)) SERVICE_DEFS[id] = { id, ...v };
export function merchantsOfNpc(npcId: string) { return Object.values(MERCHANT_DEFS).filter(m => m.npc === npcId); }
export function merchantAtStation(station: string, scene?: string) {
  return Object.values(MERCHANT_DEFS).find(m => m.station === station && (!scene || (m.scene || 'world') === scene));
}

export function merchantDef(id: string) { return MERCHANT_DEFS[id]; }
export function serviceDef(id: string) { return SERVICE_DEFS[id]; }
export function allMerchants() { return Object.values(MERCHANT_DEFS); }

export class EconomySystem {
  /** Bazowa cena towaru po uwzględnieniu stanu rynku i umiejętności Johna. */
  static price(itemId: string, merchantId?: string, mode: 'buy' | 'sell' = 'buy'): number {
    const g = getGame(), s = g.state;
    const d = itemDef(itemId);
    if (!d) return 0;
    let p = d.value;
    // rynek: mnożnik globalny dla towaru
    const market = s.economy.prices[itemId] ?? 1;
    p *= market;
    // kupiec
    if (merchantId && MERCHANT_DEFS[merchantId]) {
      const m = MERCHANT_DEFS[merchantId];
      p *= m.priceMod;
      if (m.wants?.includes(itemId)) p *= mode === 'sell' ? 1.35 : 0.9;
      if (!m.stock.includes(itemId) && mode === 'buy') p *= 1.5;   // sprowadzenie na zamówienie
      // gotówka kupca ogranicza skup
      if (mode === 'sell') {
        const cash = s.economy.merchantCash[merchantId] ?? m.cash ?? 200;
        if (p > cash) p = Math.max(d.value * 0.35, cash);
      }
    }
    // umiejętność handlu i perki
    const lvl = SkillsSystem.level('barter');
    const perkMod = 1 + SkillsSystem.effect('priceMod');
    const skillMod = mode === 'buy' ? 1 - lvl * 0.018 : 1 + lvl * 0.022;
    p *= skillMod * perkMod;
    // skradzione: paser płaci mniej, ale bierze wszystko
    return Math.max(1, Math.round(p));
  }

  /** Dzienna symulacja rynku — popyt/podaż, wydarzenia, gotówka kupców. */
  static dailyTick() {
    const s = getGame().state;
    s.economy.lastDay = s.time.day;
    // ceny dryfują w stronę 1.0 z losowym szumem
    for (const id of Object.keys(s.economy.prices)) {
      const v = s.economy.prices[id];
      s.economy.prices[id] = Math.max(0.55, Math.min(2.2, v + (1 - v) * 0.12 + rng.range(-0.05, 0.05)));
    }
    // gotówka kupców odnawia się
    for (const m of Object.values(MERCHANT_DEFS)) {
      const cur = s.economy.merchantCash[m.id] ?? 220;
      s.economy.merchantCash[m.id] = Math.round(Math.min(600, cur * 0.7 + (m.cash || 160) * 0.5 + rng.float() * 60));
    }
    // wydarzenia rynkowe
    for (let i = s.economy.events.length - 1; i >= 0; i--) if (s.time.day > s.economy.events[i].until) s.economy.events.splice(i, 1);
    if (rng.chance(0.22)) this.spawnEvent();
    if (s.weather.plague && rng.chance(0.3)) this.spawnEvent('plague_prices');
    bus.emit('economy:tick', { day: s.time.day });
  }

  static spawnEvent(forceId?: string) {
    const s = getGame().state;
    const pool: Array<{ id: string; nameKey: string; goods: string[]; mul: number; days: number }> = [
      { id: 'ship_arrives', nameKey: 'eco.ship', goods: ['salt_bag', 'iron_bar', 'rope', 'linen_cloth'], mul: 0.82, days: 3 },
      { id: 'harvest', nameKey: 'eco.harvest', goods: ['wheat_sack', 'bread_loaf', 'turnip', 'goose'], mul: 0.75, days: 4 },
      { id: 'drought', nameKey: 'eco.drought', goods: ['wheat_sack', 'turnip', 'waterskin'], mul: 1.35, days: 5 },
      { id: 'war_rumor', nameKey: 'eco.war', goods: ['iron_bar', 'sword_iron', 'leather_hide', 'coal_lump'], mul: 1.4, days: 4 },
      { id: 'plague_prices', nameKey: 'eco.plague', goods: ['salve_wiera', 'bandage_linen', 'herb_yarrow', 'garlic_braid'], mul: 1.6, days: 6 }
    ];
    const ev = forceId ? pool.find(p => p.id === forceId)! : rng.pick(pool);
    if (!ev) return;
    s.economy.events.push({ id: ev.id, day: s.time.day, until: s.time.day + ev.days });
    for (const g of ev.goods) s.economy.prices[g] = Math.max(0.5, Math.min(2.5, (s.economy.prices[g] ?? 1) * ev.mul));
    bus.emit('hud:toast', { text: t('eco.event', { what: t(ev.nameKey) }) });
    bus.emit('economy:event', ev);
  }

  static buy(itemId: string, merchantId: string, qty = 1): boolean {
    const g = getGame(), s = g.state;
    const total = this.price(itemId, merchantId, 'buy') * qty;
    if (s.gold < total) { bus.emit('hud:toast', { text: t('trade.noGold', { gold: total }), tone: 'bad' }); return false; }
    if (!InventorySystem.add(itemId, qty)) return false;
    s.gold -= total;
    s.stats.spent += total;
    s.economy.merchantCash[merchantId] = (s.economy.merchantCash[merchantId] ?? 200) + total;
    s.economy.stock[itemId] = (s.economy.stock[itemId] ?? 3) - qty * 0.4;
    s.economy.prices[itemId] = Math.min(2.2, (s.economy.prices[itemId] ?? 1) * (1 + 0.02 * qty));
    SkillsSystem.use('barter', 3 + qty);
    // przedmioty, które odblokowują diegetyczne menu, muszą zostać „zarejestrowane”
    if (itemId === 'notebook') NotesSystem.acquireNotebook();
    if (itemDef(itemId)?.mapRegion) NotesSystem.acquireMap(itemId);
    bus.emit('trade:buy', { itemId, qty, total, merchantId });
    bus.emit('hud:toast', { text: t('trade.bought', { what: t(itemDef(itemId)?.nameKey || itemId), gold: total }) });
    return true;
  }

  static sell(itemId: string, merchantId: string, qty = 1, stolenOnly = false): boolean {
    const g = getGame(), s = g.state;
    const have = InventorySystem.count(itemId);
    const n = Math.min(qty, have);
    if (n <= 0) return false;
    const stack = s.inventory.items.find(i => i.id === itemId && (stolenOnly ? i.stolen : true));
    const isStolen = !!stack?.stolen;
    // uczciwy kupiec nie weźmie rzeczy oznaczonej jako kradziona, jeśli ją rozpozna
    const m = MERCHANT_DEFS[merchantId];
    const fence = !!m && (m.id.includes('idzi') || m.id.includes('pawn'));
    if (isStolen && !fence && rng.chance(0.55)) {
      bus.emit('hud:toast', { text: t('trade.refuseStolen'), tone: 'bad' });
      bus.emit('crime:witness', { type: 'possession', npcId: m?.npc });
      return false;
    }
    let unit = this.price(itemId, merchantId, 'sell');
    if (isStolen) unit = Math.max(1, Math.round(unit * (fence ? 0.6 : 0.35)));
    const total = unit * n;
    InventorySystem.remove(itemId, n, stolenOnly);
    s.gold += total;
    s.stats.earned += total;
    s.economy.merchantCash[merchantId] = Math.max(0, (s.economy.merchantCash[merchantId] ?? 200) - total);
    s.economy.prices[itemId] = Math.max(0.55, (s.economy.prices[itemId] ?? 1) * (1 - 0.015 * n));
    SkillsSystem.use('barter', 4 + n);
    bus.emit('trade:sell', { itemId, qty: n, total, merchantId });
    bus.emit('hud:toast', { text: t('trade.sold', { what: t(itemDef(itemId)?.nameKey || itemId), gold: total }), tone: 'good' });
    return true;
  }

  /** Usługa wykonywana przez człowieka (posiłek, opatrunek, nocleg, przepustka...). */
  static useService(serviceId: string, providerNpc?: string): boolean {
    const g = getGame(), s = g.state;
    const d = SERVICE_DEFS[serviceId];
    if (!d) { console.warn('[eco] nieznana usługa', serviceId); return false; }
    if (d.hours) {
      const h = s.time.hour;
      if (h < d.hours[0] || h >= d.hours[1]) {
        bus.emit('hud:toast', { text: t('service.closedHours', { what: t(d.labelKey), from: d.hours[0], to: d.hours[1] }), tone: 'bad' });
        return false;
      }
    }
    if (d.needsItem && !InventorySystem.has(d.needsItem)) {
      bus.emit('hud:toast', { text: t('service.needsItem', { what: t(itemDef(d.needsItem)?.nameKey || d.needsItem) }), tone: 'bad' });
      return false;
    }
    if (s.gold < d.cost) { bus.emit('hud:toast', { text: t('trade.noGold', { gold: d.cost }), tone: 'bad' }); return false; }
    s.gold -= d.cost; s.stats.spent += d.cost;
    if (d.needsItem) InventorySystem.remove(d.needsItem, 1);
    if (d.feed) s.needs.hunger = Math.min(100, s.needs.hunger + d.feed);
    if (d.quench) s.needs.thirst = Math.min(100, s.needs.thirst + d.quench);
    if (d.wash) s.needs.hygiene = Math.min(100, s.needs.hygiene + d.wash);
    bus.emit('hud:toast', { text: t('service.used', { what: t(d.labelKey), gold: d.cost }), tone: 'good' });
    bus.emit('service:used', { id: serviceId, def: d, cost: d.cost, provider: providerNpc });
    return true;
  }

  static isOpen(merchantId: string): boolean {
    const m = MERCHANT_DEFS[merchantId]; if (!m || !m.hours) return true;
    const h = getGame().state.time.hour;
    return h >= m.hours[0] && h < m.hours[1];
  }
}
