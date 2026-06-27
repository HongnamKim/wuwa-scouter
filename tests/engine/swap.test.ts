import { describe, it, expect } from 'vitest';
import { loadCharacters, loadWeapons, loadEchoSets } from '../../src/engine/loadData';
import { aggregateBuffs } from '../../src/engine/buffs';
import type { CalcContext } from '../../src/engine/context';

/**
 * Simulates a weapon swap to millennium_eddy where conditionalToggles has NOT
 * been re-seeded — weapon_atk_stack is absent (undefined).
 */
function swapCtx(overrideToggles: Record<string, boolean> = {}): CalcContext {
  const character = loadCharacters().find((c) => c.id === 'hiyuki')!;
  const weapon = loadWeapons().find((w) => w.id === 'millennium_eddy')!;
  const echoSet = loadEchoSets()[0];
  const substats = [
    [{ type: 'critical_rate', value: 35.7 }],
    [{ type: 'critical_damage', value: 60 }],
    [{ type: 'attack_percent', value: 29.3 }],
    [{ type: 'resonance_liberation_bonus', value: 33.8 }],
    [],
  ] as CalcContext['substats'];
  return {
    character,
    weapon,
    mainEcho: echoSet.main_slot_echoes[0],
    echoSets: [echoSet],
    costLayout: '43311',
    mainPrimary: [
      { cost: 4, type: 'critical_damage' },
      { cost: 3, type: 'attack_percent' },
      { cost: 3, type: 'attack_percent' },
      { cost: 1, type: 'attack_percent' },
      { cost: 1, type: 'attack_percent' },
    ],
    substats,
    conditionalToggles: overrideToggles,
    manualBuffs: [],
  };
}

describe('conditional buff default-ON after weapon swap', () => {
  it('absent weapon_atk_stack toggle yields attack_percent 0.24 (skill 0.12 + weapon 0.12)', () => {
    // conditionalToggles is empty — simulates a swap that did not re-seed toggles
    const ctx = swapCtx({});
    const totals = aggregateBuffs(ctx);
    expect(totals.attack_percent).toBeCloseTo(0.24, 10);
  });

  it('explicit weapon_atk_stack: false yields attack_percent 0.12 (skill only)', () => {
    const ctx = swapCtx({ weapon_atk_stack: false });
    const totals = aggregateBuffs(ctx);
    expect(totals.attack_percent).toBeCloseTo(0.12, 10);
  });
});
