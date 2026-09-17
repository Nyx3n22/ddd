import * as THREE from 'three';
import { InputManager } from './core/InputManager';
import { gameState } from './core/GameState';
import { eventBus } from './core/EventBus';
import { World } from './world/World';
import { PlayerController } from './player/PlayerController';
import { UIManager } from './ui/UIManager';
import { DebugConsole } from './core/DebugConsole';
import { SaveSystem } from './core/SaveSystem';
import { QuestSystem } from './systems/QuestSystem';
import { WorldEventSystem } from './systems/WorldEvents';
import { SmugglingSystem, DiseaseSystem, NPCScheduleSystem, CompanionSystem, PropertySystem, TransportSystem, HuntingSystem, GamblingSystem, EndingSystem } from './systems/OtherSystems';
import { StealthSystem } from './systems/StealthSystem';
import { CombatSystem } from './systems/CombatSystem';

// Loading bar simulation
const loadingFill = document.getElementById('loading-fill')!;
const loadingText = document.getElementById('loading-text')!;
let loadProgress = 0;
function setLoad(p:number, text:string){
  loadProgress=p;
  loadingFill.style.width=p+'%';
  loadingText.textContent=text;
}
setLoad(10,'INICJALIZACJA SILNIKA...');

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1714);
scene.fog = new THREE.FogExp2(0x1a1714, 0.008);

const camera = new THREE.PerspectiveCamera(90, window.innerWidth/window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({canvas, antialias:true});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.outputColorSpace=THREE.SRGBColorSpace;

setLoad(30,'ŁADOWANIE ŚWIATA ELENEM...');

// Lighting - day/night cycle
const sun = new THREE.DirectionalLight(0xffe8c0, 1.2);
sun.position.set(50,80,20);
sun.castShadow=true;
sun.shadow.mapSize.set(2048,2048);
sun.shadow.camera.near=0.5; sun.shadow.camera.far=500;
sun.shadow.camera.left=-100; sun.shadow.camera.right=100; sun.shadow.camera.top=100; sun.shadow.camera.bottom=-100;
scene.add(sun);
const ambient = new THREE.AmbientLight(0x6a5a4a, 0.4);
scene.add(ambient);
const moon = new THREE.DirectionalLight(0x8a9ab0, 0.15);
moon.position.set(-50,60,-30);
scene.add(moon);

// Core managers
const input = new InputManager();
const world = new World(scene);
const player = new PlayerController(camera, input);
const ui = new UIManager(input);
const debugConsole = new DebugConsole();
const questSystem = new QuestSystem();
const worldEvents = new WorldEventSystem();
const smuggling = new SmugglingSystem();
const disease = new DiseaseSystem();
const npcSchedule = new NPCScheduleSystem();
const companions = new CompanionSystem();
const property = new PropertySystem();
const transport = new TransportSystem();
const hunting = new HuntingSystem();
const gambling = new GamblingSystem();
const stealth = new StealthSystem();
const combat = new CombatSystem();
const endings = new EndingSystem(()=>({debt:gameState.debt, crime:gameState.crime, reputation:gameState.reputation, transport, time:gameState.time}));

setLoad(60,'SYSTEMY RDZENIOWE...');

// Additional state for systems aggregation (for endings check)
(gameState as any).transport = transport;
(gameState as any).smuggling = smuggling;

setLoad(80,'NPC, EKONOMIA, POGODA...');

// Interaction & Dialog
let interactTarget: THREE.Group | null = null;
let dialogOpen = false;
function tryInteract(){
  const dir = player.getLookDir();
  const origin = player.position.clone().add(new THREE.Vector3(0,1.5,0));
  const hit = world.raycastInteract(origin, dir);
  if(hit){
    interactTarget=hit;
    openDialog(hit.userData.name, hit.userData.id);
  }
}
function openDialog(name:string, id:string){
  const box=document.getElementById('dialog-box')!;
  const speaker=document.getElementById('dialog-speaker')!;
  const text=document.getElementById('dialog-text')!;
  const opts=document.getElementById('dialog-options')!;
  box.classList.add('open');
  dialogOpen=true;
  gameState.time.paused=true;
  document.exitPointerLock();
  speaker.textContent=`${name.toUpperCase()} • Reputacja: ${FACTION_LABEL(id)}`;
  text.textContent=getGreeting(id);
  opts.innerHTML='';
  getDialogOptions(id).forEach(o=>{
    const btn=document.createElement('button');
    btn.className='dialog-opt'+(o.locked?' locked':'');
    btn.innerHTML=`${o.text} ${o.req?`<span class="req">[${o.req}]</span>`:''}`;
    if(!o.locked){
      btn.addEventListener('click', ()=>{
        handleDialogChoice(o);
        closeDialog();
      });
    }
    opts.appendChild(btn);
  });
  // add exit
  const exit=document.createElement('button');
  exit.className='dialog-opt'; exit.textContent='[ESC] Zakończ rozmowę';
  exit.addEventListener('click', closeDialog);
  opts.appendChild(exit);
}
function closeDialog(){
  document.getElementById('dialog-box')!.classList.remove('open');
  dialogOpen=false;
  gameState.time.paused=false;
}
function FACTION_LABEL(id:string){
  if(id.includes('straż')) return 'Straż Miejska';
  if(id.includes('przemy')) return 'Przemytnicy';
  if(id.includes('kup')) return 'Gildia Kupiecka';
  return 'Wieśniacy';
}
function getGreeting(id:string){
  const greetings:Record<string,string[]>={
    'strażnik_portu':['No, patrzcie, świeże mięso z kontynentu. John, tak? Słyszałem, że jesteś winien Rycerzom kupę złota. Nie chciałbym być na twoim miejscu. Masz przepustkę?','Stój! Dokumenty! Port zamknięty dla szumowin bez przepustki.'],
    'kupiec':['Czego chcesz? Mam sól, zboże, żelazo. Ceny zależą od dnia i twojej reputacji.','Elenem to nie miejsce dla biedaków. Masz korony, masz towar.'],
    'zielarka':['Przyszedłeś po zioła? Bagna dziś niebezpieczne, mgła gęsta. Ale zaraza... zaraza to okazja.','Twoje rany śmierdzą. Potrzebujesz bandaża i łaźni.'],
    'przemytnik':['Cicho. Straż celna ma dziś przeszukania. Masz towar?','John! Słyszałem o twoim długu. Mogę pomóc... za cenę.'],
  };
  const arr=greetings[id]||['Co chcesz?','Nie mam czasu.'];
  return arr[Math.floor(Math.random()*arr.length)];
}
function getDialogOptions(id:string){
  // simplified dynamic options based on skills/rep/items
  const opts=[
    {text:'Mam przepustkę, proszę.', req:null, locked:false, action:()=>{gameState.reputation.add('cityGuard',2);}},
    {text:'Ile za łapówkę?', req:null, locked:false, action:()=>{if(gameState.gold>=50){gameState.gold-=50; gameState.crime.bribe(50); ui.toast('Przekupiono strażnika za 50 koron','warning');}}},
    {text:'[Perswazja 4 - za niski poziom]', req:'Perswazja 4', locked:gameState.player.getSkill('persuasion')<4, action:()=>{gameState.reputation.add('cityGuard',5); ui.toast('Perswazja udana!','success');}},
    {text:'[Zastraszanie 3] Zmiataj mi z drogi.', req:'Zastraszanie 3', locked:gameState.player.getSkill('intimidation')<3, action:()=>{gameState.reputation.add('cityGuard',-10); gameState.rumor.addRumor('John zastraszył strażnika w porcie', gameState.time.day);}},
    {text:'[Handel 2] Jakie masz ceny?', req:'Handel 2', locked:gameState.player.getSkill('barter')<2, action:()=>{ui.toast('Ceny: sól 12, zboże 8, żelazo 40 - zależne od podaży/popytu','info');}},
    {text:'Gdzie mogę zarobić?', req:null, locked:false, action:()=>{ui.toast('Sprawdź tablicę ogłoszeń [J] - zlecenia proceduralne. Mniej opłacalne niż fabularne, ale bezpieczne.','info');}},
  ];
  if(id.includes('przemy')){
    opts.push({text:'[Przemyt] Mam kontrabandę.', req:'Kontrabanda', locked:!gameState.player.hasItem('relikwie')&&!gameState.player.hasItem('broń'), action:()=>{const ok=smuggling.attemptSmuggle(gameState.crime.wantedLevel); ui.toast(ok?'Przemyt udany! +300 koron':'Wpadka! Straż znalazła towar!','warning'); if(ok){gameState.gold+=300;} else {gameState.crime.commit('smuggling',{witnesses:2,location:'Port'});}}});
  }
  return opts;
}
function handleDialogChoice(o:any){
  if(o.action) o.action();
  ui.updateHUD();
}

// Event listeners
eventBus.on('devCommand', (cmd:string)=>{
  debugConsole.exec(cmd);
});
eventBus.on('plagueStart', ()=>{
  disease.infect('zaraza',80,gameState.time.day);
  gameState.economy.triggerEvent('zaraza');
  gameState.weather.plagueActive=true;
  ui.toast('ZARAZA W MIEŚCIE! Kwarantanna, rosnące ceny ziół, nowe questy, nowe okazje dla bezwzględnych.','error');
});
eventBus.on('randomEvent', ()=>{
  const ev=worldEvents.rollDaily(gameState.time.day);
  if(ev) ui.toast(`WYDARZENIE: ${ev.desc} w ${ev.location}`,'warning');
});
eventBus.on('fovChanged', (fov:number)=>{ camera.fov=fov; camera.updateProjectionMatrix(); });

setLoad(95,'FINALIZACJA...');

// Game loop
let lastTime=performance.now();
let fps=60, frameCount=0, lastFpsTime=performance.now();
let weatherTimer=0;

function loop(){
  const now=performance.now();
  const dt=Math.min(0.05, (now-lastTime)/1000);
  lastTime=now;

  // FPS counter
  frameCount++;
  if(now-lastFpsTime>1000){ fps=frameCount; frameCount=0; lastFpsTime=now; document.getElementById('hud-fps')!.textContent=fps+' FPS'; }

  // Input handling for UI toggles (only if not typing in debug console)
  if(!debugConsole.isOpen() && !dialogOpen){
    if(input.justPressed('map')) ui.toggle('map');
    if(input.justPressed('skills')) ui.toggle('skills');
    if(input.justPressed('compendium')) ui.toggle('compendium');
    if(input.justPressed('inventory')) ui.toggle('inventory');
    if(input.justPressed('journal')) ui.toggle('journal');
    if(input.justPressed('clock')) ui.toggle('clock');
    if(input.justPressed('pause') || input.justPressed('quickmenu')) ui.toggle('menu');
    if(input.justPressed('interact')) tryInteract();
    if(input.justPressed('quicksave')){ if(!gameState.hardcore){ SaveSystem.save('quicksave'); ui.toast('Szybki zapis [F5]','success'); } else ui.toast('Hardcore: szybki zapis wyłączony','error'); }
    if(input.justPressed('quickload')){ if(!gameState.hardcore && SaveSystem.load('quicksave')){ ui.toast('Szybkie wczytanie [F9]','success'); } else ui.toast('Brak zapisu lub tryb Hardcore','error'); }
    // torch
    if(input.justPressed('torch')){ gameState.player.equipment.torch=!gameState.player.equipment.torch; ui.toast(gameState.player.equipment.torch?'Pochodnia zapalona [R]':'Pochodnia zgaszona','info'); }
    // attack/block
    if(input.isDown('attack') && !ui.isAnyOpen()){
      const atk=combat.attack('left','sword');
      if(atk){ gameState.player.useSkill('sword',1); /* damage NPC if close */ }
    }
    if(input.isDown('block')) combat.startBlock(); else combat.stopBlock();
  }

  // ESC closes dialog or overlays
  if(input.justPressed('pause')){
    if(dialogOpen) closeDialog();
    else if(debugConsole.isOpen()) debugConsole.close();
  }

  // Toggle debug console with ~
  window.addEventListener('keydown', (e)=>{
    if(e.code==='Backquote'){ debugConsole.toggle(); }
  }, {once:false});

  // Update systems if not paused
  if(!gameState.time.paused){
    gameState.time.tick(dt);
    combat.tick(dt);
    gameState.injury.tick(dt);
    // weather
    weatherTimer+=dt;
    if(weatherTimer>30){ weatherTimer=0; /* weather changes handled by day */ }
    // stealth
    stealth.isCrouching=player.isCrouching;
    stealth.update(player.position, world.lights, input.isDown('forward')||input.isDown('back')||input.isDown('left')||input.isDown('right'), 'grass');
    // world
    world.update(player.position);
    // daily events check
    if(Math.floor(gameState.time.hour)===8 && Math.floor(gameState.time.minute)===0){
      const ev=worldEvents.rollDaily(gameState.time.day);
      if(ev) ui.toast(`LOSOWE WYDARZENIE: ${ev.desc}`, 'warning');
      worldEvents.clearOld(gameState.time.day);
      // daily costs
      const cost=companions.dailyCost()+property.weeklyCost()/7;
      if(cost>0){ gameState.gold=Math.max(0,gameState.gold-cost); }
      // economy update already via eventBus
      // rumor tick
      gameState.rumor.tick(gameState.time.day, gameState.time.hour);
      // disease
      disease.tick(gameState.time.day);
      // autosave
      SaveSystem.save('autosave');
    }

    // check endings
    const unlocked=endings.check();
    if(unlocked.length>0 && gameState.time.day>=29){
      // show ending hint
      if(! (window as any)._endingShown){
        (window as any)._endingShown=true;
        ui.toast(`ODKRYTO ZAKOŃCZENIE: ${unlocked[0].name} - ${unlocked[0].desc}`, 'success');
      }
    }

    // update location HUD
    const loc=world.getLocationAt(player.position.x, player.position.z);
    document.getElementById('hud-location')!.textContent=loc;
  }

  player.update(dt);
  ui.updateHUD();

  // Update sun position based on time
  const dayProgress=gameState.time.getDayProgress();
  const sunAngle=dayProgress*Math.PI*2 - Math.PI/2;
  sun.position.set(Math.cos(sunAngle)*100, Math.sin(sunAngle)*100+20, 20);
  sun.intensity=gameState.time.isNight()?0.2:1.2;
  ambient.intensity=gameState.time.isNight()?0.15:0.4;
  // fog color based on weather
  const weatherColors:Record<string,number>={clear:0x8a7a6a,fog:0x5a5a5a,rain:0x3a3a4a,storm:0x1a1a2a,snow:0xccccdd};
  const fogColor=weatherColors[gameState.weather.current]||0x1a1714;
  (scene.fog as THREE.FogExp2).color.setHex(fogColor);
  (scene.background as THREE.Color).setHex(fogColor);

  renderer.render(scene,camera);
  requestAnimationFrame(loop);
}

setLoad(100,'GOTOWE - WITAJ W ELENEM');
setTimeout(()=>{
  document.getElementById('loading')!.style.opacity='0';
  setTimeout(()=>document.getElementById('loading')!.remove(),800);
  ui.toast('Witaj, John. 100 koron, 10 000 długu, 30 dni. Powodzenia.','info');
  ui.toast('WASD ruch, E interakcja, M mapa, I ekwipunek, G rozwój, K kompendium, J dziennik, T dług, ESC menu, ~ konsola','info');
  // initial autosave
  if(SaveSystem.hasSave('autosave')){
    ui.toast('Znaleziono autozapis. F9 aby wczytać, lub kontynuuj nową grę.','info');
  }
  loop();
}, 600);

window.addEventListener('resize', ()=>{
  camera.aspect=window.innerWidth/window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Prevent context menu on right click (for block)
canvas.addEventListener('contextmenu', e=>e.preventDefault());

// Expose for debug
(window as any).gameState=gameState;
(window as any).eventBus=eventBus;
(window as any).SaveSystem=SaveSystem;
