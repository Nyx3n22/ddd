type ItemPrice = { base:number, current:number, supply:number, demand:number, contraband?:boolean };
export class EconomySystem {
  private prices = new Map<string, ItemPrice>();
  private merchantGold = new Map<string, number>();
  private events: string[] = [];

  constructor(){
    const items = [
      ['sól', 12, false], ['zboże', 8, false], ['mięso', 15, false], ['skóra', 25, false],
      ['żelazo', 40, false], ['broń', 120, true], ['alkohol', 20, true], ['zioła', 30, false],
      ['relikwie', 300, true], ['trucizna', 80, true], ['chleb', 5, false], ['piwo', 6, false],
      ['drewno', 10, false], ['ryba', 12, false]
    ] as const;
    items.forEach(([name,base,contraband])=>{
      this.prices.set(name, {base, current:base, supply:100, demand:100, contraband});
    });
    ['kupiec_portowy','karczmarz','kowal','zielarka','lichwiarz'].forEach(m=>this.merchantGold.set(m, 500+Math.random()*1000));
  }

  getPrice(item:string){ return this.prices.get(item)?.current ?? 10; }
  getAll(){ return Array.from(this.prices.entries()).map(([name,p])=>({name,...p})); }

  onDayChanged(day:number){
    // supply/demand fluctuation + season
    this.prices.forEach((p,name)=>{
      const seasonal = Math.sin(day/5)*0.1;
      const random = (Math.random()-0.5)*0.2;
      const supplyFactor = (100-p.supply)/100*0.5;
      const demandFactor = (p.demand-100)/100*0.5;
      p.current = Math.max(1, Math.round(p.base * (1+seasonal+random+supplyFactor+demandFactor)));
    });
  }

  buy(item:string, qty:number, merchant:string){
    const p=this.prices.get(item); if(!p) return false;
    p.supply = Math.max(0, p.supply - qty*5);
    p.demand = Math.min(200, p.demand + qty*2);
    const gold = this.merchantGold.get(merchant) ?? 0;
    this.merchantGold.set(merchant, gold - p.current*qty);
    return true;
  }
  sell(item:string, qty:number, merchant:string){
    const p=this.prices.get(item); if(!p) return false;
    p.supply = Math.min(200, p.supply + qty*5);
    p.demand = Math.max(0, p.demand - qty*2);
    const gold = this.merchantGold.get(merchant) ?? 0;
    this.merchantGold.set(merchant, gold + p.current*qty*0.7);
    return true;
  }

  triggerEvent(event:string){
    this.events.push(event);
    if(event==='blokada_portu'){ const salt=this.prices.get('sól'); if(salt) salt.current*=2; }
    if(event==='zaraza'){ const herbs=this.prices.get('zioła'); if(herbs) herbs.current*=3; }
  }

  getMerchantGold(m:string){ return this.merchantGold.get(m) ?? 0; }

  serialize(){ return {prices:Array.from(this.prices.entries()), gold:Array.from(this.merchantGold.entries()), events:this.events}; }
  deserialize(d:any){ this.prices=new Map(d.prices); this.merchantGold=new Map(d.gold); this.events=d.events||[]; }
}
