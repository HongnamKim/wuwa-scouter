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

  it('무결성: 모든 스킬노드 버프가 min_ascension(숫자)을 가진다', () => {
    for (const c of loadCharacters()) {
      for (const b of c.skill_node) {
        expect(typeof b.min_ascension, `${c.id} / ${b.label ?? b.note ?? b.type}`).toBe('number');
      }
    }
  });
});
