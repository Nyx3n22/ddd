import { bus } from '../core/EventBus';
import { rng } from '../core/RNG';
import { getGame } from '../core/gameSingleton';
import { t } from '../core/Localization';
import type { BodyPart, Injury, InjuryType } from '../core/GameState';
import { SkillsSystem } from './SkillsSystem';
import { itemDef } from './InventorySystem';

/* ============================================================================
   POTRZEBY, RANY I CHOROBY
   Każda rana to konkretna część ciała, konkretna przyczyna i konkretny skutek.
   Choroby biorą się z wody, brudu, tłumu i niemytych ran (brief 6).
   ========================================================================== */

const PART_PENALTY: Record<BodyPart, { speed: number; aim: number; carry: number }> = {
  head: { speed: 0.1, aim: 0.25, carry: 0.1 },
  torso: { speed: 0.25, aim: 0.2, carry: 0.3 },
  armL: { speed: 0.05, aim: 0.3, carry: 0.35 },
  armR: { speed: 0.05, aim: 0.35, carry: 0.4 },
  legL: { speed: 0.4, aim: 0.05, carry: 0.2 },
  legR: { speed: 0.4, aim: 0.05, carry: 0.2 }
};

export class NeedsSystem {
  /** Główna pętla potrzeb — wywoływana co minutę czasu gry. */
  static tickMinutes(dtMinutes: number, opts: { indoors: boolean; lightLevel: number; tempC: number }) {
    const g = getGame(), s = g.state, n = s.needs;
    if (n.dead) return;
    const h = dtMinutes / 60;

    n.hunger = Math.max(0, n.hunger - 2.4 * h * (n.fatigue > 70 ? 1.2 : 1));
    n.thirst = Math.max(0, n.thirst - 3.2 * h * (s.weather.kind === 'heat' ? 1.6 : 1));

    // zmęczenie rośnie w dzień, maleje gdy śpi
    if (s.flags.sleeping) n.fatigue = Math.max(0, n.fatigue - 12 * h);
    else n.fatigue = Math.min(100, n.fatigue + 3.1 * h);

    // higiena: brud z pracy, deszcz częściowo „myje”, bagno brudzi mocno
    const dirty = s.flags.inSwamp ? 6 : 1.1;
    n.hygiene = Math.max(0, Math.min(100, n.hygiene - dirty * h + (s.weather.kind === 'rain' && !opts.indoors ? 1.2 * h : 0)));

    // ciepło: zależne od pogody, ubrania i schronienia
    const target = opts.indoors ? 72 : 40 + Math.max(-20, Math.min(20, opts.tempC)) * 1.6;
    n.warmth += (target - n.warmth) * 0.08 * h * 60 / 60;
    n.warmth = Math.max(0, Math.min(100, n.warmth));

    // skutki
    let dmg = 0;
    if (n.hunger <= 0) dmg += 1.2 * h;
    if (n.thirst <= 0) dmg += 2.2 * h;
    if (n.fatigue >= 100) dmg += 0.6 * h;
    if (n.warmth <= 8) dmg += 1.5 * h;
    for (const inj of s.injuries) if (inj.bleeding > 0) dmg += inj.bleeding * 3.2 * h;
    for (const d of s.diseases) dmg += d.severity * 1.4 * h;
    if (dmg > 0) this.damage(dmg, 'needs');

    // regeneracja gdy jest dobrze
    if (n.hunger > 55 && n.thirst > 45 && n.fatigue < 65 && s.injuries.length === 0 && s.diseases.length === 0) {
      n.health = Math.min(n.maxHealth, n.health + 0.9 * h);
    }
    if (n.hunger > 60 && n.fatigue < 60) n.stamina = Math.min(n.maxStamina, n.stamina + 14 * h);

    // zapalenie ran
    for (const inj of s.injuries) {
      if (inj.bandaged) continue;
      const risk = 0.0016 * dtMinutes * (n.hygiene < 30 ? 2.4 : 1) * (inj.type === 'puncture' || inj.type === 'cut' ? 1.6 : 0.7);
      if (rng.chance(risk) && !inj.infected) {
        inj.infected = true;
        bus.emit('hud:toast', { text: t('needs.infected'), tone: 'bad' });
        bus.emit('injury:infected', inj);
      }
      // krwawienie ustaje z czasem
      if (inj.bleeding > 0) inj.bleeding = Math.max(0, inj.bleeding - 0.02 * h);
    }

    // choroby rozwijają się lub ustępują
    for (let i = s.diseases.length - 1; i >= 0; i--) {
      const d = s.diseases[i];
      if (d.treated) { d.severity -= 0.06 * h; if (d.severity <= 0) { s.diseases.splice(i, 1); bus.emit('hud:toast', { text: t('needs.cured', { what: t('disease.' + d.id) }), tone: 'good' }); continue; } }
      else if (n.hygiene < 25 || n.hunger < 20) d.severity = Math.min(1, d.severity + 0.01 * h);
    }

    // pochodnia
    if (n.torchLit) {
      n.torchFuel -= dtMinutes;
      if (s.weather.kind === 'rain' || s.weather.kind === 'storm') n.torchFuel -= dtMinutes * 1.5;
      if (n.torchFuel <= 0) { n.torchLit = false; n.torchFuel = 0; bus.emit('hud:toast', { text: t('msg.torchOut') }); bus.emit('player:torch', { lit: false }); }
    }
    // trunki wietrzeją
    if (s.flags.drunk) { s.flags.drunk = Math.max(0, s.flags.drunk - 0.12 * h); if (s.flags.drunk === 0) bus.emit('hud:toast', { text: t('msg.sober') }); }
  }

  static damage(amount: number, source: string, part?: BodyPart) {
    const g = getGame(), s = g.state;
    if (s.needs.dead) return;
    const mit = this.mitigation(part);
    const real = amount * (1 - mit);
    s.needs.health -= real;
    bus.emit('player:damaged', { amount: real, source, part });
    if (s.needs.health <= 0) this.die(source);
  }

  static mitigation(part?: BodyPart): number {
    const s = getGame().state;
    let m = 0;
    const body = s.inventory.equipped.body;
    const head = s.inventory.equipped.head;
    if (body) m += itemDef(body)?.armor?.mit || 0;
    if (head && part === 'head') m += (itemDef(head)?.armor?.mit || 0) * 1.5;
    if (part) {
      const inj = s.injuries.find(i => i.part === part);
      if (inj) m -= 0.15 * inj.severity;   // ranna część ciała gorzej chroni
    }
    return Math.max(0, Math.min(0.85, m));
  }

  static injure(part: BodyPart, type: InjuryType, severity: number, bleeding = 0) {
    const s = getGame().state;
    const inj: Injury = {
      part, type, severity: Math.min(1, severity), bleeding, bandaged: false, infected: false,
      splinted: false, day: s.time.day, scar: severity > 0.7 && rng.chance(0.5)
    };
    s.injuries.push(inj);
    if (inj.scar && !s.scars.includes(part)) s.scars.push(part);
    bus.emit('player:injured', inj);
    bus.emit('hud:toast', { text: t('needs.injury', { part: t('body.' + part), what: t('injury.' + type) }), tone: 'bad' });
    if (type === 'fracture' && !inj.splinted) bus.emit('hud:toast', { text: t('needs.splintNeeded'), tone: 'bad' });
    SkillsSystem.use('firstaid', 4);
  }

  static bandage(part?: BodyPart) {
    const s = getGame().state;
    let any = false;
    for (const inj of s.injuries) {
      if (part && inj.part !== part) continue;
      inj.bandaged = true; inj.bleeding = 0; any = true;
    }
    if (any) { bus.emit('hud:toast', { text: t('needs.bandaged'), tone: 'good' }); SkillsSystem.use('firstaid', 12); }
    return any;
  }

  static treatAll(costCrowns: number) {
    const s = getGame().state;
    for (const inj of s.injuries) { inj.bandaged = true; inj.infected = false; inj.bleeding = 0; inj.severity = Math.max(0, inj.severity - 0.4); }
    s.injuries = s.injuries.filter(i => i.severity > 0.05);
    for (const d of s.diseases) d.treated = true;
    s.needs.health = Math.min(s.needs.maxHealth, s.needs.health + 18);
    bus.emit('hud:toast', { text: t('needs.treated', { gold: costCrowns }), tone: 'good' });
  }

  static setBone() {
    const s = getGame().state;
    for (const inj of s.injuries) if (inj.type === 'fracture') { inj.splinted = true; inj.severity = Math.max(0.1, inj.severity - 0.5); }
    bus.emit('hud:toast', { text: t('needs.boneSet'), tone: 'good' });
  }

  static cureInfection() {
    const s = getGame().state;
    for (const inj of s.injuries) inj.infected = false;
    bus.emit('hud:toast', { text: t('needs.infectionCured'), tone: 'good' });
  }

  static wash(amount: number) {
    const s = getGame().state;
    s.needs.hygiene = Math.min(100, s.needs.hygiene + amount);
    bus.emit('hud:toast', { text: t('needs.washed', { amount }), tone: 'good' });
  }

  static sleep(hours: number, quality: number) {
    const s = getGame().state;
    s.needs.fatigue = Math.max(0, s.needs.fatigue - hours * 13 * quality);
    s.needs.health = Math.min(s.needs.maxHealth, s.needs.health + hours * 2.2 * quality);
    s.stats.sleeps += 1;
    for (const inj of s.injuries) if (inj.bandaged) inj.severity = Math.max(0, inj.severity - 0.06 * hours * quality);
    bus.emit('hud:toast', { text: t('needs.slept', { hours: Math.round(hours), quality: Math.round(quality * 100) }) });
  }

  /** Zmodyfikatory wynikające z ran — wpływają na ruch i celność. */
  static penalties(): { speed: number; aim: number; carry: number; pain: number } {
    const s = getGame().state;
    const out = { speed: 0, aim: 0, carry: 0, pain: 0 };
    for (const inj of s.injuries) {
      const p = PART_PENALTY[inj.part];
      const k = inj.severity * (inj.splinted || inj.bandaged ? 0.6 : 1) * (inj.infected ? 1.3 : 1);
      out.speed += p.speed * k; out.aim += p.aim * k; out.carry += p.carry * k; out.pain += k;
    }
    if (s.needs.fatigue > 75) { out.speed += 0.15; out.aim += 0.15; }
    if (s.needs.hunger < 20) { out.speed += 0.1; out.carry += 0.2; }
    if (s.needs.thirst < 15) { out.speed += 0.15; out.aim += 0.2; }
    if (s.flags.drunk) { out.aim += 0.35 * s.flags.drunk; out.speed -= 0.05; }
    for (const d of s.diseases) { out.speed += 0.1 * d.severity; out.aim += 0.1 * d.severity; }
    return {
      speed: Math.min(0.8, out.speed), aim: Math.min(0.85, out.aim),
      carry: Math.min(0.8, out.carry), pain: out.pain
    };
  }

  static die(source: string) {
    const s = getGame().state;
    if (s.needs.dead) return;
    s.needs.health = 0; s.needs.dead = true;
    bus.emit('player:died', { source });
  }

  /** Ryzyko zachorowania w zależności od miejsca i stanu Johna. */
  static exposureCheck(crowd: number, swamp: boolean, corpse: boolean) {
    const s = getGame().state;
    if (s.weather.plague) {
      const r = 0.004 * crowd * (s.needs.hygiene < 30 ? 2 : 1) * (s.needs.hunger < 30 ? 1.8 : 1);
      if (rng.chance(r) && !s.diseases.some(d => d.id === 'plague')) {
        s.diseases.push({ id: 'plague', severity: 0.35, dayStart: s.time.day, treated: false });
        bus.emit('player:ill', { id: 'plague' });
        bus.emit('hud:toast', { text: t('needs.plagueStart'), tone: 'bad' });
      }
    }
    if (swamp && rng.chance(0.01)) {
      if (!s.diseases.some(d => d.id === 'fever')) {
        s.diseases.push({ id: 'fever', severity: 0.3, dayStart: s.time.day, treated: false });
        bus.emit('player:ill', { id: 'fever' });
        bus.emit('hud:toast', { text: t('needs.feverStart'), tone: 'bad' });
      }
    }
    if (corpse && rng.chance(0.02) && !s.diseases.some(d => d.id === 'rot')) {
      s.diseases.push({ id: 'rot', severity: 0.25, dayStart: s.time.day, treated: false });
      bus.emit('hud:toast', { text: t('needs.rotStart'), tone: 'bad' });
    }
  }
}

