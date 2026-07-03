export type ScaleStat = 'attack' | 'hp' | 'defense';

export type Element = '응결' | '용융' | '전도' | '기류' | '회절' | '인멸';

export type WeaponType = 'broad_blade' | 'sword' | 'pistols' | 'gauntlets' | 'rectifier';

export type DamageBonusType =
  | 'basic_attack'
  | 'heavy_attack'
  | 'resonance_skill'
  | 'resonance_liberation'
  | 'echo_skill'; // 에코 어빌리티 피해

export type EnergyRegenMode = 'premise' | 'deal_conversion' | 'buff_conversion';

export type CostLayout = '43311' | '44111';
export type Cost = 1 | 3 | 4;
export type SetPieces = 1 | 2 | 3 | 5;

/** 버프 수혜 대상. 미지정 시 self로 취급 */
export type BuffTarget = 'self' | 'party' | 'next_character';

/** 버프 type / 부옵 키 / 메인 옵션 키의 통합 어휘 */
export type StatKey =
  // 크리
  | 'critical_rate'
  | 'critical_damage'
  // 스케일 %
  | 'attack_percent'
  | 'hp_percent'
  | 'defense_percent'
  // 깡스탯
  | 'flat_attack'
  | 'flat_hp'
  | 'flat_defense'
  // 기타
  | 'energy_regen'
  | 'healing_bonus'
  // 증가(합연산)
  | 'element_damage_bonus'
  | 'basic_attack_bonus'
  | 'heavy_attack_bonus'
  | 'resonance_skill_bonus'
  | 'resonance_liberation_bonus'
  | 'echo_skill_bonus'
  // 부스트(곱연산)
  | 'element_damage_amplify'
  | 'all_damage_amplify'
  | 'basic_attack_amplify'
  | 'heavy_attack_amplify'
  | 'resonance_skill_amplify'
  | 'resonance_liberation_amplify'
  | 'echo_skill_amplify'
  // 이상효과(서리/불꽃/풍식 등) 받는 피해 부스트. element로 어느 이상효과인지 지정.
  // 근사 트랙 점수엔 미반영(이상효과는 별도 스케일) — 파티 제공 버프 기록/향후 파티 기능용
  | 'anomaly_damage_amplify'
  // 이상효과 추가타(받는 피해 부스트가 아니라 이상효과 피해를 1회 더 입힘). value=이상효과 배율(예: 1.02). 점수 미반영
  | 'anomaly_damage_additional'
  // 조화도 관련 통합 타입(조화도 파괴 증폭 pt, 조화 밀집·간섭 대응 최종피해 등). 근사 점수 미반영(record_only 전제) — 기록·파티 조합용
  | 'harmony'
  // 피해유형 보너스(증가) 합계에 곱하는 배수형 버프. value 0.40 → 캐릭터 피해유형 보너스 ×1.4
  // (예: 레베카 6돌 "모든 출처 일반공격 피해 보너스 +40% 상승")
  | 'damage_type_bonus_factor'
  // 특정 스킬의 피해 배율(모션 밸류) 자체를 변경. 특정 스킬 한정이므로 근사 점수 미반영(record_only 전제).
  // (예: 에이메스 종결 피해 +25%, 루크 6돌 특정 3스킬 받는 피해 +30%)
  | 'skill_motion_value_bonus'
  | 'skill_motion_value_amplify'
  // 저항/방어 항 (근사 트랙 무영향)
  | 'defense_ignore'
  | 'element_resistance_ignore'; // 속성 저항 무시 (element 필드로 어느 속성인지 지정)

export const STAT_KEYS: readonly StatKey[] = [
  'critical_rate', 'critical_damage', 'attack_percent', 'hp_percent', 'defense_percent',
  'flat_attack', 'flat_hp', 'flat_defense', 'energy_regen', 'healing_bonus',
  'element_damage_bonus', 'basic_attack_bonus', 'heavy_attack_bonus',
  'resonance_skill_bonus', 'resonance_liberation_bonus', 'echo_skill_bonus',
  'element_damage_amplify', 'all_damage_amplify', 'basic_attack_amplify',
  'heavy_attack_amplify', 'resonance_skill_amplify', 'resonance_liberation_amplify', 'echo_skill_amplify',
  'anomaly_damage_amplify', 'anomaly_damage_additional', 'harmony',
  'damage_type_bonus_factor',
  'skill_motion_value_bonus', 'skill_motion_value_amplify',
  'defense_ignore', 'element_resistance_ignore',
];

export const ELEMENTS: readonly Element[] = ['응결', '용융', '전도', '기류', '회절', '인멸'];

export const WEAPON_TYPES: readonly WeaponType[] = ['broad_blade', 'sword', 'pistols', 'gauntlets', 'rectifier'];

export const BUFF_TARGETS: readonly BuffTarget[] = ['self', 'party', 'next_character'];
