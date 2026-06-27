import { describe, it, expect } from 'vitest';
import { computePerf, PerfInput } from '../../src/engine/perf';

// 부록 A 히유키 (5세트 ON, 무기 부스트 OFF)
const HIYUKI: PerfInput = {
  baseAttack: 1049,        // 462 + 587
  attackPercent: 0.24 + 0.293 + 0.96, // 노드+무기 0.24 / 부옵 0.293 / 메인 0.96
  flatAttack: 350,         // secondary 4코150 + 3코100x2
  criticalRate: 0.98,      // 0.05+0.243+0.08+0.25+0.357
  criticalDamage: 2.54,    // 1.50 + 부옵0.60 + 메인0.44
  increaseBonus: 0.778,    // 응결0.32 + 해방(0.12+0.338)
  amplify: 0,
};

describe('computePerf', () => {
  it('히유키 통합 성능 ≈ 13228.6', () => {
    expect(computePerf(HIYUKI)).toBeCloseTo(13228.6, 0);
  });

  it('ATK 항 ≈ 2965', () => {
    const atk = 1049 * (1 + HIYUKI.attackPercent) + 350;
    expect(atk).toBeCloseTo(2965, 0);
  });

  it('무기 부스트 28% → ×1.28', () => {
    const boosted = computePerf({ ...HIYUKI, amplify: 0.28 });
    expect(boosted / computePerf(HIYUKI)).toBeCloseTo(1.28, 5);
  });

  it('크리율 100% 캡', () => {
    const a = computePerf({ ...HIYUKI, criticalRate: 1.2 });
    const b = computePerf({ ...HIYUKI, criticalRate: 1.0 });
    expect(a).toBe(b);
  });
});
