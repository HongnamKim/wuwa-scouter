import type { Buff, Character, Weapon, EchoSet, TwoPieceEffect } from '../types/data';
import { STAT_KEYS, BUFF_ELEMENTS, BUFF_TARGETS, WEAPON_TYPES } from '../types/domain';
import { MECHANISM_KEYS } from './mechanisms';
import { hasTimezoneOffset } from './release';
import { isValidCostLayout } from './costLayout';
import charactersRaw from '../data/characters.json';
import weaponsRaw from '../data/weapons.json';
import echoSetsRaw from '../data/echo-sets.json';
import twoPieceRaw from '../data/two-piece-effects.json';

export function validateBuff(b: any): Buff {
  if (!STAT_KEYS.includes(b.type)) throw new Error(`unknown buff type: ${b.type}`);
  if (b.element !== undefined && !BUFF_ELEMENTS.includes(b.element)) {
    throw new Error(`unknown element: ${b.element}`);
  }
  if (b.target !== undefined && !BUFF_TARGETS.includes(b.target)) {
    throw new Error(`unknown buff target: ${b.target}`);
  }
  if (typeof b.value !== 'number' || typeof b.always !== 'boolean') {
    throw new Error(`invalid buff: ${JSON.stringify(b)}`);
  }
  // 무결성: 모든 데이터 버프는 두 점수 플래그를 명시(true/false)하고, 동시 true는 금지(상호 배타)
  if (typeof b.record_only !== 'boolean' || typeof b.absolute_score_only !== 'boolean') {
    throw new Error(`buff missing record_only/absolute_score_only: ${b.label ?? b.note ?? b.type}`);
  }
  if (b.record_only && b.absolute_score_only) {
    throw new Error(`buff cannot be both record_only and absolute_score_only: ${b.label ?? b.note ?? b.type}`);
  }
  return b as Buff;
}

function validateBuffs(buffs: any[]): Buff[] {
  return buffs.map(validateBuff);
}

function validateWeaponType(t: any, owner: string): void {
  if (!WEAPON_TYPES.includes(t)) throw new Error(`unknown weapon type: ${t} (${owner})`);
}

export function loadCharacters(): Character[] {
  return (charactersRaw as any[]).map((c) => {
    validateWeaponType(c.weapon_type, c.id);
    if (!isValidCostLayout(c.cost_layout)) {
      throw new Error(`invalid cost_layout: ${c.cost_layout} (${c.id}) — 4/3/1, 1~5개, 합≤12`);
    }
    if (c.version_phase != null && c.version_phase !== '전반' && c.version_phase !== '후반') {
      throw new Error(`unknown version_phase: ${c.version_phase} (${c.id})`);
    }
    if (c.special_mechanism != null && !MECHANISM_KEYS.includes(c.special_mechanism)) {
      throw new Error(`unknown special mechanism: ${c.special_mechanism} (${c.id})`);
    }
    // release_at 가드: 파싱 가능 + 반드시 타임존 오프셋 포함(한국 기준이면 +09:00).
    // 오프셋이 없으면 보는 사람 로컬 시간으로 해석돼 지역마다 다른 시각에 열리는 버그가 생긴다.
    if (c.release_at != null) {
      if (typeof c.release_at !== 'string' || Number.isNaN(new Date(c.release_at).getTime())) {
        throw new Error(`invalid release_at (파싱 불가): ${c.release_at} (${c.id})`);
      }
      if (!hasTimezoneOffset(c.release_at)) {
        throw new Error(`release_at에 타임존 오프셋이 없습니다. 한국 기준이면 '+09:00'을 붙이세요 (예: "2026-07-11T11:00:00+09:00"): ${c.release_at} (${c.id})`);
      }
    }
    // 무결성: 스킬노드 버프는 min_ascension(돌파 요구치, 0 포함)과 target(self 포함)을 반드시 명시한다
    (c.skill_node as any[]).forEach((b) => {
      if (typeof b.min_ascension !== 'number') {
        throw new Error(`skill_node buff missing min_ascension: ${c.id} / ${b.label ?? b.note ?? b.type}`);
      }
      if (!BUFF_TARGETS.includes(b.target)) {
        throw new Error(`skill_node buff missing/invalid target: ${c.id} / ${b.label ?? b.note ?? b.type}`);
      }
    });
    return { ...c, skill_node: validateBuffs(c.skill_node) };
  }) as Character[];
}

export function loadWeapons(): Weapon[] {
  return (weaponsRaw as any[]).map((w) => {
    validateWeaponType(w.weapon_type, w.id);
    return { ...w, buffs: validateBuffs(w.buffs) };
  }) as Weapon[];
}

export function loadEchoSets(): EchoSet[] {
  return (echoSetsRaw as any[]).map((s) => ({
    ...s,
    buffs: validateBuffs(s.buffs),
    main_slot_echoes: (s.main_slot_echoes ?? []).map((e: any) => ({ ...e, buffs: validateBuffs(e.buffs) })),
  })) as EchoSet[];
}

// 자유 2세트 효과 풀 (메모이즈: aggregateBuffs 핫패스에서 반복 호출됨)
let _twoPiece: TwoPieceEffect[] | null = null;
export function loadTwoPieceEffects(): TwoPieceEffect[] {
  if (_twoPiece) return _twoPiece;
  _twoPiece = (twoPieceRaw as any[]).map((e) => {
    if (!STAT_KEYS.includes(e.type)) throw new Error(`unknown two-piece type: ${e.type}`);
    if (typeof e.id !== 'string' || typeof e.value !== 'number') {
      throw new Error(`invalid two-piece effect: ${JSON.stringify(e)}`);
    }
    return e as TwoPieceEffect;
  });
  return _twoPiece;
}

export function getWeapon(id: string, weapons: Weapon[]): Weapon {
  const w = weapons.find((x) => x.id === id);
  if (!w) throw new Error(`weapon not found: ${id}`);
  return w;
}

export function getEchoSet(id: string, sets: EchoSet[]): EchoSet {
  const s = sets.find((x) => x.id === id);
  if (!s) throw new Error(`echo set not found: ${id}`);
  return s;
}
