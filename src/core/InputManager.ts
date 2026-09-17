import { settings } from './Settings';

export type Action =
  | 'moveUp' | 'moveDown' | 'moveLeft' | 'moveRight'
  | 'dodge'          // Spacja — unik w bok / przeskok przez niską przeszkodę (2D zamiast skoku)
  | 'sneak'          // CTRL
  | 'run'            // Shift
  | 'interact'       // E — jedyne wejście do wszystkich systemów świata
  | 'grab'           // F — chwyt / ciągnięcie
  | 'attack'         // LPM
  | 'block'          // PPM — blok / parowanie
  | 'quickbelt'      // Q — koło szybkiego dostępu (tylko to, co John ma przy pasie)
  | 'torch'          // R
  | 'pause'          // ESC — jedyne niediegetyczne menu
  | 'map'            // M — zwój mapy (przedmiot!)
  | 'skills'         // G — notes: karta wprawy (przedmiot!)
  | 'notes'          // K — notes: kompendium (przedmiot!)
  | 'inventory'      // I — sakwa (zawsze)
  | 'journal'        // J — dziennik zadań i długów (przedmiot!)
  | 'clock'          // T — spojrzenie na słońce / nasłuch dzwonu
  | 'quicksave'      // F5
  | 'quickload'      // F9
  | 'console';       // `

export const ACTION_LABEL_KEY: Record<Action, string> = {
  moveUp: 'input.moveUp', moveDown: 'input.moveDown', moveLeft: 'input.moveLeft', moveRight: 'input.moveRight',
  dodge: 'input.dodge', sneak: 'input.sneak', run: 'input.run', interact: 'input.interact', grab: 'input.grab',
  attack: 'input.attack', block: 'input.block', quickbelt: 'input.quickbelt', torch: 'input.torch',
  pause: 'input.pause', map: 'input.map', skills: 'input.skills', notes: 'input.notes',
  inventory: 'input.inventory', journal: 'input.journal', clock: 'input.clock',
  quicksave: 'input.quicksave', quickload: 'input.quickload', console: 'input.console'
};

const DEFAULT_BINDS: Record<Action, string[]> = {
  moveUp: ['KeyW', 'ArrowUp'], moveDown: ['KeyS', 'ArrowDown'],
  moveLeft: ['KeyA', 'ArrowLeft'], moveRight: ['KeyD', 'ArrowRight'],
  dodge: ['Space'], sneak: ['ControlLeft', 'ControlRight', 'KeyC'], run: ['ShiftLeft', 'ShiftRight'],
  interact: ['KeyE'], grab: ['KeyF'], attack: ['Mouse0'], block: ['Mouse2'],
  quickbelt: ['KeyQ'], torch: ['KeyR'], pause: ['Escape'], map: ['KeyM'], skills: ['KeyG'],
  notes: ['KeyK'], inventory: ['KeyI'], journal: ['KeyJ'], clock: ['KeyT'],
  quicksave: ['F5'], quickload: ['F9'], console: ['Backquote']
};

const KEY = 'elenem.binds.v2';
const GAMEPAD_MAP: Array<[number, Action]> = [
  [0, 'dodge'], [2, 'interact'], [3, 'notes'], [5, 'run'], [4, 'sneak'],
  [7, 'attack'], [6, 'block'], [9, 'pause'], [8, 'quickbelt'], [1, 'grab']
];

export class InputManager {
  private binds: Record<Action, string[]> = JSON.parse(JSON.stringify(DEFAULT_BINDS));
  private codeToAction = new Map<string, Action>();
  private state = new Map<Action, boolean>();
  private just = new Map<Action, boolean>();
  private toggles = new Map<Action, boolean>();
  private axis = { x: 0, y: 0 };
  private mouse = { x: 0, y: 0, down: false, wheel: 0, dx: 0, dy: 0 };
  /** przechwytywanie klawisza do remappingu */
  private remapTarget: Action | null = null;
  private remapCb: ((code: string | null) => void) | null = null;
  typing = false;
  enabled = true;
  /** surowe kody klawiszy wciśnięte w tej klatce (np. cyfry 1-9 w dialogach) */
  private justCodes = new Set<string>();

  constructor() {
    this.load();
    this.rebuild();
    window.addEventListener('keydown', (e) => this.onKey(e, true));
    window.addEventListener('keyup', (e) => this.onKey(e, false));
    window.addEventListener('blur', () => this.clearAll());
    window.addEventListener('mousemove', (e) => {
      this.mouse.dx += e.movementX || 0; this.mouse.dy += e.movementY || 0;
      this.mouse.x = e.clientX; this.mouse.y = e.clientY;
    });
    window.addEventListener('wheel', (e) => { this.mouse.wheel += Math.sign(e.deltaY); }, { passive: true });
    window.addEventListener('contextmenu', (e) => e.preventDefault());
    const md = (e: MouseEvent) => this.onMouse(e, true);
    const mu = (e: MouseEvent) => this.onMouse(e, false);
    window.addEventListener('mousedown', md); window.addEventListener('mouseup', mu);
    window.addEventListener('focus', () => {
      const ae = document.activeElement;
      this.typing = !!ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || (ae as HTMLElement).isContentEditable);
    });
  }

  private onKey(e: KeyboardEvent, down: boolean) {
    const ae = document.activeElement;
    this.typing = !!ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || (ae as HTMLElement).isContentEditable);
    if (this.remapTarget && down) {
      e.preventDefault();
      const code = e.code === 'Escape' ? null : e.code;
      const cb = this.remapCb; this.remapTarget = null; this.remapCb = null; cb?.(code);
      return;
    }
    if (down && !this.typing) this.justCodes.add(e.code);
    if (this.typing) return;
    const act = this.codeToAction.get(e.code);
    if (!act) return;
    if (['Space', 'Tab', 'F5', 'F9', 'Backquote'].includes(e.code)) e.preventDefault();
    if (act === 'sneak' || act === 'run') {
      const mode = act === 'sneak' ? settings.data.sneakMode : settings.data.runMode;
      if (mode === 'toggle') { if (down && !this.state.get(act)) this.toggles.set(act, !this.toggles.get(act)); }
      else this.state.set(act, down);
      if (down && !this.just.get(act)) this.just.set(act, true);
      return;
    }
    if (down) { if (!this.state.get(act)) this.just.set(act, true); this.state.set(act, true); }
    else this.state.set(act, false);
  }

  private onMouse(e: MouseEvent, down: boolean) {
    const act = this.codeToAction.get('Mouse' + e.button);
    this.mouse.down = down;
    if (!act || !this.enabled) return;
    if (down) { if (!this.state.get(act)) this.just.set(act, true); this.state.set(act, true); }
    else this.state.set(act, false);
  }

  private rebuild() {
    this.codeToAction.clear();
    for (const a in this.binds) for (const code of this.binds[a as Action]) this.codeToAction.set(code, a as Action);
  }

  clearAll() { this.state.clear(); this.just.clear(); this.justCodes.clear(); this.toggles.clear(); this.axis.x = this.axis.y = 0; }
  /** Wywołane na końcu każdej klatki. */
  endFrame() { this.just.clear(); this.justCodes.clear(); this.mouse.wheel = 0; this.mouse.dx = 0; this.mouse.dy = 0; }

  /** Czy dany surowy kod klawisza został wciśnięty w tej klatce. */
  pressedCode(code: string): boolean { return this.justCodes.has(code); }

  pollGamepad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const p = pads && pads[0];
    if (!p) return;
    const dz = 0.28;
    let gx = Math.abs(p.axes[0]) > dz ? p.axes[0] : 0;
    let gy = Math.abs(p.axes[1]) > dz ? p.axes[1] : 0;
    for (const [idx, act] of GAMEPAD_MAP) {
      const b = p.buttons[idx]; if (!b) continue;
      const pressed = b.pressed || b.value > 0.5;
      if (pressed && !this.state.get(act)) this.just.set(act, true);
      this.state.set(act, pressed);
      if (act === 'run' && pressed) gx *= 1; // bieg z gałki przez trigger
    }
    if (gx || gy) { this.axis.x = gx; this.axis.y = gy; this.gamepadAxis = true; }
    else this.gamepadAxis = false;
  }
  private gamepadAxis = false;

  down(a: Action): boolean {
    if (!this.enabled) return false;
    return !!this.state.get(a) || !!this.toggles.get(a);
  }
  pressed(a: Action): boolean { return !!this.just.get(a); }
  released(a: Action): boolean { return !this.state.get(a) && !this.toggles.get(a); }

  /** Oś ruchu: klawiatura (8 kierunków) lub pad. */
  moveAxis(): { x: number; y: number } {
    if (this.gamepadAxis && (this.axis.x || this.axis.y)) return { x: this.axis.x, y: this.axis.y };
    let x = 0, y = 0;
    if (this.down('moveLeft')) x -= 1; if (this.down('moveRight')) x += 1;
    if (this.down('moveUp')) y -= 1; if (this.down('moveDown')) y += 1;
    if (x && y) { const l = Math.SQRT1_2; x *= l; y *= l; }
    return { x, y };
  }

  mousePos() { return { x: this.mouse.x, y: this.mouse.y }; }
  mouseWheel() { return this.mouse.wheel; }
  mouseDelta() { return { dx: this.mouse.dx, dy: this.mouse.dy }; }

  setToggle(a: Action, v: boolean) { this.toggles.set(a, v); }
  getToggle(a: Action) { return !!this.toggles.get(a); }

  startRemap(a: Action, cb: (code: string | null) => void) { this.remapTarget = a; this.remapCb = cb; }
  get isRemapping() { return this.remapTarget !== null; }

  bind(a: Action, codes: string[]) { this.binds[a] = codes; this.rebuild(); this.save(); }
  getBinds(): Record<Action, string[]> { return JSON.parse(JSON.stringify(this.binds)); }
  resetBinds() { this.binds = JSON.parse(JSON.stringify(DEFAULT_BINDS)); this.rebuild(); this.save(); }
  keyLabel(a: Action): string {
    const c = this.binds[a]?.[0];
    if (!c) return '—';
    return prettyCode(c);
  }

  private load() {
    try { const raw = localStorage.getItem(KEY); if (raw) this.binds = { ...DEFAULT_BINDS, ...JSON.parse(raw) }; }
    catch { /* ignore */ }
  }
  private save() { try { localStorage.setItem(KEY, JSON.stringify(this.binds)); } catch { /* ignore */ } }
}

export function prettyCode(code: string): string {
  if (code.startsWith('Mouse')) return { Mouse0: 'LPM', Mouse1: 'ŚPM', Mouse2: 'PPM' }[code] ?? code;
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Arrow')) return { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→' }[code] ?? code;
  return {
    ControlLeft: 'L-CTRL', ControlRight: 'P-CTRL', ShiftLeft: 'L-SHIFT', ShiftRight: 'P-SHIFT',
    Space: 'SPACJA', Escape: 'ESC', Backquote: '`', Enter: 'ENTER', Tab: 'TAB'
  }[code] ?? code.toUpperCase();
}
