import type { StatKey, Cost } from '../types/domain';
import type { CalcContext } from './context';
import type { PerfInput } from './perf';
import { aggregateBuffs } from './buffs';
import {
  BASE_CRIT, BASE_CRIT_DAMAGE, COST_LAYOUTS, MAIN_PRIMARY, MAIN_SECONDARY,
} from './constants';

/** 유효옵 부옵 합 (% → 그대로 % 단위 숫자) */
export function sumEffectiveSubstats(ctx: CalcContext): Partial<Record<StatKey, number>> {
  const sum: Partial<Record<StatKey, number>> = {};
  const eff = new Set(ctx.character.effective_substats);
  for (const echo of ctx.substats) {
    for (const line of echo) {
      if (line.type && line.value != null && eff.has(line.type)) {
        sum[line.type] = (sum[line.type] ?? 0) + line.value;
      }
    }
  }
  return sum;
}

/** 메인 primary를 stat별 합으로 (% → 소수) */
export function sumMainPrimary(ctx: CalcContext): Partial<Record<StatKey, number>> {
  const sum: Partial<Record<StatKey, number>> = {};
  ctx.mainPrimary.forEach((pick) => {
    const pct = MAIN_PRIMARY[pick.cost][pick.type];
    if (pct != null) sum[pick.type] = (sum[pick.type] ?? 0) + pct / 100;
  });
  return sum;
}

/** 메인 secondary 깡스탯 중 캐릭터 스케일과 일치하는 것만 합산 */
export function secondaryFlat(ctx: CalcContext): number {
  const scaleFlat: StatKey =
    ctx.character.scale_stat === 'attack' ? 'flat_attack'
    : ctx.character.scale_stat === 'hp' ? 'flat_hp' : 'flat_defense';
  const layout: Cost[] = COST_LAYOUTS[ctx.costLayout];
  return layout.reduce((acc, cost) => {
    const sec = MAIN_SECONDARY[cost];
    return acc + (sec.stat === scaleFlat ? sec.value : 0);
  }, 0);
}

export function buildPerfInput(ctx: CalcContext): PerfInput {
  const buffs = aggregateBuffs(ctx);
  const sub = sumEffectiveSubstats(ctx);
  const main = sumMainPrimary(ctx);
  const dmgTypeBonusKey = ctx.character.damage_bonus_type
    ? (`${ctx.character.damage_bonus_type}_bonus` as StatKey)
    : null;

  const baseAttack = ctx.character.base_attack + ctx.weapon.base_stats.attack;

  const attackPercent =
    buffs.attack_percent + (sub.attack_percent ?? 0) / 100 + (main.attack_percent ?? 0);

  const flatAttack = (sub.flat_attack ?? 0) + secondaryFlat(ctx);

  const criticalRate =
    BASE_CRIT +
    (ctx.weapon.base_stats.critical_rate ?? 0) +
    buffs.critical_rate +
    (sub.critical_rate ?? 0) / 100 +
    (main.critical_rate ?? 0);

  const criticalDamage =
    BASE_CRIT_DAMAGE +
    (ctx.weapon.base_stats.critical_damage ?? 0) +
    buffs.critical_damage +
    (sub.critical_damage ?? 0) / 100 +
    (main.critical_damage ?? 0);

  const subDmgTypeBonus = dmgTypeBonusKey ? (sub[dmgTypeBonusKey] ?? 0) / 100 : 0;
  const increaseBonus =
    buffs.element_bonus + (main.element_damage_bonus ?? 0) +
    buffs.damage_type_bonus + subDmgTypeBonus;

  return {
    baseAttack, attackPercent, flatAttack, criticalRate, criticalDamage,
    increaseBonus, amplify: buffs.amplify,
  };
}
