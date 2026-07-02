import { describe, it, expect } from 'vitest';
import { loadCharacters, loadWeapons, loadEchoSets } from '../../src/engine/loadData';
import { aggregateBuffs } from '../../src/engine/buffs';
import type { CalcContext } from '../../src/engine/context';
import { slotsFrom } from '../../src/engine/echoSlots';

// 캐릭터 추천 세팅 기반 컨텍스트 (스택 토글/돌파만 제어). critical_damage엔 스택 버프만 기여.
function ctxFor(id: string, ascension: number, toggles: Record<string, boolean>): CalcContext {
  const character = loadCharacters().find((c) => c.id === id)!;
  const weapon = loadWeapons().find((w) => w.id === character.recommended_weapons[0])!;
  const echoSet = loadEchoSets().find((s) => s.id === character.recommended_echo_sets[0])!;
  return {
    character, weapon, mainEcho: echoSet.main_slot_echoes[0], echoSets: [echoSet],
    costLayout: '43311', slots: slotsFrom('43311', [], []),
    conditionalToggles: toggles, manualBuffs: [], ascensionLevel: ascension,
  };
}

describe('스택형 자체 버프 (데이터 + 돌파 조건)', () => {
  it('히유키 눈의 침식: 1스택 +40%, 6돌 2스택 +80%, 6돌 미만은 2스택 게이트', () => {
    // 6돌 독심/납도 크피(+500%)는 이 테스트 범위 밖이라 토글로 제외
    const on = { hiyuki_snowrust_1: true, hiyuki_snowrust_2: true, hiyuki_chain6_critdmg: false };
    expect(aggregateBuffs(ctxFor('hiyuki', 0, on)).critical_damage).toBeCloseTo(0.40, 10); // 2스택 게이트(6돌 미만)
    expect(aggregateBuffs(ctxFor('hiyuki', 3, on)).critical_damage).toBeCloseTo(0.40, 10);
    expect(aggregateBuffs(ctxFor('hiyuki', 6, on)).critical_damage).toBeCloseTo(0.80, 10); // 6돌 2스택 해금
    expect(aggregateBuffs(ctxFor('hiyuki', 6, { hiyuki_snowrust_1: true, hiyuki_snowrust_2: false, hiyuki_chain6_critdmg: false })).critical_damage).toBeCloseTo(0.40, 10);
    expect(aggregateBuffs(ctxFor('hiyuki', 6, { hiyuki_snowrust_1: false, hiyuki_snowrust_2: false, hiyuki_chain6_critdmg: false })).critical_damage).toBeCloseTo(0, 10);
  });

  it('에이메스 별과 별 사이: 스택 상한이 돌파/파티에 의존 (기본 체크 <3돌 1스택, 3돌+ 풀스택)', () => {
    // 조화 파동(기본 모드): 최대 3스택 × 20%
    // 3돌 미만: 2·3스택 default_on_from_ascension=3 → 기본 해제. 미터치면 1스택(0.20)
    expect(aggregateBuffs(ctxFor('aemeath', 0, {})).critical_damage).toBeCloseTo(0.20, 10);
    // 명시 토글로 켜면(파티가 채워준 상황) 합산 0.60
    expect(aggregateBuffs(ctxFor('aemeath', 0, { aemeath_star_wave_2: true, aemeath_star_wave_3: true })).critical_damage).toBeCloseTo(0.60, 10);
    // 3돌+: 2·3스택 기본 체크 → 자력 풀스택 0.60
    expect(aggregateBuffs(ctxFor('aemeath', 3, {})).critical_damage).toBeCloseTo(0.60, 10);
    // 불꽃 모드: 최대 2스택 × 30% (다른 모드 버프는 비활성)
    const flame = (asc: number, toggles: Record<string, boolean>) => aggregateBuffs({ ...ctxFor('aemeath', asc, toggles), selectedMode: 'flame' }).critical_damage;
    expect(flame(0, {})).toBeCloseTo(0.30, 10);  // 3돌 미만 1스택
    expect(flame(3, {})).toBeCloseTo(0.60, 10);  // 3돌+ 2스택
  });
});
