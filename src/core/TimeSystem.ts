import { eventBus, Events } from './EventBus';
import { t } from './Localization';

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
export type DayPhase = 'night' | 'dawn' | 'morning' | 'noon' | 'afternoon' | 'dusk' | 'evening';

/**
 * Czas, kalendarz 30-dniowy i cykl doby (brief 6.1).
 * Zegar jest zawsze aktywny — każdy dzień gry to jeden dzień mniej na spłatę długu.
 */
export class TimeSystem {
  /** minuty gry od początku doby 0..1439 */
  minute = 6 * 60 + 20;
  /** 1..30 */
  day = 1;
  /** limit dni na spłatę długu */
  totalDays = 30;
  /** rok i miesiąc fabularny */
  year = 1430;
  month = 9; // październik 1430 (miesiąc index od 0 → 9 = październik)
  season: Season = 'autumn';

  paused = true;
  /** ile minut gry mija na sekundę realną (regulowane trudnościami i snem) */
  minutesPerSecond = 3;
  /** mnożnik przyspieszenia podczas snu / oczekiwania */
  restMultiplier = 1;

  lastChime = -1;
  /** ostatnia godzina, którą John realnie usłyszał (dzwon) albo zobaczył (słońce) */
  knownHour = 6;
  knownHourExact = false;

  get hour() { return Math.floor(this.minute / 60); }
  get minuteOfHour() { return Math.floor(this.minute % 60); }
  get daysLeft() { return Math.max(0, this.totalDays - this.day + (this.minute < 6 * 60 ? 1 : 0)); }
  get progress01() { return (this.day - 1 + this.minute / 1440) / this.totalDays; }
  get isFinalStretch() { return this.daysLeft <= 5; }
  get timeOfDay01() { return this.minute / 1440; }

  phase(): DayPhase {
    const h = this.hour + this.minuteOfHour / 60;
    if (h < 4.5) return 'night';
    if (h < 7) return 'dawn';
    if (h < 11) return 'morning';
    if (h < 14) return 'noon';
    if (h < 17) return 'afternoon';
    if (h < 20) return 'dusk';
    if (h < 22.5) return 'evening';
    return 'night';
  }

  isNight() { const p = this.phase(); return p === 'night' || p === 'dusk' && this.hour >= 19.5; }
  /** 0 = pełny dzień, 1 = pełna noc — steruje oświetleniem 2D */
  darkness(): number {
    const h = this.hour + this.minuteOfHour / 60;
    // płynna krzywa: noc 0.88, dzień 0
    if (h >= 21 || h < 4.6) return 0.88;
    if (h < 6.6) return 0.88 * (1 - (h - 4.6) / 2);
    if (h < 19) return 0;
    return 0.88 * ((h - 19) / 2);
  }

  /** Kolor światła słonecznego w zależności od pory (ciepła paleta z referencji). */
  ambientColor(): [number, number, number] {
    const h = this.hour + this.minuteOfHour / 60;
    if (h < 5) return [42, 52, 88];
    if (h < 7.5) return [214, 138, 92];    // świt
    if (h < 10) return [255, 226, 178];    // poranek
    if (h < 16) return [255, 248, 226];    // dzień
    if (h < 18.5) return [255, 206, 140];  // popołudnie
    if (h < 20.5) return [206, 116, 82];   // zmierzch
    return [54, 64, 104];                  // noc
  }

  /** Kąt słońca (do spójnego kierunku cieni — brief, sekcja 2). */
  sunAngle(): number {
    const h = this.hour + this.minuteOfHour / 60;
    return ((h - 6) / 12) * Math.PI; // 0 = wschód, PI = zachód
  }

  sunDirection(): { x: number; y: number } {
    const a = this.sunAngle();
    return { x: Math.cos(a), y: -0.35 + 0.25 * Math.sin(a) };
  }

  /**
   * @param dt sekundy realne
   */
  update(dt: number) {
    if (this.paused) return;
    const add = dt * this.minutesPerSecond * this.restMultiplier;
    const before = this.minute;
    const beforeDay = this.day;
    this.minute += add;
    while (this.minute >= 1440) { this.minute -= 1440; this.day++; }
    if (this.day !== beforeDay) {
      eventBus.emit(Events.DAY_CHANGED, { day: this.day });
    }
    if (Math.floor(before / 60) !== Math.floor(this.minute / 60) || this.day !== beforeDay) {
      const h = this.hour;
      eventBus.emit(Events.HOUR_CHIME, { hour: h, day: this.day });
      this.lastChime = h;
    }
    eventBus.emit(Events.MINUTE_TICK, { day: this.day, hour: this.hour, minute: this.minuteOfHour });
  }

  /** Sen / oczekiwanie — przewija czas do wskazanej godziny (kosztuje dni!). */
  advanceToHour(targetHour: number, minutes = 0): { hours: number } {
    if (!isFinite(targetHour)) return { hours: 0 };
    let target = targetHour * 60 + minutes;
    const start = this.day * 1440 + this.minute;
    if (target <= this.minute) target += 1440;
    this.minute = target;
    while (this.minute >= 1440) { this.minute -= 1440; this.day++; }
    const end = this.day * 1440 + this.minute;
    const hours = (end - start) / 60;
    eventBus.emit(Events.DAY_CHANGED, { day: this.day });
    return { hours };
  }

  advanceMinutes(m: number) {
    if (!isFinite(m) || m <= 0) return;
    this.minute += m;
    while (this.minute >= 1440) { this.minute -= 1440; this.day++; eventBus.emit(Events.DAY_CHANGED, { day: this.day }); }
  }

  dateLabel(): string {
    const d = 1 + ((this.day - 1) % 30);
    return t('date.full', { day: d, month: t('month.' + this.month), year: this.year });
  }

  serialize() {
    return {
      minute: this.minute, day: this.day, totalDays: this.totalDays, season: this.season,
      paused: this.paused, minutesPerSecond: this.minutesPerSecond, knownHour: this.knownHour,
      knownHourExact: this.knownHourExact, lastChime: this.lastChime
    };
  }
  deserialize(d: any) {
    if (!d) return;
    Object.assign(this, {
      minute: d.minute ?? this.minute, day: d.day ?? 1, totalDays: d.totalDays ?? 30,
      season: d.season ?? 'autumn', paused: d.paused ?? true,
      minutesPerSecond: d.minutesPerSecond ?? 3, knownHour: d.knownHour ?? 6,
      knownHourExact: d.knownHourExact ?? false, lastChime: d.lastChime ?? -1
    });
  }
}
