import { describe, it, expect } from 'vitest';
import {
  SUBSTAT_STAGES, MAIN_PRIMARY, MAIN_SECONDARY,
  substatFourthFromBottom, substatMaxStage, BASE_CRIT, BASE_CRIT_DAMAGE,
} from '../../src/engine/constants';
import { costsOf } from '../../src/engine/costLayout';

describe('constants', () => {
  it('substat stage tables (실측)', () => {
    expect(SUBSTAT_STAGES.critical_rate).toEqual([6.3, 6.9, 7.5, 8.1, 8.7, 9.3, 9.9, 10.5]);
    expect(SUBSTAT_STAGES.critical_damage).toEqual([12.6, 13.8, 15, 16.2, 17.4, 18.6, 19.8, 21]);
    expect(SUBSTAT_STAGES.attack_percent).toEqual([6.4, 7.1, 7.9, 8.6, 9.4, 10.1, 10.9, 11.6]);
    expect(SUBSTAT_STAGES.flat_attack).toEqual([30, 40, 50, 60]);
  });

  it('크크작 밑에서 4번째', () => {
    expect(substatFourthFromBottom('critical_rate')).toBe(8.1);
    expect(substatFourthFromBottom('critical_damage')).toBe(16.2);
    expect(substatFourthFromBottom('attack_percent')).toBe(8.6);
  });

  it('이론 최고 max', () => {
    expect(substatMaxStage('critical_damage')).toBe(21);
    expect(substatMaxStage('attack_percent')).toBe(11.6);
    expect(substatMaxStage('flat_attack')).toBe(60);
  });

  it('main option values', () => {
    expect(MAIN_PRIMARY[4].critical_damage).toBe(44.0);
    expect(MAIN_PRIMARY[3].element_damage_bonus).toBe(30.0);
    expect(MAIN_PRIMARY[1].attack_percent).toBe(18.0);
    expect(MAIN_SECONDARY[4]).toEqual({ stat: 'flat_attack', value: 150 });
    expect(MAIN_SECONDARY[1]).toEqual({ stat: 'flat_hp', value: 2280 });
  });

  it('layouts + bases', () => {
    expect(costsOf('43311')).toEqual([4, 3, 3, 1, 1]);
    expect(BASE_CRIT).toBe(0.05);
    expect(BASE_CRIT_DAMAGE).toBe(1.5);
  });
});
