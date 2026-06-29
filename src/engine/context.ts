import type { Character, Weapon, EchoSet, MainSlotEcho } from '../types/data';
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

export interface CalcContext {
  character: Character;
  weapon: Weapon;
  mainEcho: MainSlotEcho;
  echoSets: EchoSet[]; // 동시에 여러 세트 착용 가능(최대 3)
  costLayout: CostLayout;
  mainPrimary: MainPrimaryPick[]; // 슬롯 순서대로
  twoPiecePicks?: string[];       // 자유 2세트 효과 선택(풀 id). 길이 = 선택 세트에서 파생된 자유 슬롯 수. 0이면 빈 배열/미지정
  substats: SubstatLine[][];      // 5 에코 × 5 줄
  conditionalToggles: Record<string, boolean>;
  manualBuffs: ManualBuff[];
  requiredEnergyRegen?: number; // 필요 공효(%). 이론 최고에서 도달 최소 줄 수만큼 딜 슬롯 차감(전제형). 미지정 시 30
  ascensionLevel?: number; // 돌파(공명 체인) 0~6. 일부 캐릭터의 스택형 자체 버프에 영향. 미지정 시 0
  refinementLevel?: number; // 무기 재련(공진) 1~5. 무기 버프량에 영향. 미지정 시 1
}
