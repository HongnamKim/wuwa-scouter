export type ScaleStat = 'attack' | 'hp' | 'defense';

export type Element = '응결' | '용융' | '전도' | '기류' | '회절' | '인멸';

export type WeaponType = 'broad_blade' | 'sword' | 'pistols' | 'gauntlets' | 'rectifier';

export type DamageBonusType =
  | 'basic_attack'
  | 'heavy_attack'
  | 'resonance_skill'
  | 'resonance_liberation'
  | 'echo_skill'; // 에코 어빌리티 피해

export type EnergyRegenMode = 'premise' | 'deal_conversion';

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
  'defense_ignore', 'element_resistance_ignore',
];

export const ELEMENTS: readonly Element[] = ['응결', '용융', '전도', '기류', '회절', '인멸'];

export const WEAPON_TYPES: readonly WeaponType[] = ['broad_blade', 'sword', 'pistols', 'gauntlets', 'rectifier'];

export const BUFF_TARGETS: readonly BuffTarget[] = ['self', 'party', 'next_character'];
