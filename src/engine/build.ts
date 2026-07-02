import type { StatKey } from '../types/domain';
import type { CalcContext } from './context';
import type { PerfInput } from './perf';
import { aggregateBuffs } from './buffs';
import { mechanismDamageTypeBonus } from './mechanisms';
import { damageBonusTypeOf, effectiveSubstatsOf } from './mode';
import {
  BASE_CRIT, BASE_CRIT_DAMAGE, MAIN_PRIMARY, MAIN_SECONDARY,
  ENEMY_DEF_RATIO, BASE_ENEMY_RESISTANCE,
} from './constants';

/** 속성 저항 → 피해 배수 (WuWa 구간식) */
function resMultiplier(res: number): number {
  if (res < 0) return 1 - res / 2;
  if (res < 0.8) return 1 - res;
  return 1 / (4 * res + 1);
}

/** 방어력 무시·속성 저항 무시를 기준(0) 대비 상대 배수로 환산. 둘 다 0이면 1. */
export function defenseResistanceFactor(defenseIgnore: number, resistanceIgnore: number): number {
  const r = ENEMY_DEF_RATIO;
  const defFactor = (1 + r) / (1 + r * (1 - defenseIgnore));
  const resFactor = resMultiplier(BASE_ENEMY_RESISTANCE - resistanceIgnore) / resMultiplier(BASE_ENEMY_RESISTANCE);
  return defFactor * resFactor;
}

/** 공명효율(소수, 1.0 = 100%) = 기본 100% + 무기 베이스 + 부옵(전체) + 활성 버프 + 메인 */
export function computeEnergyRegen(ctx: CalcContext): number {
  const buffs = aggregateBuffs(ctx);
  const main = sumMainPrimary(ctx);
  const subER = ctx.slots.flatMap((s) => s.substats)
    .filter((l) => l.type === 'energy_regen' && l.value != null)
    .reduce((s, l) => s + (l.value as number), 0);
  return 1 + (ctx.weapon.base_stats.energy_regen ?? 0) + subER / 100
    + buffs.energy_regen + (main.energy_regen ?? 0);
}

/** 유효옵 부옵 합 (% → 그대로 % 단위 숫자) */
export function sumEffectiveSubstats(ctx: CalcContext): Partial<Record<StatKey, number>> {
  const sum: Partial<Record<StatKey, number>> = {};
  const eff = new Set(effectiveSubstatsOf(ctx));
  for (const slot of ctx.slots) {
    for (const line of slot.substats) {
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
  ctx.slots.forEach((slot) => {
    if (slot.cost == null || !slot.main) return; // 코스트/메인 미배정 슬롯은 기여 없음
    const pct = MAIN_PRIMARY[slot.cost][slot.main];
    if (pct != null) sum[slot.main] = (sum[slot.main] ?? 0) + pct / 100;
  });
  return sum;
}

/** 메인 secondary 깡스탯 중 캐릭터 스케일과 일치하는 것만 합산 */
export function secondaryFlat(ctx: CalcContext): number {
  const scaleFlat: StatKey =
    ctx.character.scale_stat === 'attack' ? 'flat_attack'
    : ctx.character.scale_stat === 'hp' ? 'flat_hp' : 'flat_defense';
  return ctx.slots.reduce((acc, slot) => {
    if (slot.cost == null) return acc;
    const sec = MAIN_SECONDARY[slot.cost];
    return acc + (sec.stat === scaleFlat ? sec.value : 0);
  }, 0);
}

export function buildPerfInput(ctx: CalcContext): PerfInput {
  const buffs = aggregateBuffs(ctx);
  const sub = sumEffectiveSubstats(ctx);
  const main = sumMainPrimary(ctx);
  const dmgType = damageBonusTypeOf(ctx);
  const dmgTypeBonusKey = dmgType ? (`${dmgType}_bonus` as StatKey) : null;

  // 스케일 스탯(공격/체력/방어) 기준으로 기초·%·깡을 계산. scale_stat이 attack이면 기존과 완전히 동일한 값.
  // PerfInput 필드명은 baseAttack/attackPercent/flatAttack이지만 실제로는 "스케일 스탯"을 담는다.
  const scale = ctx.character.scale_stat;
  const charBase = scale === 'attack' ? ctx.character.base_attack
    : scale === 'hp' ? (ctx.character.base_hp ?? 0)
    : (ctx.character.base_defense ?? 0);
  // 무기 기초 스탯은 공격만 존재 → 공격 스케일러만 무기 기초를 더한다(체력/방어 스케일러는 0).
  const weaponBase = scale === 'attack' ? ctx.weapon.base_stats.attack : 0;
  const percentKey = `${scale}_percent` as StatKey; // attack_percent | hp_percent | defense_percent
  const flatKey = `flat_${scale}` as StatKey;        // flat_attack | flat_hp | flat_defense
  const scalePercentBuff = scale === 'attack' ? buffs.attack_percent
    : scale === 'hp' ? buffs.hp_percent : buffs.defense_percent;

  const baseAttack = charBase + weaponBase;

  const attackPercent =
    (ctx.weapon.base_stats[percentKey] ?? 0) +
    scalePercentBuff + (sub[percentKey] ?? 0) / 100 + (main[percentKey] ?? 0);

  const flatAttack = (sub[flatKey] ?? 0) + secondaryFlat(ctx);

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
  // 특별 메커니즘(예: 시그리카 공효→에코 전환)으로 얻는 추가 피해유형 보너스
  const mechKey = ctx.character.special_mechanism;
  const mechanismBonus = mechKey ? mechanismDamageTypeBonus(mechKey, computeEnergyRegen(ctx)) : 0;
  // 피해유형 보너스 배수 버프(곱연산, 예: 레베카 6돌 일반공격 피해보너스 +40% → ×1.4)
  const dmgTypeFactor = 1 + buffs.damage_type_bonus_factor;
  const increaseBonus =
    buffs.element_bonus + (main.element_damage_bonus ?? 0) +
    (buffs.damage_type_bonus + subDmgTypeBonus) * dmgTypeFactor + mechanismBonus;

  // 방무·저무를 딜에 반영 (무기 비교용). 둘 다 0이면 배수 1.
  const defResFactor = defenseResistanceFactor(buffs.defense_ignore, buffs.element_resistance_ignore);

  return {
    baseAttack, attackPercent, flatAttack, criticalRate, criticalDamage,
    increaseBonus, amplify: buffs.amplify, defResFactor,
  };
}
