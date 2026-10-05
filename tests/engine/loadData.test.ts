import { describe, it, expect } from 'vitest';
import { loadCharacters, loadWeapons, loadEchoSets, loadTwoPieceEffects, validateBuff, getWeapon } from '../../src/engine/loadData';
import { characters } from '../../src/data/characters';
import { weapons } from '../../src/data/weapons';
import { echoSets } from '../../src/data/echo-sets';
import { twoPieceEffects } from '../../src/data/two-piece-effects';

describe('loadData', () => {
  it('영문 ID로 조회하는 데이터와 기존 배열 로더가 같은 값·순서를 제공한다', () => {
    expect(characters.hsin.id).toBe('hsin');
    expect(weapons.variation.id).toBe('variation');
    expect(loadCharacters()).toEqual(Object.values(characters));
    expect(loadWeapons()).toEqual(Object.values(weapons));
    expect(loadEchoSets()).toEqual(Object.values(echoSets));
    expect(loadTwoPieceEffects()).toEqual(Object.values(twoPieceEffects));
  });

  it('데이터 키와 내부 ID가 일치한다', () => {
    for (const registry of [characters, weapons, echoSets, twoPieceEffects]) {
      for (const [key, value] of Object.entries(registry)) expect(value.id).toBe(key);
    }
  });

  it('추천 장비와 특정 캐릭터 참조가 실제 데이터로 연결된다', () => {
    const chars = loadCharacters();
    const items = loadWeapons();
    const sets = loadEchoSets();
    const mainEchoIds = new Set(sets.flatMap((s) => s.main_slot_echoes.map((e) => e.id)));
    for (const c of chars) {
      for (const id of [...c.recommended_weapons, ...(c.signature_weapon ? [c.signature_weapon] : [])]) {
        expect(items.find((w) => w.id === id)?.weapon_type, `${c.id}: ${id}`).toBe(c.weapon_type);
      }
      for (const id of c.recommended_echo_sets) expect(sets.some((s) => s.id === id), `${c.id}: ${id}`).toBe(true);
      for (const id of c.recommended_main_echo) expect(mainEchoIds.has(id), `${c.id}: ${id}`).toBe(true);
    }
    const characterIds = new Set(chars.map((c) => c.id));
    const buffs = [
      ...chars.flatMap((c) => c.skill_node), ...items.flatMap((w) => w.buffs),
      ...sets.flatMap((s) => [...s.buffs, ...s.main_slot_echoes.flatMap((e) => e.buffs)]),
    ];
    for (const b of buffs) {
      // 기존 파수인의 방랑자 공효 항목은 속성 공통 ID 'rover'를 사용한다.
      for (const id of [b.target_character, b.only_character]) {
        if (id && id !== 'rover') expect(characterIds.has(id), b.id ?? b.label).toBe(true);
      }
    }
  });

  it('loads hiyuki', () => {
    const c = loadCharacters().find((x) => x.id === 'hiyuki')!;
    expect(c.base_attack).toBe(462);
    expect(c.damage_bonus_type).toBe('resonance_liberation');
  });

  it('loads weapons with base_stats', () => {
    const w = getWeapon('frostbound_flame', loadWeapons());
    expect(w.base_stats.attack).toBe(587);
    expect(w.base_stats.critical_rate).toBe(0.243);
  });

  it('loads echo set with set_pieces + main slot echoes', () => {
    const s = loadEchoSets()[0];
    expect(s.buffs[0].set_pieces).toBe(2);
    expect(s.main_slot_echoes[0].buffs).toHaveLength(2);
  });

  it('rejects unknown buff type', () => {
    expect(() => validateBuff({ type: 'bogus', value: 1, always: true })).toThrow();
  });

  it('rejects unknown element', () => {
    expect(() => validateBuff({ type: 'element_damage_bonus', value: 0.1, always: true, element: '화염' })).toThrow();
  });

  it('rejects buff missing record_only/absolute_score_only', () => {
    expect(() => validateBuff({ type: 'critical_rate', value: 0.1, always: true, target: 'self', min_ascension: 0 })).toThrow();
  });

  it('rejects buff with both record_only and absolute_score_only true', () => {
    expect(() => validateBuff({ type: 'critical_rate', value: 0.1, always: true, record_only: true, absolute_score_only: true })).toThrow();
  });

  it('accepts buff with both flags present and not both true', () => {
    const b = validateBuff({ type: 'critical_rate', value: 0.1, always: true, record_only: false, absolute_score_only: false });
    expect(b.type).toBe('critical_rate');
  });

  it.each(['skill_motion_value_bonus', 'skill_motion_value_amplify'])('%s는 기록 전용만 허용한다', (type) => {
    const buff = { type, value: 0.5, always: false, record_only: false, absolute_score_only: false };
    expect(() => validateBuff(buff)).toThrow('must be record_only');
    expect(validateBuff({ ...buff, record_only: true }).record_only).toBe(true);
  });

  it('무결성: 모든 스킬노드 버프가 min_ascension(숫자) + target(self 포함)을 명시한다', () => {
    const targets = ['self', 'party', 'next_character', 'specific_character', 'party_except_self'];
    for (const c of loadCharacters()) {
      for (const b of c.skill_node) {
        const where = `${c.id} / ${b.label ?? b.note ?? b.type}`;
        expect(typeof b.min_ascension, where).toBe('number');
        expect(targets, where).toContain(b.target);
      }
    }
  });
});
