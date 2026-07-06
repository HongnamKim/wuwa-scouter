import type { Cost } from '../types/domain';

/** 레이아웃 문자열 → 코스트 배열. 예: '43311' → [4,3,3,1,1] */
export function costsOf(layout: string): Cost[] {
  return layout.split('').map((ch) => Number(ch) as Cost);
}

/** 유효한 코스트 구성인지: 1~5개, 각 ∈ {4,3,1}, 합 ≤ 12 */
export function isValidCostLayout(s: string): boolean {
  if (!/^[431]{1,5}$/.test(s)) return false;
  return costsOf(s).reduce((a, b) => a + b, 0) <= 12;
}

/** 유효 입력을 내림차순 정규형으로. 예: '13431' → '43311'. 4/3/1 외 문자가 있으면 원본 반환. */
export function normalizeCostLayout(s: string): string {
  if (!/^[431]+$/.test(s)) return s;
  return s.split('').sort((a, b) => Number(b) - Number(a)).join('');
}
