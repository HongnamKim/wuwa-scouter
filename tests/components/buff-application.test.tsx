import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const storage = vi.hoisted(() => {
  const entries = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => entries.set(key, value),
    removeItem: (key: string) => entries.delete(key),
  });
  return entries;
});
import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import { BuffPanel } from '../../src/components/BuffPanel';
import { PartyTab } from '../../src/components/PartyTab';
import { analysisContext, initialState, defaultStateForCharacter, saveCharacterState, loadCharacterState, isStateSaved } from '../../src/state/store';
import { loadCharacters } from '../../src/engine/loadData';
import { aggregateBuffs } from '../../src/engine/buffs';
import type { Buff } from '../../src/types/data';

beforeEach(() => storage.clear());
afterAll(() => vi.unstubAllGlobals());

describe('추가 버프 적용 체크박스', () => {
  it('제목 옆에 기본 체크된 적용 체크박스를 두고 기존 일괄 버튼을 제거한다', () => {
    const html = renderToStaticMarkup(<BuffPanel state={initialState()} setState={() => {}} />);
    const header = html.match(/<h3\b[^>]*>[\s\S]*?<\/h3>/)![0];
    expect(header).toContain('추가 버프');
    expect(header).toMatch(/<input[^>]*aria-label="추가 버프 적용"[^>]*checked=""/);
    expect(html).not.toContain('전체 적용');
    expect(html).not.toContain('전체 미적용');
  });

  it('미적용 상태는 본문 입력을 잠그고 적용 체크박스는 다시 조작할 수 있다', () => {
    const state = { ...defaultStateForCharacter(loadCharacters().find((c) => c.id === 'jingran')!), additionalBuffsEnabled: false };
    const html = renderToStaticMarkup(<BuffPanel state={state} setState={() => {}} />);
    const master = html.match(/<input[^>]*aria-label="추가 버프 적용"[^>]*>/)![0];
    expect(master).not.toContain('disabled');
    expect(master).not.toContain('checked');
    expect(html).toMatch(/<fieldset[^>]*disabled=""/);
    expect(html).toContain('상시 적용');
  });

  it('파티 버프도 잠그되 저장된 개별 선택은 보존한다', () => {
    const state = { ...initialState(), additionalBuffsEnabled: false, partyMembers: [{ id: 'lucilla' }] };
    const html = renderToStaticMarkup(<StaticRouter location="/analysis/hiyuki"><PartyTab state={state} setState={() => {}} simple={false} /></StaticRouter>);
    const inputs = [...html.matchAll(/<input[^>]*type="checkbox"[^>]*>/g)].map(([input]) => input);
    expect(inputs.length).toBeGreaterThan(0);
    expect(inputs.every((input) => input.includes('disabled=""') && input.includes('checked=""'))).toBe(true);
  });

  it('조건부·파티·수동 버프를 계산에서 빼고 상시 효과는 유지한다', () => {
    const ctx = analysisContext(initialState())!;
    const conditional: Buff = { type: 'attack_percent', value: 0.2, always: false, id: 'conditional' };
    const fixed: Buff = { type: 'attack_percent', value: 0.1, always: true };
    const original = {
      ...ctx, character: { ...ctx.character, skill_node: [fixed, conditional] },
      weapon: { ...ctx.weapon, buffs: [fixed, conditional] },
      mainEcho: { ...ctx.mainEcho, buffs: [fixed, conditional] },
      echoSets: [{ ...ctx.echoSets[0], buffs: [fixed, conditional] }],
      partyProvidedBuffs: [{ ...fixed, value: 0.5 }],
      manualBuffs: [{ type: 'attack_percent' as const, value: 30 }],
      conditionalToggles: { conditional: true, previouslyOff: false },
    };
    expect(aggregateBuffs(original).attack_percent).toBeCloseTo(2);
    const off = { ...original, additionalBuffsEnabled: false };
    expect(aggregateBuffs(off).attack_percent).toBeCloseTo(0.4);
    expect(aggregateBuffs({ ...off, additionalBuffsEnabled: true })).toEqual(aggregateBuffs(original));
    expect(off.conditionalToggles).toEqual({ conditional: true, previouslyOff: false });
    expect(off.manualBuffs[0].value).toBe(30);
  });

  it('미적용 상태를 저장·복원하고 기존 저장분은 적용 상태로 읽는다', () => {
    const state = { ...initialState(), additionalBuffsEnabled: false, conditionalToggles: { selected: true } };
    saveCharacterState(state);
    const restored = loadCharacterState(state.character)!;
    expect(restored.additionalBuffsEnabled).toBe(false);
    expect(restored.conditionalToggles).toEqual(state.conditionalToggles);
    expect(isStateSaved(restored)).toBe(true);
    const key = `wuwa-scouter:save:${state.character.id}`;
    const old = JSON.parse(storage.get(key)!);
    delete old.additionalBuffsEnabled;
    storage.set(key, JSON.stringify(old));
    const legacy = loadCharacterState(state.character)!;
    expect(legacy.additionalBuffsEnabled).not.toBe(false);
    expect(isStateSaved(legacy)).toBe(true);
  });
});
