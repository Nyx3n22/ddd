export type Recipe = { id:string, name:string, skill:'smithing'|'alchemy'|'tanning'|'carpentry'|'cooking'|'brewing', level:number, ingredients:{item:string,qty:number}[], result:{item:string,qty:number,quality:number}, workshop:string };

export const RECIPES:Recipe[] = [
  {id:'iron_sword', name:'Miecz żelazny', skill:'smithing', level:2, ingredients:[{item:'żelazo',qty:3},{item:'drewno',qty:1}], result:{item:'miecz_żelazny',qty:1,quality:1}, workshop:'kuźnia'},
  {id:'bandage', name:'Bandaż', skill:'alchemy', level:1, ingredients:[{item:'płótno',qty:2},{item:'zioła',qty:1}], result:{item:'bandaż',qty:3,quality:1}, workshop:'alchemia'},
  {id:'healing_potion', name:'Mikstura lecznicza', skill:'alchemy', level:3, ingredients:[{item:'zioła',qty:3},{item:'woda',qty:1}], result:{item:'mikstura_lecznicza',qty:1,quality:1}, workshop:'alchemia'},
  {id:'leather_armor', name:'Skórzany kaftan', skill:'tanning', level:2, ingredients:[{item:'skóra',qty:4}], result:{item:'kaftan_skórzany',qty:1,quality:1}, workshop:'garbarnia'},
  {id:'bread', name:'Chleb', skill:'cooking', level:1, ingredients:[{item:'zboże',qty:2},{item:'woda',qty:1}], result:{item:'chleb',qty:2,quality:1}, workshop:'kuchnia'},
  {id:'beer', name:'Piwo', skill:'brewing', level:1, ingredients:[{item:'zboże',qty:1},{item:'woda',qty:2}], result:{item:'piwo',qty:3,quality:1}, workshop:'browar'},
  {id:'poison', name:'Trucizna', skill:'alchemy', level:4, ingredients:[{item:'grzyby_trujące',qty:2},{item:'zioła',qty:1}], result:{item:'trucizna',qty:1,quality:1}, workshop:'alchemia'},
];

export class CraftingSystem {
  knownRecipes = new Set<string>(['bandage','bread']);

  learn(id:string){ this.knownRecipes.add(id); }
  canCraft(id:string, inventory:Map<string,number>, skillLevel:number, workshop:string){
    const r=RECIPES.find(x=>x.id===id); if(!r) return false;
    if(!this.knownRecipes.has(id)) return false;
    if(skillLevel<r.level) return false;
    if(r.workshop!==workshop) return false;
    for(const ing of r.ingredients){ if((inventory.get(ing.item)||0)<ing.qty) return false; }
    return true;
  }
  craft(id:string, inventory:Map<string,number>, skillLevel:number){
    const r=RECIPES.find(x=>x.id===id); if(!r) return null;
    for(const ing of r.ingredients){ inventory.set(ing.item, (inventory.get(ing.item)||0)-ing.qty); }
    const quality = 0.8 + skillLevel*0.1 + Math.random()*0.2;
    return { ...r.result, quality: Math.min(1.5, quality) };
  }
}
