import { PAL, shade, mix } from './Palette';
import { mk, rect, px, ellipsePx, linePx, outlineCanvas } from './Art';
import { hash2 } from '../core/RNG';

/* ============================================================================
   POSTACIE — jeden szkielet animacji, wiele palet i warstw ubioru.
   Warstwy: ciało → ubranie → włosy/nakrycie → przedmiot w dłoni (brief, sekcja 2).
   Klatki są pre-renderowane do pamięci podręcznej (leniwie), więc koszt
   outline'u sylwetki płacimy raz na klatkę animacji, nie raz na kadr gry.
   ========================================================================== */

export type Dir = 0 | 1 | 2 | 3; // 0=dół, 1=lewo, 2=prawo, 3=góra
export const DIR_NAME = ['down', 'left', 'right', 'up'] as const;

export type ActorAction =
  | 'idle' | 'walk' | 'run' | 'sneak' | 'attack' | 'block' | 'hit' | 'death'
  | 'work' | 'sit' | 'sleep' | 'carry' | 'talk' | 'search' | 'point';

export interface CharPalette {
  id: string;
  skin: string; skinDark: string;
  hair: string;
  tunic: string; tunicDark: string;
  trousers: string;
  boots: string;
  belt: string;
  accent: string;      // lamówka / chusta
  hat?: string;        // nakrycie głowy
  hatBand?: string;
  cloak?: string;
  beard?: string;
  armor?: string;      // napierśnik / kaftan
}

export type WeaponKind = 'none' | 'sword' | 'axe' | 'hammer' | 'dagger' | 'bow' | 'crossbow' | 'staff' | 'torch' | 'spear' | 'tool';

export interface ActorLook {
  palette: CharPalette;
  weapon?: WeaponKind;
  offhand?: 'none' | 'shield' | 'torch' | 'lantern' | 'basket' | 'mug' | 'hammer' | 'book';
  helmet?: 'none' | 'cap' | 'hood' | 'kettle' | 'crown' | 'coif' | 'straw';
  cloak?: boolean;
  beard?: boolean;
  bulk?: number;   // 0 = szczupły, 1 = krępy, 2 = otyły (herszt, kowal)
  height?: number; // 0 = normalny, -1 = niski (dziecko), 1 = wysoki
}

export const FRAME_COUNTS: Record<ActorAction, number> = {
  idle: 4, walk: 6, run: 6, sneak: 6, attack: 6, block: 2, hit: 2, death: 5,
  work: 6, sit: 2, sleep: 2, carry: 6, talk: 4, search: 4, point: 2
};

/* ---- geometria szkieletu ---- */
interface Pose {
  bob: number;        // przesunięcie pionowe tułowia
  crouch: number;     // obniżenie (skradanie/siad)
  lean: number;       // pochylenie w przód
  legL: [number, number]; legR: [number, number]; // [dx,dy] stóp
  armL: [number, number]; armR: [number, number]; // [dx,dy] dłoni
  headTilt: number;
  weaponAngle: number; // -1..1 (0 = w dół, 1 = uniesione)
  weaponExt: number;   // wysunięcie broni przed siebie
  blink: boolean;
  lying: boolean;
}

function computePose(action: ActorAction, frame: number, dir: Dir): Pose {
  const f = frame % Math.max(1, FRAME_COUNTS[action]);
  const p: Pose = {
    bob: 0, crouch: 0, lean: 0, legL: [0, 0], legR: [0, 0], armL: [0, 0], armR: [0, 0],
    headTilt: 0, weaponAngle: 0, weaponExt: 0, blink: false, lying: false
  };
  const cyc = (n: number, amp: number) => Math.sin((f / n) * Math.PI * 2) * amp;
  switch (action) {
    case 'idle': case 'talk':
      p.bob = [0, -1, -1, 0][f] ?? 0;
      p.blink = f === 3;
      if (action === 'talk') { p.armR = [1, [-1, -3, -2, 0][f] ?? 0]; p.headTilt = f % 2 ? 0.4 : -0.3; }
      break;
    case 'walk':
      p.bob = [0, -1, 0, 0, -1, 0][f] ?? 0;
      p.legL = [cyc(6, 2.4), [0, -1, 0, 0, 1, 0][f] ?? 0];
      p.legR = [-cyc(6, 2.4), [0, 1, 0, 0, -1, 0][f] ?? 0];
      p.armL = [-cyc(6, 1.6), 0]; p.armR = [cyc(6, 1.6), 0];
      break;
    case 'run':
      p.bob = [0, -2, -1, 0, -2, -1][f] ?? 0; p.lean = 1;
      p.legL = [cyc(6, 3.6), [0, -2, 0, 0, 2, 0][f] ?? 0];
      p.legR = [-cyc(6, 3.6), [0, 2, 0, 0, -2, 0][f] ?? 0];
      p.armL = [-cyc(6, 2.4), -1]; p.armR = [cyc(6, 2.4), -1];
      break;
    case 'sneak':
      p.crouch = 4; p.lean = 1;
      p.bob = [0, -1, 0, 0, -1, 0][f] ?? 0;
      p.legL = [cyc(6, 2), [0, -1, 0, 0, 0, 0][f] ?? 0];
      p.legR = [-cyc(6, 2), [0, 0, 0, 0, -1, 0][f] ?? 0];
      p.armL = [-1, 1]; p.armR = [1, 1];
      break;
    case 'carry':
      p.crouch = 1; p.bob = [0, -1, 0, 0, -1, 0][f] ?? 0;
      p.legL = [cyc(6, 2), 0]; p.legR = [-cyc(6, 2), 0];
      p.armL = [3, -6]; p.armR = [-3, -6];
      break;
    case 'attack': {
      // 0-1 zamach (telegraf!), 2-3 uderzenie, 4-5 powrót
      const seq = [[-0.2, 0], [0.9, 0], [1.0, 0.6], [0.2, 1.0], [-0.2, 0.6], [-0.2, 0.2]][f] ?? [0, 0];
      p.weaponAngle = seq[0]; p.weaponExt = seq[1];
      p.armR = [2 + seq[1] * 4, -4 - seq[0] * 6];
      p.armL = [-2, -1];
      p.lean = f === 2 || f === 3 ? 2 : 0;
      p.legR = [f === 2 || f === 3 ? 2 : 0, 0];
      p.bob = f === 2 ? -1 : 0;
      break;
    }
    case 'block':
      p.crouch = 2; p.armR = [3, -8]; p.armL = [1, -6]; p.weaponAngle = 0.4; p.weaponExt = 0.3;
      p.bob = f === 0 ? 0 : -1;
      break;
    case 'hit':
      p.lean = -2; p.headTilt = f === 0 ? -1 : 1; p.armL = [-3, -2]; p.armR = [3, -2];
      p.bob = f === 0 ? -1 : 0; p.legL = [-2, 0]; p.legR = [2, 0];
      break;
    case 'death':
      p.lying = f >= 2; p.crouch = f === 1 ? 4 : 0; p.lean = f === 0 ? -1 : -2;
      p.armL = [-3, 1]; p.armR = [3, 1]; p.bob = 0;
      break;
    case 'work': {
      const swing = [0, 0.5, 1.0, 0.7, 0.2, -0.1][f] ?? 0;
      p.armR = [2, -10 + swing * 12]; p.armL = [1, -3];
      p.weaponAngle = 0.3 + swing * 0.9; p.bob = swing > 0.6 ? 1 : 0;
      p.lean = swing > 0.6 ? 1 : 0;
      break;
    }
    case 'search':
      p.crouch = 2; p.armR = [3, -2 + (f % 2) * 2]; p.armL = [2, -1]; p.headTilt = f % 2 ? 1 : 0.6;
      break;
    case 'point':
      p.armR = [5, -9]; p.armL = [0, 0]; p.headTilt = 0.4;
      break;
    case 'sit':
      p.crouch = 8; p.legL = [2, 2]; p.legR = [3, 2]; p.armL = [0, 2]; p.armR = [0, 2];
      p.bob = f === 1 ? -1 : 0;
      break;
    case 'sleep':
      p.lying = true; p.bob = f === 1 ? 1 : 0;
      break;
  }
  return p;
}

/* ---- bufor i cache ---- */
const CH_W = 30, CH_H = 46;
const cache = new Map<string, HTMLCanvasElement>();
const CACHE_MAX = 6000;

function cacheKey(a: ActorAction, d: Dir, f: number, look: ActorLook, hurt: number, wet: boolean): string {
  return `${look.palette.id}|${a}|${d}|${f}|${look.weapon ?? 'none'}|${look.offhand ?? 'none'}|${look.helmet ?? 'none'}` +
    `|${look.cloak ? 1 : 0}|${look.beard ? 1 : 0}|${look.bulk ?? 0}|${look.height ?? 0}|${hurt}|${wet ? 1 : 0}`;
}

export interface DrawActorOpts {
  dir: Dir; action: ActorAction; frame: number; look: ActorLook;
  /** 0..1 — stopień zranienia (krew na ubraniu) */
  hurt?: number;
  wet?: boolean;
  /** podświetlenie telegrafu ataku (czerwony obrys) — czytelne ostrzeżenie w 2D */
  telegraph?: number;
  alpha?: number;
  flipX?: boolean;
}

export function drawActor(ctx: CanvasRenderingContext2D, feetX: number, feetY: number, o: DrawActorOpts) {
  const key = cacheKey(o.action, o.dir, o.frame, o.look, Math.round((o.hurt ?? 0) * 3), !!o.wet);
  let img = cache.get(key);
  if (!img) {
    img = renderActorFrame(o.action, o.dir, o.frame, o.look, o.hurt ?? 0, !!o.wet);
    if (cache.size > CACHE_MAX) cache.clear();
    cache.set(key, img);
  }
  const w = img.width, h = img.height;
  // kotwica: środek podstawy, 4 px nad dolną krawędzią
  const dx = Math.round(feetX - w / 2), dy = Math.round(feetY - h + 7);
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

function renderActorFrame(action: ActorAction, dir: Dir, frame: number, look: ActorLook, hurt: number, wet: boolean): HTMLCanvasElement {
  const [c, x] = mk(CH_W, CH_H);
  x.save();
  x.translate(CH_W / 2, CH_H - 6);
  drawHumanoid(x, action, dir, frame, look, hurt, wet);
  x.restore();
  return outlineCanvas(c, PAL.ink0);
}

/** Rysuje postać z kotwicą w punkcie (0,0) = środek między stopami. */
function drawHumanoid(x: CanvasRenderingContext2D, action: ActorAction, dir: Dir, frame: number,
  look: ActorLook, hurt: number, wet: boolean) {
  const p = look.palette;
  const pose = computePose(action, frame, dir);
  const bulk = look.bulk ?? 0;
  const heightMod = look.height ?? 0;
  const wide = bulk * 1.5;
  const torsoH = 12 + heightMod * 2;
  const legH = 11 + heightMod * 2 - (heightMod < 0 ? 3 : 0);
  const headH = heightMod < 0 ? 8 : 10;
  const shoulderW = 11 + wide;

  const tunic = wet ? shade(p.tunic, -0.22) : p.tunic;
  const tunicDark = wet ? shade(p.tunicDark, -0.22) : p.tunicDark;
  const skin = p.skin, skinDark = p.skinDark;

  // krew na ubraniu
  const bloodC = hurt > 0.66 ? PAL.blood2 : hurt > 0.33 ? PAL.blood1 : hurt > 0 ? PAL.blood0 : null;

  if (pose.lying) {
    drawLying(x, look, pose, tunic, tunicDark, skin, bloodC, dir);
    return;
  }

  const crouch = pose.crouch;
  const hipY = -(legH) + crouch * 0.5;
  const torsoTop = hipY - torsoH + pose.bob;
  const headBottom = torsoTop - 1;
  const headTop = headBottom - headH + pose.bob;
  const lean = pose.lean;

  // --- cień wewnętrzny (podstopie) ---
  ellipsePx(x, 0, 1, 6 + wide * 0.5, 2.4, 'rgba(0,0,0,0.28)');

  // --- płaszcz (tył) ---
  if (look.cloak && p.cloak) {
    const cl = p.cloak;
    rect(x, -shoulderW / 2 - 1 + lean * 0.2, torsoTop + 1, shoulderW + 2, torsoH + 6, shade(cl, -0.15));
    rect(x, -shoulderW / 2 + lean * 0.2, torsoTop, shoulderW, torsoH + 5, cl);
    rect(x, -shoulderW / 2 + lean * 0.2, torsoTop, shoulderW, 2, shade(cl, 0.12));
  }

  // --- nogi ---
  const legW = 3 + bulk * 0.5;
  const trousers = wet ? shade(p.trousers, -0.2) : p.trousers;
  if (dir === 1 || dir === 2) {
    // profil: jedna noga z przodu, druga z tyłu
    const s = dir === 2 ? 1 : -1;
    drawLeg(x, s * pose.legR[0] * 1.2, hipY, legH - crouch, legW, trousers, p.boots, pose.legR[1]);
    drawLeg(x, s * pose.legL[0] * 1.2 - s * 1, hipY, legH - crouch, legW, shade(trousers, -0.12), shade(p.boots, -0.1), pose.legL[1]);
  } else {
    drawLeg(x, -3 - wide * 0.25 + pose.legL[0] * 0.5, hipY, legH - crouch, legW, trousers, p.boots, pose.legL[1]);
    drawLeg(x, 1 + wide * 0.25 + pose.legR[0] * 0.5, hipY, legH - crouch, legW, trousers, p.boots, pose.legR[1]);
  }

  // --- tułów ---
  const tx = -shoulderW / 2 + lean * 0.4;
  const tw = shoulderW;
  rect(x, tx, torsoTop, tw, torsoH, tunic);
  rect(x, tx, torsoTop, tw, 2, shade(tunic, 0.1));
  rect(x, tx, torsoTop + torsoH - 3, tw, 3, tunicDark);
  // boczne cieniowanie (światło z lewej-góry — spójny kierunek)
  rect(x, tx + tw - 2, torsoTop, 2, torsoH, shade(tunic, -0.18));
  // pas
  rect(x, tx, torsoTop + torsoH - 5, tw, 2, p.belt);
  px(x, -1, torsoTop + torsoH - 5, PAL.metal2); px(x, 0, torsoTop + torsoH - 5, PAL.metal3);
  // lamówka / akcent
  rect(x, tx + 1, torsoTop + 2, tw - 2, 1, p.accent);
  // kaftan/pancerz
  if (p.armor) {
    rect(x, tx + 1, torsoTop + 2, tw - 2, torsoH - 7, p.armor);
    rect(x, tx + 1, torsoTop + 2, tw - 2, 1, shade(p.armor, 0.18));
    for (let i = 0; i < 3; i++) px(x, tx + 3 + i * 3, torsoTop + 5 + i, shade(p.armor, -0.2));
  }
  if (dir === 3) { // plecy — bez lamówki z przodu
    rect(x, tx + 1, torsoTop + 2, tw - 2, torsoH - 5, shade(tunic, -0.06));
  }

  // --- ramiona i dłonie ---
  const armY = torsoTop + 2;
  const armLen = torsoH - 3;
  if (dir === 1 || dir === 2) {
    const s = dir === 2 ? 1 : -1;
    drawArm(x, s * 1 + pose.armR[0] * s, armY, armLen, tunic, skin, pose.armR[1], 2.5 + bulk * 0.4);
    drawArm(x, -s * 3 + pose.armL[0] * s * 0.5, armY, armLen - 1, shade(tunic, -0.14), skinDark, pose.armL[1], 2.5 + bulk * 0.4);
  } else {
    drawArm(x, tx - 2 + pose.armL[0], armY, armLen, dir === 3 ? shade(tunic, -0.12) : tunic, skin, pose.armL[1], 2.5 + bulk * 0.4);
    drawArm(x, tx + tw + 2 + pose.armR[0], armY, armLen, dir === 3 ? shade(tunic, -0.12) : tunic, skin, pose.armR[1], 2.5 + bulk * 0.4);
  }

  // --- głowa ---
  const hx = lean * 0.6 + pose.headTilt * 0.6;
  const hw = heightMod < 0 ? 8 : 9;
  rect(x, hx - hw / 2, headTop, hw, headH, skin);
  rect(x, hx - hw / 2, headTop + headH - 2, hw, 2, skinDark);      // szczęka/cień
  rect(x, hx - hw / 2 + hw - 2, headTop, 2, headH, shade(skin, -0.14)); // bok
  // uszy
  if (dir !== 3) { px(x, hx - hw / 2 - 1, headTop + 4, skinDark); px(x, hx + hw / 2, headTop + 4, skinDark); }
  // włosy
  const hair = p.hair;
  if (dir === 3) {
    rect(x, hx - hw / 2, headTop - 1, hw, headH - 1, hair);
    rect(x, hx - hw / 2, headTop + headH - 3, hw, 3, shade(hair, -0.15));
  } else {
    rect(x, hx - hw / 2, headTop - 1, hw, 4, hair);
    rect(x, hx - hw / 2, headTop - 1, 2, 6, hair);
    rect(x, hx + hw / 2 - 2, headTop - 1, 2, 6, hair);
    px(x, hx - hw / 2, headTop + 3, shade(hair, 0.12));
  }
  // broda
  if (look.beard && p.beard && dir !== 3) {
    rect(x, hx - hw / 2 + 1, headTop + headH - 4, hw - 2, 4, p.beard);
    rect(x, hx - hw / 2 + 1, headTop + headH - 4, hw - 2, 1, shade(p.beard, 0.12));
  }
  // twarz
  if (dir === 0 || dir === 1 || dir === 2) {
    const eyeY = headTop + 4 + (dir === 0 ? 0 : -1);
    const eo = dir === 0 ? 2 : (dir === 2 ? 2.5 : -2.5);
    if (!pose.blink && action !== 'sleep') {
      px(x, hx + eo - 2, eyeY, PAL.ink0); px(x, hx + eo + 1, eyeY, PAL.ink0);
      px(x, hx + eo - 2, eyeY - 1, PAL.clothWhite2); px(x, hx + eo + 1, eyeY - 1, PAL.clothWhite2);
      if (action === 'hit' || action === 'attack') { // brew — emocja
        px(x, hx + eo - 3, eyeY - 2, PAL.ink1); px(x, hx + eo + 2, eyeY - 2, PAL.ink1);
      }
    } else {
      rect(x, hx + eo - 2, eyeY, 1, 1, PAL.ink1); rect(x, hx + eo + 1, eyeY, 1, 1, PAL.ink1);
    }
    // nos / usta
    if (dir === 0) { px(x, hx - 1, headTop + 6, skinDark); px(x, hx, headTop + 6, skinDark);
      rect(x, hx - 2, headTop + 7, 3, 1, shade(skin, -0.3)); }
    else { px(x, hx + eo, headTop + 6, skinDark); }
  }
  // nakrycie głowy
  drawHelmet(x, hx, headTop, hw, look, p);

  // --- przedmiot w dłoni ---
  const handX = dir === 1 ? tx - 3 + pose.armR[0] : dir === 2 ? tx + tw + 3 + pose.armR[0] : tx + tw + 2 + pose.armR[0];
  const handY = armY + armLen + pose.armR[1];
  drawHeldItem(x, handX, handY, look, pose, dir, frame);
  // lewa dłoń
  const offX = dir === 2 ? tx - 3 + pose.armL[0] : tx + tw + 2 + pose.armL[0];
  drawOffhand(x, dir === 1 || dir === 2 ? tx + (dir === 2 ? -3 : 3) : tx - 3, armY + armLen + pose.armL[1], look, dir);
  void offX;

  // --- krew ---
  if (bloodC) {
    for (let i = 0; i < 6; i++) {
      const bx = tx + 1 + Math.floor(hash2(i, 7, 131) * (tw - 2));
      const by = torsoTop + 3 + Math.floor(hash2(i, 11, 137) * (torsoH - 6));
      px(x, bx, by, bloodC);
      if (hurt > 0.5) px(x, bx, by + 1, shade(bloodC, -0.2));
    }
  }
}

function drawLeg(x: CanvasRenderingContext2D, lx: number, hipY: number, len: number, w: number, trouser: string, boot: string, dy: number) {
  rect(x, lx - w / 2, hipY - 1, w, len - 3, trouser);
  rect(x, lx - w / 2, hipY + len - 5 + dy * 0.4, w, 5, boot);
  rect(x, lx - w / 2, hipY + len - 5 + dy * 0.4, w, 1, shade(boot, 0.18));
  rect(x, lx - w / 2 - (dy > 0 ? 1 : 0), hipY + len - 1 + dy * 0.3, w + 1, 2, shade(boot, -0.15));
}

function drawArm(x: CanvasRenderingContext2D, ax: number, ay: number, len: number, sleeve: string, skin: string, dy: number, w: number) {
  rect(x, ax - w / 2, ay, w, len - 3 + dy * 0.3, sleeve);
  rect(x, ax - w / 2, ay + len - 4 + dy, w, 4, skin);
  rect(x, ax - w / 2, ay, w, 1, shade(sleeve, 0.12));
}

function drawHelmet(x: CanvasRenderingContext2D, hx: number, headTop: number, hw: number, look: ActorLook, p: CharPalette) {
  const kind = look.helmet ?? 'none';
  const c = p.hat ?? PAL.clothGrey1;
  switch (kind) {
    case 'cap':
      rect(x, hx - hw / 2 - 1, headTop - 2, hw + 2, 4, c);
      rect(x, hx - hw / 2 - 1, headTop + 1, hw + 3, 2, shade(c, -0.15));
      rect(x, hx - hw / 2 - 1, headTop - 2, hw + 2, 1, shade(c, 0.18));
      break;
    case 'hood':
      rect(x, hx - hw / 2 - 2, headTop - 3, hw + 4, 9, c);
      rect(x, hx - hw / 2 - 2, headTop + 4, hw + 4, 6, shade(c, -0.1));
      rect(x, hx - hw / 2 - 1, headTop + 1, hw + 2, 5, PAL.ink1);
      break;
    case 'kettle':
      rect(x, hx - hw / 2 - 1, headTop - 1, hw + 2, 4, PAL.metal1);
      rect(x, hx - hw / 2 - 3, headTop + 2, hw + 6, 2, PAL.metal2);
      rect(x, hx - hw / 2 - 1, headTop - 1, hw + 2, 1, PAL.metal3);
      rect(x, hx - 1, headTop - 4, 2, 3, PAL.metal1);
      break;
    case 'coif':
      rect(x, hx - hw / 2 - 1, headTop - 1, hw + 2, 6, PAL.clothWhite1);
      rect(x, hx - hw / 2 - 1, headTop + 4, hw + 2, 3, PAL.clothWhite0);
      break;
    case 'straw':
      ellipsePx(x, hx, headTop + 1, hw / 2 + 4, 3, PAL.thatch1);
      ellipsePx(x, hx, headTop - 1, hw / 2 + 1, 3, PAL.thatch2);
      rect(x, hx - hw / 2 - 1, headTop - 1, hw + 2, 1, PAL.thatch0);
      break;
    case 'crown':
      rect(x, hx - hw / 2, headTop - 2, hw, 3, PAL.clothYel1);
      for (let i = 0; i < 4; i++) px(x, hx - hw / 2 + 1 + i * 2, headTop - 3, PAL.clothYel2);
      px(x, hx, headTop - 1, PAL.clothRed1);
      break;
    default:
      if (p.hat) { rect(x, hx - hw / 2 - 1, headTop - 2, hw + 2, 3, c); rect(x, hx - hw / 2 - 1, headTop - 2, hw + 2, 1, p.hatBand ?? shade(c, 0.2)); }
  }
}

function drawHeldItem(x: CanvasRenderingContext2D, hx: number, hy: number, look: ActorLook, pose: Pose, dir: Dir, frame: number) {
  const w = look.weapon ?? 'none';
  if (w === 'none' && look.offhand === 'none') return;
  const ang = pose.weaponAngle, ext = pose.weaponExt;
  const dirS = dir === 1 ? -1 : 1;
  switch (w) {
    case 'sword': {
      const len = 15;
      const tipX = hx + dirS * (2 + ext * 11), tipY = hy - 4 - ang * 14 + ext * 3;
      linePx(x, hx, hy - 2, tipX, tipY, PAL.metal2);
      linePx(x, hx + dirS * 0.6, hy - 2.6, tipX + dirS * 0.6, tipY - 0.6, PAL.metal3);
      rect(x, hx - 2, hy - 3, 5, 2, PAL.metal1);            // jelec
      rect(x, hx - 1, hy - 1, 2, 4, PAL.wood1);             // rękojeść
      px(x, hx - 1, hy + 3, PAL.clothYel1);                 // głowica
      if (ext > 0.7) { px(x, tipX, tipY, PAL.metal4); px(x, tipX + dirS, tipY - 1, PAL.metal4); }
      break;
    }
    case 'dagger': {
      const tipX = hx + dirS * (1 + ext * 7), tipY = hy - 3 - ang * 8;
      linePx(x, hx, hy - 2, tipX, tipY, PAL.metal3);
      rect(x, hx - 2, hy - 3, 4, 1, PAL.metal1); rect(x, hx - 1, hy - 2, 2, 3, PAL.wood0);
      break;
    }
    case 'axe': {
      const tipX = hx + dirS * (2 + ext * 10), tipY = hy - 6 - ang * 13;
      linePx(x, hx, hy, tipX, tipY, PAL.wood2);
      ellipsePx(x, tipX + dirS * 2, tipY, 4, 3, PAL.metal2);
      rect(x, tipX + dirS * 2, tipY - 1, 3, 3, PAL.metal3);
      break;
    }
    case 'hammer': {
      const tipX = hx + dirS * (2 + ext * 9), tipY = hy - 7 - ang * 12;
      linePx(x, hx, hy, tipX, tipY, PAL.wood1);
      rect(x, tipX - 3, tipY - 3, 7, 5, PAL.metal1); rect(x, tipX - 3, tipY - 3, 7, 1, PAL.metal3);
      break;
    }
    case 'tool': {
      const swing = Math.sin(frame * 1.1);
      const tipX = hx + dirS * 4, tipY = hy - 8 + swing * 5;
      linePx(x, hx, hy - 1, tipX, tipY, PAL.wood2);
      rect(x, tipX - 2, tipY - 3, 5, 4, PAL.metal2);
      if (swing > 0.6) { px(x, tipX + dirS * 2, tipY + 1, PAL.fire3); px(x, tipX + dirS * 3, tipY + 2, PAL.fire2); }
      break;
    }
    case 'spear': {
      const tipX = hx + dirS * (3 + ext * 12), tipY = hy - 12 - ang * 6;
      linePx(x, hx + dirS * -2, hy + 4, tipX, tipY, PAL.wood2);
      rect(x, tipX - 1, tipY - 4, 2, 5, PAL.metal3);
      break;
    }
    case 'bow': {
      ellipsePx(x, hx + dirS * 4, hy - 8, 2, 8, 'rgba(0,0,0,0)');
      for (let i = -7; i <= 7; i++) { const t = i / 7; px(x, hx + dirS * (4 + Math.round(3 * (1 - t * t))), hy - 8 + i, PAL.wood2); }
      linePx(x, hx + dirS * 4, hy - 15, hx + dirS * 4, hy - 1, PAL.clothWhite0);
      break;
    }
    case 'crossbow': {
      rect(x, hx - 1, hy - 6, dirS * 9, 2, PAL.wood1);
      rect(x, hx + dirS * 3, hy - 9, 2, 8, PAL.metal1);
      linePx(x, hx + dirS * 3, hy - 9, hx + dirS * 3, hy - 1, PAL.clothWhite1);
      break;
    }
    case 'staff': {
      linePx(x, hx, hy + 3, hx + dirS * (1 + ext * 3), hy - 16 - ang * 4, PAL.wood1);
      px(x, hx + dirS * (1 + ext * 3), hy - 17 - ang * 4, PAL.wood3);
      break;
    }
    case 'torch': {
      const tx2 = hx + dirS * 2, ty2 = hy - 8;
      linePx(x, hx, hy - 1, tx2, ty2, PAL.wood1);
      rect(x, tx2 - 2, ty2 - 4, 4, 4, PAL.fire1);
      rect(x, tx2 - 1, ty2 - 6, 3, 3, PAL.fire2);
      rect(x, tx2 - 1, ty2 - 8 + (frame % 2), 2, 3, PAL.fire3);
      break;
    }
  }
  // przedmiot niesiony (carry)
  if (look.weapon === 'none' && pose.armR[1] < -4 && pose.armL[1] < -4) {
    rect(x, -5, hy - 12, 10, 8, PAL.wood1);
    rect(x, -5, hy - 12, 10, 2, PAL.wood2);
  }
}

function drawOffhand(x: CanvasRenderingContext2D, hx: number, hy: number, look: ActorLook, dir: Dir) {
  const o = look.offhand ?? 'none';
  const s = dir === 1 ? -1 : 1;
  switch (o) {
    case 'shield':
      rect(x, hx - 4 * s - 3, hy - 12, 7, 11, PAL.wood1);
      rect(x, hx - 4 * s - 3, hy - 12, 7, 2, PAL.wood3);
      ellipsePx(x, hx - 4 * s, hy - 7, 2, 2, PAL.metal2);
      rect(x, hx - 4 * s - 3, hy - 8, 7, 1, PAL.metal1);
      break;
    case 'torch':
      linePx(x, hx, hy - 2, hx - 2 * s, hy - 12, PAL.wood1);
      rect(x, hx - 2 * s - 2, hy - 16, 4, 4, PAL.fire1); rect(x, hx - 2 * s - 1, hy - 18, 2, 3, PAL.fire3);
      break;
    case 'lantern':
      rect(x, hx - 2, hy - 8, 5, 6, PAL.metal1); rect(x, hx - 1, hy - 7, 3, 4, PAL.fire3);
      linePx(x, hx, hy - 8, hx, hy - 11, PAL.metal0);
      break;
    case 'basket':
      ellipsePx(x, hx, hy - 4, 5, 3, PAL.thatch1); rect(x, hx - 5, hy - 6, 10, 3, PAL.thatch2);
      px(x, hx - 2, hy - 7, PAL.clothRed2); px(x, hx + 2, hy - 7, PAL.grass3);
      break;
    case 'mug':
      rect(x, hx - 2, hy - 6, 4, 5, PAL.metal2); rect(x, hx - 2, hy - 7, 4, 2, PAL.clothWhite1);
      break;
    case 'hammer':
      linePx(x, hx, hy - 2, hx - 2 * s, hy - 10, PAL.wood1); rect(x, hx - 3 * s, hy - 13, 5, 4, PAL.metal1);
      break;
    case 'book':
      rect(x, hx - 3, hy - 8, 6, 5, PAL.clothRed0); rect(x, hx - 3, hy - 8, 6, 1, PAL.parch2);
      break;
  }
}

function drawLying(x: CanvasRenderingContext2D, look: ActorLook, pose: Pose, tunic: string, tunicDark: string, skin: string, blood: string | null, dir: Dir) {
  const p = look.palette;
  const s = dir === 1 ? -1 : 1;
  // ciało poziomo
  rect(x, -13, -6, 22, 7, tunic);
  rect(x, -13, -6, 22, 2, shade(tunic, 0.1));
  rect(x, 8, -5, 8, 5, p.trousers);
  rect(x, 14, -4, 4, 4, p.boots);
  rect(x, -16, -5, 5, 6, skin);                       // głowa
  rect(x, -17, -7, 7, 3, p.hair);
  rect(x, -14, -2, 4, 4, skin);                        // ręka
  if (pose.bob > 0) rect(x, -13, -7, 22, 1, shade(tunic, -0.1));
  if (blood) { ellipsePx(x, -4, 1, 9, 3, PAL.blood0); ellipsePx(x, -2, 0, 6, 2, PAL.blood1); }
  void tunicDark; void s;
}

/* ============================================================================
   PORTRETY DO DIALOGÓW — popiersie w pixel arcie, 5–6 emocji (brief 5.3)
   ========================================================================== */

export type Emotion = 'neutral' | 'happy' | 'angry' | 'sad' | 'surprised' | 'sly';
export const EMOTIONS: Emotion[] = ['neutral', 'happy', 'angry', 'sad', 'surprised', 'sly'];

const portraitCache = new Map<string, HTMLCanvasElement>();

export function getPortrait(look: ActorLook, emotion: Emotion, size = 48): HTMLCanvasElement {
  const key = `${look.palette.id}|${emotion}|${size}|${look.helmet ?? ''}|${look.beard ? 1 : 0}|${look.bulk ?? 0}`;
  const hit = portraitCache.get(key); if (hit) return hit;
  const [c, x] = mk(size, size);
  const p = look.palette;
  const s = size / 48;
  const S = (v: number) => Math.round(v * s);
  // tło
  const bg = x.createLinearGradient(0, 0, 0, size);
  bg.addColorStop(0, shade(PAL.ink2, 0.08)); bg.addColorStop(1, PAL.ink0);
  x.fillStyle = bg; x.fillRect(0, 0, size, size);
  // winieta
  for (let i = 0; i < size; i++) for (let j = 0; j < size; j++) {
    const d = Math.hypot(i - size / 2, j - size / 2) / (size * 0.7);
    if (d > 1) px(x, i, j, 'rgba(0,0,0,0.45)');
  }
  // ramiona
  rect(x, S(4), S(36), S(40), S(12), p.tunic);
  rect(x, S(4), S(36), S(40), S(3), shade(p.tunic, 0.12));
  rect(x, S(4), S(44), S(40), S(4), p.tunicDark);
  if (p.armor) { rect(x, S(10), S(38), S(28), S(10), p.armor); rect(x, S(10), S(38), S(28), S(2), shade(p.armor, 0.15)); }
  if (look.cloak && p.cloak) { rect(x, S(1), S(34), S(9), S(14), p.cloak); rect(x, S(38), S(34), S(9), S(14), shade(p.cloak, -0.15)); }
  // szyja
  rect(x, S(20), S(30), S(8), S(8), p.skinDark);
  // głowa
  const hw = look.bulk ? 22 : 20;
  rect(x, S(24 - hw / 2), S(10), S(hw), S(22), p.skin);
  rect(x, S(24 - hw / 2), S(28), S(hw), S(4), shade(p.skin, -0.12));
  rect(x, S(24 + hw / 2 - 3), S(10), S(3), S(22), shade(p.skin, -0.16));
  // włosy
  rect(x, S(24 - hw / 2 - 1), S(7), S(hw + 2), S(7), p.hair);
  rect(x, S(24 - hw / 2 - 1), S(7), S(hw + 2), S(2), shade(p.hair, 0.16));
  rect(x, S(24 - hw / 2 - 1), S(12), S(3), S(12), p.hair);
  rect(x, S(24 + hw / 2 - 2), S(12), S(3), S(10), shade(p.hair, -0.1));
  if (look.beard && p.beard) {
    rect(x, S(24 - hw / 2 + 2), S(24), S(hw - 4), S(9), p.beard);
    rect(x, S(24 - hw / 2 + 2), S(24), S(hw - 4), S(2), shade(p.beard, 0.14));
    rect(x, S(21), S(28), S(6), S(4), p.beard);
  }
  // oczy / brwi / usta zależnie od emocji
  const ex1 = S(24 - 5), ex2 = S(24 + 2), ey = S(19);
  drawFaceFeatures(x, emotion, ex1, ex2, ey, S, p);
  // nakrycie głowy
  if (look.helmet && look.helmet !== 'none') {
    const hh = p.hat ?? PAL.clothGrey1;
    switch (look.helmet) {
      case 'hood':
        rect(x, S(9), S(4), S(30), S(16), hh); rect(x, S(12), S(12), S(24), S(14), PAL.ink1);
        rect(x, S(9), S(4), S(30), S(3), shade(hh, 0.15));
        break;
      case 'kettle':
        rect(x, S(11), S(6), S(26), S(9), PAL.metal1); rect(x, S(7), S(13), S(34), S(4), PAL.metal2);
        rect(x, S(11), S(6), S(26), S(2), PAL.metal3);
        break;
      case 'crown':
        rect(x, S(12), S(4), S(24), S(6), PAL.clothYel1);
        for (let i = 0; i < 5; i++) rect(x, S(13 + i * 5), S(1), S(3), S(4), PAL.clothYel2);
        px(x, S(23), S(6), PAL.clothRed1);
        break;
      case 'coif':
        rect(x, S(11), S(6), S(26), S(14), PAL.clothWhite1); rect(x, S(11), S(6), S(26), S(3), PAL.clothWhite2);
        break;
      case 'straw':
        ellipsePx(x, S(24), S(11), S(18), S(5), PAL.thatch1); ellipsePx(x, S(24), S(8), S(11), S(5), PAL.thatch2);
        break;
      default:
        rect(x, S(11), S(5), S(26), S(8), hh); rect(x, S(11), S(5), S(26), S(2), p.hatBand ?? shade(hh, 0.2));
        rect(x, S(11), S(12), S(26), S(2), shade(hh, -0.2));
    }
  }
  // rama
  rect(x, 0, 0, size, S(1), PAL.ink1); rect(x, 0, size - S(1), size, S(1), PAL.ink1);
  rect(x, 0, 0, S(1), size, PAL.ink1); rect(x, size - S(1), 0, S(1), size, PAL.ink1);
  portraitCache.set(key, c);
  return c;
}

function drawFaceFeatures(x: CanvasRenderingContext2D, e: Emotion, ex1: number, ex2: number, ey: number,
  S: (v: number) => number, p: CharPalette) {
  const w = S(3), h = S(2);
  switch (e) {
    case 'happy':
      rect(x, ex1, ey, w, h, PAL.clothWhite2); rect(x, ex2, ey, w, h, PAL.clothWhite2);
      px(x, ex1 + S(1), ey + S(1), PAL.ink0); px(x, ex2 + S(1), ey + S(1), PAL.ink0);
      rect(x, ex1, ey - S(3), w, S(1), p.hair); rect(x, ex2, ey - S(3), w, S(1), p.hair);
      // uśmiech
      rect(x, S(20), S(26), S(8), S(1), shade(p.skin, -0.4));
      px(x, S(19), S(25), shade(p.skin, -0.4)); px(x, S(28), S(25), shade(p.skin, -0.4));
      break;
    case 'angry':
      rect(x, ex1, ey, w, h, PAL.clothWhite2); rect(x, ex2, ey, w, h, PAL.clothWhite2);
      px(x, ex1 + S(1), ey, PAL.ink0); px(x, ex2 + S(1), ey, PAL.ink0);
      linePx(x, ex1 - S(1), ey - S(4), ex1 + w, ey - S(2), PAL.ink1);
      linePx(x, ex2 + w + S(1), ey - S(4), ex2, ey - S(2), PAL.ink1);
      rect(x, S(20), S(26), S(8), S(1), shade(p.skin, -0.45));
      px(x, S(20), S(27), shade(p.skin, -0.45)); px(x, S(27), S(27), shade(p.skin, -0.45));
      break;
    case 'sad':
      rect(x, ex1, ey + S(1), w, h, PAL.clothWhite2); rect(x, ex2, ey + S(1), w, h, PAL.clothWhite2);
      px(x, ex1 + S(1), ey + S(2), PAL.ink0); px(x, ex2 + S(1), ey + S(2), PAL.ink0);
      linePx(x, ex1 - S(1), ey - S(2), ex1 + w, ey - S(3), p.hair);
      linePx(x, ex2 + w + S(1), ey - S(2), ex2, ey - S(3), p.hair);
      rect(x, S(21), S(27), S(6), S(1), shade(p.skin, -0.4));
      px(x, ex1 + S(1), ey + S(4), PAL.water3);
      break;
    case 'surprised':
      ellipsePx(x, ex1 + S(1), ey + S(1), S(2), S(2), PAL.clothWhite2);
      ellipsePx(x, ex2 + S(1), ey + S(1), S(2), S(2), PAL.clothWhite2);
      px(x, ex1 + S(1), ey + S(1), PAL.ink0); px(x, ex2 + S(1), ey + S(1), PAL.ink0);
      rect(x, ex1, ey - S(4), w, S(1), p.hair); rect(x, ex2, ey - S(4), w, S(1), p.hair);
      ellipsePx(x, S(24), S(27), S(2), S(2), shade(p.skin, -0.5));
      break;
    case 'sly':
      rect(x, ex1, ey + S(1), w, S(1), PAL.ink0); rect(x, ex2, ey + S(1), w, S(1), PAL.ink0);
      px(x, ex1 + S(2), ey + S(1), PAL.clothWhite2); px(x, ex2 + S(2), ey + S(1), PAL.clothWhite2);
      rect(x, ex1 - S(1), ey - S(2), w + S(2), S(1), p.hair);
      rect(x, ex2 - S(1), ey - S(3), w + S(2), S(1), p.hair);
      linePx(x, S(19), S(26), S(29), S(25), shade(p.skin, -0.42));
      break;
    default:
      rect(x, ex1, ey, w, h, PAL.clothWhite2); rect(x, ex2, ey, w, h, PAL.clothWhite2);
      px(x, ex1 + S(1), ey, PAL.ink0); px(x, ex2 + S(1), ey, PAL.ink0);
      rect(x, ex1, ey - S(3), w, S(1), shade(p.hair, -0.1)); rect(x, ex2, ey - S(3), w, S(1), shade(p.hair, -0.1));
      rect(x, S(20), S(26), S(8), S(1), shade(p.skin, -0.38));
  }
  // nos
  px(x, S(23), S(23), shade(p.skin, -0.2)); px(x, S(24), S(23), shade(p.skin, -0.2));
}

/* ============================================================================
   PALETY OBSADY — ten sam szkielet, inne kolory (brief, sekcja 8)
   ========================================================================== */

export const PALETTES: Record<string, CharPalette> = {
  john: {
    id: 'john', skin: PAL.skin2, skinDark: PAL.skin1, hair: PAL.ink2,
    tunic: PAL.clothGrey1, tunicDark: PAL.clothGrey0, trousers: PAL.wood1, boots: PAL.wood0,
    belt: PAL.wood0, accent: PAL.clothRed1, armor: PAL.metal1, beard: PAL.ink2
  },
  baldwin: { // herszt Dzikich Rycerzy — czerń i stal
    id: 'baldwin', skin: PAL.skin1, skinDark: PAL.skin0, hair: '#9a9a9a',
    tunic: '#2b2b33', tunicDark: '#1b1b22', trousers: '#33333c', boots: PAL.ink0,
    belt: PAL.clothYel0, accent: PAL.clothRed0, hat: PAL.metal1, armor: PAL.metal0, beard: '#8a8a8a'
  },
  hanna: { // karczmarka
    id: 'hanna', skin: PAL.skin3, skinDark: PAL.skin2, hair: PAL.clothYel0,
    tunic: PAL.clothRed1, tunicDark: PAL.clothRed0, trousers: PAL.clothWhite0, boots: PAL.wood1,
    belt: PAL.wood0, accent: PAL.clothWhite1, hat: PAL.clothWhite1
  },
  vagn: { // stary weteran
    id: 'vagn', skin: PAL.skin1, skinDark: PAL.skin0, hair: '#b8b2a4',
    tunic: PAL.clothGreen1, tunicDark: PAL.clothGreen0, trousers: PAL.wood1, boots: PAL.wood0,
    belt: PAL.wood0, accent: PAL.clothGrey1, beard: '#c8c2b4', armor: PAL.metal1
  },
  wiera: { // zielarka z bagien
    id: 'wiera', skin: PAL.skin2, skinDark: PAL.skin1, hair: '#6b4a2c',
    tunic: PAL.clothGreen1, tunicDark: PAL.leaf0, trousers: PAL.clothGreen0, boots: PAL.mud1,
    belt: PAL.thatch0, accent: PAL.thatch2, hat: PAL.clothGreen0, cloak: PAL.clothGreen0
  },
  orlik: { // kowal
    id: 'orlik', skin: PAL.skin1, skinDark: PAL.skin0, hair: PAL.ink1,
    tunic: PAL.clothGrey0, tunicDark: PAL.ink2, trousers: PAL.wood0, boots: PAL.ink1,
    belt: PAL.wood1, accent: PAL.fire0, beard: PAL.ink1
  },
  idzi: { // bosman, przemytnik
    id: 'idzi', skin: PAL.skin1, skinDark: PAL.skin0, hair: PAL.ink1,
    tunic: PAL.clothBlue1, tunicDark: PAL.clothBlue0, trousers: PAL.clothWhite0, boots: PAL.ink1,
    belt: PAL.clothRed0, accent: PAL.clothWhite1, hat: PAL.clothBlue0, beard: PAL.ink1
  },
  rawicz: { // sierżant straży
    id: 'rawicz', skin: PAL.skin2, skinDark: PAL.skin1, hair: '#4a3a2a',
    tunic: PAL.clothBlue1, tunicDark: PAL.clothBlue0, trousers: PAL.clothGrey0, boots: PAL.ink1,
    belt: PAL.clothYel0, accent: PAL.clothYel1, hat: PAL.metal1, armor: PAL.metal2
  },
  teodor: { // proboszcz
    id: 'teodor', skin: PAL.skin2, skinDark: PAL.skin1, hair: '#8a8578',
    tunic: PAL.ink2, tunicDark: PAL.ink1, trousers: PAL.ink2, boots: PAL.ink0,
    belt: PAL.clothYel0, accent: PAL.clothWhite1, hat: PAL.ink1, beard: '#a8a296'
  },
  marta: { // kieszonkowiec, 15 lat
    id: 'marta', skin: PAL.skin3, skinDark: PAL.skin2, hair: PAL.clothRed0,
    tunic: PAL.clothGreen2, tunicDark: PAL.clothGreen1, trousers: PAL.wood1, boots: PAL.wood0,
    belt: PAL.clothRed1, accent: PAL.clothYel1, hat: PAL.clothGreen1
  },
  goslaw: { // kartograf
    id: 'goslaw', skin: PAL.skin2, skinDark: PAL.skin1, hair: '#c8c2b4',
    tunic: PAL.clothYel0, tunicDark: PAL.wood1, trousers: PAL.clothGrey0, boots: PAL.wood0,
    belt: PAL.wood0, accent: PAL.parch2, hat: PAL.clothYel0, beard: '#d8d2c4'
  },
  // tło
  guard: {
    id: 'guard', skin: PAL.skin2, skinDark: PAL.skin1, hair: '#5a4a3a',
    tunic: PAL.clothBlue1, tunicDark: PAL.clothBlue0, trousers: PAL.clothGrey0, boots: PAL.ink1,
    belt: PAL.wood0, accent: PAL.clothYel1, hat: PAL.metal1, armor: PAL.metal1
  },
  bandit: {
    id: 'bandit', skin: PAL.skin1, skinDark: PAL.skin0, hair: PAL.ink1,
    tunic: PAL.clothGrey0, tunicDark: PAL.ink2, trousers: PAL.mud1, boots: PAL.ink1,
    belt: PAL.clothRed0, accent: PAL.clothRed1, hat: PAL.clothGrey0, beard: PAL.ink1
  },
  knight: {
    id: 'knight', skin: PAL.skin1, skinDark: PAL.skin0, hair: '#8a8a8a',
    tunic: '#2b2b33', tunicDark: '#1b1b22', trousers: '#33333c', boots: PAL.ink0,
    belt: PAL.clothYel0, accent: PAL.clothRed0, hat: PAL.metal1, armor: PAL.metal0, cloak: '#3a2020'
  },
  peasantM: {
    id: 'peasantM', skin: PAL.skin2, skinDark: PAL.skin1, hair: PAL.wood1,
    tunic: PAL.parch1, tunicDark: PAL.parch0, trousers: PAL.wood1, boots: PAL.mud1,
    belt: PAL.wood0, accent: PAL.clothGrey1, hat: PAL.thatch1
  },
  peasantF: {
    id: 'peasantF', skin: PAL.skin3, skinDark: PAL.skin2, hair: PAL.clothYel0,
    tunic: PAL.clothBlue2, tunicDark: PAL.clothBlue1, trousers: PAL.clothWhite0, boots: PAL.wood1,
    belt: PAL.clothRed1, accent: PAL.clothWhite1, hat: PAL.clothWhite1
  },
  merchant: {
    id: 'merchant', skin: PAL.skin2, skinDark: PAL.skin1, hair: '#4a3a2a',
    tunic: PAL.clothRed1, tunicDark: PAL.clothRed0, trousers: PAL.clothGrey0, boots: PAL.wood0,
    belt: PAL.clothYel0, accent: PAL.clothYel1, hat: PAL.clothRed0, cloak: PAL.clothRed0
  },
  monk: {
    id: 'monk', skin: PAL.skin2, skinDark: PAL.skin1, hair: '#6b5a4a',
    tunic: PAL.wood1, tunicDark: PAL.wood0, trousers: PAL.wood1, boots: PAL.wood0,
    belt: PAL.wood0, accent: PAL.clothWhite1, hat: PAL.wood0
  },
  beggar: {
    id: 'beggar', skin: PAL.skin1, skinDark: PAL.skin0, hair: '#9a9a8a',
    tunic: PAL.clothGrey0, tunicDark: PAL.ink2, trousers: PAL.mud1, boots: PAL.mud0,
    belt: PAL.mud2, accent: PAL.clothGrey1, beard: '#a8a296'
  },
  scribe: {
    id: 'scribe', skin: PAL.skin2, skinDark: PAL.skin1, hair: '#3a2a1a',
    tunic: PAL.ink2, tunicDark: PAL.ink1, trousers: PAL.clothGrey0, boots: PAL.ink1,
    belt: PAL.clothGrey0, accent: PAL.parch2, hat: PAL.clothGrey0
  },
  fisher: {
    id: 'fisher', skin: PAL.skin1, skinDark: PAL.skin0, hair: '#7a6a5a',
    tunic: PAL.clothBlue0, tunicDark: PAL.ink1, trousers: PAL.clothWhite0, boots: PAL.ink1,
    belt: PAL.wood0, accent: PAL.water3, hat: PAL.thatch1, beard: '#8a7a6a'
  },
  medic: {
    id: 'medic', skin: PAL.skin2, skinDark: PAL.skin1, hair: '#4a3a2a',
    tunic: PAL.clothWhite1, tunicDark: PAL.clothWhite0, trousers: PAL.clothGrey0, boots: PAL.wood0,
    belt: PAL.clothRed1, accent: PAL.clothRed1, hat: PAL.clothWhite2
  },
  child: {
    id: 'child', skin: PAL.skin3, skinDark: PAL.skin2, hair: PAL.clothYel1,
    tunic: PAL.clothGreen2, tunicDark: PAL.clothGreen1, trousers: PAL.wood1, boots: PAL.wood0,
    belt: PAL.wood0, accent: PAL.clothYel1
  },
  wolf: { id: 'wolf', skin: PAL.clothGrey1, skinDark: PAL.clothGrey0, hair: PAL.clothGrey0, tunic: PAL.clothGrey1, tunicDark: PAL.clothGrey0, trousers: PAL.clothGrey1, boots: PAL.ink1, belt: PAL.clothGrey0, accent: PAL.clothGrey2 }
};

export function lookOf(paletteId: string, extra: Partial<ActorLook> = {}): ActorLook {
  return { palette: PALETTES[paletteId] ?? PALETTES.peasantM, ...extra };
}

/** Prosty, spójny cień pod postacią (kierunek zgodny ze słońcem). */
export function drawActorShadow(ctx: CanvasRenderingContext2D, x: number, y: number, sunX: number, w = 12, h = 4, alpha = 0.32) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#000';
  ellipsePx(ctx, x + sunX * 3, y, w / 2, h / 2, '#000');
  ctx.restore();
}

/** Losowy wygląd przechodnia (tło też ma zawód i trasę — brief, sekcja 0.4). */
export function randomPasserbyLook(seed: number, job: string): ActorLook {
  const baseKeys = job === 'guard' ? ['guard'] : job === 'knight' ? ['knight'] : ['peasantM', 'peasantF', 'merchant', 'monk', 'beggar', 'fisher'];
  const baseId = baseKeys[Math.floor(hash2(seed, 1, 7) * baseKeys.length) % baseKeys.length];
  const base = PALETTES[baseId];
  const tint = [PAL.clothRed1, PAL.clothBlue1, PAL.clothGreen1, PAL.clothYel1, PAL.clothGrey1, PAL.parch1][Math.floor(hash2(seed, 3, 17) * 6)];
  const pal: CharPalette = {
    ...base, id: `${baseId}_${seed}_${tint}`,
    tunic: tint, tunicDark: shade(tint, -0.25),
    hair: [PAL.ink1, PAL.wood1, PAL.clothYel0, '#8a8578', PAL.clothRed0][Math.floor(hash2(seed, 5, 23) * 5)],
    accent: mix(tint, PAL.clothWhite1, 0.4)
  };
  return {
    palette: pal,
    helmet: hash2(seed, 7, 31) > 0.75 ? (['cap', 'hood', 'straw'] as const)[Math.floor(hash2(seed, 9, 37) * 3)] : 'none',
    beard: hash2(seed, 11, 41) > 0.7,
    bulk: hash2(seed, 13, 43) > 0.85 ? 1 : 0,
    weapon: 'none',
    offhand: hash2(seed, 17, 47) > 0.8 ? (['basket', 'mug'] as const)[Math.floor(hash2(seed, 19, 53) * 2)] : 'none',
    cloak: hash2(seed, 23, 59) > 0.85
  };
}

export function clearCharacterCache() { cache.clear(); portraitCache.clear(); }
