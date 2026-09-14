import type { CalcContext } from './context';
import { buildPerfInput, sumMainPrimary, sumEffectiveSubstats, computeEnergyRegen } from './build';
import { aggregateBuffs, damageTypeIncrease } from './buffs';
import { mechanismDamageTypeBonus } from './mechanisms';

export interface DisplaySpec {
  attack: number;
  criticalRateRaw: number; // 캡 전
  criticalRate: number;    // 캡 1.0
  criticalDamage: number;
  elementBonus: number;       // 증가피해보너스 중 속성분만
  damageTypeBonus: number;    // 증가피해보너스 중 캐릭 유형분
  amplify: number;            // 부스트 총합(계산용)
  amplifyElement: number;     // 속성 피해 부스트분(표시)
  amplifyDamageType: number;  // 유형 피해 부스트분(표시)
  amplifyAll: number;         // 전체 피해 부스트분(표시)
  energyRegen: number;        // 공명효율(소수, 기본 1.0 = 100%)
}

export function computeDisplaySpec(ctx: CalcContext): DisplaySpec {
  const i = buildPerfInput(ctx);
  const buffs = aggregateBuffs(ctx);
  const main = sumMainPrimary(ctx);
  const sub = sumEffectiveSubstats(ctx);

  const energyRegen = computeEnergyRegen(ctx);
  // 특별 메커니즘(예: 시그리카 공효→에코 전환)으로 얻는 추가 피해유형 보너스
  const mechBonus = mechanismDamageTypeBonus(ctx.character.special_mechanism, energyRegen);

  return {
    attack: i.baseAttack * (1 + i.attackPercent) + i.flatAttack,
    criticalRateRaw: i.criticalRate,
    criticalRate: Math.min(i.criticalRate, 1),
    criticalDamage: i.criticalDamage,
    elementBonus: buffs.element_bonus + (main.element_damage_bonus ?? 0),
    damageTypeBonus: damageTypeIncrease(ctx, buffs, sub) + mechBonus,
    amplify: i.amplify,
    amplifyElement: buffs.amplify_element,
    amplifyDamageType: buffs.amplify_damage_type,
    amplifyAll: buffs.amplify_all,
    energyRegen,
  };
}
