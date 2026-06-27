import { describe, it, expect } from 'vitest';
import { initialState } from '../../src/state/store';
import { computePerf } from '../../src/engine/perf';
import { buildPerfInput } from '../../src/engine/build';

describe('initialState', () => {
  it('히유키 기본 상태 로드', () => {
    const s = initialState();
    expect(s.character.id).toBe('hiyuki');
    expect(s.weapon.id).toBe('frostbound_flame');
    expect(s.costLayout).toBe('43311');
    expect(s.substats).toHaveLength(5);
  });

  it('기본 상태(무기 부스트 ON)는 양수 통합 성능', () => {
    const s = initialState();
    expect(computePerf(buildPerfInput(s))).toBeGreaterThan(0);
  });
});
