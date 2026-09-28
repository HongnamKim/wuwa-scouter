import { describe, expect, it } from 'vitest';
import { loadCharacters, loadEchoSets, loadWeapons, validateBuff } from '../../src/engine/loadData';
import { aggregateBuffs, computeMaxHp, memberProvidedBuffs } from '../../src/engine/buffs';
import { buildPerfInput } from '../../src/engine/build';
import { slotsFrom } from '../../src/engine/echoSlots';
import { theoryBest, mainRecommendation, threeCoModeOptions } from '../../src/engine/theory';
import { hiyukiBaseCtx } from './fixtures';
import { computePerf } from '../../src/engine/perf';
import { substatMaxStage } from '../../src/engine/constants';
import type { StatKey } from '../../src/types/domain';
import { analysisContext, defaultStateForCharacter } from '../../src/state/store';

function contextForJingran() {
  const character = loadCharacters().find((c) => c.id === 'jingran');
  expect(character, '경연 데이터').toBeDefined();
  return {
    ...hiyukiBaseCtx(), character: character!,
    weapon: { id: 'empty', name: '', weapon_type: character!.weapon_type, base_stats: { attack: 0 }, buffs: [] },
    echoSets: [], mainEcho: { id: '', name: '', buffs: [] },
    slots: slotsFrom('43311', [], []), conditionalToggles: {}, requiredEnergyRegen: 120,
  };
}

describe('경연', () => {
  it('HP는 무기·스킬 노드·주옵·부옵·1코 고정 HP를 모두 합산한다', () => {
    const ctx = contextForJingran();
    const weapon = loadWeapons().find((w) => w.id === 'thousandfold_deliverance')!;
    const slots = slotsFrom('43311', [{ cost: 4, type: 'hp_percent' }], [[
      { type: 'hp_percent', value: 11.6 }, { type: 'flat_hp', value: 580 },
    ]]);
    expect(ctx.character.base_attack).toBe(312);
    expect(ctx.character.damage_bonus_type).toBe('heavy_attack');
    expect(computeMaxHp({ ...ctx, weapon, slots })).toBeCloseTo(15375 * (1 + 0.722 + 0.12 + 0.33 + 0.116) + 580 + 4560);
    expect(aggregateBuffs(ctx).critical_rate).toBeCloseTo(0.08);
  });

  it.each([30000, 49999, 50000, 60000])('HP %s에서 공격력·피해 보너스와 상한을 계산한다', (hp) => {
    const ctx = contextForJingran();
    const character = { ...ctx.character, base_hp: hp, skill_node: ctx.character.skill_node.filter((b) => b.hp_scale) };
    const trial = { ...ctx, character, slots: [] };
    const totals = aggregateBuffs(trial);
    expect(totals.flat_attack).toBeCloseTo(Math.min(hp * 0.036, 1800));
    expect(totals.element_bonus).toBeCloseTo(Math.min(hp * 0.000015, 0.75) + Math.min(hp * 0.0000125, 0.625));
    expect(aggregateBuffs({ ...trial, ascensionLevel: 3 }).flat_attack).toBeCloseTo(Math.min(hp * 0.05, 2500));
    expect(aggregateBuffs({ ...trial, ascensionLevel: 3, conditionalToggles: { jingran_chain3_attack: false } }).flat_attack).toBeCloseTo(Math.min(hp * 0.036, 1800));
  });

  it('HP 전환 공격력은 공격력%로 다시 증폭하지 않는다', () => {
    const ctx = contextForJingran();
    const normal = buildPerfInput(ctx);
    const buffed = buildPerfInput({ ...ctx, manualBuffs: [{ type: 'attack_percent', value: 50 }] });
    expect(buffed.flatAttack).toBe(normal.flatAttack);
    expect(buffed.attackPercent - normal.attackPercent).toBeCloseTo(0.5);
    const hpAdded = buildPerfInput({ ...ctx, slots: slotsFrom('43311', [], [[{ type: 'flat_hp', value: 580 }]]) });
    expect(hpAdded.flatAttack - normal.flatAttack).toBeCloseTo(580 * 0.036);
    expect(hpAdded.increaseBonus).toBeGreaterThan(normal.increaseBonus);
  });

  it('추가 변주 스택은 선택 시에만 적용하고 특정 스킬 배율은 제외한다', () => {
    const ctx = { ...contextForJingran(), ascensionLevel: 6 };
    const hp = computeMaxHp(ctx);
    const toggled = { ...ctx, conditionalToggles: { jingran_intro_extra: true } };
    expect(aggregateBuffs(toggled).element_bonus - aggregateBuffs(ctx).element_bonus).toBeCloseTo(Math.min(hp * 0.0000125, 0.625));
    const withoutRecords = { ...toggled, character: { ...ctx.character, skill_node: ctx.character.skill_node.filter((b) => !b.record_only) } };
    expect(aggregateBuffs(toggled)).toEqual(aggregateBuffs(withoutRecords));
    expect(memberProvidedBuffs({ ascensionLevel: 4 }, ctx.character).some(({ buff }) => buff.id === 'jingran_chain4_element')).toBe(true);
  });

  it.each([
    [1, 0.12, 0.24, 0.12, 0.3], [2, 0.15, 0.3, 0.15, 0.35], [3, 0.18, 0.36, 0.18, 0.4],
    [4, 0.21, 0.42, 0.21, 0.45], [5, 0.24, 0.48, 0.24, 0.5],
  ])('전용 무기 %s공진과 세트·메인 에코를 구분한다', (refinementLevel, bonus, cd, cr, ignore) => {
    const ctx = contextForJingran();
    const weapon = loadWeapons().find((w) => w.id === 'thousandfold_deliverance')!;
    expect(weapon.base_stats).toEqual({ attack: 412, hp_percent: 0.722 });
    const set = loadEchoSets().find((s) => s.id === 'lamp_of_nether_road')!;
    const totals = aggregateBuffs({ ...ctx, character: { ...ctx.character, skill_node: [] }, weapon, refinementLevel, echoSets: [set, set], mainEcho: set.main_slot_echoes[0] });
    expect(totals.hp_percent).toBeCloseTo(0.1);
    expect(totals.element_bonus).toBeCloseTo(bonus + 0.15 + 0.12);
    expect(totals.critical_damage).toBeCloseTo(cd);
    expect(totals.critical_rate).toBeCloseTo(cr + 0.2);
    expect(totals.damage_type_bonus).toBeCloseTo(0.12);
    expect(totals.defense_ignore).toBeCloseTo(ignore);
  });

  it('HP와 공격력 메인을 함께 탐색하고 1코까지 구별해 추천한다', () => {
    const ctx = contextForJingran();
    expect(threeCoModeOptions(ctx)).toEqual([]);
    const result = theoryBest(ctx);
    expect(result.perf).toBeGreaterThan(0);
    expect(result.mainPicks.some((p) => p.type === 'hp_percent')).toBe(true);
    const reco = mainRecommendation(ctx);
    expect(reco[0].kkjak.every((row) => row.label.split('·').length === 5)).toBe(true);
    expect(new Set(reco[0].kkjak.map((row) => row.label)).size).toBe(reco[0].kkjak.length);
  }, 20000);

  it('첫 진입의 44111·전용 장비 구성에서도 추천과 현재 스펙을 계산한다', () => {
    const state = defaultStateForCharacter(contextForJingran().character);
    const ctx = analysisContext(state)!;
    expect(ctx.costLayout).toBe('44111');
    expect(ctx.weapon.id).toBe('thousandfold_deliverance');
    expect(ctx.mainEcho.id).toBe('myriad_snare_rustfire_chassis');
    expect(computeMaxHp(ctx)).toBeCloseTo(15375 * (1 + 0.722 + 0.12 + 0.1));
    const reco = mainRecommendation(ctx)[0];
    expect(reco.theory[0].relative).toBe(1);
    expect(reco.kkjak[0].relative).toBe(1);
    expect(reco.kkjak[0].label).toContain('체%');
  });

  it('HP 자기 참조·파티 전달·비정상 계수는 데이터에서 거부한다', () => {
    const buff = contextForJingran().character.skill_node.find((b) => b.hp_scale)!;
    for (const patch of [
      { type: 'hp_percent' }, { target: 'party' },
      { hp_scale: { per_hp: -1, cap: 1 } }, { hp_scale: { per_hp: 1, cap: NaN } },
    ]) expect(() => validateBuff({ ...buff, ...patch })).toThrow('invalid hp_scale');
  });

  it.each([15375, 60000])('HP %s에서 탐색 최적화가 단순 전수 탐색과 같은 최고점을 낸다', (base_hp) => {
    const original = contextForJingran();
    const ctx = { ...original, costLayout: '4', requiredEnergyRegen: 100,
      character: { ...original.character, base_hp }, slots: slotsFrom('4', [], []) };
    const keys = ctx.character.effective_substats;
    let brute = 0;
    const visit = (i: number, remaining: number, counts: number[]) => {
      if (i === keys.length) {
        if (remaining !== 0) return;
        for (const type of ['attack_percent', 'hp_percent', 'critical_rate', 'critical_damage'] as StatKey[]) {
          const slots = slotsFrom('4', [{ cost: 4, type }], [keys.map((key, j) => ({ type: key, value: counts[j] * substatMaxStage(key) }))]);
          brute = Math.max(brute, computePerf(buildPerfInput({ ...ctx, slots })));
        }
        return;
      }
      for (let n = 0; n <= Math.min(5, remaining); n++) visit(i + 1, remaining - n, [...counts, n]);
    };
    visit(0, 5, []);
    expect(theoryBest(ctx).perf).toBeCloseTo(brute, 8);
  });
});
