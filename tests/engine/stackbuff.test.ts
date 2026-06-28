import { describe, it, expect } from 'vitest';
import { loadCharacters, loadWeapons, loadEchoSets } from '../../src/engine/loadData';
import { aggregateBuffs } from '../../src/engine/buffs';
import type { CalcContext } from '../../src/engine/context';

// 캐릭터 추천 세팅 기반 컨텍스트 (스택 토글/돌파만 제어). critical_damage엔 스택 버프만 기여.
function ctxFor(id: string, ascension: number, toggles: Record<string, boolean>): CalcContext {
  const character = loadCharacters().find((c) => c.id === id)!;
  const weapon = loadWeapons().find((w) => w.id === character.recommended_weapons[0])!;
  const echoSet = loadEchoSets().find((s) => s.id === character.recommended_echo_sets[0])!;
  return {
    character, weapon, mainEcho: echoSet.main_slot_echoes[0], echoSets: [echoSet],
    costLayout: '43311', mainPrimary: [], substats: [[], [], [], [], []],
    conditionalToggles: toggles, manualBuffs: [], ascensionLevel: ascension,
  };
}

describe('스택형 자체 버프 (데이터 + 돌파 조건)', () => {
  it('히유키 눈의 침식: 1스택 +40%, 6돌 2스택 +80%, 6돌 미만은 2스택 게이트', () => {
    const on = { hiyuki_snowrust_1: true, hiyuki_snowrust_2: true };
    expect(aggregateBuffs(ctxFor('hiyuki', 0, on)).critical_damage).toBeCloseTo(0.40, 10); // 2스택 게이트(6돌 미만)
    expect(aggregateBuffs(ctxFor('hiyuki', 3, on)).critical_damage).toBeCloseTo(0.40, 10);
    expect(aggregateBuffs(ctxFor('hiyuki', 6, on)).critical_damage).toBeCloseTo(0.80, 10); // 6돌 2스택 해금
    expect(aggregateBuffs(ctxFor('hiyuki', 6, { hiyuki_snowrust_1: true, hiyuki_snowrust_2: false })).critical_damage).toBeCloseTo(0.40, 10);
    expect(aggregateBuffs(ctxFor('hiyuki', 6, { hiyuki_snowrust_1: false, hiyuki_snowrust_2: false })).critical_damage).toBeCloseTo(0, 10);
  });

  it('에이메스 별과 별 사이: 스택당 +30% (게이트 없음)', () => {
    expect(aggregateBuffs(ctxFor('aemeath', 0, { aemeath_chain_1: true, aemeath_chain_2: false })).critical_damage).toBeCloseTo(0.30, 10);
    expect(aggregateBuffs(ctxFor('aemeath', 0, { aemeath_chain_1: true, aemeath_chain_2: true })).critical_damage).toBeCloseTo(0.60, 10);
  });
});
