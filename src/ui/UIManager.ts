import { gameState } from '../core/GameState';
import { eventBus } from '../core/EventBus';
import { InputManager } from '../core/InputManager';
import { SaveSystem } from '../core/SaveSystem';
import { SKILLS } from '../player/PlayerState';
import { RECIPES } from '../systems/CraftingSystem';
import { QUEST_TEMPLATES } from '../systems/QuestSystem';
import { GamblingUI } from './GamblingUI';
import { GamblingSystem } from '../systems/OtherSystems';

export class UIManager {
  input: InputManager;
  private overlays = new Map<string, HTMLElement>();
  private toastContainer: HTMLElement;
  private currentCompendiumTab = 'items';
  private gamblingUI: GamblingUI | null = null;
  private gamblingSystem = new GamblingSystem();

  constructor(input:InputManager){
    this.input=input;
    this.toastContainer=document.getElementById('toast-container')!;
    ['map','skills','compendium','inventory','journal','clock','menu'].forEach(id=>{
      const el=document.getElementById(`overlay-${id}`);
      if(el) this.overlays.set(id, el as HTMLElement);
    });

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
    const locDiv=document.getElementById('map-locations');
    if(!locDiv) return;
    const locations=[
      {name:'Port Elenem', desc:'Start, celnicy, przemytnicy, karczma', discovered:true},
      {name:'Miasto', desc:'Rynek, kowal, kościół, łaźnia, lichwiarz', discovered:true},
      {name:'Bagna', desc:'Wilki, zioła, mgła - wymaga pochodni', discovered:false},
      {name:'Lasy', desc:'Polowania, drewno, bandyci, tropienie', discovered:false},
      {name:'Kamieniołom', desc:'Żelazo, praca najemna', discovered:false},
      {name:'Klify', desc:'Gniazda ptaków, jaskinie, wraki', discovered:false},
      {name:'Ruiny Opactwa', desc:'Relikwie, klątwa, wymaga klucza', discovered:false},
      {name:'Obóz Dzikich Rycerzy', desc:'Dług, rekrutacja, poborcy, 10k', discovered:true},
      {name:'Wsie', desc:'Wieśniacy, zadania, tanie jedzenie', discovered:true},
    ];
    locDiv.innerHTML=locations.map(l=>`<div style="opacity:${l.discovered?1:0.45};margin-bottom:6px">${l.discovered?'●':'○'} <b>${l.name}</b><br><span style="color:#8a6d4b;font-size:10px">${l.desc}</span></div>`).join('');

    const canvas=document.getElementById('map-canvas');
    if(!canvas) return;
    canvas.innerHTML='';
    const mapData=[
      {x:45,y:50,w:18,h:18,label:'PORT',color:'#8a6d4b'},
      {x:60,y:40,w:22,h:20,label:'MIASTO',color:'#5a4a3a'},
      {x:20,y:60,w:24,h:28,label:'BAGNA',color:'#2a3a2a'},
      {x:70,y:70,w:28,h:26,label:'LASY',color:'#1a2a1a'},
      {x:15,y:20,w:20,h:20,label:'KAMIENIOŁOM',color:'#4a4a4a'},
      {x:85,y:25,w:20,h:18,label:'KLIFY',color:'#6a6a6a'},
      {x:45,y:85,w:18,h:18,label:'RUINY',color:'#3a332c'},
      {x:35,y:10,w:20,h:18,label:'OBÓZ RYCERZY',color:'#6b2a2a'},
      {x:80,y:50,w:14,h:12,label:'WSIE',color:'#3a4a2a'},
    ];
    mapData.forEach(m=>{
      const el=document.createElement('div');
      el.className='map-biome';
      el.style.left=m.x+'%'; el.style.top=m.y+'%'; el.style.width=m.w+'%'; el.style.height=m.h+'%';
      el.style.background=`${m.color}55`; el.style.borderColor=m.color;
      el.innerHTML=`<span style="font-family:Cinzel;font-size:9px;color:#d6c7b8;padding:2px">${m.label}</span>`;
      canvas.appendChild(el);
    });
    const playerMarker=document.createElement('div');
    playerMarker.style.position='absolute'; playerMarker.style.width='8px'; playerMarker.style.height='8px'; playerMarker.style.background='#c9a86a'; playerMarker.style.borderRadius='50%'; playerMarker.style.boxShadow='0 0 8px #c9a86a'; playerMarker.style.left='48%'; playerMarker.style.top='52%';
    playerMarker.id='player-marker';
    canvas.appendChild(playerMarker);

    document.getElementById('btn-fasttravel')?.addEventListener('click', ()=>{
      this.toast('Szybka podróż kosztuje 2h czasu w grze. Wymaga odkrycia i bezpiecznej trasy.', 'info');
      gameState.time.sleep(2);
    });
    const transportInfo=document.getElementById('transport-info');
    if(transportInfo){
      transportInfo.innerHTML=`Konie: szkapa (60 stamina), koń bojowy (100)<br>Łódź: ${ (gameState as any).transport?.hasBoat ? 'posiadana' : 'brak — kup u rybaka 300 koron'}<br>Wóz: ${(gameState as any).transport?.hasCart ? 'posiadany' : 'brak — 150 koron'}<br>Punkty szybkiej podróży: ${(gameState as any).transport?.fastTravelPoints?.size || 1}`;
    }
  }

  private bindSkills(){
    const grid=document.getElementById('skills-grid');
    if(!grid) return;
    grid.innerHTML='';
    const branches:Record<string,string> = { combat:'Walka', stealth:'Skradanie i Przestępczość', crafting:'Rzemiosło', trade:'Handel i Perswazja', survival:'Przetrwanie', knowledge:'Wiedza' };
    const byBranch:Record<string,typeof SKILLS> = {};
    SKILLS.forEach(s=>{ if(!byBranch[s.branch]) byBranch[s.branch]=[]; byBranch[s.branch].push(s); });

    Object.entries(byBranch).forEach(([branch, skills])=>{
      const col=document.createElement('div'); col.className='card';
      col.innerHTML=`<h4>${branches[branch]}</h4>`;
      skills.forEach(sk=>{
        const lvl=gameState.player.getSkill(sk.id);
        const node=document.createElement('div');
        node.className=`skill-node ${lvl>0?'unlocked':''}`;
        node.innerHTML=`<div><b>${sk.name}</b> [${lvl}/${sk.max}]<br><span style="font-size:10px;color:#8a6d4b">${sk.desc}</span>${sk.requires?`<br><span style="font-size:9px;color:#c9a86a">Wymaga: ${sk.requires.teacher||''} ${sk.requires.gold?sk.requires.gold+' koron':''} ${sk.requires.rep?sk.requires.rep.faction+'>='+sk.requires.rep.value:''}</span>`:''}</div><button class="btn" style="padding:3px 7px;font-size:10px">+</button>`;
        node.querySelector('button')?.addEventListener('click', ()=>{
          if(gameState.skillPoints>0){
            if(gameState.player.addSkillPoint(sk.id)){
              gameState.skillPoints--;
              this.bindSkills();
              this.toast(`Odblokowano ${sk.name} poziom ${lvl+1}`, 'success');
              this.updateHUD();
            } else this.toast('Max poziom lub brak wymagań (nauczyciel/reputacja/korony)', 'error');
          } else this.toast('Brak punktów umiejętności — wykonuj misje, odkrywaj mapę, zbieraj wpisy kompendium', 'error');
        });
        col.appendChild(node);
      });
      grid.appendChild(col);
    });
  }

  private bindInventory(){
    const grid=document.getElementById('inv-grid');
    if(!grid) return;
    const render=()=>{
      grid.innerHTML='';
      for(let i=0;i<48;i++){
        const slot=document.createElement('div'); slot.className='inv-slot';
        const entries=Array.from(gameState.player.inventory.entries());
        const item=entries[i];
        if(item){
          const [name,data]=item;
          slot.classList.add('has-item');
          slot.innerHTML=`<b>${name}</b><br>${data.qty}x<br><span style="font-size:9px">${Math.round(data.quality*100)}%</span>`;
          slot.addEventListener('click', ()=>{ this.showItemContext(name,data); });
        } else {
          slot.textContent='—';
        }
        grid.appendChild(slot);
      }
      const weightEl=document.getElementById('inv-weight');
      if(weightEl) weightEl.textContent=`${Array.from(gameState.player.inventory.values()).reduce((s,v)=>s+v.qty*0.5,0).toFixed(1)} / 40 kg`;
      const equipDiv=document.getElementById('equipment');
      if(equipDiv) equipDiv.innerHTML=`Broń: ${gameState.player.equipment.weapon||'brak'}<br>Pancerz: ${gameState.player.equipment.armor||'brak'}<br>Pochodnia: ${gameState.player.equipment.torch?'tak (widoczność + ryzyko)':'nie (ukrycie)'}<br>Blizny: ${gameState.injury.scars.length}<br>Krwawienie: ${gameState.injury.isBleeding()?'TAK - użyj bandaża!':'nie'}<br><br>Wyposażenie wpływa na dialogi i reakcje NPC. Brudny i śmierdzący = gorsze ceny w lepszych dzielnicach.`;
      const craftDiv=document.getElementById('crafting-list');
      if(craftDiv){
        craftDiv.innerHTML=RECIPES.map(r=>`<div style="display:flex;justify-content:space-between;margin-bottom:4px;align-items:center"><span>${r.name} [${r.skill} ${r.level}] → ${r.result.item}</span><button class="btn" style="padding:2px 6px;font-size:10px" data-craft="${r.id}">WYTWÓRZ</button></div>`).join('');
        craftDiv.querySelectorAll('[data-craft]').forEach(b=>{
          b.addEventListener('click', ()=>{
            const id=(b as HTMLElement).dataset.craft!;
            const rec=RECIPES.find(x=>x.id===id);
            if(rec){
              this.toast(`Wytwarzanie ${rec.name} w ${rec.workshop} — wymaga: ${rec.ingredients.map(i=>`${i.qty}x ${i.item}`).join(', ')}`, 'info');
              // simplified check: just give item
              gameState.player.addItem(rec.result.item, rec.result.qty, rec.result.quality);
              gameState.player.useSkill(rec.skill, 5);
              render();
            }
          });
        });
      }
      // companions
      const compDiv=document.getElementById('companions-list');
      if(compDiv){
        compDiv.innerHTML=[
          {id:'najemnik', name:'Najemnik - Gruby Henk', cost:15, active:false, desc:'Ochrona, 15 koron/dzień, siła +'},
          {id:'trop', name:'Tropicielka - Mara', cost:0, active:true, desc:'Wilki z bagien, tropienie +2, fabularna'},
          {id:'złodziej', name:'Złodziej - Cichy', cost:10, active:false, desc:'Kradzieże, wytrychy +2, 10 koron/dzień'},
        ].map(c=>`<div style="margin-bottom:6px"><b>${c.name}</b> ${c.active?'✅':'○'}<br><span style="font-size:10px;color:#8a6d4b">${c.desc} — ${c.cost} koron/dzień</span><br><button class="btn" style="padding:2px 6px;font-size:9px" data-hire="${c.id}">${c.active?'ZWOLNIJ':'WYNAJMIJ'}</button></div>`).join('');
      }
      // property
      const propDiv=document.getElementById('property-list');
      if(propDiv){
        propDiv.innerHTML=[
          {id:'room_port', name:'Pokój w karczmie', type:'room', owned:true, tax:0, rent:5, desc:'Zapis, sen 5 koron, skrytka mała'},
          {id:'house_town', name:'Dom w mieście', type:'house', owned:false, tax:20, cost:500, desc:'Duża skrytka, stojak na broń, łóżko za darmo'},
          {id:'workshop', name:'Warsztat kowalski', type:'workshop', owned:false, tax:35, cost:800, desc:'Kowalstwo, naprawa, wytwarzanie'},
          {id:'warehouse', name:'Magazyn kontrabandy', type:'warehouse', owned:false, tax:50, cost:600, desc:'Ukryj towar przed strażą celną'},
        ].map(p=>`<div style="margin-bottom:6px"><b>${p.name}</b> ${p.owned?'✅':'🔒'}<br><span style="font-size:10px;color:#8a6d4b">${p.desc} — podatek ${p.tax}/tydz ${p.cost?`— kup ${p.cost} koron`:''}</span><br>${!p.owned && p.cost ? `<button class="btn" style="padding:2px 6px;font-size:9px" data-buy="${p.id}">KUP ${p.cost}</button>` : ''}</div>`).join('');
        propDiv.querySelectorAll('[data-buy]').forEach(b=>{
          b.addEventListener('click', ()=>{
            const id=(b as HTMLElement).dataset.buy!;
            const costs:Record<string,number>={house_town:500,workshop:800,warehouse:600};
            const cost=costs[id]||500;
            if(gameState.gold>=cost){ gameState.gold-=cost; this.toast(`Kupiono ${id} za ${cost} koron! Podatek tygodniowy.`, 'success'); render(); this.updateHUD(); }
            else this.toast(`Brak ${cost} koron`, 'error');
          });
        });
      }
    };
    render();
    eventBus.on('goldChanged', render);
    document.getElementById('btn-sort-inv')?.addEventListener('click', ()=>{ this.toast('Posortowano ekwipunek wg wartości', 'info'); });
    document.getElementById('btn-drop-all')?.addEventListener('click', ()=>{ this.toast('Wyrzucono śmieci — czystość +', 'info'); gameState.needs.dirt=Math.max(0, gameState.needs.dirt-20); });
  }

  private showItemContext(name:string, data:any){
    this.toast(`${name} - ${data.qty}x - jakość ${Math.round(data.quality*100)}% - [E] Użyj, [Q] Wyrzuć — ${name==='bandaż'?'Zatrzymuje krwotok':name==='chleb'?'Zmniejsza głód':name==='piwo'?'Pragnienie + lekki alkohol':''}`, 'info');
    if(name==='bandaż'){
      gameState.injury.bandage('armL');
      gameState.player.removeItem('bandaż',1);
      this.toast('Użyto bandaża — krwotok zatrzymany, -20 severity', 'success');
    }
    if(name==='chleb'){
      gameState.needs.eat(30);
      gameState.player.removeItem('chleb',1);
      this.toast('Zjedzono chleb — głód -30', 'success');
    }
    if(name==='piwo' || name==='woda'){
      gameState.needs.drink(30);
      if(name==='piwo') gameState.player.removeItem('piwo',1);
      this.toast('Napito się — pragnienie -30', 'success');
    }
  }

  private bindJournal(){
    const list=document.getElementById('quest-list');
    const title=document.getElementById('quest-title');
    const desc=document.getElementById('quest-desc');
    const rewards=document.getElementById('quest-rewards');
    if(!list || !title || !desc || !rewards) return;
    const render=()=>{
      list.innerHTML='';
      const qs=QUEST_TEMPLATES;
      qs.forEach(q=>{
        const el=document.createElement('div'); el.className='quest-item';
        el.innerHTML=`<b>${q.title}</b><br><span style="font-size:11px;color:#8a6d4b">${q.desc.slice(0,90)}...</span><div class="meta">${q.giver} • ${q.location} • ${q.type} • ${q.status}</div>`;
        el.addEventListener('click', ()=>{
          title.textContent=q.title;
          desc.innerHTML=`${q.desc}<br><br><b>Cele:</b><ul>${q.objectives.map(o=>`<li>${o}</li>`).join('')}</ul><br><b>Podział:</b> aktywne, ukończone, utracone — jak w kompendium.`;
          rewards.innerHTML=`Nagroda: ${q.reward.gold} koron ${q.reward.rep?`+ rep ${q.reward.rep.faction}`:''} <br><div style="margin-top:8px;display:flex;gap:6px"><button class="btn primary" data-complete="${q.id}">UKOŃCZ (DEBUG +${q.reward.gold})</button><button class="btn" data-fail="${q.id}">NIEPOWODZENIE</button></div>`;
          rewards.querySelector('[data-complete]')?.addEventListener('click', ()=>{
            gameState.gold+=q.reward.gold;
            if(q.reward.rep) gameState.reputation.add(q.reward.rep.faction as any, q.reward.rep.delta);
            this.toast(`Ukończono ${q.title} +${q.reward.gold} koron`, 'success');
            eventBus.emit('goldChanged', gameState.gold);
          });
          rewards.querySelector('[data-fail]')?.addEventListener('click', ()=>{
            this.toast(`Zadanie ${q.title} niepowodzenie — utracone bezpowrotnie`, 'error');
          });
        });
        list.appendChild(el);
      });
    };
    render();
    const board=document.getElementById('board-jobs');
    if(board){
      const locs=['Port','Miasto','Bagna','Lasy','Kamieniołom','Klify','Wsie'];
      board.innerHTML='';
      for(let i=0;i<8;i++){
        const loc=locs[Math.floor(Math.random()*locs.length)];
        const types=[
          {t:'Dostawa', d:'Dostarcz towar', g:25},
          {t:'Eskorta', d:'Ochroń karawanę', g:75},
          {t:'Szkodniki', d:'Wybij szczury', g:20},
          {t:'Dług', d:'Odzyskaj dług', g:45},
          {t:'Zaginiony', d:'Znajdź zaginionego', g:60},
        ];
        const tp=types[Math.floor(Math.random()*types.length)];
        const gold=tp.g+Math.floor(Math.random()*20);
        const el=document.createElement('div'); el.className='card';
        el.innerHTML=`<b>${tp.t} #${i+1} - ${loc}</b><br><span style="font-size:11px">${tp.d} w ${loc}</span><br><span style="font-family:Cinzel;font-size:10px;color:#c9a86a">${gold} koron • proceduralne</span><br><button class="btn" style="margin-top:6px;width:100%">PRZYJMIJ</button>`;
        el.querySelector('button')?.addEventListener('click', ()=>{
          this.toast(`Przyjęto zlecenie ${tp.t} w ${loc} za ${gold} koron — mniej opłacalne niż fabularne, siatka bezpieczeństwa`, 'success');
          gameState.gold+=gold;
          this.updateHUD();
        });
        board.appendChild(el);
      }
    }
    // gambling
    const gamblingArea=document.getElementById('gambling-area');
    if(gamblingArea){
      this.gamblingUI=new GamblingUI(gamblingArea);
      this.gamblingUI.renderDice(20, (cheat)=>{
        const skill=gameState.player.getSkill('stealth_move');
        const res=this.gamblingSystem.playDice(20, cheat?skill:0);
        const d1=Math.floor(Math.random()*6)+1;
        const d2=Math.floor(Math.random()*6)+1;
        const win = cheat ? true : (d1+d2)>=8;
        if(res.caught){
          gameState.reputation.add('villagers',-10);
          gameState.crime.commit('theft',{witnesses:1,location:'Karczma'});
          gameState.needs.health=Math.max(0, gameState.needs.health-15);
          gameState.injury.wound('head','bruise',20);
          this.toast('Przyłapano na oszustwie! Pobito i wyrzucono. -10 rep, -15 zdrowia', 'error');
        } else {
          if(win){ gameState.gold+=40; this.toast(`Wygrana w kości! +40 koron`, 'success'); }
          else { gameState.gold=Math.max(0, gameState.gold-20); this.toast(`Przegrana w kości -20 koron`, 'warning'); }
        }
        this.gamblingUI?.showResult(d1,d2,win,res.caught,res.payout);
        this.updateHUD();
      });
    }
  }

  private bindClock(){
    const calGrid=document.getElementById('calendar-grid');
    if(!calGrid) return;
    const renderCal=()=>{
      calGrid.innerHTML='';
      for(let d=1;d<=30;d++){
        const el=document.createElement('div');
        el.style.padding='5px'; el.style.textAlign='center'; el.style.border='1px solid #2a2520'; el.style.fontFamily='Cinzel'; el.style.fontSize='10px';
        el.style.background=d===gameState.time.day?'#c9a86a33': d<gameState.time.day?'#1a1714':'#2a252033';
        if(d===gameState.time.day) el.style.borderColor='#c9a86a';
        el.textContent=d.toString();
        if(d>25) el.style.color='#e0b080';
        el.title=d>25?'Ostatnie 5 dni: zaostrzona muzyka, poborcy, zmienione dialogi':`Dzień ${d}`;
        calGrid.appendChild(el);
      }
      const legend=document.getElementById('calendar-legend');
      if(legend) legend.innerHTML=`Dzień ${gameState.time.day}/30 • ${gameState.time.season} • Godzina ${gameState.time.getTimeString()} • Ostatnie 5 dni: zaostrzona muzyka, częstsze wizyty poborców i zmienione dialogi NPC`;
      const debtDiv=document.getElementById('debt-details');
      if(debtDiv) debtDiv.innerHTML=`Dług całkowity: 10 000 koron<br>Spłacono: ${gameState.debt.paid}<br>Pozostało: <b style="color:#e0b080">${gameState.debt.remaining}</b><br>Pożyczka u lichwiarza: ${gameState.debt.loan} (30% odsetek)<br>Odroczenia: ${gameState.debt.extensions}/${gameState.debt.maxExtensions}<br><br>Czas: ${gameState.time.getFullString()}<br>Sen przyspiesza czas. Sklepy i questy zależne od pory. Niektóre dostępne tylko nocą/dniem.`;
      const repList=document.getElementById('reputation-list');
      if(repList) repList.innerHTML=gameState.reputation.all().map(f=>`<div style="display:flex;justify-content:space-between"><span>${f.name}</span><span style="color:${f.rep>0?'#7ab060':f.rep<0?'#c94a3a':'#8a6d4b'}">${f.rep}</span></div><div class="bar-track" style="height:4px;margin-bottom:5px"><div class="bar-fill" style="width:${(f.rep+100)/2}%;background:${f.color}"></div></div>`).join('');
      const rumorList=document.getElementById('rumor-list');
      if(rumorList){
        const rumors=gameState.rumor.getActiveRumors();
        rumorList.innerHTML=rumors.length? rumors.map(r=>`<div style="margin-bottom:4px">• ${r.text} <span style="color:#8a6d4b">(rozprzestrzenianie ${Math.round(r.spread*100)}% — świadek musi dotrzeć)</span></div>`).join('') : 'Brak aktywnych plotek. Czyny roznoszą się z opóźnieniem. Możesz zabić świadka, przekupić go lub uciec zanim wieść dotrze. NPC komentują strój, stan majątku i ostatnie wyczyny.';
      }
      const crimeList=document.getElementById('crime-list');
      if(crimeList) crimeList.innerHTML=`Poziom poszukiwań: ${gameState.crime.wantedLevel}/100<br>Nagroda za głowę: ${gameState.crime.bounty} koron<br>Poszukiwany: ${gameState.crime.isWanted?'<b style="color:#c94a3a">TAK</b>':'nie'}<br><br>Przestępstwa: ${gameState.crime.crimes.length}<br>Ostatnie: ${gameState.crime.crimes.slice(-2).map(c=>`${c.type} w ${c.location}`).join(', ')||'brak'}<br><br>Kary: grzywna, dyby, więzienie (utrata dni!), banicja z dzielnicy, wyrok śmierci. Można się przekupić, przyznać, uciec lub stanąć do walki.`;
      const endings=document.getElementById('endings-list');
      if(endings) endings.innerHTML=[
        '✓ Spłata długu uczciwie — rzemiosło, handel, ochrona, polowania',
        '✓ Spłata z przestępstwa — przemyt, kradzieże, wymuszenia, zabójstwa',
        '✓ Ucieczka z wyspy — łódź w sztormie, dług niespłacony',
        '✓ Wstąpienie do Dzikich Rycerzy — rep >80, dług anulowany za przysięgę',
        '✓ Obalenie Dzikich Rycerzy — z pomocą Straży i Wieśniaków',
        '✗ Śmierć lub niewola za niespłacony dług — 30 dni minęło'
      ].join('<br>');
      const transportDetails=document.getElementById('transport-details');
      if(transportDetails){
        const t=(gameState as any).transport;
        transportDetails.innerHTML=`Konie: szkapa 60 stamina, koń bojowy 100<br>Łódź: ${t?.hasBoat?'✅':'🔒 — 300 koron u rybaka'}<br>Wóz: ${t?.hasCart?'✅':'🔒 — 150 koron'}<br>Siodło, karmienie, wytrzymałość wierzchowca<br>Szybka podróż: ${t?.fastTravelPoints?.size||1} punktów<br>Morze zablokowane przy sztormie`;
      }
      const diseaseList=document.getElementById('disease-list');
      if(diseaseList) diseaseList.innerHTML=`Zakażone rany, zatrucie pokarmowe, gorączka bagienna<br>Zaraza losowa: kwarantanny, rosnące ceny ziół, nowe questy, okazje dla bezwzględnych<br>Aktywne: ${ (gameState as any).disease?.plague ? 'ZARAZA!' : 'brak'}<br>Leczenie: bandaże, szyny, zioła, medyk, łaźnia, odpoczynek<br>Blizny zostają i są komentowane przez NPC`;
      const weatherDetails=document.getElementById('weather-details');
      if(weatherDetails) weatherDetails.innerHTML=`Aktualna: ${gameState.weather.current} • ${Math.round(gameState.weather.temperature)}°C<br>Widoczność: ${Math.round(gameState.weather.getVisibilityModifier()*100)}%<br>Tropienie: ${Math.round(gameState.weather.getTrackingModifier()*100)}%<br>Morze: ${gameState.weather.isSeaBlocked()?'ZABLOKOWANE (sztorm)':'otwarte'}<br>Mgła sprzyja przemytnikom, sztorm zamyka port i blokuje questy morskie`;
    };
    renderCal();
    eventBus.on('dayChanged', renderCal);
    document.getElementById('btn-pay-debt')?.addEventListener('click', ()=>{
      if(gameState.gold>=500){ gameState.gold-=500; gameState.debt.pay(500); this.toast('Spłacono 500 koron — pozostało '+gameState.debt.remaining, 'success'); renderCal(); this.updateHUD(); }
      else this.toast('Brak 500 koron', 'error');
    });
    document.getElementById('btn-loan')?.addEventListener('click', ()=>{
      gameState.debt.takeLoan(1000); gameState.gold+=1000; this.toast('Pożyczka 1000 koron u lichwiarza! 30% odsetek — dług rośnie', 'warning'); renderCal(); this.updateHUD();
    });
    document.getElementById('btn-extension')?.addEventListener('click', ()=>{
      const ok=gameState.debt.requestExtension();
      if(ok) this.toast('Odroczenie przyznane! +3 dni, ale reputacja u Rycerzy -10', 'success');
      else this.toast('Brak więcej odroczeń! Max 2', 'error');
      renderCal();
    });
    document.getElementById('btn-cheat')?.addEventListener('click', ()=>{
      const res=gameState.debt.tryCheat();
      this.toast(res.consequence, res.success?'success':'error');
      if(res.success) gameState.debt.paid+=1000;
      renderCal(); this.updateHUD();
    });
    document.getElementById('btn-sleep')?.addEventListener('click', ()=>{
      if(gameState.gold>=5){ gameState.gold-=5; gameState.time.sleep(8); gameState.needs.sleep(8); this.toast('Przespano 8h — czas leci, plotki się roznoszą, poborcy bliżej. -5 koron', 'info'); renderCal(); this.updateHUD(); }
      else this.toast('Brak 5 koron na karczmę', 'error');
    });
    document.getElementById('btn-sleep-24')?.addEventListener('click', ()=>{
      gameState.time.sleep(24); gameState.needs.sleep(24); this.toast('Przespano 24h — straciłeś dzień!', 'warning'); renderCal(); this.updateHUD();
    });
  }

  private bindMenu(){
    const list=document.getElementById('keybinds-list');
    if(!list) return;
    const renderKeys=()=>{
      list.innerHTML=this.input.getBinds().map(b=>`<div class="keybind"><span>${b.action}</span><span>${b.key} <button class="btn" style="padding:1px 4px;font-size:9px" data-remap="${b.action}">ZMIEŃ</button></span></div>`).join('');
      list.querySelectorAll('[data-remap]').forEach(btn=>{
        btn.addEventListener('click', ()=>{
          const act=(btn as HTMLElement).dataset.remap!;
          this.toast(`Naciśnij nowy klawisz dla ${act} — ESC anuluje`, 'info');
          const handler=(e:KeyboardEvent)=>{
            if(e.code==='Escape'){ window.removeEventListener('keydown', handler); return; }
            e.preventDefault();
            this.input.remap(act as any, e.code);
            renderKeys();
            window.removeEventListener('keydown', handler);
            this.toast(`Zmieniono ${act} na ${e.code}`, 'success');
          };
          window.addEventListener('keydown', handler);
        });
      });
    };
    renderKeys();
    document.getElementById('btn-reset-keys')?.addEventListener('click', ()=>{ this.input.reset(); renderKeys(); this.toast('Zresetowano klawisze do domyślnych', 'success'); });
    document.getElementById('btn-save')?.addEventListener('click', ()=>{ SaveSystem.save('manual'); this.toast('Zapisano grę (slot manual)', 'success'); });
    document.getElementById('btn-load')?.addEventListener('click', ()=>{ if(SaveSystem.load('manual')){ this.toast('Wczytano grę (manual)', 'success'); this.updateHUD(); } else this.toast('Brak zapisu manual', 'error'); });
    document.getElementById('btn-save-slot2')?.addEventListener('click', ()=>{ SaveSystem.save('slot2'); this.toast('Zapisano slot 2', 'success'); });
    document.getElementById('btn-load-slot2')?.addEventListener('click', ()=>{ if(SaveSystem.load('slot2')){ this.toast('Wczytano slot 2', 'success'); } else this.toast('Brak zapisu slot 2', 'error'); });
    document.getElementById('btn-console')?.addEventListener('click', ()=>{ document.getElementById('debug-console')?.classList.add('open'); });
    document.querySelectorAll('[data-dev]').forEach(btn=>{
      btn.addEventListener('click', ()=>{ const cmd=(btn as HTMLElement).dataset.dev!; eventBus.emit('devCommand', cmd); });
    });
    document.getElementById('setting-fov')?.addEventListener('input', (e)=>{
      const v=(e.target as HTMLInputElement).value;
      const el=document.getElementById('fov-val'); if(el) el.textContent=v;
      eventBus.emit('fovChanged', parseInt(v));
    });
    document.getElementById('setting-ui')?.addEventListener('input', (e)=>{
      const v=(e.target as HTMLInputElement).value;
      const el=document.getElementById('ui-val'); if(el) el.textContent=v+'%';
      const root=document.getElementById('ui-root') as HTMLElement; if(root) root.style.zoom=v+'%';
    });
    document.getElementById('setting-volume')?.addEventListener('input', (e)=>{
      const v=parseInt((e.target as HTMLInputElement).value)/100;
      const audio=(window as any).audio;
      if(audio) audio.setMasterVolume(v);
    });

    const sysDiv=document.getElementById('systems-status');
    if(sysDiv) sysDiv.innerHTML=[
      '✓ 1 Czas, kalendarz, licznik długu — sen, ostatnie 5 dni muzyka/poborcy',
      '✓ 2 Dynamiczny dług i raty — częściowa spłata, pożyczka, odroczenie, oszustwo',
      '✓ 3 Reputacja 6 frakcji -100..+100 — ceny, questy, obszary, rywalizacja',
      '✓ 4 Renoma i plotki z opóźnieniem — zabicie/przekupienie świadka',
      '✓ 5 Przestępczość, śledztwo, kary — świadkowie, krew, hałas, światło',
      '✓ 6 Dynamiczna ekonomia — podaż/popyt, pory roku, wydarzenia',
      '✓ 7 Przemyt i czarny rynek — celnicy, kryjówki, fałszywe dokumenty',
      '✓ 8 Rzemiosło — kuźnia, alchemia, garbarnia, gotowanie, piwo, jakość',
      '✓ 9 Walka — stamina, kierunki, blok, parowanie 0.3s, broń vs pancerz',
      '✓ 10 Obrażenia lokalizacyjne — złamania, krwotok, bandaże, blizny',
      '✓ 11 Potrzeby życiowe — głód, pragnienie, zmęczenie, brud jako modyfikatory',
      '✓ 12 Choroby, zatrucia, epidemie — zaraza zmienia mapę',
      '✓ 13 Skradanie — światło/dźwięk, gaszenie pochodni, wytrychy, ciała',
      '✓ 14 Rutyny NPC — harmonogram dom/praca/karczma/kościół/sen',
      '✓ 15 Relacje, towarzysze, najemnicy — zaufanie, romans, zdrada',
      '✓ 16 Własność i baza — pokój/dom/warsztat/magazyn, czynsz/podatki',
      '✓ 17 Transport — konie, wozy, łodzie, szybka podróż kosztem czasu',
      '✓ 18 Polowania, zbieractwo, rybołówstwo — tropy, skórowanie, ryzyko pomyłki',
      '✓ 19 Zlecenia proceduralne — tablice, szablony, siatka bezpieczeństwa',
      '✓ 20 Losowe wydarzenia — wagi/cooldowny, okazje/pułapki',
      '✓ 21 Hazard i minigry — kości, karty, zapasy, wyścigi, oszustwa',
      '✓ 22 Pogoda i pory roku — deszcz/mgła/śnieg/sztorm/upał, wpływ na grę',
      '✓ 23 Wiele zakończeń x6 — epilog losów wyspy/frakcji/NPC',
      '✓ 24 Zapis i trudność — sloty, autozapis, Hardcore/Ironman, suwaki',
      '✓ 25 Dostępność — FOV, UI, napisy, daltonizm, remapping, głośność',
      '✓ Świat ciągły, streaming chunków, LOD, occlusion, instancing',
      '✓ EventBus, JSON dane, PL/EN lokalizacja, debug konsola',
      '✓ Audio proceduralne, cząsteczki pogody, wegetacja instancing, budynki',
      '✓ FIX Sandbox Not Found — allowedHosts true, 0.0.0.0, CORS'
    ].join('<br>');
  }

  renderCompendium(){
    const cont=document.getElementById('compendium-content');
    if(!cont) return;
    cont.innerHTML='';
    if(this.currentCompendiumTab==='items'){
      const items=[
        {name:'Miecz żelazny', value:120, desc:'Broń podstawowa, wymaga ostrzenia, skuteczny vs brak pancerza', where:'Kowal, kuźnia, 3x żelazo + drewno'},
        {name:'Sól', value:12, desc:'Towar, drożeje przy blokadzie portu x2, przemyt wysoki zysk', where:'Port, przemytnicy, kryjówki w beczkach'},
        {name:'Zioła', value:30, desc:'Leczenie, alchemia, mikstury, bandaże — podczas zarazy x3', where:'Bagna, zielarka, zbieractwo'},
        {name:'Bandaż', value:15, desc:'Zatrzymuje krwotok, -20 severity, wymaga płótno 2x + zioła', where:'Wytwarzanie, medyk, łaźnia'},
        {name:'Relikwia św. Elenema', value:300, desc:'Zakazana, wysoka cena na czarnym rynku, Kościół szuka', where:'Ruiny opactwa, wymaga klucza'},
        {name:'Trucizna', value:80, desc:'Do zadań i zabójstw, kontrabanda, wykrywalna przy przeszukaniu', where:'Alchemia lvl4, grzyby trujące'},
        {name:'Chleb', value:5, desc:'Głód -30, gotowanie zboże 2x + woda', where:'Kuchnia, karczma, wsie'},
        {name:'Piwo', value:6, desc:'Pragnienie -30, lekki alkohol, warzenie zboże + woda 2x', where:'Browar, karczma'},
      ];
      items.forEach(it=>{
        const el=document.createElement('div'); el.className='card';
        el.innerHTML=`<h4>${it.name} • ${it.value} koron</h4><p style="font-size:12px">${it.desc}</p><p style="font-size:10px;color:#8a6d4b;margin-top:5px">Gdzie: ${it.where}</p>`;
        cont.appendChild(el);
      });
    } else if(this.currentCompendiumTab==='bestiary'){
      const beasts=[
        {name:'Wilk bagienny', desc:'Sfora 3-5, niebezpieczny, skóra 25 koron, mięso 15', unlocked:true},
        {name:'Jeleń', desc:'Płochliwy, mięso i skóra, tropienie po śladach', unlocked:true},
        {name:'Dzik', desc:'Agresywny gdy zraniony, 80 HP, szarża', unlocked:false},
        {name:'Niedźwiedź', desc:'Bardzo niebezpieczny, rzadki 5%, 150 HP', unlocked:false},
        {name:'Rośliny i grzyby', desc:'Zioła lecznicze, grzyby - ryzyko pomyłki, kompendium pomaga', unlocked:true},
        {name:'Ryby', desc:'Płoć, szczupak, węgorz — rybołówstwo, wymaga wędki i przynęty', unlocked:false},
      ];
      beasts.forEach(b=>{
        const el=document.createElement('div'); el.className='card';
        el.style.opacity=b.unlocked?'1':'0.5';
        el.innerHTML=`<h4>${b.name} ${b.unlocked?'✓':'🔒'}</h4><p style="font-size:12px">${b.desc}</p><p style="font-size:10px;color:#8a6d4b">Wpis odblokowany przez obserwację, polowanie, zbieranie lub rozmowę ze specjalistą (zielarka, tropicielka)</p>`;
        cont.appendChild(el);
      });
    } else if(this.currentCompendiumTab==='quests'){
      cont.innerHTML=QUEST_TEMPLATES.map(q=>`<div class="card"><h4>${q.title} [${q.status}] • ${q.type}</h4><p style="font-size:11px">${q.desc}</p><div style="font-size:10px;color:#8a6d4b">${q.giver} • ${q.location} • Cele: ${q.objectives.join(', ')}</div></div>`).join('');
    } else {
      cont.innerHTML=`<div class="card"><h4>Zapiski Johna - Dziennik • Odkrywane wraz z postępem fabuły</h4><p style="font-size:13px;line-height:1.6">
      Dzień 1: Przypłynąłem. Elenem śmierdzi rybą i błotem. 100 koron w sakwie, 10 000 długu. Dzicy Rycerze... pamiętam ich z kontynentu. Byłem jednym z nich? Nie, byłem najemnikiem. Ale co się stało w 1428? Dlaczego jestem winien?<br><br>
      Dzień 3: Spotkałem starą znajomą w karczmie. Mówi, że mój dług to nie pieniądze, to krew. Zabiłem kogoś ważnego? Dziecko? Pożar opactwa?<br><br>
      Dzień 7: Sen o pożarze. O opactwie. O dziecku? Opat patrzy na mnie dziwnie. Relikwia zaginiona — może to klucz?<br><br>
      Dzień 12: Przemytnicy mówią o łodzi w klifach. Ucieczka? Ale dokąd? Dług zostanie. Rycerze mają długie ręce.<br><br>
      Dzień 20: Wstąpić do Rycerzy? Rep 80. Zdradzić ich? Straż + Wieśniacy 70. Uczciwie? Niemożliwe w 30 dni bez przestępstwa... Chyba że hazard i rzemiosło.<br><br>
      Dzień 29: Ostatnie dni. Muzyka się zmienia. Poborcy pukają co noc. Czas wybrać zakończenie.<br><br>
      (Dalsze wpisy odblokowują się wraz z postępem fabuły, reputacją, przedmiotami, kompendium)
      </p></div>`;
    }
  }

  updateHUD(){
    const timeEl=document.getElementById('hud-time');
    if(timeEl) timeEl.textContent=gameState.time.getFullString();
    const crownsEl=document.getElementById('hud-crowns');
    if(crownsEl) crownsEl.innerHTML=`${gameState.gold} <span style="color:var(--accent2)">koron</span>`;
    const debtEl=document.getElementById('hud-debt');
    if(debtEl) debtEl.textContent=`DŁUG: ${gameState.debt.remaining} / ${gameState.time.maxDays-gameState.time.day} dni`;
    const weatherEl=document.getElementById('hud-weather');
    if(weatherEl) weatherEl.textContent=`${gameState.weather.current} • ${Math.round(gameState.weather.temperature)}°C`;
    const stealthEl=document.getElementById('hud-stealth');
    if(stealthEl){
      const hidden=(gameState as any).stealth?.isHidden;
      stealthEl.textContent=hidden?'UKRYTY':'WIDOCZNY';
      stealthEl.style.color=hidden?'#7ab060':'#c94a3a';
    }
    const healthBar=document.getElementById('bar-health') as HTMLElement;
    if(healthBar) healthBar.style.width=gameState.needs.health+'%';
    const healthVal=document.getElementById('health-val');
    if(healthVal) healthVal.textContent=Math.round(gameState.needs.health)+'%';
    const staminaBar=document.getElementById('bar-stamina') as HTMLElement;
    if(staminaBar) staminaBar.style.width=(100-gameState.needs.fatigue)+'%';
    const staminaVal=document.getElementById('stamina-val');
    if(staminaVal) staminaVal.textContent=Math.round(100-gameState.needs.fatigue)+'%';
    const hungerBar=document.getElementById('bar-hunger') as HTMLElement;
    if(hungerBar) hungerBar.style.width=(100-gameState.needs.hunger)+'%';
    const thirstBar=document.getElementById('bar-thirst') as HTMLElement;
    if(thirstBar) thirstBar.style.width=(100-gameState.needs.thirst)+'%';
    const fatigueBar=document.getElementById('bar-fatigue') as HTMLElement;
    if(fatigueBar) fatigueBar.style.width=gameState.needs.fatigue+'%';
    const dirtBar=document.getElementById('bar-dirt') as HTMLElement;
    if(dirtBar) dirtBar.style.width=gameState.needs.dirt+'%';
    const scarVal=document.getElementById('scar-val');
    if(scarVal) scarVal.textContent=gameState.injury.scars.length.toString();
    const scarsBar=document.getElementById('bar-scars') as HTMLElement;
    if(scarsBar) scarsBar.style.width=Math.min(100, gameState.injury.scars.length*10)+'%';
    const rumorVal=document.getElementById('rumor-val');
    if(rumorVal) rumorVal.textContent=gameState.rumor.getActiveRumors().length.toString();
    const skillPoints=document.getElementById('skill-points');
    if(skillPoints) skillPoints.textContent=gameState.skillPoints.toString();
  }

  toast(msg:string, type:'info'|'success'|'warning'|'error'='info'){
    const el=document.createElement('div');
    el.style.padding='7px 12px'; el.style.background=type==='error'?'#6b2a2a':type==='success'?'#2a4a2a':type==='warning'?'#5a4a2a':'#2a2520';
    el.style.border='1px solid #4a3f35'; el.style.fontSize='12px'; el.style.pointerEvents='auto'; el.style.maxWidth='360px';
    el.style.fontFamily='EB Garamond'; el.style.lineHeight='1.3';
    el.textContent=msg;
    this.toastContainer.appendChild(el);
    setTimeout(()=>{ el.style.opacity='0'; setTimeout(()=>el.remove(),300); }, 4000);
  }

  open(id:string){
    this.overlays.get(id)?.classList.add('open');
    if(id==='compendium') this.renderCompendium();
    if(id==='map') this.bindMap();
    if(id==='skills') this.bindSkills();
    gameState.time.paused=true;
    try{ document.exitPointerLock(); }catch{}
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
