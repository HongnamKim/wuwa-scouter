import type { Buff, Character, EchoSet, MainSlotEcho, Weapon } from '../types/data';
import type { BuffTarget, StatKey } from '../types/domain';
import type { weapons } from './weapons';
import type { echoSets } from './echo-sets';

export type WeaponId = keyof typeof weapons;
export type EchoSetId = keyof typeof echoSets;
type Ascension = 0 | 1 | 2 | 3 | 4 | 5 | 6;
type MotionValueType = 'skill_motion_value_bonus' | 'skill_motion_value_amplify';

type ScorePolicy =
  | { record_only: true; absolute_score_only: false }
  | { record_only: false; absolute_score_only: boolean };

type TargetData =
  | { target: 'specific_character'; target_character: string }
  | { target?: Exclude<BuffTarget, 'specific_character'>; target_character?: never };

/** 저장 데이터의 작성 계약. 계산 중 생성하는 Buff보다 필수 메타데이터를 엄격하게 검사한다. */
export type BuffData = Omit<Buff,
  'type' | 'record_only' | 'absolute_score_only' | 'target' | 'target_character'
  | 'min_ascension' | 'default_on_from_ascension' | 'refinement_values'
> & TargetData & {
  min_ascension?: Ascension;
  default_on_from_ascension?: Ascension;
  refinement_values?: [number, number, number, number, number];
} & (
  | { type: MotionValueType; record_only: true; absolute_score_only: false }
  | ({ type: Exclude<StatKey, MotionValueType> } & ScorePolicy)
);

export type SkillNodeData = BuffData & {
  target: BuffTarget;
  min_ascension: Ascension;
};

export type CharacterData = Omit<Character,
  'skill_node' | 'recommended_weapons' | 'signature_weapon' | 'recommended_echo_sets'
> & {
  skill_node: SkillNodeData[];
  recommended_weapons: WeaponId[];
  signature_weapon: WeaponId | null;
  recommended_echo_sets: EchoSetId[];
};

export type WeaponData = Omit<Weapon, 'buffs'> & { buffs: BuffData[] };
export type MainSlotEchoData = Omit<MainSlotEcho, 'buffs'> & { buffs: BuffData[] };
export type EchoSetData = Omit<EchoSet, 'buffs' | 'main_slot_echoes'> & {
  buffs: BuffData[];
  main_slot_echoes: MainSlotEchoData[];
};
