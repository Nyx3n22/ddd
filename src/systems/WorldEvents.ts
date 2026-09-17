export type WorldEventType = 'ambush'|'caravan'|'wreck'|'fire'|'fair'|'execution'|'procession'|'raid'|'duel'|'plague';
export type WorldEvent = { id:string, type:WorldEventType, location:string, day:number, weight:number, cooldown:number, active:boolean, desc:string };

export const EVENT_TEMPLATES: Omit<WorldEvent,'id'|'day'|'active'>[] = [
  {type:'ambush', location:'Gościniec', weight:0.2, cooldown:2, desc:'Napad na gościńcu - bandyci atakują kupca'},
  {type:'caravan', location:'Port', weight:0.3, cooldown:1, desc:'Karawana kupiecka przybyła - rzadkie towary'},
  {type:'wreck', location:'Plaża', weight:0.1, cooldown:3, desc:'Wrak na plaży po sztormie - można splądrować'},
  {type:'fire', location:'Miasto', weight:0.05, cooldown:5, desc:'Pożar w dzielnicy! Straż potrzebuje pomocy'},
  {type:'fair', location:'Rynek', weight:0.15, cooldown:4, desc:'Jarmark - hazard, wyścigi, kości'},
  {type:'execution', location:'Rynek', weight:0.08, cooldown:3, desc:'Egzekucja na rynku - tłum i okazje dla kieszonkowców'},
  {type:'procession', location:'Miasto', weight:0.1, cooldown:2, desc:'Procesja kościelna - błogosławieństwo lub kradzież relikwii'},
  {type:'raid', location:'Wieś', weight:0.12, cooldown:3, desc:'Obława straży - lepiej nie mieć kontrabandy'},
  {type:'duel', location:'Rynek', weight:0.07, cooldown:4, desc:'Pojedynek rycerski - zakłady'},
  {type:'plague', location:'Miasto', weight:0.02, cooldown:10, desc:'ZARAZA! Kwarantanna, rosnące ceny, nowe questy'},
];

export class WorldEventSystem {
  events:WorldEvent[] = [];
  lastEventDay = new Map<WorldEventType, number>();
  activeEvents:WorldEvent[] = [];

  rollDaily(day:number){
    if(Math.random()<0.6){ // 60% chance daily event
      const available = EVENT_TEMPLATES.filter(t=>{
        const last = this.lastEventDay.get(t.type) ?? -100;
        return day - last >= t.cooldown;
      });
      if(available.length===0) return null;
      const totalWeight = available.reduce((s,e)=>s+e.weight,0);
      let r=Math.random()*totalWeight;
      for(const tmpl of available){
        r-=tmpl.weight;
        if(r<=0){
          const ev:WorldEvent = { ...tmpl, id:Math.random().toString(36).slice(2), day, active:true };
          this.events.push(ev);
          this.activeEvents.push(ev);
          this.lastEventDay.set(ev.type, day);
          return ev;
        }
      }
    }
    return null;
  }

  clearOld(day:number){
    this.activeEvents = this.activeEvents.filter(e=>day - e.day < 2);
  }

  getActive(){ return this.activeEvents; }
}
