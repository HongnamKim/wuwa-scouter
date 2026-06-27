import { describe, it, expect } from 'vitest';
import { computeDisplaySpec } from '../../src/engine/spec';
import { loadCharacters, loadWeapons, loadEchoSets } from '../../src/engine/loadData';
import type { CalcContext } from '../../src/engine/context';

function hiyukiCtx(): CalcContext {
  const character = loadCharacters().find((c) => c.id === 'hiyuki')!;
  const weapon = loadWeapons().find((w) => w.id === 'frostbound_flame')!;
  const echoSet = loadEchoSets()[0];
  return {
    character, weapon, mainEcho: echoSet.main_slot_echoes[0], echoSets: [echoSet],
    costLayout: '43311',
    mainPrimary: [
      { cost: 4, type: 'critical_damage' }, { cost: 3, type: 'attack_percent' },
      { cost: 3, type: 'attack_percent' }, { cost: 1, type: 'attack_percent' },
      { cost: 1, type: 'attack_percent' },
    ],
    substats: [
      [{ type: 'critical_rate', value: 35.7 }], [{ type: 'critical_damage', value: 60 }],
      [{ type: 'attack_percent', value: 29.3 }], [{ type: 'resonance_liberation_bonus', value: 33.8 }], [],
    ],
    conditionalToggles: { set_5pc_element: true, set_5pc_critical: true, weapon_glacio_amplify: false, weapon_def_ignore: false },
    manualBuffs: [],
  };
}

describe('computeDisplaySpec', () => {
  it('ATK 2965, 크리율 0.98, 크피 2.54, 응결 0.32, 공명해방 0.458', () => {
    const s = computeDisplaySpec(hiyukiCtx());
    expect(s.attack).toBeCloseTo(2965, 0);
    expect(s.criticalRate).toBeCloseTo(0.98, 2);
    expect(s.criticalDamage).toBeCloseTo(2.54, 2);
    expect(s.elementBonus).toBeCloseTo(0.32, 2);
    expect(s.damageTypeBonus).toBeCloseTo(0.458, 2);
  });
});
