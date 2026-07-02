import { describe, it, expect } from 'vitest';
import { loadCharacters, loadWeapons, loadEchoSets } from '../../src/engine/loadData';
import { computeDisplaySpec } from '../../src/engine/spec';
import { buildPerfInput } from '../../src/engine/build';
import { computePerf } from '../../src/engine/perf';
import type { CalcContext } from '../../src/engine/context';
import { slotsFrom } from '../../src/engine/echoSlots';

// 레베카 CHAIN.6 = 6돌에서 모든 출처 일반공격 피해 보너스 ×1.4.
// 특별 메커니즘이 아니라 일반 곱연산 버프(damage_type_bonus_factor)로 처리한다.
// 다른 조건부 버프는 전부 끄고 일반공격 피해 부옵만으로 배수 효과를 격리한다(CHAIN.6 토글만 켬).
function rebeccaCtx(ascension: number, basicBonusSub: number, chain6 = true): CalcContext {
  const character = loadCharacters().find((c) => c.id === 'rebecca')!;
  const weapon = loadWeapons().find((w) => w.id === character.recommended_weapons[0])!;
  const echoSet = loadEchoSets().find((s) => s.id === character.recommended_echo_sets[0])!;
  const toggles = Object.fromEntries(
    character.skill_node.filter((b) => b.id).map((b) => [b.id!, false]),
  );
  toggles['rebecca_chain6_basic_amp'] = chain6;
  return {
    character, weapon, mainEcho: echoSet.main_slot_echoes[0], echoSets: [echoSet],
    costLayout: '43311',
    slots: slotsFrom('43311', [], [[{ type: 'basic_attack_bonus', value: basicBonusSub }], [], [], [], []]),
    conditionalToggles: toggles, manualBuffs: [], ascensionLevel: ascension,
  };
}

describe('레베카 CHAIN.6 일반공격 피해 보너스 ×1.4 (damage_type_bonus_factor 버프)', () => {
  it('spec: 일반공격 피해 보너스 합계가 6돌에서 ×1.4 (모든 출처 = 부옵+무기/세트 패시브)', () => {
    const off = computeDisplaySpec(rebeccaCtx(6, 50, false)); // CHAIN.6 미적용
    const on = computeDisplaySpec(rebeccaCtx(6, 50, true));   // CHAIN.6 적용
    expect(off.damageTypeBonus).toBeGreaterThan(0); // 부옵 50% + 무기/세트 패시브
    expect(on.damageTypeBonus / off.damageTypeBonus).toBeCloseTo(1.4, 10);
  });

  it('돌파 게이트: 6돌 미만에선 CHAIN.6 버프가 적용되지 않는다', () => {
    const lo = computeDisplaySpec(rebeccaCtx(5, 50, true)); // 5돌: min_ascension 6 미달
    const baseline = computeDisplaySpec(rebeccaCtx(5, 50, false));
    expect(lo.damageTypeBonus).toBeCloseTo(baseline.damageTypeBonus, 10);
  });

  it('딜 계산: CHAIN.6 배수로 통합 성능이 오른다', () => {
    const off = computePerf(buildPerfInput(rebeccaCtx(6, 50, false)));
    const on = computePerf(buildPerfInput(rebeccaCtx(6, 50, true)));
    expect(on).toBeGreaterThan(off);
  });
});
