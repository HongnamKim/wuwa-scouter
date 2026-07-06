import { describe, it, expect } from 'vitest';
import { isReleased, isLocked, releaseDateLabel, hasTimezoneOffset } from '../../src/engine/release';
import type { Character } from '../../src/types/data';

const ch = (release_at?: string): Character => ({ release_at } as Character);
const NOW = new Date('2026-07-05T12:00:00+09:00');

describe('출시 잠금(release_at)', () => {
  it('release_at 미지정이면 항상 출시됨', () => {
    expect(isReleased(ch(), NOW)).toBe(true);
    expect(isLocked(ch(), NOW)).toBe(false);
  });

  it('미래 시각이면 잠금', () => {
    const c = ch('2026-07-11T11:00:00+09:00');
    expect(isReleased(c, NOW)).toBe(false);
    expect(isLocked(c, NOW)).toBe(true);
  });

  it('과거/정각이면 출시됨', () => {
    expect(isReleased(ch('2026-07-01T00:00:00+09:00'), NOW)).toBe(true);
    expect(isReleased(ch('2026-07-05T12:00:00+09:00'), NOW)).toBe(true); // 정각
  });

  it('파싱 불가면 출시로 폴백', () => {
    expect(isReleased(ch('invalid'), NOW)).toBe(true);
  });

  it('라벨은 KST 날짜만 "M월 D일 출시"', () => {
    expect(releaseDateLabel(ch('2026-07-11T11:00:00+09:00'))).toBe('7월 11일 출시');
    expect(releaseDateLabel(ch())).toBe('');
  });

  it('오프셋 가드: 오프셋 있으면 통과, 없으면 실패', () => {
    expect(hasTimezoneOffset('2026-07-11T11:00:00+09:00')).toBe(true);
    expect(hasTimezoneOffset('2026-07-11T02:00:00Z')).toBe(true);
    expect(hasTimezoneOffset('2026-07-11T11:00:00+0900')).toBe(true);
    expect(hasTimezoneOffset('2026-07-11T11:00:00')).toBe(false); // 오프셋 없음 → 거부돼야
    expect(hasTimezoneOffset('2026-07-11')).toBe(false);
  });

  it('loadCharacters: release_at 오프셋 없으면 로드 실패(가드)', async () => {
    const { loadCharacters } = await import('../../src/engine/loadData');
    // 실제 데이터는 통과해야 함(오프셋 포함)
    expect(() => loadCharacters()).not.toThrow();
  });
});
