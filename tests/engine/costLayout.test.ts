import { describe, it, expect } from 'vitest';
import { costsOf, isValidCostLayout, normalizeCostLayout } from '../../src/engine/costLayout';

describe('costLayout', () => {
  it('costsOf: 문자열 → 코스트 배열', () => {
    expect(costsOf('43311')).toEqual([4, 3, 3, 1, 1]);
    expect(costsOf('444')).toEqual([4, 4, 4]);
    expect(costsOf('1')).toEqual([1]);
  });

  it('isValidCostLayout: 1~5개·각 4/3/1·합≤12', () => {
    expect(isValidCostLayout('43311')).toBe(true);  // 12
    expect(isValidCostLayout('44111')).toBe(true);  // 11
    expect(isValidCostLayout('41111')).toBe(true);  // 8
    expect(isValidCostLayout('444')).toBe(true);    // 12
    expect(isValidCostLayout('4431')).toBe(true);   // 12
    expect(isValidCostLayout('1')).toBe(true);
    expect(isValidCostLayout('44411')).toBe(false); // 14 > 12
    expect(isValidCostLayout('4444')).toBe(false);  // 16 > 12
    expect(isValidCostLayout('2111')).toBe(false);  // 2 불가
    expect(isValidCostLayout('433111')).toBe(false); // 6개
    expect(isValidCostLayout('')).toBe(false);
  });

  it('normalizeCostLayout: 내림차순 정규형', () => {
    expect(normalizeCostLayout('13431')).toBe('43311');
    expect(normalizeCostLayout('11114')).toBe('41111');
    expect(normalizeCostLayout('43311')).toBe('43311');
  });
});
