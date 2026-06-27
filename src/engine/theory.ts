import type { StatKey, Cost } from '../types/domain';
import type { CalcContext, MainPrimaryPick } from './context';
import { buildPerfInput, sumEffectiveSubstats } from './build';
import { computePerf } from './perf';
import { COST_LAYOUTS, MAIN_PRIMARY, substatMaxStage, substatFourthFromBottom } from './constants';

export interface TheoryResult {
  perf: number;
  subAllocation: Partial<Record<StatKey, number>>; // 줄 수
  mainPicks: MainPrimaryPick[];                     // 슬롯별 메인 선택(표시는 UI에서 한글화)
  threeCoMode: 'soksok' | 'sokgong' | 'gonggong';
}

/** 해당 슬롯 코스트에서 가능한 메인 옵션 키 목록 (딜 관련만) */
function mainOptionsFor(cost: Cost): StatKey[] {
  const all = Object.keys(MAIN_PRIMARY[cost]) as StatKey[];
  // 딜 관련: attack_percent, element_damage_bonus, critical_rate, critical_damage
  const dealKeys: StatKey[] = ['attack_percent', 'element_damage_bonus', 'critical_rate', 'critical_damage'];
  return all.filter((k) => dealKeys.includes(k));
}

/** 메인 선택 조합 전수 생성 */
function* mainCombos(layout: Cost[]): Generator<MainPrimaryPick[]> {
  function* rec(i: number, acc: MainPrimaryPick[]): Generator<MainPrimaryPick[]> {
    if (i === layout.length) { yield acc; return; }
    for (const type of mainOptionsFor(layout[i])) {
      yield* rec(i + 1, [...acc, { cost: layout[i], type }]);
    }
  }
  yield* rec(0, []);
}

/** 유효옵 줄 배분 (각 0~5, 합 = totalLines) 전수 */
function* subAllocations(keys: StatKey[], totalLines: number): Generator<number[]> {
  function* rec(idx: number, remaining: number, acc: number[]): Generator<number[]> {
    if (idx === keys.length - 1) {
      if (remaining >= 0 && remaining <= 5) yield [...acc, remaining];
      return;
    }
    for (let n = 0; n <= 5; n++) {
      if (n > remaining) break;
      yield* rec(idx + 1, remaining - n, [...acc, n]);
    }
  }
  yield* rec(0, totalLines, []);
}

function threeCoModeOf(picks: MainPrimaryPick[]): 'soksok' | 'sokgong' | 'gonggong' {
  const threeCo = picks.filter((p) => p.cost === 3);
  const ele = threeCo.filter((p) => p.type === 'element_damage_bonus').length;
  if (ele === 2) return 'soksok';
  if (ele === 1) return 'sokgong';
  return 'gonggong';
}

/**
 * 전제형 캐릭터가 필요 공효에 도달하기 위한 최소 부옵 줄 수 (공효 최고 단계 기준). 딜전환형/미입력은 0.
 * 입력 해석: 100% 미만 → 에코로 늘리는 공효 증가분, 100% 이상 → 토탈 공효(기본 100% 포함)이므로 에코 기여분 = 값 − 100.
 */
export function energyRegenLines(ctx: CalcContext): number {
  if (ctx.character.energy_regen_mode !== 'premise') return 0;
  const req = ctx.requiredEnergyRegen;
  if (req == null) return 0;
  const echoER = req >= 100 ? req - 100 : req;
  return Math.min(25, Math.max(0, Math.ceil(echoER / substatMaxStage('energy_regen'))));
}

export function theoryBest(ctx: CalcContext): TheoryResult {
  const layout: Cost[] = COST_LAYOUTS[ctx.costLayout];
  const keys = ctx.character.effective_substats;
  // 전제형: 필요 공효 도달 최소 줄 수만큼 딜 슬롯 차감
  const totalLines = 25 - energyRegenLines(ctx);

  let best: TheoryResult | null = null;
  const combos = [...mainCombos(layout)];

  for (const alloc of subAllocations(keys, totalLines)) {
    // 이 배분으로 부옵 substats 구성 (각 유효옵 = 줄수 × max단계)
    const substats: CalcContext['substats'] = keys.map((k, idx) => {
      const lines = alloc[idx];
      return lines > 0 ? [{ type: k, value: lines * substatMaxStage(k) }] : [];
    });
    for (const picks of combos) {
      const trial: CalcContext = { ...ctx, mainPrimary: picks, substats };
      const perf = computePerf(buildPerfInput(trial));
      if (!best || perf > best.perf) {
        const subAllocation: Partial<Record<StatKey, number>> = {};
        keys.forEach((k, idx) => { subAllocation[k] = alloc[idx]; });
        best = { perf, subAllocation, mainPicks: picks, threeCoMode: threeCoModeOf(picks) };
      }
    }
  }
  return best!;
}

export function theoryRatio(ctx: CalcContext): number {
  const mine = computePerf(buildPerfInput(ctx));
  return mine / theoryBest(ctx).perf;
}

export type ThreeCoMode = 'soksok' | 'sokgong' | 'gonggong';

/** 크크작 분모 컨텍스트: 크리5+크피5(밑4번째), 메인은 4코 크피·1코 공%·3코 모드별 */
function kkjakCtx(ctx: CalcContext, mode: ThreeCoMode): CalcContext {
  const layout: Cost[] = COST_LAYOUTS[ctx.costLayout];
  const crit = substatFourthFromBottom('critical_rate') * 5;       // %
  const cd = substatFourthFromBottom('critical_damage') * 5;       // %
  const substats: CalcContext['substats'] = [
    [{ type: 'critical_rate', value: crit }],
    [{ type: 'critical_damage', value: cd }],
    [], [], [],
  ];
  // 분모 메인: 4코→크피, 3코→모드별, 1코→공%
  const mainPrimary: MainPrimaryPick[] = layout.map((cost) => {
    if (cost === 4) return { cost, type: 'critical_damage' as StatKey };
    if (cost === 1) return { cost, type: 'attack_percent' as StatKey };
    // 3코
    if (mode === 'soksok') return { cost, type: 'element_damage_bonus' as StatKey };
    if (mode === 'gonggong') return { cost, type: 'attack_percent' as StatKey };
    // sokgong: 첫 3코는 속피, 둘째는 공% (호출 순서로 분배)
    return { cost, type: 'element_damage_bonus' as StatKey };
  });
  // sokgong 보정: 3코가 둘이면 둘째를 공%로
  if (mode === 'sokgong') {
    let seen = 0;
    for (const p of mainPrimary) {
      if (p.cost === 3) { seen++; if (seen === 2) p.type = 'attack_percent'; }
    }
  }
  return { ...ctx, mainPrimary, substats };
}

export function kkjakPerf(ctx: CalcContext, mode: ThreeCoMode): number {
  return computePerf(buildPerfInput(kkjakCtx(ctx, mode)));
}

export function kkjakRatio(ctx: CalcContext, mode: ThreeCoMode): number {
  return computePerf(buildPerfInput(ctx)) / kkjakPerf(ctx, mode);
}

export function optimalThreeCoMode(ctx: CalcContext): ThreeCoMode {
  return theoryBest(ctx).threeCoMode;
}

export interface RecoRow { label: string; relative: number; best: boolean }
export interface RecoGroup { label: string; theory: RecoRow[]; kkjak: RecoRow[] }

/** 한 메인 조합(고정 슬롯 + 가변 슬롯)에서 이론최고 부옵 / 크크작 부옵의 통합 성능 */
function perfWithMain(ctx: CalcContext, picks: MainPrimaryPick[], sub: CalcContext['substats']): number {
  return computePerf(buildPerfInput({ ...ctx, mainPrimary: picks, substats: sub }));
}

function bestSubAllocationPerf(ctx: CalcContext, picks: MainPrimaryPick[]): number {
  const keys = ctx.character.effective_substats;
  const total = 25 - energyRegenLines(ctx);
  let best = 0;
  for (const alloc of subAllocations(keys, total)) {
    const sub: CalcContext['substats'] = keys.map((k, idx) =>
      alloc[idx] > 0 ? [{ type: k, value: alloc[idx] * substatMaxStage(k) }] : []);
    const p = perfWithMain(ctx, picks, sub);
    if (p > best) best = p;
  }
  return best;
}

function kkjakSub(): CalcContext['substats'] {
  const crit = substatFourthFromBottom('critical_rate') * 5;
  const cd = substatFourthFromBottom('critical_damage') * 5;
  return [[{ type: 'critical_rate', value: crit }], [{ type: 'critical_damage', value: cd }], [], [], []];
}

function rows(entries: [string, number][]): RecoRow[] {
  const max = Math.max(...entries.map((e) => e[1]));
  return entries
    .slice()
    .sort((a, b) => b[1] - a[1])
    .map(([label, v]) => ({ label, relative: v / max, best: Math.abs(v - max) < 1e-6 }));
}

/** 43311: 4코 메인 그룹 + 3코 조합 그룹. 44111: 4코 조합 그룹. */
export function mainRecommendation(ctx: CalcContext): RecoGroup[] {
  const layout: Cost[] = COST_LAYOUTS[ctx.costLayout];
  const groups: RecoGroup[] = [];

  if (ctx.costLayout === '43311') {
    // 그룹1: 4코 메인 비교 (3코 속속·1코 공% 고정)
    const g1: [string, MainPrimaryPick[]][] = (['critical_damage', 'critical_rate', 'attack_percent'] as StatKey[])
      .map((t4) => [
        t4 === 'critical_damage' ? '크피' : t4 === 'critical_rate' ? '크리' : '공%',
        layout.map((cost, i) => ({ cost, type: i === 0 ? t4 : cost === 3 ? 'element_damage_bonus' : 'attack_percent' })),
      ]);
    groups.push({
      label: '4코 메인',
      theory: rows(g1.map(([n, p]) => [n, bestSubAllocationPerf(ctx, p)])),
      kkjak: rows(g1.map(([n, p]) => [n, perfWithMain(ctx, p, kkjakSub())])),
    });
    // 그룹2: 3코 조합 비교 (4코 크피·1코 공% 고정)
    const threeCombos: [string, StatKey[]][] = [
      ['속속', ['element_damage_bonus', 'element_damage_bonus']],
      ['속공', ['element_damage_bonus', 'attack_percent']],
      ['공공', ['attack_percent', 'attack_percent']],
    ];
    const g2: [string, MainPrimaryPick[]][] = threeCombos.map(([n, threes]) => {
      let ti = 0;
      const picks = layout.map((cost) => ({
        cost,
        type: cost === 4 ? 'critical_damage' as StatKey : cost === 1 ? 'attack_percent' as StatKey : threes[ti++],
      }));
      return [n, picks];
    });
    groups.push({
      label: '3코 조합',
      theory: rows(g2.map(([n, p]) => [n, bestSubAllocationPerf(ctx, p)])),
      kkjak: rows(g2.map(([n, p]) => [n, perfWithMain(ctx, p, kkjakSub())])),
    });
  } else {
    // 44111: 4코 두 슬롯 조합 비교 (1코 공% 고정)
    const fourCombos: [string, StatKey[]][] = [
      ['크피+크피', ['critical_damage', 'critical_damage']],
      ['크피+크리', ['critical_damage', 'critical_rate']],
      ['크피+공%', ['critical_damage', 'attack_percent']],
      ['크리+크리', ['critical_rate', 'critical_rate']],
      ['크리+공%', ['critical_rate', 'attack_percent']],
      ['공%+공%', ['attack_percent', 'attack_percent']],
    ];
    const g: [string, MainPrimaryPick[]][] = fourCombos.map(([n, fours]) => {
      let fi = 0;
      const picks = layout.map((cost) => ({
        cost, type: cost === 4 ? fours[fi++] : 'attack_percent' as StatKey,
      }));
      return [n, picks];
    });
    groups.push({
      label: '4코 조합',
      theory: rows(g.map(([n, p]) => [n, bestSubAllocationPerf(ctx, p)])),
      kkjak: rows(g.map(([n, p]) => [n, perfWithMain(ctx, p, kkjakSub())])),
    });
  }
  return groups;
}

export function compareSubstats(
  ctx: CalcContext,
  override: Partial<Record<StatKey, number>>,
): { current: number; compared: number; diffPercent: number } {
  const current = computePerf(buildPerfInput(ctx));
  // 현재 유효옵 합을 한 에코에 몰아넣은 동등 컨텍스트 + override 적용
  const base = sumEffectiveSubstats(ctx);
  const merged: Partial<Record<StatKey, number>> = { ...base, ...override };
  const substats: CalcContext['substats'] = ctx.character.effective_substats.map((k) =>
    merged[k] != null ? [{ type: k, value: merged[k]! }] : []);
  const compared = computePerf(buildPerfInput({ ...ctx, substats }));
  return { current, compared, diffPercent: (compared / current - 1) * 100 };
}

/** 크크작 기준 부옵(크리5+크피5)에서 통합 성능을 최대화하는 메인 옵션 조합(추천) */
export function recommendedMainPicks(ctx: CalcContext): MainPrimaryPick[] {
  const layout: Cost[] = COST_LAYOUTS[ctx.costLayout];
  const sub = kkjakSub();
  let best: { perf: number; picks: MainPrimaryPick[] } | null = null;
  for (const picks of mainCombos(layout)) {
    const perf = computePerf(buildPerfInput({ ...ctx, mainPrimary: picks, substats: sub }));
    if (!best || perf > best.perf) best = { perf, picks };
  }
  return best!.picks;
}
