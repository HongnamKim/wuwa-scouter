import type {
  StatKey, Element, ScaleStat, DamageBonusType, EnergyRegenMode, SetPieces, BuffTarget,
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
  scale_stat: ScaleStat;
  base_attack: number;
  effective_substats: StatKey[];
  damage_bonus_type: DamageBonusType | null;
  energy_regen_mode: EnergyRegenMode;
  recommended_echo_sets: string[];
  recommended_weapons: string[];
  signature_weapon: string | null; // 전용 무기 id (없으면 null)
  skill_node: Buff[];
}

export interface Weapon {
  id: string;
  name: string;
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
