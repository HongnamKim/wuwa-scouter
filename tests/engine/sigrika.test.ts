import { describe, it, expect } from 'vitest';
import { loadCharacters, loadWeapons, loadEchoSets } from '../../src/engine/loadData';
import { computeDisplaySpec } from '../../src/engine/spec';
import { buildPerfInput } from '../../src/engine/build';
import { computePerf } from '../../src/engine/perf';
import { mechanismDamageTypeBonus } from '../../src/engine/mechanisms';
import { mainRecommendation, threeCoModeOptions, optimalThreeCoModeKkjak } from '../../src/engine/theory';
import type { CalcContext } from '../../src/engine/context';
import { slotsFrom } from '../../src/engine/echoSlots';

// 시그리카 + 솔스원의 해석 + 함의의 소리를 따라. ER은 부옵 공효 값(%)으로 조절.
function sigrikaCtx(erSubValue: number): CalcContext {
  const character = loadCharacters().find((c) => c.id === 'sigrika')!;
  const weapon = loadWeapons().find((w) => w.id === 'solsworn_ciphers')!;
  const echoSet = loadEchoSets().find((s) => s.id === 'sound_of_true_name')!;
  return {
    character, weapon, mainEcho: echoSet.main_slot_echoes[0], echoSets: [echoSet],
    costLayout: '43311',
    slots: slotsFrom('43311', [], [[{ type: 'energy_regen', value: erSubValue }], [], [], [], []]),
    conditionalToggles: {},
    manualBuffs: [],
    requiredEnergyRegen: 150,
  };
}

describe('시그리카 공효→에코 전환 메커니즘', () => {
  it('전환 함수: 125% 이하 0, 1%당 +2%, 150%에서 +50% 상한', () => {
    expect(mechanismDamageTypeBonus('sigrika_er_to_echo', 1.25)).toBeCloseTo(0, 10);
    expect(mechanismDamageTypeBonus('sigrika_er_to_echo', 1.30)).toBeCloseTo(0.10, 10);
    expect(mechanismDamageTypeBonus('sigrika_er_to_echo', 1.50)).toBeCloseTo(0.50, 10);
    expect(mechanismDamageTypeBonus('sigrika_er_to_echo', 2.00)).toBeCloseTo(0.50, 10); // cap
    expect(mechanismDamageTypeBonus(null, 1.50)).toBe(0); // 일반 캐릭터
  });

  it('spec: 공효 100%→150%면 에코 피해유형 보너스가 +0.50', () => {
    const lo = computeDisplaySpec(sigrikaCtx(0));   // 공효 100%
    const hi = computeDisplaySpec(sigrikaCtx(50));  // 공효 150%
    expect(hi.energyRegen).toBeCloseTo(1.50, 10);
    expect(hi.damageTypeBonus - lo.damageTypeBonus).toBeCloseTo(0.50, 10);
  });

  it('딜 계산: 공효 부옵이 전환으로 통합 성능을 올린다', () => {
    const lo = computePerf(buildPerfInput(sigrikaCtx(0)));
    const hi = computePerf(buildPerfInput(sigrikaCtx(50)));
    expect(hi).toBeGreaterThan(lo);
  });

  it('크크작 3코 추천에 공효가 포함되고, 현실(13.1% ER) 베이스라인에선 공효 3코가 최적', () => {
    const groups = mainRecommendation({ ...sigrikaCtx(0), costLayout: '43311' });
    const threeCo = groups.find((g) => g.label === '3코 조합')!;
    expect(threeCo.kkjak.some((r) => r.label.includes('공효'))).toBe(true);
    expect(threeCo.kkjak.find((r) => r.best)!.label).toContain('공효');
  });

  it('크크작 모드 옵션에 공효 모드가 포함되고 기본값이 공효 모드', () => {
    const opts = threeCoModeOptions(sigrikaCtx(0));
    expect(opts.map((o) => o.value)).toContain('er_gong');
    expect(optimalThreeCoModeKkjak({ ...sigrikaCtx(0), costLayout: '43311' }).startsWith('er_')).toBe(true);
  });
});

describe('비전환 캐릭터(히유키) 크크작 3코 추천은 공효 미포함', () => {
  it('공효 후보가 없다', () => {
    const character = loadCharacters().find((c) => c.id === 'hiyuki')!;
    const weapon = loadWeapons().find((w) => w.id === 'frostbound_flame')!;
    const echoSet = loadEchoSets()[0];
    const ctx: CalcContext = {
      character, weapon, mainEcho: echoSet.main_slot_echoes[0], echoSets: [echoSet],
      costLayout: '43311', slots: slotsFrom('43311', [], []),
      conditionalToggles: {}, manualBuffs: [], requiredEnergyRegen: 25,
    };
    const threeCo = mainRecommendation(ctx).find((g) => g.label === '3코 조합')!;
    expect(threeCo.kkjak.every((r) => !r.label.includes('공효'))).toBe(true);
    expect(threeCoModeOptions(ctx).every((o) => !o.value.startsWith('er_'))).toBe(true);
  });
});
