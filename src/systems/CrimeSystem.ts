export type CrimeType = 'theft'|'assault'|'murder'|'smuggling'|'trespass';
export type CrimeRecord = { id:string, type:CrimeType, day:number, bounty:number, witnesses:number, evidence:string[], location:string, solved:boolean };

export class CrimeSystem {
  crimes:CrimeRecord[] = [];
  wantedLevel = 0; // 0-100
  bounty = 0;
  isWanted = false;

  commit(type:CrimeType, opts:{witnesses?:number, location?:string, evidence?:string[]}){
    const bountyMap:Record<CrimeType,number> = { theft:50, assault:150, murder:500, smuggling:200, trespass:20 };
    const rec:CrimeRecord = {
      id:Math.random().toString(36).slice(2),
      type,
      day:0,
      bounty:bountyMap[type],
      witnesses:opts.witnesses??0,
      evidence:opts.evidence??[],
      location:opts.location??'Port',
      solved:false
    };
    this.crimes.push(rec);
    if(opts.witnesses && opts.witnesses>0){
      this.wantedLevel = Math.min(100, this.wantedLevel + opts.witnesses*15 + bountyMap[type]/10);
      this.bounty+=rec.bounty;
      this.isWanted = this.wantedLevel>30;
    }
    return rec;
  }

  // guard doesn't know automatically - needs investigation
  investigate(){
    const unsolved = this.crimes.filter(c=>!c.solved);
    let detected = 0;
    unsolved.forEach(c=>{
      const chance = (c.witnesses*0.2 + c.evidence.length*0.15 + this.wantedLevel/100*0.3);
      if(Math.random()<chance){ c.solved=true; detected++; }
    });
    return detected;
  }

  payFine(amount:number){
    this.bounty=Math.max(0,this.bounty-amount);
    if(this.bounty===0){ this.wantedLevel=Math.max(0,this.wantedLevel-30); this.isWanted=this.wantedLevel>30; }
  }
  bribe(amount:number):boolean{
    const success = amount >= this.bounty*0.5;
    if(success){ this.bounty=0; this.wantedLevel=0; this.isWanted=false; }
    return success;
  }
  serveJail(days:number){
    this.wantedLevel=0; this.bounty=0; this.isWanted=false;
    return days; // time lost
  }

  serialize(){ return {crimes:this.crimes,wanted:this.wantedLevel,bounty:this.bounty}; }
  deserialize(d:any){ this.crimes=d.crimes||[]; this.wantedLevel=d.wanted||0; this.bounty=d.bounty||0; this.isWanted=this.wantedLevel>30; }
}
