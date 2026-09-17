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
import { AudioSystem } from './systems/AudioSystem';
import { BuildingGenerator } from './world/BuildingGenerator';
import { VegetationSystem } from './world/Vegetation';
import { WeatherParticles } from './world/WeatherParticles';
import { TutorialSystem } from './ui/Tutorial';
import { GamblingUI } from './ui/GamblingUI';

// Loading
const loadingFill = document.getElementById('loading-fill')!;
const loadingText = document.getElementById('loading-text')!;
function setLoad(p:number, t:string){ loadingFill.style.width=p+'%'; loadingText.textContent=t; }
setLoad(5,'INICJALIZACJA SILNIKA ELENEM 1430...');

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1714);
scene.fog = new THREE.FogExp2(0x1a1714, 0.009);

const camera = new THREE.PerspectiveCamera(90, window.innerWidth/window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({canvas, antialias:true, powerPreference:'high-performance'});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.5));
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=0.9;

setLoad(15,'ŁADOWANIE ŚWIATA...');

// Lights
const sun = new THREE.DirectionalLight(0xffe8c0, 1.4);
sun.position.set(50,80,20);
sun.castShadow=true;
sun.shadow.mapSize.set(2048,2048);
sun.shadow.camera.near=0.5; sun.shadow.camera.far=600;
sun.shadow.camera.left=-150; sun.shadow.camera.right=150; sun.shadow.camera.top=150; sun.shadow.camera.bottom=-150;
sun.shadow.bias=-0.0003;
scene.add(sun);
const ambient = new THREE.AmbientLight(0x6a5a4a, 0.45);
scene.add(ambient);
const moon = new THREE.DirectionalLight(0x8a9ab0, 0.2);
moon.position.set(-50,60,-30);
scene.add(moon);
const hemi = new THREE.HemisphereLight(0x8a7a6a, 0x2a1a0a, 0.3);
scene.add(hemi);

setLoad(25,'GENEROWANIE TERENU I WIOSek...');

// Core managers
const input = new InputManager();
const world = new World(scene);
const vegetation = new VegetationSystem(scene);
const weatherParticles = new WeatherParticles(scene);
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
const audio = new AudioSystem();
const endings = new EndingSystem(()=>({debt:gameState.debt, crime:gameState.crime, reputation:gameState.reputation, transport, time:gameState.time}));

(gameState as any).transport = transport;
(gameState as any).smuggling = smuggling;

setLoad(40,'BUDYNKI I ARCHITEKTURA ŚREDNIOWIECZA...');
// Generate medieval villages
BuildingGenerator.createVillage(new THREE.Vector3(0,0,0), 8, scene); // port
BuildingGenerator.createVillage(new THREE.Vector3(60,-20,0), 12, scene); // miasto
BuildingGenerator.createVillage(new THREE.Vector3(180,0,0), 6, scene); // wsie
BuildingGenerator.createVillage(new THREE.Vector3(-100,-250,0), 5, scene); // obóz rycerzy
BuildingGenerator.create('church', new THREE.Vector3(0,0,250), scene);
BuildingGenerator.create('tavern', new THREE.Vector3(10,0,-10), scene);
BuildingGenerator.create('smith', new THREE.Vector3(70,0,-30), scene);
BuildingGenerator.create('warehouse', new THREE.Vector3(-30,0,10), scene);

setLoad(55,'SYSTEMY RDZENIOWE I EKONOMIA...');

// Tutorial
const tutorial = new TutorialSystem((step)=>{
  ui.toast(`📜 ${step.title}: ${step.text}`, 'info');
  const box=document.createElement('div');
  box.style.position='fixed'; box.style.bottom='140px'; box.style.left='50%'; box.style.transform='translateX(-50%)';
  box.style.background='rgba(20,18,16,0.96)'; box.style.border='1px solid #c9a86a'; box.style.padding='14px 18px'; box.style.maxWidth='560px'; box.style.zIndex='100';
  box.style.fontFamily='EB Garamond'; box.style.pointerEvents='auto';
  box.innerHTML=`<div style="font-family:Cinzel;color:#c9a86a;font-size:13px;margin-bottom:6px">${step.title}</div><div style="font-size:14px;line-height:1.5">${step.text}</div><button class="btn" style="margin-top:10px" id="tut-close">ROZUMIEM</button>`;
  document.body.appendChild(box);
  box.querySelector('#tut-close')?.addEventListener('click', ()=>box.remove());
  setTimeout(()=>{ if(box.parentNode) box.remove(); }, 8000);
});

// Interaction & Dialog
let interactTarget: THREE.Group | null = null;
let dialogOpen = false;
let lastInteractTime=0;

function tryInteract(){
  const now=performance.now();
  if(now-lastInteractTime<500) return;
  lastInteractTime=now;
  const dir = player.getLookDir();
  const origin = player.position.clone().add(new THREE.Vector3(0,1.5,0));
  const hit = world.raycastInteract(origin, dir);
  if(hit){
    interactTarget=hit;
    openDialog(hit.userData.name, hit.userData.id);
    audio.playSFX('door');
    tutorial.trigger('firstTalk');
  } else {
    // check for building interaction (crafting, bed, etc)
    if(world.getLocationAt(player.position.x, player.position.z).includes('Karczma') || world.getLocationAt(player.position.x, player.position.z).includes('Port')){
      if(Math.random()>0.5){
        ui.toast('Naciśnij E przy łóżku by spać (przyspiesza czas, koszt 5 koron) lub przy warsztacie by wytwarzać.', 'info');
      }
    }
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
  speaker.textContent=`${name.toUpperCase()} • Reputacja: ${FACTION_LABEL(id)} • ${npcSchedule.getActivity(id, Math.floor(gameState.time.hour)).activity}`;
  text.textContent=getGreeting(id);
  opts.innerHTML='';
  getDialogOptions(id).forEach(o=>{
    const btn=document.createElement('button');
    btn.className='dialog-opt'+(o.locked?' locked':'');
    btn.innerHTML=`${o.text} ${o.req?`<span class="req">[${o.req}]</span>`:''}`;
    if(!o.locked){
      btn.addEventListener('click', ()=>{
        handleDialogChoice(o, id);
        closeDialog();
      });
    }
    opts.appendChild(btn);
  });
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
  if(id.includes('przemy')) return 'Przemytnicy z Portu';
  if(id.includes('kup')) return 'Gildia Kupiecka';
  if(id.includes('zielarka')) return 'Kościół / Zielarze';
  if(id.includes('sołtys')) return 'Wieśniacy';
  return 'Mieszkaniec';
}
function getGreeting(id:string){
  const greetings:Record<string,string[]>={
    'strażnik_portu':[
      'No, patrzcie, świeże mięso z kontynentu. John, tak? Słyszałem, że jesteś winien Rycerzom kupę złota. Nie chciałbym być na twoim miejscu. Masz przepustkę?',
      'Stój! Dokumenty! Port zamknięty dla szumowin bez przepustki. Ostatnio przemyt soli, rozumiesz.',
      'Dzwon bił 8 razy. Zmiana warty. Jeśli chcesz przejść, to albo papier, albo 50 koron. Wybieraj.',
      'Widziałem cię wczoraj przy beczkach. Coś ukrywasz? Lepiej nie zadzieraj ze Strażą, John.'
    ],
    'kupiec':[
      'Czego chcesz? Mam sól, zboże, żelazo. Ceny zależą od dnia i twojej reputacji. Dziś sól droższa — blokada portu.',
      'Elenem to nie miejsce dla biedaków. Masz korony, masz towar. Nie masz — wypad.',
      'Słyszałem, że w ruinach opactwa jest relikwia. 300 koron na czarnym rynku. Ale Kościół...',
      'Mój kuzyn zaginął w bagnach. Wilki. Jeśli go znajdziesz, zapłacę. Sprawdź tablicę ogłoszeń [J].'
    ],
    'zielarka':[
      'Przyszedłeś po zioła? Bagna dziś niebezpieczne, mgła gęsta. Ale zaraza... zaraza to okazja. Cena ziół x3.',
      'Twoje rany śmierdzą. Potrzebujesz bandaża i łaźni. Brudny i śmierdzący dostaniesz gorsze ceny w lepszych dzielnicach.',
      'Grzyby — uważaj. Pomyłka może zabić. Kompendium [K] pomaga. Albo porozmawiaj ze mną, nauczę cię zielarstwa za 80 koron.',
      'Mam miksturę leczniczą. 30 koron. Albo zrób sam: zioła x3 + woda, warsztat alchemiczny, poziom alchemii 3.'
    ],
    'przemytnik':[
      'Cicho. Straż celna ma dziś przeszukania. Masz towar? Ukryj w wozie, w beczkach. Fałszywe dokumenty 100 koron.',
      'John! Słyszałem o twoim długu. Mogę pomóc... za cenę. Przemyt broni — 120 koron sztuka, ale ryzyko wysokie.',
      'Wiesz, że w klifach jest jaskinia? Tylko łodzią. Tam trzymamy kontrabandę. Potrzebujesz łodzi — porozmawiaj z rybakiem.',
      'Ostatnio obława straży w porcie. Jeśli masz coś przy sobie, lepiej wrzuć do skrytki w magazynie [własność].'
    ],
    'sołtys':[
      'Wilki z bagien zabijają bydło. 3 wilki, przynieś skóry, zapłacę 120 koron. I reputacja u nas +10.',
      'Kościół mówi o klątwie w ruinach. Ale ja mówię o głodzie. Zboże drożeje. Pomóż nam.',
      'Widziałem Dzikich Rycerzy wczoraj. Szukali cię, John. Mają listę dłużników. Ostatnie 5 dni to będzie piekło.'
    ],
    'opat':[
      'Zaginiona relikwia św. Elenema... w ruinach opactwa. Znajdź ją, a Kościół pomoże ci z długiem. 400 koron i błogosławieństwo.',
      'Magia? Zabobon. Ale ludzie wierzą. Plotki roznoszą się z opóźnieniem — świadek musi dotrzeć do miasta.',
      'Spowiedź? John, twoja przeszłość... pamiętasz pożar w 1428? Nie? To może lepiej.'
    ],
  };
  const arr=greetings[id]||['Co chcesz?','Nie mam czasu. Zarabiam na chleb.','Uważaj na siebie, John. Elenem nie wybacza.'];
  return arr[Math.floor(Math.random()*arr.length)];
}
function getDialogOptions(id:string){
  const opts:any[]=[
    {text:'Mam przepustkę, proszę.', req:null, locked:false, action:()=>{gameState.reputation.add('cityGuard',2); ui.toast('Strażnik: Dobrze, przechodź. Ale uważaj na Rycerzy.','success');}},
    {text:'Ile za łapówkę?', req:null, locked:false, action:()=>{if(gameState.gold>=50){gameState.gold-=50; gameState.crime.bribe(50); audio.playSFX('coin'); ui.toast('Przekupiono strażnika za 50 koron','warning');} else ui.toast('Brak 50 koron','error');}},
    {text:'[Perswazja 4] Daj spokój, jestem swój.', req:'Perswazja 4', locked:gameState.player.getSkill('persuasion')<4, action:()=>{gameState.reputation.add('cityGuard',5); ui.toast('Perswazja udana! Przepuszczam, ale jesteś mi winien przysługę.','success');}},
    {text:'[Kłamstwo 2] Oczywiście, zaraz pokażę...', req:'Kłamstwo 2', locked:gameState.player.getSkill('lying')<2, action:()=>{gameState.rumor.addRumor('John kłamał strażnikowi w porcie', gameState.time.day); ui.toast('Kłamstwo może zostać zweryfikowane później. Strażnik patrzy podejrzliwie.','warning');}},
    {text:'[Zastraszanie 3] Zmiataj mi z drogi.', req:'Zastraszanie 3', locked:gameState.player.getSkill('intimidation')<3, action:()=>{gameState.reputation.add('cityGuard',-10); gameState.rumor.addRumor('John zastraszył strażnika w porcie', gameState.time.day); ui.toast('Zastraszanie... Strażnik się cofa, ale zapamięta.','error');}},
    {text:'[Handel 2] Jakie masz ceny?', req:'Handel 2', locked:gameState.player.getSkill('barter')<2, action:()=>{ui.toast(`Ceny: sól ${gameState.economy.getPrice('sól')}, zboże ${gameState.economy.getPrice('zboże')}, żelazo ${gameState.economy.getPrice('żelazo')} - zależne od podaży/popytu i pogody`,'info');}},
    {text:'Gdzie mogę zarobić?', req:null, locked:false, action:()=>{ui.toast('Sprawdź tablicę ogłoszeń [J] - zlecenia proceduralne. Mniej opłacalne niż fabularne, ale bezpieczne. Albo polowania [tropienie], rybołówstwo, rzemiosło.','info');}},
    {text:'Opowiedz o wyspie.', req:null, locked:false, action:()=>{ui.toast('Elenem: port, miasto, wsie, lasy, bagna, kamieniołom, klify, ruiny opactwa, obóz Rycerzy. Stopniowe odblokowywanie — przepustka, łapówka, łódź, koń, klucz.','info');}},
  ];
  if(id.includes('przemy')){
    opts.push({text:'[Przemyt] Mam kontrabandę.', req:'Kontrabanda', locked:!gameState.player.hasItem('relikwie')&&!gameState.player.hasItem('broń'), action:()=>{const ok=smuggling.attemptSmuggle(gameState.crime.wantedLevel); audio.playSFX('coin'); ui.toast(ok?'Przemyt udany! +300 koron':'Wpadka! Straż znalazła towar!','warning'); if(ok){gameState.gold+=300; gameState.reputation.add('smugglers',10);} else {gameState.crime.commit('smuggling',{witnesses:2,location:'Port'});}}});
    opts.push({text:'Potrzebuję fałszywych dokumentów (100 koron)', req:null, locked:false, action:()=>{if(gameState.gold>=100){gameState.gold-=100; smuggling.hasFalseDocs=true; ui.toast('Fałszywe dokumenty kupione. -30% ryzyka przeszukania.','success');} else ui.toast('Brak 100 koron','error');}});
  }
  if(id.includes('kup')){
    opts.push({text:'Kup sól (12 koron)', req:null, locked:false, action:()=>{if(gameState.gold>=gameState.economy.getPrice('sól')){gameState.gold-=gameState.economy.getPrice('sól'); gameState.player.addItem('sól',1); gameState.economy.buy('sól',1,'kupiec_portowy'); ui.toast('Kupiono sól','success');} else ui.toast('Brak koron','error');}});
    opts.push({text:'Sprzedaj skórę (25 koron)', req:null, locked:false, action:()=>{if(gameState.player.hasItem('skóra')){gameState.player.removeItem('skóra',1); gameState.gold+=gameState.economy.getPrice('skóra')*0.7; gameState.economy.sell('skóra',1,'kupiec_portowy'); ui.toast('Sprzedano skórę','success');} else ui.toast('Brak skóry','error');}});
  }
  if(id.includes('zielarka')){
    opts.push({text:'Kup bandaż (15 koron)', req:null, locked:false, action:()=>{if(gameState.gold>=15){gameState.gold-=15; gameState.player.addItem('bandaż',1); ui.toast('Kupiono bandaż','success');} else ui.toast('Brak koron','error');}});
    opts.push({text:'Naucz mnie alchemii (80 koron, wymaga rep Kościół 10)', req:'Alchemia + Kościół 10', locked:gameState.gold<80 || gameState.reputation.get('church')<10, action:()=>{gameState.gold-=80; gameState.player.addSkillPoint('alchemy'); ui.toast('Nauczono alchemii! +1 poziom','success');}});
  }
  if(id.includes('sołtys')){
    opts.push({text:'Przyjmuję zlecenie na wilki', req:null, locked:false, action:()=>{questSystem.generateProcedural('Bagna'); ui.toast('Zlecenie: Wilki z bagien — zabij 3 wilki, przynieś skóry. 120 koron + rep Wieśniacy','info');}});
  }
  return opts;
}
function handleDialogChoice(o:any, npcId:string){
  if(o.action) o.action();
  // rumor
  if(Math.random()>0.7){
    gameState.rumor.addRumor(`John rozmawiał z ${npcId} w ${world.getLocationAt(player.position.x, player.position.z)}`, gameState.time.day);
  }
  ui.updateHUD();
}

// Gambling UI integration
let gamblingActive=false;
function openGambling(){
  const overlay=document.getElementById('overlay-journal')!;
  // inject gambling into journal or separate? Use journal board area
  const board=document.getElementById('board-jobs')!;
  const gamblingDiv=document.createElement('div');
  gamblingDiv.id='gambling-ui';
  gamblingDiv.className='card';
  gamblingDiv.style.gridColumn='1 / -1';
  board.parentElement?.insertBefore(gamblingDiv, board);
  const gUI=new GamblingUI(gamblingDiv);
  gUI.renderDice(20, (cheat)=>{
    const skill=gameState.player.getSkill('stealth_move');
    const result=gambling.playDice(20, cheat?skill:0);
    const d1=Math.floor(Math.random()*6)+1;
    const d2=Math.floor(Math.random()*6)+1;
    const sum=d1+d2;
    const win = cheat? true : sum>=8;
    if(result.caught){
      gameState.reputation.add('villagers',-10);
      gameState.crime.commit('theft',{witnesses:1,location:'Karczma'});
      gameState.needs.health=Math.max(0, gameState.needs.health-10);
      ui.toast('Przyłapano na oszustwie! Pobito i wyrzucono. -10 zdrowia, -10 rep','error');
    } else {
      if(win){ gameState.gold+=result.payout>0?result.payout:40; } else { gameState.gold+=result.payout; }
      audio.playSFX('coin');
    }
    gUI.showResult(d1,d2,win,result.caught,result.payout);
    ui.updateHUD();
  });
  gamblingActive=true;
}

// Event listeners
eventBus.on('devCommand', (cmd:string)=>{ debugConsole.exec(cmd); });
eventBus.on('plagueStart', ()=>{
  disease.infect('zaraza',80,gameState.time.day);
  gameState.economy.triggerEvent('zaraza');
  gameState.weather.plagueActive=true;
  audio.playSFX('door');
  ui.toast('ZARAZA W MIEŚCIE! Kwarantanna, rosnące ceny ziół, nowe questy, nowe okazje dla bezwzględnych.','error');
  // change fog color
  (scene.fog as THREE.FogExp2).color.setHex(0x3a3a2a);
});
eventBus.on('randomEvent', ()=>{
  const ev=worldEvents.rollDaily(gameState.time.day);
  if(ev) ui.toast(`WYDARZENIE: ${ev.desc} w ${ev.location}`,'warning');
});
eventBus.on('fovChanged', (fov:number)=>{ camera.fov=fov; camera.updateProjectionMatrix(); });

setLoad(75,'AUDIO, POGODA, CZĄSTECZKI...');

// Minimap canvas
const minimapCanvas=document.createElement('canvas');
minimapCanvas.width=140; minimapCanvas.height=140;
minimapCanvas.style.position='fixed'; minimapCanvas.style.bottom='110px'; minimapCanvas.style.right='18px';
minimapCanvas.style.border='1px solid #4a3f35'; minimapCanvas.style.background='rgba(0,0,0,0.6)'; minimapCanvas.style.zIndex='5';
minimapCanvas.style.pointerEvents='none';
document.getElementById('ui-root')?.appendChild(minimapCanvas);
const minimapCtx=minimapCanvas.getContext('2d')!;

function drawMinimap(){
  const ctx=minimapCtx;
  ctx.clearRect(0,0,140,140);
  ctx.fillStyle='#1a1714'; ctx.fillRect(0,0,140,140);
  // draw biomes simplified
  const locs=[
    {x:70,y:70,c:'#8a6d4b',r:12},
    {x:85,y:60,c:'#5a4a3a',r:14},
    {x:30,y:80,c:'#2a3a2a',r:16},
    {x:100,y:100,c:'#1a2a1a',r:18},
    {x:20,y:30,c:'#4a4a4a',r:10},
    {x:115,y:35,c:'#6a6a6a',r:10},
    {x:70,y:115,c:'#3a332c',r:10},
    {x:50,y:15,c:'#6b2a2a',r:12},
  ];
  locs.forEach(l=>{ ctx.fillStyle=l.c; ctx.beginPath(); ctx.arc(l.x,l.y,l.r,0,Math.PI*2); ctx.fill(); });
  // player
  const px = 70 + player.position.x/8;
  const pz = 70 + player.position.z/8;
  ctx.fillStyle='#c9a86a'; ctx.beginPath(); ctx.arc(Math.max(5,Math.min(135,px)), Math.max(5,Math.min(135,pz)), 3,0,Math.PI*2); ctx.fill();
  // north
  ctx.fillStyle='#8a6d4b'; ctx.font='10px Cinzel'; ctx.fillText('N', 65,10);
}

setLoad(90,'FINALIZACJA I TUTORIAL...');

// Game loop
let lastTime=performance.now();
let fps=60, frameCount=0, lastFpsTime=performance.now();
let weatherTimer=0;
let dayCheckHour=-1;

function loop(){
  const now=performance.now();
  const dt=Math.min(0.05, (now-lastTime)/1000);
  lastTime=now;

  frameCount++;
  if(now-lastFpsTime>1000){ fps=frameCount; frameCount=0; lastFpsTime=now; document.getElementById('hud-fps')!.textContent=fps+' FPS'; }

  if(!debugConsole.isOpen() && !dialogOpen){
    if(input.justPressed('map')) ui.toggle('map');
    if(input.justPressed('skills')) ui.toggle('skills');
    if(input.justPressed('compendium')) ui.toggle('compendium');
    if(input.justPressed('inventory')) ui.toggle('inventory');
    if(input.justPressed('journal')){ ui.toggle('journal'); setTimeout(()=>{ if(!gamblingActive) openGambling(); }, 100); }
    if(input.justPressed('clock')) ui.toggle('clock');
    if(input.justPressed('pause') || input.justPressed('quickmenu')) ui.toggle('menu');
    if(input.justPressed('interact')) tryInteract();
    if(input.justPressed('quicksave')){ if(!gameState.hardcore){ SaveSystem.save('quicksave'); ui.toast('Szybki zapis [F5]','success'); } else ui.toast('Hardcore: szybki zapis wyłączony','error'); }
    if(input.justPressed('quickload')){ if(!gameState.hardcore && SaveSystem.load('quicksave')){ ui.toast('Szybkie wczytanie [F9]','success'); } else ui.toast('Brak zapisu lub tryb Hardcore','error'); }
    if(input.justPressed('torch')){
      gameState.player.equipment.torch=!gameState.player.equipment.torch;
      audio.playSFX('door');
      ui.toast(gameState.player.equipment.torch?'Pochodnia zapalona [R] — światło i ciepło, ale widać cię z daleka':'Pochodnia zgaszona — ukrycie w cieniu, ale ciemno','info');
      tutorial.trigger('crouch');
    }
    if(input.isDown('attack') && !ui.isAnyOpen()){
      const atk=combat.attack('left','sword');
      if(atk){
        gameState.player.useSkill('sword',1);
        audio.playSFX('sword');
        // simple hit detection
        const dir=player.getLookDir();
        const origin=player.position.clone().add(new THREE.Vector3(0,1.5,0));
        const hit=world.raycastInteract(origin, dir);
        if(hit){
          ui.toast(`Trafienie! ${Math.round(atk.damage)} dmg — ${hit.userData.name}`, 'warning');
          gameState.crime.commit('assault',{witnesses:1,location:world.getLocationAt(player.position.x, player.position.z)});
          tutorial.trigger('firstFight');
        }
      }
    }
    if(input.isDown('block')) combat.startBlock(); else combat.stopBlock();
    if(input.justPressed('grab')){
      ui.toast('[F] Chwyt/przeciąganie ciał i obiektów — ukryj ciało by uniknąć plotek','info');
    }
  }

  if(input.justPressed('pause')){
    if(dialogOpen) closeDialog();
    else if(debugConsole.isOpen()) debugConsole.close();
  }

  // debug console toggle via keydown listener (once)
  if(! (window as any)._debugListener){
    (window as any)._debugListener=true;
    window.addEventListener('keydown', (e)=>{
      if(e.code==='Backquote'){ debugConsole.toggle(); e.preventDefault(); }
    });
  }

  if(!gameState.time.paused){
    gameState.time.tick(dt);
    combat.tick(dt);
    gameState.injury.tick(dt);
    weatherTimer+=dt;
    if(weatherTimer>5){
      weatherTimer=0;
      weatherParticles.setWeather(gameState.weather.current, player.position);
    }
    stealth.isCrouching=player.isCrouching;
    stealth.update(player.position, world.lights, input.isDown('forward')||input.isDown('back')||input.isDown('left')||input.isDown('right'), 'grass');
    world.update(player.position);

    const currentHour=Math.floor(gameState.time.hour);
    if(currentHour!==dayCheckHour && currentHour===8){
      dayCheckHour=currentHour;
      const ev=worldEvents.rollDaily(gameState.time.day);
      if(ev) ui.toast(`LOSOWE WYDARZENIE: ${ev.desc} w ${ev.location}`, 'warning');
      worldEvents.clearOld(gameState.time.day);
      const cost=companions.dailyCost()+property.weeklyCost()/7;
      if(cost>0){ gameState.gold=Math.max(0,gameState.gold-cost); if(cost>0) ui.toast(`Koszty dzienne: najemnicy + podatki = ${cost} koron`,'info'); }
      gameState.rumor.tick(gameState.time.day, gameState.time.hour);
      disease.tick(gameState.time.day);
      SaveSystem.save('autosave');
      // economy daily
      // tutorial triggers
      if(gameState.time.day===2) tutorial.trigger('day2');
      if(gameState.time.day===25) tutorial.trigger('day25');
      // ending check
      const unlocked=endings.check();
      if(unlocked.length>0 && gameState.time.day>=28){
        if(! (window as any)._endingShown){
          (window as any)._endingShown=true;
          ui.toast(`ODKRYTO ZAKOŃCZENIE: ${unlocked[0].name} — ${unlocked[0].desc}`, 'success');
          // show epilog button
          const epilogBtn=document.createElement('button');
          epilogBtn.className='btn primary';
          epilogBtn.textContent=`ZAKOŃCZENIE: ${unlocked[0].name} — ZOBACZ EPILOG`;
          epilogBtn.style.position='fixed'; epilogBtn.style.top='50%'; epilogBtn.style.left='50%'; epilogBtn.style.transform='translate(-50%,-50%)';
          epilogBtn.style.zIndex='200'; epilogBtn.style.padding='20px 30px'; epilogBtn.style.fontSize='16px';
          epilogBtn.onclick=()=>{
            alert(`EPILOG: ${unlocked[0].name}\n\n${unlocked[0].desc}\n\nLosy wyspy zależą od twoich wyborów. Frakcje: ${gameState.reputation.all().map(f=>`${f.name} ${f.rep}`).join(', ')}\n\nDziękujemy za grę w prototyp Elenem!`);
            epilogBtn.remove();
          };
          document.body.appendChild(epilogBtn);
        }
      }
    }
    if(currentHour!==8) dayCheckHour=-1;

    const loc=world.getLocationAt(player.position.x, player.position.z);
    document.getElementById('hud-location')!.textContent=loc;

    // audio intensity based on wanted and days left
    const intensity = Math.min(1, gameState.crime.wantedLevel/100*0.6 + (gameState.time.isLastFiveDays()?0.4:0));
    audio.playMusicIntensity(intensity);
  }

  player.update(dt);
  ui.updateHUD();
  drawMinimap();

  const dayProgress=gameState.time.getDayProgress();
  const sunAngle=dayProgress*Math.PI*2 - Math.PI/2;
  sun.position.set(Math.cos(sunAngle)*120, Math.sin(sunAngle)*100+20, 20);
  sun.intensity=gameState.time.isNight()?0.15:1.4;
  ambient.intensity=gameState.time.isNight()?0.12:0.45;
  moon.intensity=gameState.time.isNight()?0.35:0.05;

  const weatherColors:Record<string,number>={clear:0x8a7a6a,fog:0x5a5a5a,rain:0x3a3a4a,storm:0x1a1a2a,snow:0xccccdd};
  const fogColor=weatherColors[gameState.weather.current]||0x1a1714;
  (scene.fog as THREE.FogExp2).color.setHex(fogColor);
  (scene.background as THREE.Color).setHex(fogColor);

  renderer.render(scene,camera);
  requestAnimationFrame(loop);
}

setLoad(100,'GOTOWE — WITAJ W ELENEM 1430');
setTimeout(()=>{
  document.getElementById('loading')!.style.opacity='0';
  setTimeout(()=>document.getElementById('loading')!.remove(),800);
  // init audio on first interaction
  const initAudioOnce=()=>{
    audio.init();
    audio.setWeather(gameState.weather.current);
    document.removeEventListener('click', initAudioOnce);
  };
  document.addEventListener('click', initAudioOnce);
  ui.toast('Witaj, John. 100 koron, 10 000 długu, 30 dni. Powodzenia.','info');
  ui.toast('WASD ruch, E interakcja, M mapa, I ekwipunek, G rozwój, K kompendium, J dziennik (hazard), T dług, ESC menu, ~ konsola','info');
  if(SaveSystem.hasSave('autosave')){
    ui.toast('Znaleziono autozapis. F9 aby wczytać, lub kontynuuj nową grę.','info');
  }
  tutorial.trigger('start');
  // random initial rumors
  gameState.rumor.addRumor('John przypłynął z kontynentu z długiem u Dzikich Rycerzy', 1, {delayHours:0, spread:0.5});
  gameState.rumor.addRumor('W ruinach opactwa widziano światła', 1, {delayHours:2, spread:0.3});
  loop();
}, 700);

window.addEventListener('resize', ()=>{
  camera.aspect=window.innerWidth/window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

canvas.addEventListener('contextmenu', e=>e.preventDefault());

(window as any).gameState=gameState;
(window as any).eventBus=eventBus;
(window as any).SaveSystem=SaveSystem;
(window as any).audio=audio;
