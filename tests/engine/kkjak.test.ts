import { describe, it, expect } from 'vitest';
import { kkjakRatio, kkjakPerf, optimalThreeCoMode, threeCoModeOptions, optimalThreeCoModeKkjak } from '../../src/engine/theory';
import { hiyukiBaseCtx } from './fixtures';

describe('크크작 대비', () => {
  it('이론최고가 고른 3코 = 속속 (드롭다운 기본값)', () => {
    expect(optimalThreeCoMode(hiyukiBaseCtx())).toBe('soksok');
  });

  // 검증 앵커: 기획서 부록 A.5 worked example은 공공 분모 기준
  // (분모 메인=내 메인=공공). 분모 10524.9, 비율 125.7%.
  it('공공 분모 통합 성능 ≈ 10524.9', () => {
    expect(kkjakPerf(hiyukiBaseCtx(), 'gonggong')).toBeCloseTo(10524.9, -1);
  });

  it('크크작 대비(공공 분모) ≈ 125.7%', () => {
    expect(kkjakRatio(hiyukiBaseCtx(), 'gonggong') * 100).toBeCloseTo(125.7, 0);
  });

  // 새 설계(7.3): 기본 분모는 최적(속속)이라 점수가 더 낮게 나온다(공공 유저 패널티).
  it('속속 분모 점수 < 공공 분모 점수', () => {
    expect(kkjakRatio(hiyukiBaseCtx(), 'soksok')).toBeLessThan(kkjakRatio(hiyukiBaseCtx(), 'gonggong'));
  });
});

import { mainRecommendation } from '../../src/engine/theory';

it('43311 추천: 3코 그룹 최고가 속속', () => {
  const groups = mainRecommendation(hiyukiBaseCtx());
  const threeGroup = groups.find((g) => g.label.startsWith('3코'))!;
  const top = threeGroup.theory.find((r) => r.best)!;
  expect(top.label).toBe('속속');
});

describe('크크작 모드는 코스트 구성에 따라 다르다', () => {
  it('43311은 3코 조합 모드, 44111은 4코 조합 모드', () => {
    const co43 = threeCoModeOptions(hiyukiBaseCtx()).map((o) => o.label);
    expect(co43).toEqual(['속속', '속공', '공공']);
    const co44 = threeCoModeOptions({ ...hiyukiBaseCtx(), costLayout: '44111' }).map((o) => o.label);
    expect(co44).toEqual(['크피+크피', '크피+크리', '크피+공%', '크리+크리', '크리+공%', '공%+공%']);
  });

  it('44111 기본 모드/추천 그룹은 4코 조합', () => {
    const ctx = { ...hiyukiBaseCtx(), costLayout: '44111' as const };
    expect(optimalThreeCoModeKkjak(ctx)!.startsWith('four_')).toBe(true);
    const groups = mainRecommendation(ctx);
    expect(groups.some((g) => g.label === '4코 조합')).toBe(true);
  });
});
