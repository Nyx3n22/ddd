export type SkillBranch = 'combat'|'stealth'|'crafting'|'trade'|'survival'|'knowledge';
export type Skill = { id:string, name:string, branch:SkillBranch, level:number, max:number, desc:string, requires?:{teacher?:string,gold?:number,rep?:{faction:string,value:number}}, perk:boolean };

export const SKILLS: Skill[] = [
  // Walka
  {id:'sword', name:'Szermierka', branch:'combat', level:0, max:5, desc:'+10% obrażeń mieczem, nowe ataki kierunkowe', perk:false},
  {id:'parry', name:'Parowanie', branch:'combat', level:0, max:3, desc:'Zwiększa okno parowania, wymaga nauczyciela', requires:{teacher:'mistrz_szermierki',gold:100,rep:{faction:'wildKnights',value:10}}, perk:true},
  {id:'heavy', name:'Broń ciężka', branch:'combat', level:0, max:3, desc:'Topory i młoty skuteczne przeciw pancerzom', perk:false},
  {id:'archery', name:'Łucznictwo', branch:'combat', level:0, max:4, desc:'Celność łuku i kuszy', perk:false},
  // Skradanie
  {id:'stealth_move', name:'Cichy chód', branch:'stealth', level:0, max:5, desc:'Mniej hałasu, ukrycie w cieniu', perk:false},
  {id:'lockpick', name:'Wytrychy', branch:'stealth', level:0, max:4, desc:'Otwieranie zamków, minigra', requires:{teacher:'złodziej',gold:50}, perk:true},
  {id:'pickpocket', name:'Kieszonkowstwo', branch:'stealth', level:0, max:4, desc:'Kradzież kieszonkowa', perk:true},
  {id:'smuggle', name:'Przemyt', branch:'stealth', level:0, max:3, desc:'Ukrywanie kontrabandy, fałszywe dokumenty', perk:true},
  // Rzemiosło
  {id:'smithing', name:'Kowalstwo', branch:'crafting', level:0, max:5, desc:'Broń, narzędzia, naprawa', perk:false},
  {id:'alchemy', name:'Alchemia', branch:'crafting', level:0, max:5, desc:'Mikstury, trucizny, lekarstwa', requires:{teacher:'zielarka',gold:80}, perk:false},
  {id:'tanning', name:'Garbarstwo', branch:'crafting', level:0, max:3, desc:'Skóry, pancerze lekkie', perk:false},
  {id:'cooking', name:'Gotowanie', branch:'crafting', level:0, max:3, desc:'Jedzenie, warzenie piwa', perk:false},
  // Handel
  {id:'persuasion', name:'Perswazja', branch:'trade', level:0, max:5, desc:'Opcje dialogowe, lepsze ceny', perk:false},
  {id:'intimidation', name:'Zastraszanie', branch:'trade', level:0, max:4, desc:'Wymuszenia, groźby', perk:true},
  {id:'lying', name:'Kłamstwo', branch:'trade', level:0, max:4, desc:'Oszustwa, ale mogą zostać zweryfikowane', perk:true},
  {id:'barter', name:'Handel', branch:'trade', level:0, max:5, desc:'-5% ceny za poziom', perk:false},
  // Przetrwanie
  {id:'tracking', name:'Tropienie', branch:'survival', level:0, max:4, desc:'Ślady zwierząt, polowania', perk:false},
  {id:'herbalism', name:'Zielarstwo', branch:'survival', level:0, max:4, desc:'Rozpoznawanie ziół i grzybów', perk:false},
  {id:'fishing', name:'Rybołówstwo', branch:'survival', level:0, max:3, desc:'Połów ryb', perk:false},
  {id:'endurance', name:'Wytrzymałość', branch:'survival', level:0, max:5, desc:'+10 stamina, odporność na choroby', perk:false},
  // Wiedza
  {id:'reading', name:'Czytanie map', branch:'knowledge', level:0, max:3, desc:'Szybsze odkrywanie mapy', perk:false},
  {id:'history', name:'Historia Elenem', branch:'knowledge', level:0, max:4, desc:'Wpisy w kompendium, dialogi z Kościołem', perk:false},
  {id:'anatomy', name:'Anatomia', branch:'knowledge', level:0, max:3, desc:'Obrażenia lokalizacyjne, leczenie', requires:{teacher:'medyk',gold:120}, perk:true},
];

export class PlayerState {
  skills = new Map<string, number>();
  skillUsage = new Map<string, number>(); // for hybrid growth
  level = 1;
  inventory = new Map<string, {qty:number, quality:number}>();
  equipment:{weapon?:string, armor?:string, torch?:boolean} = {};
  position = {x:0,y:2,z:0};
  rotation = {x:0,y:0};

  constructor(){
    SKILLS.forEach(s=>this.skills.set(s.id,0));
    // starting items
    this.inventory.set('chleb', {qty:3, quality:1});
    this.inventory.set('bandaż', {qty:2, quality:1});
    this.inventory.set('nóż', {qty:1, quality:0.8});
    this.inventory.set('pochodnia', {qty:1, quality:1});
    this.equipment.weapon='nóż';
  }

  getSkill(id:string){ return this.skills.get(id) ?? 0; }
  addSkillPoint(id:string){
    const cur=this.getSkill(id);
    const def=SKILLS.find(s=>s.id===id);
    if(!def) return false;
    if(cur>=def.max) return false;
    this.skills.set(id, cur+1);
    return true;
  }
  useSkill(id:string, amount=1){
    const cur=this.skillUsage.get(id) ?? 0;
    this.skillUsage.set(id, cur+amount);
    // every 100 uses, auto level if not max and not perk-locked
    if(cur>100){
      const def=SKILLS.find(s=>s.id===id);
      if(def && !def.perk && this.getSkill(id)<def.max){
        this.skillUsage.set(id,0);
        this.addSkillPoint(id);
      }
    }
  }

  addItem(item:string, qty:number, quality=1){
    const cur=this.inventory.get(item);
    if(cur) this.inventory.set(item,{qty:cur.qty+qty, quality:Math.max(cur.quality,quality)});
    else this.inventory.set(item,{qty,quality});
  }
  removeItem(item:string, qty:number):boolean{
    const cur=this.inventory.get(item);
    if(!cur || cur.qty<qty) return false;
    cur.qty-=qty;
    if(cur.qty<=0) this.inventory.delete(item);
    else this.inventory.set(item,cur);
    return true;
  }
  hasItem(item:string, qty=1){ return (this.inventory.get(item)?.qty ?? 0)>=qty; }

  serialize(){ return {skills:Array.from(this.skills.entries()), usage:Array.from(this.skillUsage.entries()), inv:Array.from(this.inventory.entries()), equip:this.equipment, pos:this.position, rot:this.rotation}; }
  deserialize(d:any){ this.skills=new Map(d.skills); this.skillUsage=new Map(d.usage); this.inventory=new Map(d.inv); this.equipment=d.equip; this.position=d.pos; this.rotation=d.rot; }
}
