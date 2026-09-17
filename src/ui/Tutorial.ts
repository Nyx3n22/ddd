export class TutorialSystem {
  private steps = [
    {title:'Witaj w Elenem, John', text:'Rok 1430. Masz 100 koron i 10 000 długu. 30 dni. Dzicy Rycerze nie żartują. WASD ruch, mysz rozglądanie, E interakcja.', trigger:'start'},
    {title:'Dług i czas', text:'Naciśnij T by zobaczyć kalendarz i dług. Czas płynie nawet gdy stoisz. Sen [śpij w karczmie] przyspiesza czas. Ostatnie 5 dni = poborcy i zaostrzona muzyka.', trigger:'day2'},
    {title:'Reputacja', text:'6 frakcji. Nie da się być przyjacielem wszystkich. Reputacja wpływa na ceny i questy. Sprawdź T.', trigger:'firstTalk'},
    {title:'Przestępczość', text:'Straż nie wie automatycznie. Liczą się świadkowie, krew, hałas, światło. Możesz zabić świadka lub przekupić. Kary: grzywna, dyby, więzienie (utrata dni!), śmierć.', trigger:'firstCrime'},
    {title:'Skradanie', text:'CTRL kucanie, światło i dźwięk mają znaczenie. Chodź po sianie, gaś pochodnie [R], ukrywaj ciała [F].', trigger:'crouch'},
    {title:'Walka', text:'Stamina ogranicza ataki. LPM atak kierunkowy, PPM blok/parowanie w oknie 0.3s. 3 wrogów to wyrok. Uciekaj lub przygotuj się.', trigger:'firstFight'},
    {title:'Ekonomia i przemyt', text:'Ceny zależą od podaży/popytu i wydarzeń. Blokada portu → sól x2. Zaraza → zioła x3. Przemyt: ukryj w wozie, fałszywe dokumenty, ryzyko przeszukania.', trigger:'firstTrade'},
    {title:'Rzemiosło', text:'I → ekwipunek → rzemiosło. Potrzebujesz warsztatu, surowców, przepisu i poziomu. Jakość zależy od umiejętności.', trigger:'firstCraft'},
    {title:'Zakończenia', text:'6 zakończeń: uczciwa spłata, przestępcza, ucieczka łodzią, wstąpienie do Rycerzy, obalenie Rycerzy, śmierć/niewola. Wybór należy do ciebie.', trigger:'day25'},
  ];
  private shown = new Set<string>();
  private onShow: (step:any)=>void;

  constructor(onShow:(step:any)=>void){
    this.onShow=onShow;
    const saved=localStorage.getItem('elenem_tutorial_shown');
    if(saved) this.shown=new Set(JSON.parse(saved));
  }

  trigger(id:string){
    if(this.shown.has(id)) return;
    const step=this.steps.find(s=>s.trigger===id);
    if(step){
      this.shown.add(id);
      localStorage.setItem('elenem_tutorial_shown', JSON.stringify(Array.from(this.shown)));
      this.onShow(step);
    }
  }

  reset(){ this.shown.clear(); localStorage.removeItem('elenem_tutorial_shown'); }
  getAll(){ return this.steps; }
}
