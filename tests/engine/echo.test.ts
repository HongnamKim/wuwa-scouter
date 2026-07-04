import { describe, it, expect } from 'vitest';
import { loadCharacters, loadWeapons, loadEchoSets } from '../../src/engine/loadData';
import { aggregateBuffs } from '../../src/engine/buffs';
import type { CalcContext } from '../../src/engine/context';
import type { DamageBonusType } from '../../src/types/domain';
import { slotsFrom } from '../../src/engine/echoSlots';

// 솔스원의 해석(권갑)을 장착한, 피해유형을 바꾼 가상 컨텍스트
function ctxWith(damageBonusType: DamageBonusType): CalcContext {
  const base = loadCharacters().find((c) => c.id === 'lucilla')!;
  // 합성 단일유형 캐릭터: 모드 제거 후 damage_bonus_type만 지정
  const character = { ...base, modes: undefined, damage_bonus_type: damageBonusType };
  const weapon = loadWeapons().find((w) => w.id === 'solsworn_ciphers')!;
  const echoSet = loadEchoSets().find((s) => s.id === 'wishes_of_quiet_snowfall')!;
  return {
    character, weapon, mainEcho: echoSet.main_slot_echoes[0], echoSets: [echoSet],
    costLayout: '43311',
    slots: slotsFrom('43311', [], []),
    conditionalToggles: {}, // 조건부 기본 ON
    manualBuffs: [],
    requiredEnergyRegen: 0,
  };
}

describe('echo_skill 피해 유형', () => {
  it('에코 캐릭터: echo_skill_amplify(솔스원 0.32)가 부스트에 합산', () => {
    expect(aggregateBuffs(ctxWith('echo_skill')).amplify).toBeCloseTo(0.32, 10);
  });

  it('비에코 캐릭터: echo_skill_amplify는 제외(부스트 0)', () => {
    expect(aggregateBuffs(ctxWith('basic_attack')).amplify).toBeCloseTo(0, 10);
  });

  it('에코 캐릭터: echo_skill_bonus(수동 20%)가 피해유형 보너스에 합산', () => {
    const ctx = ctxWith('echo_skill');
    ctx.manualBuffs = [{ type: 'echo_skill_bonus', value: 20, enabled: true }];
    expect(aggregateBuffs(ctx).damage_type_bonus).toBeCloseTo(0.20, 10);
  });
});

describe('기도의 눈 5세트 「강설」 크리 분기(damage_bonus_type 게이트)', () => {
  it('공명해방 캐릭터만 set_5pc_critical(크리 +25%) 적용, 비공명해방은 미적용', () => {
    const rl = aggregateBuffs(ctxWith('resonance_liberation')).critical_rate;
    const ba = aggregateBuffs(ctxWith('basic_attack')).critical_rate;
    expect(rl - ba).toBeCloseTo(0.25, 10);
  });
});

describe('구원 공명해방 crit_scale (실제 크리율로 크피 동적 계산)', () => {
  it('크리율 초과분(50% 기준)만큼 크피 버프 반영, cap 30%', () => {
    const guwon = loadCharacters().find((c) => c.id === 'qiuyuan')!;
    const weapon = loadWeapons().find((w) => w.id === 'frostbound_flame')!; // 크리 24.3%
    const ctx: CalcContext = {
      character: guwon, weapon, mainEcho: { id: 'x', name: 'x', buffs: [] }, echoSets: [],
      costLayout: '43311', slots: slotsFrom('43311', [], []),
      conditionalToggles: {}, manualBuffs: [], ascensionLevel: 1, requiredEnergyRegen: 130,
    };
    // 크리율 = 0.05 기본 + 0.08 스킬노드 + 0.20 CHAIN.1 + 0.243 무기 = 0.573 → 초과 7.3% → 크피 +0.02×7.3 = 0.146
    expect(aggregateBuffs(ctx).critical_damage).toBeCloseTo(0.146, 3);
  });
});
