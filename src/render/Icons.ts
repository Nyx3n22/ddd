import { PAL, shade } from './Palette';
import { mk, rect, px, ellipsePx, linePx, outlineCanvas } from './Art';
import { hash2 } from '../core/RNG';

/* ============================================================================
   IKONY PRZEDMIOTÓW — 16×16 px, proceduralnie, spójne z paletą świata.
   Ikona trafia do sakwy, pasa, notatek i okien handlu.
   ========================================================================== */

export type IconKind =
  | 'coins' | 'sword' | 'axe' | 'hammer' | 'dagger' | 'bow' | 'crossbow' | 'spear' | 'shield'
  | 'torch' | 'lantern' | 'candle' | 'bandage' | 'potion' | 'flask' | 'herb' | 'mushroom'
  | 'bread' | 'cheese' | 'apple' | 'fish' | 'meat' | 'egg' | 'stew' | 'mug' | 'bottle'
  | 'salt' | 'ore' | 'coal' | 'iron' | 'hide' | 'wool' | 'plank' | 'nails' | 'rope'
  | 'notebook' | 'scroll' | 'map' | 'letter' | 'key' | 'lockpick' | 'permit' | 'watch'
  | 'ring' | 'relic' | 'dice' | 'cards' | 'quill' | 'ink' | 'oilcloth' | 'waterskin'
  | 'armor' | 'helmet' | 'cloack' | 'poison' | 'net' | 'hook' | 'trap' | 'coin purse'
  | 'gem' | 'bone' | 'feather' | 'grain' | 'beer' | 'toolbox' | 'pass' | 'deed' | 'bait'
  | 'book' | 'garlic' | 'jar' | 'turnip' | 'vial';

const iconCache = new Map<string, HTMLCanvasElement>();

export function getIcon(kind: string, size = 16): HTMLCanvasElement {
  const key = `${kind}|${size}`;
  const hit = iconCache.get(key); if (hit) return hit;
  const [c0, x0] = mk(16, 16);
  paintIcon(x0, kind as IconKind);
  const c = size === 16 ? outlineCanvas(c0, PAL.ink0) : scaleIcon(c0, size);
  iconCache.set(key, c);
  return c;
}

function scaleIcon(src: HTMLCanvasElement, size: number): HTMLCanvasElement {
  const [c, x] = mk(size, size);
  x.imageSmoothingEnabled = false;
  const outlined = outlineCanvas(src, PAL.ink0);
  x.drawImage(outlined, 0, 0, outlined.width, outlined.height, 0, 0, size, size);
  return c;
}

function paintIcon(x: CanvasRenderingContext2D, k: IconKind) {
  switch (k) {
    case 'coins':
      ellipsePx(x, 8, 11, 6, 3, PAL.clothYel0); ellipsePx(x, 8, 10, 6, 3, PAL.clothYel1);
      ellipsePx(x, 6, 8, 4, 3, PAL.clothYel1); ellipsePx(x, 6, 7, 4, 3, PAL.clothYel2);
      ellipsePx(x, 10, 7, 4, 3, PAL.clothYel1); ellipsePx(x, 10, 6, 4, 3, PAL.clothYel2);
      px(x, 6, 6, PAL.fire4); px(x, 10, 5, PAL.fire4);
      break;
    case 'coin purse':
      ellipsePx(x, 8, 10, 5, 5, PAL.wood1); ellipsePx(x, 8, 9, 4, 4, PAL.wood2);
      rect(x, 6, 3, 4, 3, PAL.wood0); linePx(x, 5, 5, 11, 5, PAL.clothYel1);
      px(x, 8, 10, PAL.clothYel2); px(x, 7, 11, PAL.clothYel1);
      break;
    case 'sword':
      linePx(x, 4, 12, 11, 4, PAL.metal2); linePx(x, 5, 12, 12, 4, PAL.metal3);
      px(x, 12, 3, PAL.metal4);
      rect(x, 3, 11, 5, 2, PAL.metal1); linePx(x, 3, 13, 5, 15, PAL.wood1);
      px(x, 5, 15, PAL.clothYel1);
      break;
    case 'dagger':
      linePx(x, 6, 10, 11, 4, PAL.metal3); rect(x, 4, 9, 4, 2, PAL.metal1);
      linePx(x, 3, 12, 5, 10, PAL.wood1); px(x, 2, 13, PAL.clothYel1);
      break;
    case 'axe':
      linePx(x, 5, 14, 10, 3, PAL.wood2); ellipsePx(x, 11, 5, 4, 4, PAL.metal2);
      rect(x, 10, 2, 4, 5, PAL.metal3); px(x, 13, 3, PAL.metal4);
      break;
    case 'hammer':
      linePx(x, 5, 14, 10, 6, PAL.wood1); rect(x, 8, 2, 7, 5, PAL.metal1);
      rect(x, 8, 2, 7, 1, PAL.metal3); rect(x, 8, 6, 7, 1, PAL.metal0);
      break;
    case 'spear':
      linePx(x, 3, 14, 12, 3, PAL.wood2); rect(x, 11, 1, 3, 5, PAL.metal3); px(x, 12, 1, PAL.metal4);
      break;
    case 'bow':
      for (let i = -6; i <= 6; i++) { const t = i / 6; px(x, 6 + Math.round(4 * (1 - t * t)), 8 + i, PAL.wood2); px(x, 7 + Math.round(4 * (1 - t * t)), 8 + i, PAL.wood1); }
      linePx(x, 6, 2, 6, 14, PAL.clothWhite1);
      break;
    case 'crossbow':
      rect(x, 3, 7, 11, 3, PAL.wood1); rect(x, 6, 3, 2, 11, PAL.metal1);
      linePx(x, 4, 3, 10, 3, PAL.clothWhite1); rect(x, 12, 6, 2, 5, PAL.metal2);
      break;
    case 'shield':
      rect(x, 3, 2, 10, 9, PAL.wood1); rect(x, 4, 11, 8, 2, PAL.wood1); rect(x, 6, 13, 4, 1, PAL.wood1);
      rect(x, 3, 2, 10, 2, PAL.metal2); ellipsePx(x, 8, 7, 2, 2, PAL.metal3);
      rect(x, 7, 3, 2, 10, PAL.clothRed1);
      break;
    case 'armor':
      rect(x, 3, 4, 10, 9, PAL.metal1); rect(x, 3, 4, 10, 2, PAL.metal3);
      rect(x, 1, 5, 3, 5, PAL.metal1); rect(x, 12, 5, 3, 5, PAL.metal1);
      rect(x, 5, 2, 6, 3, PAL.metal2); rect(x, 6, 7, 4, 5, PAL.metal0);
      break;
    case 'helmet':
      ellipsePx(x, 8, 8, 6, 5, PAL.metal1); ellipsePx(x, 8, 7, 5, 4, PAL.metal2);
      rect(x, 5, 8, 6, 4, PAL.ink1); rect(x, 4, 11, 8, 2, PAL.metal0);
      px(x, 8, 3, PAL.metal3);
      break;
    case 'cloack':
      rect(x, 4, 3, 8, 11, PAL.clothGreen1); rect(x, 4, 3, 8, 2, PAL.clothGreen2);
      rect(x, 3, 5, 2, 8, PAL.clothGreen0); rect(x, 11, 5, 2, 8, PAL.clothGreen0);
      rect(x, 6, 2, 4, 2, PAL.clothYel1);
      break;
    case 'torch':
      linePx(x, 8, 15, 8, 7, PAL.wood1); rect(x, 6, 5, 4, 4, PAL.wood0);
      rect(x, 5, 2, 6, 4, PAL.fire1); rect(x, 6, 1, 4, 3, PAL.fire2); rect(x, 7, 0, 2, 2, PAL.fire3);
      break;
    case 'lantern':
      rect(x, 5, 5, 6, 8, PAL.metal1); rect(x, 6, 6, 4, 6, PAL.fire3); rect(x, 7, 7, 2, 4, PAL.fire4);
      rect(x, 4, 4, 8, 2, PAL.metal0); linePx(x, 8, 4, 8, 1, PAL.metal2); rect(x, 5, 13, 6, 1, PAL.metal0);
      break;
    case 'candle':
      rect(x, 7, 6, 3, 8, PAL.clothWhite1); rect(x, 7, 6, 1, 8, PAL.clothWhite2);
      rect(x, 7, 3, 3, 3, PAL.fire2); rect(x, 8, 1, 1, 3, PAL.fire3); ellipsePx(x, 7, 14, 4, 1.5, PAL.metal1);
      break;
    case 'bandage':
      rect(x, 2, 6, 12, 4, PAL.clothWhite1); rect(x, 6, 2, 4, 12, PAL.clothWhite1);
      rect(x, 6, 6, 4, 4, PAL.clothWhite2); px(x, 3, 7, PAL.clothWhite0); px(x, 12, 8, PAL.clothWhite0);
      px(x, 8, 8, PAL.clothRed1); px(x, 7, 9, PAL.clothRed1);
      break;
    case 'potion':
      rect(x, 6, 2, 4, 3, PAL.metal2); rect(x, 5, 5, 6, 8, PAL.water2);
      ellipsePx(x, 8, 9, 4, 4, PAL.clothRed2); rect(x, 6, 5, 2, 6, PAL.water3); px(x, 7, 7, PAL.clothWhite2);
      break;
    case 'flask':
      ellipsePx(x, 8, 10, 5, 4, PAL.water2); rect(x, 6, 3, 4, 5, PAL.water2);
      rect(x, 6, 2, 4, 2, PAL.wood1); ellipsePx(x, 8, 11, 4, 3, PAL.leaf1); px(x, 7, 9, PAL.water4);
      break;
    case 'poison':
      ellipsePx(x, 8, 10, 4, 5, PAL.metal3); rect(x, 6, 3, 4, 4, PAL.metal2);
      rect(x, 6, 2, 4, 2, PAL.ink1); ellipsePx(x, 8, 11, 3, 3, PAL.leaf0); px(x, 8, 12, PAL.leaf2);
      px(x, 5, 8, PAL.metal4);
      break;
    case 'herb':
      linePx(x, 8, 15, 8, 5, PAL.leaf1);
      for (const [dx, dy] of [[-3, -3], [3, -3], [-4, 1], [4, 1], [-2, -6], [2, -6]] as const)
        ellipsePx(x, 8 + dx, 8 + dy, 3, 2, PAL.leaf2);
      px(x, 8, 4, PAL.clothYel2);
      break;
    case 'mushroom':
      ellipsePx(x, 8, 7, 6, 4, PAL.clothRed1); ellipsePx(x, 8, 6, 5, 3, PAL.clothRed2);
      px(x, 5, 6, PAL.clothWhite1); px(x, 9, 5, PAL.clothWhite1); px(x, 7, 8, PAL.clothWhite1);
      rect(x, 6, 9, 4, 6, PAL.clothWhite1); rect(x, 6, 9, 4, 1, PAL.clothWhite0);
      break;
    case 'bread':
      ellipsePx(x, 8, 9, 7, 5, PAL.wood3); ellipsePx(x, 8, 8, 6, 4, PAL.wood4);
      linePx(x, 4, 7, 8, 6, PAL.wood2); linePx(x, 8, 6, 12, 8, PAL.wood2);
      px(x, 6, 6, PAL.clothYel2);
      break;
    case 'cheese':
      ellipsePx(x, 8, 10, 6, 4, PAL.clothYel1); ellipsePx(x, 8, 8, 6, 4, PAL.clothYel2);
      px(x, 6, 8, PAL.clothYel0); px(x, 10, 9, PAL.clothYel0); px(x, 8, 11, PAL.clothYel0);
      break;
    case 'apple':
      ellipsePx(x, 8, 9, 5, 5, PAL.clothRed1); ellipsePx(x, 6, 7, 2, 2, PAL.clothRed2);
      linePx(x, 8, 4, 9, 2, PAL.wood1); px(x, 10, 3, PAL.leaf2);
      break;
    case 'fish':
      ellipsePx(x, 8, 8, 6, 3, PAL.metal3); ellipsePx(x, 8, 7, 5, 2, PAL.metal4);
      rect(x, 13, 6, 2, 4, PAL.metal2); px(x, 4, 7, PAL.ink0); linePx(x, 6, 6, 10, 10, PAL.water3);
      break;
    case 'meat':
      ellipsePx(x, 8, 9, 6, 4, PAL.clothRed1); ellipsePx(x, 7, 8, 4, 3, PAL.clothRed2);
      ellipsePx(x, 11, 10, 2, 2, PAL.clothWhite1); px(x, 4, 11, PAL.blood0 ?? '#4a120c');
      break;
    case 'egg':
      ellipsePx(x, 8, 9, 4, 5, PAL.clothWhite2); ellipsePx(x, 7, 8, 2, 3, PAL.parch3);
      break;
    case 'stew':
      ellipsePx(x, 8, 11, 6, 3, PAL.metal1); rect(x, 3, 8, 10, 4, PAL.metal2);
      ellipsePx(x, 8, 8, 5, 2, PAL.wood2); px(x, 6, 8, PAL.clothRed1); px(x, 10, 8, PAL.leaf2);
      px(x, 8, 5, PAL.clothWhite0); px(x, 9, 3, PAL.clothWhite0);
      break;
    case 'mug':
      rect(x, 4, 5, 7, 9, PAL.metal2); rect(x, 4, 5, 7, 2, PAL.clothWhite1);
      rect(x, 11, 7, 2, 4, PAL.metal1); rect(x, 4, 12, 7, 2, PAL.metal1);
      break;
    case 'bottle': case 'beer':
      rect(x, 6, 2, 3, 3, PAL.wood1); rect(x, 5, 5, 5, 9, k === 'beer' ? PAL.wood2 : PAL.leaf0);
      rect(x, 5, 5, 5, 2, k === 'beer' ? PAL.clothWhite1 : PAL.leaf1);
      rect(x, 6, 8, 3, 4, PAL.parch2); px(x, 6, 6, 'rgba(255,255,255,.35)');
      break;
    case 'salt':
      ellipsePx(x, 8, 11, 6, 4, PAL.clothWhite1); ellipsePx(x, 8, 9, 4, 3, PAL.clothWhite2);
      ellipsePx(x, 8, 7, 2, 2, PAL.parch3); px(x, 5, 10, PAL.stone3); px(x, 11, 10, PAL.stone3);
      break;
    case 'ore':
      ellipsePx(x, 8, 10, 6, 5, PAL.stone1); ellipsePx(x, 7, 9, 4, 3, PAL.stone2);
      px(x, 6, 8, PAL.metal2); px(x, 9, 10, PAL.metal3); px(x, 8, 7, PAL.metal1); px(x, 10, 9, PAL.clothYel1);
      break;
    case 'coal':
      ellipsePx(x, 8, 10, 6, 5, '#22201e'); ellipsePx(x, 7, 9, 4, 3, '#33312e');
      px(x, 6, 8, '#4a4844'); px(x, 9, 11, '#151312');
      break;
    case 'iron':
      rect(x, 3, 6, 10, 4, PAL.metal1); rect(x, 3, 6, 10, 1, PAL.metal3); rect(x, 3, 9, 10, 1, PAL.metal0);
      rect(x, 5, 4, 6, 2, PAL.metal2);
      break;
    case 'hide':
      ellipsePx(x, 8, 9, 6, 6, PAL.wood2); ellipsePx(x, 8, 9, 4, 4, PAL.wood3);
      px(x, 4, 5, PAL.wood1); px(x, 12, 5, PAL.wood1); px(x, 4, 13, PAL.wood1); px(x, 12, 13, PAL.wood1);
      for (let i = 0; i < 5; i++) px(x, 6 + i, 7 + (i % 2), PAL.wood0);
      break;
    case 'wool':
      ellipsePx(x, 8, 9, 6, 5, PAL.clothWhite1);
      for (let i = 0; i < 8; i++) ellipsePx(x, 4 + (i % 4) * 3, 6 + Math.floor(i / 4) * 4, 2, 2, PAL.clothWhite2);
      break;
    case 'plank':
      rect(x, 2, 6, 12, 4, PAL.wood2); rect(x, 2, 6, 12, 1, PAL.wood3); rect(x, 2, 9, 12, 1, PAL.wood0);
      px(x, 4, 8, PAL.wood1); px(x, 10, 7, PAL.wood1);
      break;
    case 'nails':
      for (let i = 0; i < 4; i++) { rect(x, 3 + i * 3, 4, 1, 8, PAL.metal2); px(x, 3 + i * 3, 3, PAL.metal3); }
      break;
    case 'rope':
      ellipsePx(x, 8, 9, 5, 5, 'rgba(0,0,0,0)');
      for (let i = 0; i < 20; i++) { const a = i / 20 * Math.PI * 2; px(x, 8 + Math.cos(a) * 5, 9 + Math.sin(a) * 5, PAL.thatch1); px(x, 8 + Math.cos(a) * 4, 9 + Math.sin(a) * 4, PAL.thatch0); }
      break;
    case 'notebook':
      rect(x, 3, 2, 10, 12, PAL.wood1); rect(x, 4, 3, 8, 10, PAL.parch2);
      rect(x, 3, 2, 2, 12, PAL.wood0); rect(x, 4, 3, 1, 10, PAL.parch1);
      for (let i = 0; i < 4; i++) rect(x, 6, 5 + i * 2, 5, 1, PAL.parch4);
      px(x, 12, 8, PAL.clothYel1);
      break;
    case 'scroll':
      rect(x, 3, 4, 10, 8, PAL.parch2); ellipsePx(x, 3, 8, 2, 4, PAL.parch1); ellipsePx(x, 13, 8, 2, 4, PAL.parch1);
      for (let i = 0; i < 3; i++) rect(x, 5, 6 + i * 2, 6, 1, PAL.parch4);
      break;
    case 'map':
      rect(x, 2, 3, 12, 10, PAL.parch2); rect(x, 2, 3, 12, 1, PAL.parch1); rect(x, 2, 12, 12, 1, PAL.parch0);
      linePx(x, 4, 6, 8, 5, PAL.parch4); linePx(x, 8, 5, 12, 8, PAL.parch4); linePx(x, 5, 10, 9, 9, PAL.parch4);
      px(x, 9, 7, PAL.clothRed1); px(x, 5, 5, PAL.leaf1); ellipsePx(x, 11, 10, 2, 1, PAL.water1);
      break;
    case 'letter':
      rect(x, 2, 4, 12, 8, PAL.parch3); linePx(x, 2, 4, 8, 9, PAL.parch1); linePx(x, 14, 4, 8, 9, PAL.parch1);
      px(x, 8, 9, PAL.clothRed1);
      break;
    case 'key':
      ellipsePx(x, 5, 5, 3, 3, PAL.clothYel1); ellipsePx(x, 5, 5, 1, 1, PAL.wood0);
      rect(x, 6, 6, 7, 2, PAL.clothYel1); rect(x, 11, 8, 2, 3, PAL.clothYel1); rect(x, 8, 8, 1, 2, PAL.clothYel0);
      break;
    case 'lockpick':
      linePx(x, 3, 13, 10, 4, PAL.metal2); linePx(x, 10, 4, 13, 3, PAL.metal3);
      linePx(x, 4, 12, 7, 13, PAL.metal1); px(x, 3, 13, PAL.wood1);
      break;
    case 'permit': case 'pass':
      rect(x, 3, 3, 10, 10, PAL.parch2); rect(x, 3, 3, 10, 2, PAL.clothRed1);
      for (let i = 0; i < 3; i++) rect(x, 5, 7 + i * 2, 6, 1, PAL.parch4);
      ellipsePx(x, 11, 12, 2, 2, PAL.clothYel1);
      break;
    case 'watch':
      ellipsePx(x, 8, 9, 5, 5, PAL.clothYel1); ellipsePx(x, 8, 9, 4, 4, PAL.parch3);
      linePx(x, 8, 9, 8, 6, PAL.ink1); linePx(x, 8, 9, 10, 10, PAL.ink1);
      rect(x, 7, 3, 2, 2, PAL.clothYel0); px(x, 8, 2, PAL.clothYel2);
      break;
    case 'ring':
      ellipsePx(x, 8, 10, 4, 4, PAL.clothYel1); ellipsePx(x, 8, 10, 3, 3, 'rgba(0,0,0,0)');
      px(x, 8, 5, PAL.water4); px(x, 7, 6, PAL.water3); px(x, 9, 6, PAL.water3);
      break;
    case 'gem':
      ellipsePx(x, 8, 9, 5, 5, PAL.water2); ellipsePx(x, 8, 8, 4, 4, PAL.water3);
      px(x, 6, 6, PAL.water4); px(x, 8, 11, PAL.clothBlue0);
      break;
    case 'relic':
      rect(x, 6, 2, 4, 12, PAL.clothYel1); rect(x, 3, 5, 10, 4, PAL.clothYel1);
      rect(x, 6, 2, 4, 1, PAL.clothYel2); rect(x, 3, 5, 10, 1, PAL.clothYel2);
      px(x, 8, 7, PAL.clothRed1); px(x, 7, 3, PAL.fire4);
      break;
    case 'dice':
      rect(x, 2, 8, 6, 6, PAL.clothWhite2); rect(x, 8, 3, 6, 6, PAL.clothWhite1);
      px(x, 4, 10, PAL.ink0); px(x, 6, 12, PAL.ink0); px(x, 5, 11, PAL.ink0);
      px(x, 10, 5, PAL.ink0); px(x, 12, 7, PAL.ink0);
      break;
    case 'cards':
      rect(x, 3, 3, 7, 10, PAL.clothWhite2); rect(x, 6, 5, 7, 10, PAL.clothWhite1);
      px(x, 9, 9, PAL.clothRed1); px(x, 8, 10, PAL.clothRed1); px(x, 10, 10, PAL.clothRed1);
      rect(x, 3, 3, 7, 1, PAL.clothWhite0);
      break;
    case 'quill':
      linePx(x, 3, 14, 11, 3, PAL.clothWhite1); linePx(x, 4, 13, 12, 4, PAL.clothWhite2);
      px(x, 3, 14, PAL.ink1); px(x, 12, 2, PAL.clothWhite2);
      break;
    case 'ink':
      rect(x, 5, 6, 6, 7, PAL.ink1); rect(x, 6, 4, 4, 3, PAL.metal1);
      rect(x, 5, 6, 6, 1, PAL.metal2); px(x, 7, 9, PAL.water3);
      break;
    case 'oilcloth':
      rect(x, 3, 4, 10, 8, PAL.clothGrey0); rect(x, 3, 4, 10, 2, PAL.clothGrey1);
      linePx(x, 3, 8, 13, 8, PAL.clothGrey2); px(x, 5, 10, PAL.water3);
      break;
    case 'waterskin':
      ellipsePx(x, 8, 10, 5, 5, PAL.wood2); rect(x, 6, 3, 4, 4, PAL.wood1);
      rect(x, 6, 2, 4, 2, PAL.metal1); linePx(x, 4, 7, 12, 7, PAL.wood0);
      break;
    case 'net':
      for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) px(x, 3 + i * 2.5, 3 + j * 2.5, PAL.clothGrey1);
      for (let i = 0; i < 5; i++) { linePx(x, 3 + i * 2.5, 3, 3 + i * 2.5, 13, PAL.clothGrey0); linePx(x, 3, 3 + i * 2.5, 13, 3 + i * 2.5, PAL.clothGrey0); }
      break;
    case 'hook':
      linePx(x, 8, 3, 8, 9, PAL.metal2); ellipsePx(x, 8, 11, 3, 3, 'rgba(0,0,0,0)');
      for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI + Math.PI; px(x, 8 + Math.cos(a) * 3, 11 + Math.sin(a) * 3, PAL.metal2); }
      px(x, 8, 2, PAL.metal3);
      break;
    case 'bait':
      ellipsePx(x, 8, 9, 4, 3, PAL.clothRed1); px(x, 5, 8, PAL.leaf2); px(x, 11, 10, PAL.wood1);
      break;
    case 'trap':
      ellipsePx(x, 8, 9, 6, 4, PAL.metal1); for (let i = 0; i < 6; i++) px(x, 3 + i * 2, 6, PAL.metal3);
      rect(x, 6, 9, 4, 2, PAL.metal0);
      break;
    case 'bone':
      rect(x, 4, 7, 8, 2, PAL.clothWhite1); ellipsePx(x, 4, 8, 2, 3, PAL.clothWhite2); ellipsePx(x, 12, 8, 2, 3, PAL.clothWhite2);
      break;
    case 'feather':
      ellipsePx(x, 8, 8, 3, 6, PAL.clothWhite1); linePx(x, 8, 3, 8, 14, PAL.clothWhite0);
      px(x, 6, 6, PAL.clothWhite2); px(x, 10, 9, PAL.clothWhite2);
      break;
    case 'grain':
      rect(x, 4, 5, 8, 9, PAL.parch1); rect(x, 4, 5, 8, 2, PAL.parch2);
      linePx(x, 5, 4, 11, 4, PAL.thatch0);
      for (let i = 0; i < 4; i++) { px(x, 6 + i, 3, PAL.clothYel1); px(x, 6 + i, 2, PAL.clothYel2); }
      break;
    case 'toolbox':
      rect(x, 2, 6, 12, 7, PAL.wood1); rect(x, 2, 6, 12, 2, PAL.wood2);
      rect(x, 6, 3, 4, 3, PAL.metal1); px(x, 8, 9, PAL.metal2); rect(x, 2, 9, 12, 1, PAL.wood0);
      break;
    case 'deed':
      rect(x, 3, 2, 10, 12, PAL.parch3); rect(x, 3, 2, 10, 2, PAL.clothRed0);
      for (let i = 0; i < 5; i++) rect(x, 5, 6 + i * 1.6, 6, 1, PAL.parch4);
      ellipsePx(x, 11, 12, 2, 2, PAL.clothRed1);
      break;
    case 'book':
      rect(x, 3, 2, 10, 12, PAL.tile1); rect(x, 4, 3, 8, 10, PAL.parch2);
      rect(x, 3, 2, 2, 12, PAL.wood0); rect(x, 5, 6, 6, 1, PAL.parch4); rect(x, 5, 8, 6, 1, PAL.parch4);
      px(x, 12, 8, PAL.clothYel1);
      break;
    case 'garlic':
      ellipsePx(x, 8, 10, 4, 4, PAL.clothWhite1); ellipsePx(x, 8, 9, 3, 3, PAL.clothWhite2);
      linePx(x, 6, 7, 6, 13, PAL.clothGrey1); linePx(x, 10, 7, 10, 13, PAL.clothGrey1);
      linePx(x, 8, 6, 8, 3, PAL.leaf1); px(x, 9, 3, PAL.leaf2);
      break;
    case 'jar':
      rect(x, 4, 6, 8, 8, PAL.water3); rect(x, 4, 4, 8, 2, PAL.wood1); rect(x, 4, 4, 8, 1, PAL.wood2);
      ellipsePx(x, 8, 11, 3, 2, PAL.clothYel1); linePx(x, 6, 8, 6, 12, PAL.water4);
      break;
    case 'turnip':
      ellipsePx(x, 8, 10, 4, 4, PAL.clothWhite1); ellipsePx(x, 8, 7, 3, 2, PAL.clothRed1);
      linePx(x, 8, 6, 6, 2, PAL.leaf2); linePx(x, 8, 6, 10, 2, PAL.leaf1); linePx(x, 8, 6, 8, 1, PAL.leaf2);
      linePx(x, 8, 14, 8, 15, PAL.parch3);
      break;
    case 'vial':
      rect(x, 6, 6, 4, 8, PAL.water3); rect(x, 6, 4, 4, 2, PAL.wood2); rect(x, 6, 10, 4, 4, PAL.leaf1);
      px(x, 7, 8, PAL.water4); linePx(x, 9, 7, 9, 13, PAL.water2);
      break;
    default:
      rect(x, 3, 3, 10, 10, PAL.clothGrey1); rect(x, 3, 3, 10, 2, PAL.clothGrey2);
      px(x, 8, 8, PAL.clothYel1);
  }
}

export function clearIconCache() { iconCache.clear(); }
void hash2; void shade;
