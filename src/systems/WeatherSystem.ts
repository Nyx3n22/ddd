import { bus } from '../core/EventBus';
import { rng } from '../core/RNG';
import { getGame } from '../core/gameSingleton';
import { t } from '../core/Localization';

/* ============================================================================
   POGODA — wpływa na widoczność, szybkość, światło, zachowanie NPC i choroby.
   Zmiana pogody jest wydarzeniem, nie dekoracją (brief 6).
   ========================================================================== */

export interface WeatherDef {
  id: string; nameKey: string; lightMul: number; visibility: number;
  speedMul: number; soundMul: number; tempC: number;
  weights: { clear: number; cloudy: number; rain: number; storm: number; fog: number; snow: number; heat: number };
}

const WEATHER_DEFS: Record<string, WeatherDef> = {
  clear:  { id: 'clear',  nameKey: 'weather.clear',  lightMul: 1.00, visibility: 1.00, speedMul: 1.00, soundMul: 1.00, tempC: 18, weights: { clear: 45, cloudy: 30, rain: 12, storm: 4, fog: 8, snow: 0, heat: 10 } },
  cloudy: { id: 'cloudy', nameKey: 'weather.cloudy', lightMul: 0.78, visibility: 0.92, speedMul: 0.98, soundMul: 1.00, tempC: 14, weights: { clear: 25, cloudy: 35, rain: 22, storm: 8, fog: 12, snow: 0, heat: 5 } },
  rain:   { id: 'rain',   nameKey: 'weather.rain',   lightMul: 0.58, visibility: 0.62, speedMul: 0.85, soundMul: 1.55, tempC: 9,  weights: { clear: 12, cloudy: 25, rain: 30, storm: 15, fog: 12, snow: 0, heat: 2 } },
  storm:  { id: 'storm',  nameKey: 'weather.storm',  lightMul: 0.42, visibility: 0.40, speedMul: 0.72, soundMul: 2.10, tempC: 8,  weights: { clear: 8, cloudy: 20, rain: 34, storm: 18, fog: 8, snow: 0, heat: 0 } },
  fog:    { id: 'fog',    nameKey: 'weather.fog',    lightMul: 0.62, visibility: 0.30, speedMul: 0.90, soundMul: 0.70, tempC: 6,  weights: { clear: 18, cloudy: 28, rain: 18, storm: 4, fog: 30, snow: 0, heat: 0 } },
  snow:   { id: 'snow',   nameKey: 'weather.snow',   lightMul: 0.85, visibility: 0.60, speedMul: 0.70, soundMul: 0.75, tempC: -4, weights: { clear: 20, cloudy: 30, rain: 5, storm: 10, fog: 15, snow: 30, heat: 0 } },
  heat:   { id: 'heat',   nameKey: 'weather.heat',   lightMul: 1.08, visibility: 0.98, speedMul: 0.88, soundMul: 1.05, tempC: 31, weights: { clear: 40, cloudy: 20, rain: 8, storm: 6, fog: 4, snow: 0, heat: 22 } }
};

export class WeatherSystem {
  static def(kind?: string): WeatherDef { return WEATHER_DEFS[kind || getGame().state.weather.kind] || WEATHER_DEFS.cloudy; }

  static lightMul() { return this.def().lightMul; }
  static visibility() { return this.def().visibility; }
  static tempC() {
    const base = this.def().tempC;
    const h = getGame().state.time.hour;
    // dobowy przebieg temperatury: najchłodniej o 5:00, najcieplej o 15:00
    const cycle = -4.5 * Math.cos(((h - 5) / 24) * Math.PI * 2);
    return base + cycle;
  }

  /** Zmiana pogody — wywoływana raz dziennie o świcie i przy dużych frontach. */
  static roll(force = false) {
    const g = getGame(), s = g.state;
    if (!force && s.time.day < s.weather.nextChangeDay) return;
    const cur = this.def(s.weather.kind);
    const entries = Object.entries(cur.weights) as Array<[keyof typeof cur.weights, number]>;
    // sezon: zima (miesiące 11,12,1) premiuje śnieg
    const month = s.time.month;
    let pool: Array<[string, number]> = entries.map(([k, w]) => [k as string, w]);
    if (month >= 11 || month <= 1) pool = pool.map(([k, w]) => [k, k === 'snow' ? w + 40 : k === 'heat' ? 0 : w]);
    if (month >= 6 && month <= 8) pool = pool.map(([k, w]) => [k, k === 'heat' ? w + 18 : k === 'snow' ? 0 : w]);
    const picked = rng.pickWeighted(pool, (e: [string, number]) => e[1])[0];
    s.weather.kind = picked as any;
    s.weather.intensity = 0.3 + rng.float() * 0.7;
    s.weather.wind = rng.range(-1, 1);
    s.weather.nextChangeDay = s.time.day + rng.int(1, 3);
    bus.emit('weather:changed', { kind: picked });
    bus.emit('hud:toast', { text: t('weather.changed', { what: t(this.def(picked).nameKey) }) });
  }

  /** Zaraza — po kilku dniach deszczu i brudu w mieście wybija epidemia. */
  static plagueCheck() {
    const s = getGame().state;
    if (s.weather.plague) {
      if (s.time.day - s.weather.plagueDay > 12) {
        s.weather.plague = false;
        bus.emit('hud:toast', { text: t('weather.plagueEnd'), tone: 'good' });
        bus.emit('world:plagueEnd', {});
      }
      return;
    }
    const dirty = s.reputation.villagers < -10 ? 1.4 : 1;
    const risk = 0.03 * dirty * (s.weather.kind === 'rain' || s.weather.kind === 'storm' ? 1.5 : 1);
    if (s.time.day > 4 && rng.chance(risk)) {
      s.weather.plague = true; s.weather.plagueDay = s.time.day;
      bus.emit('hud:toast', { text: t('weather.plagueStart'), tone: 'bad' });
      bus.emit('world:plague', {});
    }
  }
}
