import type { CalcContext } from './context';
import { buildPerfInput, sumMainPrimary, sumEffectiveSubstats } from './build';
import { aggregateBuffs } from './buffs';

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

  const dmgTypeBonusKey = ctx.character.damage_bonus_type
    ? (`${ctx.character.damage_bonus_type}_bonus` as const)
    : null;
  const subDmgTypeBonus = dmgTypeBonusKey ? (sub[dmgTypeBonusKey] ?? 0) / 100 : 0;

  // 공명효율 = 기본 100% + 무기 베이스 + 부옵(무효옵 포함) + 활성 버프
  const subEnergyRegen = ctx.substats
    .flat()
    .filter((l) => l.type === 'energy_regen' && l.value != null)
    .reduce((s, l) => s + (l.value as number), 0);
  const energyRegen = 1 + (ctx.weapon.base_stats.energy_regen ?? 0) + subEnergyRegen / 100 + buffs.energy_regen;

  return {
    attack: i.baseAttack * (1 + i.attackPercent) + i.flatAttack,
    criticalRateRaw: i.criticalRate,
    criticalRate: Math.min(i.criticalRate, 1),
    criticalDamage: i.criticalDamage,
    elementBonus: buffs.element_bonus + (main.element_damage_bonus ?? 0),
    damageTypeBonus: buffs.damage_type_bonus + subDmgTypeBonus,
    amplify: i.amplify,
    energyRegen,
  };
}
