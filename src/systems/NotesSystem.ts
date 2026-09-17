import BESTIARY from '../data/bestiary.json';
import ITEMS from '../data/items.json';
import { bus } from '../core/EventBus';
import { getGame } from '../core/gameSingleton';
import { t } from '../core/Localization';
import { InventorySystem, itemDef } from './InventorySystem';
import { SkillsSystem } from './SkillsSystem';

/* ============================================================================
   NOTATNIK, KOMPENDIUM I MAPA
   K otwiera fizyczny notatnik Johna. Bez notatnika klawisz nie działa.
   Notatnik może zamoknąć — wtedy część wpisów jest nieczytelna (brief 0).
   M otwiera zwój mapy kupiony u kartografa: każda mapa pokrywa inny obszar.
   ========================================================================== */

export interface BestiaryEntry { id: string; kind: string; nameKey: string; loreKey?: string; descKey?: string; habitatKey?: string; danger?: number; loot?: string[]; item?: string; confusable?: string; risk?: number; unlockBy?: string[] }

const ENTRIES: BestiaryEntry[] = [
  ...(BESTIARY as any).creatures.map((c: any) => ({ ...c, kind: 'creature' })),
  ...(BESTIARY as any).plants.map((c: any) => ({ ...c, kind: 'plant' })),
  ...(BESTIARY as any).places.map((c: any) => ({ ...c, kind: 'place' }))
];
const ENTRY_MAP: Record<string, BestiaryEntry> = {};
for (const e of ENTRIES) ENTRY_MAP[e.id] = e;
const JOHN_NOTES = (BESTIARY as any).johnNotes as Array<{ id: string; textKey: string; dayKey?: string }>;

const MAP_CELL = 4;          // ziarno odkrywania mapy (w kafelkach)
const MAP_W = 140, MAP_H = 112;
const GRID_W = Math.ceil(MAP_W / MAP_CELL), GRID_H = Math.ceil(MAP_H / MAP_CELL);

export function bestiaryEntry(id: string) { return ENTRY_MAP[id]; }
export function allEntries() { return ENTRIES; }
export function johnNotes() { return JOHN_NOTES; }

export class NotesSystem {
  /* ---------------- notatnik ---------------- */

  static hasNotebook(): boolean {
    const s = getGame().state;
    return s.notes.owned && InventorySystem.has('notebook');
  }

  static hasQuill(): boolean { return InventorySystem.has('quill_ink'); }

  /**
   * Notatnik kupiony u skryby (albo znaleziony). Od tej chwili K i G mają
   * uzasadnienie w świecie — bez tego przedmiotu klawisze nie robią nic.
   */
  static acquireNotebook() {
    const s = getGame().state;
    if (!InventorySystem.has('notebook')) InventorySystem.add('notebook', 1);
    if (s.notes.owned) return;
    s.notes.owned = true;
    bus.emit('notes:acquired', {});
    bus.emit('hud:toast', { text: t('notes.acquired'), tone: 'good' });
  }

  /** Zgubienie / zniszczenie notatnika ma skutek w świecie. */
  static loseNotebook(reason: 'stolen' | 'burned' | 'lost') {
    const s = getGame().state;
    InventorySystem.remove('notebook', 1);
    s.notes.owned = false;
    bus.emit('notes:lost', { reason });
    bus.emit('hud:toast', { text: t('notes.lost', { reason: t('notes.reason.' + reason) }), tone: 'bad' });
  }

  static soak(amount: number) {
    const s = getGame().state;
    if (!this.hasNotebook()) return;
    s.notes.wet = Math.min(1, s.notes.wet + amount);
    // zamoczone wpisy stają się nieczytelne
    const total = [...s.notes.bestiary, ...s.notes.customNotes];
    const blurCount = Math.floor(total.length * s.notes.wet);
    s.notes.blurred = total.slice(0, blurCount);
    if (blurCount > 0) bus.emit('hud:toast', { text: t('notes.blurred', { count: blurCount }), tone: 'bad' });
  }

  static dry() {
    const s = getGame().state;
    if (s.notes.wet > 0) { s.notes.wet = Math.max(0, s.notes.wet - 0.25); s.notes.blurred = []; }
  }

  static addEntry(kind: 'creature' | 'plant' | 'place' | 'note', id: string) {
    const s = getGame().state;
    // wpis bez opisu w bestiarium byłby surowym identyfikatorem w notatniku
    if (!ENTRY_MAP[id]) return false;
    if (!this.hasNotebook()) { bus.emit('hud:toast', { text: t('notes.noNotebook'), tone: 'bad' }); return false; }
    if (s.notes.blurred.includes(id)) return false;
    const list = kind === 'creature' || kind === 'plant' ? s.notes.bestiary : kind === 'place' ? s.notes.places : s.notes.customNotes;
    if (list.includes(id)) return false;
    list.push(id);
    s.stats.notesWritten += 1;
    const name = ENTRY_MAP[id] ? t(ENTRY_MAP[id].nameKey) : t(id);
    bus.emit('notes:added', { kind, id, name });
    bus.emit('hud:toast', { text: t('notes.added', { what: name }) });
    SkillsSystem.use('reading', 6);
    return true;
  }

  /** Odręczny wpis gracza — możliwy tylko z piórem i atramentem. */
  static writeCustom(text: string): boolean {
    const s = getGame().state;
    if (!this.hasNotebook()) { bus.emit('hud:toast', { text: t('notes.noNotebook'), tone: 'bad' }); return false; }
    if (!this.hasQuill()) { bus.emit('hud:toast', { text: t('notes.noQuill'), tone: 'bad' }); return false; }
    const clean = text.trim().slice(0, 160);
    if (!clean) return false;
    s.notes.customNotes.push(`D${s.time.day}: ${clean}`);
    s.stats.notesWritten += 1;
    bus.emit('notes:written', { text: clean });
    bus.emit('hud:toast', { text: t('notes.written'), tone: 'good' });
    SkillsSystem.use('reading', 8);
    return true;
  }

  static addJohnNote(id: string) {
    const s = getGame().state;
    if (!s.notes.johnNotes.includes(id)) { s.notes.johnNotes.push(id); bus.emit('notes:john', { id }); }
  }

  static isBlurred(id: string) { return getGame().state.notes.blurred.includes(id); }

  static descriptionFor(id: string): string {
    const s = getGame().state;
    if (this.isBlurred(id)) return t('notes.blurredEntry');
    const e = ENTRY_MAP[id];
    if (e) {
      const lore = e.loreKey || e.descKey || e.nameKey;
      const hint = e.habitatKey && SkillsSystem.hasPerk('bestiary_hints') ? '\n' + t(e.habitatKey) : '';
      return t(lore) + hint;
    }
    const d = itemDef(id);
    if (d) return t(d.descKey);
    if (id.startsWith('D')) return id;
    return t(id);
  }

  /* ---------------- mapa ---------------- */

  static hasMap(regionId: string): boolean {
    const s = getGame().state;
    return s.maps.owned.some(id => (itemDef(id)?.mapRegion === regionId));
  }

  static ownedRegions(): string[] {
    const s = getGame().state;
    const out: string[] = [];
    for (const id of s.maps.owned) {
      const r = itemDef(id)?.mapRegion;
      if (r && !out.includes(r)) out.push(r);
    }
    return out;
  }

  static acquireMap(itemId: string) {
    const s = getGame().state;
    const region = itemDef(itemId)?.mapRegion;
    if (!region) return;
    if (!s.maps.owned.includes(itemId)) s.maps.owned.push(itemId);
    bus.emit('hud:toast', { text: t('map.acquired', { region: t('region.' + region) }), tone: 'good' });
    bus.emit('map:acquired', { itemId, region });
  }

  /** Odkrywanie terenu — gruba siatka, zapisana jako ciąg bitów w zapisie. */
  static discover(tx: number, ty: number, radiusTiles = 10, region = 'port_dolne_miasto') {
    const s = getGame().state;
    if (!this.hasMap(region)) return;
    const r = Math.ceil(radiusTiles / MAP_CELL);
    const cx = Math.floor(tx / MAP_CELL), cy = Math.floor(ty / MAP_CELL);
    let bits = s.maps.visited[region];
    if (!bits) { bits = new Array(GRID_W * GRID_H).fill('0').join(''); }
    const arr = bits.split('');
    let changed = false;
    for (let y = cy - r; y <= cy + r; y++) {
      for (let x = cx - r; x <= cx + r; x++) {
        if (x < 0 || y < 0 || x >= GRID_W || y >= GRID_H) continue;
        const dx = x - cx, dy = y - cy;
        if (dx * dx + dy * dy > r * r) continue;
        const i = y * GRID_W + x;
        if (arr[i] === '0') { arr[i] = '1'; changed = true; }
      }
    }
    if (changed) s.maps.visited[region] = arr.join('');
  }

  static isDiscovered(tx: number, ty: number, region = 'port_dolne_miasto'): boolean {
    const bits = getGame().state.maps.visited[region];
    if (!bits) return false;
    const x = Math.floor(tx / MAP_CELL), y = Math.floor(ty / MAP_CELL);
    if (x < 0 || y < 0 || x >= GRID_W || y >= GRID_H) return false;
    return bits[y * GRID_W + x] === '1';
  }

  static discoveryRatio(region = 'port_dolne_miasto'): number {
    const bits = getGame().state.maps.visited[region];
    if (!bits) return 0;
    let n = 0;
    for (const c of bits) if (c === '1') n++;
    return n / bits.length;
  }

  static addMarker(x: number, y: number, label: string, color = '#d9b26a', region = 'port_dolne_miasto') {
    const s = getGame().state;
    if (!this.hasMap(region)) { bus.emit('hud:toast', { text: t('map.noMap'), tone: 'bad' }); return false; }
    if (s.maps.markers.length >= 24) { bus.emit('hud:toast', { text: t('map.tooManyMarkers'), tone: 'bad' }); return false; }
    s.maps.markers.push({ x, y, label, color, region });
    bus.emit('hud:toast', { text: t('map.marked', { what: label }) });
    return true;
  }

  static removeMarker(index: number) {
    const s = getGame().state;
    if (index >= 0 && index < s.maps.markers.length) s.maps.markers.splice(index, 1);
  }

  /** Obszar „słyszany” z opowieści — na mapie rysowany przerywaną linią. */
  static hear(regionNameKey: string) {
    const s = getGame().state;
    if (!s.maps.heard.includes(regionNameKey)) {
      s.maps.heard.push(regionNameKey);
      bus.emit('hud:toast', { text: t('map.heard', { what: t(regionNameKey) }) });
    }
  }

  static gridDims() { return { GRID_W, GRID_H, MAP_CELL, MAP_W, MAP_H }; }

  static itemNotes(): Array<{ id: string; name: string; desc: string }> {
    const s = getGame().state;
    return s.notes.items.filter(id => !this.isBlurred(id)).map(id => {
      const d = itemDef(id);
      return { id, name: d ? t(d.nameKey) : id, desc: d ? t(d.descKey) : '' };
    });
  }
}
