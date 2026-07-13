export interface PerfInput {
  baseAttack: number;
  attackPercent: number;  // 소수 합
  flatAttack: number;
  criticalRate: number;   // 캡 전, 소수
  criticalDamage: number; // 1.5 포함
  increaseBonus: number;  // 증가피해보너스 소수 합
  amplify: number;        // 부스트 소수 합
  defResFactor?: number;  // 방무·저무 상대 배수 (기준 0 대비). 미지정 시 1
  skillCoefficient?: number; // 주력 스킬 피해 계수(소수). 미지정 시 1. 상수 곱이라 상대 점수(비율)엔 약분 — HP 계수 캐릭터의 딜 상승 수치 자릿수 정규화용
}

export function computePerf(i: PerfInput): number {
  const atk = i.baseAttack * (1 + i.attackPercent) + i.flatAttack;
  const crit = Math.min(i.criticalRate, 1);
  const critExpectation = 1 + crit * (i.criticalDamage - 1);
  return atk * (1 + i.increaseBonus) * (1 + i.amplify) * critExpectation * (i.defResFactor ?? 1) * (i.skillCoefficient ?? 1);
}
