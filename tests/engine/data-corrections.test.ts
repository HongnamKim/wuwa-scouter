import { describe, it, expect } from 'vitest';
import { loadCharacters, loadEchoSets } from '../../src/engine/loadData';
import { aggregateBuffs } from '../../src/engine/buffs';
import { buildPerfInput } from '../../src/engine/build';
import { computePerf } from '../../src/engine/perf';
import { energyScaleValue } from '../../src/engine/mechanisms';
import { slotsFrom } from '../../src/engine/echoSlots';
import { hiyukiBaseCtx } from './fixtures';

describe('위키 대조 데이터의 계산 의미', () => {
  it('스킬 배율·추가타 기록은 계산에서 제외하고 에코와 같은 크리티컬 피해 스탯은 반영한다', () => {
    const base = hiyukiBaseCtx();
    const records = loadCharacters().flatMap((c) => c.skill_node)
      .filter((b) => b.type === 'skill_motion_value_bonus' || b.type === 'skill_motion_value_amplify');
    expect(records.length).toBeGreaterThan(0);
    const empty = { ...base, character: { ...base.character, skill_node: [] }, ascensionLevel: 6 };
    const withRecords = {
      ...empty, character: { ...empty.character, skill_node: records },
      conditionalToggles: { ...empty.conditionalToggles, ...Object.fromEntries(records.filter((b) => b.id).map((b) => [b.id!, true])) },
    };
    expect(buildPerfInput(withRecords)).toEqual(buildPerfInput(empty));
    const crit = base.character.skill_node.find((b) => b.id === 'hiyuki_chain6_critdmg')!;
    const withCrit = {
      ...empty, character: { ...empty.character, skill_node: [crit] },
      conditionalToggles: { ...empty.conditionalToggles, hiyuki_chain6_critdmg: true },
    };
    expect(buildPerfInput(withCrit).criticalDamage - buildPerfInput(empty).criticalDamage).toBe(5);
  });

  it('린네 해방은 기존 피해 보너스 100%에 합산되어 피해를 12% 늘린다', () => {
    const lynae = loadCharacters().find((c) => c.id === 'lynae')!;
    const buff = lynae.skill_node.find((b) => b.id === 'lynae_lib_alldmg')!;
    const base = {
      ...hiyukiBaseCtx(), character: { ...lynae, skill_node: [buff] },
      weapon: { id: 'empty', name: '', weapon_type: lynae.weapon_type, base_stats: { attack: 0 }, buffs: [] },
      mainEcho: { id: 'empty', name: '', buffs: [] }, echoSets: [], slots: slotsFrom('43311', [], []),
      manualBuffs: [{ type: 'element_damage_bonus' as const, value: 100 }],
      conditionalToggles: { lynae_lib_alldmg: false },
    };
    const on = { ...base, conditionalToggles: { lynae_lib_alldmg: true } };
    expect(buildPerfInput(on).increaseBonus - buildPerfInput(base).increaseBonus).toBeCloseTo(0.24, 10);
    expect(buildPerfInput(on).amplify).toBe(buildPerfInput(base).amplify);
    expect(computePerf(buildPerfInput(on)) / computePerf(buildPerfInput(base))).toBeCloseTo(1.12, 10);
  });

  it('깃털 세트의 응결 착용자는 자기 공명 효율로 공격력 버프를 받는다', () => {
    const buff = loadEchoSets().find((s) => s.id === 'song_of_feathered_trace')!.buffs
      .find((b) => b.id === 'set_feather_frost_atk')!;
    const base = { ...hiyukiBaseCtx(), echoSets: [{ id: 'test', name: '', buffs: [buff], main_slot_echoes: [] }] };
    // 에너지 부가 스탯/부옵 없이 기본 공명 효율 100% → 공격력 10%.
    const off = aggregateBuffs({ ...base, conditionalToggles: { ...base.conditionalToggles, [buff.id!]: false } });
    expect(aggregateBuffs(base).attack_percent - off.attack_percent).toBeCloseTo(0.10, 10);
    const wrongElement = { ...base, character: { ...base.character, element: '용융' as const } };
    expect(aggregateBuffs(wrongElement).attack_percent).toBeCloseTo(off.attack_percent, 10);
  });

  it('루실라 줌의 크리티컬 피해는 수혜자의 에코 피해에만 적용한다', () => {
    const lucilla = loadCharacters().find((c) => c.id === 'lucilla')!;
    const zoom = lucilla.skill_node.find((b) => b.id === 'lucilla_zoom_critdmg')!;
    // 제공자 모드 조건을 처리한 후 받는 버프. 피해 적용 범위는 남아 있어야 한다.
    const { mode: _mode, ...provided } = zoom;
    const base = hiyukiBaseCtx();
    const withZoom = { ...base, partyProvidedBuffs: [provided] };
    expect(aggregateBuffs(withZoom).critical_damage).toBeCloseTo(aggregateBuffs(base).critical_damage, 10);
    const echo = { ...withZoom, character: { ...base.character, damage_bonus_type: 'echo_skill' as const } };
    expect(aggregateBuffs(echo).critical_damage - aggregateBuffs({ ...echo, partyProvidedBuffs: [] }).critical_damage)
      .toBeCloseTo(0.40, 10);
  });

  it('수수 공명 효율 260%에서 산안개 공격력이 50% 상한에 도달한다', () => {
    const mist = loadCharacters().find((c) => c.id === 'suisui')!.skill_node.find((b) => b.id === 'suisui_mist_atk')!;
    expect(energyScaleValue(mist.energy_scale!, 2)).toBe(0);
    expect(energyScaleValue(mist.energy_scale!, 2.3)).toBeCloseTo(0.25, 12);
    expect(energyScaleValue(mist.energy_scale!, 2.6)).toBeCloseTo(0.50, 12);
  });

  it('수수 그늘의 동적 피해 보너스는 본인에게도 합연산으로 적용한다', () => {
    const suisui = loadCharacters().find((c) => c.id === 'suisui')!;
    const shade = suisui.skill_node.find((b) => b.id === 'suisui_shade_dmg')!;
    const base = {
      ...hiyukiBaseCtx(), character: { ...suisui, skill_node: [shade] },
      weapon: { id: 'empty', name: '', weapon_type: suisui.weapon_type, base_stats: { attack: 0 }, buffs: [] },
      echoSets: [], mainEcho: { id: 'empty', name: '', buffs: [] }, slots: slotsFrom('43311', [], []),
      manualBuffs: [{ type: 'energy_regen' as const, value: 160 }],
      conditionalToggles: { suisui_shade_dmg: false },
    };
    const on = aggregateBuffs({ ...base, conditionalToggles: { suisui_shade_dmg: true } });
    expect(on.element_bonus - aggregateBuffs(base).element_bonus).toBeCloseTo(0.12, 12);
    expect(on.amplify).toBe(aggregateBuffs(base).amplify);
  });
});
