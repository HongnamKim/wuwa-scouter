import type { Character } from '../types/data';

/** ISO 문자열에 타임존 오프셋(Z 또는 ±HH:MM / ±HHMM)이 있는지.
 *  release_at은 지역 무관 절대시점이어야 하므로 오프셋이 필수(한국이면 +09:00). 없으면 보는 사람 로컬로 해석돼 지역마다 다르게 열림. */
export function hasTimezoneOffset(iso: string): boolean {
  return /(Z|[+-]\d{2}:?\d{2})$/i.test(iso.trim());
}

/** 출시 여부. release_at 미지정/파싱 불가면 이미 출시로 간주. now 미지정 시 현재 시각(런타임). */
export function isReleased(character: Character, now: Date = new Date()): boolean {
  if (!character.release_at) return true;
  const t = new Date(character.release_at).getTime();
  return Number.isNaN(t) || now.getTime() >= t;
}

/** 아직 출시 전(잠금)인지. */
export function isLocked(character: Character, now: Date = new Date()): boolean {
  return !isReleased(character, now);
}

/** "7월 11일 출시" (KST 기준 날짜만 표시). release_at 없거나 파싱 불가면 빈 문자열. */
export function releaseDateLabel(character: Character): string {
  if (!character.release_at) return '';
  const d = new Date(character.release_at);
  if (Number.isNaN(d.getTime())) return '';
  const md = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric' }).format(d);
  return `${md} 출시`;
}
