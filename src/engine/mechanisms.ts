/**
 * 특별 메커니즘 레지스트리 (DB 테이블 분리 방식).
 * 캐릭터의 special_mechanism 키로 참조한다. 일반 캐릭터는 null → 적용 없음.
 *
 * ⚠️ 용도 한정(중요): 여기는 시그리카처럼 "특정 스탯을 다른 스탯으로 변환"하는
 * 비표준 케이스만 다룬다(예: 공명효율 → 에코 피해유형 보너스).
 * 단순 곱연산 버프(부스트, 피해유형 보너스 ×N 등)는 특별 메커니즘이 아니다.
 * → 그런 것은 일반 버프 파이프라인(types StatKey + buffs.ts 집계 + build.ts 적용)에서 처리한다.
 *   예: 레베카 CHAIN.6 "일반공격 피해 보너스 +40% 상승" = damage_type_bonus_factor 버프(곱연산).
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

/** special_mechanism 키 + 공명효율로 추가 피해유형 보너스(소수)를 계산. 키 없으면 0. (deal_conversion) */
export function mechanismDamageTypeBonus(key: string | null, energyRegen: number): number {
  if (!key) return 0;
  const m = SPECIAL_MECHANISMS[key];
  return m?.damageTypeBonusFromEnergyRegen?.(energyRegen) ?? 0;
}

/** 공효 스케일 버프 파라미터. buff_conversion 캐릭터(모니에 등)의 버프가 공효로 값이 변함.
 *  base: 스케일 기준선(%) — 이 값 초과분에만 비례. 미지정 시 100(모니에: 100% 초과분).
 *  수안인처럼 공효 총량 비례(0부터)면 base:0. */
export interface EnergyScale { per_percent: number; cap: number; base?: number; }

/**
 * buff_conversion: 공명효율(소수, 1.0=100%)의 base 초과분으로 버프값을 계산.
 * 값 = min(per_percent × (공효% − base), cap). 예: 모니에 간섭표기 0.25%/1%, base 100, cap 40% → 공효 260%에서 0.40.
 * 수안인 심층 0.05%/1%, base 0, cap 12.5% → 공효 250%에서 0.125.
 * deal_conversion(공효→자기 딜)과 대응되는 buff_conversion(공효→버프값)의 변환 함수.
 */
export function energyScaleValue(s: EnergyScale, energyRegen: number): number {
  return Math.min(s.per_percent * Math.max(0, energyRegen * 100 - (s.base ?? 100)), s.cap);
}

export interface CritScale { per_percent: number; threshold: number; cap: number; }

/**
 * 크리티컬 확률(소수) 초과분(threshold% 기준)으로 크리 피해 버프값을 계산.
 * 값 = min(per_percent × (크리% − threshold), cap). 예: 구원 공명해방 0.02/1%, threshold 50, cap 0.30 → 크리 65%에서 0.30.
 */
export function critScaleValue(s: CritScale, criticalRate: number): number {
  return Math.min(s.per_percent * Math.max(0, criticalRate * 100 - s.threshold), s.cap);
}

/** 공명효율을 다른 스탯으로 전환하는 캐릭터인지 (예: 시그리카) */
export function hasEnergyConversion(key: string | null): boolean {
  return !!(key && SPECIAL_MECHANISMS[key]?.damageTypeBonusFromEnergyRegen);
}
