import { TimeSystem } from './TimeSystem';
import { DebtSystem } from '../systems/DebtSystem';
import { ReputationSystem } from '../systems/ReputationSystem';
import { RumorSystem } from '../systems/RumorSystem';
import { CrimeSystem } from '../systems/CrimeSystem';
import { EconomySystem } from '../systems/EconomySystem';
import { WeatherSystem } from '../systems/WeatherSystem';
import { NeedsSystem } from '../systems/NeedsSystem';
import { InjurySystem } from '../systems/InjurySystem';
import { PlayerState } from '../player/PlayerState';
import { eventBus } from './EventBus';

export class GameState {
  time = new TimeSystem();
  debt = new DebtSystem();
  reputation = new ReputationSystem();
  rumor = new RumorSystem();
  crime = new CrimeSystem();
  economy = new EconomySystem();
  weather = new WeatherSystem();
  needs = new NeedsSystem();
  injury = new InjurySystem();
  player = new PlayerState();

  gold = 100;
  skillPoints = 3;
  hardcore = false;
  fpp = true;

  constructor(){
    eventBus.on('dayChanged', ()=>{ this.economy.onDayChanged(this.time.day); this.weather.rollDaily(this.time.season); });
  }

  serialize(){
    return JSON.stringify({
      time:this.time.serialize(),
      debt:this.debt.serialize(),
      reputation:this.reputation.serialize(),
      rumor:this.rumor.serialize(),
      crime:this.crime.serialize(),
      economy:this.economy.serialize(),
      weather:this.weather.serialize(),
      needs:this.needs.serialize(),
      injury:this.injury.serialize(),
      player:this.player.serialize(),
      gold:this.gold,
      skillPoints:this.skillPoints,
      hardcore:this.hardcore
    });
  }
  deserialize(json:string){
    try{
      const d = JSON.parse(json);
      this.time.deserialize(d.time);
      this.debt.deserialize(d.debt);
      this.reputation.deserialize(d.reputation);
      this.rumor.deserialize(d.rumor);
      this.crime.deserialize(d.crime);
      this.economy.deserialize(d.economy);
      this.weather.deserialize(d.weather);
      this.needs.deserialize(d.needs);
      this.injury.deserialize(d.injury);
      this.player.deserialize(d.player);
      this.gold=d.gold; this.skillPoints=d.skillPoints; this.hardcore=d.hardcore;
    }catch(e){ console.error('Failed to deserialize',e); }
  }
}
export const gameState = new GameState();
