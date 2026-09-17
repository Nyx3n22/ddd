export type WeatherType = 'clear'|'rain'|'fog'|'storm'|'snow';
export class WeatherSystem {
  current:WeatherType = 'fog';
  temperature = 9;
  wind = 0.3;
  humidity = 0.7;
  stormActive = false;
  plagueActive = false;

  private weights:Record<WeatherType,number> = { clear:0.3, rain:0.25, fog:0.25, storm:0.1, snow:0.1 };

  rollDaily(season:string){
    if(this.plagueActive) return;
    if(season==='Zima'){ this.weights.snow=0.4; this.weights.storm=0.2; }
    if(season==='Lato'){ this.weights.clear=0.5; this.weights.snow=0; }
    const r=Math.random();
    let acc=0;
    for(const [w,wt] of Object.entries(this.weights)){
      acc+=wt;
      if(r<acc){ this.set(w as WeatherType); break; }
    }
    this.temperature = season==='Zima'? -2+Math.random()*8 : season==='Lato'? 18+Math.random()*10 : 8+Math.random()*10;
  }

  set(w:WeatherType){
    this.current=w;
    this.stormActive = w==='storm';
  }

  getVisibilityModifier(){
    if(this.current==='fog') return 0.4;
    if(this.current==='storm') return 0.5;
    if(this.current==='rain') return 0.7;
    return 1;
  }
  getTrackingModifier(){
    if(this.current==='rain') return 0.3; // ślady zmyte
    if(this.current==='snow') return 1.5; // ślady widoczne
    return 1;
  }
  isSeaBlocked(){ return this.current==='storm'; }

  serialize(){ return {current:this.current,temp:this.temperature,plague:this.plagueActive}; }
  deserialize(d:any){ this.current=d.current; this.temperature=d.temp; this.plagueActive=d.plague||false; }
}
