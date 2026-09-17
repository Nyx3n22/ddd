import { bus } from '../core/EventBus';
import { getGame } from '../core/gameSingleton';
import { t } from '../core/Localization';
import { ReputationSystem } from './ReputationSystem';

/* ============================================================================
   DŁUG — zegar gry
   10 000 koron, 30 dni. Każdy dzień bez spłaty to 50 koron odsetek.
   Licznik długu jest widoczny w HUD zawsze — to jest gra o czasie (brief 6).
   ========================================================================== */

export const DEBT_INTEREST_PER_DAY = 50;

export class DebtSystem {
  static remaining() { return getGame().state.debtRemaining; }
  static daysLeft() { return getGame().state.time.daysLeft; }

  /** Spłata dowolnej kwoty — u Gwidona, przez dialog albo w menu długu. */
  static pay(amount: number, creditor = 'wildKnights'): boolean {
    const g = getGame(), s = g.state;
    const pay = Math.max(0, Math.min(amount, s.gold, this.remaining()));
    if (pay <= 0) { bus.emit('hud:toast', { text: t('debt.nothing'), tone: 'bad' }); return false; }
    s.gold -= pay;
    s.debt.paid += pay;
    s.stats.spent += pay;
    bus.emit('debt:paid', { amount: pay, remaining: this.remaining(), creditor });
    bus.emit('hud:toast', { text: t('debt.paid', { gold: pay, remaining: this.remaining() }), tone: 'good' });
    s.flags.earned_first_crown = true;
    if (this.remaining() <= 0) this.settle();
    else if (pay >= 500) ReputationSystem.add('wildKnights', 4, 'rep.reason.paid');
    return true;
  }

  static settle() {
    const g = getGame(), s = g.state;
    s.debt.principal = s.debt.paid;
    s.flags.debt_cleared = true;
    ReputationSystem.add('wildKnights', 20, 'rep.reason.debtCleared');
    ReputationSystem.add('villagers', 15, 'rep.reason.debtCleared');
    bus.emit('debt:cleared', {});
    bus.emit('hud:toast', { text: t('debt.cleared'), tone: 'good' });
  }

  /** Przedłużenie terminu — kosztuje 1000 koron i jedną przysługę. */
  static extend(days: number, cost: number) {
    const g = getGame(), s = g.state;
    if (s.gold < cost) return false;
    s.gold -= cost;
    s.debt.dueDay += days;
    s.debt.extensions += 1;
    s.debt.favorOwed = true;
    s.time.totalDays = Math.max(s.time.totalDays, s.debt.dueDay);
    bus.emit('debt:extended', { days, dueDay: s.debt.dueDay });
    bus.emit('hud:toast', { text: t('debt.extended', { days, due: s.debt.dueDay }) });
    return true;
  }

  /** Pożyczka u lichwiarza: 30% w miesiąc. */
  static takeLoan(creditor: string, principal: number) {
    const s = getGame().state;
    const due = Math.round(principal * 1.3);
    s.gold += principal;
    s.debt.loans.push({ creditor, principal, due, dueDay: s.time.day + 30 });
    bus.emit('hud:toast', { text: t('debt.loanTaken', { gold: principal, due }) });
    bus.emit('debt:loan', { creditor, principal, due });
  }

  static dailyTick() {
    const g = getGame(), s = g.state;
    if (s.debtRemaining > 0 && s.time.day > s.debt.dueDay) {
      const interest = DEBT_INTEREST_PER_DAY * (s.time.day - s.debt.dueDay > 7 ? 2 : 1);
      s.debt.principal += interest;
      bus.emit('hud:toast', { text: t('debt.interestToast', { gold: interest }), tone: 'bad' });
      bus.emit('debt:interest', { amount: interest });
      if (s.time.day - s.debt.dueDay === 7) {
        bus.emit('debt:deadlinePassed', { days: 7 });
        ReputationSystem.add('wildKnights', -15, 'rep.reason.deadline');
        bus.emit('hud:toast', { text: t('debt.knightsComing'), tone: 'bad' });
      }
    }
    // pożyczki prywatne
    for (const loan of s.debt.loans) {
      if (s.time.day === loan.dueDay && s.gold < loan.due) {
        ReputationSystem.add('villagers', -5, 'rep.reason.unpaid');
        bus.emit('hud:toast', { text: t('debt.loanDue', { gold: loan.due, who: loan.creditor }), tone: 'bad' });
      }
    }
    // przypomnienie o terminie
    const left = this.daysLeft();
    if (left === 7 || left === 3 || left === 1) {
      bus.emit('debt:warning', { daysLeft: left });
      bus.emit('hud:toast', { text: t('debt.deadlineWarn', { days: left }), tone: 'bad' });
    }
    if (left <= 0 && s.debtRemaining > 0 && !s.ending) {
      bus.emit('ending:trigger', { id: 'end_captive' });
    }
    if (s.debtRemaining <= 0 && !s.ending && s.flags.debt_cleared) {
      bus.emit('ending:check', { reason: 'debtCleared' });
    }
  }

  /** Czy John może jeszcze wziąć kontrakt u Baldwin'a (propozycja służby). */
  static serviceOfferOpen() {
    const s = getGame().state;
    return s.debtRemaining > 0 && !s.flags.refused_knights && !s.flags.joined_knights;
  }
}
