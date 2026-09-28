import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const storage = vi.hoisted(() => {
  const entries = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => entries.set(key, value),
    removeItem: (key: string) => entries.delete(key),
  });
  return entries;
});
import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import { PartyTab } from '../../src/components/PartyTab';
import { initialState } from '../../src/state/store';
import type { PartyMember } from '../../src/engine/context';

beforeEach(() => storage.clear());
afterAll(() => vi.unstubAllGlobals());

function renderParty(member: PartyMember) {
  return renderToStaticMarkup(
    <StaticRouter location="/analysis/hiyuki">
      <PartyTab state={{ ...initialState(), partyMembers: [member] }} setState={() => {}} simple={false} />
    </StaticRouter>,
  );
}

describe('파티원 모드 선택', () => {
  it.each([['denia', '데니아'], ['lucilla', '루실라'], ['aemeath', '에이메스'], ['lynae', '린네'], ['hsin', '여우의 별자리']])('%s는 모드 선택을 표시한다', (id, name) => {
    const html = renderParty({ id });
    expect(html).toContain(`aria-label="${name} 모드"`);
    expect(html).not.toContain('저장된 모드 사용');
    expect(html).toContain('class="mode-toggle"');
    expect(html).toContain('aria-pressed="true"');
  });

  it('파티에서 선택한 모드와 해당 모드 버프를 함께 표시한다', () => {
    const html = renderParty({ id: 'lucilla', selectedMode: 'echo' });
    expect(html).toMatch(/<button[^>]*aria-pressed="true"[^>]*>에코<\/button>/);
    expect(html).toContain('슬로우 모션(에코)');
    expect(html).not.toContain('슬로우 모션(서리)');
  });

  it('여우의 별자리 전자 모드는 합일 반주를 제공하지 않는다', () => {
    const html = renderParty({ id: 'hsin', selectedMode: 'electro_flare' });
    expect(html).toMatch(/<button[^>]*aria-pressed="true"[^>]*>전자<\/button>/);
    expect(html).toContain('자신을 제외한 파티원의 전도 피해');
    expect(html).not.toContain('서로를 비추는 등불');
  });

  it('별도 선택이 없으면 파티원의 저장된 모드를 기본 선택한다', () => {
    storage.set('wuwa-scouter:save:lucilla', JSON.stringify({ selectedMode: 'echo' }));
    const html = renderParty({ id: 'lucilla' });
    expect(html).toMatch(/<button[^>]*aria-pressed="true"[^>]*>에코<\/button>/);
    expect(html).toMatch(/<button[^>]*aria-pressed="false"[^>]*>서리<\/button>/);
    expect(html).toContain('슬로우 모션(에코)');
  });

  it('저장된 모드가 없으면 첫 번째 모드를 기본 선택한다', () => {
    expect(renderParty({ id: 'lucilla' })).toMatch(/<button[^>]*aria-pressed="true"[^>]*>서리<\/button>/);
  });

  it('모드가 없는 파티원은 모드 선택을 표시하지 않는다', () => {
    const html = renderParty({ id: 'qiuyuan' });
    expect(html).not.toContain('저장된 모드 사용');
    expect(html).not.toContain('aria-label="구원 모드"');
  });
});
