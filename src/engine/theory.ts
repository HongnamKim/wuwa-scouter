import type { StatKey, Cost, CostLayout } from '../types/domain';
import type { CalcContext, MainPrimaryPick } from './context';
import { buildPerfInput, sumEffectiveSubstats } from './build';
import { computePerf } from './perf';
import { COST_LAYOUTS, MAIN_PRIMARY, substatMaxStage, substatFourthFromBottom } from './constants';
import { hasEnergyConversion } from './mechanisms';
import { loadTwoPieceEffects } from './loadData';
import { freeTwoPieceSlots } from './echoSlots';

// 크크작 시 평균적으로 따라오는 공명효율(%). 30만건 시뮬레이션 평균(약 1.37줄 ≈ 13.1%).
// ER 전환형 캐릭터의 크크작 분모에만 반영한다.
const KKJAK_ENERGY_REGEN = 13.1;

export type ThreeCoMode =
  | 'soksok' | 'sokgong' | 'gonggong' | 'er_sok' | 'er_gong' | 'er_er'  // 43311: 3코 가변
  | 'four_cc' | 'four_ccr' | 'four_cca' | 'four_crcr' | 'four_cra' | 'four_aa'; // 44111: 4코 가변

// 크크작 조합 모드: 라벨 + 가변 슬롯에 넣을 메인 옵션 페어 + 적용 레이아웃. er=공효 포함(전환형 전용)
// 43311은 3코 두 슬롯이 가변(4코=크피·1코=공% 고정), 44111은 4코 두 슬롯이 가변(1코=공% 고정).
const KKJAK_MODES: Record<ThreeCoMode, { label: string; pair: [StatKey, StatKey]; layout: CostLayout; er: boolean }> = {
  soksok: { label: '속속', pair: ['element_damage_bonus', 'element_damage_bonus'], layout: '43311', er: false },
  sokgong: { label: '속공', pair: ['element_damage_bonus', 'attack_percent'], layout: '43311', er: false },
  gonggong: { label: '공공', pair: ['attack_percent', 'attack_percent'], layout: '43311', er: false },
  er_sok: { label: '공효속', pair: ['energy_regen', 'element_damage_bonus'], layout: '43311', er: true },
  er_gong: { label: '공효공', pair: ['energy_regen', 'attack_percent'], layout: '43311', er: true },
  er_er: { label: '공효공효', pair: ['energy_regen', 'energy_regen'], layout: '43311', er: true },
  four_cc: { label: '크피+크피', pair: ['critical_damage', 'critical_damage'], layout: '44111', er: false },
  four_ccr: { label: '크피+크리', pair: ['critical_damage', 'critical_rate'], layout: '44111', er: false },
  four_cca: { label: '크피+공%', pair: ['critical_damage', 'attack_percent'], layout: '44111', er: false },
  four_crcr: { label: '크리+크리', pair: ['critical_rate', 'critical_rate'], layout: '44111', er: false },
  four_cra: { label: '크리+공%', pair: ['critical_rate', 'attack_percent'], layout: '44111', er: false },
  four_aa: { label: '공%+공%', pair: ['attack_percent', 'attack_percent'], layout: '44111', er: false },
};

/** 코스트 구성별 선택 가능한 크크작 조합 모드 (43311=3코 조합, 44111=4코 조합; ER 전환형만 공효 모드 노출) */
export function threeCoModeOptions(ctx: CalcContext): { value: ThreeCoMode; label: string }[] {
  const erChar = hasEnergyConversion(ctx.character.special_mechanism);
  return (Object.keys(KKJAK_MODES) as ThreeCoMode[])
    .filter((m) => KKJAK_MODES[m].layout === ctx.costLayout && (erChar || !KKJAK_MODES[m].er))
    .map((m) => ({ value: m, label: KKJAK_MODES[m].label }));
}

/** 가변 슬롯 코스트 (43311→3코, 44111→4코) */
function variableCost(layout: CostLayout): Cost {
  return layout === '44111' ? 4 : 3;
}

/** 모드에 해당하는 전체 메인 옵션 구성 (가변 슬롯=모드 페어, 4코 고정=크피[43311], 1코 고정=공%) */
function kkjakModePicks(ctx: CalcContext, mode: ThreeCoMode): MainPrimaryPick[] {
  const layout: Cost[] = COST_LAYOUTS[ctx.costLayout];
  const varCost = variableCost(ctx.costLayout);
  const pair = KKJAK_MODES[mode].pair;
  let ti = 0;
  return layout.map((cost) => {
    if (cost === varCost) return { cost, type: pair[ti++] };
    if (cost === 4) return { cost, type: 'critical_damage' as StatKey };
    return { cost, type: 'attack_percent' as StatKey };
  });
}

export interface TheoryResult {
  perf: number;
  subAllocation: Partial<Record<StatKey, number>>; // 줄 수
  mainPicks: MainPrimaryPick[];                     // 슬롯별 메인 선택(표시는 UI에서 한글화)
  threeCoMode: ThreeCoMode;
}

/** 해당 슬롯 코스트에서 가능한 메인 옵션 키 목록 (딜 관련만) */
function mainOptionsFor(cost: Cost): StatKey[] {
  const all = Object.keys(MAIN_PRIMARY[cost]) as StatKey[];
  // 딜 관련: attack_percent, element_damage_bonus, critical_rate, critical_damage
  const dealKeys: StatKey[] = ['attack_percent', 'element_damage_bonus', 'critical_rate', 'critical_damage', 'energy_regen'];
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

function threeCoModeOf(ctx: CalcContext, picks: MainPrimaryPick[]): ThreeCoMode {
  const varCost = variableCost(ctx.costLayout);
  const vars = picks.filter((p) => p.cost === varCost).map((p) => p.type).sort();
  const opts = threeCoModeOptions(ctx);
  for (const o of opts) {
    const pair = [...KKJAK_MODES[o.value].pair].sort();
    if (vars.length === pair.length && vars.every((t, i) => t === pair[i])) return o.value;
  }
  return opts[0].value;
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
        best = { perf, subAllocation, mainPicks: picks, threeCoMode: threeCoModeOf(ctx, picks) };
      }
    }
  }
  return best!;
}

export function theoryRatio(ctx: CalcContext): number {
  const mine = computePerf(buildPerfInput(ctx));
  return mine / theoryBest(ctx).perf;
}

/** 크크작 분모 컨텍스트: 크리5+크피5(밑4번째) + (전환형) 평균 공효, 메인은 모드별 구성 */
function kkjakCtx(ctx: CalcContext, mode: ThreeCoMode): CalcContext {
  return { ...ctx, mainPrimary: kkjakModePicks(ctx, mode), substats: kkjakSub(ctx) };
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

interface ModeGroupArgs { ctx: CalcContext; label: string }
/** 가변 슬롯(43311=3코, 44111=4코) 모드 조합 비교 그룹 */
function modeGroup({ ctx, label }: ModeGroupArgs): RecoGroup {
  const combos: [string, MainPrimaryPick[]][] = threeCoModeOptions(ctx)
    .map((o) => [o.label, kkjakModePicks(ctx, o.value)]);
  return {
    label,
    theory: rows(combos.map(([n, p]) => [n, bestSubAllocationPerf(ctx, p)])),
    kkjak: rows(combos.map(([n, p]) => [n, perfWithMain(ctx, p, kkjakSub(ctx))])),
  };
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

function kkjakSub(ctx: CalcContext): CalcContext['substats'] {
  const crit = substatFourthFromBottom('critical_rate') * 5;
  const cd = substatFourthFromBottom('critical_damage') * 5;
  // ER 전환형은 크크작 시 따라오는 평균 공명효율(13.1%)을 분모에 반영
  const erLine: CalcContext['substats'][number] = hasEnergyConversion(ctx.character.special_mechanism)
    ? [{ type: 'energy_regen', value: KKJAK_ENERGY_REGEN }]
    : [];
  return [[{ type: 'critical_rate', value: crit }], [{ type: 'critical_damage', value: cd }], erLine, [], []];
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
  // 메인(3코/4코) 추천의 변수는 메인 옵션뿐. 별도로 추천되는 2세트 효과는 입력에서 제외(고정 []).
  // → 보조 2세트 효과 선택을 바꿔도 메인 조합 추천은 불변.
  const c: CalcContext = { ...ctx, twoPiecePicks: [] };
  const layout: Cost[] = COST_LAYOUTS[c.costLayout];
  const groups: RecoGroup[] = [];

  if (c.costLayout === '43311') {
    // 그룹1: 4코 메인 비교 (3코 속속·1코 공% 고정)
    const g1: [string, MainPrimaryPick[]][] = (['critical_damage', 'critical_rate', 'attack_percent'] as StatKey[])
      .map((t4) => [
        t4 === 'critical_damage' ? '크피' : t4 === 'critical_rate' ? '크리' : '공%',
        layout.map((cost, i) => ({ cost, type: i === 0 ? t4 : cost === 3 ? 'element_damage_bonus' : 'attack_percent' })),
      ]);
    groups.push({
      label: '4코 메인',
      theory: rows(g1.map(([n, p]) => [n, bestSubAllocationPerf(c, p)])),
      kkjak: rows(g1.map(([n, p]) => [n, perfWithMain(c, p, kkjakSub(c))])),
    });
    // 그룹2: 3코 조합 비교 (ER 전환형은 공효 모드 포함)
    groups.push(modeGroup({ ctx: c, label: '3코 조합' }));
  } else {
    // 44111: 4코 두 슬롯 조합 비교 (1코 공% 고정)
    groups.push(modeGroup({ ctx: c, label: '4코 조합' }));
  }
  return groups;
}

// ===== 자유 2세트 효과 (1+2+2, 3+2) 최적 조합 =====

/** 선택한 화음 세트에서 파생된 자유 슬롯 수만큼 풀에서 중복 허용 멀티셋(조합) 전수 생성. id 배열 목록 */
function twoPieceCombos(ctx: CalcContext): string[][] {
  const n = freeTwoPieceSlots(ctx.echoSets);
  if (!n || n <= 0) return [];
  const pool = loadTwoPieceEffects();
  const out: string[][] = [];
  const rec = (start: number, acc: string[]) => {
    if (acc.length === n) { out.push([...acc]); return; }
    for (let i = start; i < pool.length; i++) rec(i, [...acc, pool[i].id]);
  };
  rec(0, []);
  return out;
}

/** 조합의 표시 라벨 (원소피해는 캐릭터 원소명으로 치환). 예: "응결+공격" */
function twoPieceComboLabel(ctx: CalcContext, combo: string[]): string {
  const pool = loadTwoPieceEffects();
  return combo
    .map((id) => {
      const e = pool.find((x) => x.id === id)!;
      return e.element_from_character ? ctx.character.element : e.label;
    })
    .join('+');
}

/** 통합 성능을 최대화하는 자유 2세트 효과 조합(풀 id 배열). 자유 슬롯 0이면 빈 배열.
 * 변수는 2세트 효과뿐 — 나머지(사용자가 선택한 버프/돌파/무기 등)는 현재 ctx 그대로 사용. */
export function optimalTwoPiecePicks(ctx: CalcContext): string[] {
  const combos = twoPieceCombos(ctx);
  if (!combos.length) return [];
  let best = combos[0];
  let bestPerf = -Infinity;
  for (const c of combos) {
    const p = computePerf(buildPerfInput({ ...ctx, twoPiecePicks: c }));
    if (p > bestPerf) { bestPerf = p; best = c; }
  }
  return best;
}

/** 자유 2세트 효과 조합별 상대 성능 추천 행 (현재 빌드 기준, 최고 ★). 자유 슬롯 0이면 빈 배열 */
export function twoPieceRecommendation(ctx: CalcContext): RecoRow[] {
  const combos = twoPieceCombos(ctx);
  if (!combos.length) return [];
  const entries: [string, number][] = combos.map((c) =>
    [twoPieceComboLabel(ctx, c), computePerf(buildPerfInput({ ...ctx, twoPiecePicks: c }))]);
  return rows(entries);
}

/**
 * 자유 2세트 효과 조합별 추천을 최고점/크크작 기준으로 분리.
 * 최고점 = 각 조합에서 이론 최고 빌드, 크크작 = 각 조합에서 크크작 기준 빌드(최적 모드). 슬롯 0이면 null.
 */
export function twoPieceRecommendationGroups(ctx: CalcContext): { theory: RecoRow[]; kkjak: RecoRow[] } | null {
  const combos = twoPieceCombos(ctx);
  if (!combos.length) return null;
  // 변수는 2세트 효과뿐: 조합별로 twoPiecePicks만 바꿔 평가(나머지는 현재 ctx 고정).
  // 2세트 선택 자체는 입력이 아니므로(조합별 override) 현재 선택과 무관. 크크작은 조합별 자체 최적 모드.
  const theory: [string, number][] = combos.map((c) => {
    const cctx = { ...ctx, twoPiecePicks: c };
    return [twoPieceComboLabel(ctx, c), theoryBest(cctx).perf];
  });
  const kkjak: [string, number][] = combos.map((c) => {
    const cctx = { ...ctx, twoPiecePicks: c };
    return [twoPieceComboLabel(ctx, c), kkjakPerf(cctx, optimalThreeCoModeKkjak(cctx))];
  });
  return { theory: rows(theory), kkjak: rows(kkjak) };
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
  const sub = kkjakSub(ctx);
  let best: { perf: number; picks: MainPrimaryPick[] } | null = null;
  for (const picks of mainCombos(layout)) {
    const perf = computePerf(buildPerfInput({ ...ctx, mainPrimary: picks, substats: sub }));
    if (!best || perf > best.perf) best = { perf, picks };
  }
  return best!.picks;
}

/**
 * 크크작 분모 기준 최적(최고 통합 성능) 조합 모드 (43311=3코, 44111=4코).
 * 추천 표의 조합 그룹과 동일하게 모드별 kkjakPerf로 비교 → 최고 모드.
 */
export function optimalThreeCoModeKkjak(ctx: CalcContext): ThreeCoMode {
  const modes = threeCoModeOptions(ctx).map((o) => o.value);
  let best = modes[0];
  let bestPerf = -Infinity;
  for (const m of modes) {
    const p = kkjakPerf(ctx, m);
    if (p > bestPerf) { bestPerf = p; best = m; }
  }
  return best;
}
