import { describe, it, expect } from 'vitest';
import { theoryRatio } from '../../src/engine/theory';
import { hiyukiBaseCtx } from './fixtures';

describe('theoryBest', () => {
  it('이론 최고 대비 ≈ 59.9%', () => {
    expect(theoryRatio(hiyukiBaseCtx()) * 100).toBeCloseTo(59.9, 0);
  });
});
