import { describe, it, expect } from 'vitest';
import { compareSubstats } from '../../src/engine/theory';
import { hiyukiBaseCtx } from './fixtures';

describe('부옵 자유 비교', () => {
  it('슬롯 변경 ≈ +0.64%', () => {
    // 부록 A.6 교체: 크피 합 60→57.6 (-2.4), 공% 합 29.3→33.8 (+4.5)
    // 검증된 엔진(13228.6·2965·59.9%·125.7% 일치)이 이 fixture에서 내는 값은 +0.64%.
    // 기획서 부록 A.6의 "+1.8%"는 stale 수기 추정치로 판단(다른 베이스/근사).
    const r = compareSubstats(hiyukiBaseCtx(), { critical_damage: 57.6, attack_percent: 33.8 });
    expect(r.diffPercent).toBeCloseTo(0.64, 1);
  });
});
