import { bus } from '../core/EventBus';
import { rng } from '../core/RNG';
import { getGame } from '../core/gameSingleton';
import { t } from '../core/Localization';
import { SkillsSystem } from './SkillsSystem';
import { ReputationSystem } from './ReputationSystem';
import { CrimeSystem } from './CrimeSystem';
import { QuestSystem } from './QuestSystem';
import { InventorySystem } from './InventorySystem';

/* ============================================================================
   HAZARD
   Bez skrótu klawiszowego — trzeba usiąść przy stole w karczmie i nacisnąć E.
   Stawka leży na stole, nie w menu. Umiejętność `gamble` daje realne przewagi:
   podejrzenie kości albo przerzut, ale oszukiwanie jest widoczne dla innych.
   ========================================================================== */

export type GameKind = 'dice' | 'cards';

export interface DiceRound {
  stake: number;
  player: number[];      // trzy kości gracza
  rival: number[];       // trzy kości przeciwnika
  kept: number[];        // wybrane dwie kości (indeksy 0..2)
  peeked: boolean;
  rerolled: boolean;
  resolved: boolean;
  npcId: string;
}

export interface CardRound {
  stake: number; player: number; rival: number; revealed: boolean; npcId: string; cheated: boolean;
}

export class GamblingSystem {
  static dice: DiceRound | null = null;
  static cards: CardRound | null = null;
  static totalWon = 0;
  static totalLost = 0;

  static rollDice() { return [rng.int(1, 6), rng.int(1, 6), rng.int(1, 6)]; }

  /** Rozpoczęcie rundy w kości. Stawka musi leżeć na stole (w złocie Johna). */
  static startDice(stake: number, npcId: string): boolean {
    const s = getGame().state;
    if (s.gold < stake) { bus.emit('hud:toast', { text: t('gamble.noStake', { gold: stake }), tone: 'bad' }); return false; }
    if (!s.flags.table_welcome) { bus.emit('hud:toast', { text: t('gamble.notWelcome'), tone: 'bad' }); return false; }
    if (s.time.hour < 12) { bus.emit('hud:toast', { text: t('gamble.tooEarly'), tone: 'bad' }); return false; }
    this.dice = { stake, player: this.rollDice(), rival: this.rollDice(), kept: [], peeked: false, rerolled: false, resolved: false, npcId };
    s.stats.gambled += 1;
    bus.emit('gamble:start', { game: 'dice', stake });
    return true;
  }

  static skill(): number { return SkillsSystem.level('gamble'); }

  /** Podejrzenie jednej kości przeciwnika — wymaga poziomu umiejętności. */
  static peek(): boolean {
    const d = this.dice; if (!d || d.resolved || d.peeked) return false;
    if (this.skill() < 2) { bus.emit('hud:toast', { text: t('gamble.cantPeek', { level: 2 }), tone: 'bad' }); return false; }
    d.peeked = true;
    SkillsSystem.use('gamble', 10);
    bus.emit('gamble:peek', { rivalHidden: d.rival[2] });
    return true;
  }

  /** Przerzut jednej własnej kości — kosztuje reputację u stołu, jeśli ktoś zauważy. */
  static reroll(index: number): boolean {
    const d = this.dice; if (!d || d.resolved || d.rerolled) return false;
    if (this.skill() < 3) { bus.emit('hud:toast', { text: t('gamble.cantReroll', { level: 3 }), tone: 'bad' }); return false; }
    d.player[index] = rng.int(1, 6);
    d.rerolled = true;
    SkillsSystem.use('gamble', 14);
    if (rng.chance(0.22 - this.skill() * 0.02)) {
      CrimeSystem.witness(d.npcId, 'cheating', 0, 0);
      ReputationSystem.addRelation(d.npcId, -12, 'gamble.cheat');
      bus.emit('hud:toast', { text: t('gamble.caughtReroll'), tone: 'bad' });
    }
    bus.emit('gamble:reroll', { index, value: d.player[index] });
    return true;
  }

  /** Jawne oszustwo: podmiana kości. Wysoka nagroda, wysokie ryzyko. */
  static cheat(): boolean {
    const d = this.dice; if (!d || d.resolved) return false;
    const chance = 0.35 + this.skill() * 0.07 + (SkillsSystem.hasPerk('sleight') ? 0.15 : 0);
    if (rng.chance(chance)) {
      d.player = [6, 6, rng.int(4, 6)];
      SkillsSystem.use('gamble', 25);
      SkillsSystem.use('deceit', 18);
      bus.emit('gamble:cheat', { caught: false });
      return true;
    }
    CrimeSystem.witness(d.npcId, 'cheating', 0, 0);
    ReputationSystem.addRelation(d.npcId, -25, 'gamble.cheat');
    ReputationSystem.add('villagers', -6, 'rep.reason.cheater');
    bus.emit('gamble:cheat', { caught: true });
    bus.emit('hud:toast', { text: t('gamble.caughtCheat'), tone: 'bad' });
    this.resolve();
    return false;
  }

  /** Wybór dwóch z trzech kości — liczy się ich suma. */
  static keep(indices: number[]): boolean {
    const d = this.dice; if (!d || d.resolved || indices.length !== 2) return false;
    d.kept = indices.slice();
    return this.resolve();
  }

  static resolve(): boolean {
    const g = getGame(), s = g.state;
    const d = this.dice; if (!d || d.resolved) return false;
    d.resolved = true;
    const kept = d.kept.length === 2 ? d.kept : [0, 1];
    const pSum = kept.reduce((a, i) => a + d.player[i], 0);
    const rSum = d.rival.slice(0, 2).reduce((a, b) => a + b, 0);
    const win = pSum > rSum;
    const tie = pSum === rSum;
    if (win) {
      s.gold += d.stake * 2; s.stats.earned += d.stake * 2;
      this.totalWon += d.stake * 2; s.stats.gambledWon += 1;
      ReputationSystem.addRelation(d.npcId, rng.int(-2, 4), 'gamble');
      bus.emit('hud:toast', { text: t('gamble.won', { gold: d.stake * 2 }), tone: 'good' });
    } else if (tie) {
      s.gold += d.stake;
      bus.emit('hud:toast', { text: t('gamble.tie') });
    } else {
      this.totalLost += d.stake;
      ReputationSystem.addRelation(d.npcId, rng.int(1, 5), 'gamble');
      bus.emit('hud:toast', { text: t('gamble.lost', { gold: d.stake }), tone: 'bad' });
    }
    QuestSystem.notify('gamble', { won: win, stake: d.stake, npcId: d.npcId });
    bus.emit('gamble:resolved', { win, tie, pSum, rSum, player: d.player, rival: d.rival, kept, stake: d.stake });
    return win;
  }

  /* ---------- karty ---------- */
  static startCards(stake: number, npcId: string): boolean {
    const s = getGame().state;
    if (s.gold < stake) { bus.emit('hud:toast', { text: t('gamble.noStake', { gold: stake }), tone: 'bad' }); return false; }
    if (!s.flags.table_welcome) { bus.emit('hud:toast', { text: t('gamble.notWelcome'), tone: 'bad' }); return false; }
    this.cards = { stake, player: rng.int(2, 14), rival: rng.int(2, 14), revealed: false, npcId, cheated: false };
    s.stats.gambled += 1;
    bus.emit('gamble:start', { game: 'cards', stake });
    return true;
  }

  static revealCards(): boolean {
    const g = getGame(), s = g.state;
    const c = this.cards; if (!c || c.revealed) return false;
    c.revealed = true;
    const p = c.player + (this.skill() >= 4 && rng.chance(0.3) ? 1 : 0);   // „czytanie” przeciwnika
    const win = p > c.rival;
    if (win) { s.gold += c.stake * 2; s.stats.earned += c.stake * 2; this.totalWon += c.stake * 2; s.stats.gambledWon += 1; }
    else { this.totalLost += c.stake; }
    SkillsSystem.use('gamble', win ? 12 : 6);
    bus.emit('gamble:cardsRevealed', { win, player: p, rival: c.rival, stake: c.stake });
    bus.emit('hud:toast', { text: win ? t('gamble.won', { gold: c.stake * 2 }) : t('gamble.lost', { gold: c.stake }), tone: win ? 'good' : 'bad' });
    return win;
  }

  /** Znaczenie karty — tylko przy stole Cecylii, która nienawidzi oszustów. */
  static markCard(): boolean {
    const c = this.cards; if (!c || c.revealed) return false;
    const chance = 0.3 + this.skill() * 0.06;
    if (rng.chance(chance)) { c.player = Math.min(14, c.player + 3); c.cheated = true; SkillsSystem.use('deceit', 20); return true; }
    CrimeSystem.witness(c.npcId, 'cheating', 0, 0);
    ReputationSystem.addRelation(c.npcId, -30, 'gamble.cheat');
    bus.emit('hud:toast', { text: t('gamble.caughtMarking'), tone: 'bad' });
    this.revealCards();
    return false;
  }

  static leaveTable() {
    this.dice = null; this.cards = null;
    bus.emit('gamble:leave', {});
  }

  /** Hazard ma skutek społeczny: kto wygrywa, ten ma wrogów. */
  static dailyConsequence() {
    const s = getGame().state;
    if (this.totalWon > 300) {
      bus.emit('rumor:seedEvent', { textKey: 'rumor.johnWins', severity: 2 });
      ReputationSystem.add('villagers', -3, 'rep.reason.winner');
    }
    if (this.totalLost > 300 && s.gold < 20) {
      bus.emit('hud:toast', { text: t('gamble.broke'), tone: 'bad' });
    }
    if (s.inventory.items.some(i => i.stolen) && rng.chance(0.1)) {
      bus.emit('hud:toast', { text: t('gamble.searched'), tone: 'bad' });
    }
    InventorySystem.count('dice_bone');
  }
}
