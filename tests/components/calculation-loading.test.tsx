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
import { Scores } from '../../src/components/Scores';
import { MainReco } from '../../src/components/MainReco';
import { CharacterList } from '../../src/components/CharacterList';
import { SubstatSwapCompare } from '../../src/components/SubstatSwapCompare';
import { ThemeProvider } from '../../src/theme';
import { saveCharacterState } from '../../src/state/store';
import * as theory from '../../src/engine/theory';
import { hiyukiBaseCtx } from '../engine/fixtures';

beforeEach(() => storage.clear());
afterAll(() => vi.unstubAllGlobals());

describe('계산 전 첫 화면', () => {
  it('점수 제목은 먼저 표시하고 최고점 수치는 스켈레톤으로 남긴다', () => {
    const search = vi.spyOn(theory, 'theoryBest');
    const html = renderToStaticMarkup(<Scores state={hiyukiBaseCtx()} />);
    expect(html).toContain('최고점 대비');
    expect(html).toContain('class="skeleton"');
    expect(html).toContain('aria-busy="true"');
    expect(search).not.toHaveBeenCalled();
    search.mockRestore();
  });

  it('추천 표의 최고점·크크작 행을 계산 전에 표시한다', () => {
    const html = renderToStaticMarkup(<MainReco state={hiyukiBaseCtx()} />);
    expect(html).toContain('최고점');
    expect(html).toContain('크크작');
    expect(html).toContain('class="skeleton"');
  });

  it('비교 화면의 에코 편집기는 최고점 계산을 기다리지 않는다', () => {
    const html = renderToStaticMarkup(<SubstatSwapCompare base={hiyukiBaseCtx()} />);
    expect(html).toContain('교체할 에코');
    expect(html).toContain('class="skeleton"');
  });

  it('설정 미완성은 계산 대기 상태로 표시하지 않는다', () => {
    const state = { ...hiyukiBaseCtx(), weapon: null };
    expect(renderToStaticMarkup(<Scores state={state} />)).not.toContain('class="skeleton"');
    expect(renderToStaticMarkup(<MainReco state={state} />)).toContain('먼저 설정');
  });

  it('저장된 공명자의 이미지와 이름을 점수보다 먼저 표시한다', () => {
    saveCharacterState(hiyukiBaseCtx());
    const search = vi.spyOn(theory, 'theoryBest');
    const html = renderToStaticMarkup(<ThemeProvider><CharacterList onSelect={() => {}} /></ThemeProvider>);
    expect(html).toContain('/characters/hiyuki.webp');
    expect(html).toContain('히유키');
    expect(html).toContain('class="skeleton"');
    expect(search).not.toHaveBeenCalled();
    search.mockRestore();
  });
});
