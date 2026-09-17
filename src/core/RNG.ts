/**
 * Deterministyczny generator liczb pseudolosowych (mulberry32).
 * Ziarno jest częścią zapisu — dzięki temu świat po wczytaniu zachowuje się spójnie,
 * a testy QA są powtarzalne.
 */
export class RNG {
  private s: number;
  constructor(seed = 1430) { this.s = seed >>> 0; }

  get seed() { return this.s; }
  setSeed(seed: number) { this.s = seed >>> 0; }

  /** [0,1) */
  next(): number {
    this.s = (this.s + 0x6D2B79F5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(min: number, max: number): number { return min + this.next() * (max - min); }
  /** alias range() — liczba zmiennoprzecinkowa z przedziału */
  float(min = 0, max = 1): number { return this.range(min, max); }
  int(min: number, max: number): number { return Math.floor(this.range(min, max + 1)); }
  chance(p: number): boolean { return this.next() < p; }
  pick<T>(arr: readonly T[]): T { return arr[Math.floor(this.next() * arr.length) % arr.length]; }
  pickWeighted<T>(arr: readonly T[], weight: (item: T) => number): T {
    let total = 0; for (const a of arr) total += Math.max(0, weight(a));
    if (total <= 0) return arr[0];
    let r = this.next() * total;
    for (const a of arr) { r -= Math.max(0, weight(a)); if (r <= 0) return a; }
    return arr[arr.length - 1];
  }
  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(this.next() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
    return arr;
  }
  serialize() { return this.s; }
  deserialize(v: number) { this.s = (v >>> 0) || 1430; }
}

export const rng = new RNG(14300001);

/** Statyczny pomocnik dla kodu, który nie potrzebuje stanu świata (np. szum tekstur). */
export function hash2(x: number, y: number, seed = 0): number {
  let h = seed + x * 374761393 + y * 668265263;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
