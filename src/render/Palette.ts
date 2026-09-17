/**
 * Ograniczona, ciepła paleta (~60 kolorów) — brief, sekcja 2.
 * Wszystkie sprite'y w grze korzystają wyłącznie z tych barw, dzięki czemu
 * świat jest spójny, a wymiana palet NPC (ten sam szkielet, inne kolory) jest trywialna.
 */
export const PAL = {
  // cienie i kontury
  ink0: '#150f0b', ink1: '#221a13', ink2: '#33271c', ink3: '#4a382a',
  // drewno
  wood0: '#4a3220', wood1: '#6b4a2c', wood2: '#8a6238', wood3: '#a87c4a', wood4: '#c69a63',
  // kamień
  stone0: '#4c4842', stone1: '#6e6a63', stone2: '#8b867c', stone3: '#a8a296', stone4: '#c3bdb0',
  // dachówka
  tile0: '#5f2b21', tile1: '#8e4433', tile2: '#a8543d', tile3: '#c07050',
  // strzecha
  thatch0: '#7d6129', thatch1: '#98783a', thatch2: '#b99a52', thatch3: '#d3b56a',
  // trawa i zieleń
  grass0: '#33511f', grass1: '#4f7a35', grass2: '#62913f', grass3: '#7aa84c', grass4: '#96bd63',
  leaf0: '#2c4a22', leaf1: '#3f6a2c', leaf2: '#578a3a', leaf3: '#74a84c',
  // ziemia
  dirt0: '#4a3524', dirt1: '#5f452c', dirt2: '#7a5b3a', dirt3: '#93704a', dirt4: '#ab8a5e',
  // piach
  sand0: '#a98f61', sand1: '#cbb183', sand2: '#e0c99b', sand3: '#f0dcb4',
  // błoto
  mud0: '#3a2c1f', mud1: '#4e3d2c', mud2: '#65503a', mud3: '#7d6549',
  // woda
  water0: '#1b3a4d', water1: '#2f5f7a', water2: '#3d7693', water3: '#5b95ac', water4: '#8ec2d4',
  // skóra
  skin0: '#8a5f42', skin1: '#a87a58', skin2: '#c99570', skin3: '#e0b18c', skin4: '#f2d3ae',
  // tkaniny
  clothRed0: '#6e2318', clothRed1: '#a53a2c', clothRed2: '#c9503c',
  clothBlue0: '#28405f', clothBlue1: '#3b5a86', clothBlue2: '#527aa8',
  clothGreen0: '#2f4526', clothGreen1: '#4a6b3a', clothGreen2: '#6b8f52',
  clothYel0: '#a8862e', clothYel1: '#d8b25c', clothYel2: '#f0d28a',
  clothWhite0: '#b0a894', clothWhite1: '#d9d2bd', clothWhite2: '#efe9d8',
  clothGrey0: '#4f4c45', clothGrey1: '#75716a', clothGrey2: '#9a958b',
  // metal
  metal0: '#3d434a', metal1: '#5d646d', metal2: '#8a9099', metal3: '#b8bcc4', metal4: '#dfe3e8',
  // ogień i światło
  fire0: '#8e3a12', fire1: '#e85a20', fire2: '#ff9a3c', fire3: '#ffcf6a', fire4: '#fff2c0',
  // krew / rany
  blood0: '#4a120c', blood1: '#7a1f14', blood2: '#a83323',
  // noc
  night0: '#101a33', night1: '#1d2a4d', night2: '#2f3f6b',
  // pergaminy i papier
  parch0: '#8a7348', parch1: '#b9a67c', parch2: '#d9c9a3', parch3: '#eee2c2', parch4: '#2b2118'
} as const;

export type PalKey = keyof typeof PAL;
export const PALETTE_LIST = Object.values(PAL);

/** #rrggbb → [r,g,b] */
export function hex2rgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
export function rgb2css(r: number, g: number, b: number, a = 1): string {
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return a >= 1 ? `rgb(${f(r)},${f(g)},${f(b)})` : `rgba(${f(r)},${f(g)},${f(b)},${a})`;
}
export function rgba(hex: string, a: number): string { const [r, g, b] = hex2rgb(hex); return rgb2css(r, g, b, a); }

const cache = new Map<string, string>();
/** Rozjaśnienie/przyciemnienie koloru (t>0 jaśniej, t<0 ciemniej), z zachowaniem paletowego charakteru. */
export function shade(hex: string, t: number): string {
  const k = hex + '|' + t;
  const hit = cache.get(k); if (hit) return hit;
  let [r, g, b] = hex2rgb(hex);
  if (t >= 0) { r += (255 - r) * t; g += (255 - g) * t; b += (255 - b) * t; }
  else { const f = 1 + t; r *= f; g *= f; b *= f; }
  const out = rgb2css(r, g, b);
  cache.set(k, out);
  return out;
}

export function mix(a: string, b: string, t: number): string {
  const k = `${a}|${b}|${t}`; const hit = cache.get(k); if (hit) return hit;
  const [r1, g1, b1] = hex2rgb(a), [r2, g2, b2] = hex2rgb(b);
  const out = rgb2css(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
  cache.set(k, out); return out;
}

/** Tryb daltonistyczny: przesunięcie problematycznych barw (czerwień/zieleń) w stronę czytelnych kontrastów. */
export function cbSafe(hex: string, enabled: boolean): string {
  if (!enabled) return hex;
  const [r, g, b] = hex2rgb(hex);
  // deuteranopia-symulacja w uproszczeniu: wzmacniamy kanał niebieski i żółty, gasimy czystą zieleń
  const isGreen = g > r + 18 && g > b + 18;
  const isRed = r > g + 30 && r > b + 30;
  if (isGreen) return rgb2css(r * 0.8 + 40, g * 0.95, b * 0.6 + 70);
  if (isRed) return rgb2css(r, g * 0.85 + 20, b * 0.6);
  return hex;
}

/** Spójny kierunek cienia dla całego świata (brief: cienie rzucane w jednym kierunku). */
export function shadowTint(darkness: number): string {
  return rgba(mix(PAL.night0, PAL.ink0, 0.4), 0.34 + darkness * 0.2);
}
