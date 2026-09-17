import pl from '../data/locales/pl.json';
import en from '../data/locales/en.json';

export type Lang = 'pl' | 'en';

const TABLES: Record<Lang, Record<string, string>> = { pl: pl as any, en: en as any };

/**
 * Pełna lokalizacja przez pliki tłumaczeń — żadnego tekstu w kodzie (brief, sekcja 8).
 * Klucze w postaci `sekcja.podsekcja.klucz`; parametry podstawiane jako {nazwa}.
 */
export class Localization {
  lang: Lang = 'pl';
  private missing = new Set<string>();

  setLang(l: Lang) { this.lang = l; this.missing.clear(); }

  has(key: string): boolean { return key in TABLES[this.lang] || key in TABLES.pl; }

  t(key: string, params?: Record<string, string | number>): string {
    const table = TABLES[this.lang];
    let s = table[key];
    if (s === undefined) {
      s = TABLES.pl[key];
      if (s === undefined && this.lang === 'pl') s = TABLES.en[key];
      if (s === undefined) {
        if (!this.missing.has(key)) { this.missing.add(key); console.warn(`[i18n] brak tłumaczenia: ${key}`); }
        return key;
      }
    }
    if (params) for (const k in params) s = s.split(`{${k}}`).join(String(params[k]));
    return s;
  }

  /** Tłumaczenie opcjonalne — zwraca null zamiast klucza (dla danych, które mogą nie mieć opisu). */
  tOrNull(key: string, params?: Record<string, string | number>): string | null {
    return this.has(key) ? this.t(key, params) : null;
  }

  /** Liczebniki i kwoty w formacie przyjętym dla danego języka. */
  money(n: number): string {
    const v = Math.round(n);
    const s = this.lang === 'pl' ? v.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') : v.toLocaleString('en-US');
    return `${s} ${this.t('common.crowns')}`;
  }

  hourLabel(h: number, m: number, approx: boolean): string {
    const hh = String(h).padStart(2, '0');
    if (approx) return this.t('time.approx', { hour: hh });
    return `${hh}:${String(m).padStart(2, '0')}`;
  }

  getMissing(): string[] { return [...this.missing]; }
}

export const i18n = new Localization();
export const t = (k: string, p?: Record<string, string | number>) => i18n.t(k, p);
export const setLang = (l: Lang) => i18n.setLang(l);
export const getLang = (): Lang => i18n.lang;
