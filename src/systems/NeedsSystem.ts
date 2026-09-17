export class NeedsSystem {
  hunger = 20; // 0 full, 100 starving
  thirst = 30;
  fatigue = 20;
  dirt = 10; // 0 clean, 100 filthy
  health = 100;

  tick(dt:number, isSprinting:boolean, isSleeping:boolean){
    // dt in seconds
    const rate = 0.02;
    if(!isSleeping){
      this.hunger = Math.min(100, this.hunger + dt*rate*0.5);
      this.thirst = Math.min(100, this.thirst + dt*rate*0.8);
      this.fatigue = Math.min(100, this.fatigue + dt*rate*0.3 + (isSprinting?dt*rate*2:0));
      this.dirt = Math.min(100, this.dirt + dt*rate*0.1);
    } else {
      this.fatigue = Math.max(0, this.fatigue - dt*5);
    }
    // modifiers
    if(this.hunger>80 || this.thirst>80) this.health = Math.max(0, this.health - dt*0.1);
  }

  eat(amount:number){ this.hunger=Math.max(0,this.hunger-amount); }
  drink(amount:number){ this.thirst=Math.max(0,this.thirst-amount); }
  clean(){ this.dirt=0; }
  sleep(hours:number){ this.fatigue=Math.max(0,this.fatigue-hours*15); }

  getModifiers(){
    return {
      pricePenalty: this.dirt>50 ? 0.2 : 0,
      aimPenalty: this.fatigue>70 ? 0.3 : 0,
      staminaPenalty: this.hunger>60 || this.thirst>60 ? 0.2 : 0
    };
  }

  healAll(){ this.hunger=0; this.thirst=0; this.fatigue=0; this.dirt=0; this.health=100; }

  serialize(){ return {hunger:this.hunger,thirst:this.thirst,fatigue:this.fatigue,dirt:this.dirt,health:this.health}; }
  deserialize(d:any){ Object.assign(this,d); }
}
