import { eventBus } from '../core/EventBus';
export class DebtSystem {
  total = 10000;
  paid = 0;
  interestRate = 0;
  loan = 0;
  loanInterest = 0.3; // 30% lichwiarz
  extensions = 0;
  maxExtensions = 2;

  get remaining(){ return Math.max(0,this.total - this.paid + this.loan*(1+this.loanInterest)); }
  get daysLeft(){ return 30; } // computed externally via TimeSystem

  pay(amount:number):boolean{
    if(amount<=0) return false;
    this.paid+=amount;
    eventBus.emit('debtPaid', {amount, remaining:this.remaining});
    if(this.paid>=this.total) eventBus.emit('debtCleared');
    return true;
  }
  takeLoan(amount:number){
    this.loan+=amount;
    eventBus.emit('loanTaken',{amount,total:this.loan});
  }
  requestExtension():boolean{
    if(this.extensions>=this.maxExtensions) return false;
    this.extensions++;
    eventBus.emit('extensionGranted', this.extensions);
    return true;
  }
  tryCheat():{success:boolean, consequence:string}{
    const success = Math.random()>0.6;
    if(!success) { eventBus.emit('cheatFailed'); return {success:false, consequence:'Wierzyciele wściekli, odsetki +20% i wizyta poborców'}; }
    eventBus.emit('cheatSuccess'); return {success:true, consequence:'Udało się oszukać księgowego, dług spada o 1000'};
  }
  getEndingHint(timeDay:number){
    if(this.paid>=this.total) return 'Możesz spłacić uczciwie lub przestępczo';
    if(timeDay>=30) return 'Dług niespłacony - grozi niewola';
    return `${this.remaining} koron do spłaty`;
  }
  serialize(){ return {total:this.total,paid:this.paid,loan:this.loan,extensions:this.extensions}; }
  deserialize(d:any){ this.total=d.total; this.paid=d.paid; this.loan=d.loan; this.extensions=d.extensions; }
}
