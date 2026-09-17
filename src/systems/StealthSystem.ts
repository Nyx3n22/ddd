export class StealthSystem {
  lightLevel = 0.5; // 0 dark, 1 bright
  noiseLevel = 0;
  isCrouching = false;
  isHidden = false;

  update(playerPos:{x:number,y:number,z:number}, lights:{x:number,y:number,z:number,intensity:number}[], isMoving:boolean, surface:'soft'|'hard'|'grass'){
    // light calculation
    let light = 0.1; // ambient night
    lights.forEach(l=>{
      const dist = Math.hypot(l.x-playerPos.x, l.z-playerPos.z);
      const atten = Math.max(0, 1 - dist/15) * l.intensity;
      light+=atten;
    });
    this.lightLevel = Math.min(1, light);

    // noise
    let noise = 0;
    if(isMoving){
      const surfaceMod = surface==='soft'?0.3: surface==='grass'?0.5:1;
      const crouchMod = this.isCrouching?0.4:1;
      noise = 0.5 * surfaceMod * crouchMod;
      if(!this.isCrouching) noise+=0.2;
    }
    this.noiseLevel = noise;

    this.isHidden = this.lightLevel<0.3 && noise<0.3;
  }

  getDetectionChance(distance:number, npcAlert:number){
    const lightFactor = this.lightLevel;
    const noiseFactor = this.noiseLevel;
    const distFactor = Math.max(0, 1 - distance/20);
    return (lightFactor*0.4 + noiseFactor*0.4 + distFactor*0.2) * (npcAlert/100);
  }

  // lockpicking minigame
  lockpick(difficulty:number, skill:number):boolean{
    const chance = 0.3 + skill*0.15 - difficulty*0.1;
    return Math.random()<chance;
  }

  pickpocket(skill:number, targetAlert:number):boolean{
    const chance = 0.5 + skill*0.1 - targetAlert*0.01;
    return Math.random()<chance;
  }
}
