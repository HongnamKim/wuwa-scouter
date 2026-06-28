/**
 * 특별 메커니즘 레지스트리 (DB 테이블 분리 방식).
 * 캐릭터의 special_mechanism 키로 참조한다. 일반 캐릭터는 null → 적용 없음.
 * 시그리카처럼 특정 캐릭터에게만 있는 비표준 변환/스케일링을 여기에 모아 관리한다.
 */
export interface SpecialMechanism {
  /** 공명효율(소수, 1.5 = 150%)을 받아 피해유형(에코) 보너스(소수)를 반환 */
  damageTypeBonusFromEnergyRegen?: (energyRegen: number) => number;
}

export const SPECIAL_MECHANISMS: Record<string, SpecialMechanism> = {
  // 시그리카: 공명효율 125% 초과분 1%당 에코 어빌리티 피해보너스 +2%, 최대 +50% (150% → +50%)
  sigrika_er_to_echo: {
    damageTypeBonusFromEnergyRegen: (er) => Math.min(0.50, Math.max(0, er - 1.25) * 2),
  },
};

export const MECHANISM_KEYS = Object.keys(SPECIAL_MECHANISMS);

/** special_mechanism 키 + 공명효율로 추가 피해유형 보너스(소수)를 계산. 키 없으면 0. */
export function mechanismDamageTypeBonus(key: string | null, energyRegen: number): number {
  if (!key) return 0;
  const m = SPECIAL_MECHANISMS[key];
  return m?.damageTypeBonusFromEnergyRegen?.(energyRegen) ?? 0;
}

/** 공명효율을 다른 스탯으로 전환하는 캐릭터인지 (예: 시그리카) */
export function hasEnergyConversion(key: string | null): boolean {
  return !!(key && SPECIAL_MECHANISMS[key]?.damageTypeBonusFromEnergyRegen);
}
