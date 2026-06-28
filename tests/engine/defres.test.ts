import { describe, it, expect } from 'vitest';
import { defenseResistanceFactor, buildPerfInput } from '../../src/engine/build';
import { computePerf } from '../../src/engine/perf';
import { loadCharacters, loadWeapons, loadEchoSets } from '../../src/engine/loadData';
import type { CalcContext } from '../../src/engine/context';

describe('방무·저무 딜 반영 (무기 비교용)', () => {
  it('0/0이면 배수 1 (기존 점수 불변)', () => {
    expect(defenseResistanceFactor(0, 0)).toBeCloseTo(1, 10);
  });

  it('방무 10% → ×1.0526, 방무 32% → ×1.1905', () => {
    expect(defenseResistanceFactor(0.10, 0)).toBeCloseTo(2 / 1.9, 6);
    expect(defenseResistanceFactor(0.32, 0)).toBeCloseTo(2 / 1.68, 6);
  });

  it('저무 10% → ×1.1111 (적 기본 저항 10% 가정)', () => {
    expect(defenseResistanceFactor(0, 0.10)).toBeCloseTo(1 / 0.9, 6);
  });

  it('에이메스 전용무기(영원한 샛별): 방무32%+용융저무10% 토글 시 통합 성능 상승', () => {
    const character = loadCharacters().find((c) => c.id === 'aemeath')!;
    const weapon = loadWeapons().find((w) => w.id === 'eternal_morningstar')!;
    const echoSet = loadEchoSets().find((s) => s.id === 'trailblazing_star')!;
    const base: CalcContext = {
      character, weapon, mainEcho: echoSet.main_slot_echoes[0], echoSets: [echoSet],
      costLayout: '43311', mainPrimary: [], substats: [[], [], [], [], []],
      conditionalToggles: { weapon_def_ignore: false, weapon_fusion_res_ignore: false },
      manualBuffs: [], ascensionLevel: 0, refinementLevel: 1,
    };
    const on: CalcContext = { ...base, conditionalToggles: { weapon_def_ignore: true, weapon_fusion_res_ignore: true } };
    const ratio = computePerf(buildPerfInput(on)) / computePerf(buildPerfInput(base));
    // (2/1.68) × (1/0.9) ≈ 1.3228
    expect(ratio).toBeCloseTo((2 / 1.68) * (1 / 0.9), 4);
  });
});
