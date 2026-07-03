import { describe, it, expect } from 'vitest';
import { loadCharacters, loadWeapons, loadEchoSets } from '../../src/engine/loadData';
import { aggregateBuffs } from '../../src/engine/buffs';
import { slotsFrom } from '../../src/engine/echoSlots';
import type { CalcContext, ManualBuff } from '../../src/engine/context';
import type { DamageBonusType } from '../../src/types/domain';

// damage_bonus_type만 바꿔치기한 합성 컨텍스트. 유형 부스트 반영 규칙 검증용.
function ctx(dmgType: DamageBonusType | null, manualBuffs: ManualBuff[]): CalcContext {
  const base = loadCharacters().find((c) => c.id === 'hiyuki')!;
  const character = { ...base, damage_bonus_type: dmgType };
  const weapon = loadWeapons().find((w) => w.id === 'frostbound_flame')!;
  const echoSet = loadEchoSets()[0];
  return {
    character, weapon, mainEcho: echoSet.main_slot_echoes[0], echoSets: [echoSet],
    costLayout: '43311', slots: slotsFrom('43311', [], []),
    conditionalToggles: {}, manualBuffs,
  };
}
const ELEM_ALL: ManualBuff[] = [
  { type: 'element_damage_amplify', value: 20, enabled: true },
  { type: 'all_damage_amplify', value: 10, enabled: true },
];
const WITH_HEAVY: ManualBuff[] = [...ELEM_ALL, { type: 'heavy_attack_amplify', value: 30, enabled: true }];
// heavy_attack_amplify 버프의 amplify 기여분만 격리(캐릭터 자체 부스트에 무관)
const heavyContribution = (dmgType: DamageBonusType | null) =>
  aggregateBuffs(ctx(dmgType, WITH_HEAVY)).amplify - aggregateBuffs(ctx(dmgType, ELEM_ALL)).amplify;

describe('damage_bonus_type null 부스트 반영 규칙', () => {
  it('null 유형: 유형(강공격) 부스트 무시 (기여 0)', () => {
    expect(heavyContribution(null)).toBeCloseTo(0, 10);
  });
  it('강공격 유형: 유형 부스트 반영 (+0.30)', () => {
    expect(heavyContribution('heavy_attack')).toBeCloseTo(0.30, 10);
  });
  it('공명해방 유형: off-type 강공격 부스트 무시 (기여 0)', () => {
    expect(heavyContribution('resonance_liberation')).toBeCloseTo(0, 10);
  });
  it('null 유형에서도 속성·전체 부스트는 반영된다(ELEM_ALL이 amplify에 들어감)', () => {
    // element(0.20)+all(0.10) 최소 0.30 이상 반영(캐릭터 자체 부스트 더해질 수 있음)
    expect(aggregateBuffs(ctx(null, ELEM_ALL)).amplify).toBeGreaterThanOrEqual(0.30 - 1e-9);
  });
});
