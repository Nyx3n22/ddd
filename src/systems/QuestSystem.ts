export type QuestStatus = 'active'|'completed'|'failed'|'lost';
export type Quest = { id:string, title:string, desc:string, giver:string, location:string, reward:{gold:number, rep?:{faction:string,delta:number}}, status:QuestStatus, type:'main'|'side'|'procedural', objectives:string[] };

export const QUEST_TEMPLATES: Quest[] = [
  {id:'main_debt', title:'Dług krwi', desc:'Spłać 10 000 koron w 30 dni. Dzicy Rycerze nie żartują.', giver:'Dzicy Rycerze', location:'Obóz', reward:{gold:0}, status:'active', type:'main', objectives:['Zdobądź 10 000 koron','Spłać dług']},
  {id:'port_smuggle', title:'Sól bez akcyzy', desc:'Przemytnicy chcą przemycenia soli przez celników. Wysokie ryzyko.', giver:'Przemytnicy', location:'Port', reward:{gold:300, rep:{faction:'smugglers',delta:15}}, status:'active', type:'side', objectives:['Zdobądź 10x sól','Przejdź obok straży celnej','Dostarcz do kryjówki']},
  {id:'hunt_wolves', title:'Wilki z bagien', desc:'Wieśniacy proszą o wybicie wilków atakujących bydło.', giver:'Sołtys', location:'Bagna', reward:{gold:120, rep:{faction:'villagers',delta:10}}, status:'active', type:'side', objectives:['Zabij 3 wilki','Przynieś skóry']},
  {id:'church_relic', title:'Zaginiona relikwia', desc:'Kościół zgubił relikwię św. Elenema. Znajdź ją w ruinach opactwa.', giver:'Opat', location:'Ruiny', reward:{gold:400, rep:{faction:'church',delta:20}}, status:'active', type:'side', objectives:['Przeszukaj ruiny','Uniknij klątwy','Oddaj relikwię']},
];

export class QuestSystem {
  quests:Quest[] = [...QUEST_TEMPLATES];
  proceduralId = 0;

  generateProcedural(location:string){
    const types = [
      {title:'Dostawa', desc:'Dostarcz towar do', gold:30},
      {title:'Eskorta', desc:'Ochroń karawanę do', gold:80},
      {title:'Szkodniki', desc:'Wybij szczury w', gold:25},
      {title:'Dług', desc:'Odzyskaj dług w', gold:50},
      {title:'Zaginiony', desc:'Znajdź zaginionego w', gold:60},
    ];
    const t = types[Math.floor(Math.random()*types.length)];
    this.proceduralId++;
    const q:Quest = {
      id:`proc_${this.proceduralId}`,
      title:`${t.title} #${this.proceduralId}`,
      desc:`${t.desc} ${location}. Nagroda: ${t.gold} koron.`,
      giver:`Losowy zleceniodawca ${this.proceduralId}`,
      location,
      reward:{gold:t.gold},
      status:'active',
      type:'procedural',
      objectives:['Wykonaj zlecenie']
    };
    this.quests.push(q);
    return q;
  }

  complete(id:string){
    const q=this.quests.find(x=>x.id===id);
    if(q){ q.status='completed'; }
  }
  fail(id:string){
    const q=this.quests.find(x=>x.id===id);
    if(q){ q.status='failed'; }
  }

  getActive(){ return this.quests.filter(q=>q.status==='active'); }
  getCompleted(){ return this.quests.filter(q=>q.status==='completed'); }
  getLost(){ return this.quests.filter(q=>q.status==='lost'||q.status==='failed'); }
}
