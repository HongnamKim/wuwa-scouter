import { describe, it, expect } from 'vitest';
import { theoryRatio, theoryBest, mainRecommendation, optimalThreeCoMode, threeCoModeOptions, hasNamedModes, kkjakReferencePerf } from '../../src/engine/theory';
import { costsOf } from '../../src/engine/costLayout';
import { slotsFrom } from '../../src/engine/echoSlots';
import { hiyukiBaseCtx } from './fixtures';

describe('theoryBest', () => {
  it('이론 최고 대비 ≈ 59.9%', () => {
    expect(theoryRatio(hiyukiBaseCtx()) * 100).toBeCloseTo(59.9, 0);
  });
});

describe('일반형 레이아웃(직접 입력)', () => {
  const ctxWith = (layout: string) => {
    const c = { ...hiyukiBaseCtx(), costLayout: layout };
    return { ...c, slots: slotsFrom(layout, [], []) };
  };

  it('43111·41111·444는 명명 모드 없음(일반형)', () => {
    for (const layout of ['43111', '41111', '444']) {
      const ctx = ctxWith(layout);
      expect(hasNamedModes(ctx)).toBe(false);
      expect(threeCoModeOptions(ctx)).toEqual([]);
      expect(optimalThreeCoMode(ctx)).toBeNull();
    }
  });

  it('43311·44111만 명명 모드 유지', () => {
    expect(hasNamedModes(ctxWith('43311'))).toBe(true);
    expect(hasNamedModes(ctxWith('44111'))).toBe(true);
  });

  it('일반형 추천은 단일 "메인 조합" 그룹 상위 3, 크래시 없음', () => {
    for (const layout of ['43111', '41111', '444', '4431']) {
      const ctx = ctxWith(layout);
      const groups = mainRecommendation(ctx);
      expect(groups.map((g) => g.label)).toEqual(['메인 조합']);
      expect(groups[0].theory.length).toBeLessThanOrEqual(3);
      expect(theoryBest(ctx).perf).toBeGreaterThan(0);
      expect(kkjakReferencePerf(ctx)).toBeGreaterThan(0);
    }
  });

  it('가변 슬롯: 444(3에코)는 슬롯 3개', () => {
    expect(costsOf('444')).toEqual([4, 4, 4]);
    expect(theoryBest(ctxWith('444')).mainPicks.length).toBe(3);
  });
});
