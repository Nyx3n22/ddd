import { bus } from './EventBus';
import { rng } from './RNG';
import { settings } from './Settings';

/* ============================================================================
   DŹWIĘK — syntezowany proceduralnie w WebAudio (brak plików w repozytorium).
   Warstwy: ambient (wiatr/deszcz/tłum), kroki zależne od podłoża, uderzenia
   stali, parowanie, dzwon miejski co godzinę, muzyka karczmy.
   ========================================================================== */

type Node = OscillatorNode | AudioBufferSourceNode;

export class AudioSystem {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private ambBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private windSrc: AudioBufferSourceNode | null = null;
  private windGain: GainNode | null = null;
  private rainSrc: AudioBufferSourceNode | null = null;
  private rainGain: GainNode | null = null;
  private crowdSrc: AudioBufferSourceNode | null = null;
  private crowdGain: GainNode | null = null;
  private musicTimer = 0;
  private musicStep = 0;
  enabled = true;
  started = false;

  init() {
    if (this.ctx) return;
    try {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = settings.data.masterVolume ?? 0.7;
      this.master.connect(this.ctx.destination);
      this.sfxBus = this.ctx.createGain(); this.sfxBus.gain.value = 0.9; this.sfxBus.connect(this.master);
      this.ambBus = this.ctx.createGain(); this.ambBus.gain.value = 0.5; this.ambBus.connect(this.master);
      this.musicBus = this.ctx.createGain(); this.musicBus.gain.value = 0.32; this.musicBus.connect(this.master);
      this.noiseBuf = this.makeNoise(2);
      this.started = true;
    } catch (e) { console.warn('[audio] niedostępne', e); this.enabled = false; }
  }

  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }

  setVolume(v: number) { if (this.master) this.master.gain.value = v; }

  private makeNoise(seconds: number): AudioBuffer {
    const ctx = this.ctx!;
    const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.6;
    return buf;
  }

  private loopNoise(gain: number, filterFreq: number, q = 0.8): { src: AudioBufferSourceNode; gain: GainNode } | null {
    if (!this.ctx || !this.noiseBuf || !this.ambBus) return null;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf; src.loop = true;
    const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = filterFreq; f.Q.value = q;
    const g = this.ctx.createGain(); g.gain.value = gain;
    src.connect(f); f.connect(g); g.connect(this.ambBus);
    src.start();
    return { src, gain: g };
  }

  /** Ustawienie warstwy ambientu pod pogodę i miejsce. */
  setAmbient(opts: { weather: string; intensity: number; wind: number; indoors: boolean; crowd: number; night: boolean }) {
    if (!this.ctx || !this.ambBus) return;
    if (!this.windSrc) { const r = this.loopNoise(0.0, 320, 0.6); if (r) { this.windSrc = r.src; this.windGain = r.gain; } }
    if (!this.rainSrc) { const r = this.loopNoise(0.0, 2600, 0.4); if (r) { this.rainSrc = r.src; this.rainGain = r.gain; } }
    if (!this.crowdSrc) { const r = this.loopNoise(0.0, 700, 1.4); if (r) { this.crowdSrc = r.src; this.crowdGain = r.gain; } }
    const windTarget = opts.indoors ? 0.02 : (opts.weather === 'storm' ? 0.16 : opts.weather === 'rain' ? 0.08 : 0.05) * (0.6 + Math.abs(opts.wind) * 0.6);
    const rainTarget = opts.indoors ? 0.03 : (opts.weather === 'rain' ? 0.10 : opts.weather === 'storm' ? 0.16 : 0) * (0.5 + opts.intensity);
    const crowdTarget = opts.indoors ? opts.crowd * 0.05 : opts.crowd * 0.02 * (opts.night ? 0.25 : 1);
    const ramp = (g: GainNode | null, v: number) => { if (g && this.ctx) g.gain.setTargetAtTime(v, this.ctx.currentTime, 0.7); };
    ramp(this.windGain, windTarget);
    ramp(this.rainGain, rainTarget);
    ramp(this.crowdGain, Math.min(0.09, crowdTarget));
  }

  private blip(freq: number, dur: number, type: OscillatorType, vol = 0.2, slideTo?: number, delay = 0) {
    if (!this.ctx || !this.sfxBus || !this.enabled) return;
    const t0 = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
    o.connect(g); g.connect(this.sfxBus);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }

  private noiseHit(dur: number, freq: number, vol = 0.25, q = 1) {
    if (!this.ctx || !this.sfxBus || !this.noiseBuf || !this.enabled) return;
    const t0 = this.ctx.currentTime;
    const src = this.ctx.createBufferSource(); src.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(this.sfxBus);
    src.start(t0); src.stop(t0 + dur + 0.02);
  }

  step(ground: string, sneaking: boolean) {
    const map: Record<string, [number, number]> = {
      mud: [180, 0.12], swamp: [140, 0.14], water: [900, 0.10], sand: [1400, 0.06],
      grass: [1800, 0.05], grassTall: [2400, 0.05], dirt: [700, 0.07], cobble: [1100, 0.09],
      road: [900, 0.08], stone: [1300, 0.10], gravel: [2200, 0.09], planks: [420, 0.11],
      ash: [800, 0.06], field: [1600, 0.05], floorWood: [380, 0.10], floorStone: [1200, 0.09], rug: [500, 0.04]
    };
    const [freq, vol] = map[ground] || [800, 0.07];
    this.noiseHit(sneaking ? 0.05 : 0.09, freq * (0.9 + Math.random() * 0.25), sneaking ? vol * 0.4 : vol, ground === 'planks' || ground === 'floorWood' ? 2.2 : 0.9);
  }

  swing() { this.noiseHit(0.14, 1600, 0.10, 0.7); this.blip(220, 0.08, 'sawtooth', 0.05, 120); }
  hit() { this.noiseHit(0.16, 320, 0.32, 1.2); this.blip(110, 0.12, 'square', 0.12, 60); }
  hitFlesh() { this.noiseHit(0.2, 220, 0.3, 0.9); this.blip(80, 0.16, 'sine', 0.14, 45); }
  parry() { this.blip(1200, 0.12, 'square', 0.16, 2200); this.noiseHit(0.1, 3200, 0.2, 3); }
  block() { this.noiseHit(0.12, 900, 0.22, 1.6); }
  dodge() { this.noiseHit(0.16, 700, 0.12, 0.6); }
  death() { this.blip(180, 0.6, 'sawtooth', 0.14, 60); this.noiseHit(0.4, 260, 0.2, 0.8); }
  coin(n = 1) { for (let i = 0; i < Math.min(4, n); i++) this.blip(1500 + i * 320, 0.09, 'triangle', 0.10, 2200, i * 0.045); }
  pickup() { this.blip(660, 0.07, 'triangle', 0.09, 880); }
  door() { this.noiseHit(0.3, 260, 0.16, 1.4); this.blip(90, 0.22, 'sine', 0.08, 70); }
  page() { this.noiseHit(0.09, 2600, 0.07, 0.8); }
  dice() { for (let i = 0; i < 3; i++) this.noiseHit(0.06, 1800 + i * 400, 0.10, 2.4); this.blip(900, 0.05, 'square', 0.05, 700, 0.12); }
  anvil() { this.blip(320, 0.35, 'square', 0.14, 240); this.noiseHit(0.25, 2400, 0.10, 3); }
  chime(hour: number) {
    const n = hour === 6 || hour === 12 || hour === 18 ? 3 : 1;
    for (let i = 0; i < n; i++) {
      this.blip(196, 1.6, 'sine', 0.16, 196, i * 0.55);
      this.blip(294, 1.2, 'sine', 0.08, 294, i * 0.55);
      this.blip(392, 0.9, 'sine', 0.05, 392, i * 0.55);
    }
  }
  dog() { this.blip(520, 0.16, 'sawtooth', 0.10, 300); this.blip(480, 0.2, 'sawtooth', 0.09, 260, 0.2); }
  wolf() { this.blip(300, 0.9, 'sawtooth', 0.10, 180); this.blip(220, 1.1, 'sine', 0.06, 150, 0.1); }
  thunder() { this.noiseHit(1.4, 90, 0.4, 0.5); this.blip(48, 1.6, 'sine', 0.22, 30); }
  ui() { this.blip(880, 0.04, 'square', 0.05, 660); }
  questDone() { [523, 659, 784].forEach((f, i) => this.blip(f, 0.28, 'triangle', 0.11, f, i * 0.12)); }
  levelUp() { [392, 523, 659, 784].forEach((f, i) => this.blip(f, 0.22, 'sine', 0.10, f, i * 0.08)); }
  error() { this.blip(160, 0.18, 'square', 0.10, 110); }

  /** Prosta muzyka karczemna: pętla na lutniopodobnych nutach. */
  updateMusic(dt: number, playing: boolean) {
    if (!this.ctx || !this.musicBus) return;
    this.musicTimer -= dt;
    if (!playing) { this.musicBus.gain.setTargetAtTime(0, this.ctx.currentTime, 0.5); return; }
    this.musicBus.gain.setTargetAtTime(0.3, this.ctx.currentTime, 0.8);
    if (this.musicTimer <= 0) {
      const scale = [220, 246.94, 293.66, 329.63, 349.23, 392, 440, 493.88];
      const pattern = [0, 2, 4, 2, 5, 4, 2, 0, 3, 2, 0, -1, 4, 5, 7, 5];
      const note = pattern[this.musicStep % pattern.length];
      this.musicStep++;
      this.musicTimer = 0.34;
      if (note >= 0) {
        const f = scale[note % scale.length] * (note >= scale.length ? 2 : 1);
        const t0 = this.ctx.currentTime;
        const o = this.ctx.createOscillator(); const g = this.ctx.createGain();
        o.type = 'triangle'; o.frequency.value = f;
        g.gain.setValueAtTime(0, t0);
        g.gain.linearRampToValueAtTime(0.16, t0 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.42);
        o.connect(g); g.connect(this.musicBus);
        o.start(t0); o.stop(t0 + 0.45);
        if (this.musicStep % 4 === 0) {
          const b = this.ctx.createOscillator(); const bg = this.ctx.createGain();
          b.type = 'sine'; b.frequency.value = f / 2;
          bg.gain.setValueAtTime(0, t0); bg.gain.linearRampToValueAtTime(0.12, t0 + 0.02);
          bg.gain.exponentialRampToValueAtTime(0.001, t0 + 0.6);
          b.connect(bg); bg.connect(this.musicBus); b.start(t0); b.stop(t0 + 0.62);
        }
      }
    }
  }

  bindEvents() {
    bus.on('player:step', (e: any) => this.step(e.ground, e.sneaking));
    bus.on('fx:swing', () => this.swing());
    bus.on('fx:hit', () => this.hit());
    bus.on('player:hit', () => this.hitFlesh());
    bus.on('combat:parried', () => this.parry());
    bus.on('combat:guardBroken', () => this.block());
    bus.on('player:dodge', () => this.dodge());
    bus.on('player:died', () => this.death());
    bus.on('hud:gold', (e: any) => this.coin(Math.max(1, Math.round(Math.abs(e.amount) / 10))));
    bus.on('inventory:changed', () => this.pickup());
    bus.on('world:sceneChanged', () => this.door());
    bus.on('ui:page', () => this.page());
    bus.on('gamble:resolved', () => this.dice());
    bus.on('craft:done', () => this.anvil());
    bus.on('hourChime', (e: any) => this.chime(e.hour));
    bus.on('skill:levelUp', () => this.levelUp());
    bus.on('quest:completed', () => this.questDone());
    bus.on('hud:toast', (e: any) => { if (e.tone === 'bad') this.error(); });
    bus.on('weather:changed', (e: any) => { if (e.kind === 'storm') setTimeout(() => this.thunder(), 800); });
    bus.on('sfx:dog', () => this.dog());
    bus.on('sfx:wolf', () => this.wolf());
    bus.on('sfx:thunder', () => this.thunder());
  }
}

export const audio = new AudioSystem();
export { rng };
