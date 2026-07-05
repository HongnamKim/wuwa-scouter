import { describe, it, expect } from 'vitest';
import { theoryRatio, theoryBest, mainRecommendation, optimalThreeCoMode, threeCoModeOptions } from '../../src/engine/theory';
import { COST_LAYOUTS } from '../../src/engine/constants';
import { slotsFrom } from '../../src/engine/echoSlots';
import { hiyukiBaseCtx } from './fixtures';

describe('theoryBest', () => {
  it('이론 최고 대비 ≈ 59.9%', () => {
    expect(theoryRatio(hiyukiBaseCtx()) * 100).toBeCloseTo(59.9, 0);
  });
});

describe('43111 코스트 구성', () => {
  const ctx43111 = () => {
    const c = { ...hiyukiBaseCtx(), costLayout: '43111' as const };
    return { ...c, slots: slotsFrom('43111', [], []) };
  };

  it('레이아웃 = [4,3,1,1,1]', () => {
    expect(COST_LAYOUTS['43111']).toEqual([4, 3, 1, 1, 1]);
  });

  it('크크작 모드 존재(속·공, 비전환형은 공효 숨김) + 추천/최적모드 크래시 없이 동작', () => {
    const ctx = ctx43111();
    const modes = threeCoModeOptions(ctx).map((m) => m.value);
    expect(modes).toContain('sok111');
    expect(modes).toContain('gong111');
    expect(modes).not.toContain('er111'); // 비전환형은 공효 모드 숨김
    expect(optimalThreeCoMode(ctx)).toMatch(/111$/);
    expect(mainRecommendation(ctx).map((g) => g.label)).toEqual(['4코 메인', '3코 조합']);
    expect(theoryBest(ctx).perf).toBeGreaterThan(0);
  });
});
