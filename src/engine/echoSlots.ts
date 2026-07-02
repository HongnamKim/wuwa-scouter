import type { EchoSet } from '../types/data';
import type { Cost, CostLayout, StatKey } from '../types/domain';
import type { EchoSlot, MainPrimaryPick, SubstatLine } from './context';
import { COST_LAYOUTS, MAIN_PRIMARY } from './constants';

const DEAL_KEYS: StatKey[] = ['attack_percent', 'element_damage_bonus', 'critical_rate', 'critical_damage', 'energy_regen'];

/** 코스트별 기본 메인 (4코=크피, 그 외=공%; 없으면 첫 딜키) */
export function defaultMainForCost(cost: Cost): StatKey {
  const opts = (Object.keys(MAIN_PRIMARY[cost]) as StatKey[]).filter((k) => DEAL_KEYS.includes(k));
  const def: StatKey = cost === 4 ? 'critical_damage' : 'attack_percent';
  return opts.includes(def) ? def : opts[0];
}

/** 기본 슬롯 5개: 코스트 미배정(null)으로 시작 — 사용자가 남은 코스트에서 직접 배정한다.
 *  (미리 배정하면 멀티셋이 전부 소진돼 코스트를 바꿀 수 없으므로 비워둔다) */
export function defaultSlots(_layout: CostLayout): EchoSlot[] {
  return Array.from({ length: 5 }, () => ({
    cost: null,
    main: '' as const,
    substats: Array.from({ length: 5 }, () => ({ type: '' as const, value: null })),
  }));
}

/** 구 상태(mainPrimary+substats) → slots 1:1 변환 (저장 마이그레이션·테스트·theory 공용).
 *  주의: mainPrimary가 빈 배열이면 각 슬롯 메인은 defaultMainForCost(기본값)로 채워진다(0 기여가 아님). */
export function slotsFrom(layout: CostLayout, mainPrimary: MainPrimaryPick[], substats: SubstatLine[][]): EchoSlot[] {
  return COST_LAYOUTS[layout].map((cost, i) => ({
    cost,
    main: mainPrimary[i]?.type ?? defaultMainForCost(cost),
    substats: substats[i] ?? Array.from({ length: 5 }, () => ({ type: '' as const, value: null })),
  }));
}

/** 슬롯 i의 선택 가능한 코스트: 레이아웃 멀티셋 − 다른 슬롯이 이미 쓴 것 (자기 코스트 포함) */
export function availableCostsForSlot(layout: CostLayout, slots: EchoSlot[], slotIndex: number): Cost[] {
  const pool = [...COST_LAYOUTS[layout]];
  slots.forEach((s, i) => {
    if (i === slotIndex || s.cost == null) return;
    const idx = pool.indexOf(s.cost);
    if (idx >= 0) pool.splice(idx, 1);
  });
  return [...new Set(pool)].sort((a, b) => b - a) as Cost[];
}

/** 세트 버프 중 가장 큰 set_pieces (정보 없으면 5=풀세트로 간주 → 자유 슬롯 0) */
export function maxSetPieces(set: EchoSet | undefined): number {
  if (!set) return 5;
  const max = Math.max(0, ...set.buffs.map((b) => b.set_pieces ?? 0));
  return max > 0 ? max : 5;
}

/**
 * 선택한 주(첫) 화음 세트의 최대 set_pieces로 자유 2세트 효과 슬롯 수를 결정.
 * 남은 에코(5 − maxPieces)를 2개씩 묶음: floor((5 − maxPieces) / 2).
 * 예) 악몽 1pc → 2슬롯(1+2+2), 왕관 3pc → 1슬롯(3+2), 일반 5pc → 0슬롯.
 */
export function freeTwoPieceSlots(echoSets: EchoSet[]): number {
  return Math.max(0, Math.floor((5 - maxSetPieces(echoSets[0])) / 2));
}
