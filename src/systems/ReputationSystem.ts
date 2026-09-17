export type FactionId = 'wildKnights'|'cityGuard'|'merchants'|'church'|'smugglers'|'villagers';
export const FACTIONS: {id:FactionId, name:string, desc:string, color:string}[] = [
  {id:'wildKnights', name:'Dzicy Rycerze', desc:'Pół-bandyckie bractwo rycerskie kontrolujące wyspę', color:'#8b3a2f'},
  {id:'cityGuard', name:'Straż Miejska', desc:'Pilnuje porządku, łapówkarstwo powszechne', color:'#4a6a8a'},
  {id:'merchants', name:'Gildia Kupiecka', desc:'Kontroluje ceny i port', color:'#c9a86a'},
  {id:'church', name:'Kościół', desc:'Duchowni, opactwo, relikwie', color:'#8a8a6a'},
  {id:'smugglers', name:'Przemytnicy z Portu', desc:'Czarny rynek, fałszywe dokumenty', color:'#3a3a3a'},
  {id:'villagers', name:'Wieśniacy', desc:'Ubodzy, zabobonni, pamiętliwi', color:'#4a5a3a'},
];

export class ReputationSystem {
  private reps = new Map<FactionId, number>();

  constructor(){ FACTIONS.forEach(f=>this.reps.set(f.id,0)); }

  get(id:FactionId){ return this.reps.get(id) ?? 0; }
  set(id:FactionId, v:number){ this.reps.set(id, Math.max(-100,Math.min(100,v))); }
  add(id:FactionId, delta:number){
    const cur=this.get(id);
    this.set(id, cur+delta);
    // rivalry: gain in one = loss in another
    const rivals:Record<FactionId,FactionId[]> = {
      wildKnights:['cityGuard','villagers'],
      cityGuard:['wildKnights','smugglers'],
      merchants:['smugglers','villagers'],
      church:['smugglers','wildKnights'],
      smugglers:['cityGuard','merchants'],
      villagers:['wildKnights','merchants']
    };
    if(delta>0){
      rivals[id]?.forEach(r=>{ this.set(r, this.get(r)-Math.floor(delta*0.3)); });
    }
  }
  getPriceModifier(id:FactionId){
    const rep=this.get(id);
    // -100 = +50% price, +100 = -30% price
    return 1 - (rep/100)*0.3 + (rep<0 ? (-rep/100)*0.5 : 0);
  }
  canAccess(id:FactionId, threshold:number){ return this.get(id)>=threshold; }
  serialize(){ return Object.fromEntries(this.reps); }
  deserialize(d:any){ Object.entries(d).forEach(([k,v])=>this.reps.set(k as FactionId, v as number)); }
  debugMaxAll(){ FACTIONS.forEach(f=>this.set(f.id,100)); }
  all(){ return FACTIONS.map(f=>({ ...f, rep:this.get(f.id)})); }
}
