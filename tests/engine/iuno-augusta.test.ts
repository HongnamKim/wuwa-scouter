import { describe, it, expect } from 'vitest';
import { loadCharacters, loadWeapons } from '../../src/engine/loadData';
import { aggregateBuffs } from '../../src/engine/buffs';
import { buildPerfInput } from '../../src/engine/build';
import { critScaleValue } from '../../src/engine/mechanisms';
import { slotsFrom } from '../../src/engine/echoSlots';
import type { DamageBonusType } from '../../src/types/domain';
import { hiyukiBaseCtx } from './fixtures';

function contextFor(id: string) {
  const character = loadCharacters().find((c) => c.id === id)!;
  return {
    ...hiyukiBaseCtx(), character,
    weapon: { id: 'empty', name: '', weapon_type: character.weapon_type, base_stats: { attack: 0 }, buffs: [] },
    echoSets: [], mainEcho: { id: '', name: '', buffs: [] }, slots: slotsFrom('43311', [], []),
    conditionalToggles: {},
  };
}

describe('유노·아우구스타 원문 대조', () => {
  it.each([
    ['moongazers_sigil', 'iuno', 'resonance_liberation'],
    ['thunderflare_dominion', 'augusta', 'heavy_attack'],
  ])('%s의 방어력 무시는 지정 피해 유형에서만 적용된다', (weaponId, characterId, damageType) => {
    const weapon = loadWeapons().find((w) => w.id === weaponId)!;
    const base = { ...contextFor(characterId), weapon };
    const wrongType = { ...base, character: { ...base.character, damage_bonus_type: 'basic_attack' as const } };
    expect(aggregateBuffs(wrongType).defense_ignore).toBe(0);
    expect(buildPerfInput(wrongType).defResFactor).toBe(1);
    const correctType = { ...base, character: { ...base.character, damage_bonus_type: damageType as DamageBonusType } };
    expect(aggregateBuffs(correctType).defense_ignore).toBeCloseTo(0.36, 10);
    expect(aggregateBuffs({ ...correctType, refinementLevel: 5 }).defense_ignore).toBeCloseTo(0.60, 10);
  });

  it('유노 5돌 해방 보너스는 추가 발동 조건 없이 돌파 단계에 따라 적용된다', () => {
    const base = { ...contextFor('iuno'), conditionalToggles: { iuno_chain5_rl: false } };
    expect(aggregateBuffs({ ...base, ascensionLevel: 4 }).damage_type_bonus).toBe(0);
    expect(aggregateBuffs({ ...base, ascensionLevel: 5 }).damage_type_bonus).toBeCloseTo(0.20, 10);
  });

  it.each([[0, 0.15, 0, 0.08], [1, 0.30, 0.30, 0.08], [2, 0.30, 0.30, 0.48], [6, 0.60, 0.60, 0.88]])(
    '아우구스타 %s돌의 왕관 최대 스택은 추가분만 합산한다', (ascensionLevel, element, critDamage, critRate) => {
      const totals = aggregateBuffs({ ...contextFor('augusta'), ascensionLevel });
      expect(totals.element_bonus).toBeCloseTo(element, 10);
      expect(totals.critical_damage).toBeCloseTo(critDamage, 10);
      expect(totals.critical_rate).toBeCloseTo(critRate, 10);
    },
  );

  it.each([[100, 0], [112.9999, 0.24], [113, 0.26], [114, 0.28], [149.9, 0.98], [150, 1.00], [175, 1.50], [200, 1.50]])(
    '아우구스타 크리티컬 %s%%에서 초과분 변환 합계는 %s다', (crit, expected) => {
      const scales = contextFor('augusta').character.skill_node.filter((b) => b.crit_scale);
      const total = scales.reduce((sum, b) => sum + critScaleValue(b.crit_scale!, crit / 100), 0);
      expect(total).toBeCloseTo(expected, 10);
    },
  );

  it.each(['iuno', 'augusta'])('%s의 배율·추가타 기록은 6돌에서도 계산에 포함하지 않는다', (id) => {
    const base = { ...contextFor(id), ascensionLevel: 6 };
    const withoutRecords = { ...base, character: { ...base.character, skill_node: base.character.skill_node.filter((b) => !b.record_only) } };
    expect(buildPerfInput(base)).toEqual(buildPerfInput(withoutRecords));
  });
});
