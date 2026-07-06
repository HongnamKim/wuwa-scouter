import type { SyntheticEvent } from 'react';

/** 이미지 로드 실패 시 unknown_icon으로 대체. 이미 대체된 경우 재귀 방지. */
export const UNKNOWN_ICON = '/unknown_icon.webp';
export function onImgError(e: SyntheticEvent<HTMLImageElement>) {
  const el = e.currentTarget;
  if (el.src.endsWith('unknown_icon.webp')) return; // 이미 fallback → 무한 루프 방지
  el.src = UNKNOWN_ICON;
}
