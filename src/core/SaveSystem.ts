import { bus } from './EventBus';
import { getGame } from './gameSingleton';
import { t } from './Localization';
import { settings } from './Settings';

/* ============================================================================
   ZAPIS
   Serializuje pełny stan świata: czas, pogodę, ekonomię, reputacje, relacje,
   questy, plotki, przestępstwa, notatnik, mapę, rozmieszczenie NPC, przedmioty
   na ziemi, stan bram i drzwi, a nawet ziarno generatora losowego (brief 8).
   ========================================================================== */

const KEY_PREFIX = 'elenem.save.v2.';
const QUICK = KEY_PREFIX + 'quick';
const AUTOSAVE = KEY_PREFIX + 'auto';

export interface SaveMeta { slot: string; name: string; day: number; time: string; gold: number; debt: number; place: string; ts: number; hardcore: boolean }

export class SaveSystem {
  static slots(): string[] { return ['quick', 'auto', '1', '2', '3']; }

  static write(slot: string): boolean {
    const g = getGame();
    if (settings.data.hardcore && slot !== 'auto') {
      bus.emit('hud:toast', { text: t('save.hardcoreBlocked'), tone: 'bad' });
      return false;
    }
    try {
      const payload = {
        meta: this.meta(slot),
        state: g.state.serialize(),
        world: g.world.serialize(),
        settingsLang: settings.data.lang
      };
      localStorage.setItem(KEY_PREFIX + slot, JSON.stringify(payload));
      bus.emit('hud:toast', { text: t('save.written', { slot }), tone: 'good' });
      bus.emit('save:written', { slot });
      return true;
    } catch (e) {
      console.error('[save]', e);
      bus.emit('hud:toast', { text: t('save.error'), tone: 'bad' });
      return false;
    }
  }

  static meta(slot: string): SaveMeta {
    const g = getGame(), s = g.state;
    return {
      slot, name: t('save.slot.' + slot), day: s.time.day, time: s.time.dateLabel(),
      gold: s.gold, debt: Math.round(s.debtRemaining), place: g.world?.scene?.nameKey ? t(g.world.scene.nameKey) : '',
      ts: Date.now(), hardcore: settings.data.hardcore
    };
  }

  static read(slot: string): any | null {
    try {
      const raw = localStorage.getItem(KEY_PREFIX + slot);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  static list(): SaveMeta[] {
    const out: SaveMeta[] = [];
    for (const slot of this.slots()) {
      const d = this.read(slot);
      if (!d) continue;
      out.push({ ...d.meta, slot });
    }
    return out;
  }

  static load(slot: string): boolean {
    const g = getGame();
    const d = this.read(slot);
    if (!d) { bus.emit('hud:toast', { text: t('save.missing'), tone: 'bad' }); return false; }
    try {
      if (d.settingsLang && d.settingsLang !== settings.data.lang) { settings.data.lang = d.settingsLang; bus.emit('lang:changed', { lang: d.settingsLang }); }
      g.state.deserialize(d.state);
      g.world.init(d.world);
      g.refreshAfterLoad();
      bus.emit('hud:toast', { text: t('save.loaded', { slot }), tone: 'good' });
      bus.emit('save:loaded', { slot });
      return true;
    } catch (e) {
      console.error('[load]', e);
      bus.emit('hud:toast', { text: t('save.corrupt'), tone: 'bad' });
      return false;
    }
  }

  static quicksave() { return this.write('quick'); }
  static quickload() { return this.load('quick'); }
  static autosave() {
    try {
      const g = getGame();
      localStorage.setItem(AUTOSAVE, JSON.stringify({ meta: this.meta('auto'), state: g.state.serialize(), world: g.world.serialize(), settingsLang: settings.data.lang }));
      bus.emit('save:auto', {});
    } catch { /* brak miejsca — nie przerywamy gry */ }
  }
  static erase(slot: string) { localStorage.removeItem(KEY_PREFIX + slot); bus.emit('hud:toast', { text: t('save.erased', { slot }) }); }
  static hasAny(): boolean { return this.slots().some(s => !!localStorage.getItem(KEY_PREFIX + s)); }
}
