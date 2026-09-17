type Rumor = { id:string, text:string, dayCreated:number, delayHours:number, spread:number, pos:{x:number,z:number} };

export class RumorSystem {
  rumors:Rumor[] = [];
  playerRenown = 0; // -100 to 100, affects NPC comments
  knownFacts:string[] = [];

  addRumor(text:string, day:number, opts?:Partial<Rumor>){
    const r:Rumor = {
      id:Math.random().toString(36).slice(2),
      text,
      dayCreated:day,
      delayHours:opts?.delayHours ?? 6+Math.random()*12,
      spread:opts?.spread ?? 0,
      pos:opts?.pos ?? {x:0,z:0}
    };
    this.rumors.push(r);
  }

  // called each hour, spread rumors with delay
  tick(currentDay:number, currentHour:number){
    this.rumors.forEach(r=>{
      const hoursPassed = (currentDay - r.dayCreated)*24 + currentHour;
      if(hoursPassed >= r.delayHours){
        r.spread = Math.min(1, r.spread + 0.05);
      }
    });
    this.rumors = this.rumors.filter(r=>r.spread<1.5); // eventually fade
  }

  // kill witness to stop rumor
  killWitness(rumorId:string){
    this.rumors = this.rumors.filter(r=>r.id!==rumorId);
  }
  bribeWitness(rumorId:string){
    const r=this.rumors.find(x=>x.id===rumorId);
    if(r) r.spread*=0.3;
  }

  getActiveRumors(){
    return this.rumors.filter(r=>r.spread>0.2);
  }

  serialize(){ return {rumors:this.rumors, renown:this.playerRenown, facts:this.knownFacts}; }
  deserialize(d:any){ this.rumors=d.rumors||[]; this.playerRenown=d.renown||0; this.knownFacts=d.facts||[]; }
}
