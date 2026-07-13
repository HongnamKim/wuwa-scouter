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
  element?: BuffElement;  // 지정 시 캐릭터 element 일치할 때만. '전체'=전체 속성피해(게이트 없이 모든 원소에 적용). 파티 제공 시 수혜자 원소로 재검사됨(예: 인멸 방무=인멸 딜러용)
  provider_element?: BuffElement; // 착용자(제공자) 원소 게이트. element와 달리 파티 제공 시 수혜자 원소는 무관(브랜치 선택·제공자 조건용, 예: 깃털 5세트 응결분기=착용자만 응결이면 파티 전체 공격력↑)
  set_pieces?: SetPieces; // 에코세트 버프 전용 (1|2|3|5)
  target?: BuffTarget;    // 수혜 대상. 미지정 시 self. next_character는 내 계산에서 제외
  target_character?: string; // target이 'specific_character'일 때 수혜 캐릭터 id. 그 캐릭터를 볼 때만 표시·활성
  only_character?: string; // 지정 시 착용 캐릭터가 이 id일 때만 표시·활성(예: 푸른 의지 파죽 2스택=구원만). 그 외 캐릭터엔 미노출·미적용
  min_ascension?: number; // 돌파(공명 체인) 조건. 지정 시 ascensionLevel >= 값일 때만 활성/노출 (예: 히유키 6돌 2스택)
  refinement_values?: number[]; // 무기 버프 전용. 재련(공진) 1~5별 수치 5개. 지정 시 refinement_values[공진-1]로 value 대체
  mode?: string; // 모드 전환 캐릭터 전용. 지정 시 해당 모드 선택 시에만 활성/노출 (예: 루실라 서리/에코)
  damage_bonus_type?: DamageBonusType; // 지정 시 캐릭터(모드)의 피해유형이 이 값과 일치할 때만 활성/노출 (element 게이트와 동일 개념). 예: 「강설」→공명해방 크리 분기
  exclude_damage_bonus_type?: DamageBonusType; // 지정 시 캐릭터(모드)의 피해유형이 이 값이 아닐 때만 활성/노출 (damage_bonus_type의 역). 예: 반주 분기는 공명해방 캐릭터에겐 미노출
  record_only?: boolean; // 특정 스킬 계수/특정 스킬 한정 효과 — 계산 완전 제외 + 패널 숨김(순수 기록용). 예: 에이메스 종결 부스트, 루크 공중공격 보너스
  absolute_score_only?: boolean; // 부스트·방무·저무 등 — 딜 상승 수치엔 반영되나 상대 점수(비율)에선 약분. 계산 포함, 일반 표시
  default_on?: boolean; // 조건부 버프 체크박스 기본 상태(미지정 시 true). 모든 조건부 버프에 명시
  default_on_from_ascension?: number; // 지정 시 해당 돌파 이상일 때만 기본 체크(미만이면 기본 해제, 잠금 아님). default_on보다 우선
  // 공명 효율 스케일 버프(예: 모니에·수안인). 실제 공효로 값 계산: min(per_percent × (공효% − base), cap). value는 무시.
  // base 미지정 시 100(초과분). 수안인처럼 총량 비례면 base:0.
  energy_scale?: { per_percent: number; cap: number; base?: number };
  // 크리티컬 확률 초과분 스케일 버프(예: 구원 공명해방). 실제 크리율로 값 계산: min(per_percent × (크리% − threshold), cap). value는 무시.
  crit_scale?: { per_percent: number; threshold: number; cap: number };
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
  cost?: 3 | 4; // 이 에코의 장착 코스트. 미지정 시 4. 코스트 구성에 이 코스트가 없으면(예: 33111에 4코 에코) 장착 불가 → 드롭다운 제외·자동 해제
  buffs: Buff[];
  unreleased?: boolean; // true면 미공개(공식 정보 전) — 선택 드롭다운에서 제외. 데이터는 저장, 플래그 제거 시 노출
}

export interface Character {
  id: string;
  name: string;
  version: number; // 출시 버전 (예: 히유키 = 3.3)
  version_phase?: '전반' | '후반'; // 해당 버전(패치)의 전반/후반. 정렬: 버전 → 전반/후반 → 이름
  release_at?: string; // 출시 일시(ISO, KST 포함 권장 예 "2026-07-11T11:00:00+09:00"). 이 시각 전이면 잠금(목록엔 보이나 접근·선택 불가). 미지정=이미 출시
  unreleased?: boolean; // true면 미출시(잠금). release_at처럼 목록엔 보이나 접근·선택·파티편성 불가. 출시일 미정일 때 release_at 대신 사용
  notice?: string; // 주의 문구(비공식/유출 정보 등). 지정 시 분석 화면 상단 배너 + 목록 카드에 ⚠ 표시. 잠금과 무관(접근은 가능)
  element: Element;
  weapon_type: WeaponType; // 착용 무기 타입
  cost_layout: CostLayout; // 에코 코스트 구성 기본값 (예: '43311'). 신규 진입 시 기본 세팅에 사용
  scale_stat: ScaleStat;
  skill_damage_coefficient?: number; // 주력 스킬 피해 계수(소수, 예: 수수 0.2863 = 변주·공명 스킬 28.63%HP). 딜 상승 수치에 곱함 — 상수라 상대 점수엔 약분. HP/방어 계수 캐릭터의 딜 자릿수 정규화용. 미지정 시 1
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
  unreleased?: boolean; // true면 미공개(공식 정보 전) — 선택 드롭다운에서 제외. 데이터는 저장, 플래그 제거 시 노출
}

export interface EchoSet {
  id: string;
  name: string;
  buffs: Buff[];
  /** 이 세트에 속한, 메인 슬롯에 장착 가능한 에코들 (장착 시 자체 패시브 제공) */
  main_slot_echoes: MainSlotEcho[];
}
