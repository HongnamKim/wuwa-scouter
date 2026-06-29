import { describe, it, expect } from 'vitest';
import { loadCharacters, loadWeapons, loadEchoSets } from '../../src/engine/loadData';
import type { CalcContext } from '../../src/engine/context';
import type { EchoSet } from '../../src/types/data';
import { aggregateBuffs } from '../../src/engine/buffs';
import { optimalTwoPiecePicks, twoPieceRecommendation, twoPieceRecommendationGroups, mainRecommendation } from '../../src/engine/theory';
import { freeTwoPieceSlots } from '../../src/engine/echoSlots';

/** 루시(회절/강공격) + 지정 세트 기준 컨텍스트. 기본=악몽 1pc(자유 슬롯 2) */
function lucyCtx(twoPiecePicks: string[] = [], setId = 'shadow_of_shattered_dreams'): CalcContext {
  const character = loadCharacters().find((c) => c.id === 'lucy')!;
  const weapon = loadWeapons().find((w) => w.id === 'spectral_trigger')!;
  const echoSet = loadEchoSets().find((s) => s.id === setId)!;
  return {
    character, weapon, mainEcho: echoSet.main_slot_echoes[0], echoSets: [echoSet],
    costLayout: '43311',
    mainPrimary: [
      { cost: 4, type: 'critical_damage' }, { cost: 3, type: 'attack_percent' },
      { cost: 3, type: 'attack_percent' }, { cost: 1, type: 'attack_percent' }, { cost: 1, type: 'attack_percent' },
    ],
    twoPiecePicks,
    substats: [[], [], [], [], []],
    conditionalToggles: {},
    manualBuffs: [],
    requiredEnergyRegen: 0,
    ascensionLevel: 0,
  };
}

/** set_pieces만 다른 최소 세트 (freeTwoPieceSlots 순수 검증용) */
const mkSet = (pieces: number): EchoSet => ({
  id: 't', name: 't',
  buffs: [{ type: 'attack_percent', value: 0.1, set_pieces: pieces as 1 | 2 | 3 | 5, always: true }],
  main_slot_echoes: [],
});

describe('자유 2세트 효과', () => {
  it('set_pieces로 슬롯 파생: 1pc→2, 3pc→1, 5pc→0', () => {
    expect(freeTwoPieceSlots([mkSet(1)])).toBe(2);
    expect(freeTwoPieceSlots([mkSet(3)])).toBe(1);
    expect(freeTwoPieceSlots([mkSet(5)])).toBe(0);
  });

  it('실제 세트: 악몽(1pc)→2슬롯, 소리없이(5pc)→0슬롯', () => {
    expect(freeTwoPieceSlots([loadEchoSets().find((s) => s.id === 'shadow_of_shattered_dreams')!])).toBe(2);
    expect(freeTwoPieceSlots([loadEchoSets().find((s) => s.id === 'wishes_of_quiet_snowfall')!])).toBe(0);
  });

  it('회절+회절 → 원소피해 보너스 +20% (캐릭터 회절에 적용)', () => {
    const base = aggregateBuffs(lucyCtx([])).element_bonus;
    const twice = aggregateBuffs(lucyCtx(['element_dmg', 'element_dmg'])).element_bonus;
    expect(+(twice - base).toFixed(4)).toBe(0.20);
  });

  it('공격력+공격력 → 공격력% +20%', () => {
    const base = aggregateBuffs(lucyCtx([])).attack_percent;
    const twice = aggregateBuffs(lucyCtx(['attack', 'attack'])).attack_percent;
    expect(+(twice - base).toFixed(4)).toBe(0.20);
  });

  it('추천: 3개 조합(회절+회절/회절+공격/공격+공격), 최고 1개', () => {
    const recos = twoPieceRecommendation(lucyCtx());
    expect(recos.length).toBe(3);
    expect(recos.filter((r) => r.best).length).toBe(1);
  });

  it('5pc 세트 → 슬롯 0 → 추천/최적 없음', () => {
    const ctx = lucyCtx([], 'wishes_of_quiet_snowfall');
    expect(twoPieceRecommendationGroups(ctx)).toBeNull();
    expect(optimalTwoPiecePicks(ctx)).toEqual([]);
  });

  it('추천 순위는 현재 선택(twoPiecePicks)과 독립적 — 최고점/크크작 (버그 회귀)', () => {
    const order = (g: ReturnType<typeof twoPieceRecommendationGroups>, key: 'theory' | 'kkjak') =>
      g![key].map((r) => r.label);
    const a = twoPieceRecommendationGroups(lucyCtx([]));
    const b = twoPieceRecommendationGroups(lucyCtx(['attack', 'attack']));
    const c = twoPieceRecommendationGroups(lucyCtx(['element_dmg', 'element_dmg']));
    expect(order(b, 'kkjak')).toEqual(order(a, 'kkjak'));
    expect(order(c, 'kkjak')).toEqual(order(a, 'kkjak'));
    expect(order(b, 'theory')).toEqual(order(a, 'theory'));
  });

  it('변수는 2세트 효과뿐: 선택한 버프(토글)는 추천에 반영된다', () => {
    // 사용자가 선택한 버프를 끄면 버킷 구성이 달라져 추천이 달라질 수 있어야 함(고정 파라미터)
    const allOn = lucyCtx([]);
    const togglesOff = { ...allOn, conditionalToggles: { lucy_forte_spectro: false } };
    const dump = (g: ReturnType<typeof twoPieceRecommendationGroups>) =>
      JSON.stringify(g!.theory.map((r) => [r.label, +r.relative.toFixed(3)]));
    expect(dump(twoPieceRecommendationGroups(togglesOff))).not.toEqual(dump(twoPieceRecommendationGroups(allOn)));
  });

  it('메인 조합 추천은 보조 2세트 효과 선택과 무관', () => {
    const dump = (ctx: ReturnType<typeof lucyCtx>) =>
      JSON.stringify(mainRecommendation(ctx).map((g) => [g.label, g.theory.map((r) => r.label), g.kkjak.map((r) => r.label)]));
    const a = dump(lucyCtx([]));
    const b = dump(lucyCtx(['attack', 'attack']));
    const c = dump(lucyCtx(['element_dmg', 'element_dmg']));
    expect(b).toEqual(a);
    expect(c).toEqual(a);
  });
});
