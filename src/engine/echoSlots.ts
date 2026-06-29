import type { EchoSet } from '../types/data';

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
