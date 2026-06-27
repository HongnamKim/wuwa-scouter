export interface PerfInput {
  baseAttack: number;
  attackPercent: number;  // 소수 합
  flatAttack: number;
  criticalRate: number;   // 캡 전, 소수
  criticalDamage: number; // 1.5 포함
  increaseBonus: number;  // 증가피해보너스 소수 합
  amplify: number;        // 부스트 소수 합
}

export function computePerf(i: PerfInput): number {
  const atk = i.baseAttack * (1 + i.attackPercent) + i.flatAttack;
  const crit = Math.min(i.criticalRate, 1);
  const critExpectation = 1 + crit * (i.criticalDamage - 1);
  return atk * (1 + i.increaseBonus) * (1 + i.amplify) * critExpectation;
}
