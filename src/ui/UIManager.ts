import type { Game } from '../core/Game';
import { bus } from '../core/EventBus';
import { settings } from '../core/Settings';
import { t, getLang, setLang } from '../core/Localization';
import { SaveSystem } from '../core/SaveSystem';
import { rng } from '../core/RNG';
import type { InputManager } from '../core/InputManager';
import { ACTION_LABEL_KEY } from '../core/InputManager';
import { getIcon } from '../render/Icons';
import { getPortrait, type Emotion } from '../render/Characters';
import { PAL, rgba } from '../render/Palette';
import { TILE } from '../world/TileMap';
import { InventorySystem, itemDef, itemName, allItemDefs } from '../systems/InventorySystem';
import { SkillsSystem, allSkills, allPerks, allBranches, skillDef, perkDef } from '../systems/SkillsSystem';
import { ReputationSystem, npcDef, npcName } from '../systems/ReputationSystem';
import { QuestSystem, questDef } from '../systems/QuestSystem';
import { NotesSystem, allEntries, johnNotes } from '../systems/NotesSystem';
import { DialogueSystem } from '../systems/DialogueSystem';
import { EconomySystem, merchantDef, allMerchants } from '../systems/EconomySystem';
import { CraftingSystem, recipesFor, stationDef } from '../systems/CraftingSystem';
import { GamblingSystem } from '../systems/GamblingSystem';
import { CrimeSystem } from '../systems/CrimeSystem';
import { DebtSystem } from '../systems/DebtSystem';
import { WeatherSystem } from '../systems/WeatherSystem';
import { RumorSystem } from '../systems/RumorSystem';
import type { FactionId } from '../core/GameState';

/* ============================================================================
   INTERFEJS
   Każde menu ma fizyczny odpowiednik w świecie (brief 0):
   K — notatnik, G — karta wprawy w notatniku, M — zwój mapy, J — dziennik
   zobowiązań, I — sakwa (zawsze przy pasie), Q — koło pasa, ESC — pauza.
   Handel, rzemiosło, hazard, leczenie, nauka — wyłącznie przez E przy obiekcie.
   ========================================================================== */

const FACTIONS: FactionId[] = ['wildKnights', 'cityGuard', 'merchantGuild', 'church', 'smugglers', 'villagers'];
const $ = (id: string) => document.getElementById(id);
const esc = (s: string) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

export class UIManager {
  game: Game;
  paused = false;
  overlay: string | null = null;
  overlayStack: string[] = [];
  toasts: Array<{ el: HTMLElement; until: number }> = [];
  radialOpen = false;
  radialSel = 0;
  radialItems: string[] = [];
  private hudCache: Record<string, string> = {};
  private clockShown = 0;
  private tradeMerchant: string | null = null;
  private tradeNpc: string | null = null;
  private craftStation: string | null = null;
  private chestKey: string | null = null;
  private notesTab = 0;
  private pauseTab = 0;
  private mapScale = 1;
  private subtitleUntil = 0;
  private titleSel = 0;
  private titleItems: Array<{ label: string; act: () => void }> = [];
  private signUntil = 0;
  private confirmCb: (() => void) | null = null;
  private gambleStake = 10;

  constructor(game: Game) { this.game = game; }

  init() {
    this.localizeStatic();
    this.buildTitle();
    this.updateBelt();
    window.addEventListener('resize', () => this.drawClockDial());
  }

  /**
   * Statyczna oprawa w index.html też pochodzi z plików tłumaczeń (brief 8):
   * tytuły nakładek, przyciski zamknięcia, etykiety paska potrzeb, ekran
   * tytułowy i podpowiedź konsoli. Bez tego po przełączeniu na EN połowa
   * ramek zostawałaby po polsku.
   */
  localizeStatic() {
    document.title = t('ui.docTitle');
    const setTxt = (id: string, key: string) => { const el = $(id); if (el) el.textContent = t(key); };
    setTxt('notes-title', 'ui.title.notes');
    setTxt('skills-title', 'ui.title.skills');
    setTxt('map-title', 'ui.title.map');
    setTxt('inv-title', 'ui.title.inv');
    setTxt('journal-title', 'ui.title.journal');
    setTxt('trade-title', 'ui.title.trade');
    setTxt('pause-title', 'ui.title.pause');

    const closeKeys: Record<string, string> = {
      'ov-notes': 'ui.close', 'ov-skills': 'ui.close', 'ov-map': 'ui.close',
      'ov-inv': 'ui.close', 'ov-journal': 'ui.close', 'ov-trade': 'ui.leaveStall',
      'ov-generic': 'ui.leave', 'ov-pause': 'ui.resume'
    };
    for (const [ov, key] of Object.entries(closeKeys)) {
      const b = document.querySelector(`#${ov} .close-x`) as HTMLElement | null;
      if (!b) continue;
      const k = b.querySelector('.key');
      b.textContent = t(key);
      if (k) { b.appendChild(document.createTextNode(' ')); b.appendChild(k); }
      b.onclick = () => this.closeOverlay(ov);
    }

    document.querySelectorAll('.vital').forEach(v => {
      const key = 'vital.' + (v as HTMLElement).dataset.v;
      const lbl = v.querySelector('.lbl');
      if (lbl) lbl.textContent = t(key);
    });

    const logo = document.querySelector('#title .tt'); if (logo) logo.textContent = t('ui.title.logo');
    const tag = document.querySelector('#title .sub'); if (tag) tag.textContent = t('ui.title.tagline');
    const conIn = $('con-input') as HTMLInputElement | null;
    if (conIn) conIn.placeholder = t('ui.console.placeholder');
  }

  /* ================= HUD ================= */

  updateHud(dt: number) {
    const s = this.game.state;
    const set = (id: string, html: string) => {
      if (this.hudCache[id] === html) return;
      this.hudCache[id] = html;
      const el = $(id); if (el) el.innerHTML = html;
    };
    set('hud-date', `<b>${esc(t('hud.day', { day: s.time.day }))}</b> · ${esc(t('phase.' + s.time.phase()))}`);
    set('hud-debt', `${esc(t('hud.debt'))}: <b>${Math.round(s.debtRemaining).toLocaleString(getLang() === 'pl' ? 'pl-PL' : 'en-US')}</b> ${esc(t('hud.crowns'))} · <span id="hud-days">${s.time.daysLeft}</span> ${esc(t('hud.days'))}`);
    const debtEl = $('hud-debt');
    if (debtEl) debtEl.classList.toggle('urgent', s.time.daysLeft <= 5 || s.debtOverdue);
    set('hud-gold', `${esc(t('hud.purse'))}: <b>${s.gold}</b> ${esc(t('hud.crowns'))}`);
    set('hud-weather', `${esc(t('hud.weather'))}: ${esc(t('weather.' + s.weather.kind))} · ${Math.round(WeatherSystem.tempC())}°`);
    set('hud-place', esc(t(this.game.world?.scene?.nameKey || 'place.harbour')));
    // witamina i zdrowie
    const vit: Array<[string, number, number]> = [
      ['hp', s.needs.health, s.needs.maxHealth], ['st', s.needs.stamina, s.needs.maxStamina],
      ['hu', s.needs.hunger, 100], ['th', s.needs.thirst, 100], ['fa', 100 - s.needs.fatigue, 100], ['hy', s.needs.hygiene, 100]
    ];
    for (const [k, v, max] of vit) {
      const row = document.querySelector(`.vital[data-v="${k}"]`);
      if (!row) continue;
      const fill = row.querySelector('.fill') as HTMLElement;
      const track = row.querySelector('.track') as HTMLElement;
      const pct = Math.max(0, Math.min(100, (v / max) * 100));
      if (fill) fill.style.width = pct + '%';
      if (track) track.classList.toggle('low', pct < 25);
      const lbl = row.querySelector('.lbl');
      if (lbl) lbl.textContent = t('vital.' + k);
    }
    // podpowiedź interakcji
    const p = this.game.world.player;
    const prompt = $('prompt');
    if (prompt) {
      if (p.interactTarget) {
        prompt.style.display = 'block';
        const key = this.game.input.keyLabel('interact');
        prompt.innerHTML = `<b>[${esc(key)}]</b> ${esc(p.interactTarget.prompt)}${p.carryTarget ? `<div class="sub">[${esc(this.game.input.keyLabel('grab'))}] ${esc(t('prompt.carry', { what: t(p.carryTarget.nameKey) }))}</div>` : ''}`;
      } else prompt.style.display = 'none';
    }
    // zegar
    if (this.clockShown > 0) { this.clockShown -= dt; this.drawClockDial(); }
    // napisy
    if (this.subtitleUntil > 0 && performance.now() > this.subtitleUntil) { const el = $('subtitle'); if (el) el.style.display = 'none'; this.subtitleUntil = 0; }
    if (this.signUntil > 0 && performance.now() > this.signUntil) this.closeGeneric();
  }

  tick(dt: number) {
    // usuwanie toastów
    const now = performance.now();
    for (let i = this.toasts.length - 1; i >= 0; i--) {
      if (now > this.toasts[i].until) { this.toasts[i].el.remove(); this.toasts.splice(i, 1); }
    }
    if (this.radialOpen) this.drawRadial();
    this.updateHud(dt);
  }

  toast(text: string, tone: 'good' | 'bad' | 'warn' | 'neutral' = 'neutral') {
    const box = $('toasts'); if (!box || !text) return;
    const el = document.createElement('div');
    el.className = 'toast ' + (tone === 'neutral' ? '' : tone);
    el.textContent = text;
    box.appendChild(el);
    this.toasts.push({ el, until: performance.now() + 4200 });
    while (this.toasts.length > 5) { const old = this.toasts.shift()!; old.el.remove(); }
  }

  subtitle(text: string, ms = 3200) {
    const el = $('subtitle'); if (!el) return;
    el.textContent = text;
    el.className = settings.data.subtitleBg ? 'bg' : '';
    el.style.display = 'block';
    el.style.fontSize = (0.9 * settings.data.subtitleSize) + 'em';
    this.subtitleUntil = performance.now() + ms;
  }

  fade(dir: 1 | -1) {
    const el = $('fade'); if (!el) return;
    el.style.opacity = dir > 0 ? '1' : '0';
  }

  showClockDial(on: boolean) {
    this.clockShown = on ? 4 : 0;
    const el = $('clock-dial'); if (el) el.style.opacity = on ? '1' : '0.35';
    this.drawClockDial();
  }

  drawClockDial() {
    const c = $('clock-dial') as HTMLCanvasElement | null;
    if (!c) return;
    const x = c.getContext('2d')!;
    const s = this.game.state;
    x.clearRect(0, 0, c.width, c.height);
    const cx = c.width / 2, cy = c.height / 2, r = c.width / 2 - 3;
    x.fillStyle = '#1a1410'; x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill();
    x.strokeStyle = '#6a5334'; x.lineWidth = 2; x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.stroke();
    // tarcza doby
    const ang = (s.time.minute / 1440) * Math.PI * 2 - Math.PI / 2;
    x.strokeStyle = '#d8b25c'; x.lineWidth = 2;
    x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx + Math.cos(ang) * (r - 4), cy + Math.sin(ang) * (r - 4)); x.stroke();
    // wskazówka dni
    const dang = (s.time.day / 30) * Math.PI * 2 - Math.PI / 2;
    x.strokeStyle = '#8e3527'; x.lineWidth = 2;
    x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx + Math.cos(dang) * (r - 9), cy + Math.sin(dang) * (r - 9)); x.stroke();
    x.fillStyle = '#e6dcc6'; x.font = '9px Georgia'; x.textAlign = 'center';
    x.fillText(String(s.time.knownHour).padStart(2, '0'), cx, cy + r - 6);
  }

  updateBelt() {
    const box = $('hud-belt'); if (!box) return;
    const s = this.game.state;
    const belt = s.inventory.items.filter(i => itemDef(i.id)?.tags.includes('belt')).slice(0, 8);
    box.innerHTML = '';
    for (let i = 0; i < Math.max(4, belt.length); i++) {
      const st = belt[i];
      const slot = document.createElement('div');
      slot.className = 'belt-slot clickable';
      const d = st ? itemDef(st.id) : undefined;
      slot.innerHTML = `<span class="k">${i + 1}</span>${d ? `<span title="${esc(t(d.nameKey))}"></span><span class="q">${st.qty > 1 ? st.qty : ''}</span>` : ''}`;
      if (d) {
        const icon = getIcon(d.icon, 24);
        const holder = slot.querySelector('span[title]')!;
        holder.appendChild(icon);
        holder.setAttribute('title', t(d.nameKey));
      }
      slot.onclick = () => { if (st) InventorySystem.use(st.id); };
      box.appendChild(slot);
    }
  }

  /* ================= DIALOG ================= */

  openDialogue(e: { npcId: string; session: any }) {
    const el = $('dialog'); if (!el) return;
    el.classList.add('open');
    this.updateDialogue(e.session);
  }

  updateDialogue(session: any) {
    const s = this.game.state;
    const def = npcDef(session.npcId);
    const who = $('dlg-who'); const txt = $('dlg-text'); const opts = $('dlg-opts');
    const face = $('dlg-face') as HTMLCanvasElement;
    if (who) who.innerHTML = `${esc(session.npcId.startsWith('passerby') ? (this.game.world.npcs.find(n => n.id === session.npcId)?.name || t('npc.stranger')) : npcName(session.npcId))} <span class="role">${esc(def ? t(def.roleKey) : t('npc.passerby'))}${def ? ' · ' + esc(t('npc.age', { age: def.age })) : ''}</span>`;
    if (txt) txt.textContent = session.node.text;
    if (face && def) {
      const g = face.getContext('2d')!;
      g.clearRect(0, 0, face.width, face.height);
      g.imageSmoothingEnabled = false;
      const portrait = getPortrait(this.game.world.npcs.find(n => n.npcId === session.npcId)?.look || (def.look as any), (session.node.emotion || 'neutral') as Emotion, 48);
      g.drawImage(portrait, 0, 0);
    }
    if (!opts) return;
    opts.innerHTML = '';
    const visible = DialogueSystem.visibleOptions();
    visible.forEach((o, i) => {
      const b = document.createElement('button');
      b.className = 'opt clickable' + (o.ok ? '' : ' locked');
      b.innerHTML = `<b>${i + 1}.</b> ${esc(o.text)}${o.ok ? '' : ` <span class="req">(${esc(o.reason || '')})</span>`}`;
      b.onclick = () => { if (o.ok) DialogueSystem.choose(o.index); else this.toast(o.reason || t('dialogue.cant'), 'bad'); };
      opts.appendChild(b);
    });
    this.subtitle(session.node.text, 6000);
    bus.emit('ui:page', {});
  }

  closeDialogue() {
    const el = $('dialog'); if (el) el.classList.remove('open');
    const sub = $('subtitle'); if (sub) sub.style.display = 'none';
    this.game.state.time.paused = false;
  }

  dialogInput(i: InputManager) {
    if (i.pressed('pause') || i.pressed('interact')) { DialogueSystem.close(); return; }
    const keys = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9'];
    for (let k = 0; k < keys.length; k++) {
      if (i.pressedCode(keys[k])) {
        const opts = DialogueSystem.visibleOptions();
        if (opts[k]) {
          if (opts[k].ok) DialogueSystem.choose(opts[k].index);
          else this.toast(opts[k].reason || t('dialogue.cant'), 'bad');
        }
        return;
      }
    }
  }

  /* ================= NAKŁADKI ================= */

  anyOverlayOpen() { return !!this.overlay || this.radialOpen; }

  openOverlay(id: string) {
    const el = $(id); if (!el) return;
    this.overlayStack.push(id);
    this.overlay = id;
    el.classList.add('open');
    this.game.state.time.paused = true;
    bus.emit('ui:page', {});
  }

  closeOverlay(id?: string) {
    const target = id || this.overlayStack[this.overlayStack.length - 1];
    if (!target) return;
    // zamknięcie konkretnej nakładki musi zdjąć ją ze stosu, inaczej
    // `anyOverlayOpen()` zostaje prawdziwe i klawisze przestają działać
    const at = this.overlayStack.lastIndexOf(target);
    if (at >= 0) this.overlayStack.splice(at, 1);
    const el = $(target); if (el) el.classList.remove('open');
    if (this.overlayStack.length === 0) {
      this.overlay = null;
      // zamknięcie pauzy z klawisza musi też zdjąć blokadę wejścia
      if (target === 'ov-pause') this.paused = false;
      if (!DialogueSystem.session && !this.paused && this.game.started) this.game.state.time.paused = false;
    } else this.overlay = this.overlayStack[this.overlayStack.length - 1];
  }

  closeAll() {
    while (this.overlayStack.length) this.closeOverlay();
    this.overlay = null;
  }

  overlayInput(i: InputManager) {
    if (i.pressed('pause')) { this.closeOverlay(); return; }
    if (this.overlay === 'ov-generic' && this.confirmCb) {
      if (i.pressedCode('Digit1') || i.pressed('interact') || i.pressedCode('Enter')) { const cb = this.confirmCb; this.confirmCb = null; this.closeOverlay(); cb(); return; }
      if (i.pressedCode('Digit2') || i.pressedCode('Escape')) { this.confirmCb = null; this.closeOverlay(); return; }
    }
    const map: Record<string, string> = { 'ov-notes': 'notes', 'ov-skills': 'skills', 'ov-map': 'map', 'ov-inv': 'inventory', 'ov-journal': 'journal' };
    for (const [ov, action] of Object.entries(map)) if (i.pressed(action as any) && this.overlay === ov) { this.closeOverlay(ov); return; }
    if (this.overlay === 'ov-map') {
      const w = i.mouseWheel();
      if (w) { this.mapScale = Math.max(0.6, Math.min(3, this.mapScale * (w > 0 ? 1.1 : 0.9))); this.drawMap(); }
    }
    if (i.pressed('interact')) { this.closeOverlay(); return; }
  }

  /* ---- notatnik (K) ---- */
  openNotes() {
    const s = this.game.state;
    if (!NotesSystem.hasNotebook()) { this.toast(t('diegetic.noNotebook'), 'bad'); return; }
    this.openOverlay('ov-notes');
    const tabs = $('notes-tabs');
    const list = ['notes.tab.bestiary', 'notes.tab.items', 'notes.tab.places', 'notes.tab.john', 'notes.tab.custom'];
    if (tabs) {
      tabs.innerHTML = list.map((k, i) => `<button class="tab clickable ${i === this.notesTab ? 'on' : ''}" data-i="${i}">${esc(t(k))}</button>`).join('');
      tabs.querySelectorAll('button').forEach(b => b.onclick = () => { this.notesTab = Number((b as HTMLElement).dataset.i); this.openNotes(); });
    }
    const body = $('notes-body'); if (!body) return;
    const wet = s.notes.wet > 0.2 ? `<div class="card" style="border-color:#8e3527">${esc(t('notes.wet', { pct: Math.round(s.notes.wet * 100) }))}</div>` : '';
    let html = wet;
    if (this.notesTab === 0) {
      const found = s.notes.bestiary;
      html += `<div class="grid g2">` + (found.length ? found.map(id => this.entryCard(id)).join('') : `<div class="card"><div class="mut">${esc(t('notes.empty.bestiary'))}</div></div>`) + `</div>`;
      html += `<p class="mut" style="margin-top:.6em">${esc(t('notes.hint.bestiary'))}</p>`;
    } else if (this.notesTab === 1) {
      const items = NotesSystem.itemNotes();
      html += `<div class="grid g2">` + (items.length ? items.map(it => `<div class="card"><h4>${esc(it.name)}</h4><div class="mut">${esc(it.desc)}</div></div>`).join('') : `<div class="card"><div class="mut">${esc(t('notes.empty.items'))}</div></div>`) + `</div>`;
    } else if (this.notesTab === 2) {
      html += `<div class="grid g2">` + (s.notes.places.length ? s.notes.places.map(id => this.entryCard(id)).join('') : `<div class="card"><div class="mut">${esc(t('notes.empty.places'))}</div></div>`) + `</div>`;
    } else if (this.notesTab === 3) {
      const john = johnNotes();
      html += s.notes.johnNotes.map(id => {
        const n = john.find((x: any) => x.id === id);
        const day = n?.dayKey ? t(n.dayKey) : t('journal.day', { day: 1 });
        const txt = n?.textKey ? t(n.textKey) : id;
        return `<div class="card"><h4>${esc(day)}</h4><div>${esc(txt)}</div></div>`;
      }).join('') || `<div class="card"><div class="mut">${esc(t('notes.empty.john'))}</div></div>`;
    } else {
      html += `<div style="display:flex;gap:6px;margin-bottom:.6em"><input id="note-input" class="clickable" style="flex:1;background:#1a1410;border:2px solid #4a3a24;color:var(--text);padding:.4em;font-family:inherit" placeholder="${esc(t('notes.placeholder'))}"><button id="note-write" class="clickable">${esc(t('notes.write'))}</button></div>`;
      if (!NotesSystem.hasQuill()) html += `<div class="card" style="border-color:#8e3527">${esc(t('notes.noQuill'))}</div>`;
      html += s.notes.customNotes.map(n => `<div class="card">${esc(n)}</div>`).join('') || `<div class="card"><div class="mut">${esc(t('notes.empty.custom'))}</div></div>`;
      setTimeout(() => {
        const inp = $('note-input') as HTMLInputElement;
        const btn = $('note-write');
        if (btn) btn.onclick = () => { if (inp?.value && NotesSystem.writeCustom(inp.value)) { inp.value = ''; this.openNotes(); } };
        if (inp) inp.onkeydown = (e) => {
          e.stopPropagation();
          if (e.key === 'Enter' && inp.value && NotesSystem.writeCustom(inp.value)) { inp.value = ''; this.openNotes(); }
          if (e.key === 'Escape') { inp.blur(); this.closeOverlay(); }
        };
        if (inp) { this.game.input.typing = true; inp.onblur = () => { this.game.input.typing = false; }; }
      }, 0);
    }
    body.innerHTML = html;
    const hint = $('notes-hint'); if (hint) hint.textContent = t('notes.hintKey', { key: this.game.input.keyLabel('notes') });
  }

  private entryCard(id: string): string {
    const e = allEntries().find(x => x.id === id);
    const name = e ? t(e.nameKey) : t('place.' + id);
    const blurred = NotesSystem.isBlurred(id);
    return `<div class="card ${blurred ? 'blurred' : ''}"><h4>${esc(name)}${e?.danger ? ` <span class="mut">${esc(t('notes.danger', { d: e.danger }))}</span>` : ''}</h4><div class="mut">${esc(blurred ? t('notes.blurredEntry') : NotesSystem.descriptionFor(id))}</div>${e?.loot?.length ? `<div class="mut" style="margin-top:.3em">${esc(t('notes.loot'))}: ${e.loot.map(l => esc(itemName(l))).join(', ')}</div>` : ''}</div>`;
  }

  /* ---- wprawa (G) ---- */
  openSkills() {
    if (!NotesSystem.hasNotebook()) { this.toast(t('diegetic.noNotebook'), 'bad'); return; }
    this.openOverlay('ov-skills');
    const body = $('skills-body'); if (!body) return;
    const s = this.game.state;
    let html = `<div class="card" style="margin-bottom:.6em"><b>${esc(t('skills.intro'))}</b><div class="mut">${esc(t('skills.teacherRule'))}</div></div>`;
    if (s.skills.training) {
      const p = perkDef(s.skills.training.perkId);
      html += `<div class="card" style="border-color:#d8b25c;margin-bottom:.6em"><h4>${esc(t('skills.training'))}</h4><div>${esc(t(p?.nameKey || ''))} — ${esc(npcName(s.skills.training.teacher))}</div><div class="mut">${esc(t('train.progress', { days: s.skills.training.daysLeft }))}</div></div>`;
    }
    for (const br of allBranches()) {
      html += `<h3 style="color:var(--gold);margin:.6em 0 .3em">${esc(t(br.nameKey))} <span class="mut" style="font-size:.7em">${esc(t(br.descKey))}</span></h3><div class="grid g3">`;
      for (const sk of allSkills().filter(x => x.branch === br.id)) {
        const lv = SkillsSystem.level(sk.id);
        const pr = SkillsSystem.progress(sk.id);
        html += `<div class="card"><h4>${esc(t(sk.nameKey))} <span class="mut">${lv}</span></h4><div class="mut">${esc(t(sk.descKey))}</div><div class="bar-h"><i style="width:${Math.round(pr * 100)}%"></i></div>`;
        const perks = allPerks().filter(p => p.skill === sk.id);
        for (const p of perks) {
          const known = SkillsSystem.hasPerk(p.id);
          html += `<div class="row" style="margin-top:.3em"><span>${esc(t(p.nameKey))}${known ? ' ✓' : ''}</span><span class="n">${esc(t(p.descKey))}</span></div>`;
          if (!known) html += `<div class="mut" style="font-size:.85em">${esc(t('perk.requires', { skill: t('skill.' + p.skill), level: p.reqLevel, who: npcName(p.teacher), gold: p.crowns, days: p.days }))}</div>`;
        }
        html += `</div>`;
      }
      html += `</div>`;
    }
    body.innerHTML = html;
    const hint = $('skills-hint'); if (hint) hint.textContent = t('skills.hintKey', { key: this.game.input.keyLabel('skills') });
  }

  /* ---- mapa (M) ---- */
  openMap() {
    if (!NotesSystem.ownedRegions().length) { this.toast(t('diegetic.noMap'), 'bad'); return; }
    this.openOverlay('ov-map');
    this.drawMap();
  }

  drawMap() {
    const c = $('map-canvas') as HTMLCanvasElement | null;
    const side = $('map-side');
    const s = this.game.state;
    if (!c) return;
    const x = c.getContext('2d')!;
    const region = s.scene === 'world' ? 'port_dolne_miasto' : 'port_dolne_miasto';
    const { GRID_W, GRID_H, MAP_CELL, MAP_W, MAP_H } = NotesSystem.gridDims();
    x.imageSmoothingEnabled = false;
    x.fillStyle = '#c9b489'; x.fillRect(0, 0, c.width, c.height);
    // pergamin
    x.fillStyle = 'rgba(120,96,58,0.10)';
    for (let i = 0; i < 200; i++) x.fillRect(Math.random() * c.width, Math.random() * c.height, 2, 1);
    const sc = Math.min(c.width / MAP_W, c.height / MAP_H) * this.mapScale;
    const ox = (c.width - MAP_W * sc) / 2, oy = (c.height - MAP_H * sc) / 2;
    // odkryte komórki: uproszczony rysunek terenu
    const tm = this.game.world.district.tilemap;
    for (let gy = 0; gy < GRID_H; gy++) {
      for (let gx = 0; gx < GRID_W; gx++) {
        if (!NotesSystem.isDiscovered(gx * MAP_CELL, gy * MAP_CELL, region)) continue;
        const tx = gx * MAP_CELL + MAP_CELL / 2, ty = gy * MAP_CELL + MAP_CELL / 2;
        const g = tm.groundAt(Math.floor(tx), Math.floor(ty));
        x.fillStyle = ({
          water: '#7d99ad', waterDeep: '#5c7f96', sand: '#d8c69a', mud: '#8a7355', swamp: '#6d7a52',
          grass: '#9aa877', grassTall: '#8a9a68', dirt: '#b39a72', cobble: '#a9a294', road: '#b0a08a',
          planks: '#a8834f', stone: '#b6b0a2', gravel: '#b3aa96', field: '#c2b06a', ash: '#8e8880'
        } as Record<string, string>)[g] || '#b39a72';
        x.fillRect(ox + gx * MAP_CELL * sc, oy + gy * MAP_CELL * sc, MAP_CELL * sc + 1, MAP_CELL * sc + 1);
      }
    }
    // budynki jako bryły
    for (const o of this.game.world.district.objects) {
      if (o.kind !== 'building') continue;
      const tx = o.x / TILE, ty = o.y / TILE;
      if (!NotesSystem.isDiscovered(tx, ty, region)) continue;
      x.fillStyle = '#6a5334';
      const w = (o.box?.w || TILE * 2) / TILE * sc, h = (o.box?.h || TILE * 2) / TILE * sc;
      x.fillRect(ox + tx * sc - w / 2, oy + ty * sc - h / 2, w, h);
    }
    // mury
    for (const o of this.game.world.district.objects) {
      if (o.kind !== 'wall' && o.kind !== 'gate') continue;
      const tx = o.x / TILE, ty = o.y / TILE;
      if (!NotesSystem.isDiscovered(tx, ty, region)) continue;
      x.fillStyle = '#4a3a24';
      x.fillRect(ox + tx * sc - 1, oy + ty * sc - 1, 3, 3);
    }
    // obszary zasłyszane
    for (const heard of s.maps.heard) {
      x.strokeStyle = 'rgba(90,70,40,0.5)'; x.setLineDash([3, 3]);
      x.strokeRect(ox + 4, oy + 4, c.width - 8, c.height - 8);
      x.setLineDash([]);
      break;
    }
    // znaczniki
    for (const m of s.maps.markers) {
      const mx = ox + (m.x / TILE) * sc, my = oy + (m.y / TILE) * sc;
      x.fillStyle = m.color; x.beginPath(); x.arc(mx, my, 3, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#3a2c1e'; x.font = '9px Georgia'; x.textAlign = 'left';
      x.fillText(m.label, mx + 5, my + 3);
    }
    // John
    const px = ox + (this.game.world.player.x / TILE) * sc, py = oy + (this.game.world.player.y / TILE) * sc;
    x.fillStyle = '#8e3527'; x.beginPath(); x.arc(px, py, 3.5, 0, Math.PI * 2); x.fill();
    x.strokeStyle = '#f0e6d2'; x.lineWidth = 1; x.stroke();
    // róża wiatrów
    x.fillStyle = '#4a3a24'; x.font = 'bold 12px Georgia'; x.textAlign = 'center';
    x.fillText('N', c.width - 18, 20);
    x.strokeStyle = '#4a3a24'; x.beginPath(); x.moveTo(c.width - 18, 24); x.lineTo(c.width - 18, 38); x.stroke();
    if (side) {
      side.innerHTML = `<h4 style="color:var(--gold)">${esc(t('region.' + region))}</h4>
        <div class="mut">${esc(t('map.discovered', { pct: Math.round(NotesSystem.discoveryRatio(region) * 100) }))}</div>
        <div class="mut">${esc(t('map.markerCount', { n: s.maps.markers.length }))}</div>
        <button class="clickable" id="map-mark" style="margin-top:.5em;width:100%">${esc(t('map.markHere'))}</button>
        <div style="margin-top:.6em">${s.maps.markers.map((m, i) => `<div class="row"><span>${esc(m.label)}</span><button class="clickable map-del" data-i="${i}">✕</button></div>`).join('')}</div>
        <div class="mut" style="margin-top:.6em">${esc(t('map.heardList'))}: ${s.maps.heard.map(h => esc(t(h))).join(', ') || esc(t('map.none'))}</div>`;
      const mk = $('map-mark');
      if (mk) mk.onclick = () => {
        NotesSystem.addMarker(this.game.world.player.x, this.game.world.player.y, t('map.markerHere'));
        this.drawMap();
      };
      side.querySelectorAll('.map-del').forEach(b => (b as HTMLElement).onclick = () => { NotesSystem.removeMarker(Number((b as HTMLElement).dataset.i)); this.drawMap(); });
    }
    const hint = $('map-hint'); if (hint) hint.textContent = t('map.hintKey', { key: this.game.input.keyLabel('map') });
  }

  /* ---- sakwa (I) ---- */
  openInventory() {
    this.openOverlay('ov-inv');
    this.renderInventory();
  }

  renderInventory() {
    const body = $('inv-body'); if (!body) return;
    const s = this.game.state;
    const u = InventorySystem.usage();
    const eq = s.inventory.equipped;
    let html = `<div class="grid g2" style="margin-bottom:.6em">
      <div class="card"><h4>${esc(t('inv.weight'))}</h4><div class="bar-h"><i style="width:${Math.min(100, (u.kg / u.kgMax) * 100)}%"></i></div><div class="mut">${u.kg.toFixed(1)} / ${u.kgMax} kg${InventorySystem.overEncumbered() ? ' · ' + esc(t('inv.over')) : ''}</div></div>
      <div class="card"><h4>${esc(t('inv.volume'))}</h4><div class="bar-h"><i style="width:${Math.min(100, (u.L / u.LMax) * 100)}%"></i></div><div class="mut">${u.L.toFixed(1)} / ${u.LMax} L</div></div>
    </div>`;
    html += `<div class="grid g4" style="margin-bottom:.6em">` + (['weapon', 'offhand', 'body', 'head'] as const).map(slot => {
      const id = eq[slot];
      const d = id ? itemDef(id) : undefined;
      return `<div class="card ${id ? 'on' : ''}"><h4>${esc(t('inv.slot.' + slot))}</h4><div>${d ? esc(t(d.nameKey)) : '<span class="mut">' + esc(t('inv.empty')) + '</span>'}</div>${d?.weapon ? `<div class="mut">${esc(t('inv.dmg', { d: d.weapon.dmg }))} · ${esc(t('inv.reach', { r: d.weapon.reach }))}</div>` : ''}${d?.armor ? `<div class="mut">${esc(t('inv.mit', { m: Math.round(d.armor.mit * 100) }))}%</div>` : ''}${id ? `<button class="clickable inv-unequip" data-slot="${slot}" style="margin-top:.3em">${esc(t('inv.unequip'))}</button>` : ''}</div>`;
    }).join('') + `</div>`;
    html += `<div class="inv-grid">`;
    for (const st of s.inventory.items) {
      const d = itemDef(st.id); if (!d) continue;
      const equipped = Object.values(eq).includes(st.id);
      html += `<div class="slot clickable ${equipped ? 'equip' : ''}" data-id="${esc(st.id)}" title="${esc(t(d.nameKey))}">
        <span class="icon-holder"></span>
        ${st.qty > 1 ? `<span class="q">${st.qty}</span>` : ''}
        <span class="w">${d.weight * st.qty >= 1 ? (d.weight * st.qty).toFixed(0) + 'kg' : ''}</span>
        ${st.stolen ? '<span class="q" style="color:#c04a34;left:2px;right:auto">⚑</span>' : ''}
      </div>`;
    }
    html += `</div><div class="card" style="margin-top:.6em" id="inv-detail"><div class="mut">${esc(t('inv.hint'))}</div></div>`;
    html += `<div style="margin-top:.5em;display:flex;gap:6px"><button class="clickable" id="inv-sort">${esc(t('inv.sort'))}</button><button class="clickable" id="inv-drop">${esc(t('inv.drop'))}</button></div>`;
    body.innerHTML = html;
    // ikony
    body.querySelectorAll('.slot').forEach(sl => {
      const id = (sl as HTMLElement).dataset.id!;
      const d = itemDef(id)!;
      const holder = sl.querySelector('.icon-holder')!;
      holder.appendChild(getIcon(d.icon, 28));
      sl.addEventListener('mouseenter', () => this.showItemDetail(id));
      (sl as HTMLElement).onclick = () => { this.showItemDetail(id); this.selectedItem = id; };
    });
    body.querySelectorAll('.inv-unequip').forEach(b => (b as HTMLElement).onclick = () => { InventorySystem.unequip((b as HTMLElement).dataset.slot as any); this.renderInventory(); });
    const sort = $('inv-sort'); if (sort) sort.onclick = () => { InventorySystem.sort(); this.renderInventory(); };
    const drop = $('inv-drop'); if (drop) drop.onclick = () => { if (this.selectedItem) { InventorySystem.drop(this.selectedItem, 1); this.renderInventory(); this.updateBelt(); } };
    const hint = $('inv-hint'); if (hint) hint.textContent = t('inv.hintKey', { key: this.game.input.keyLabel('inventory') });
  }

  selectedItem: string | null = null;

  showItemDetail(id: string) {
    const box = $('inv-detail'); if (!box) return;
    const d = itemDef(id); if (!d) return;
    box.innerHTML = `<h4>${esc(t(d.nameKey))}</h4><div class="mut">${esc(t(d.descKey))}</div>
      <div class="row"><span class="n">${esc(t('inv.weight'))}</span><span>${d.weight} kg</span></div>
      <div class="row"><span class="n">${esc(t('inv.volume'))}</span><span>${d.volume} L</span></div>
      <div class="row"><span class="n">${esc(t('inv.value'))}</span><span>${d.value} ${esc(t('hud.crowns'))}</span></div>
      ${d.weapon ? `<div class="row"><span class="n">${esc(t('inv.dmgFull'))}</span><span>${d.weapon.dmg} · ${esc(t('skill.' + d.weapon.skill))}</span></div>` : ''}
      ${d.armor ? `<div class="row"><span class="n">${esc(t('inv.mitFull'))}</span><span>${Math.round(d.armor.mit * 100)}%</span></div>` : ''}
      <button class="clickable" id="inv-use" style="margin-top:.4em">${esc(t('inv.use'))}</button>`;
    const use = $('inv-use');
    if (use) use.onclick = () => { InventorySystem.use(id); this.renderInventory(); this.updateBelt(); };
  }

  /* ---- dziennik (J) ---- */
  openJournal() {
    this.openOverlay('ov-journal');
    const body = $('journal-body'); if (!body) return;
    const s = this.game.state;
    let html = `<div class="card" style="margin-bottom:.6em"><h4>${esc(t('journal.debt'))}</h4>
      <div class="row"><span class="n">${esc(t('journal.principal'))}</span><span>${s.debt.principal.toLocaleString()}</span></div>
      <div class="row"><span class="n">${esc(t('journal.paid'))}</span><span>${s.debt.paid.toLocaleString()}</span></div>
      <div class="row"><span class="n">${esc(t('journal.remaining'))}</span><span style="color:#e08a6a">${Math.round(s.debtRemaining).toLocaleString()}</span></div>
      <div class="row"><span class="n">${esc(t('journal.due'))}</span><span>${esc(t('journal.day', { day: s.debt.dueDay }))}</span></div>
      <div class="row"><span class="n">${esc(t('journal.daysLeft'))}</span><span>${s.time.daysLeft}</span></div>
      ${s.debt.loans.length ? `<div class="row"><span class="n">${esc(t('journal.loans'))}</span><span>${s.debt.loans.map(l => `${esc(l.creditor)}: ${l.due}`).join(', ')}</span></div>` : ''}
      ${s.debt.favorOwed ? `<div class="mut">${esc(t('journal.favorOwed'))}</div>` : ''}
      <div class="mut" style="margin-top:.3em">${esc(t('journal.payWhere'))}</div>
    </div>`;
    if (!NotesSystem.hasNotebook()) html += `<div class="card" style="border-color:#8e3527;margin-bottom:.6em">${esc(t('journal.noNotebook'))}</div>`;
    const active = s.quests.filter(q => q.state === 'active');
    const done = s.quests.filter(q => q.state === 'done');
    const failed = s.quests.filter(q => q.state === 'failed' || q.state === 'lost');
    html += `<h3 style="color:var(--gold)">${esc(t('journal.active'))}</h3>`;
    html += active.length ? active.map(q => {
      const d = questDef(q.id); if (!d) return '';
      const stage = d.stages[q.stageIdx];
      return `<div class="card"><h4>${esc(t(d.titleKey))}</h4><div class="mut">${esc(t(d.journalKey))}</div>${stage ? `<div style="margin-top:.3em">▸ ${esc(t(stage.descKey))}</div>` : ''}${q.data.count ? `<div class="bar-h"><i style="width:${Math.min(100, (q.data.count / (stage?.objective.count || 1)) * 100)}%"></i></div>` : ''}</div>`;
    }).join('') : `<div class="card"><div class="mut">${esc(t('journal.noneActive'))}</div></div>`;
    html += `<h3 style="color:var(--gold);margin-top:.6em">${esc(t('journal.done'))}</h3>`;
    html += done.length ? done.map(q => `<div class="row"><span>${esc(t(questDef(q.id)?.titleKey || q.id))}</span><span class="n">${esc(t('journal.day', { day: q.endedDay || 0 }))}</span></div>`).join('') : `<div class="mut">${esc(t('journal.noneDone'))}</div>`;
    if (failed.length) {
      html += `<h3 style="color:#8e3527;margin-top:.6em">${esc(t('journal.failed'))}</h3>`;
      html += failed.map(q => `<div class="row"><span>${esc(t(questDef(q.id)?.titleKey || q.id))}</span></div>`).join('');
    }
    html += `<div class="card" style="margin-top:.6em"><h4>${esc(t('journal.reputation'))}</h4>${FACTIONS.map(f => `<div class="row"><span class="n">${esc(t('faction.' + f))}</span><span>${s.reputation[f]} · ${esc(ReputationSystem.tier(f))}</span></div>`).join('')}</div>`;
    body.innerHTML = html;
  }

  /* ---- handel ---- */
  openTrade(merchantId: string, npcId?: string) {
    const m = merchantDef(merchantId);
    if (!m) { this.toast(t('trade.unknown'), 'bad'); return; }
    if (!EconomySystem.isOpen(merchantId)) { this.toast(t('trade.closed', { from: m.hours?.[0] ?? 0, to: m.hours?.[1] ?? 24 }), 'bad'); return; }
    this.tradeMerchant = merchantId; this.tradeNpc = npcId || m.npc;
    this.openOverlay('ov-trade');
    this.renderTrade();
  }

  renderTrade() {
    const body = $('trade-body'); if (!body) return;
    const s = this.game.state;
    const m = merchantDef(this.tradeMerchant!); if (!m) return;
    const cash = s.economy.merchantCash[m.id] ?? m.cash;
    let html = `<div class="grid g2" style="margin-bottom:.6em">
      <div class="card"><h4>${esc(t(m.nameKey))}</h4><div class="mut">${esc(npcName(m.npc))}</div><div class="mut">${esc(t('trade.cash', { gold: Math.round(cash) }))}</div>${m.flavorKey ? `<div class="mut">${esc(t(m.flavorKey))}</div>` : ''}</div>
      <div class="card"><h4>${esc(t('hud.purse'))}</h4><div>${s.gold} ${esc(t('hud.crowns'))}</div><div class="mut">${esc(t('trade.hint'))}</div></div></div>`;
    html += `<h3 style="color:var(--gold)">${esc(t('trade.buy'))}</h3><div class="grid g3">`;
    for (const id of m.stock) {
      const d = itemDef(id); if (!d) continue;
      const price = EconomySystem.price(id, m.id, 'buy');
      html += `<div class="card"><h4>${esc(t(d.nameKey))}</h4><div class="mut">${esc(t(d.descKey))}</div>
        <div class="row"><span class="n">${esc(String(price))} ${esc(t('hud.crowns'))}</span><button class="clickable buy" data-id="${esc(id)}">${esc(t('trade.buyBtn'))}</button></div></div>`;
    }
    html += `</div><h3 style="color:var(--gold);margin-top:.6em">${esc(t('trade.sell'))}</h3><div class="grid g3">`;
    const sellable = s.inventory.items.filter(i => {
      const d = itemDef(i.id); if (!d) return false;
      if (d.tags.includes('unique') || d.cat === 'quest') return false;
      if (m.sellCats?.length && !m.sellCats.includes(d.cat) && !m.stock.includes(i.id)) return false;
      return true;
    });
    for (const st of sellable) {
      const d = itemDef(st.id)!;
      const price = EconomySystem.price(st.id, m.id, 'sell') * (st.stolen ? 0.5 : 1);
      html += `<div class="card"><h4>${esc(t(d.nameKey))} ×${st.qty}${st.stolen ? ' ⚑' : ''}</h4>
        <div class="row"><span class="n">${esc(String(Math.round(price)))} ${esc(t('hud.crowns'))}</span><button class="clickable sell" data-id="${esc(st.id)}">${esc(t('trade.sellBtn'))}</button></div></div>`;
    }
    html += `</div>`;
    body.innerHTML = html;
    body.querySelectorAll('.buy').forEach(b => (b as HTMLElement).onclick = () => { EconomySystem.buy((b as HTMLElement).dataset.id!, m.id, 1); this.renderTrade(); this.updateBelt(); });
    body.querySelectorAll('.sell').forEach(b => (b as HTMLElement).onclick = () => { EconomySystem.sell((b as HTMLElement).dataset.id!, m.id, 1); this.renderTrade(); this.updateBelt(); });
    const hint = $('trade-hint'); if (hint) hint.textContent = t('trade.hintKey', { who: npcName(m.npc) });
  }

  /* ---- rzemiosło ---- */
  openCraft(stationId: string) {
    const st = stationDef(stationId);
    if (!st) { this.toast(t('craft.noStation'), 'bad'); return; }
    if (st.id === 'forgeWork' && !this.game.state.flags.station_forgeWork) {
      this.toast(t('craft.forgeLocked'), 'bad'); return;
    }
    this.craftStation = stationId;
    this.openOverlay('ov-generic');
    this.renderCraft();
  }

  renderCraft() {
    const g = $('gen-title'), body = $('gen-body');
    const st = stationDef(this.craftStation!);
    if (!st || !body) return;
    if (g) g.textContent = t(st.nameKey);
    const s = this.game.state;
    let html = `<div class="card" style="margin-bottom:.6em"><div class="mut">${esc(t('craft.intro', { skill: t('skill.' + st.skill), level: SkillsSystem.level(st.skill) }))}</div>
      ${st.tool ? `<div class="mut">${esc(t('craft.needTool', { what: itemName(st.tool) }))} ${InventorySystem.has(st.tool) ? '✓' : '✗'}</div>` : ''}
      ${st.fuel ? `<div class="mut">${esc(t('craft.needFuel', { what: itemName(st.fuel) }))} ${InventorySystem.has(st.fuel) ? '✓' : '✗'}</div>` : ''}
      <div class="mut">${esc(t('craft.takesTime', { min: st.timeMin }))}</div></div>`;
    html += `<div class="grid g3">`;
    for (const r of recipesFor(this.craftStation!)) {
      const check = CraftingSystem.canCraft(r.id);
      const out = itemDef(r.out);
      html += `<div class="card ${check.ok ? 'on' : ''}"><h4>${esc(out ? t(out.nameKey) : r.out)} ×${r.qty}</h4>
        <div class="mut">${r.in.map(i => `${esc(itemName(i.id))} ×${i.qty} (${InventorySystem.count(i.id)})`).join(', ')}</div>
        ${check.quality !== undefined ? `<div class="mut">${esc(t('craft.quality', { q: Math.round(check.quality * 100) }))}</div>` : ''}
        ${check.ok ? '' : `<div class="mut" style="color:#c07a5a">${esc(check.reason || '')}</div>`}
        <button class="clickable craft-btn" data-id="${esc(r.id)}" ${check.ok ? '' : 'disabled'} style="margin-top:.3em">${esc(t('craft.do'))}</button></div>`;
    }
    html += `</div>`;
    body.innerHTML = html;
    body.querySelectorAll('.craft-btn').forEach(b => (b as HTMLElement).onclick = () => {
      if (CraftingSystem.craft((b as HTMLElement).dataset.id!)) { this.closeOverlay(); this.updateBelt(); }
      else this.renderCraft();
    });
  }

  /* ---- hazard ---- */
  openGamble(e: { game?: string; stake?: number; npcId?: string }) {
    const s = this.game.state;
    if (!s.flags.table_welcome) { this.toast(t('gamble.notWelcome'), 'bad'); return; }
    this.gambleStake = e.stake || 10;
    this.openOverlay('ov-generic');
    const g = $('gen-title'); if (g) g.textContent = t('gamble.title');
    this.renderGamble(e.npcId || 'gracz_pankracy');
  }

  renderGamble(npcId: string) {
    const body = $('gen-body'); if (!body) return;
    const s = this.game.state;
    const d = GamblingSystem.dice;
    let html = `<div class="grid g2" style="margin-bottom:.6em">
      <div class="card"><h4>${esc(npcName(npcId))}</h4><div class="mut">${esc(t('gamble.rules'))}</div><div class="mut">${esc(t('gamble.skillLevel', { lv: GamblingSystem.skill() }))}</div></div>
      <div class="card"><h4>${esc(t('hud.purse'))}</h4><div>${s.gold}</div><div class="mut">${esc(t('gamble.stake'))}: ${this.gambleStake}</div></div></div>`;
    if (!d) {
      html += `<div class="grid g4">`;
      for (const stake of [5, 10, 25, 50]) {
        html += `<button class="clickable stake" data-s="${stake}" ${s.gold < stake ? 'disabled' : ''}>${esc(t('gamble.playFor', { gold: stake }))}</button>`;
      }
      html += `</div><div style="margin-top:.6em"><button class="clickable" id="gamble-cards">${esc(t('gamble.cards'))}</button></div>`;
    } else {
      html += `<div class="card"><h4>${esc(t('gamble.yourDice'))}</h4><div style="font-size:1.6em">${d.player.map(v => `[ ${v} ]`).join(' ')}</div></div>`;
      html += `<div class="card" style="margin-top:.4em"><h4>${esc(t('gamble.rivalDice'))}</h4><div style="font-size:1.6em">${d.rival.map((v, i) => d.peeked && i === 2 ? `[ ${v} ]` : `[ ? ]`).join(' ')}</div></div>`;
      html += `<div class="mut" style="margin:.5em 0">${esc(t('gamble.keepTwo'))}</div><div class="grid g3">`;
      d.player.forEach((_, i) => {
        html += `<button class="clickable keep" data-i="${i}" ${d.kept.includes(i) ? 'style="border-color:var(--gold)"' : ''}>${esc(t('gamble.keep', { n: i + 1 }))}</button>`;
      });
      html += `</div><div class="grid g3" style="margin-top:.4em">
        <button class="clickable" id="gamble-peek" ${d.peeked ? 'disabled' : ''}>${esc(t('gamble.peek'))}</button>
        <button class="clickable" id="gamble-reroll" ${d.rerolled ? 'disabled' : ''}>${esc(t('gamble.reroll'))}</button>
        <button class="clickable" id="gamble-cheat">${esc(t('gamble.cheat'))}</button></div>
        <div style="margin-top:.5em"><button class="clickable" id="gamble-resolve">${esc(t('gamble.reveal'))}</button></div>`;
    }
    body.innerHTML = html;
    body.querySelectorAll('.stake').forEach(b => (b as HTMLElement).onclick = () => {
      const stake = Number((b as HTMLElement).dataset.s);
      if (GamblingSystem.startDice(stake, npcId)) this.renderGamble(npcId);
    });
    const cards = $('gamble-cards');
    if (cards) cards.onclick = () => {
      if (GamblingSystem.startCards(this.gambleStake, npcId)) { GamblingSystem.revealCards(); setTimeout(() => this.renderGamble(npcId), 400); }
    };
    body.querySelectorAll('.keep').forEach(b => (b as HTMLElement).onclick = () => {
      const i = Number((b as HTMLElement).dataset.i);
      const k = GamblingSystem.dice!.kept;
      if (k.includes(i)) k.splice(k.indexOf(i), 1);
      else { k.push(i); if (k.length > 2) k.shift(); }
      if (k.length === 2) { GamblingSystem.resolve(); this.closeOverlay(); }
      else this.renderGamble(npcId);
    });
    const peek = $('gamble-peek'); if (peek) peek.onclick = () => { GamblingSystem.peek(); this.renderGamble(npcId); };
    const rr = $('gamble-reroll'); if (rr) rr.onclick = () => { GamblingSystem.reroll(0); this.renderGamble(npcId); };
    const ch = $('gamble-cheat'); if (ch) ch.onclick = () => { GamblingSystem.cheat(); this.renderGamble(npcId); };
    const rv = $('gamble-resolve'); if (rv) rv.onclick = () => { GamblingSystem.resolve(); this.closeOverlay(); };
  }

  /* ---- dług ---- */
  openDebt() {
    this.openOverlay('ov-generic');
    const g = $('gen-title'); if (g) g.textContent = t('debt.title');
    const body = $('gen-body'); if (!body) return;
    const s = this.game.state;
    body.innerHTML = `<div class="card"><h4>${esc(t('debt.toWhom'))}</h4><div class="mut">${esc(t('debt.creditor'))}</div>
      <div class="row"><span class="n">${esc(t('journal.remaining'))}</span><span>${Math.round(s.debtRemaining).toLocaleString()}</span></div>
      <div class="row"><span class="n">${esc(t('journal.due'))}</span><span>${esc(t('journal.day', { day: s.debt.dueDay }))}</span></div>
      <div class="row"><span class="n">${esc(t('hud.purse'))}</span><span>${s.gold}</span></div></div>
      <div class="grid g4" style="margin-top:.6em">
        ${[50, 100, 500, 1000].map(a => `<button class="clickable pay" data-a="${a}" ${s.gold < a ? 'disabled' : ''}>${esc(t('debt.payAmount', { gold: a }))}</button>`).join('')}
      </div>
      <div style="margin-top:.5em"><button class="clickable" id="pay-all" ${s.gold <= 0 ? 'disabled' : ''}>${esc(t('debt.payAll', { gold: Math.min(s.gold, Math.round(s.debtRemaining)) }))}</button></div>`;
    body.querySelectorAll('.pay').forEach(b => (b as HTMLElement).onclick = () => { DebtSystem.pay(Number((b as HTMLElement).dataset.a)); this.openDebt(); this.updateBelt(); });
    const all = $('pay-all'); if (all) all.onclick = () => { DebtSystem.pay(Math.min(s.gold, Math.round(s.debtRemaining))); this.openDebt(); };
  }

  /* ---- skrzynia / schowek ---- */
  openChest(key: string) {
    this.chestKey = key;
    const s = this.game.state;
    if (!s.storage[key]) s.storage[key] = [];
    this.openOverlay('ov-generic');
    const g = $('gen-title'); if (g) g.textContent = t('chest.title');
    this.renderChest();
  }

  renderChest() {
    const body = $('gen-body'); if (!body || !this.chestKey) return;
    const s = this.game.state;
    const store = s.storage[this.chestKey] || [];
    const u = InventorySystem.usage();
    let html = `<div class="grid g2"><div><h4 style="color:var(--gold)">${esc(t('chest.contents'))}</h4><div class="inv-grid">`;
    for (const st of store) {
      const d = itemDef(st.id); if (!d) continue;
      html += `<div class="slot clickable take" data-id="${esc(st.id)}"><span class="icon-holder"></span>${st.qty > 1 ? `<span class="q">${st.qty}</span>` : ''}</div>`;
    }
    html += `</div>${store.length ? '' : `<div class="mut">${esc(t('chest.empty'))}</div>`}</div>
      <div><h4 style="color:var(--gold)">${esc(t('inv.title'))}</h4><div class="mut">${u.kg.toFixed(1)}/${u.kgMax} kg</div><div class="inv-grid">`;
    for (const st of s.inventory.items) {
      const d = itemDef(st.id); if (!d) continue;
      html += `<div class="slot clickable put" data-id="${esc(st.id)}"><span class="icon-holder"></span>${st.qty > 1 ? `<span class="q">${st.qty}</span>` : ''}</div>`;
    }
    html += `</div></div></div>`;
    body.innerHTML = html;
    const paint = (sel: HTMLElement) => {
      const id = sel.dataset.id!; const d = itemDef(id)!;
      sel.querySelector('.icon-holder')!.appendChild(getIcon(d.icon, 26));
      sel.setAttribute('title', t(d.nameKey));
    };
    body.querySelectorAll('.take').forEach(el => { paint(el as HTMLElement); (el as HTMLElement).onclick = () => {
      const id = (el as HTMLElement).dataset.id!;
      const idx = store.findIndex(x => x.id === id);
      if (idx >= 0 && InventorySystem.add(id, 1)) { store[idx].qty--; if (store[idx].qty <= 0) store.splice(idx, 1); s.storage[this.chestKey!] = store; this.renderChest(); this.updateBelt(); }
    }; });
    body.querySelectorAll('.put').forEach(el => { paint(el as HTMLElement); (el as HTMLElement).onclick = () => {
      const id = (el as HTMLElement).dataset.id!;
      if (InventorySystem.remove(id, 1) > 0) {
        const ex = store.find(x => x.id === id);
        if (ex) ex.qty++; else store.push({ id, qty: 1 });
        s.storage[this.chestKey!] = store; this.renderChest(); this.updateBelt();
      }
    }; });
  }

  /* ---- sen ---- */
  openSleep(cost: number, placeKey?: string) {
    this.openOverlay('ov-generic');
    const g = $('gen-title'); if (g) g.textContent = t('sleep.title');
    const body = $('gen-body'); if (!body) return;
    const s = this.game.state;
    const options: Array<{ to: number; label: string; q: number }> = [
      { to: 6, label: t('sleep.tillDawn'), q: 1 },
      { to: 12, label: t('sleep.tillNoon'), q: 0.9 },
      { to: s.time.hour + 2 > 24 ? (s.time.hour + 2) % 24 : s.time.hour + 2, label: t('sleep.nap'), q: 0.6 }
    ];
    body.innerHTML = `<div class="card"><div class="mut">${esc(placeKey ? t(placeKey) : t('sleep.where'))}</div>
      ${cost ? `<div class="row"><span class="n">${esc(t('sleep.cost'))}</span><span>${cost} ${esc(t('hud.crowns'))}</span></div>` : ''}
      <div class="mut">${esc(t('sleep.fatigue', { f: Math.round(s.needs.fatigue) }))}</div></div>
      <div class="grid g3" style="margin-top:.6em">${options.map((o, i) => `<button class="clickable sleepopt" data-i="${i}" ${cost && s.gold < cost ? 'disabled' : ''}>${esc(o.label)}</button>`).join('')}</div>
      <div class="mut" style="margin-top:.5em">${esc(t('sleep.warning'))}</div>`;
    body.querySelectorAll('.sleepopt').forEach(b => (b as HTMLElement).onclick = () => {
      const o = options[Number((b as HTMLElement).dataset.i)];
      if (cost) { s.gold -= cost; }
      this.closeOverlay();
      bus.emit('time:sleep', { to: o.to, place: cost ? 'room' : 'straw' });
    });
  }

  /* ---- tablica ogłoszeń ---- */
  openBoard() {
    this.openOverlay('ov-generic');
    const g = $('gen-title'); if (g) g.textContent = t('board.title');
    const body = $('gen-body'); if (!body) return;
    const offers: Array<{ tpl: string; title: string; desc: string; pay: number }> = [];
    for (const tpl of ['board_delivery', 'board_escort', 'board_pests', 'board_labour', 'board_missing', 'board_debt']) {
      const seedVal = this.game.state.time.day * 31 + tpl.length;
      rng.setSeed(seedVal);
      try {
        const q = QuestSystem.generateBoard(tpl);
        offers.push({ tpl, title: q.title, desc: q.desc, pay: q.pay });
        // natychmiast kasujemy — gracz wybierze tylko jedno
        const st = this.game.state.quests.find(x => x.id === q.questId);
        if (st) { this.game.state.quests = this.game.state.quests.filter(x => x !== st); }
      } catch { /* szablon może nie istnieć */ }
    }
    rng.setSeed(Date.now() % 100000);
    body.innerHTML = offers.map((o, i) => `<div class="card"><h4>${esc(o.title)}</h4><div class="mut">${esc(o.desc)}</div>
      <button class="clickable board-take" data-i="${i}" style="margin-top:.3em">${esc(t('board.take', { gold: o.pay }))}</button></div>`).join('') || `<div class="mut">${esc(t('board.empty'))}</div>`;
    body.querySelectorAll('.board-take').forEach(b => (b as HTMLElement).onclick = () => {
      const o = offers[Number((b as HTMLElement).dataset.i)];
      const q = QuestSystem.generateBoard(o.tpl);
      this.toast(t('quest.started', { title: q.title }), 'good');
      this.closeOverlay();
    });
  }

  /* ---- pisanie / znak / potwierdzenie ---- */
  openWrite() { this.openNotes(); this.notesTab = 4; this.openNotes(); }

  showSign(text: string) {
    this.openOverlay('ov-generic');
    const g = $('gen-title'); if (g) g.textContent = t('sign.title');
    const body = $('gen-body'); if (body) body.innerHTML = `<div class="card parchment" style="font-size:1em;line-height:1.5">${esc(text)}</div><div class="mut" style="margin-top:.4em">${esc(t('sign.hint'))}</div>`;
    this.signUntil = performance.now() + 12000;
  }

  confirm(text: string, onYes: () => void) {
    this.openOverlay('ov-generic');
    const g = $('gen-title'); if (g) g.textContent = t('confirm.title');
    const body = $('gen-body'); if (!body) return;
    body.innerHTML = `<div class="card">${esc(text)}</div><div class="grid g2" style="margin-top:.6em">
      <button class="clickable" id="cf-yes">1 · ${esc(t('confirm.yes'))}</button>
      <button class="clickable" id="cf-no">2 · ${esc(t('confirm.no'))}</button></div>`;
    this.confirmCb = onYes;
    $('cf-yes')!.onclick = () => { this.confirmCb = null; this.closeOverlay(); onYes(); };
    $('cf-no')!.onclick = () => { this.confirmCb = null; this.closeOverlay(); };
  }

  closeGeneric() { this.closeOverlay('ov-generic'); this.signUntil = 0; this.confirmCb = null; }

  /* ---- koło szybkiego dostępu (Q) ---- */
  toggleRadial() {
    if (this.radialOpen) { this.radialOpen = false; $('radial')?.classList.remove('open'); this.game.state.time.paused = false; return; }
    const s = this.game.state;
    this.radialItems = s.inventory.items.filter(i => itemDef(i.id)?.tags.includes('belt')).map(i => i.id);
    if (!this.radialItems.length) { this.toast(t('belt.empty'), 'bad'); return; }
    this.radialSel = 0;
    this.radialOpen = true;
    $('radial')?.classList.add('open');
    s.time.paused = true;
    this.drawRadial();
  }

  drawRadial() {
    const c = $('radial-canvas') as HTMLCanvasElement | null;
    if (!c) return;
    const x = c.getContext('2d')!;
    x.clearRect(0, 0, c.width, c.height);
    const cx = c.width / 2, cy = c.height / 2, R = 92;
    x.fillStyle = 'rgba(10,8,6,0.55)'; x.beginPath(); x.arc(cx, cy, R + 28, 0, Math.PI * 2); x.fill();
    const n = this.radialItems.length;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2;
      const px = cx + Math.cos(a) * R, py = cy + Math.sin(a) * R;
      const sel = i === this.radialSel;
      x.fillStyle = sel ? 'rgba(216,178,92,0.35)' : 'rgba(30,22,14,0.8)';
      x.strokeStyle = sel ? '#d8b25c' : '#4a3a24';
      x.lineWidth = 2;
      x.beginPath(); x.arc(px, py, 24, 0, Math.PI * 2); x.fill(); x.stroke();
      const d = itemDef(this.radialItems[i]);
      if (d) {
        x.imageSmoothingEnabled = false;
        x.drawImage(getIcon(d.icon, 32), px - 16, py - 16);
        x.fillStyle = sel ? '#f0e6d2' : '#a99a7d';
        x.font = '10px Georgia'; x.textAlign = 'center';
        x.fillText(t(d.nameKey).slice(0, 14), px, py + 34);
      }
    }
    x.fillStyle = '#a99a7d'; x.font = '11px Georgia'; x.textAlign = 'center';
    x.fillText(t('belt.hint'), cx, cy + 6);
  }

  radialInput(i: InputManager) {
    const axis = i.moveAxis();
    if (Math.hypot(axis.x, axis.y) > 0.4) {
      const a = Math.atan2(axis.y, axis.x);
      const n = this.radialItems.length;
      let best = 0, bd = Infinity;
      for (let k = 0; k < n; k++) {
        const ka = (k / n) * Math.PI * 2 - Math.PI / 2;
        let d = Math.abs(((ka - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
        if (d < bd) { bd = d; best = k; }
      }
      this.radialSel = best;
    }
    if (i.pressed('quickbelt') || i.pressed('interact')) {
      const id = this.radialItems[this.radialSel];
      this.radialOpen = false; $('radial')?.classList.remove('open');
      this.game.state.time.paused = false;
      if (id) InventorySystem.use(id);
    }
    if (i.pressed('pause')) { this.radialOpen = false; $('radial')?.classList.remove('open'); this.game.state.time.paused = false; }
  }

  /* ---- pauza (ESC) ---- */
  togglePause() {
    if (this.radialOpen) { this.radialInput(this.game.input); return; }
    this.paused = !this.paused;
    const el = $('ov-pause');
    if (this.paused) {
      this.openOverlay('ov-pause');
      this.game.state.time.paused = true;
      this.renderPause();
    } else {
      this.closeOverlay('ov-pause');
      this.game.state.time.paused = false;
    }
  }

  renderPause() {
    const tabs = $('pause-tabs'); const body = $('pause-body');
    const g = $('pause-title'); if (g) g.textContent = t('pause.title');
    const hint = $('pause-hint'); if (hint) hint.textContent = t('pause.hint', { key: this.game.input.keyLabel('pause') });
    const list = ['pause.tab.resume', 'pause.tab.save', 'pause.tab.settings', 'pause.tab.controls', 'pause.tab.stats', 'pause.tab.about'];
    if (tabs) {
      tabs.innerHTML = list.map((k, i) => `<button class="tab clickable ${i === this.pauseTab ? 'on' : ''}" data-i="${i}">${esc(t(k))}</button>`).join('');
      tabs.querySelectorAll('button').forEach(b => b.onclick = () => { this.pauseTab = Number((b as HTMLElement).dataset.i); this.renderPause(); });
    }
    if (!body) return;
    const s = this.game.state;
    if (this.pauseTab === 0) {
      body.innerHTML = `<div class="card"><h4>${esc(t('pause.status'))}</h4>
        <div class="row"><span class="n">${esc(t('pause.status'))}</span><span>${esc(t('hud.day', { day: s.time.day }))} · ${esc(t('phase.' + s.time.phase()))}</span></div>
        <div class="row"><span class="n">${esc(t('journal.remaining'))}</span><span>${Math.round(s.debtRemaining).toLocaleString()}</span></div>
        <div class="row"><span class="n">${esc(t('hud.purse'))}</span><span>${s.gold}</span></div>
        <div class="row"><span class="n">${esc(t('pause.place'))}</span><span>${esc(t(this.game.world.scene?.nameKey || ''))}</span></div>
        ${s.injuries.length ? `<div class="row"><span class="n">${esc(t('pause.injuries'))}</span><span>${s.injuries.map(i => esc(t('body.' + i.part)) + (i.infected ? ' ⚠' : '')).join(', ')}</span></div>` : ''}
        ${s.diseases.length ? `<div class="row"><span class="n">${esc(t('pause.illness'))}</span><span>${s.diseases.map(d => esc(t('disease.' + d.id))).join(', ')}</span></div>` : ''}
        ${CrimeSystem.isWanted() ? `<div class="row"><span class="n">${esc(t('pause.wanted'))}</span><span>${s.crime.wanted}</span></div>` : ''}
        </div><button class="clickable" id="p-resume" style="margin-top:.6em">${esc(t('pause.tab.resume'))}</button>`;
      $('p-resume')!.onclick = () => this.togglePause();
    } else if (this.pauseTab === 1) {
      const saves = SaveSystem.list();
      body.innerHTML = `<div class="grid g2">${['quick', '1', '2', '3'].map(sl => `<button class="clickable save-slot" data-s="${sl}">${esc(t('save.writeTo', { slot: sl }))}</button>`).join('')}</div>
        <h4 style="color:var(--gold);margin-top:.6em">${esc(t('save.slots'))}</h4>
        ${saves.length ? saves.map(m => `<div class="row"><span>${esc(m.name)} · ${esc(t('journal.day', { day: m.day }))} · ${m.gold}⊙ · ${esc(t('save.debt', { d: m.debt }))}</span><span><button class="clickable load-slot" data-s="${esc(m.slot)}">${esc(t('save.load'))}</button> <button class="clickable del-slot" data-s="${esc(m.slot)}">✕</button></span></div>`).join('') : `<div class="mut">${esc(t('save.none'))}</div>`}`;
      body.querySelectorAll('.save-slot').forEach(b => (b as HTMLElement).onclick = () => { this.game.save((b as HTMLElement).dataset.s!); this.renderPause(); });
      body.querySelectorAll('.load-slot').forEach(b => (b as HTMLElement).onclick = () => { this.game.load((b as HTMLElement).dataset.s!); this.paused = false; this.closeAll(); });
      body.querySelectorAll('.del-slot').forEach(b => (b as HTMLElement).onclick = () => { SaveSystem.erase((b as HTMLElement).dataset.s!); this.renderPause(); });
    } else if (this.pauseTab === 2) {
      body.innerHTML = `<div id="settings-grid"></div>`;
      this.renderSettings($('settings-grid')!);
    } else if (this.pauseTab === 3) {
      const rows = Object.keys(ACTION_LABEL_KEY).map(a => `<div class="row"><span>${esc(t(ACTION_LABEL_KEY[a as keyof typeof ACTION_LABEL_KEY]))}</span><span class="n"><b>${esc(this.game.input.keyLabel(a as any))}</b></span></div>`).join('');
      body.innerHTML = `<div class="kbd-list">${rows}</div><div class="mut" style="margin-top:.6em">${esc(t('controls.diegetic'))}</div>`;
    } else if (this.pauseTab === 4) {
      const st = s.stats;
      body.innerHTML = `<div class="grid g3">${Object.entries(st).map(([k, v]) => `<div class="card"><h4>${esc(t('stat.' + k))}</h4><div>${typeof v === 'number' ? Math.round(v).toLocaleString() : v}</div></div>`).join('')}</div>
        <div class="card" style="margin-top:.6em"><h4>${esc(t('stat.endings'))}</h4><div class="mut">${esc(ReputationSystem.summary())}</div></div>`;
    } else {
      body.innerHTML = `<div class="card parchment"><h4>${esc(t('about.title'))}</h4><div>${esc(t('about.body'))}</div></div>
        <div class="card" style="margin-top:.6em"><h4>${esc(t('about.principle'))}</h4><div class="mut">${esc(t('about.principleBody'))}</div></div>`;
    }
  }

  renderSettings(root: HTMLElement) {
    const d = settings.data;
    const row = (label: string, ctrl: string) => `<div class="set-row"><label>${esc(label)}</label>${ctrl}</div>`;
    const slider = (key: keyof typeof d, min: number, max: number, step: number) =>
      `<input type="range" class="clickable" data-key="${key}" min="${min}" max="${max}" step="${step}" value="${d[key]}">`;
    const select = (key: keyof typeof d, opts: Array<[string, string]>) =>
      `<select class="clickable" data-key="${key}">${opts.map(([v, l]) => `<option value="${v}" ${String(d[key]) === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
    const check = (key: keyof typeof d) => `<input type="checkbox" class="clickable" data-key="${key}" ${d[key] ? 'checked' : ''}>`;
    root.innerHTML =
      row(t('set.lang'), select('lang', [['pl', 'Polski'], ['en', 'English']])) +
      row(t('set.uiScale'), slider('uiScale', 0.85, 1.5, 0.05)) +
      row(t('set.masterVolume'), slider('masterVolume', 0, 1, 0.05)) +
      row(t('set.musicVolume'), slider('musicVolume', 0, 1, 0.05)) +
      row(t('set.sfxVolume'), slider('sfxVolume', 0, 1, 0.05)) +
      row(t('set.ambientVolume'), slider('ambientVolume', 0, 1, 0.05)) +
      row(t('set.subtitleBg'), check('subtitleBg')) +
      row(t('set.subtitleSize'), slider('subtitleSize', 0.85, 1.4, 0.05)) +
      row(t('set.colorblind'), check('colorblindMode')) +
      row(t('set.noFlash'), check('disableFlashing')) +
      row(t('set.noShake'), check('disableCameraShake')) +
      row(t('set.sneakMode'), select('sneakMode', [['hold', t('set.hold')], ['toggle', t('set.toggle')]])) +
      row(t('set.runMode'), select('runMode', [['hold', t('set.hold')], ['toggle', t('set.toggle')]])) +
      row(t('set.visionCones'), check('showVisionCones')) +
      row(t('set.questMarkers'), check('showQuestMarkers')) +
      row(t('set.combat'), select('difficultyCombat', [['0', t('diff.easy')], ['1', t('diff.normal')], ['2', t('diff.brutal')]])) +
      row(t('set.economy'), select('difficultyEconomy', [['0', t('diff.easy')], ['1', t('diff.normal')], ['2', t('diff.brutal')]])) +
      row(t('set.law'), select('difficultyLaw', [['0', t('diff.easy')], ['1', t('diff.normal')], ['2', t('diff.brutal')]])) +
      row(t('set.hardcore'), check('hardcore')) +
      row(t('set.showFps'), check('showFps')) +
      `<div class="mut" style="margin-top:.6em">${esc(t('set.note'))}</div>`;
    root.querySelectorAll('[data-key]').forEach(el => {
      const key = (el as HTMLElement).dataset.key as keyof typeof d;
      const handler = () => {
        const e = el as HTMLInputElement;
        let v: any = e.type === 'checkbox' ? e.checked : e.type === 'range' ? Number(e.value) : e.value;
        if (key === 'difficultyCombat' || key === 'difficultyEconomy' || key === 'difficultyLaw') v = Number(v);
        (d as any)[key] = v;
        settings.save();
        if (key === 'lang') { setLang(v); this.refreshAll(); }
        if (key === 'uiScale') document.documentElement.style.setProperty('--ui-scale', String(v));
        if (key === 'showFps') this.game.renderer.showDebug = v;
        if (key === 'hardcore') this.game.state.hardcore = v;
        if (key === 'colorblindMode') bus.emit('settings:colorblind', { on: v });
      };
      el.addEventListener('input', handler);
      el.addEventListener('change', handler);
    });
  }

  zoomCamera(wheel: number) {
    const d = settings.data;
    d.cameraZoom = Math.max(1, Math.min(2, d.cameraZoom + (wheel > 0 ? -0.1 : 0.1)));
    settings.save();
    const cam = this.game.renderer.camera;
    cam.viewW = Math.round(640 / d.cameraZoom); cam.viewH = Math.round(360 / d.cameraZoom);
    this.toast(t('camera.zoom', { z: d.cameraZoom.toFixed(1) }));
  }

  /* ---- tytuł i zakończenie ---- */
  buildTitle() {
    const menu = $('title-menu'); if (!menu) return;
    const s = this.game.state;
    this.titleItems = [
      { label: t('title.newGame'), act: () => this.game.newGame(false) },
      { label: t('title.newGameHardcore'), act: () => this.game.newGame(true) }
    ];
    if (SaveSystem.hasAny()) this.titleItems.splice(1, 0, { label: t('title.continue'), act: () => { if (!this.game.load('auto')) this.game.load('quick'); } });
    this.titleItems.push({ label: t('title.settings'), act: () => { this.openOverlay('ov-pause'); this.pauseTab = 2; this.renderPause(); } });
    this.titleItems.push({ label: t('title.about'), act: () => { this.openOverlay('ov-pause'); this.pauseTab = 5; this.renderPause(); } });
    this.titleSel = 0;
    this.renderTitleMenu();
    const fine = $('title-fine');
    if (fine) fine.innerHTML = esc(t('title.fine'));
    this.drawTitleArt();
  }

  renderTitleMenu() {
    const menu = $('title-menu'); if (!menu) return;
    menu.innerHTML = this.titleItems.map((it, i) => `<button class="clickable ${i === this.titleSel ? 'on' : ''}" data-i="${i}">${esc(it.label)}</button>`).join('');
    menu.querySelectorAll('button').forEach(b => {
      const i = Number((b as HTMLElement).dataset.i);
      b.onclick = () => { this.titleSel = i; this.titleItems[i].act(); };
      b.onmouseenter = () => { this.titleSel = i; this.updateTitleSelection(); };
    });
  }

  updateTitleSelection() {
    const btns = document.querySelectorAll('#title-menu button');
    btns.forEach((b, i) => b.classList.toggle('on', i === this.titleSel));
  }

  titleNavigate(delta: number) {
    if (!this.titleItems.length) return;
    this.titleSel = (this.titleSel + delta + this.titleItems.length) % this.titleItems.length;
    this.updateTitleSelection();
  }

  drawTitleArt() {
    const c = $('title-art') as HTMLCanvasElement | null;
    if (!c) return;
    const x = c.getContext('2d')!;
    x.imageSmoothingEnabled = false;
    x.clearRect(0, 0, c.width, c.height);
    // morze, brzeg, sylwetka miasta — pikselowy herb sceny
    for (let i = 0; i < c.height; i++) {
      const t01 = i / c.height;
      x.fillStyle = t01 < 0.45 ? rgba('#3f5f7a', 1 - t01 * 0.4) : t01 < 0.6 ? '#c9b489' : '#6d7a52';
      x.fillRect(0, i, c.width, 1);
    }
    x.fillStyle = '#2b2118';
    for (let i = 0; i < 26; i++) {
      const bx = 8 + i * 12 + ((i * 37) % 5), bh = 16 + ((i * 53) % 22);
      x.fillRect(bx, 74 - bh, 10, bh);
      x.beginPath(); x.moveTo(bx - 2, 74 - bh); x.lineTo(bx + 5, 74 - bh - 8); x.lineTo(bx + 12, 74 - bh); x.fill();
    }
    x.fillStyle = '#d8b25c';
    for (let i = 0; i < 14; i++) x.fillRect(14 + i * 22, 60 + (i % 3) * 4, 2, 2);
    x.fillStyle = 'rgba(255,255,255,0.12)';
    for (let i = 0; i < 40; i++) x.fillRect((i * 53) % c.width, 20 + ((i * 29) % 60), 6, 1);
  }

  titleActivate() {
    const it = this.titleItems[this.titleSel];
    if (it) it.act();
  }

  showTitle() { const el = $('title'); if (el) el.classList.remove('hide'); }
  hideTitle() { const el = $('title'); if (el) el.classList.add('hide'); this.closeAll(); }

  showEnding(e: { id: string; name: string; summary: string }) {
    this.game.state.time.paused = true;
    this.openOverlay('ov-generic');
    const g = $('gen-title'); if (g) g.textContent = t('ending.title');
    const body = $('gen-body'); if (!body) return;
    const s = this.game.state;
    body.innerHTML = `<div class="card parchment"><h4>${esc(e.name)}</h4><div style="line-height:1.6">${esc(t('ending.' + e.id + '.text'))}</div></div>
      <div class="card" style="margin-top:.6em"><h4>${esc(t('ending.summary'))}</h4>
      <div class="row"><span class="n">${esc(t('stat.daysPlayed'))}</span><span>${s.stats.daysPlayed}</span></div>
      <div class="row"><span class="n">${esc(t('stat.earned'))}</span><span>${Math.round(s.stats.earned)}</span></div>
      <div class="row"><span class="n">${esc(t('stat.killed'))}</span><span>${s.stats.killed}</span></div>
      <div class="row"><span class="n">${esc(t('stat.questsDone'))}</span><span>${s.stats.questsDone}</span></div>
      <div class="row"><span class="n">${esc(t('stat.crimesCommitted'))}</span><span>${s.stats.crimesCommitted}</span></div>
      <div class="row"><span class="n">${esc(t('ending.reputation'))}</span><span>${esc(e.summary)}</span></div></div>
      <div class="grid g2" style="margin-top:.6em"><button class="clickable" id="end-title">${esc(t('ending.toTitle'))}</button><button class="clickable" id="end-close">${esc(t('ending.continue'))}</button></div>`;
    $('end-title')!.onclick = () => { this.closeAll(); this.buildTitle(); this.showTitle(); this.game.started = false; };
    $('end-close')!.onclick = () => { this.closeOverlay(); };
  }

  refreshAll() {
    this.localizeStatic();
    this.buildTitle();
    this.updateBelt();
    if (this.overlay === 'ov-notes') this.openNotes();
    if (this.overlay === 'ov-skills') this.openSkills();
    if (this.overlay === 'ov-map') this.openMap();
    if (this.overlay === 'ov-inv') this.renderInventory();
    if (this.overlay === 'ov-journal') this.openJournal();
    if (this.overlay === 'ov-trade') this.renderTrade();
    if (this.overlay === 'ov-pause') this.renderPause();
    if (DialogueSystem.session) this.updateDialogue(DialogueSystem.session);
    this.hudCache = {};
    this.updateHud(0);
  }

  fatal(msg: string) {
    const el = $('title');
    if (el) { el.classList.remove('hide'); el.innerHTML = `<div class="tt">BŁĄD</div><div class="sub">${esc(msg)}</div><div class="fine">${esc(t('error.hint'))}</div>`; }
  }
}

export { FACTIONS };
