/**
 * ELENEM — magistrala zdarzeń.
 * Wszystkie systemy (reputacja, przestępczość, ekonomia, plotki, questy) komunikują się
 * wyłącznie przez zdarzenia — brak twardego sprzęgnięcia między modułami (brief, sekcja 8).
 */
type Listener = (payload: any) => void;

export class EventBus {
  private listeners = new Map<string, Set<Listener>>();

  on(event: string, fn: Listener): () => void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(fn);
    return () => this.off(event, fn);
  }

  once(event: string, fn: Listener): () => void {
    const off = this.on(event, (p) => { off(); fn(p); });
    return off;
  }

  off(event: string, fn: Listener) { this.listeners.get(event)?.delete(fn); }

  emit(event: string, payload?: any) {
    const set = this.listeners.get(event);
    if (set) for (const fn of [...set]) {
      try { fn(payload); } catch (e) { console.error(`[EventBus] błąd w nasłuchującym "${event}"`, e); }
    }
    const wild = this.listeners.get('*');
    if (wild) for (const fn of [...wild]) { try { fn({ event, payload }); } catch { /* ignore */ } }
  }

  clear() { this.listeners.clear(); }
}

export const eventBus = new EventBus();
/** alias używany przez systemy */
export const bus = eventBus;

/** Katalog zdarzeń — dokumentacja kontraktów między systemami. */
export const Events = {
  // czas i świat
  MINUTE_TICK: 'minuteTick',       // {day,hour,minute}
  HOUR_CHIME: 'hourChime',         // {hour} — dzwon miejski bił
  DAY_CHANGED: 'dayChanged',       // {day}
  WEATHER_CHANGED: 'weatherChanged',
  // gracz
  PLAYER_MOVED: 'playerMoved',
  PLAYER_ATTACK: 'playerAttack',
  PLAYER_HIT: 'playerHit',
  PLAYER_DIED: 'playerDied',
  ITEM_ACQUIRED: 'itemAcquired',   // {id,qty}
  ITEM_LOST: 'itemLost',           // {id,qty,reason}
  GOLD_CHANGED: 'goldChanged',
  SKILL_USED: 'skillUsed',         // {skill,amount}
  SKILL_LEVEL_UP: 'skillLevelUp',
  PERK_LEARNED: 'perkLearned',
  // świat społeczny
  DIALOGUE_OPEN: 'dialogueOpen',
  DIALOGUE_CLOSE: 'dialogueClose',
  NPC_WITNESSED: 'npcWitnessed',   // {npcId,crimeType,x,y}
  RUMOR_ADDED: 'rumorAdded',
  RUMOR_SPREAD: 'rumorSpread',
  REP_CHANGED: 'reputationChanged',// {faction,delta,total}
  CRIME_COMMITTED: 'crimeCommitted',
  GUARD_ALERTED: 'guardAlerted',
  PLAYER_ARRESTED: 'playerArrested',
  // ekonomia
  TRADE_DONE: 'tradeDone',         // {merchantId,itemId,qty,price,buy}
  MARKET_SHIFT: 'marketShift',
  // dług
  DEBT_PAID: 'debtPaid',           // {amount,total}
  DEBT_EXTENDED: 'debtExtended',
  COLLECTOR_VISIT: 'collectorVisit',
  // zadania
  QUEST_STARTED: 'questStarted',
  QUEST_ADVANCED: 'questAdvanced',
  QUEST_COMPLETED: 'questCompleted',
  QUEST_FAILED: 'questFailed',
  // notes
  NOTE_ADDED: 'noteAdded',
  COMPENDIUM_ENTRY: 'compendiumEntry',
  NOTES_DAMAGED: 'notesDamaged',
  // rozgrywka
  INTERACT: 'interact',
  SLEPT: 'slept',
  CRAFTED: 'crafted',
  GAMBLE_PLAYED: 'gamblePlayed',
  WORLD_EVENT: 'worldEvent',
  SAVE_GAME: 'saveGame',
  LOAD_GAME: 'loadGame',
  DEV_COMMAND: 'devCommand'
} as const;
