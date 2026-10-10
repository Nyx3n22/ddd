import { PAL, shade } from './Palette';
import { mk, rect, px, ellipsePx, outlineCanvas } from './Art';
import type { ActorAction, Dir } from './Characters';

/* ============================================================================
   ZWIERZĘTA
   Czworonogi (wilk, pies, dzik, jeleń, koń, szczur) i ptaki (wrona, gęś)
   rysowane proceduralnie w rzucie 3/4. Wcześniej korzystały ze szkieletu
   człowieka i wilk chodził na dwóch nogach.
   Klatki — jak u ludzi — trafiają do pamięci podręcznej.
   ========================================================================== */

interface Beast {
  /** długość i wysokość tułowia, wysokość nóg (px) */
  len: number; body: number; leg: number;
  fur: string; belly: string; dark: string;
  head: number; snout: number; ear: 'point' | 'round' | 'none' | 'antler';
  tail: 'bushy' | 'thin' | 'short' | 'tuft' | 'none';
  mane?: string; tusk?: boolean;
  bird?: boolean;
}

const BEASTS: Record<string, Beast> = {
  wolf:  { len: 18, body: 7, leg: 6, fur: PAL.clothGrey1, belly: PAL.clothGrey2, dark: PAL.clothGrey0, head: 6, snout: 4, ear: 'point', tail: 'bushy' },
  dog:   { len: 15, body: 6, leg: 5, fur: PAL.dirt2, belly: PAL.dirt4, dark: PAL.dirt0, head: 5, snout: 3, ear: 'round', tail: 'thin' },
  boar:  { len: 18, body: 9, leg: 4, fur: PAL.mud1, belly: PAL.mud2, dark: PAL.ink2, head: 7, snout: 4, ear: 'point', tail: 'thin', mane: PAL.ink2, tusk: true },
  deer:  { len: 18, body: 7, leg: 9, fur: PAL.dirt3, belly: PAL.sand1, dark: PAL.dirt1, head: 5, snout: 3, ear: 'antler', tail: 'short' },
  horse: { len: 24, body: 10, leg: 11, fur: PAL.wood1, belly: PAL.wood2, dark: PAL.wood0, head: 6, snout: 5, ear: 'point', tail: 'tuft', mane: PAL.ink2 },
  rat:   { len: 8, body: 4, leg: 2, fur: PAL.clothGrey0, belly: PAL.clothGrey1, dark: PAL.ink2, head: 3, snout: 2, ear: 'round', tail: 'thin' },
  crow:  { len: 7, body: 5, leg: 2, fur: PAL.ink1, belly: PAL.ink2, dark: PAL.ink0, head: 3, snout: 2, ear: 'none', tail: 'short', bird: true },
  goose: { len: 10, body: 7, leg: 3, fur: PAL.clothWhite1, belly: PAL.clothWhite2, dark: PAL.clothWhite0, head: 3, snout: 3, ear: 'none', tail: 'short', bird: true }
};

export function hasAnimalArt(id: string) { return !!BEASTS[id]; }

const cache = new Map<string, HTMLCanvasElement>();
const W = 40, H = 34;

export function drawAnimal(ctx: CanvasRenderingContext2D, kind: string, feetX: number, feetY: number,
  o: { dir: Dir; action: ActorAction; frame: number; hurt?: number; telegraph?: number; alpha?: number }) {
  const b = BEASTS[kind]; if (!b) return;
  const moving = o.action === 'walk' || o.action === 'run' || o.action === 'sneak' || o.action === 'search';
  const frame = o.action === 'death' ? Math.min(4, o.frame) : moving ? o.frame % 4 : o.action === 'attack' ? Math.min(3, o.frame) : 0;
  const key = `${kind}|${o.dir}|${o.action === 'death' ? 'd' : moving ? 'm' : o.action === 'attack' ? 'a' : 'i'}|${frame}|${Math.round((o.hurt ?? 0) * 2)}`;
  let img = cache.get(key);
  if (!img) {
    img = render(b, o.dir, moving, o.action === 'attack', o.action === 'death', frame, o.hurt ?? 0);
    if (cache.size > 600) cache.clear();
    cache.set(key, img);
  }
  const dx = Math.round(feetX - img.width / 2), dy = Math.round(feetY - img.height + 5);
  if (o.alpha !== undefined && o.alpha < 1) { ctx.save(); ctx.globalAlpha = o.alpha; }
  ctx.drawImage(img, dx, dy);
  if (o.alpha !== undefined && o.alpha < 1) ctx.restore();
  if (o.telegraph && o.telegraph > 0) {
    ctx.save();
    ctx.globalAlpha = 0.55 * o.telegraph;
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(img, dx, dy);
    ctx.restore();
  }
}

function render(b: Beast, dir: Dir, moving: boolean, attack: boolean, dead: boolean, frame: number, hurt: number): HTMLCanvasElement {
  const [c, x] = mk(W, H);
  const gy = H - 4;                 // linia ziemi
  if (dead) drawDead(x, b, W / 2, gy);
  else if (dir === 1 || dir === 2) drawSide(x, b, W / 2, gy, dir === 1, moving, attack, frame);
  else drawFront(x, b, W / 2, gy, dir === 3, moving, attack, frame);
  if (hurt > 0.4 && !b.bird) { px(x, W / 2 - 2, gy - b.leg - 3, PAL.clothRed0); px(x, W / 2 + 1, gy - b.leg - 2, PAL.clothRed1); }
  return outlineCanvas(c, PAL.ink0);
}

/** Profil: tułów poziomo, cztery nogi, głowa z przodu. */
function drawSide(x: CanvasRenderingContext2D, b: Beast, cx: number, gy: number, left: boolean, moving: boolean, attack: boolean, frame: number) {
  const s = left ? -1 : 1;
  const bob = moving && frame % 2 === 1 ? -1 : 0;
  const top = gy - b.leg - b.body + bob;
  const x0 = cx - b.len / 2;
  const fx = (v: number) => left ? 2 * cx - v : v;     // lustro względem środka
  const R = (vx: number, vy: number, w: number, h: number, col: string) => rect(x, left ? 2 * cx - vx - w : vx, vy, w, h, col);

  if (b.bird) {
    // ptak: owalny korpus, nóżki, dziób
    ellipsePx(x, cx, top + b.body / 2, b.len / 2, b.body / 2, b.fur);
    ellipsePx(x, cx - s, top + b.body / 2 + 1, b.len / 2 - 2, b.body / 2 - 2, b.belly);
    const step = moving ? (frame % 2 ? 1 : -1) : 0;
    rect(x, cx - 1 + step, gy - b.leg, 1, b.leg, PAL.clothYel0);
    rect(x, cx + 1 - step, gy - b.leg, 1, b.leg, PAL.clothYel0);
    const hx = fx(x0 + b.len - 1), hy = top - (b.snout > 2 ? 3 : 1);
    if (b.snout > 2) R(x0 + b.len - 3, hy, 2, 4, b.fur);   // szyja gęsi
    ellipsePx(x, hx, hy, b.head / 2 + 0.5, b.head / 2, b.fur);
    R(x0 + b.len + 1, hy, b.snout, 1, b.bird && b.fur === PAL.ink1 ? PAL.ink2 : PAL.clothYel1);
    px(x, hx + s, hy - 1, PAL.ink0);
    if (attack) R(x0 + b.len + 1, hy + 1, b.snout, 1, PAL.clothYel0);
    return;
  }

  // nogi: przednia i tylna para, w ruchu na przemian
  const swing = moving ? [2, 0, -2, 0][frame] : 0;
  const legW = b.len > 20 ? 2 : b.len < 10 ? 1 : 2;
  const back = x0 + 2, front = x0 + b.len - 3 - legW;
  R(back + swing, gy - b.leg, legW, b.leg, b.dark);
  R(front - swing, gy - b.leg, legW, b.leg, b.dark);
  // tułów
  R(x0, top, b.len, b.body, b.fur);
  R(x0 + 1, top + b.body - 2, b.len - 2, 2, b.belly);
  R(x0, top, b.len, 1, shade(b.fur, 0.15));
  if (b.mane) R(x0 + b.len - 7, top - 1, 6, 2, b.mane);
  // druga para nóg (bliżej kamery)
  R(back + 2 - swing, gy - b.leg, legW, b.leg, b.fur);
  R(front + 2 + swing, gy - b.leg, legW, b.leg, b.fur);
  // ogon
  const tx = x0 - 1, ty = top + 1;
  if (b.tail === 'bushy') { R(tx - 4, ty + 1, 5, 3, b.fur); R(tx - 5, ty + 2, 2, 2, b.belly); }
  else if (b.tail === 'thin') { R(tx - 4, ty + (b.len < 10 ? 2 : 0), 4, 1, b.dark); }
  else if (b.tail === 'tuft') { R(tx - 2, ty, 3, 2, b.mane || b.dark); R(tx - 3, ty + 2, 2, 6, b.mane || b.dark); }
  else if (b.tail === 'short') { R(tx - 1, ty, 2, 2, b.belly); }
  // głowa — przy ataku wysunięta i opuszczona
  const lunge = attack ? 2 : 0;
  const hx0 = x0 + b.len - 2 + lunge, hy0 = top - Math.round(b.head / 2) + (attack ? 2 : 0) + (b.len > 20 ? -3 : 0);
  if (b.len > 20) R(x0 + b.len - 4, hy0 + 2, 4, b.body, b.fur);   // szyja konia
  R(hx0, hy0, b.head, b.head - 1, b.fur);
  R(hx0 + b.head - 1, hy0 + Math.round(b.head / 2) - 1, b.snout, Math.max(2, Math.round(b.head / 2)), shade(b.fur, -0.08));
  px(x, fx(hx0 + b.head + b.snout - 2), hy0 + Math.round(b.head / 2) - 1, PAL.ink0);   // nos
  px(x, fx(hx0 + b.head - 2), hy0 + 1, attack ? PAL.fire2 : PAL.ink0);               // oko
  if (attack && b.snout >= 3) R(hx0 + b.head, hy0 + b.head - 2, b.snout, 1, PAL.clothWhite1); // kły
  if (b.tusk) R(hx0 + b.head + b.snout - 2, hy0 + b.head - 3, 1, 2, PAL.clothWhite2);
  if (b.ear === 'point') { R(hx0 + 1, hy0 - 2, 1, 2, b.dark); R(hx0 + 3, hy0 - 2, 1, 2, b.dark); }
  else if (b.ear === 'round') R(hx0 + 1, hy0 - 1, 2, 1, b.dark);
  else if (b.ear === 'antler') { R(hx0 + 1, hy0 - 5, 1, 5, PAL.wood3); R(hx0 - 1, hy0 - 6, 3, 1, PAL.wood3); R(hx0 + 2, hy0 - 4, 2, 1, PAL.wood3); }
}

/** Przód/tył: krótszy, szerszy kształt — w rzucie 3/4 zwierzę „idzie na kamerę”. */
function drawFront(x: CanvasRenderingContext2D, b: Beast, cx: number, gy: number, away: boolean, moving: boolean, attack: boolean, frame: number) {
  const bob = moving && frame % 2 === 1 ? -1 : 0;
  const halfW = Math.max(3, Math.round(b.body * 0.7));
  const depth = Math.round(b.len * 0.45);
  const top = gy - b.leg - b.body + bob;
  if (b.bird) {
    ellipsePx(x, cx, top + b.body / 2, b.body / 2 + 1, b.body / 2, b.fur);
    rect(x, cx - 2, gy - b.leg, 1, b.leg, PAL.clothYel0); rect(x, cx + 1, gy - b.leg, 1, b.leg, PAL.clothYel0);
    if (!away) { ellipsePx(x, cx, top - 1, b.head / 2 + 0.5, b.head / 2, b.fur); rect(x, cx, top, 1, 2, PAL.clothYel1); px(x, cx - 1, top - 2, PAL.ink0); px(x, cx + 1, top - 2, PAL.ink0); }
    else ellipsePx(x, cx, top - 1, b.head / 2 + 0.5, b.head / 2, shade(b.fur, -0.1));
    return;
  }
  const swing = moving ? (frame % 2 ? 1 : -1) : 0;
  // nogi
  rect(x, cx - halfW, gy - b.leg - swing, 2, b.leg + swing, b.dark);
  rect(x, cx + halfW - 2, gy - b.leg + swing, 2, b.leg - swing, b.dark);
  // tułów widziany od czoła: owal głębokości ciała
  ellipsePx(x, cx, top + b.body / 2, halfW + 1, b.body / 2 + depth / 4, b.fur);
  if (!away) rect(x, cx - halfW + 2, top + b.body - 1, halfW * 2 - 3, 2, b.belly);
  if (b.mane) rect(x, cx - 2, top - 1, 4, 3, b.mane);
  if (away) {
    // tył: ogon na środku
    if (b.tail === 'bushy') rect(x, cx - 2, top + 2, 4, 5, b.fur);
    else if (b.tail === 'tuft') rect(x, cx - 1, top + 2, 3, 8, b.mane || b.dark);
    else rect(x, cx, top + 2, 1, 3, b.dark);
    rect(x, cx - Math.round(b.head / 2), top - b.head + 2, b.head, b.head - 1, shade(b.fur, -0.1));
  } else {
    const hy = top - b.head + 3 + (attack ? 2 : 0) + (b.len > 20 ? -4 : 0);
    rect(x, cx - Math.round(b.head / 2), hy, b.head, b.head, b.fur);
    rect(x, cx - 1, hy + b.head - 2, 3, Math.max(2, b.snout - 1), shade(b.fur, -0.08));
    px(x, cx, hy + b.head - 2 + Math.max(1, b.snout - 2), PAL.ink0);
    const eye = attack ? PAL.fire2 : PAL.ink0;
    px(x, cx - Math.round(b.head / 2) + 1, hy + 2, eye); px(x, cx + Math.round(b.head / 2) - 2, hy + 2, eye);
    if (b.tusk) { px(x, cx - 2, hy + b.head, PAL.clothWhite2); px(x, cx + 2, hy + b.head, PAL.clothWhite2); }
    if (b.ear === 'point') { rect(x, cx - Math.round(b.head / 2), hy - 2, 1, 2, b.dark); rect(x, cx + Math.round(b.head / 2) - 1, hy - 2, 1, 2, b.dark); }
    else if (b.ear === 'antler') { rect(x, cx - 3, hy - 5, 1, 5, PAL.wood3); rect(x, cx + 3, hy - 5, 1, 5, PAL.wood3); rect(x, cx - 5, hy - 5, 3, 1, PAL.wood3); rect(x, cx + 3, hy - 5, 3, 1, PAL.wood3); }
    else if (b.ear === 'round') { px(x, cx - Math.round(b.head / 2), hy, b.dark); px(x, cx + Math.round(b.head / 2) - 1, hy, b.dark); }
  }
  rect(x, cx - halfW + 1, gy - b.leg + swing, 2, b.leg - swing, b.fur);
  rect(x, cx + halfW - 3, gy - b.leg - swing, 2, b.leg + swing, b.fur);
}

function drawDead(x: CanvasRenderingContext2D, b: Beast, cx: number, gy: number) {
  // leży na boku: płaski owal, nogi sztywno w bok
  const y = gy - Math.round(b.body / 2);
  ellipsePx(x, cx + 1, gy, b.len / 2 + 2, 2, 'rgba(110,35,24,0.55)');
  ellipsePx(x, cx, y, b.len / 2, Math.max(2, b.body / 2 - 1), b.fur);
  rect(x, cx - b.len / 2 + 2, y + 1, b.len - 4, 1, b.belly);
  if (!b.bird) {
    rect(x, cx - 4, y - Math.round(b.body / 2) - 2, 1, 3, b.dark);
    rect(x, cx + 3, y - Math.round(b.body / 2) - 2, 1, 3, b.dark);
  }
  rect(x, cx + b.len / 2 - 1, y - 1, b.head, b.head - 2, b.fur);
  px(x, cx + b.len / 2 + 1, y, PAL.ink0);
}
