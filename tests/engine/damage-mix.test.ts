import { describe, it, expect } from 'vitest';
import { aggregateBuffs, damageTypeIncrease, BuffTotals } from '../../src/engine/buffs';
import { buildPerfInput } from '../../src/engine/build';
import type { CalcContext } from '../../src/engine/context';
import { hiyukiBaseCtx } from './fixtures';

// 가중 이중 피해유형(damage_type_mix): 갈브레나처럼 에코 어빌리티 + 강공격을 병행하는 딜러.
// 피해유형 증가항 = Σ share × (유형별 버프 + 유형별 부옵). 무유형 잔여분(합<1)은 유형 보너스 없음.
describe('damage_type_mix (가중 이중 피해유형)', () => {
  it('damageTypeIncrease: 유형별 비중 가중 (에코 0.6 버프 + 강공격 0.4 부옵)', () => {
    const ctx = { character: { damage_type_mix: [
      { type: 'echo_skill', share: 0.6 }, { type: 'heavy_attack', share: 0.4 },
    ] } } as unknown as CalcContext;
    const buffs = { damage_type_bonus_factor: 0, damage_type_bonus: 0, damage_type_bonus_by: { echo_skill: 0.2 } } as unknown as BuffTotals;
    const sub = { heavy_attack_bonus: 20 }; // 강공격 피해% 부옵 20% → 0.20
    // 0.6×0.2(에코 버프) + 0.4×0.20(강공격 부옵) = 0.12 + 0.08 = 0.20
    expect(damageTypeIncrease(ctx, buffs, sub)).toBeCloseTo(0.20, 6);
  });

  it('무유형 잔여분(share 합<1)은 유형 보너스에 안 들어감', () => {
    // 갈브레나 실측: 에코 0.571 / 강공격 0.321 (합 0.892, 나머지 0.108 = 반주 무유형)
    const ctx = { character: { damage_type_mix: [
      { type: 'echo_skill', share: 0.571 }, { type: 'heavy_attack', share: 0.321 },
    ] } } as unknown as CalcContext;
    const buffs = { damage_type_bonus_factor: 0, damage_type_bonus: 0, damage_type_bonus_by: { echo_skill: 1, heavy_attack: 1 } } as unknown as BuffTotals;
    // 유형별 100% 버프여도 유형 항은 0.571+0.321 = 0.892 (반주 0.108분은 제외)
    expect(damageTypeIncrease(ctx, buffs, {})).toBeCloseTo(0.892, 6);
  });

  it('단일유형은 기존과 동일 (하위호환)', () => {
    const ctx = { character: { damage_bonus_type: 'heavy_attack' } } as unknown as CalcContext;
    const buffs = { damage_type_bonus_factor: 0, damage_type_bonus: 0.15, damage_type_bonus_by: {} } as unknown as BuffTotals;
    const sub = { heavy_attack_bonus: 20 };
    expect(damageTypeIncrease(ctx, buffs, sub)).toBeCloseTo(0.35, 6); // 0.15 버프 + 0.20 부옵
  });

  it('damage_type_bonus_factor(×1.4) 적용', () => {
    const ctx = { character: { damage_type_mix: [{ type: 'echo_skill', share: 1 }] } } as unknown as CalcContext;
    const buffs = { damage_type_bonus_factor: 0.4, damage_type_bonus: 0, damage_type_bonus_by: { echo_skill: 0.1 } } as unknown as BuffTotals;
    expect(damageTypeIncrease(ctx, buffs, {})).toBeCloseTo(0.14, 6); // 1×0.1×1.4
  });

  it('aggregateBuffs: 에코 피해%(echo_skill_bonus) 버프가 유형별 맵에 집계', () => {
    const ctx = hiyukiBaseCtx();
    ctx.manualBuffs = [{ type: 'echo_skill_bonus', value: 25, enabled: true }]; // 25%
    const buffs = aggregateBuffs(ctx);
    expect(buffs.damage_type_bonus_by.echo_skill).toBeCloseTo(0.25, 6);
  });

  it('mix 캐릭터: 에코 피해% 파티/기타 버프가 딜에 share만큼만 반영', () => {
    const base = hiyukiBaseCtx();
    const character = { ...base.character, damage_bonus_type: 'heavy_attack' as const,
      damage_type_mix: [{ type: 'echo_skill' as const, share: 0.6 }, { type: 'heavy_attack' as const, share: 0.4 }] };
    const ctx: CalcContext = { ...base, character, manualBuffs: [{ type: 'echo_skill_bonus', value: 20, enabled: true }] };
    const withEcho = buildPerfInput(ctx).increaseBonus;
    const without = buildPerfInput({ ...ctx, manualBuffs: [] }).increaseBonus;
    // 에코 버프 0.20 × share 0.6 = 0.12 만큼만 증가 (강공격분엔 안 붙음)
    expect(withEcho - without).toBeCloseTo(0.12, 6);
  });
});
