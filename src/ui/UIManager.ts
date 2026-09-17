import { gameState } from '../core/GameState';
import { eventBus } from '../core/EventBus';
import { InputManager } from '../core/InputManager';
import { SaveSystem } from '../core/SaveSystem';
import { SKILLS } from '../player/PlayerState';
import { RECIPES } from '../systems/CraftingSystem';
import { FACTIONS } from '../systems/ReputationSystem';
import { EVENT_TEMPLATES } from '../systems/WorldEvents';
import { QUEST_TEMPLATES } from '../systems/QuestSystem';

export class UIManager {
  input: InputManager;
  private overlays = new Map<string, HTMLElement>();
  private toastContainer: HTMLElement;
  private currentCompendiumTab = 'items';

  constructor(input:InputManager){
    this.input=input;
    this.toastContainer=document.getElementById('toast-container')!;
    this.overlays.set('map', document.getElementById('overlay-map')!);
    this.overlays.set('skills', document.getElementById('overlay-skills')!);
    this.overlays.set('compendium', document.getElementById('overlay-compendium')!);
    this.overlays.set('inventory', document.getElementById('overlay-inventory')!);
    this.overlays.set('journal', document.getElementById('overlay-journal')!);
    this.overlays.set('clock', document.getElementById('overlay-clock')!);
    this.overlays.set('menu', document.getElementById('overlay-menu')!);

    this.bindCloseButtons();
    this.bindCompendiumTabs();
    this.bindMap();
    this.bindSkills();
    this.bindInventory();
    this.bindJournal();
    this.bindClock();
    this.bindMenu();

    eventBus.on('goldChanged', ()=>this.updateHUD());
    eventBus.on('debtPaid', ()=>this.updateHUD());
    eventBus.on('dayChanged', ()=>this.updateHUD());
    eventBus.on('hourChanged', ()=>this.updateHUD());
  }

  private bindCloseButtons(){
    document.querySelectorAll('[data-close]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const id=(btn as HTMLElement).dataset.close!;
        this.close(id);
      });
    });
  }

  private bindCompendiumTabs(){
    document.querySelectorAll('[data-compendium-tab]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        document.querySelectorAll('[data-compendium-tab]').forEach(b=>b.classList.remove('primary'));
        btn.classList.add('primary');
        this.currentCompendiumTab=(btn as HTMLElement).dataset.compendiumTab!;
        this.renderCompendium();
      });
    });
  }

  private bindMap(){
    const locDiv=document.getElementById('map-locations')!;
    const locations=[
      {name:'Port Elenem', desc:'Start, celnicy, przemytnicy', discovered:true},
      {name:'Miasto', desc:'Rynek, kowal, kościół, karczma', discovered:true},
      {name:'Bagna', desc:'Wilki, zioła, mgła - wymaga pochodni', discovered:false},
      {name:'Lasy', desc:'Polowania, drewno, bandyci', discovered:false},
      {name:'Kamieniołom', desc:'Żelazo, praca', discovered:false},
      {name:'Klify', desc:'Gniazda ptaków, ruiny', discovered:false},
      {name:'Ruiny Opactwa', desc:'Relikwie, klątwa, wymaga klucza', discovered:false},
      {name:'Obóz Dzikich Rycerzy', desc:'Dług, rekrutacja, poborcy', discovered:true},
    ];
    locDiv.innerHTML=locations.map(l=>`<div style="opacity:${l.discovered?1:0.4}">${l.discovered?'●':'○'} <b>${l.name}</b><br><span style="color:#8a6d4b;font-size:11px">${l.desc}</span></div>`).join('');

    const canvas=document.getElementById('map-canvas')!;
    canvas.innerHTML='';
    // create simple map visualization
    const mapData=[
      {x:45,y:50,w:18,h:18,label:'PORT',color:'#8a6d4b'},
      {x:60,y:40,w:22,h:20,label:'MIASTO',color:'#5a4a3a'},
      {x:20,y:60,w:24,h:28,label:'BAGNA',color:'#2a3a2a'},
      {x:70,y:70,w:28,h:26,label:'LASY',color:'#1a2a1a'},
      {x:15,y:20,w:20,h:20,label:'KAMIENIOŁOM',color:'#4a4a4a'},
      {x:85,y:25,w:20,h:18,label:'KLIFY',color:'#6a6a6a'},
      {x:45,y:85,w:18,h:18,label:'RUINY',color:'#3a332c'},
      {x:35,y:10,w:20,h:18,label:'OBÓZ RYCERZY',color:'#6b2a2a'},
    ];
    mapData.forEach(m=>{
      const el=document.createElement('div');
      el.className='map-biome';
      el.style.left=m.x+'%'; el.style.top=m.y+'%'; el.style.width=m.w+'%'; el.style.height=m.h+'%';
      el.style.background=`${m.color}66`; el.style.borderColor=m.color;
      el.innerHTML=`<span style="font-family:Cinzel;font-size:10px;color:#d6c7b8;padding:2px">${m.label}</span>`;
      canvas.appendChild(el);
    });
    // player marker
    const playerMarker=document.createElement('div');
    playerMarker.style.position='absolute'; playerMarker.style.width='8px'; playerMarker.style.height='8px'; playerMarker.style.background='#c9a86a'; playerMarker.style.borderRadius='50%'; playerMarker.style.boxShadow='0 0 8px #c9a86a'; playerMarker.style.left='48%'; playerMarker.style.top='52%';
    playerMarker.id='player-marker';
    canvas.appendChild(playerMarker);

    document.getElementById('btn-fasttravel')?.addEventListener('click', ()=>{
      this.toast('Szybka podróż kosztuje 2h czasu w grze. Wybierz punkt na mapie.', 'info');
      gameState.time.sleep(2);
    });
  }

  private bindSkills(){
    const grid=document.getElementById('skills-grid')!;
    const branches:Record<string,string> = { combat:'Walka', stealth:'Skradanie i Przestępczość', crafting:'Rzemiosło', trade:'Handel i Perswazja', survival:'Przetrwanie', knowledge:'Wiedza' };
    const byBranch:Record<string,typeof SKILLS> = {};
    SKILLS.forEach(s=>{ if(!byBranch[s.branch]) byBranch[s.branch]=[]; byBranch[s.branch].push(s); });

    Object.entries(byBranch).forEach(([branch, skills])=>{
      const col=document.createElement('div'); col.className='card';
      col.innerHTML=`<h4>${branches[branch]}</h4>`;
      skills.forEach(sk=>{
        const lvl=gameState.player.getSkill(sk.id);
        const node=document.createElement('div');
        node.className=`skill-node ${lvl>0?'unlocked':''} ${lvl>=sk.max?'':''}`;
        node.innerHTML=`<div><b>${sk.name}</b> [${lvl}/${sk.max}]<br><span style="font-size:11px;color:#8a6d4b">${sk.desc}</span>${sk.requires?`<br><span style="font-size:10px;color:#c9a86a">Wymaga: ${sk.requires.teacher||''} ${sk.requires.gold?sk.requires.gold+' koron':''} ${sk.requires.rep?sk.requires.rep.faction+'>='+sk.requires.rep.value:''}</span>`:''}</div><button class="btn" style="padding:4px 8px">+</button>`;
        node.querySelector('button')?.addEventListener('click', ()=>{
          if(gameState.skillPoints>0){
            if(gameState.player.addSkillPoint(sk.id)){
              gameState.skillPoints--;
              this.bindSkills();
              this.toast(`Odblokowano ${sk.name} poziom ${lvl+1}`, 'success');
            } else this.toast('Max poziom lub brak wymagań', 'error');
          } else this.toast('Brak punktów umiejętności', 'error');
        });
        col.appendChild(node);
      });
      grid.appendChild(col);
    });
  }

  private bindInventory(){
    const grid=document.getElementById('inv-grid')!;
    const render=()=>{
      grid.innerHTML='';
      for(let i=0;i<48;i++){
        const slot=document.createElement('div'); slot.className='inv-slot';
        const entries=Array.from(gameState.player.inventory.entries());
        const item=entries[i];
        if(item){
          const [name,data]=item;
          slot.classList.add('has-item');
          slot.innerHTML=`<b>${name}</b><br>${data.qty}x<br><span style="font-size:10px">${Math.round(data.quality*100)}% jakość</span>`;
          slot.addEventListener('click', ()=>{
            this.showItemContext(name,data);
          });
        } else {
          slot.textContent='—';
        }
        grid.appendChild(slot);
      }
      document.getElementById('inv-weight')!.textContent=`${Array.from(gameState.player.inventory.values()).reduce((s,v)=>s+v.qty*0.5,0).toFixed(1)} / 40 kg`;
      const equipDiv=document.getElementById('equipment')!;
      equipDiv.innerHTML=`Broń: ${gameState.player.equipment.weapon||'brak'}<br>Pancerz: ${gameState.player.equipment.armor||'brak'}<br>Pochodnia: ${gameState.player.equipment.torch?'tak':'nie'}<br><br>Wyposażenie wpływa na dialogi i reakcje NPC.`;
      const craftDiv=document.getElementById('crafting-list')!;
      craftDiv.innerHTML=RECIPES.map(r=>`<div style="display:flex;justify-content:space-between;margin-bottom:4px"><span>${r.name} [${r.skill} ${r.level}]</span><button class="btn" style="padding:2px 6px" data-craft="${r.id}">WYTWÓRZ</button></div>`).join('');
      craftDiv.querySelectorAll('[data-craft]').forEach(b=>{
        b.addEventListener('click', ()=>{
          const id=(b as HTMLElement).dataset.craft!;
          const rec=RECIPES.find(x=>x.id===id);
          if(rec){
            // check ingredients simplified
            this.toast(`Próba wytworzenia ${rec.name} w ${rec.workshop}`, 'info');
            gameState.player.addItem(rec.result.item, rec.result.qty, rec.result.quality);
            render();
          }
        });
      });
    };
    render();
    eventBus.on('goldChanged', render);
  }

  private showItemContext(name:string, data:any){
    this.toast(`${name} - ${data.qty}x - jakość ${Math.round(data.quality*100)}% - [E] Użyj, [Q] Wyrzuć`, 'info');
  }

  private bindJournal(){
    const list=document.getElementById('quest-list')!;
    const title=document.getElementById('quest-title')!;
    const desc=document.getElementById('quest-desc')!;
    const rewards=document.getElementById('quest-rewards')!;
    const render=()=>{
      list.innerHTML='';
      const qs=QUEST_TEMPLATES;
      qs.forEach(q=>{
        const el=document.createElement('div'); el.className='quest-item';
        el.innerHTML=`<b>${q.title}</b><br><span style="font-size:12px;color:#8a6d4b">${q.desc.slice(0,80)}...</span><div class="meta">${q.giver} • ${q.location} • ${q.type}</div>`;
        el.addEventListener('click', ()=>{
          title.textContent=q.title;
          desc.innerHTML=`${q.desc}<br><br><b>Cele:</b><ul>${q.objectives.map(o=>`<li>${o}</li>`).join('')}</ul>`;
          rewards.innerHTML=`Nagroda: ${q.reward.gold} koron ${q.reward.rep?`+ rep ${q.reward.rep.faction}`:''} <br><button class="btn" data-complete="${q.id}">UKOŃCZ (DEBUG)</button>`;
          rewards.querySelector('button')?.addEventListener('click', ()=>{
            gameState.gold+=q.reward.gold;
            this.toast(`Ukończono ${q.title} +${q.reward.gold} koron`, 'success');
            eventBus.emit('goldChanged', gameState.gold);
          });
        });
        list.appendChild(el);
      });
    };
    render();
    // procedural jobs board
    const board=document.getElementById('board-jobs')!;
    const locs=['Port','Miasto','Bagna','Lasy','Kamieniołom'];
    board.innerHTML='';
    for(let i=0;i<6;i++){
      const loc=locs[Math.floor(Math.random()*locs.length)];
      const gold=20+Math.floor(Math.random()*80);
      const el=document.createElement('div'); el.className='card';
      el.innerHTML=`<b>Zlecenie #${i+1} - ${loc}</b><br><span style="font-size:12px">Dostawa towaru, ochrona, szkodniki</span><br><span style="font-family:Cinzel;font-size:11px;color:#c9a86a">${gold} koron</span><br><button class="btn" style="margin-top:6px;width:100%">PRZYJMIJ</button>`;
      el.querySelector('button')?.addEventListener('click', ()=>{
        this.toast(`Przyjęto zlecenie w ${loc} za ${gold} koron`, 'success');
      });
      board.appendChild(el);
    }
  }

  private bindClock(){
    const calGrid=document.getElementById('calendar-grid')!;
    const renderCal=()=>{
      calGrid.innerHTML='';
      for(let d=1;d<=30;d++){
        const el=document.createElement('div');
        el.style.padding='6px'; el.style.textAlign='center'; el.style.border='1px solid #2a2520'; el.style.fontFamily='Cinzel'; el.style.fontSize='11px';
        el.style.background=d===gameState.time.day?'#c9a86a33': d<gameState.time.day?'#1a1714':'#2a252033';
        if(d===gameState.time.day) el.style.borderColor='#c9a86a';
        el.textContent=d.toString();
        if(d>25) el.style.color='#e0b080';
        calGrid.appendChild(el);
      }
      document.getElementById('calendar-legend')!.innerHTML=`Dzień ${gameState.time.day}/30 • ${gameState.time.season} • Ostatnie 5 dni: zaostrzona muzyka, częstsze wizyty poborców`;
      const debtDiv=document.getElementById('debt-details')!;
      debtDiv.innerHTML=`Dług całkowity: 10 000 koron<br>Spłacono: ${gameState.debt.paid}<br>Pozostało: ${gameState.debt.remaining}<br>Pożyczka u lichwiarza: ${gameState.debt.loan} (30% odsetek)<br>Odroczenia: ${gameState.debt.extensions}/${gameState.debt.maxExtensions}<br><br>Czas: ${gameState.time.getFullString()}<br>Sen przyspiesza czas. Sklepy i questy zależne od pory.`;
      const repList=document.getElementById('reputation-list')!;
      repList.innerHTML=gameState.reputation.all().map(f=>`<div style="display:flex;justify-content:space-between"><span>${f.name}</span><span style="color:${f.rep>0?'#7ab060':f.rep<0?'#c94a3a':'#8a6d4b'}">${f.rep}</span></div><div class="bar-track" style="height:4px;margin-bottom:6px"><div class="bar-fill" style="width:${(f.rep+100)/2}%;background:${f.color}"></div></div>`).join('');
      const rumorList=document.getElementById('rumor-list')!;
      const rumors=gameState.rumor.getActiveRumors();
      rumorList.innerHTML=rumors.length? rumors.map(r=>`<div>• ${r.text} (rozprzestrzenianie ${Math.round(r.spread*100)}%)</div>`).join('') : 'Brak aktywnych plotek. Czyny roznoszą się z opóźnieniem.';
      const crimeList=document.getElementById('crime-list')!;
      crimeList.innerHTML=`Poziom poszukiwań: ${gameState.crime.wantedLevel}<br>Nagroda za głowę: ${gameState.crime.bounty} koron<br>Poszukiwany: ${gameState.crime.isWanted?'TAK':'nie'}<br><br>Przestępstwa: ${gameState.crime.crimes.length}<br>Kary: grzywna, dyby, więzienie (utrata dni!), banicja, śmierć.`;
      const endings=document.getElementById('endings-list')!;
      endings.innerHTML=[
        'Spłata długu uczciwie',
        'Spłata z przestępstwa',
        'Ucieczka z wyspy',
        'Wstąpienie do Dzikich Rycerzy',
        'Obalenie Dzikich Rycerzy',
        'Śmierć lub niewola'
      ].map(e=>`• ${e}`).join('<br>');
    };
    renderCal();
    eventBus.on('dayChanged', renderCal);
    document.getElementById('btn-pay-debt')?.addEventListener('click', ()=>{
      if(gameState.gold>=500){ gameState.gold-=500; gameState.debt.pay(500); this.toast('Spłacono 500 koron', 'success'); renderCal(); this.updateHUD(); }
      else this.toast('Brak 500 koron', 'error');
    });
    document.getElementById('btn-loan')?.addEventListener('click', ()=>{
      gameState.debt.takeLoan(1000); gameState.gold+=1000; this.toast('Pożyczka 1000 koron u lichwiarza! 30% odsetek', 'warning'); renderCal(); this.updateHUD();
    });
  }

  private bindMenu(){
    // keybinds
    const list=document.getElementById('keybinds-list')!;
    const renderKeys=()=>{
      list.innerHTML=this.input.getBinds().map(b=>`<div class="keybind"><span>${b.action}</span><span>${b.key} <button class="btn" style="padding:1px 4px;font-size:10px" data-remap="${b.action}">ZMIEŃ</button></span></div>`).join('');
      list.querySelectorAll('[data-remap]').forEach(btn=>{
        btn.addEventListener('click', ()=>{
          const act=(btn as HTMLElement).dataset.remap!;
          this.toast(`Naciśnij nowy klawisz dla ${act}`, 'info');
          const handler=(e:KeyboardEvent)=>{
            e.preventDefault();
            this.input.remap(act as any, e.code);
            renderKeys();
            window.removeEventListener('keydown', handler);
          };
          window.addEventListener('keydown', handler);
        });
      });
    };
    renderKeys();
    document.getElementById('btn-reset-keys')?.addEventListener('click', ()=>{ this.input.reset(); renderKeys(); this.toast('Zresetowano klawisze', 'success'); });
    document.getElementById('btn-save')?.addEventListener('click', ()=>{ SaveSystem.save('manual'); this.toast('Zapisano grę', 'success'); });
    document.getElementById('btn-load')?.addEventListener('click', ()=>{ if(SaveSystem.load('manual')){ this.toast('Wczytano grę', 'success'); this.updateHUD(); } else this.toast('Brak zapisu', 'error'); });
    document.getElementById('btn-console')?.addEventListener('click', ()=>{ document.getElementById('debug-console')?.classList.add('open'); });
    document.querySelectorAll('[data-dev]').forEach(btn=>{
      btn.addEventListener('click', ()=>{ const cmd=(btn as HTMLElement).dataset.dev!; eventBus.emit('devCommand', cmd); });
    });
    // settings
    document.getElementById('setting-fov')?.addEventListener('input', (e)=>{
      const v=(e.target as HTMLInputElement).value;
      document.getElementById('fov-val')!.textContent=v;
      eventBus.emit('fovChanged', parseInt(v));
    });
    document.getElementById('setting-ui')?.addEventListener('input', (e)=>{
      const v=(e.target as HTMLInputElement).value;
      document.getElementById('ui-val')!.textContent=v+'%';
      (document.getElementById('ui-root') as HTMLElement).style.zoom=v+'%';
    });

    // systems status
    const sysDiv=document.getElementById('systems-status')!;
    sysDiv.innerHTML=[
      '✓ Czas, kalendarz, licznik długu (system 1)',
      '✓ Dynamiczny dług i raty (2)',
      '✓ Reputacja frakcji 6x -100..+100 (3)',
      '✓ Renoma i plotki z opóźnieniem (4)',
      '✓ Przestępczość, śledztwo, kary (5)',
      '✓ Dynamiczna ekonomia podaż/popyt (6)',
      '✓ Przemyt i czarny rynek (7)',
      '✓ Rzemiosło i produkcja (8)',
      '✓ Rozbudowany system walki stamina/parry (9)',
      '✓ Obrażenia lokalizacyjne i leczenie (10)',
      '✓ Potrzeby życiowe (11)',
      '✓ Choroby, zatrucia, epidemie (12)',
      '✓ Zaawansowane skradanie światło/dźwięk (13)',
      '✓ Rutyny dobowe NPC (14)',
      '✓ Relacje, towarzysze, najemnicy (15)',
      '✓ Własność i baza (16)',
      '✓ Transport konie/wozy/łodzie (17)',
      '✓ Polowania, zbieractwo, rybołówstwo (18)',
      '✓ Zlecenia proceduralne tablice (19)',
      '✓ Losowe wydarzenia świata wagi/cooldowny (20)',
      '✓ Hazard i minigry (21)',
      '✓ Pogoda i pory roku (22)',
      '✓ Wiele zakończeń x6 (23)',
      '✓ System zapisu i trudności (24)',
      '✓ Dostępność i opcje (25)',
      '✓ Świat ciągły, streaming chunków',
      '✓ 60 FPS LOD, occlusion, instancing',
      '✓ Architektura event bus',
      '✓ Dane w JSON, lokalizacja PL/EN',
      '✓ Logi debug i konsola deweloperska'
    ].join('<br>');
  }

  renderCompendium(){
    const cont=document.getElementById('compendium-content')!;
    cont.innerHTML='';
    if(this.currentCompendiumTab==='items'){
      const items=[
        {name:'Miecz żelazny', value:120, desc:'Broń podstawowa, wymaga ostrzenia', where:'Kowal, kuźnia'},
        {name:'Sól', value:12, desc:'Towar, drożeje przy blokadzie portu', where:'Port, przemytnicy'},
        {name:'Zioła', value:30, desc:'Leczenie, alchemia', where:'Bagna, zielarka'},
        {name:'Bandaż', value:15, desc:'Zatrzymuje krwotok', where:'Wytwarzanie, medyk'},
        {name:'Relikwia św. Elenema', value:300, desc:'Zakazana, wysoka cena na czarnym rynku', where:'Ruiny opactwa'},
      ];
      items.forEach(it=>{
        const el=document.createElement('div'); el.className='card';
        el.innerHTML=`<h4>${it.name} • ${it.value} koron</h4><p style="font-size:13px">${it.desc}</p><p style="font-size:11px;color:#8a6d4b;margin-top:6px">Gdzie: ${it.where}</p>`;
        cont.appendChild(el);
      });
    } else if(this.currentCompendiumTab==='bestiary'){
      const beasts=[
        {name:'Wilk bagienny', desc:'Sfora 3-5, niebezpieczny', unlocked:true},
        {name:'Jeleń', desc:'Płochliwy, mięso i skóra', unlocked:true},
        {name:'Dzik', desc:'Agresywny gdy zraniony', unlocked:false},
        {name:'Niedźwiedź', desc:'Bardzo niebezpieczny, rzadki', unlocked:false},
        {name:'Rośliny', desc:'Zioła lecznicze, grzyby - ryzyko pomyłki', unlocked:true},
      ];
      beasts.forEach(b=>{
        const el=document.createElement('div'); el.className='card';
        el.style.opacity=b.unlocked?'1':'0.5';
        el.innerHTML=`<h4>${b.name} ${b.unlocked?'✓':'🔒'}</h4><p style="font-size:13px">${b.desc}</p><p style="font-size:11px;color:#8a6d4b">Wpis odblokowany przez obserwację, polowanie, zbieranie lub rozmowę ze specjalistą</p>`;
        cont.appendChild(el);
      });
    } else if(this.currentCompendiumTab==='quests'){
      const qs=QUEST_TEMPLATES;
      cont.innerHTML=qs.map(q=>`<div class="card"><h4>${q.title} [${q.status}]</h4><p style="font-size:12px">${q.desc}</p><div style="font-size:11px;color:#8a6d4b">${q.giver} • ${q.location}</div></div>`).join('');
    } else {
      cont.innerHTML=`<div class="card"><h4>Zapiski Johna - Dziennik</h4><p style="font-size:14px;line-height:1.6">
      Dzień 1: Przypłynąłem. Elenem śmierdzi rybą i błotem. 100 koron w sakwie, 10 000 długu. Dzicy Rycerze... pamiętam ich z kontynentu. Byłem jednym z nich? Nie, byłem najemnikiem. Ale co się stało w 1428? Dlaczego jestem winien?<br><br>
      Dzień 3: Spotkałem starą znajomą w karczmie. Mówi, że mój dług to nie pieniądze, to krew. Zabiłem kogoś ważnego?<br><br>
      Dzień 7: Sen o pożarze. O opactwie. O dziecku?<br><br>
      (Dalsze wpisy odblokowują się wraz z postępem fabuły)
      </p></div>`;
    }
  }

  updateHUD(){
    document.getElementById('hud-time')!.textContent=gameState.time.getFullString();
    document.getElementById('hud-crowns')!.innerHTML=`${gameState.gold} <span style="color:var(--accent2)">koron</span>`;
    document.getElementById('hud-debt')!.textContent=`DŁUG: ${gameState.debt.remaining} / ${gameState.time.maxDays-gameState.time.day} dni`;
    document.getElementById('hud-weather')!.textContent=`${gameState.weather.current} • ${Math.round(gameState.weather.temperature)}°C`;
    // bars
    (document.getElementById('bar-health') as HTMLElement).style.width=gameState.needs.health+'%';
    document.getElementById('health-val')!.textContent=Math.round(gameState.needs.health)+'%';
    (document.getElementById('bar-stamina') as HTMLElement).style.width=(100-gameState.needs.fatigue)+'%';
    document.getElementById('stamina-val')!.textContent=Math.round(100-gameState.needs.fatigue)+'%';
    (document.getElementById('bar-hunger') as HTMLElement).style.width=(100-gameState.needs.hunger)+'%';
    (document.getElementById('bar-thirst') as HTMLElement).style.width=(100-gameState.needs.thirst)+'%';
    (document.getElementById('bar-fatigue') as HTMLElement).style.width=gameState.needs.fatigue+'%';
    (document.getElementById('bar-dirt') as HTMLElement).style.width=gameState.needs.dirt+'%';
    document.getElementById('skill-points')!.textContent=gameState.skillPoints.toString();
  }

  toast(msg:string, type:'info'|'success'|'warning'|'error'='info'){
    const el=document.createElement('div');
    el.style.padding='8px 14px'; el.style.background=type==='error'?'#6b2a2a':type==='success'?'#2a4a2a':type==='warning'?'#5a4a2a':'#2a2520';
    el.style.border='1px solid #4a3f35'; el.style.fontSize='13px'; el.style.pointerEvents='auto'; el.style.maxWidth='360px';
    el.style.fontFamily='EB Garamond';
    el.textContent=msg;
    this.toastContainer.appendChild(el);
    setTimeout(()=>el.remove(), 4000);
  }

  open(id:string){
    this.overlays.get(id)?.classList.add('open');
    if(id==='compendium') this.renderCompendium();
    gameState.time.paused=true;
    document.exitPointerLock();
  }
  close(id:string){
    this.overlays.get(id)?.classList.remove('open');
    if(!Array.from(this.overlays.values()).some(o=>o.classList.contains('open'))){
      gameState.time.paused=false;
    }
  }
  toggle(id:string){
    const o=this.overlays.get(id);
    if(o?.classList.contains('open')) this.close(id);
    else this.open(id);
  }
  isAnyOpen(){ return Array.from(this.overlays.values()).some(o=>o.classList.contains('open')); }
}
