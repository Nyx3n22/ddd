export class GamblingUI {
  private container: HTMLElement;
  constructor(container:HTMLElement){
    this.container=container;
  }

  renderDice(bet:number, onRoll:(cheat:boolean)=>void){
    this.container.innerHTML=`
      <div style="text-align:center;padding:20px">
        <h3 style="font-family:Cinzel">KOŚCI • Karczma Portowa</h3>
        <p style="font-size:13px;color:#8a6d4b">Stawka: ${bet} koron. Rzuć 2k6. Suma >=8 wygrywa 2x stawkę. Możesz oszukiwać (wymaga umiejętności).</p>
        <div style="display:flex;justify-content:center;gap:20px;margin:20px 0">
          <div style="width:60px;height:60px;background:#111;border:1px solid #4a3f35;display:flex;align-items:center;justify-content:center;font-size:24px" id="die1">?</div>
          <div style="width:60px;height:60px;background:#111;border:1px solid #4a3f35;display:flex;align-items:center;justify-content:center;font-size:24px" id="die2">?</div>
        </div>
        <div style="display:flex;gap:10px;justify-content:center">
          <button class="btn primary" id="roll-fair">RZUC UCZCIWIE</button>
          <button class="btn" id="roll-cheat">OSZUKUJ [Skradanie 3]</button>
        </div>
        <div id="dice-result" style="margin-top:12px;font-family:Cinzel"></div>
      </div>
    `;
    this.container.querySelector('#roll-fair')?.addEventListener('click', ()=>onRoll(false));
    this.container.querySelector('#roll-cheat')?.addEventListener('click', ()=>onRoll(true));
  }

  showResult(d1:number,d2:number,win:boolean,caught:boolean,payout:number){
    const die1=this.container.querySelector('#die1')!;
    const die2=this.container.querySelector('#die2')!;
    const res=this.container.querySelector('#dice-result')!;
    die1.textContent=d1.toString();
    die2.textContent=d2.toString();
    if(caught){
      res.innerHTML=`<span style="color:#c94a3a">Przyłapano na oszustwie! Pobito i wyrzucono. Reputacja -10.</span>`;
    } else {
      res.innerHTML=`Suma: ${d1+d2} • ${win?`<span style="color:#7ab060">Wygrana! +${payout} koron</span>`:`<span style="color:#c94a3a">Przegrana -${Math.abs(payout)} koron</span>`}`;
    }
  }
}
