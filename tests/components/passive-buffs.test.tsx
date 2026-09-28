import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { BuffPanel } from '../../src/components/BuffPanel';
import { loadCharacters } from '../../src/engine/loadData';
import { analysisContext, defaultStateForCharacter } from '../../src/state/store';
import { aggregateBuffs } from '../../src/engine/buffs';
import { CharacterSpec } from '../../src/components/CharacterSpec';

function renderPanel(ascensionLevel: number, conditionalToggles: Record<string, boolean> = {}) {
  const state = defaultStateForCharacter(loadCharacters().find((c) => c.id === 'qingxiao')!);
  return renderToStaticMarkup(<BuffPanel state={{ ...state, ascensionLevel, conditionalToggles }} setState={() => {}} />);
}

function row(html: string, text: string) {
  const found = [...html.matchAll(/<label\b[^>]*>[\s\S]*?<\/label>/g)].find(([label]) => label.includes(text));
  expect(found, `${text} 버프가 목록에 표시되어야 함`).toBeDefined();
  return found![0];
}

describe('상시 고유 스킬·돌파 버프 표시', () => {
  it('경연의 HP 전환 패시브와 실제 체력을 표시하고 스킬 노드는 숨긴다', () => {
    const state = defaultStateForCharacter(loadCharacters().find((c) => c.id === 'jingran')!);
    const html = renderToStaticMarkup(<BuffPanel state={state} setState={() => {}} />);
    const buff = row(html, '양변음합:');
    expect(buff).toContain('상시 적용');
    expect(buff).toContain('disabled=""');
    expect(buff).toContain('현재 +');
    expect(buff).not.toContain('현재 +0');
    expect(html).not.toContain('스킬 노드:');
    expect(row(html, '화 또는 복 추가 25스택')).not.toContain('checked=""');
    const spec = renderToStaticMarkup(<CharacterSpec state={state} />);
    expect(spec).toContain('<th>체력</th>');
    expect(spec).toContain('<th>공격력</th>');
  });
  it('3돌 상시 크피 효과를 체크된 비활성 토글과 함께 표시한다', () => {
    const buff = row(renderPanel(3), '공명 해방 크리티컬 피해 +100%');
    expect(buff).toContain('disabled=""');
    expect(buff).toContain('checked=""');
    expect(buff).toContain('상시 적용');
    expect(buff).toContain('공명 해방 크리티컬 피해 +100% (3돌)');
    expect(buff).not.toContain('점유율');
    expect(buff).not.toContain('가중');
  });

  it('돌파 미달 상시 효과는 체크하지 않고 필요한 돌파를 안내한다', () => {
    const buff = row(renderPanel(2), '공명 해방 크리티컬 피해 +100%');
    expect(buff).toContain('disabled=""');
    expect(buff).not.toContain('checked=""');
    expect(buff).not.toContain('상시 적용');
    expect(buff).toContain('3돌 필요');
  });

  it('저장된 미적용 토글이 있어도 상시 효과는 적용 상태로 표시한다', () => {
    const buff = row(renderPanel(3, { qingxiao_chain1_crit: false }), '크리티컬 +16%');
    expect(buff).toContain('checked=""');
    expect(buff).toContain('disabled=""');
  });

  it('기본 스킬 노드는 목록에서 제외하되 계산에는 포함한다', () => {
    const html = renderPanel(0);
    expect(html).not.toContain('스킬 노드: 공격력 +12%');
    expect(html).not.toContain('스킬 노드: 크리티컬 피해 +16%');
    const state = defaultStateForCharacter(loadCharacters().find((c) => c.id === 'qingxiao')!);
    const ctx = analysisContext(state)!;
    const withNodes = aggregateBuffs(ctx);
    const withoutNodes = aggregateBuffs({ ...ctx, character: { ...ctx.character, skill_node: [] } });
    expect(withNodes.attack_percent - withoutNodes.attack_percent).toBeCloseTo(0.12);
    expect(withNodes.critical_damage - withoutNodes.critical_damage).toBeCloseTo(0.16);
  });

  it('이름 없는 기존 노드도 숨기고 고유 패시브는 유지한다', () => {
    const state = defaultStateForCharacter(loadCharacters().find((c) => c.id === 'mornye')!);
    const html = renderToStaticMarkup(<BuffPanel state={state} setState={() => {}} />);
    expect(html).not.toContain('방어력 +15.2%');
    expect(html).not.toContain('치료 효과 보너스 +12%');
    const buff = row(html, '공명 효율 +10%');
    expect(buff).toContain('상시 적용');
    expect(buff).toContain('checked=""');
    expect(buff).toContain('disabled=""');
  });

  it('조건부 효과는 계속 조작할 수 있고 기록 전용 효과는 노출하지 않는다', () => {
    const html = renderPanel(4);
    const buff = row(html, '수혜자 본인이 조화 밀집·이탈 부여 시 공격력 +20%');
    expect(buff).not.toContain('disabled=""');
    expect(buff).toContain('checked=""');
    expect(buff).not.toContain('상시 적용');
    expect(html).not.toContain('선인의 몸 일반 공격·회피 반격 배율');
  });
});
