import type {
  StatKey, Element, WeaponType, ScaleStat, DamageBonusType, EnergyRegenMode, SetPieces, BuffTarget,
} from './domain';

export interface Buff {
  type: StatKey;
  value: number;          // 소수(0.12 = 12%), 깡스탯은 정수
  always: boolean;        // true=상시, false=조건부
  id?: string;            // 조건부 토글 식별자
  label?: string;         // 조건부 표시
  element?: Element;      // 지정 시 캐릭터 element 일치할 때만
  set_pieces?: SetPieces; // 에코세트 버프 전용 (1|2|3|5)
  target?: BuffTarget;    // 수혜 대상. 미지정 시 self. next_character는 내 계산에서 제외
  min_ascension?: number; // 돌파(공명 체인) 조건. 지정 시 ascensionLevel >= 값일 때만 활성/노출 (예: 히유키 6돌 2스택)
  refinement_values?: number[]; // 무기 버프 전용. 재련(공진) 1~5별 수치 5개. 지정 시 refinement_values[공진-1]로 value 대체
  note?: string;
}

export interface MainSlotEcho {
  id: string;
  name: string;
  buffs: Buff[];
}

export interface Character {
  id: string;
  name: string;
  version: number; // 출시 버전 (예: 히유키 = 3)
  element: Element;
  weapon_type: WeaponType; // 착용 무기 타입
  scale_stat: ScaleStat;
  base_attack: number;
  effective_substats: StatKey[];
  damage_bonus_type: DamageBonusType | null;
  energy_regen_mode: EnergyRegenMode;
  default_required_energy_regen: number; // 필요 공효 기본값(%)
  special_mechanism: string | null; // 특별 메커니즘 키 (mechanisms 레지스트리 참조). 일반 캐릭터는 null
  recommended_echo_sets: string[];
  recommended_main_echo: string[];
  recommended_weapons: string[];
  signature_weapon: string | null; // 전용 무기 id (없으면 null)
  skill_node: Buff[];
}

/** 자유 2세트 효과 풀 항목 (1+2+2, 3+2 빌드에서 슬롯별로 선택) */
export interface TwoPieceEffect {
  id: string;
  label: string;                    // 표시명. element_from_character면 캐릭터 원소로 치환
  type: StatKey;
  value: number;                    // 소수 (0.10 = 10%)
  element_from_character?: boolean; // true면 캐릭터 element로 적용/표시(원소피해)
}

export interface Weapon {
  id: string;
  name: string;
  weapon_type: WeaponType;
  base_stats: { attack: number } & Partial<Record<StatKey, number>>;
  buffs: Buff[];
}

export interface EchoSet {
  id: string;
  name: string;
  buffs: Buff[];
  /** 이 세트에 속한, 메인 슬롯에 장착 가능한 에코들 (장착 시 자체 패시브 제공) */
  main_slot_echoes: MainSlotEcho[];
}
