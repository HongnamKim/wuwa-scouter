import { describe, it, expect } from 'vitest';
import { loadCharacters, loadWeapons, loadEchoSets } from '../../src/engine/loadData';
import { aggregateBuffs, memberProvidedBuffs } from '../../src/engine/buffs';
import { buildPerfInput, sumEffectiveSubstats } from '../../src/engine/build';
import { slotsFrom } from '../../src/engine/echoSlots';
import type { StatKey } from '../../src/types/domain';
import { hiyukiBaseCtx } from './fixtures';

function contextForQingxiao() {
  const character = loadCharacters().find((c) => c.id === 'qingxiao');
  expect(character, '청초 데이터가 등록되어야 한다').toBeDefined();
  return {
    ...hiyukiBaseCtx(), character: character!,
    weapon: { id: 'empty', name: '', weapon_type: character!.weapon_type, base_stats: { attack: 0 }, buffs: [] },
    echoSets: [], mainEcho: { id: '', name: '', buffs: [] }, slots: slotsFrom('43311', [], []),
    conditionalToggles: {},
  };
}

describe('청초 버프 계산 경계', () => {
  it.each([[0, 0], [1, 0.16], [6, 0.16]])('연결점과 %s돌의 상시 크리티컬을 반영한다', (ascensionLevel, crit) => {
    const totals = aggregateBuffs({ ...contextForQingxiao(), ascensionLevel });
    expect(totals.critical_rate).toBeCloseTo(crit, 10);
    expect(totals.critical_damage).toBeCloseTo(ascensionLevel >= 3 ? 0.16 + 285 / 1001 : 0.16, 10);
    expect(totals.attack_percent).toBeCloseTo(ascensionLevel >= 4 ? 0.32 : 0.12, 10);
  });

  it.each([undefined, 'heavy', 'liberation', 'basic'])('기존 저장 모드 %s와 무관하게 3돌 해방 크피에 점유율을 가중한다', (selectedMode) => {
    const base = { ...contextForQingxiao(), selectedMode };
    const before = aggregateBuffs({ ...base, ascensionLevel: 2 });
    const after = aggregateBuffs({ ...base, ascensionLevel: 3 });
    expect(after.critical_damage - before.critical_damage).toBeCloseTo(285 / 1001, 10);
  });

  it.each([
    ['basic_attack_bonus', 228], ['heavy_attack_bonus', 312],
    ['resonance_skill_bonus', 14], ['resonance_liberation_bonus', 285],
  ] as [StatKey, number][])('%s 부옵은 정규화한 점유율만큼 계산한다', (type, weight) => {
    const base = contextForQingxiao();
    const withSubstat = { ...base, slots: slotsFrom('43311', [], [[{ type, value: 10 }]]) };
    expect(sumEffectiveSubstats(withSubstat)[type]).toBe(10);
    expect(buildPerfInput(withSubstat).increaseBonus - buildPerfInput(base).increaseBonus).toBeCloseTo(0.1 * weight / 1001, 10);
  });

  it('에코 피해 버프를 반영하되 변주·반주 비중에 유형 보너스를 주지 않는다', () => {
    const base = contextForQingxiao();
    const echoOnly = { ...base, manualBuffs: [{ type: 'echo_skill_bonus' as const, value: 100 }] };
    expect(buildPerfInput(echoOnly).increaseBonus).toBeCloseTo(41 / 1001, 10);
    const allTypes: StatKey[] = ['basic_attack_bonus', 'heavy_attack_bonus', 'resonance_skill_bonus', 'resonance_liberation_bonus', 'echo_skill_bonus'];
    const all = { ...base, manualBuffs: allTypes.map((type) => ({ type, value: 100 })) };
    expect(buildPerfInput(all).increaseBonus).toBeCloseTo(880 / 1001, 10);
    // 변주 13 + 반주 108은 유형 피해 보너스가 없는 잔여분이다.
    expect(1 - buildPerfInput(all).increaseBonus).toBeCloseTo(121 / 1001, 10);
  });

  it('4돌 공격력은 조건 토글로 해제할 수 있고 파티에도 1회만 제공한다', () => {
    const base = { ...contextForQingxiao(), ascensionLevel: 4 };
    const off = { ...base, conditionalToggles: { qingxiao_chain4_atk: false } };
    expect(aggregateBuffs(base).attack_percent - aggregateBuffs(off).attack_percent).toBeCloseTo(0.2, 10);
    expect(memberProvidedBuffs({ ascensionLevel: 3 }, base.character)).toHaveLength(0);
    const provided = memberProvidedBuffs({ ascensionLevel: 4 }, base.character);
    expect(provided).toHaveLength(1);
    expect(provided[0].buff.value).toBe(0.2);
  });

  it.each(['heavy', 'liberation', 'basic'])('%s 모드에서도 배율·추가타·조화 기록을 계산에 넣지 않는다', (selectedMode) => {
    const base = { ...contextForQingxiao(), selectedMode, ascensionLevel: 6 };
    const records = base.character.skill_node.filter((b) => b.record_only);
    expect(records.length).toBeGreaterThan(0);
    const without = { ...base, character: { ...base.character, skill_node: base.character.skill_node.filter((b) => !b.record_only) } };
    expect(buildPerfInput(base)).toEqual(buildPerfInput(without));
    expect(aggregateBuffs(base).amplify).toBe(0);
  });

  it('전용 무기의 최대 스택 수치와 기류 방어력 무시를 공진에 맞게 반영한다', () => {
    const weapon = loadWeapons().find((w) => w.id === 'glint_of_clouds');
    expect(weapon).toBeDefined();
    const base = { ...contextForQingxiao(), weapon: weapon! };
    const r1 = aggregateBuffs(base);
    const r5 = aggregateBuffs({ ...base, refinementLevel: 5 });
    expect(r1.attack_percent).toBeCloseTo(0.24, 10);
    expect(r5.attack_percent).toBeCloseTo(0.36, 10);
    expect(r1.element_bonus).toBeCloseTo(0.56, 10);
    expect(r5.element_bonus).toBeCloseTo(1.12, 10);
    expect(r1.defense_ignore).toBeCloseTo(0.1, 10);
    expect(r5.defense_ignore).toBeCloseTo(0.2, 10);
    const otherElement = aggregateBuffs({ ...base, character: { ...base.character, element: '응결' as const } });
    expect(otherElement.element_bonus).toBe(0);
    expect(otherElement.defense_ignore).toBe(0);
    expect(otherElement.attack_percent).toBeCloseTo(0.24, 10);
  });

  it('신규 세트와 메인 에코의 패시브·조건부 보너스를 구분한다', () => {
    const echoSet = loadEchoSets().find((s) => s.id === 'heart_of_evils_purge');
    expect(echoSet).toBeDefined();
    const mainEcho = echoSet!.main_slot_echoes.find((e) => e.id === 'calamity_effigy')!;
    const base = { ...contextForQingxiao(), echoSets: [echoSet!], mainEcho };
    const active = aggregateBuffs(base);
    expect(active.element_bonus).toBeCloseTo(0.6, 10);
    expect(active.critical_damage).toBeCloseTo(0.36, 10);
    const inactive = aggregateBuffs({ ...base, conditionalToggles: {
      evils_purge_5pc_critdmg: false, evils_purge_5pc_aero: false, calamity_effigy_aero: false,
    } });
    expect(inactive.element_bonus).toBeCloseTo(0.2, 10);
    expect(inactive.critical_damage).toBeCloseTo(0.16, 10);
  });
});
