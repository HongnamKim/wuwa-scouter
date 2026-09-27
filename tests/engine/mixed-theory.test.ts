import { describe, it, expect } from 'vitest';
import { loadCharacters, loadWeapons, loadEchoSets } from '../../src/engine/loadData';
import { theoryBest, mainRecommendation } from '../../src/engine/theory';
import { buildPerfInput } from '../../src/engine/build';
import { computePerf } from '../../src/engine/perf';
import { slotsFrom } from '../../src/engine/echoSlots';
import { substatMaxStage, MAIN_PRIMARY } from '../../src/engine/constants';
import type { StatKey } from '../../src/types/domain';
import { hiyukiBaseCtx } from './fixtures';

describe('혼합 피해유형의 이론 최고점 탐색', () => {
  it('청초의 8종 유효 부옵 최고점과 추천 계산이 화면을 장시간 멈추지 않는다', () => {
    const character = loadCharacters().find((c) => c.id === 'qingxiao')!;
    const echoSet = loadEchoSets().find((s) => s.id === 'heart_of_evils_purge')!;
    const ctx = {
      ...hiyukiBaseCtx(), character, requiredEnergyRegen: 125, conditionalToggles: {},
      weapon: loadWeapons().find((w) => w.id === 'glint_of_clouds')!,
      echoSets: [echoSet], mainEcho: echoSet.main_slot_echoes[0],
    };
    const start = performance.now();
    const best = theoryBest(ctx);
    expect(performance.now() - start).toBeLessThan(3000);
    const recommendations = mainRecommendation(ctx);
    expect(best.perf).toBeGreaterThan(0);
    expect(recommendations.length).toBeGreaterThan(0);
    // 회귀 당시 최고점 한 번만 18초. 실행 환경 차이를 허용해 두 계산 합계 3초 이내.
    expect(performance.now() - start).toBeLessThan(3000);
  });

  it.each([['4', 0], ['4', 1], ['44', 0]] as const)('%s 코스트·공효 예약 %s줄에서 독립 전수 탐색과 같은 최고점을 낸다', (layout, erLines) => {
    const base = hiyukiBaseCtx();
    const keys: StatKey[] = ['attack_percent', 'basic_attack_bonus', 'heavy_attack_bonus', 'resonance_liberation_bonus'];
    const ctx = {
      ...base, costLayout: layout, requiredEnergyRegen: erLines * 12.4,
      character: { ...base.character, skill_node: [], effective_substats: keys,
        damage_type_mix: [{ type: 'basic_attack' as const, share: 0.2 }, { type: 'heavy_attack' as const, share: 0.3 }, { type: 'resonance_liberation' as const, share: 0.3 }] },
      weapon: { ...base.weapon, base_stats: { attack: 500 }, buffs: [] },
      echoSets: [], mainEcho: { id: '', name: '', buffs: [] }, conditionalToggles: {},
      slots: slotsFrom(layout, [], []),
    };
    // 네 옵션 각각 0~5를 독립 전수 조사. 44는 최상 유형의 5줄 상한을 넘어야 한다.
    const budget = layout.length * 5 - erLines;
    let expected = 0;
    const mains = (Object.keys(MAIN_PRIMARY[4]) as StatKey[]).filter((key) =>
      ['attack_percent', 'element_damage_bonus', 'critical_rate', 'critical_damage', 'energy_regen'].includes(key));
    const mainPairs = layout.length === 1 ? mains.map((m) => [m]) : mains.flatMap((a) => mains.map((b) => [a, b]));
    for (const pair of mainPairs) {
      for (let attack = 0; attack <= 5; attack++) {
        for (let basic = 0; basic <= 5; basic++) {
          for (let heavy = 0; heavy <= 5; heavy++) {
            const liberation = budget - attack - basic - heavy;
            if (liberation < 0 || liberation > 5) continue;
            const counts = [attack, basic, heavy, liberation];
            const trial = { ...ctx, slots: slotsFrom(layout, pair.map((type) => ({ cost: 4 as const, type })), [keys.map((type, i) => ({ type, value: counts[i] * substatMaxStage(type) }))]) };
            expected = Math.max(expected, computePerf(buildPerfInput(trial)));
          }
        }
      }
    }
    const best = theoryBest(ctx);
    expect(best.perf).toBeCloseTo(expected, 10);
  });
});
