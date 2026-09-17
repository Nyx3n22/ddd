import { eventBus } from './EventBus';

export type Season = 'Wiosna'|'Lato'|'Jesień'|'Zima';
export class TimeSystem {
  day = 1;
  maxDays = 30;
  hour = 8;
  minute = 0;
  timeScale = 60; // 1 real sec = 60 game secs? Actually 1 sec = 1 min? Let's make configurable
  private accumulator = 0;
  season:Season = 'Wiosna';
  paused = false;

  constructor(){
    this.updateSeason();
  }

  tick(dt:number){
    if(this.paused) return;
    // dt in seconds real, timeScale converts to game minutes
    // e.g. timeScale 60 means 1 real sec = 60 game secs = 1 game minute
    const gameMinutes = dt * (this.timeScale/60);
    this.minute += gameMinutes;
    while(this.minute >= 60){
      this.minute -= 60;
      this.hour++;
      if(this.hour>=24){
        this.hour=0;
        this.day++;
        this.updateSeason();
        eventBus.emit('dayChanged', this.day);
        if(this.day>this.maxDays){
          eventBus.emit('debtDeadline');
        }
      }
      eventBus.emit('hourChanged', this.hour);
    }
  }

  updateSeason(){
    if(this.day<=8) this.season='Wiosna';
    else if(this.day<=16) this.season='Lato';
    else if(this.day<=24) this.season='Jesień';
    else this.season='Zima';
  }

  getTimeString(){ return `${String(Math.floor(this.hour)).padStart(2,'0')}:${String(Math.floor(this.minute)).padStart(2,'0')}`; }
  getDayString(){ return `Dzień ${this.day} / ${this.maxDays}`; }
  getFullString(){ return `${this.getDayString()} • ${this.getTimeString()} • ${this.season}`; }
  getDayProgress(){ return (this.hour*60+this.minute)/(24*60); }

  sleep(hours:number){
    this.hour+=hours;
    while(this.hour>=24){ this.hour-=24; this.day++; this.updateSeason(); }
    eventBus.emit('slept', hours);
    eventBus.emit('hourChanged', this.hour);
    eventBus.emit('dayChanged', this.day);
  }

  isNight(){ return this.hour<5 || this.hour>=21; }
  isLastFiveDays(){ return this.day>this.maxDays-5; }

  serialize(){ return {day:this.day,hour:this.hour,minute:this.minute,season:this.season}; }
  deserialize(d:any){ this.day=d.day; this.hour=d.hour; this.minute=d.minute; this.season=d.season; }
}
