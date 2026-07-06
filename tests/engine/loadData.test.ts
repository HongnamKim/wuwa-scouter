import { describe, it, expect } from 'vitest';
import { loadCharacters, loadWeapons, loadEchoSets, validateBuff, getWeapon } from '../../src/engine/loadData';

describe('loadData', () => {
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
