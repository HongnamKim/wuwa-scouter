import { describe, expect, it } from 'vitest';
import { loadCharacters, loadEchoSets, loadWeapons } from '../../src/engine/loadData';
import { aggregateBuffs, memberProvidedBuffs } from '../../src/engine/buffs';
import { buildPerfInput } from '../../src/engine/build';
import { slotsFrom } from '../../src/engine/echoSlots';
import { hiyukiBaseCtx } from './fixtures';

function contextForHsin(selectedMode = 'unison') {
  const character = loadCharacters().find((c) => c.id === 'hsin');
  expect(character, '여우의 별자리 데이터').toBeDefined();
  return {
    ...hiyukiBaseCtx(), character: character!, selectedMode,
    weapon: { id: 'empty', name: '', weapon_type: character!.weapon_type, base_stats: { attack: 0 }, buffs: [] },
    echoSets: [], mainEcho: { id: '', name: '', buffs: [] },
    slots: slotsFrom('43311', [], []), conditionalToggles: {},
  };
}

describe('여우의 별자리', () => {
  it('양 모드를 공명 스킬 대표 피해로 계산하고 스킬 노드를 항상 반영한다', () => {
    for (const mode of ['unison', 'electro_flare']) {
      const ctx = contextForHsin(mode);
      expect(ctx.character.base_attack).toBe(462);
      expect(ctx.character.damage_type_mix).toBeUndefined();
      expect(aggregateBuffs(ctx).critical_rate).toBeCloseTo(0.08);
      const withSkill = { ...ctx, slots: slotsFrom('43311', [], [[{ type: 'resonance_skill_bonus' as const, value: 10 }]]) };
      expect(buildPerfInput(withSkill).increaseBonus - buildPerfInput(ctx).increaseBonus).toBeCloseTo(0.1);
    }
    expect(aggregateBuffs(contextForHsin()).attack_percent).toBeCloseTo(0.62);
    expect(aggregateBuffs(contextForHsin('electro_flare')).attack_percent).toBeCloseTo(0.12);
  });

  it('전자 모드의 추가 스택과 전도 방랑자 버프는 별도로 켠다', () => {
    const ctx = contextForHsin('electro_flare');
    expect(aggregateBuffs(ctx).element_bonus).toBeCloseTo(0.25);
    const toggles = { hsin_electro_stack2: true, hsin_electro_rover_self: true };
    expect(aggregateBuffs({ ...ctx, conditionalToggles: toggles }).element_bonus).toBeCloseTo(0.7);
    expect(aggregateBuffs({ ...ctx, selectedMode: 'unison', conditionalToggles: toggles }).element_bonus).toBe(0);
  });

  it('3돌의 특정 공격 크리티컬 피해는 선택 시에만 적용하고 6돌 추가 스택은 분리한다', () => {
    const ctx = { ...contextForHsin(), ascensionLevel: 3 };
    expect(aggregateBuffs(ctx).critical_damage).toBe(0);
    const conditionalToggles = { hsin_chain3_finisher_crit: true, hsin_chain6_finisher_crit: true };
    expect(aggregateBuffs({ ...ctx, conditionalToggles }).critical_damage).toBeCloseTo(0.65);
    expect(aggregateBuffs({ ...ctx, ascensionLevel: 6, conditionalToggles }).critical_damage).toBeCloseTo(0.8);
    expect(aggregateBuffs({ ...ctx, selectedMode: 'electro_flare', ascensionLevel: 6, conditionalToggles }).critical_damage).toBe(0);
  });

  it('4돌 파티 보너스를 제공하고 반주 효과는 본인에게 적용하지 않는다', () => {
    const ctx = { ...contextForHsin(), ascensionLevel: 4 };
    expect(aggregateBuffs(ctx).element_bonus).toBeCloseTo(0.2);
    expect(aggregateBuffs(ctx).amplify).toBe(0);
    const buffs = memberProvidedBuffs({ ascensionLevel: 4, selectedMode: 'electro_flare' }, ctx.character);
    expect(buffs.some(({ buff }) => buff.id === 'hsin_chain4_element')).toBe(true);
    expect(buffs.some(({ buff }) => buff.id === 'hsin_outro_electro' && buff.element === '전도')).toBe(true);
    expect(buffs.some(({ buff }) => buff.id === 'hsin_outro_unison')).toBe(false);
  });

  it('기록 전용 배율·합일·전자 효과는 모든 토글을 켜도 계산에 들어가지 않는다', () => {
    const ctx = { ...contextForHsin('electro_flare'), ascensionLevel: 6 };
    const conditionalToggles = Object.fromEntries(ctx.character.skill_node.map((b) => [b.id!, true]));
    const all = { ...ctx, conditionalToggles };
    const withoutRecords = { ...all, character: { ...ctx.character, skill_node: ctx.character.skill_node.filter((b) => !b.record_only) } };
    expect(aggregateBuffs(all)).toEqual(aggregateBuffs(withoutRecords));
    expect(aggregateBuffs(all).critical_rate).toBeCloseTo(0.08);
    expect(aggregateBuffs(all).critical_damage).toBe(0);
  });

  it.each([
    [1, 0.12, 0.36, 0.1], [2, 0.15, 0.45, 0.135], [3, 0.18, 0.54, 0.17],
    [4, 0.21, 0.63, 0.205], [5, 0.24, 0.72, 0.24],
  ])('전용 무기 %s공진의 보너스·부스트·저항 무시를 구분한다', (refinementLevel, bonus, amplify, ignore) => {
    const weapon = loadWeapons().find((w) => w.id === 'blooming_jadehaven')!;
    expect(weapon.base_stats).toEqual({ attack: 587, critical_rate: 0.243 });
    const totals = aggregateBuffs({ ...contextForHsin(), weapon, refinementLevel });
    expect(totals.element_bonus).toBeCloseTo(bonus);
    expect(totals.damage_type_bonus).toBe(0);
    expect(totals.amplify_damage_type).toBeCloseTo(amplify);
    expect(totals.element_resistance_ignore).toBeCloseTo(ignore);
  });

  it('꿈 세트와 메인 에코를 중복 없이 합산한다', () => {
    const set = loadEchoSets().find((s) => s.id === 'heart_of_sworn_vigil')!;
    const totals = aggregateBuffs({ ...contextForHsin(), echoSets: [set, set], mainEcho: set.main_slot_echoes[0] });
    expect(totals.critical_rate).toBeCloseTo(0.08 + 0.15);
    expect(totals.element_bonus).toBeCloseTo(0.1 + 0.225 + 0.1 + 0.1);
  });

  it('거울 세트의 다음 캐릭터 전도 보너스를 착용자에게 더하지 않는다', () => {
    const set = loadEchoSets().find((s) => s.id === 'flash_of_electric_reflection')!;
    const ctx = contextForHsin();
    expect(aggregateBuffs({ ...ctx, echoSets: [set] }).element_bonus).toBeCloseTo(0.2);
    const provided = memberProvidedBuffs({ echoSets: [set, set] }, ctx.character).filter((b) => b.source === '화음 세트');
    expect(provided).toHaveLength(1);
    expect(provided[0].buff).toMatchObject({ target: 'next_character', element: '전도', value: 0.25 });
  });
});
