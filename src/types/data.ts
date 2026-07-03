import type {
  StatKey, Element, BuffElement, WeaponType, ScaleStat, DamageBonusType, EnergyRegenMode, SetPieces, BuffTarget, CostLayout,
} from './domain';

export interface Buff {
  type: StatKey;
  value: number;          // 소수(0.12 = 12%), 깡스탯은 정수
  always: boolean;        // true=상시, false=조건부
  id?: string;            // 조건부 토글 식별자
  label?: string;         // 풀 표기(조건부 표시). {v}는 현재 수치로 치환
  short?: string;         // 간략 표기. JSON에서 직접 관리. 미지정 시 label로 폴백. {v} 치환 지원
  element?: BuffElement;  // 지정 시 캐릭터 element 일치할 때만. '전체'=전체 속성피해(게이트 없이 모든 원소에 적용)
  set_pieces?: SetPieces; // 에코세트 버프 전용 (1|2|3|5)
  target?: BuffTarget;    // 수혜 대상. 미지정 시 self. next_character는 내 계산에서 제외
  min_ascension?: number; // 돌파(공명 체인) 조건. 지정 시 ascensionLevel >= 값일 때만 활성/노출 (예: 히유키 6돌 2스택)
  refinement_values?: number[]; // 무기 버프 전용. 재련(공진) 1~5별 수치 5개. 지정 시 refinement_values[공진-1]로 value 대체
  mode?: string; // 모드 전환 캐릭터 전용. 지정 시 해당 모드 선택 시에만 활성/노출 (예: 루실라 서리/에코)
  damage_bonus_type?: DamageBonusType; // 지정 시 캐릭터(모드)의 피해유형이 이 값과 일치할 때만 활성/노출 (element 게이트와 동일 개념). 예: 「강설」→공명해방 크리 분기
  exclude_damage_bonus_type?: DamageBonusType; // 지정 시 캐릭터(모드)의 피해유형이 이 값이 아닐 때만 활성/노출 (damage_bonus_type의 역). 예: 반주 분기는 공명해방 캐릭터에겐 미노출
  record_only?: boolean; // 특정 스킬 계수/특정 스킬 한정 효과 — 계산 완전 제외 + 패널 숨김(순수 기록용). 예: 에이메스 종결 부스트, 루크 공중공격 보너스
  absolute_score_only?: boolean; // 부스트·방무·저무 등 — 딜 상승 수치엔 반영되나 상대 점수(비율)에선 약분. 계산 포함, 일반 표시
  default_on?: boolean; // 조건부 버프 체크박스 기본 상태(미지정 시 true). 모든 조건부 버프에 명시
  default_on_from_ascension?: number; // 지정 시 해당 돌파 이상일 때만 기본 체크(미만이면 기본 해제, 잠금 아님). default_on보다 우선
  // 공명 효율 초과분 스케일 버프(예: 모니에). 실제 공효로 값 계산: min(per_percent × (공효% − 100), cap). value는 무시.
  energy_scale?: { per_percent: number; cap: number };
  note?: string;
}

/** 모드 전환 캐릭터의 모드(예: 루실라 서리/에코). 모드별 피해유형·유효옵이 다름 */
export interface CharacterMode {
  id: string;
  name: string;
  damage_bonus_type: DamageBonusType;
  effective_substats: StatKey[];
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
  cost_layout: CostLayout; // 에코 코스트 구성 기본값 (예: '43311'). 신규 진입 시 기본 세팅에 사용
  scale_stat: ScaleStat;
  matrix_cost: number; // 매트릭스(파티 편성) 코스트. 현재 전원 1, 신규 기본 1 (향후 매트릭스 파티 구성 기능용)
  base_attack: number;
  base_hp?: number;       // scale_stat이 hp인 캐릭터용 기초 스탯 (attack 스케일이면 불필요)
  base_defense?: number;  // scale_stat이 defense인 캐릭터용 기초 스탯 (예: 모니에)
  effective_substats: StatKey[];
  damage_bonus_type: DamageBonusType | null;
  modes?: CharacterMode[]; // 모드 전환 캐릭터(루실라 등). 지정 시 선택 모드의 damage_bonus_type/effective_substats 사용
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
