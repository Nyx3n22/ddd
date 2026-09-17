import { gameState } from './GameState';
import { eventBus } from './EventBus';
import { SaveSystem } from './SaveSystem';

export class DebugConsole {
  private el:HTMLElement;
  private logEl:HTMLElement;
  private inputEl:HTMLInputElement;
  private history:string[] = [];
  private historyIdx = -1;
  constructor(){
    this.el = document.getElementById('debug-console')!;
    this.logEl = document.getElementById('debug-log')!;
    this.inputEl = document.getElementById('debug-input') as HTMLInputElement;
    this.inputEl.addEventListener('keydown', e=>{
      if(e.key==='Enter'){ this.exec(this.inputEl.value); this.inputEl.value=''; }
      if(e.key==='ArrowUp'){ if(this.historyIdx < this.history.length-1){ this.historyIdx++; this.inputEl.value=this.history[this.history.length-1-this.historyIdx]; } }
      if(e.key==='ArrowDown'){ if(this.historyIdx>0){ this.historyIdx--; this.inputEl.value=this.history[this.history.length-1-this.historyIdx]; } else { this.historyIdx=-1; this.inputEl.value=''; } }
    });
    this.log('Konsola deweloperska Elenem. Wpisz help.');
  }
  toggle(){ this.el.classList.toggle('open'); if(this.el.classList.contains('open')) this.inputEl.focus(); }
  open(){ this.el.classList.add('open'); this.inputEl.focus(); }
  close(){ this.el.classList.remove('open'); }
  isOpen(){ return this.el.classList.contains('open'); }
  log(msg:string){ const d=document.createElement('div'); d.textContent=`[${new Date().toLocaleTimeString()}] ${msg}`; this.logEl.appendChild(d); this.logEl.scrollTop=this.logEl.scrollHeight; console.log('[DEBUG]',msg); }

  exec(cmdRaw:string){
    const cmd = cmdRaw.trim(); if(!cmd) return;
    this.history.push(cmd); this.historyIdx=-1;
    this.log(`> ${cmd}`);
    const [name,...args] = cmd.split(' ');
    try{
      switch(name){
        case 'help': this.log('Komendy: help, teleport x y z, addgold N, setday N, setreputation faction value, spawn npc, weather [clear|rain|fog|storm|snow], plague, timeScale N, godmode, quest list, save, load, clear, reputation, event, heal, pos'); break;
        case 'addgold': { const n=parseInt(args[0])||0; gameState.gold+=n; this.log(`Dodano ${n} koron. Teraz: ${gameState.gold}`); eventBus.emit('goldChanged',gameState.gold); break; }
        case 'setday': { const d=parseInt(args[0])||1; gameState.time.day=d; gameState.time.updateSeason(); this.log(`Ustawiono dzień ${d}`); eventBus.emit('dayChanged',d); break; }
        case 'teleport': { const x=parseFloat(args[0])||0, y=parseFloat(args[1])||2, z=parseFloat(args[2])||0; eventBus.emit('teleport',{x,y,z}); this.log(`Teleport do ${x},${y},${z}`); break; }
        case 'weather': { const w=args[0]||'clear'; gameState.weather.set(w as any); this.log(`Pogoda: ${w}`); break; }
        case 'plague': { eventBus.emit('plagueStart'); this.log('Zaraza rozpoczęta! Miasto w kwarantannie.'); break; }
        case 'timeScale': { const s=parseFloat(args[0])||60; gameState.time.timeScale=s; this.log(`timeScale=${s}`); break; }
        case 'reputation': { gameState.reputation.debugMaxAll(); this.log('Reputacje max'); break; }
        case 'event': { eventBus.emit('randomEvent'); this.log('Wymuszono losowe zdarzenie'); break; }
        case 'heal': { gameState.needs.healAll(); gameState.injury.healAll(); this.log('Uleczono'); break; }
        case 'save': { SaveSystem.save('manual'); this.log('Zapisano manual'); break; }
        case 'load': { SaveSystem.load('manual'); this.log('Wczytano manual'); break; }
        case 'clear': { this.logEl.innerHTML=''; break; }
        case 'pos': { eventBus.emit('requestPos'); break; }
        default: this.log(`Nieznana komenda: ${name}. Wpisz help.`); 
      }
    }catch(e:any){ this.log(`Błąd: ${e.message}`); }
  }
}
