import { loadCharacters, loadWeapons, loadEchoSets } from '../../src/engine/loadData';
import type { CalcContext } from '../../src/engine/context';

export function hiyukiBaseCtx(): CalcContext {
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
    requiredEnergyRegen: 30,
  };
}
