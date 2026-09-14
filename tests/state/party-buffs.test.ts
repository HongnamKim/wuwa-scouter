import { beforeEach, describe, it, expect, vi } from 'vitest';

const storage = vi.hoisted(() => {
  const entries = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => entries.set(key, value),
    removeItem: (key: string) => entries.delete(key),
  });
  return entries;
});

import { analysisContext, initialState, memberProvidedBuffsFor, saveCharacterState, loadCharacterState, isStateSaved } from '../../src/state/store';
import { loadCharacters } from '../../src/engine/loadData';
import { slotsFrom } from '../../src/engine/echoSlots';
import { aggregateBuffs, memberProvidedBuffs } from '../../src/engine/buffs';

beforeEach(() => storage.clear());

function saveQiuyuan(crit: number) {
  const character = loadCharacters().find((c) => c.id === 'qiuyuan')!;
  storage.set('wuwa-scouter:save:qiuyuan', JSON.stringify({
    weaponId: 'emerald_of_genesis', echoSetIds: ['moonlit_clouds'], mainEchoId: null,
    costLayout: '43311', ascensionLevel: 0, refinementLevel: 1,
    // 기본 5% + 연결점 8% + 천년의 회류 24.3% = 37.3%.
    slots: slotsFrom('43311', [], [[{ type: 'critical_rate', value: crit - 37.3 }]]),
    conditionalToggles: {}, manualBuffs: [],
  }));
  return character;
}

function receivedCrit(disabled: string[] = []) {
  const state = initialState();
  const withParty = analysisContext({ ...state, partyMembers: [{ id: 'qiuyuan', disabled }] })!;
  return aggregateBuffs(withParty).critical_damage - aggregateBuffs(analysisContext(state)!).critical_damage;
}

describe('파티 동적 크리티컬 버프', () => {
  it.each([[50, 0], [60, 0.20], [65, 0.30], [80, 0.30]])('구원 크리티컬 %s%%로 표시와 수혜량을 계산한다', (crit, expected) => {
    const character = saveQiuyuan(crit);
    const scaledValue = memberProvidedBuffsFor(character).find((p) => p.buff.id === 'guwon_lib_critdmg')!.scaledValue;
    expect(scaledValue).not.toBeNull();
    expect(scaledValue).toBeCloseTo(expected, 10);
    expect(receivedCrit()).toBeCloseTo(expected, 10);
  });

  it('저장 빌드가 없으면 최대 크리티컬 피해를 임의로 제공하지 않는다', () => {
    const character = loadCharacters().find((c) => c.id === 'qiuyuan')!;
    expect(memberProvidedBuffsFor(character).find((p) => p.buff.id === 'guwon_lib_critdmg')!.scaledValue).toBeNull();
    expect(receivedCrit()).toBe(0);
  });

  it('파티 토글을 끄면 제공자 스탯과 무관하게 버프를 제외한다', () => {
    saveQiuyuan(65);
    expect(receivedCrit(['guwon_lib_critdmg'])).toBe(0);
  });

  it('수혜자 크리티컬 대신 제공자의 저장 스탯을 사용한다', () => {
    saveQiuyuan(60);
    const state = initialState();
    const receiver = { ...state, manualBuffs: [{ type: 'critical_rate' as const, value: 100 }] };
    const base = aggregateBuffs(analysisContext(receiver)!).critical_damage;
    const withParty = analysisContext({ ...receiver, partyMembers: [{ id: 'qiuyuan' }] })!;
    expect(aggregateBuffs(withParty).critical_damage - base).toBeCloseTo(0.20, 10);
  });

  it('루실라 모드와 수혜자 피해유형을 파티 전달에서도 구분한다', () => {
    const lucilla = loadCharacters().find((c) => c.id === 'lucilla')!;
    const provided = memberProvidedBuffs({ selectedMode: 'echo' }, lucilla);
    storage.set('wuwa-scouter:save:lucilla', JSON.stringify({ selectedMode: 'echo' }));
    const state = initialState();
    const onlyZoom = [{ id: 'lucilla', disabled: provided.filter((p) => p.buff.id !== 'lucilla_zoom_critdmg').map((p) => p.key) }];
    const base = aggregateBuffs(analysisContext(state)!).critical_damage;
    expect(aggregateBuffs(analysisContext({ ...state, partyMembers: onlyZoom })!).critical_damage).toBeCloseTo(base, 10);
    const echo = { ...state, character: { ...state.character, damage_bonus_type: 'echo_skill' as const } };
    expect(aggregateBuffs(analysisContext({ ...echo, partyMembers: onlyZoom })!).critical_damage
      - aggregateBuffs(analysisContext(echo)!).critical_damage).toBeCloseTo(0.40, 10);
  });
});

describe('모니에 방어력 버프 추가 전 저장 호환', () => {
  it.each([0, 2])('%s돌에서 꺼 둔 세트 버프를 보존하고 재저장 후 다시 이동시키지 않는다', (ascensionLevel) => {
    const mornye = loadCharacters().find((c) => c.id === 'mornye')!;
    storage.set('wuwa-scouter:save:mornye', JSON.stringify({ echoSetIds: ['moonlit_clouds'], ascensionLevel }));
    const current = memberProvidedBuffsFor(mornye);
    const legacy = current.filter((p) => p.buff.id !== 'mornye_strong_field');
    const index = legacy.findIndex((p) => p.source === '화음 세트' && p.buff.type === 'attack_percent');
    expect(index).toBeGreaterThanOrEqual(0);
    const setBuff = legacy[index];
    const state = initialState();
    saveCharacterState({ ...state, partyMembers: [{ id: 'mornye', disabled: [`#${index}`, 'mornye_interference', '#999'] }] });
    const key = `wuwa-scouter:save:${state.character.id}`;
    const saved = JSON.parse(storage.get(key)!);
    delete saved.partyBuffVersion; // 수정 전 저장 형식
    storage.set(key, JSON.stringify(saved));

    const restored = loadCharacterState(state.character)!;
    expect(restored.partyMembers![0].disabled).toEqual([setBuff.key, 'mornye_interference', '#999']);
    expect(analysisContext(restored)!.partyProvidedBuffs!.some((b) => b.type === 'attack_percent')).toBe(false);
    expect(isStateSaved(restored)).toBe(true);
    saveCharacterState(restored);
    expect(loadCharacterState(state.character)!.partyMembers).toEqual(restored.partyMembers);
    expect(isStateSaved(loadCharacterState(state.character)!)).toBe(true);
  });

  it('모니에가 없는 기존 저장은 수정된 상태로 오인하지 않는다', () => {
    const state = initialState();
    saveCharacterState(state);
    const key = `wuwa-scouter:save:${state.character.id}`;
    const saved = JSON.parse(storage.get(key)!);
    delete saved.partyBuffVersion;
    storage.set(key, JSON.stringify(saved));
    expect(isStateSaved(loadCharacterState(state.character)!)).toBe(true);
  });
});
