import type { CalcContext } from '../engine/context';
import { effectiveSubstatsOf } from '../engine/mode';

/** 요약 표시만 축약한다. 청초의 공명 스킬(점유율 1.4%)도 입력·계산에는 계속 포함한다. */
export function summarySubstatsOf(ctx: Pick<CalcContext, 'character' | 'selectedMode'>) {
  return effectiveSubstatsOf(ctx).filter((key) =>
    ctx.character.id !== 'qingxiao' || key !== 'resonance_skill_bonus');
}
