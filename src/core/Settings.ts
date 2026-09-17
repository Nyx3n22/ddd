/**
 * Ustawienia gry i dostępności (brief, sekcja 6.25).
 * Trzymane poza zapisem gry — wspólne dla wszystkich slotów.
 */
export interface SettingsData {
  lang: 'pl' | 'en';
  uiScale: number;            // 0.85 – 1.5
  subtitleBg: boolean;
  subtitleSize: number;       // 0.85 – 1.4
  colorblindMode: boolean;
  disableFlashing: boolean;   // brak błysków (burza, trafienia krytyczne)
  disableCameraShake: boolean;
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  ambientVolume: number;
  sneakMode: 'hold' | 'toggle';
  runMode: 'hold' | 'toggle';
  showVisionCones: boolean;   // stożki widzenia NPC
  showQuestMarkers: boolean;  // tryb ułatwień: znacznik celu
  showMinimapCompass: boolean;
  difficultyCombat: number;   // 0 = łatwa, 1 = normalna, 2 = brutalna
  difficultyEconomy: number;
  difficultyLaw: number;
  hardcore: boolean;          // jeden zapis, brak F5/F9, śmierć = koniec
  cameraZoom: number;         // 1..2 (ograniczony zoom kółkiem myszy)
  showFps: boolean;
  screenShakeIntensity: number;
}

const KEY = 'elenem.settings.v2';

export const DEFAULT_SETTINGS: SettingsData = {
  lang: 'pl',
  uiScale: 1,
  subtitleBg: true,
  subtitleSize: 1,
  colorblindMode: false,
  disableFlashing: false,
  disableCameraShake: false,
  masterVolume: 0.8,
  musicVolume: 0.55,
  sfxVolume: 0.8,
  ambientVolume: 0.6,
  sneakMode: 'hold',
  runMode: 'hold',
  showVisionCones: true,
  showQuestMarkers: false,
  showMinimapCompass: true,
  difficultyCombat: 1,
  difficultyEconomy: 1,
  difficultyLaw: 1,
  hardcore: false,
  cameraZoom: 1,
  showFps: false,
  screenShakeIntensity: 1
};

export class Settings {
  data: SettingsData = { ...DEFAULT_SETTINGS };

  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) this.data = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch { /* pierwszy uruchomienie / prywatny tryb */ }
    return this.data;
  }

  save() { try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch { /* ignore */ } }

  set<K extends keyof SettingsData>(k: K, v: SettingsData[K]) {
    this.data[k] = v; this.save();
  }

  reset() { this.data = { ...DEFAULT_SETTINGS }; this.save(); }

  /** Mnożnik obrażeń zadawanych graczowi. */
  get damageTakenMul() { return [0.7, 1, 1.45][this.data.difficultyCombat] ?? 1; }
  /** Mnożnik obrażeń zadawanych przez gracza. */
  get damageDealtMul() { return [1.3, 1, 0.85][this.data.difficultyCombat] ?? 1; }
  /** Mnożnik tempa przyrostu cen i odsetek. */
  get economyPressure() { return [0.7, 1, 1.4][this.data.difficultyEconomy] ?? 1; }
  /** Mnożnik czujności straży i wysokości kar. */
  get lawPressure() { return [0.6, 1, 1.5][this.data.difficultyLaw] ?? 1; }
}

export const settings = new Settings();
