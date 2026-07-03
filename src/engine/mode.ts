import type { CalcContext } from './context';
import type { CharacterMode } from '../types/data';
import type { DamageBonusType, StatKey } from '../types/domain';

// 모드 판정은 캐릭터·선택모드만 필요 → 무기/에코 미설정(부분) 상태에서도 호출 가능하도록 최소 형태만 요구
type ModeCtx = Pick<CalcContext, 'character' | 'selectedMode'>;

/** 현재 선택된 모드(없으면 modes[0]). 모드 전환 캐릭터가 아니면 null */
export function activeMode(ctx: ModeCtx): CharacterMode | null {
  const modes = ctx.character.modes;
  if (!modes || !modes.length) return null;
  return modes.find((m) => m.id === ctx.selectedMode) ?? modes[0];
}

/** 선택 모드의 피해유형(없으면 캐릭터 기본) */
export function damageBonusTypeOf(ctx: ModeCtx): DamageBonusType | null {
  return activeMode(ctx)?.damage_bonus_type ?? ctx.character.damage_bonus_type;
}

/** 선택 모드의 유효옵(없으면 캐릭터 기본) */
export function effectiveSubstatsOf(ctx: ModeCtx): StatKey[] {
  return activeMode(ctx)?.effective_substats ?? ctx.character.effective_substats;
}

/** 현재 적용 중인 모드 id (모드 전환 캐릭터만; 아니면 undefined) */
export function activeModeId(ctx: ModeCtx): string | undefined {
  return activeMode(ctx)?.id;
}
