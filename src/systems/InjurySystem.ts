export type BodyPart = 'head'|'torso'|'armL'|'armR'|'legL'|'legR';
export type Injury = { part:BodyPart, type:'cut'|'bruise'|'fracture'|'bleed', severity:number, bleeding:boolean, scar?:boolean };

export class InjurySystem {
  injuries:Injury[] = [];
  scars:string[] = [];

  wound(part:BodyPart, type:Injury['type'], severity:number){
    const inj:Injury = { part, type, severity, bleeding:type==='cut' && severity>30 };
    this.injuries.push(inj);
    if(severity>70) this.scars.push(`${part}-${Date.now()}`);
  }

  tick(dt:number){
    this.injuries.forEach(i=>{
      if(i.bleeding){
        i.severity+=dt*0.05;
        if(i.severity>90) i.bleeding=false; // wykrwawienie? handled elsewhere
      }
    });
    // fracture slows
    this.injuries = this.injuries.filter(i=>i.severity<100);
  }

  getMovementPenalty(){
    let pen=0;
    this.injuries.forEach(i=>{ if(i.part.startsWith('leg') && i.type==='fracture') pen+=0.4; if(i.part.startsWith('leg') && i.type==='cut') pen+=0.1; });
    return Math.min(0.8,pen);
  }
  getAttackPenalty(){
    let pen=0;
    this.injuries.forEach(i=>{ if(i.part.startsWith('arm')) pen+=0.2; if(i.part==='head') pen+=0.3; });
    return Math.min(0.8,pen);
  }
  isBleeding(){ return this.injuries.some(i=>i.bleeding); }

  bandage(part:BodyPart){
    this.injuries.forEach(i=>{ if(i.part===part) { i.bleeding=false; i.severity=Math.max(0,i.severity-20); } });
  }
  healAll(){ this.injuries=[]; }

  serialize(){ return {injuries:this.injuries,scars:this.scars}; }
  deserialize(d:any){ this.injuries=d.injuries||[]; this.scars=d.scars||[]; }
}
