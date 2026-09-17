export type WeaponType = 'sword'|'axe'|'mace'|'bow'|'crossbow'|'knife';
export type AttackDir = 'left'|'right'|'up'|'down'|'thrust';

export class CombatSystem {
  stamina = 100;
  maxStamina = 100;
  health = 100;
  isBlocking = false;
  parryWindow = 0; // seconds
  attackCooldown = 0;

  private regenDelay = 0;

  tick(dt:number){
    if(this.parryWindow>0) this.parryWindow-=dt;
    if(this.attackCooldown>0) this.attackCooldown-=dt;
    if(this.regenDelay>0) this.regenDelay-=dt;
    else {
      this.stamina = Math.min(this.maxStamina, this.stamina + dt*15);
    }
  }

  attack(dir:AttackDir, weapon:WeaponType):{damage:number, staminaCost:number}|null{
    if(this.attackCooldown>0 || this.stamina<10) return null;
    const costs:Record<WeaponType,number> = { sword:15, axe:25, mace:20, bow:10, crossbow:5, knife:8 };
    const dmg:Record<WeaponType,number> = { sword:25, axe:35, mace:30, bow:20, crossbow:40, knife:15 };
    const dirMod:Record<AttackDir,number> = { left:1, right:1, up:1.2, down:0.9, thrust:1.3 };
    const cost=costs[weapon]||15;
    if(this.stamina<cost) return null;
    this.stamina-=cost;
    this.regenDelay=0.8;
    this.attackCooldown=0.6;
    return { damage:dmg[weapon]*dirMod[dir], staminaCost:cost };
  }

  startBlock(){ this.isBlocking=true; this.parryWindow=0.3; }
  stopBlock(){ this.isBlocking=false; }

  tryParry(attackerDamage:number):boolean{
    if(this.parryWindow>0 && this.isBlocking){
      this.stamina-=10;
      return true;
    }
    return false;
  }

  takeDamage(dmg:number, armor:number){
    const mitigated = Math.max(0, dmg - armor);
    this.health = Math.max(0, this.health - mitigated);
    return mitigated;
  }

  isDead(){ return this.health<=0; }
}
