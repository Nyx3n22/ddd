// Group remaining systems to keep file count manageable but still modular

export class SmugglingSystem {
  hiddenStashes = new Map<string, {item:string, qty:number}>();
  hasFalseDocs = false;
  searchRisk = 0.3;
  addStash(location:string, item:string, qty:number){ this.hiddenStashes.set(location, {item,qty}); }
  attemptSmuggle(guardAlert:number):boolean{
    const risk = this.searchRisk + guardAlert/100*0.5 - (this.hasFalseDocs?0.3:0);
    return Math.random()>risk;
  }
}

export class DiseaseSystem {
  diseases:{type:string, severity:number, day:number}[] = [];
  plague = false;
  infect(type:string, severity:number, day:number){
    this.diseases.push({type,severity,day});
    if(type==='zaraza') this.plague=true;
  }
  tick(day:number){
    this.diseases.forEach(d=>{
      if(day-d.day>3) d.severity-=10;
    });
    this.diseases=this.diseases.filter(d=>d.severity>0);
    if(this.diseases.length===0) this.plague=false;
  }
}

export class NPCScheduleSystem {
  schedules = new Map<string, {hour:number, activity:string, location:string}[]>();
  constructor(){
    this.schedules.set('strażnik_portu', [{hour:6,activity:'patrol',location:'Port'}, {hour:12,activity:'karczma',location:'Karczma'}, {hour:20,activity:'sen',location:'Koszary'}]);
    this.schedules.set('kupiec', [{hour:7,activity:'sklep',location:'Port'}, {hour:19,activity:'dom',location:'Miasto'}]);
    this.schedules.set('zielarka', [{hour:5,activity:'zbieranie',location:'Bagna'}, {hour:14,activity:'sklep',location:'Miasto'}]);
  }
  getActivity(npc:string, hour:number){
    const sched=this.schedules.get(npc);
    if(!sched) return {activity:'idle',location:'unknown'};
    let cur=sched[0];
    for(const s of sched){ if(hour>=s.hour) cur=s; }
    return cur;
  }
}

export class CompanionSystem {
  companions:{id:string,name:string,trust:number,costPerDay:number,active:boolean,quest:string}[] = [
    {id:'najemnik', name:'Najemnik - Gruby Henk', trust:30, costPerDay:15, active:false, quest:'Ochrona'},
    {id:'trop', name:'Tropicielka - Mara', trust:50, costPerDay:0, active:true, quest:'Wilki z bagien'}
  ];
  hire(id:string){ const c=this.companions.find(x=>x.id===id); if(c) c.active=true; }
  dailyCost(){ return this.companions.filter(c=>c.active).reduce((s,c)=>s+c.costPerDay,0); }
}

export class PropertySystem {
  properties:{id:string,name:string,type:'room'|'house'|'workshop'|'warehouse',owned:boolean,rent:number,tax:number}[] = [
    {id:'room_port', name:'Pokój w karczmie portowej', type:'room', owned:true, rent:5, tax:0},
    {id:'house_town', name:'Dom w mieście', type:'house', owned:false, rent:0, tax:20},
    {id:'workshop', name:'Warsztat kowalski', type:'workshop', owned:false, rent:0, tax:35},
    {id:'warehouse', name:'Magazyn na kontrabandę', type:'warehouse', owned:false, rent:0, tax:50},
  ];
  buy(id:string){ const p=this.properties.find(x=>x.id===id); if(p) p.owned=true; }
  weeklyCost(){ return this.properties.filter(p=>p.owned).reduce((s,p)=>s+p.tax,0); }
}

export class TransportSystem {
  horses:{id:string,name:string,stamina:number,owned:boolean}[] = [
    {id:'nag', name:'Szkapa', stamina:60, owned:false},
    {id:'warhorse', name:'Koń bojowy', stamina:100, owned:false},
  ];
  hasBoat = false;
  hasCart = false;
  fastTravelPoints = new Set<string>(['Port']);
  discover(point:string){ this.fastTravelPoints.add(point); }
  canFastTravel(to:string){ return this.fastTravelPoints.has(to); }
}

export class HuntingSystem {
  animals:{id:string,name:string,rarity:number,compendium:boolean}[] = [
    {id:'wolf', name:'Wilk bagienny', rarity:0.3, compendium:false},
    {id:'deer', name:'Jeleń', rarity:0.5, compendium:false},
    {id:'boar', name:'Dzik', rarity:0.2, compendium:false},
    {id:'bear', name:'Niedźwiedź', rarity:0.05, compendium:false},
  ];
  tracks:{x:number,z:number,type:string,age:number}[] = [];
  addTrack(x:number,z:number,type:string){ this.tracks.push({x,z,type,age:0}); }
  observe(id:string){ const a=this.animals.find(x=>x.id===id); if(a) a.compendium=true; }
}

export class GamblingSystem {
  // dice, cards, wrestling, horseshoe, horse race
  playDice(bet:number, cheatSkill:number):{win:boolean, payout:number, caught:boolean}{
    const cheat = cheatSkill>3 && Math.random()<0.3;
    const caught = cheat && Math.random()<0.2;
    const win = cheat ? true : Math.random()>0.48;
    return {win, payout: win? bet*2 : -bet, caught};
  }
  playCards(bet:number, skill:number){ return this.playDice(bet, skill); }
}

export class EndingSystem {
  endings:{id:string,name:string,desc:string,unlocked:boolean,condition:()=>boolean}[] = [];
  constructor(private getState:()=>any){
    this.endings = [
      {id:'honest', name:'Spłata długu uczciwie', desc:'Uczciwa praca, handel, rzemiosło. Szacunek mieszkańców.', unlocked:false, condition:()=>getState().debt.paid>=getState().debt.total && getState().crime.bounty<100},
      {id:'crime', name:'Spłata z przestępstwa', desc:'Przemyt, kradzieże, zabójstwa. Krew na rękach, ale dług spłacony.', unlocked:false, condition:()=>getState().debt.paid>=getState().debt.total && getState().crime.bounty>=100},
      {id:'escape', name:'Ucieczka z wyspy', desc:'Uciekasz łodzią w sztormie. Dług niespłacony, ale żyjesz.', unlocked:false, condition:()=>getState().transport?.hasBoat && getState().time.day<30},
      {id:'join', name:'Wstąpienie do Dzikich Rycerzy', desc:'Zamiast spłacać, dołączasz do nich. Dług anulowany za przysięgę.', unlocked:false, condition:()=>getState().reputation.get('wildKnights')>80},
      {id:'overthrow', name:'Obalenie Dzikich Rycerzy', desc:'Z pomocą frakcji obalasz Rycerzy. Wyspa wolna.', unlocked:false, condition:()=>getState().reputation.get('cityGuard')>70 && getState().reputation.get('villagers')>70},
      {id:'death', name:'Śmierć lub niewola', desc:'Nie spłaciłeś długu. 30 dni minęło.', unlocked:false, condition:()=>getState().time.day>=30 && getState().debt.paid<getState().debt.total},
    ];
  }
  check(){ this.endings.forEach(e=>{ if(e.condition()) e.unlocked=true; }); return this.endings.filter(e=>e.unlocked); }
}
