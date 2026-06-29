import type { Buff, Character, Weapon, EchoSet, TwoPieceEffect } from '../types/data';
import { STAT_KEYS, ELEMENTS, BUFF_TARGETS, WEAPON_TYPES } from '../types/domain';
import { MECHANISM_KEYS } from './mechanisms';
import charactersRaw from '../data/characters.json';
import weaponsRaw from '../data/weapons.json';
import echoSetsRaw from '../data/echo-sets.json';
import twoPieceRaw from '../data/two-piece-effects.json';

export function validateBuff(b: any): Buff {
  if (!STAT_KEYS.includes(b.type)) throw new Error(`unknown buff type: ${b.type}`);
  if (b.element !== undefined && !ELEMENTS.includes(b.element)) {
    throw new Error(`unknown element: ${b.element}`);
  }
  if (b.target !== undefined && !BUFF_TARGETS.includes(b.target)) {
    throw new Error(`unknown buff target: ${b.target}`);
  }
  if (typeof b.value !== 'number' || typeof b.always !== 'boolean') {
    throw new Error(`invalid buff: ${JSON.stringify(b)}`);
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
    if (c.special_mechanism != null && !MECHANISM_KEYS.includes(c.special_mechanism)) {
      throw new Error(`unknown special mechanism: ${c.special_mechanism} (${c.id})`);
    }
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
