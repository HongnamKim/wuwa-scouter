import { describe, it, expect } from 'vitest';
import { erConstrained, threeCoModeOptions, optimalThreeCoModeKkjak, mainRecommendation, twoPieceRecommendationGroups } from '../../src/engine/theory';
import { loadCharacters, loadWeapons, loadEchoSets } from '../../src/engine/loadData';
import { slotsFrom } from '../../src/engine/echoSlots';
import type { CalcContext, MainPrimaryPick } from '../../src/engine/context';
import { theoryBest } from '../../src/engine/theory';
import { computeEnergyRegen } from '../../src/engine/build';
import { costsOf } from '../../src/engine/costLayout';
import { MAIN_PRIMARY } from '../../src/engine/constants';
import type { Cost, StatKey } from '../../src/types/domain';

/** 지정 캐릭터의 최소 CalcContext (전용무기·추천세트·추천 메인에코, 요구공효=req). */
function ctxFor(id: string, req: number | null): CalcContext {
  const character = loadCharacters().find((c) => c.id === id)!;
  const weapon = loadWeapons().find((w) => w.id === (character.signature_weapon ?? character.recommended_weapons[0]))!;
  const echoSet = loadEchoSets().find((s) => s.id === character.recommended_echo_sets[0])!;
  const mainEcho = echoSet.main_slot_echoes.find((m) => character.recommended_main_echo.includes(m.id))
    ?? echoSet.main_slot_echoes[0];
  return {
    character, weapon, mainEcho, echoSets: [echoSet],
    costLayout: '43311',
    slots: slotsFrom('43311', [], []),
    conditionalToggles: {}, manualBuffs: [],
    requiredEnergyRegen: req as number, ascensionLevel: 0, refinementLevel: 1,
  };
}

describe('erConstrained', () => {
  it('요구공효 있는 buff_conversion 서포터(수수)는 true', () => {
    expect(erConstrained(ctxFor('suisui', 260))).toBe(true);
  });
  it('전제형(양양)은 false', () => {
    expect(erConstrained(ctxFor('yangyang_xuanling', 125))).toBe(false);
  });
  it('요구공효 null이면 false', () => {
    expect(erConstrained(ctxFor('suisui', null))).toBe(false);
  });
});

describe('theoryBest — 서포터 ER-우선', () => {
  it('수수 최고점 빌드는 요구 공효(260%)를 도달한다', () => {
    const ctx = ctxFor('suisui', 260);
    const best = theoryBest(ctx);
    // 최고점 빌드로 슬롯을 구성해 실제 공효 계산
    const built = { ...ctx, slots: slotsFrom(ctx.costLayout, best.mainPicks,
      // subAllocation → 부옵 줄(전부 슬롯0)
      [Object.entries(best.subAllocation)
        .filter(([, n]) => (n ?? 0) > 0)
        .map(([k, n]) => ({ type: k as any, value: (n as number) * substatMaxStageFor(k) }))]) };
    expect(computeEnergyRegen(built) * 100).toBeGreaterThanOrEqual(260 - 1e-6);
  });

  it('요구 공효를 낮추면(150%) 공효 부옵 예약이 줄어 딜이 오른다', () => {
    const hi = theoryBest(ctxFor('suisui', 260));
    const lo = theoryBest(ctxFor('suisui', 150));
    expect(lo.perf).toBeGreaterThan(hi.perf); // 공효 부담↓ → 딜 줄↑
  });

  it('요구 공효가 일부 메인 조합에서는 도달 불가능할 만큼 높으면(300%) 공효 도달을 딜보다 우선한다', () => {
    // req=300: 메인 조합별 "부옵을 공효 물리적 상한(에코당 1줄, 최대 5줄)까지 투입했을 때의 최대 공효(도달 상한)"가
    // 조합마다 다르며(수수 43311: 약 249%~313%), 일부 조합은 300 미만(도달 불가), 일부는 300 이상(도달 가능)이다.
    // 최고점 빌드는 (erMet, perf) 사전식 정렬에 따라 도달 가능한 조합 중에서 선택되어야 한다.
    // flat perf 비교(수정 전)로는 perf가 더 높은 '도달 불가' 조합을 반환할 수 있다.
    const req = 300;
    const ctx = ctxFor('suisui', req);
    const best = theoryBest(ctx);
    const builtBest: CalcContext = {
      ...ctx,
      slots: slotsFrom(ctx.costLayout, best.mainPicks,
        [Object.entries(best.subAllocation)
          .filter(([, n]) => (n ?? 0) > 0)
          .map(([k, n]) => ({ type: k as any, value: (n as number) * substatMaxStageFor(k) }))]),
    };
    const achievedEr = computeEnergyRegen(builtBest) * 100;

    // 모든 메인 조합에 대해 부옵을 공효 물리적 상한(에코당 1줄, 최대 echoCount줄)까지 투입했을 때의
    // 최대 공효(도달 상한)를 계산. (에코 1개당 같은 부옵 타입은 최대 1줄뿐이므로 echoCount줄이 진짜 상한)
    const layout = costsOf(ctx.costLayout);
    const echoCount = layout.length;
    const erStage = substatMaxStageFor('energy_regen');
    let maxAchievable = -Infinity;
    for (const picks of allMainCombos(layout)) {
      const maxCtx: CalcContext = {
        ...ctx,
        slots: slotsFrom(ctx.costLayout, picks, [[{ type: 'energy_regen', value: echoCount * erStage }]]),
      };
      const maxEr = computeEnergyRegen(maxCtx) * 100;
      if (maxEr > maxAchievable) maxAchievable = maxEr;
    }
    // 요구치(300) 자체가 최대 도달 상한을 넘지 않는(=도달 가능한 조합이 존재하는) 전제 확인.
    expect(maxAchievable).toBeGreaterThanOrEqual(req);
    // 최고점 빌드는 요구 공효(300)에 도달해야 한다 — 도달 불가 조합(딜은 더 높을 수 있음)을 골라서는 안 된다.
    expect(achievedEr).toBeGreaterThanOrEqual(req - 1e-6);
  });

  it('공효 부옵 예약은 에코당 1줄(최대 5줄)을 넘지 않는다 — 6줄 예약은 물리적으로 불가능', () => {
    const best = theoryBest(ctxFor('suisui', 260));
    expect(best.subAllocation['energy_regen'] ?? 0).toBeLessThanOrEqual(5);
    Object.values(best.subAllocation).forEach((n) => expect(n).toBeLessThanOrEqual(5));
  });
});

describe('크크작 — 서포터 ER-우선', () => {
  it('수수(43311)에 공효 모드(공효공효 등)가 노출된다', () => {
    const opts = threeCoModeOptions(ctxFor('suisui', 260)).map((o) => o.value);
    // KKJAK_MODES는 모듈 비공개라 .er 필드를 직접 볼 수 없음 — 타입 정의(ThreeCoMode)상
    // 3코 ER 계열 모드는 모두 'er_' 접두사로 명명되므로(er_sok/er_gong/er_er), 접두사로 노출 여부 확인.
    expect(opts.some((m) => m.startsWith('er_'))).toBe(true);
  });

  it('최적 크크작 모드는 공효 도달 모드를 고른다(공효 미도달 딜-최대 모드가 아님)', () => {
    // 수수(43311, req=260)의 크크작 고정 부옵 기준 각 모드 ER: soksok/sokgong/gonggong ≈ 199.48%(모두 도달 불가),
    // er_sok/er_gong ≈ 231.48%(도달 불가), er_er ≈ 263.48%(유일하게 도달). → 딜이 가장 높은 모드는 soksok이지만
    // 요구 공효(260%)에 도달하는 모드는 er_er뿐이므로, ER-우선 선택은 er_er을 골라야 한다.
    const ctx = ctxFor('suisui', 260);
    const mode = optimalThreeCoModeKkjak(ctx)!;
    expect(mode.startsWith('er_')).toBe(true);
  });
});

// 메인 조합 전수 생성(테스트 전용, src/engine/theory.ts의 mainOptionsFor/mainCombos와 동일한 딜 관련 키 목록 사용).
const DEAL_KEYS: StatKey[] = ['attack_percent', 'element_damage_bonus', 'critical_rate', 'critical_damage', 'energy_regen'];
function mainOptionsForCost(cost: Cost): StatKey[] {
  return (Object.keys(MAIN_PRIMARY[cost]) as StatKey[]).filter((k) => DEAL_KEYS.includes(k));
}
function* allMainCombos(layout: Cost[]): Generator<MainPrimaryPick[]> {
  function* rec(i: number, acc: MainPrimaryPick[]): Generator<MainPrimaryPick[]> {
    if (i === layout.length) { yield acc; return; }
    for (const type of mainOptionsForCost(layout[i])) yield* rec(i + 1, [...acc, { cost: layout[i], type }]);
  }
  yield* rec(0, []);
}

import { substatMaxStage } from '../../src/engine/constants';
function substatMaxStageFor(k: string): number { return substatMaxStage(k as any); }

describe('mainRecommendation — 서포터 ER-우선 추천 표', () => {
  it('수수 3코 조합 표의 크크작 best는 점수의 최적 크크작 모드와 일치', () => {
    const ctx = ctxFor('suisui', 260);
    const groups = mainRecommendation(ctx);
    const g3 = groups.find((g) => g.label === '3코 조합')!;
    const bestKkjak = g3.kkjak.find((r) => r.best)!;
    const optMode = optimalThreeCoModeKkjak(ctx)!;
    const optLabel = threeCoModeOptions(ctx).find((o) => o.value === optMode)!.label;
    expect(bestKkjak.label).toBe(optLabel); // 표의 ★ = 점수가 고른 모드(공효공효)
  });

  it('수수 3코 조합 표의 크크작 best는 공효(ER) 모드다(속속 아님)', () => {
    const ctx = ctxFor('suisui', 260);
    const g3 = mainRecommendation(ctx).find((g) => g.label === '3코 조합')!;
    const bestKkjak = g3.kkjak.find((r) => r.best)!;
    // 공효공효(er_er) 라벨은 '공효'를 포함(속속/속공/공공 아님)
    expect(bestKkjak.label.includes('공효')).toBe(true);
  });

  it('양양(전제형)은 추천 표가 불변 — best 크크작 모드가 공효 모드가 아니다', () => {
    const ctx = ctxFor('yangyang_xuanling', 125);
    const g3 = mainRecommendation(ctx).find((g) => g.label === '3코 조합')!;
    const bestKkjak = g3.kkjak.find((r) => r.best)!;
    expect(bestKkjak.label.includes('공효')).toBe(false);
    // 상대% 최대(=1.0)에 best가 붙는 기존 의미 유지(딜 최대)
    expect(Math.max(...g3.kkjak.map((r) => r.relative))).toBeCloseTo(1.0, 6);
  });
});

describe('mainRecommendation — 도달 불가 3코 경고 표기(숨기지 않음)', () => {
  it('수수 3코 조합 크크작: 도달(공효공효)은 reached=true, 미도달(공효속·공효공)은 표시되되 reached=false', () => {
    const g3 = mainRecommendation(ctxFor('suisui', 260)).find((g) => g.label === '3코 조합')!;
    const by = Object.fromEntries(g3.kkjak.map((r) => [r.label, r]));
    expect(by['공효공효']?.reached).toBe(true);      // 유일 도달
    expect(by['공효속']).toBeDefined();               // 숨기지 않음
    expect(by['공효속']?.reached).toBe(false);        // 경고 표기
    expect(by['공효체']?.reached).toBe(false);        // (구 '공효공', hp 계수 → 체로 치환)
  });

  it('수수 3코 조합 최고점: 속속은 표시되되 reached=false, 공효 계열은 reached=true', () => {
    const g3 = mainRecommendation(ctxFor('suisui', 260)).find((g) => g.label === '3코 조합')!;
    const by = Object.fromEntries(g3.theory.map((r) => [r.label, r]));
    expect(by['속속']).toBeDefined();
    expect(by['속속']?.reached).toBe(false);
    expect(by['공효속']?.reached).toBe(true);
  });

  it('양양(전제형)은 reached 미설정(경고 없음)', () => {
    const g3 = mainRecommendation(ctxFor('yangyang_xuanling', 125)).find((g) => g.label === '3코 조합')!;
    expect(g3.kkjak.every((r) => r.reached === undefined)).toBe(true);
  });

  it('수수 4코 메인 그룹은 도달 경고를 달지 않는다(reached 미설정)', () => {
    const groups = mainRecommendation(ctxFor('suisui', 260));
    const g4 = groups.find((g) => g.label === '4코 메인')!;
    expect(g4.theory.every((r) => r.reached === undefined)).toBe(true);
    expect(g4.kkjak.every((r) => r.reached === undefined)).toBe(true);
  });
});

describe('mainRecommendation — 캐릭터 계수 스탯(scale_stat)에 맞춘 메인', () => {
  it('수수(hp 계수) 4코 메인 옵션은 공격%가 아니라 체(HP%)를 포함', () => {
    const g4 = mainRecommendation(ctxFor('suisui', 260)).find((g) => g.label === '4코 메인')!;
    const labels = g4.theory.map((r) => r.label);
    expect(labels).toContain('체');   // HP% 옵션
    expect(labels).not.toContain('공'); // 공격% 옵션 없음
  });

  it('모니에(방어 계수) 3코 조합 라벨에 방(방어%)이 나온다', () => {
    const opts = threeCoModeOptions(ctxFor('mornye', 260)).map((o) => o.label);
    expect(opts.some((l) => l.includes('방'))).toBe(true);
    expect(opts.some((l) => l.includes('공') && !l.includes('공효'))).toBe(false);
  });
});

/** 자유 2세트 슬롯을 만드는 ctx (예: 3세트 세트를 주 세트로). */
function ctxWithFreeTwoPiece(id: string, req: number, setId: string): CalcContext {
  const base = ctxFor(id, req);
  const set = loadEchoSets().find((s) => s.id === setId)!;
  return { ...base, echoSets: [set] };
}

describe('twoPieceRecommendationGroups — 서포터 ER 정렬', () => {
  it('자유 슬롯 세트에서 수수 2세트 표가 뜨고 rowsEr 적용(reached 설정됨)', () => {
    const ctx = ctxWithFreeTwoPiece('suisui', 260, 'thread_of_severed_fate');
    const g = twoPieceRecommendationGroups(ctx);
    expect(g).not.toBeNull();
    expect(g!.theory.every((r) => typeof r.reached === 'boolean')).toBe(true);
    expect(g!.kkjak.every((r) => typeof r.reached === 'boolean')).toBe(true);
  });

  it('비-erConstrained(공격형)은 reached 미설정(기존 rows)', () => {
    const ctx = ctxWithFreeTwoPiece('yangyang_xuanling', 125, 'thread_of_severed_fate');
    const g = twoPieceRecommendationGroups(ctx);
    if (g) expect(g.theory.every((r) => r.reached === undefined)).toBe(true);
  });
});
