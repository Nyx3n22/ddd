import { TimeSystem } from './TimeSystem';

/* ============================================================================
   STAN GRY — pojedyncze źródło prawdy, w pełni serializowalne.
   Zapis odtwarza cały świat: pozycje i rutyny NPC, ekonomię, reputacje, flagi
   questów, datę i godzinę, majątek i stan świata po zdarzeniach (brief 8).
   ========================================================================== */

export type FactionId = 'wildKnights' | 'cityGuard' | 'merchantGuild' | 'church' | 'smugglers' | 'villagers';
export const FACTIONS: FactionId[] = ['wildKnights', 'cityGuard', 'merchantGuild', 'church', 'smugglers', 'villagers'];
export type SkillId = string;
export type BodyPart = 'head' | 'torso' | 'armL' | 'armR' | 'legL' | 'legR';
export type InjuryType = 'cut' | 'bruise' | 'fracture' | 'puncture' | 'burn';

export interface ItemStack {
  id: string; qty: number;
  stolen?: boolean;      // dowód rzeczowy przy przeszukaniu
  quality?: number;      // 0..1 — wynik rzemiosła
  wet?: boolean;
  custom?: Record<string, any>;
}

export interface Injury {
  part: BodyPart; type: InjuryType; severity: number;
  bleeding: number;      // 0..1, spadek zdrowia na minutę gry
  bandaged: boolean; infected: boolean; splinted: boolean;
  day: number; scar: boolean;
}

export interface DiseaseState { id: string; severity: number; dayStart: number; treated: boolean }

export interface QuestState {
  id: string; stageIdx: number;
  state: 'active' | 'done' | 'failed' | 'lost';
  startedDay: number; endedDay?: number;
  data: Record<string, any>;
}

export interface RumorState {
  textKey: string; day: number; spreadDay: number; known: boolean;
  severity: number; faction?: FactionId; witness?: string;
}

export interface MapMarker { x: number; y: number; label: string; color: string; region: string }

export interface NotesState {
  owned: boolean;
  wet: number;           // 0..1 — jak bardzo zamoczony (traci czytelność wpisów)
  items: string[];       // odkryte opisy przedmiotów
  bestiary: string[];    // odkryte wpisy przyrodnicze
  places: string[];
  customNotes: string[]; // odręczne zapiski gracza
  johnNotes: string[];   // zapiski Johna (fabularne)
  blurred: string[];     // wpisy utracone przez wodę
}

export interface MapState {
  owned: string[];              // id map (przedmiotów)
  visited: Record<string, string>; // region -> zakodowana mapa odkrycia (coarse cells)
  markers: MapMarker[];
  heard: string[];              // obszary znane z opowieści (rysunek niepewny)
}

export interface CrimeState {
  wanted: number;          // 0..5
  bounty: number;
  witnesses: Array<{ npcId: string; crimeType: string; day: number; x: number; y: number; reported: boolean }>;
  evidence: Array<{ kind: string; x: number; y: number; scene: string; day: number }>;
  arrests: number;
  jailUntilDay: number;
  banned: string[];        // regiony, z których John jest wygnany
  finesPaid: number;
  crimes: Array<{ type: string; day: number; location: string }>;
}

export interface EconomyState {
  prices: Record<string, number>;         // bieżący mnożnik ceny per towar
  stock: Record<string, number>;          // podaż na rynku
  merchantCash: Record<string, number>;
  events: Array<{ id: string; day: number; until: number }>;
  lastDay: number;
}

export interface DebtState {
  principal: number;
  paid: number;
  dueDay: number;
  extensions: number;
  loans: Array<{ creditor: string; principal: number; due: number; dueDay: number }>;
  favorOwed: boolean;
  lastCollectorVisit: number;
}

export interface WeatherState {
  kind: 'clear' | 'cloudy' | 'rain' | 'storm' | 'fog' | 'snow' | 'heat';
  intensity: number;   // 0..1
  wind: number;        // -1..1
  nextChangeDay: number;
  plague: boolean;
  plagueDay: number;
}

export interface PlayerStats {
  health: number; maxHealth: number;
  stamina: number; maxStamina: number;
  hunger: number; thirst: number; fatigue: number; hygiene: number;   // 0..100 (100 = dobrze)
  warmth: number;
  torchLit: boolean; torchFuel: number;
  dead: boolean;
}

export interface GameStats {
  daysPlayed: number; earned: number; spent: number; killed: number;
  crafted: number; gambled: number; gambledWon: number; crimesCommitted: number;
  arrests: number; questsDone: number; walked: number; notesWritten: number;
  sleeps: number; parries: number; dodges: number;
}

export class GameState {
  version = 2;
  time = new TimeSystem();
  weather: WeatherState = { kind: 'cloudy', intensity: 0.3, wind: 0.2, nextChangeDay: 2, plague: false, plagueDay: 0 };
  gold = 100;
  debt: DebtState = { principal: 10000, paid: 0, dueDay: 30, extensions: 0, loans: [], favorOwed: false, lastCollectorVisit: 0 };
  reputation: Record<FactionId, number> = { wildKnights: -20, cityGuard: 0, merchantGuild: 0, church: 0, smugglers: 0, villagers: 5 };
  relations: Record<string, number> = {};
  skills: { xp: Record<string, number>; perks: string[]; training: { perkId: string; daysLeft: number; teacher: string } | null } =
    { xp: {}, perks: [], training: null };
  inventory: { items: ItemStack[]; equipped: { weapon: string | null; offhand: string | null; body: string | null; head: string | null }; capacityKg: number; capacityL: number } =
    { items: [], equipped: { weapon: null, offhand: null, body: null, head: null }, capacityKg: 40, capacityL: 60 };
  storage: Record<string, ItemStack[]> = {};   // skrzynie: id sceny/obiektu -> zawartość
  needs: PlayerStats = {
    health: 100, maxHealth: 100, stamina: 100, maxStamina: 100,
    hunger: 80, thirst: 80, fatigue: 30, hygiene: 55, warmth: 70,
    torchLit: false, torchFuel: 0, dead: false
  };
  injuries: Injury[] = [];
  diseases: DiseaseState[] = [];
  scars: BodyPart[] = [];
  notes: NotesState = { owned: false, wet: 0, items: [], bestiary: [], places: [], customNotes: [], johnNotes: [], blurred: [] };
  maps: MapState = { owned: [], visited: {}, markers: [], heard: [] };
  quests: QuestState[] = [];
  crime: CrimeState = { wanted: 0, bounty: 0, witnesses: [], evidence: [], arrests: 0, jailUntilDay: 0, banned: [], finesPaid: 0, crimes: [] };
  rumors: RumorState[] = [];
  economy: EconomyState = { prices: {}, stock: {}, merchantCash: {}, events: [], lastDay: 1 };
  flags: Record<string, any> = {};
  npcState: Record<string, { alive: boolean; killed?: number; robbed?: number; scene?: string; x?: number; y?: number; activity?: string }> = {};
  stats: GameStats = {
    daysPlayed: 0, earned: 0, spent: 0, killed: 0, crafted: 0, gambled: 0, gambledWon: 0,
    crimesCommitted: 0, arrests: 0, questsDone: 0, walked: 0, notesWritten: 0, sleeps: 0, parries: 0, dodges: 0
  };
  dayLog: string[] = [];
  ending: string | null = null;
  scene = 'world';         // 'world' | id wnętrza
  playerPos = { x: 0, y: 0, dir: 0 as 0 | 1 | 2 | 3 };
  hardcore = false;
  lang = 'pl';

  /* ---------- pomocnicze ---------- */
  flag(k: string, v: any = true) { this.flags[k] = v; }
  getFlag(k: string) { return this.flags[k]; }
  hasFlag(k: string) { return !!this.flags[k]; }

  get debtRemaining() { return Math.max(0, this.debt.principal - this.debt.paid); }
  get debtOverdue() { return this.time.day > this.debt.dueDay && this.debtRemaining > 0; }

  alive(id: string) { return this.npcState[id]?.alive !== false; }

  addLog(key: string) {
    this.dayLog.push(`D${this.time.day}: ${key}`);
    if (this.dayLog.length > 400) this.dayLog.shift();
  }

  /* ---------- serializacja ---------- */
  serialize(): string {
    return JSON.stringify({
      version: this.version, time: this.time.serialize(), weather: this.weather, gold: this.gold,
      debt: this.debt, reputation: this.reputation, relations: this.relations, skills: this.skills,
      inventory: this.inventory, storage: this.storage, needs: this.needs, injuries: this.injuries,
      diseases: this.diseases, scars: this.scars, notes: this.notes, maps: this.maps, quests: this.quests,
      crime: this.crime, rumors: this.rumors, economy: this.economy, flags: this.flags,
      npcState: this.npcState, stats: this.stats, dayLog: this.dayLog, ending: this.ending,
      scene: this.scene, playerPos: this.playerPos, hardcore: this.hardcore, lang: this.lang
    });
  }

  deserialize(json: string): boolean {
    try {
      const d = JSON.parse(json);
      this.time.deserialize(d.time);
      const assign = (o: any) => { for (const k in o) (this as any)[k] = o[k]; };
      assign({
        weather: d.weather, gold: d.gold, debt: d.debt, reputation: d.reputation, relations: d.relations,
        skills: d.skills, inventory: d.inventory, storage: d.storage, needs: d.needs, injuries: d.injuries,
        diseases: d.diseases, scars: d.scars, notes: d.notes, maps: d.maps, quests: d.quests, crime: d.crime,
        rumors: d.rumors, economy: d.economy, flags: d.flags, npcState: d.npcState, stats: d.stats,
        dayLog: d.dayLog, ending: d.ending, scene: d.scene, playerPos: d.playerPos, hardcore: d.hardcore, lang: d.lang
      });
      return true;
    } catch (e) { console.error('[save] nie udało się wczytać', e); return false; }
  }

  /** Nowa gra — stan startowy prologu (John schodzi ze statku). */
  newGame(hardcore = false) {
    this.time = new TimeSystem();
    this.time.day = 1; this.time.minute = 6 * 60 + 40; this.time.paused = false;
    this.weather = { kind: 'cloudy', intensity: 0.35, wind: 0.25, nextChangeDay: 3, plague: false, plagueDay: 0 };
    this.gold = 100;
    this.debt = { principal: 10000, paid: 0, dueDay: 30, extensions: 0, loans: [], favorOwed: false, lastCollectorVisit: 0 };
    this.reputation = { wildKnights: -20, cityGuard: 0, merchantGuild: 0, church: 0, smugglers: 0, villagers: 5 };
    this.relations = {};
    this.skills = { xp: {}, perks: [], training: null };
    this.inventory = {
      items: [
        { id: 'sword_rusted', qty: 1 },
        { id: 'torch', qty: 2 },
        { id: 'bandage_linen', qty: 1 },
        { id: 'waterskin', qty: 1 },
        { id: 'bread_loaf', qty: 1 },
        { id: 'flint_steel', qty: 1 }
      ],
      equipped: { weapon: 'sword_rusted', offhand: null, body: null, head: null },
      capacityKg: 40, capacityL: 60
    };
    this.storage = {};
    this.needs = {
      health: 100, maxHealth: 100, stamina: 100, maxStamina: 100, hunger: 70, thirst: 70,
      fatigue: 35, hygiene: 40, warmth: 65, torchLit: false, torchFuel: 0, dead: false
    };
    this.injuries = []; this.diseases = []; this.scars = [];
    this.notes = { owned: false, wet: 0, items: ['sword_rusted', 'torch', 'bandage_linen'], bestiary: [], places: [], customNotes: [], johnNotes: ['note_arrival'], blurred: [] };
    this.maps = { owned: [], visited: {}, markers: [], heard: [] };
    this.quests = [{ id: 'q_prolog_debt', stageIdx: 0, state: 'active', startedDay: 1, data: {} }];
    this.crime = { wanted: 0, bounty: 0, witnesses: [], evidence: [], arrests: 0, jailUntilDay: 0, banned: [], finesPaid: 0, crimes: [] };
    this.rumors = [];
    this.economy = { prices: {}, stock: {}, merchantCash: {}, events: [], lastDay: 1 };
    this.flags = { prolog_done: false, knows_debt: true };
    this.npcState = {};
    this.stats = {
      daysPlayed: 0, earned: 0, spent: 0, killed: 0, crafted: 0, gambled: 0, gambledWon: 0,
      crimesCommitted: 0, arrests: 0, questsDone: 0, walked: 0, notesWritten: 0, sleeps: 0, parries: 0, dodges: 0
    };
    this.dayLog = [];
    this.ending = null;
    this.scene = 'world';
    this.hardcore = hardcore;
  }
}
