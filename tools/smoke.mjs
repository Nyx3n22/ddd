// Uruchamia zbudowany bundle ELENEM w jsdom z atrapą canvas 2D.
// Cel: wykryć błędy czasu wykonania (importy, parsowanie JSON, budowa świata,
// ticki systemów, UI, zapis/odczyt) bez przeglądarki.
import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';

const DIST = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'dist');
const html = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
const bundle = fs.readdirSync(path.join(DIST, 'assets')).find(f => f.endsWith('.js'));
const bundlePath = path.join(DIST, 'assets', bundle);

const dom = new JSDOM(html, { url: 'http://localhost:5173/', pretendToBeVisual: true, runScripts: 'outside-only' });
const { window } = dom;

// ---- atrapa kontekstu 2D -------------------------------------------------
function makeCtx(canvas) {
  const store = { w: canvas.width || 300, h: canvas.height || 150, data: null };
  const alloc = () => {
    if (!store.data || store.data.length !== store.w * store.h * 4) {
      store.data = new Uint8ClampedArray(store.w * store.h * 4);
      store.data.fill(255); store.data.fill(0, 3, undefined, 4); // przezroczyste
    }
    return store.data;
  };
  const noop = () => {};
  const ctx = {
    canvas,
    // stan
    save: noop, restore: noop, beginPath: noop, closePath: noop, clip: noop,
    translate: noop, rotate: noop, scale: noop, transform: noop, setTransform: noop, resetTransform: noop,
    // rysowanie (atrapa)
    fillRect: noop, strokeRect: noop, clearRect: noop, fill: noop, stroke: noop,
    arc: noop, arcTo: noop, circle: noop, ellipse: noop, rect: noop, roundRect: noop,
    moveTo: noop, lineTo: noop, bezierCurveTo: noop, quadraticCurveTo: noop,
    fillText: noop, strokeText: noop, drawImage: noop, putImageData: noop,
    createLinearGradient: () => ({ addColorStop: noop }),
    createRadialGradient: () => ({ addColorStop: noop }),
    createPattern: () => ({}),
    measureText: (s) => ({ width: String(s).length * 6, actualBoundingBoxAscent: 6, actualBoundingBoxDescent: 2 }),
    setLineDash: noop, getLineDash: () => [],
    // piksele — prawdziwa implementacja, bo Art.ts na nich liczy
    getImageData: (x, y, w, h) => {
      const d = alloc();
      const out = new Uint8ClampedArray(w * h * 4);
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
        const si = ((y + j) * store.w + (x + i)) * 4, di = (j * w + i) * 4;
        if (si >= 0 && si + 3 < d.length) { out[di] = d[si]; out[di+1] = d[si+1]; out[di+2] = d[si+2]; out[di+3] = d[si+3]; }
      }
      return { data: out, width: w, height: h, colorSpace: 'srgb' };
    },
    createImageData: (w, h) => (typeof w === 'number' ? { data: new Uint8ClampedArray(w * h * 4), width: w, height: h, colorSpace: 'srgb' } : { data: new Uint8ClampedArray(w.width * w.height * 4), width: w.width, height: w.height, colorSpace: 'srgb' }),
    createImageDataFrom: null,
  };
  // pola stanu jako zwykłe właściwości
  Object.assign(ctx, {
    fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, lineCap: 'butt', lineJoin: 'miter',
    globalAlpha: 1, globalCompositeOperation: 'source-over', filter: 'none',
    font: '10px monospace', textAlign: 'left', textBaseline: 'alphabetic',
    imageSmoothingEnabled: false, shadowBlur: 0, shadowColor: 'transparent',
    miterLimit: 10, lineDashOffset: 0, shadowOffsetX: 0, shadowOffsetY: 0,
    direction: 'ltr', letterSpacing: '0px', wordSpacing: '0px', fontKerning: 'auto',
  });
  // putImageData naprawdę zapisuje do bufora
  ctx.putImageData = (img, dx, dy) => {
    const d = alloc();
    for (let j = 0; j < img.height; j++) for (let i = 0; i < img.width; i++) {
      const si = (j * img.width + i) * 4, di = ((dy + j) * store.w + (dx + i)) * 4;
      if (di >= 0 && di + 3 < d.length) { d[di] = img.data[si]; d[di+1] = img.data[si+1]; d[di+2] = img.data[si+2]; d[di+3] = img.data[si+3]; }
    }
  };
  return ctx;
}
window.HTMLCanvasElement.prototype.getContext = function (type) {
  if (type !== '2d') return null;
  this.__ctx = this.__ctx || makeCtx(this);
  return this.__ctx;
};

// ---- reszta brakujących API ---------------------------------------------
window.AudioContext = class {
  constructor() { this.state = 'running'; this.currentTime = 0; this.sampleRate = 44100; this.destination = {}; }
  resume() { return Promise.resolve(); }
  createGain() { return { gain: { value: 1, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {}, setValueCurveAtTime() {} }, connect() {}, disconnect() {} }; }
  createOscillator() { return { type: 'sine', frequency: { value: 440, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {} }, detune: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, setTargetAtTime() {} }, connect() {}, disconnect() {}, start() {}, stop() {}, onended: null }; }
  createBiquadFilter() { const P = (v) => ({ value: v, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {} }); return { type: 'lowpass', frequency: P(1000), Q: P(1), gain: P(0), detune: P(0), connect() {}, disconnect() {} }; }
  createBufferSource() { return { buffer: null, loop: false, loopStart: 0, loopEnd: 0, playbackRate: { value: 1, setValueAtTime() {}, linearRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {} }, detune: { value: 0, setValueAtTime() {} }, connect() {}, disconnect() {}, start() {}, stop() {}, onended: null }; }
  createBuffer(ch, len) { return { length: len, numberOfChannels: ch, sampleRate: 44100, getChannelData: () => new Float32Array(len) }; }
  createDynamicsCompressor() { const p = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {} }); return { threshold: p(), knee: p(), ratio: p(), attack: p(), release: p(), connect() {}, disconnect() {} }; }
  createWaveShaper() { return { curve: null, oversample: 'none', connect() {}, disconnect() {} }; }
  createStereoPanner() { return { pan: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, setTargetAtTime() {} }, connect() {}, disconnect() {} }; }
  createDelay() { return { delayTime: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, setTargetAtTime() {} }, connect() {}, disconnect() {} }; }
  createConvolver() { return { buffer: null, connect() {}, disconnect() {} }; }
  createPeriodicWave() { return {}; }
  close() { return Promise.resolve(); }
};
window.webkitAudioContext = window.AudioContext;
window.matchMedia = window.matchMedia || (q => ({ matches: false, media: q, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));
window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
window.devicePixelRatio = 1;
window.innerWidth = 1400; window.innerHeight = 860;
window.navigator.vibrate = () => {};

// rAF sterowany ręcznie
let rafQueue = [];
window.requestAnimationFrame = (cb) => { rafQueue.push(cb); return rafQueue.length; };
window.cancelAnimationFrame = () => {};
let vnow = 0;
window.performance.now = () => vnow;

// ---- eksport globalny dla skryptu ---------------------------------------
const setG = (k, v) => { try { Object.defineProperty(globalThis, k, { value: v, configurable: true, writable: true }); } catch (e) { /* pomijamy */ } };
setG('window', window);
setG('document', window.document);
setG('navigator', window.navigator);
setG('localStorage', window.localStorage);
setG('HTMLElement', window.HTMLElement);
setG('HTMLCanvasElement', window.HTMLCanvasElement);
setG('Element', window.Element);
setG('Node', window.Node);
setG('Event', window.Event);
setG('CustomEvent', window.CustomEvent);
setG('KeyboardEvent', window.KeyboardEvent);
setG('MouseEvent', window.MouseEvent);
setG('getComputedStyle', window.getComputedStyle.bind(window));
setG('requestAnimationFrame', window.requestAnimationFrame);
setG('cancelAnimationFrame', window.cancelAnimationFrame);
setG('performance', window.performance);
setG('AudioContext', window.AudioContext);
setG('devicePixelRatio', 1);
setG('innerWidth', 1400);
setG('innerHeight', 860);
setG('location', window.location);
setG('self', window);
setG('ResizeObserver', window.ResizeObserver);
setG('matchMedia', window.matchMedia);
setG('MutationObserver', window.MutationObserver);
setG('DOMParser', window.DOMParser);
setG('Image', window.Image);
setG('ImageData', window.ImageData || class ImageData { constructor(d,w,h){this.data=d;this.width=w;this.height=h;} });
setG('fetch', (u) => Promise.resolve({ ok: true, status: 200, text: async () => '', json: async () => ({}), arrayBuffer: async () => new ArrayBuffer(0) }));
// wszystko, czego brakuje w globalThis względem window
for (const k of Object.getOwnPropertyNames(window)) {
  if (k in globalThis) continue;
  try { setG(k, window[k]); } catch (e) { /* pomijamy */ }
}

const errors = [];
window.addEventListener('error', e => errors.push('window.error: ' + (e.error?.stack || e.message)));
const origErr = console.error;
console.error = (...a) => { errors.push('console.error: ' + a.map(String).join(' ')); origErr(...a); };
const warns = [];
const origWarn = console.warn;
console.warn = (...a) => { warns.push(a.map(String).join(' ')); };

process.on('unhandledRejection', r => errors.push('unhandledRejection: ' + (r?.stack || r)));

// ---- uruchom bundle ------------------------------------------------------
await import(bundlePath);

async function frames(n, dtMs = 16.7) {
  for (let i = 0; i < n; i++) {
    vnow += dtMs;
    const q = rafQueue; rafQueue = [];
    for (const cb of q) cb(vnow);
    await new Promise(r => setTimeout(r, 0));
  }
}

function key(type, code, opts = {}) {
  const ev = new window.KeyboardEvent(type, { code, key: opts.key || code, bubbles: true, cancelable: true, ...opts });
  window.dispatchEvent(ev);
  window.document.dispatchEvent(ev);
}

await frames(5);
const g = window.ELENEM;
if (!g) { console.log('FATAL: window.ELENEM nie istnieje'); console.log(errors.join('\n')); process.exit(1); }

const out = [];
const doc = window.document;
const txt = (sel) => (doc.querySelector(sel)?.textContent || '').replace(/\s+/g, ' ').trim();
const isOpen = (id) => !!(doc.getElementById(id)?.classList.contains('open'));
const bodyOf = { 'ov-notes': 'notes-body', 'ov-skills': 'skills-body', 'ov-inv': 'inv-body', 'ov-journal': 'journal-body', 'ov-pause': 'pause-body', 'ov-generic': 'gen-body', 'ov-trade': 'trade-body' };
const bodyLen = (id) => (doc.getElementById(bodyOf[id] || '')?.innerHTML || '').length;
const bodyText = (id, n = 150) => (doc.getElementById(bodyOf[id] || '')?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, n);
const step = async (name, fn, fr = 2) => {
  try { const r = await fn(); out.push(`OK   ${name}${r ? ' — ' + r : ''}`); }
  catch (e) { out.push(`FAIL ${name} — ${e.message}`); errors.push(`${name}: ${e.stack}`); }
  await frames(fr);
};
const ex = (cmd) => { try { return String(g.debug.exec(cmd) ?? ''); } catch (e) { errors.push(`console "${cmd}": ${e.stack}`); return 'EXC ' + e.message; } };
const press = async (code, fr = 3) => { key('keydown', code); key('keyup', code); await frames(fr); };
const wait = async (ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) await frames(4); };
const goto = async (scene) => { ex('scene ' + scene); await wait(500); await frames(4); return g.state.scene; };
const overlayCycle = async (code, id, label) => {
  await press(code);
  const open = isOpen(id);
  const info = `${label}: open=${open} len=${bodyLen(id)} head="${txt('#' + id + ' h2')}" text="${bodyText(id, 110)}"`;
  await press(code);
  return info + ` | zamknięty=${!isOpen(id)} overlay=${g.ui.overlay} stos=${JSON.stringify(g.ui.overlayStack)}`;
};

await step('boot', () => `started=${g.started} running=${g.running} scene=${g.state?.scene} title="${txt('#title .tt')}" tagline="${txt('#title .sub')}"`);
await step('przycisk Nowa gra', () => { const b = doc.querySelector('#title-menu button[data-i="0"]'); if (!b) throw new Error('brak przycisku'); b.click(); return `menu="${txt('#title-menu')}"`; }, 6);
await step('stan po nowej grze', () => `player=(${Math.round(g.world.player.x)},${Math.round(g.world.player.y)}) tile=${g.world.player.tx},${g.world.player.ty} ground=${g.world.district.tilemap.groundAt(g.world.player.tx, g.world.player.ty)} blocked=${g.world.district.tilemap.isBlocked(g.world.player.tx, g.world.player.ty)} gold=${g.state.gold} debt=${g.state.debt.principal} npcs=${g.world.npcs.length} actors=${g.world.actors.length} enemies=${g.world.enemies.length}`, 8);
await step('HUD', () => `date="${txt('#hud-date')}" debt="${txt('#hud-debt')}" gold="${txt('#hud-gold')}" weather="${txt('#hud-weather')}" place="${txt('#hud-place')}" vitals="${[...doc.querySelectorAll('.vital .lbl')].map(l => l.textContent).join('|')}"`, 4);
await step('ruch w prawo 45 kl.', async () => { const x0 = g.world.player.x, y0 = g.world.player.y; key('keydown', 'KeyD'); await frames(45); key('keyup', 'KeyD'); await frames(2); return `dx=${Math.round(g.world.player.x - x0)} dy=${Math.round(g.world.player.y - y0)} akcja=${g.world.player.action}`; }, 1);
await step('ruch w górę + bieg + skradanie', async () => { const y0 = g.world.player.y, x0 = g.world.player.x; key('keydown', 'KeyW'); key('keydown', 'ShiftLeft'); await frames(40); key('keyup', 'ShiftLeft'); key('keyup', 'KeyW'); key('keydown', 'ControlLeft'); key('keydown', 'KeyS'); await frames(30); key('keyup', 'KeyS'); key('keyup', 'ControlLeft'); await frames(2); return `dy=${Math.round(g.world.player.y - y0)} dx=${Math.round(g.world.player.x - x0)} akcja=${g.world.player.action}`; }, 1);
await step('unik (Space)', async () => { const st0 = g.state.needs.stamina; await press('Space', 10); return `stamina ${Math.round(st0)} -> ${Math.round(g.state.needs.stamina)} dodges=${g.state.stats.dodges}`; }, 2);
await step('czas płynie', async () => { const m0 = g.state.time.minute; await frames(200); return `minute ${Math.round(m0)} -> ${Math.round(g.state.time.minute)} paused=${g.state.time.paused} dzwon=${g.state.time.lastChime}`; }, 1);
await step('bramka K bez notatnika', async () => { await press('KeyK'); return `ov-notes=${isOpen('ov-notes')} toast="${txt('#toasts')}"`; }, 2);
await step('bramka M bez mapy', async () => { await press('KeyM'); return `ov-map=${isOpen('ov-map')} toast="${txt('#toasts').slice(-90)}"`; }, 2);
await step('bramka G bez notatnika', async () => { await press('KeyG'); return `ov-skills=${isOpen('ov-skills')}`; }, 2);
await step('J bez przedmiotów (dziennik)', () => overlayCycle('KeyJ', 'ov-journal', 'dziennik'), 2);
await step('I (sakwa)', () => overlayCycle('KeyI', 'ov-inv', 'sakwa'), 2);
await step('ESC (pauza)', () => overlayCycle('Escape', 'ov-pause', 'pauza'), 2);
await step('zakładki pauzy', async () => { await press('Escape'); const tabs = [...doc.querySelectorAll('#pause-tabs button')].map(b => b.textContent); await press('Escape'); return `tabs=${JSON.stringify(tabs)}`; }, 2);
await step('konsola: notebook + map + watch', () => `${ex('notebook')} ${ex('map')} ${ex('give pocket_watch')}`, 3);
await step('K z notatnikiem', () => overlayCycle('KeyK', 'ov-notes', 'notes'), 2);
await step('zakładki notesu', async () => { await press('KeyK'); const tabs = [...doc.querySelectorAll('#notes-tabs button')].map(b => b.textContent); await press('KeyK'); return `tabs=${JSON.stringify(tabs)}`; }, 2);
await step('M z mapą', async () => { await press('KeyM'); const side = txt('#map-side').slice(0, 90); const r = `open=${isOpen('ov-map')} side="${side}" znaczniki=${g.state.maps.markers.length}`; await press('KeyM'); return r; }, 2);
await step('G (wprawa)', () => overlayCycle('KeyG', 'ov-skills', 'wprawa'), 2);
await step('T z zegarkiem', async () => { await press('KeyT'); return `toast="${txt('#toasts').slice(-70)}" subtitle="${txt('#subtitle')}"`; }, 2);
await step('Q (koło szybkiego wyboru)', async () => { await press('KeyQ'); const r = `radial=${g.ui.radialOpen} pozycje=${doc.querySelectorAll('#radial .rad-item, #radial button').length}`; await press('Escape'); return r + ` | po ESC=${g.ui.radialOpen}`; }, 2);
await step('R (pochodnia)', async () => { await press('KeyR', 4); return `torchLit=${g.state.needs.torchLit} fuel=${Math.round(g.state.needs.torchFuel)}`; }, 2);
await step('najbliższy NPC i dialog', () => {
  const list = g.world.npcs.filter(n => !n.hidden && n.scene === g.state.scene).map(n => ({ id: n.npcId, d: Math.hypot(n.x - g.world.player.x, n.y - g.world.player.y) })).sort((a, b) => a.d - b.d);
  return `najbliżsi=${JSON.stringify(list.slice(0, 4).map(x => x.id + ':' + Math.round(x.d)))} prompt="${txt('#prompt')}"`;
}, 2);
await step('E przy Hannie (wejście do karczmy)', async () => {
  const h = g.world.npcs.find(n => n.npcId === 'hanna');
  if (!h) return 'brak Hanny';
  const sc = await goto(h.scene);
  return `hanna @(${Math.round(h.x)},${Math.round(h.y)}) scene=${h.scene} -> player scene=${sc} place="${txt('#hud-place')}"`;
}, 2);
await step('dialog po podejściu', async () => {
  const h = g.world.npcs.find(n => n.npcId === 'hanna');
  ex(`tp ${Math.round(h.x + 14)} ${Math.round(h.y + 6)}`);
  await wait(200);
  await press('KeyE', 4);
  return `dialog=${doc.getElementById('dialog')?.classList.contains('open')} who="${txt('#dlg-who')}" text="${txt('#dlg-text').slice(0, 90)}" opcje=${doc.querySelectorAll('#dlg-opts button').length} czas.paused=${g.state.time.paused}`;
}, 2);
await step('opcja dialogu', async () => {
  const b = doc.querySelector('#dlg-opts button');
  if (!b) return 'brak opcji';
  const label = b.textContent.slice(0, 40);
  b.click(); await frames(3);
  return `klik="${label}" -> who="${txt('#dlg-who')}" text="${txt('#dlg-text').slice(0, 70)}" opcje=${doc.querySelectorAll('#dlg-opts button').length}`;
}, 2);
await step('zamknięcie dialogu', async () => { await press('Escape'); return `dialog=${doc.getElementById('dialog')?.classList.contains('open')} czas.paused=${g.state.time.paused}`; }, 2);
await step('handel przy szynkwasie', () => {
  ex('scene int_tavern');
  return `scene=${g.state.scene}`;
}, 8);
await step('stacja: szynkwas (E)', async () => {
  const h = g.world.npcs.find(n => n.npcId === 'hanna');
  const stn = (g.world.scene?.stations || []).find(s => s.kind === 'bar');
  if (stn) { ex(`tp ${Math.round(stn.x)} ${Math.round(stn.y + 16)}`); await wait(150); }
  await press('KeyE', 4);
  return `trade=${isOpen('ov-trade')} generic=${isOpen('ov-generic')} head="${txt('#ov-generic h2') || txt('#ov-trade h2')}" prompt="${txt('#prompt')}" text="${bodyText('ov-trade', 80) || bodyText('ov-generic', 80)}"`;
}, 2);
await step('zadanie z tablicy + dziennik', () => { ex('quest start q_vagn_respect'); ex('quest start q_coal_for_orlik'); return `quests=${g.state.quests.map(q => q.id + ':' + q.state).join(' ')}`; }, 3);
await step('dziennik z trzema zadaniami', () => overlayCycle('KeyJ', 'ov-journal', 'dziennik'), 2);
await step('walka: spawn i cios', async () => {
  await goto('world');
  ex('spawn bandit');
  const b = g.world.enemies[g.world.enemies.length - 1];
  if (!b) return 'brak wroga';
  ex(`tp ${Math.round(b.x)} ${Math.round(b.y + 22)}`);
  return `bandyta hp=${b.hp} @(${Math.round(b.x)},${Math.round(b.y)})`;
}, 6);
await step('atak LPM', async () => {
  const b = g.world.enemies[g.world.enemies.length - 1];
  const hp0 = b?.hp;
  g.input.mouse.x = 320; g.input.mouse.y = 120;
  for (let k = 0; k < 3; k++) { g.input.state.set('attack', true); g.input.just.set('attack', true); await frames(10); g.input.state.set('attack', false); g.input.just.delete('attack'); await frames(6); }
  return `hp wroga ${hp0} -> ${b?.hp} hp gracza=${Math.round(g.state.needs.health)} stamina=${Math.round(g.state.needs.stamina)} killed=${g.state.stats.killed}`;
}, 2);
await step('blok PPM', async () => { g.input.state.set('block', true); await frames(20); g.input.state.set('block', false); await frames(2); return `akcja=${g.world.player.action} stamina=${Math.round(g.state.needs.stamina)}`; }, 2);
await step('noc i deszcz', () => { ex('time 22'); ex('weather rain'); return `hour=${g.state.time.hour} darkness=${g.state.time.darkness()} weather=${g.state.weather.kind} light=${g.world.lightLevel?.()}`; }, 10);
await step('pochodnia w nocy', async () => { await press('KeyR', 4); return `torchLit=${g.state.needs.torchLit}`; }, 2);
await step('nowy dzień (advance)', async () => { const d0 = g.state.time.day; ex('advance'); await wait(200); return `day ${d0} -> ${g.state.time.day} debt=${Math.round(g.state.debtRemaining)} daysLeft=${g.state.time.daysLeft}`; }, 4);
await step('trzy dni przez konsolę', async () => { const d0 = g.state.time.day; ex('day ' + (d0 + 3)); await wait(300); return `day ${d0} -> ${g.state.time.day} hour=${g.state.time.hour} debt=${Math.round(g.state.debtRemaining)} daysLeft=${g.state.time.daysLeft} autosave=${window.localStorage.getItem('elenem.save.v2.auto') ? 'tak' : 'nie'}`; }, 4);
await step('sen do świtu', async () => { const d0 = g.state.time.day; ex('time 23'); await frames(2); g.sleepUntil?.(6, 'room'); await wait(300); return `day ${d0} -> ${g.state.time.day} hour=${g.state.time.hour} fatigue=${Math.round(g.state.needs.fatigue)} toast="${txt('#toasts').slice(-70)}"`; }, 4);
await step('hazard przy stoliku', async () => {
  const sc = await goto('int_tavern');
  const stn = (g.world.scene?.stations || []).find(s => s.kind === 'gambleTable');
  if (stn) { ex(`tp ${Math.round(stn.x)} ${Math.round(stn.y + 16)}`); await wait(150); }
  await press('KeyE', 4);
  const r = `scene=${sc} generic=${isOpen('ov-generic')} head="${txt('#gen-title')}" text="${bodyText('ov-generic', 90)}"`;
  await press('Escape');
  return r;
}, 2);
await step('zapis i odczyt', () => {
  g.state.gold = 321; ex('time 9');
  const w = ex('save 1');
  g.state.gold = 5; ex('time 20');
  const r = ex('load 1');
  return `${w}/${r} | gold=${g.state.gold} hour=${g.state.time.hour} day=${g.state.time.day} items=${g.state.inventory.items.length} quests=${g.state.quests.length} scene=${g.state.scene}`;
}, 10);
await step('zawartość zapisu', () => { const raw = window.localStorage.getItem('elenem.save.v2.1'); const j = JSON.parse(raw); const s1 = j['1']; return `sloty=${Object.keys(j).join(',')} klucze slotu=${Object.keys(s1 || {}).join(',')} bajty=${raw.length}`; }, 1);
await step('język EN', () => ex('lang en'), 8);
await step('EN: HUD i oprawa', () => `date="${txt('#hud-date')}" debt="${txt('#hud-debt')}" gold="${txt('#hud-gold')}" weather="${txt('#hud-weather')}" place="${txt('#hud-place')}" vitals="${[...doc.querySelectorAll('.vital .lbl')].map(l => l.textContent).join('|')}" title="${txt('#title .tt')}"`, 2);
await step('EN: ekwipunek', () => overlayCycle('KeyI', 'ov-inv', 'EN sakwa'), 2);
await step('EN: notes', () => overlayCycle('KeyK', 'ov-notes', 'EN notes'), 2);
await step('EN: dziennik', () => overlayCycle('KeyJ', 'ov-journal', 'EN dziennik'), 2);
await step('EN: pauza', () => overlayCycle('Escape', 'ov-pause', 'EN pauza'), 2);
await step('EN: wprawa', () => overlayCycle('KeyG', 'ov-skills', 'EN wprawa'), 2);
await step('język PL', () => ex('lang pl'), 8);
await step('statystyki', () => ex('stats').slice(0, 200), 1);
await step('zakończenie end_death', () => ex('ending end_death'), 6);
await step('ekran zakończenia', () => `generic=${isOpen('ov-generic')} head="${txt('#gen-title')}" text="${bodyText('ov-generic', 260)}" przyciski=${[...doc.querySelectorAll('#gen-body button')].map(b => b.textContent).join('|')}`, 2);
await step('podsumowanie stanu końcowego', () => `dzień=${g.state.time.day} gold=${Math.round(g.state.gold)} dług=${Math.round(g.state.debtRemaining)} reputacje=${JSON.stringify(g.state.reputation)} umiejętności=${Object.keys(g.state.skills.xp).length} wpisy=${g.state.notes.bestiary.length + g.state.notes.places.length} błędy pętli=${g.loopErrors}`, 2);

console.log('\n=== KROKI ===');
console.log(out.join('\n'));
console.log('\n=== BŁĘDY (' + errors.length + ') ===');
console.log(errors.slice(0, 20).join('\n\n'));
console.log('\n=== OSTRZEŻENIA (' + warns.length + ') ===');
console.log([...new Set(warns)].slice(0, 40).join('\n'));
fs.writeFileSync(path.join(path.dirname(new URL(import.meta.url).pathname), 'smoke-report.txt'), out.join('\n') + '\n\nERRORS(' + errors.length + ')\n' + errors.join('\n\n') + '\n\nWARNS\n' + [...new Set(warns)].join('\n'));
process.exit(errors.length ? 2 : 0);
