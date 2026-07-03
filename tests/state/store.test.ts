import { describe, it, expect } from 'vitest';
import { initialState, analysisContext, isUntouchedDefault } from '../../src/state/store';

describe('initialState (데이터 없는 캐릭터 = 추천값 사전 세팅)', () => {
  it('히유키 기본 상태는 전용무기/추천세트/추천메인에코/기본코스트(43311)로 채워진다', () => {
    const s = initialState();
    expect(s.character.id).toBe('hiyuki');
    expect(s.weapon?.id).toBe('frostbound_flame'); // signature_weapon
    expect(s.mainEcho?.id).toBe('void_god_echo');
    expect(s.costLayout).toBe('43311');
    expect(s.echoSets.map((e) => e.id)).toContain('wishes_of_quiet_snowfall');
  });

  it('사전 세팅 상태로 메인 조합 추천 계산이 가능하다 (analysisContext ≠ null)', () => {
    expect(analysisContext(initialState())).not.toBeNull();
  });

  it('사전 세팅(미조작) 상태는 isUntouchedDefault=true → 이탈 시 저장 팝업 없음', () => {
    expect(isUntouchedDefault(initialState())).toBe(true);
  });

  it('사용자가 값을 바꾸면 isUntouchedDefault=false → 저장 팝업 노출', () => {
    const s = initialState();
    const changed = { ...s, refinementLevel: 5 }; // 의도된 변경 예시
    expect(isUntouchedDefault(changed)).toBe(false);
  });
});
