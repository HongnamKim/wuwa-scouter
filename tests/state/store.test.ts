import { describe, it, expect } from 'vitest';
import { initialState, analysisContext } from '../../src/state/store';

describe('initialState (데이터 없는 캐릭터 = 빈 세팅)', () => {
  it('히유키 기본 상태는 무기/화음세트/메인에코/코스트 미설정으로 시작', () => {
    const s = initialState();
    expect(s.character.id).toBe('hiyuki');
    expect(s.weapon).toBeNull();
    expect(s.mainEcho).toBeNull();
    expect(s.costLayout).toBeNull();
    expect(s.echoSets).toHaveLength(0);
    expect(s.slots).toHaveLength(0);
  });

  it('미설정 상태는 계산용 컨텍스트가 없다 (analysisContext = null)', () => {
    expect(analysisContext(initialState())).toBeNull();
  });
});
