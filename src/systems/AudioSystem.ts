export class AudioSystem {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private ambientGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private windNode: AudioBufferSourceNode | null = null;
  private rainNode: GainNode | null = null;
  private bellInterval: any = null;
  enabled = true;

  init(){
    try{
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.masterGain = this.ctx.createGain(); this.masterGain.gain.value=0.7; this.masterGain.connect(this.ctx.destination);
      this.ambientGain = this.ctx.createGain(); this.ambientGain.gain.value=0.4; this.ambientGain.connect(this.masterGain);
      this.musicGain = this.ctx.createGain(); this.musicGain.gain.value=0.3; this.musicGain.connect(this.masterGain);
      this.sfxGain = this.ctx.createGain(); this.sfxGain.gain.value=0.8; this.sfxGain.connect(this.masterGain);
      this.createAmbient();
      this.startBell();
      console.log('AudioSystem initialized');
    }catch(e){ console.warn('Audio init failed',e); }
  }

  private createAmbient(){
    if(!this.ctx || !this.ambientGain) return;
    // wind noise via filtered white noise
    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for(let i=0;i<bufferSize;i++) data[i]=(Math.random()*2-1)*0.2;
    const source = this.ctx.createBufferSource(); source.buffer=buffer; source.loop=true;
    const filter = this.ctx.createBiquadFilter(); filter.type='lowpass'; filter.frequency.value=400;
    const gain = this.ctx.createGain(); gain.gain.value=0.15;
    source.connect(filter); filter.connect(gain); gain.connect(this.ambientGain);
    source.start();
    this.windNode=source;
    this.rainNode=gain;
  }

  setWeather(weather:string){
    if(!this.ctx || !this.rainNode) return;
    if(weather==='rain' || weather==='storm'){
      this.rainNode.gain.linearRampToValueAtTime(0.6, this.ctx.currentTime+1);
    } else if(weather==='fog'){
      this.rainNode.gain.linearRampToValueAtTime(0.1, this.ctx.currentTime+1);
    } else {
      this.rainNode.gain.linearRampToValueAtTime(0.15, this.ctx.currentTime+1);
    }
  }

  playSFX(type:'step'|'sword'|'parry'|'coin'|'door'|'potion'|'dice'){
    if(!this.ctx || !this.sfxGain || !this.enabled) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain); gain.connect(this.sfxGain);
    switch(type){
      case 'step': osc.frequency.value=80+Math.random()*40; gain.gain.value=0.15; osc.type='square'; break;
      case 'sword': osc.frequency.value=300+Math.random()*200; gain.gain.value=0.3; osc.type='sawtooth'; break;
      case 'parry': osc.frequency.value=600; gain.gain.value=0.4; osc.type='triangle'; break;
      case 'coin': osc.frequency.value=800; gain.gain.value=0.25; osc.type='sine'; break;
      case 'door': osc.frequency.value=120; gain.gain.value=0.3; osc.type='triangle'; break;
      default: osc.frequency.value=440; gain.gain.value=0.2;
    }
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime+0.3);
    osc.stop(this.ctx.currentTime+0.3);
  }

  playMusicIntensity(intensity:number){
    // intensity 0-1 based on days left and wanted level
    if(!this.musicGain || !this.ctx) return;
    this.musicGain.gain.linearRampToValueAtTime(0.2+intensity*0.5, this.ctx.currentTime+2);
  }

  private startBell(){
    // bell every game hour = real ~60s? For prototype every 30s
    this.bellInterval = setInterval(()=>{ this.playSFX('door'); }, 30000);
  }

  setMasterVolume(v:number){
    if(this.masterGain) this.masterGain.gain.value=v;
  }
}
