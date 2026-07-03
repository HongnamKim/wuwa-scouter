import type { Character, Weapon, EchoSet, MainSlotEcho, Buff } from '../types/data';
import type { StatKey, Cost, CostLayout } from '../types/domain';

export interface SubstatLine {
  type: StatKey | '';
  value: number | null; // % 단위 (예: 8.6) / 깡스탯은 정수
}

export interface ManualBuff {
  type: StatKey | '';
  value: number | null; // % 단위 입력값
  enabled?: boolean;     // 체크박스 on/off. 미지정 시 on
}

export interface MainPrimaryPick {
  cost: Cost;
  type: StatKey; // 그 슬롯에서 고른 메인 옵션
}

/** 편성한 파티원. 그 캐릭터가 제공하는 party/next_character 버프를 개별로 토글. */
export interface PartyMember {
  id: string;          // 파티원 캐릭터 id
  disabled?: string[]; // 끈(미적용) 제공 버프 키 목록. 기본 전부 적용(빈 배열)
}

export interface EchoSlot {
  cost: Cost | null;       // 1 | 3 | 4, 미배정 시 null (사용자가 남은 코스트에서 직접 선택)
  main: StatKey | '';      // 그 슬롯 메인 옵션 (cost에 따라 유효 선택지 제한). cost 미배정 시 ''
  substats: SubstatLine[]; // 5줄
}

export interface CalcContext {
  character: Character;
  weapon: Weapon;
  mainEcho: MainSlotEcho;
  echoSets: EchoSet[]; // 동시에 여러 세트 착용 가능(최대 3)
  costLayout: CostLayout;
  slots: EchoSlot[]; // 길이 5, 코스트 멀티셋 = COST_LAYOUTS[costLayout]
  twoPiecePicks?: string[];       // 자유 2세트 효과 선택(풀 id). 길이 = 선택 세트에서 파생된 자유 슬롯 수. 0이면 빈 배열/미지정
  conditionalToggles: Record<string, boolean>;
  manualBuffs: ManualBuff[];
  requiredEnergyRegen?: number; // 필요 공효(%). 이론 최고에서 도달 최소 줄 수만큼 딜 슬롯 차감(전제형). 미지정 시 30
  ascensionLevel?: number; // 돌파(공명 체인) 0~6. 일부 캐릭터의 스택형 자체 버프에 영향. 미지정 시 0
  refinementLevel?: number; // 무기 재련(공진) 1~5. 무기 버프량에 영향. 미지정 시 1
  selectedMode?: string; // 모드 전환 캐릭터의 선택 모드 id. 미지정 시 character.modes[0]
  partyMembers?: PartyMember[]; // 편성한 파티원(최대 2). UI/저장용
  partyProvidedBuffs?: Buff[];  // partyMembers를 내 저장 빌드로 해석한 버프(store가 주입). aggregateBuffs가 합산
}
