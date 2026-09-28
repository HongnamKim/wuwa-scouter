import { beforeEach, describe, expect, it, vi } from 'vitest';

const storage = vi.hoisted(() => {
  const entries = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => entries.set(key, value),
    removeItem: (key: string) => entries.delete(key),
  });
  return entries;
});

import { loadCharacters } from '../../src/engine/loadData';
import { aggregateBuffs, memberProvidedBuffs } from '../../src/engine/buffs';
import { slotsFrom } from '../../src/engine/echoSlots';
import { analysisContext, defaultStateForCharacter, saveCharacterState } from '../../src/state/store';
import { hiyukiBaseCtx } from './fixtures';

beforeEach(() => storage.clear());

function character(id: string) {
  const found = loadCharacters().find((c) => c.id === id);
  expect(found, `${id} 캐릭터 데이터`).toBeDefined();
  return found!;
}

function context(id: string) {
  const char = character(id);
  return {
    ...hiyukiBaseCtx(), character: char,
    weapon: { id: 'empty', name: '', weapon_type: char.weapon_type, base_stats: { attack: 0 }, buffs: [] },
    mainEcho: { id: '', name: '', buffs: [] }, echoSets: [],
    slots: slotsFrom('43311', [], []), conditionalToggles: {},
  };
}

describe('전도 방랑자·복링 데이터', () => {
  it.each(['rover_electro', 'buling'])('%s의 기본 장비가 연결되어 분석할 수 있다', (id) => {
    const state = defaultStateForCharacter(character(id));
    expect(state.weapon?.weapon_type).toBe(state.character.weapon_type);
    expect(state.mainEcho).not.toBeNull();
    expect(analysisContext(state)).not.toBeNull();
    expect(state.character.signature_weapon).toBeNull();
  });

  it('전도 방랑자의 지원 운용에는 과부하 공격력만 켜고 임계 공명 효과는 선택한다', () => {
    const ctx = context('rover_electro');
    const base = aggregateBuffs(ctx);
    expect(base.attack_percent).toBeCloseTo(0.12 + 0.1);
    expect(base.critical_rate).toBeCloseTo(0.08);
    expect(base.damage_type_bonus).toBe(0);
    expect(base.amplify).toBe(0); // 반주는 다음 캐릭터만 수혜
    expect(aggregateBuffs({ ...ctx, ascensionLevel: 5 }).critical_damage).toBe(0);
    const conditionalToggles = { rover_electro_apex_skill: true, rover_electro_chain5_critdmg: true };
    expect(aggregateBuffs({ ...ctx, conditionalToggles }).damage_type_bonus).toBeCloseTo(0.2);
    expect(aggregateBuffs({ ...ctx, conditionalToggles }).critical_damage).toBe(0);
    expect(aggregateBuffs({ ...ctx, conditionalToggles, ascensionLevel: 5 }).critical_damage).toBeCloseTo(0.2);
  });

  it('전도 방랑자의 3·4·6돌 배율 증가는 켜도 계산하지 않는다', () => {
    const ctx = { ...context('rover_electro'), ascensionLevel: 6 };
    const records = ctx.character.skill_node.filter((b) => b.record_only);
    expect(records.map((b) => b.min_ascension)).toEqual([3, 4, 6]);
    const all = { ...ctx, conditionalToggles: Object.fromEntries(records.map((b) => [b.id!, true])) };
    expect(aggregateBuffs(all)).toEqual(aggregateBuffs({
      ...all, character: { ...ctx.character, skill_node: ctx.character.skill_node.filter((b) => !b.record_only) },
    }));
    expect(memberProvidedBuffs({ ascensionLevel: 6 }, ctx.character).some((p) => p.buff.record_only)).toBe(false);
  });

  it('복링 1돌 크리티컬은 강화 해방에만 적용하고 에너지 회복을 공효로 더하지 않는다', () => {
    const ctx = { ...context('buling'), ascensionLevel: 2 };
    expect(aggregateBuffs(ctx).critical_rate).toBeCloseTo(0.2);
    expect(aggregateBuffs(ctx).energy_regen).toBe(0);
    expect(aggregateBuffs({ ...ctx, character: { ...ctx.character, damage_bonus_type: 'basic_attack' as const } }).critical_rate).toBe(0);
  });
});

describe('여우의 별자리·전도 방랑자·복링 파티', () => {
  it.each([[0, 0.25], [5, 0.25], [6, 0.5]])('복링 %s돌은 스킬 보너스 %s와 별도의 피해 부스트를 전달한다', (ascensionLevel, bonus) => {
    character('rover_electro');
    character('buling');
    storage.set('wuwa-scouter:save:buling', JSON.stringify({ ascensionLevel }));
    const state = { ...defaultStateForCharacter(character('hsin')), selectedMode: 'electro_flare' };
    const base = aggregateBuffs(analysisContext(state)!);
    const party = aggregateBuffs(analysisContext({ ...state, partyMembers: [{ id: 'rover_electro' }, { id: 'buling' }] })!);
    expect(party.attack_percent - base.attack_percent).toBeCloseTo(0.1);
    expect(party.damage_type_bonus - base.damage_type_bonus).toBeCloseTo(bonus);
    expect(party.amplify_all - base.amplify_all).toBeCloseTo(0.25 + 0.15);
    expect(party.critical_rate).toBeCloseTo(base.critical_rate);
  });

  it('복링의 변주 1회·2회 증가분과 6돌 추가분을 따로 끌 수 있다', () => {
    character('buling');
    storage.set('wuwa-scouter:save:buling', JSON.stringify({ ascensionLevel: 6 }));
    const state = defaultStateForCharacter(character('hsin'));
    const base = aggregateBuffs(analysisContext(state)!);
    const ctx = analysisContext({ ...state, partyMembers: [{
      id: 'buling', disabled: ['buling_forte_second_intro', 'buling_chain6_skill'],
    }] })!;
    expect(aggregateBuffs(ctx).damage_type_bonus - base.damage_type_bonus).toBeCloseTo(0.1);
    expect(aggregateBuffs(analysisContext({ ...state, additionalBuffsEnabled: false, partyMembers: [{ id: 'buling' }] })!).amplify_all)
      .toBe(aggregateBuffs(analysisContext({ ...state, additionalBuffsEnabled: false })!).amplify_all);
  });

  it('복링의 스킬 보너스를 다른 피해유형에 더하지 않는다', () => {
    character('buling');
    const state = defaultStateForCharacter(character('hiyuki'));
    const base = aggregateBuffs(analysisContext(state)!);
    const party = aggregateBuffs(analysisContext({ ...state, partyMembers: [{ id: 'buling' }] })!);
    expect(party.damage_type_bonus).toBeCloseTo(base.damage_type_bonus);
    expect(party.amplify_all - base.amplify_all).toBeCloseTo(0.15);
  });

  it('저장한 구름·광휘 세트와 메인 에코의 버프도 함께 전달한다', () => {
    saveCharacterState(defaultStateForCharacter(character('rover_electro')));
    saveCharacterState(defaultStateForCharacter(character('buling')));
    const state = defaultStateForCharacter(character('hsin'));
    const base = aggregateBuffs(analysisContext(state)!);
    const party = aggregateBuffs(analysisContext({ ...state, partyMembers: [{ id: 'rover_electro' }, { id: 'buling' }] })!);
    expect(party.attack_percent - base.attack_percent).toBeCloseTo(0.1 + 0.225 + 0.15 + 0.1);
    expect(party.element_bonus - base.element_bonus).toBeCloseTo(0.12);
    expect(party.damage_type_bonus - base.damage_type_bonus).toBeCloseTo(0.25);
  });

  it('여우의 별자리 전자 모드의 전도 20%는 전도 방랑자에게만 제공한다', () => {
    const hsin = character('hsin');
    const provided = memberProvidedBuffs({ selectedMode: 'electro_flare' }, hsin);
    const specific = provided.find((p) => p.buff.id === 'hsin_electro_rover_party');
    expect(specific?.buff).toMatchObject({ value: 0.2, target: 'specific_character', target_character: 'rover_electro' });
    expect(memberProvidedBuffs({ selectedMode: 'unison' }, hsin).some((p) => p.key === specific?.key)).toBe(false);
    for (const id of ['rover_electro', 'buling']) {
      const state = defaultStateForCharacter(character(id));
      const base = aggregateBuffs(analysisContext(state)!);
      const withHsin = { ...state, partyMembers: [{ id: 'hsin', selectedMode: 'electro_flare' }] };
      expect(aggregateBuffs(analysisContext(withHsin)!).element_bonus - base.element_bonus).toBeCloseTo(id === 'rover_electro' ? 0.2 : 0);
    }
  });
});
