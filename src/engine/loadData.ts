import type { Buff, Character, Weapon, EchoSet } from '../types/data';
import { STAT_KEYS, ELEMENTS, BUFF_TARGETS } from '../types/domain';
import charactersRaw from '../data/characters.json';
import weaponsRaw from '../data/weapons.json';
import echoSetsRaw from '../data/echo-sets.json';

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

export function loadCharacters(): Character[] {
  return (charactersRaw as any[]).map((c) => ({
    ...c,
    skill_node: validateBuffs(c.skill_node),
  })) as Character[];
}

export function loadWeapons(): Weapon[] {
  return (weaponsRaw as any[]).map((w) => ({ ...w, buffs: validateBuffs(w.buffs) })) as Weapon[];
}

export function loadEchoSets(): EchoSet[] {
  return (echoSetsRaw as any[]).map((s) => ({
    ...s,
    buffs: validateBuffs(s.buffs),
    main_slot_echoes: (s.main_slot_echoes ?? []).map((e: any) => ({ ...e, buffs: validateBuffs(e.buffs) })),
  })) as EchoSet[];
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
