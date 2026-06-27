import { describe, it, expect } from 'vitest';
import { loadCharacters, loadWeapons, loadEchoSets } from '../../src/engine/loadData';
import { computePerf } from '../../src/engine/perf';
import { buildPerfInput } from '../../src/engine/build';
import type { CalcContext } from '../../src/engine/context';

// 부록 A 재현 컨텍스트 (5세트 ON, 무기 부스트 OFF)
function hiyukiCtx(): CalcContext {
  const character = loadCharacters().find((c) => c.id === 'hiyuki')!;
  const weapon = loadWeapons().find((w) => w.id === 'frostbound_flame')!;
  const echoSet = loadEchoSets()[0];
  // 부옵 유효옵 합: 크리 35.7, 크피 60, 공% 29.3, 해방 33.8 (깡공 0)
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
      { cost: 4, type: 'critical_damage' }, // 크피44
      { cost: 3, type: 'attack_percent' },  // 공%30
      { cost: 3, type: 'attack_percent' },  // 공%30
      { cost: 1, type: 'attack_percent' },  // 공%18
      { cost: 1, type: 'attack_percent' },  // 공%18
    ],
    substats,
    conditionalToggles: {
      set_5pc_element: true, set_5pc_critical: true,
      weapon_glacio_amplify: false, weapon_def_ignore: false,
    },
    manualBuffs: [],
  };
}

describe('buildPerfInput', () => {
  it('부록 A → 통합 성능 ≈ 13228.6', () => {
    const input = buildPerfInput(hiyukiCtx());
    expect(computePerf(input)).toBeCloseTo(13228.6, 0);
  });

  it('ATK 항 ≈ 2965', () => {
    const i = buildPerfInput(hiyukiCtx());
    expect(i.baseAttack * (1 + i.attackPercent) + i.flatAttack).toBeCloseTo(2965, 0);
  });

  it('크리율 ≈ 0.98', () => {
    expect(buildPerfInput(hiyukiCtx()).criticalRate).toBeCloseTo(0.98, 2);
  });

  it('무기 부스트 토글 ON → ×1.28', () => {
    const off = hiyukiCtx();
    const on = hiyukiCtx();
    on.conditionalToggles.weapon_glacio_amplify = true;
    expect(computePerf(buildPerfInput(on)) / computePerf(buildPerfInput(off))).toBeCloseTo(1.28, 3);
  });

  it('방어력 무시 토글은 통합 성능 불변', () => {
    const off = hiyukiCtx();
    const on = hiyukiCtx();
    on.conditionalToggles.weapon_def_ignore = true;
    expect(computePerf(buildPerfInput(on))).toBeCloseTo(computePerf(buildPerfInput(off)), 6);
  });
});
