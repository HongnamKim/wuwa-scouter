import type { CalcContext } from './context';
import { buildPerfInput, sumMainPrimary, sumEffectiveSubstats, computeEnergyRegen } from './build';
import { aggregateBuffs } from './buffs';
import { mechanismDamageTypeBonus } from './mechanisms';
import { damageBonusTypeOf } from './mode';

export interface DisplaySpec {
  attack: number;
  criticalRateRaw: number; // 캡 전
  criticalRate: number;    // 캡 1.0
  criticalDamage: number;
  elementBonus: number;       // 증가피해보너스 중 속성분만
  damageTypeBonus: number;    // 증가피해보너스 중 캐릭 유형분
  amplify: number;
  energyRegen: number;        // 공명효율(소수, 기본 1.0 = 100%)
}

export function computeDisplaySpec(ctx: CalcContext): DisplaySpec {
  const i = buildPerfInput(ctx);
  const buffs = aggregateBuffs(ctx);
  const main = sumMainPrimary(ctx);
  const sub = sumEffectiveSubstats(ctx);

  const dmgType = damageBonusTypeOf(ctx);
  const dmgTypeBonusKey = dmgType ? (`${dmgType}_bonus` as const) : null;
  const subDmgTypeBonus = dmgTypeBonusKey ? (sub[dmgTypeBonusKey] ?? 0) / 100 : 0;

  const energyRegen = computeEnergyRegen(ctx);
  // 특별 메커니즘(예: 시그리카 공효→에코 전환)으로 얻는 추가 피해유형 보너스
  const mechBonus = mechanismDamageTypeBonus(ctx.character.special_mechanism, energyRegen);
  // 피해유형 보너스 배수 버프(곱연산, 예: 레베카 6돌 일반공격 피해보너스 ×1.4)
  const dmgTypeFactor = 1 + buffs.damage_type_bonus_factor;

  return {
    attack: i.baseAttack * (1 + i.attackPercent) + i.flatAttack,
    criticalRateRaw: i.criticalRate,
    criticalRate: Math.min(i.criticalRate, 1),
    criticalDamage: i.criticalDamage,
    elementBonus: buffs.element_bonus + (main.element_damage_bonus ?? 0),
    damageTypeBonus: (buffs.damage_type_bonus + subDmgTypeBonus) * dmgTypeFactor + mechBonus,
    amplify: i.amplify,
    energyRegen,
  };
}
