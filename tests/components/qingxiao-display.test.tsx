import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { EchoSlots } from '../../src/components/EchoSlots';
import { SubstatSwapCompare } from '../../src/components/SubstatSwapCompare';
import { analysisContext, defaultStateForCharacter } from '../../src/state/store';
import { loadCharacters } from '../../src/engine/loadData';
import { computePerf } from '../../src/engine/perf';
import { buildPerfInput } from '../../src/engine/build';

function qingxiaoState() {
  const state = defaultStateForCharacter(loadCharacters().find((c) => c.id === 'qingxiao')!);
  state.slots[0].substats[0] = { type: 'resonance_skill_bonus', value: 11.6 };
  return state;
}

describe('청초의 작은 점유율 항목 표시', () => {
  it('유효옵 합계에서는 공명 스킬을 숨기고 입력된 에코 옵션은 보여준다', () => {
    const html = renderToStaticMarkup(<EchoSlots state={qingxiaoState()} setState={() => {}} />);
    const summary = html.split('class="echo-tabs"')[0];
    expect(summary).not.toContain('공명스킬');
    expect(summary).toContain('강공격');
    expect(html).toContain('공명스킬 피해%');
  });

  it('비교 요약에서 숨겨도 실제 공명 스킬 부옵은 점수에 기여한다', () => {
    const state = qingxiaoState();
    const ctx = analysisContext(state)!;
    const withSkill = computePerf(buildPerfInput(ctx));
    const html = renderToStaticMarkup(<SubstatSwapCompare base={ctx} />);
    expect(html.split('유효옵 총합 변화')[1]).not.toContain('공명스킬');
    const withoutSkill = { ...ctx, slots: ctx.slots.map((s) => ({ ...s, substats: s.substats.filter((l) => l.type !== 'resonance_skill_bonus') })) };
    expect(withSkill).toBeGreaterThan(computePerf(buildPerfInput(withoutSkill)));
  });

  it('다른 캐릭터의 공명 스킬 유효옵 표시는 유지한다', () => {
    const state = qingxiaoState();
    state.character = { ...state.character, id: 'other' };
    const html = renderToStaticMarkup(<EchoSlots state={state} setState={() => {}} />);
    expect(html.split('class="echo-tabs"')[0]).toContain('공명스킬');
  });
});
