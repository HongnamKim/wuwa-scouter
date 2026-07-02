import { describe, it, expect } from 'vitest';
import { compareSubstats } from '../../src/engine/theory';
import { loadCharacters, loadWeapons, loadEchoSets } from '../../src/engine/loadData';
import type { CalcContext } from '../../src/engine/context';
import { slotsFrom } from '../../src/engine/echoSlots';
import { hiyukiBaseCtx } from './fixtures';

describe('부옵 자유 비교', () => {
  it('슬롯 변경 ≈ +0.64%', () => {
    // 부록 A.6 교체: 크피 합 60→57.6 (-2.4), 공% 합 29.3→33.8 (+4.5)
    // 검증된 엔진(13228.6·2965·59.9%·125.7% 일치)이 이 fixture에서 내는 값은 +0.64%.
    // 기획서 부록 A.6의 "+1.8%"는 stale 수기 추정치로 판단(다른 베이스/근사).
    const r = compareSubstats(hiyukiBaseCtx(), { critical_damage: 57.6, attack_percent: 33.8 });
    expect(r.diffPercent).toBeCloseTo(0.64, 1);
  });

  it('유효옵 4개 모드(루실라 echo): 빈 override → diffPercent ≈ 0', () => {
    // 루실라 echo 모드는 effective_substats가 4개(critical_rate, critical_damage, attack_percent, flat_attack).
    // substats 배열 길이 = 4이므로 substats[4]는 undefined.
    // 버그(? ? s.substats) 시: 5번째 슬롯 원본 부옵이 재합산돼 diffPercent > 0 (이중 계산).
    // 수정(? ? []) 후: 5번째 슬롯 기여 = 0 → current ≈ compared → diffPercent ≈ 0.
    const character = loadCharacters().find((c) => c.id === 'lucilla')!;
    const weapon = loadWeapons().find((w) => w.id === 'freeze_frame')!;
    const echoSet = loadEchoSets()[0]; // wishes_of_quiet_snowfall
    const ctx: CalcContext = {
      character,
      weapon,
      mainEcho: echoSet.main_slot_echoes[0],
      echoSets: [echoSet],
      costLayout: '43311',
      selectedMode: 'echo',
      slots: slotsFrom('43311',
        [
          { cost: 4, type: 'critical_damage' },
          { cost: 3, type: 'attack_percent' },
          { cost: 3, type: 'attack_percent' },
          { cost: 1, type: 'attack_percent' },
          { cost: 1, type: 'attack_percent' },
        ],
        [
          [{ type: 'critical_rate', value: 20 }],
          [{ type: 'critical_damage', value: 40 }],
          [{ type: 'attack_percent', value: 20 }],
          [{ type: 'flat_attack', value: 150 }],
          // 5번째 슬롯(index 4): effective_substats에 속하는 값을 의도적으로 배치.
          // 버그 시 substats[4]가 undefined → ?? s.substats로 이 값이 이중 합산됨.
          [{ type: 'critical_rate', value: 15 }],
        ]),
      conditionalToggles: {
        set_5pc_element: true,
        set_5pc_critical: true,
        lucilla_slowmo_echo: true,
        lucilla_lib_echo: true,
        lucilla_zoom_critdmg: true,
      },
      manualBuffs: [],
    };
    const r = compareSubstats(ctx, {});
    expect(r.diffPercent).toBeCloseTo(0, 6);
  });
});
