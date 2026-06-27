import { describe, it, expect } from 'vitest';
import { STAT_KEYS, ELEMENTS } from '../src/types/domain';
import type { Character } from '../src/types/data';

describe('types', () => {
  it('exposes stat key + element vocab', () => {
    expect(STAT_KEYS).toContain('element_damage_amplify');
    expect(STAT_KEYS).toContain('defense_ignore');
    expect(ELEMENTS).toContain('응결');
  });

  it('Character shape compiles', () => {
    const c: Character = {
      id: 'x', name: 'x', version: 1, element: '응결', scale_stat: 'attack', base_attack: 1,
      effective_substats: ['critical_rate'], damage_bonus_type: null,
      energy_regen_mode: 'premise', recommended_echo_sets: [], recommended_weapons: [],
      signature_weapon: null,
      skill_node: [],
    };
    expect(c.id).toBe('x');
  });
});
