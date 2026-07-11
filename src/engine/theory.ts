import type { StatKey, Cost, CostLayout } from '../types/domain';
import type { Buff } from '../types/data';
import type { CalcContext, MainPrimaryPick, SubstatLine } from './context';
import { buildPerfInput } from './build';
import { computePerf } from './perf';
import { MAIN_PRIMARY, substatMaxStage } from './constants';
import { costsOf } from './costLayout';
import { hasEnergyConversion } from './mechanisms';
import { loadTwoPieceEffects } from './loadData';
import { freeTwoPieceSlots, slotsFrom } from './echoSlots';
import { effectiveSubstatsOf } from './mode';

// 크크작 부옵 기대 분포 (공식 확률 기반 30만 회 시뮬). 총 25줄 = 에코 5개 × 5줄.
// 크리·크피는 각 5줄 확정(평균 합). 나머지 15줄은 아래 11종에 균등(각 ~1.36줄, 평균 합).
const KKJAK_CRIT = 37.65;   // 크리티컬 5줄 평균 합(줄당 7.53%)
const KKJAK_CRIT_DMG = 75.30; // 크리티컬 피해 5줄 평균 합(줄당 15.06%)
const KKJAK_BYPRODUCT: { type: StatKey; value: number }[] = [
  { type: 'attack_percent', value: 11.68 },
  { type: 'flat_attack', value: 56.4 },
  { type: 'energy_regen', value: 12.48 },
  { type: 'resonance_liberation_bonus', value: 11.68 },
  { type: 'basic_attack_bonus', value: 11.68 },
  { type: 'heavy_attack_bonus', value: 11.68 },
  { type: 'resonance_skill_bonus', value: 11.68 },
  { type: 'hp_percent', value: 11.66 },
  { type: 'flat_hp', value: 584 },
  { type: 'defense_percent', value: 14.77 },
  { type: 'flat_defense', value: 69.9 },
];

export type ThreeCoMode =
  | 'soksok' | 'sokgong' | 'gonggong' | 'er_sok' | 'er_gong' | 'er_er'  // 43311: 3코 가변
  | 'four_cc' | 'four_ccr' | 'four_cca' | 'four_crcr' | 'four_cra' | 'four_aa'; // 44111: 4코 가변

// 명명 모드 UI를 유지하는 레이아웃. 그 외(직접 입력·41111·43111 등)는 일반형(전수 상위 N) 경로.
export const NAMED_LAYOUTS = new Set<string>(['43311', '44111']);
export function hasNamedModes(ctx: CalcContext): boolean { return NAMED_LAYOUTS.has(ctx.costLayout); }

// 크크작 조합 모드: 라벨 + 가변 슬롯에 넣을 메인 옵션(가변 슬롯 수만큼) + 적용 레이아웃. er=공효 포함(전환형 전용)
// 43311은 3코 두 슬롯이 가변(4코=크피·1코=공% 고정), 44111은 4코 두 슬롯이 가변(1코=공% 고정).
const KKJAK_MODES: Record<ThreeCoMode, { label: string; pair: StatKey[]; layout: CostLayout; er: boolean }> = {
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
  const layout: Cost[] = costsOf(ctx.costLayout);
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
  threeCoMode: ThreeCoMode | null;                  // 명명 레이아웃만; 일반형은 null
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

function threeCoModeOf(ctx: CalcContext, picks: MainPrimaryPick[]): ThreeCoMode | null {
  const opts = threeCoModeOptions(ctx);
  if (!opts.length) return null; // 일반형 레이아웃: 명명 모드 없음
  const varCost = variableCost(ctx.costLayout);
  const vars = picks.filter((p) => p.cost === varCost).map((p) => p.type).sort();
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
  // 필요 공효 중 에코로 채울 몫에서, 부옵이 아닌 '항상 얻는 공효'(세트 2세트·무기·메인에코)를 먼저 차감.
  const echoER = (req >= 100 ? req - 100 : req) - structuralEnergyRegenPercent(ctx);
  return Math.min(totalSubstatLines(ctx), Math.max(0, Math.ceil(echoER / substatMaxStage('energy_regen'))));
}

/** 부옵을 제외하고 조건 없이(always) 얻는 공명효율(%). 세트 2세트·무기 베이스/패시브·메인에코 등.
 * 조건부(스킬 발동 등) 공효는 제외 — 전제형 최소 부옵 줄 수 계산 시 확실히 보장되는 공효만 차감한다. */
function structuralEnergyRegenPercent(ctx: CalcContext): number {
  const ref = ctx.refinementLevel ?? 1;
  const echoCount = costsOf(ctx.costLayout).length;
  const uniqueSets = ctx.echoSets.filter((s, i) => ctx.echoSets.findIndex((x) => x.id === s.id) === i);
  const sources: Buff[] = [
    ...ctx.character.skill_node,
    ...ctx.mainEcho.buffs,
    ...ctx.weapon.buffs.map((b) => ({ ...b, value: b.refinement_values?.[ref - 1] ?? b.value })),
    ...uniqueSets.flatMap((s) => s.buffs),
  ];
  let er = (ctx.weapon.base_stats.energy_regen ?? 0) * 100; // 무기 베이스 공효(%)
  for (const b of sources) {
    if (b.type !== 'energy_regen' || !b.always) continue;
    if (b.set_pieces != null && b.set_pieces > echoCount) continue;        // 세트 조각 수 미충족
    if (b.target && b.target !== 'self' && b.target !== 'party') continue; // 남에게만 주는 버프 제외
    if (b.element && b.element !== '전체' && b.element !== ctx.character.element) continue;
    er += b.value * 100;
  }
  return er;
}

/** 부옵 총 줄 수 예산 = 코스트 개수 × 5 (에코 1개당 부옵 5줄). 가변 슬롯 대응. */
function totalSubstatLines(ctx: CalcContext): number {
  return costsOf(ctx.costLayout).length * 5;
}

export function theoryBest(ctx: CalcContext): TheoryResult {
  const layout: Cost[] = costsOf(ctx.costLayout);
  const keys = effectiveSubstatsOf(ctx);
  // 전제형: 필요 공효 도달 최소 줄 수만큼 딜 슬롯 차감. 유효옵 수×5(각 옵 최대 5줄)로 상한.
  const totalLines = Math.min(totalSubstatLines(ctx) - energyRegenLines(ctx), keys.length * 5);

  let best: TheoryResult | null = null;
  const combos = [...mainCombos(layout)];

  for (const alloc of subAllocations(keys, totalLines)) {
    // 이 배분으로 부옵 substats 구성 (각 유효옵 = 줄수 × max단계)
    const substats: SubstatLine[][] = keys.map((k, idx) => {
      const lines = alloc[idx];
      return lines > 0 ? [{ type: k, value: lines * substatMaxStage(k) }] : [];
    });
    for (const picks of combos) {
      const trial: CalcContext = { ...ctx, slots: slotsFrom(ctx.costLayout, picks, substats) };
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
  return { ...ctx, slots: slotsFrom(ctx.costLayout, kkjakModePicks(ctx, mode), kkjakSub(ctx)) };
}

export function kkjakPerf(ctx: CalcContext, mode: ThreeCoMode): number {
  return computePerf(buildPerfInput(kkjakCtx(ctx, mode)));
}

export function kkjakRatio(ctx: CalcContext, mode: ThreeCoMode): number {
  return computePerf(buildPerfInput(ctx)) / kkjakPerf(ctx, mode);
}

export function optimalThreeCoMode(ctx: CalcContext): ThreeCoMode | null {
  return theoryBest(ctx).threeCoMode;
}

/** 일반형 레이아웃 크크작 기준: 크크작 부옵 고정 + 메인 조합 전수 중 최고 통합 성능. */
export function kkjakBestPerf(ctx: CalcContext): number {
  const sub = kkjakSub(ctx);
  let best = 0;
  for (const picks of mainCombos(costsOf(ctx.costLayout))) {
    const p = perfWithMain(ctx, picks, sub);
    if (p > best) best = p;
  }
  return best;
}

/** 카드/비교용 크크작 기준 perf. 명명 레이아웃(43311/44111)은 기존 모드 기반, 일반형은 전수 최고. */
export function kkjakReferencePerf(ctx: CalcContext): number {
  if (!hasNamedModes(ctx)) return kkjakBestPerf(ctx);
  const mode = optimalThreeCoModeKkjak(ctx);
  return mode ? kkjakPerf(ctx, mode) : kkjakBestPerf(ctx);
}

interface ModeGroupArgs { ctx: CalcContext; label: string }
/** 가변 슬롯(43311=3코, 44111=4코) 모드 조합 비교 그룹 */
function modeGroup({ ctx, label }: ModeGroupArgs): RecoGroup {
  const combos: [string, MainPrimaryPick[]][] = threeCoModeOptions(ctx)
    .map((o) => [o.label, kkjakModePicks(ctx, o.value)]);
  return {
    label,
    theory: rows(combos.map(([n, p]) => [n, bestPerfCoOptTwoPiece(ctx, p, bestSubAllocationPerf)])),
    kkjak: rows(combos.map(([n, p]) => [n, bestPerfCoOptTwoPiece(ctx, p, (c, pp) => perfWithMain(c, pp, kkjakSub(c)))])),
  };
}

export interface RecoRow { label: string; relative: number; best: boolean }
export interface RecoGroup { label: string; theory: RecoRow[]; kkjak: RecoRow[] }

/** 한 메인 조합(고정 슬롯 + 가변 슬롯)에서 이론최고 부옵 / 크크작 부옵의 통합 성능 */
function perfWithMain(ctx: CalcContext, picks: MainPrimaryPick[], sub: SubstatLine[][]): number {
  return computePerf(buildPerfInput({ ...ctx, slots: slotsFrom(ctx.costLayout, picks, sub) }));
}

function bestSubAllocationPerf(ctx: CalcContext, picks: MainPrimaryPick[]): number {
  const keys = effectiveSubstatsOf(ctx);
  const total = Math.min(totalSubstatLines(ctx) - energyRegenLines(ctx), keys.length * 5);
  let best = 0;
  for (const alloc of subAllocations(keys, total)) {
    const sub: SubstatLine[][] = keys.map((k, idx) =>
      alloc[idx] > 0 ? [{ type: k, value: alloc[idx] * substatMaxStage(k) }] : []);
    const p = perfWithMain(ctx, picks, sub);
    if (p > best) best = p;
  }
  return best;
}

/** 메인 조합 picks 평가 시, 자유 2세트 슬롯(1+2+2·3+2)이 있으면 보조 2세트 조합까지 함께 최적화한 최고 성능.
 *  → 4코 메인 + 3코 조합 + 보조 2세트 효과를 종합 고려(상호작용 반영). 자유 슬롯 0이면 단일 평가와 동일. */
function bestPerfCoOptTwoPiece(ctx: CalcContext, picks: MainPrimaryPick[], perOne: (c: CalcContext, p: MainPrimaryPick[]) => number): number {
  const combos = twoPieceCombos(ctx);
  if (!combos.length) return perOne(ctx, picks);
  let best = 0;
  for (const tp of combos) {
    const p = perOne({ ...ctx, twoPiecePicks: tp }, picks);
    if (p > best) best = p;
  }
  return best;
}

function kkjakSub(ctx: CalcContext): SubstatLine[][] {
  const count = costsOf(ctx.costLayout).length;
  const lines = count * 5;
  // 크리·크피 각 5줄 확정. 나머지 15줄(부산물)은 에코 수에 비례 스케일(5에코=100%, 2에코=0%).
  // 슬롯 배치는 계산에 무관(타입별 합산)하므로 전부 슬롯0에 넣는다. 관련 없는 부옵은 딜에 영향 없음.
  const factor = Math.max(0, Math.min(1, (lines - 10) / 15));
  const all: SubstatLine[] = [
    { type: 'critical_rate', value: KKJAK_CRIT },
    { type: 'critical_damage', value: KKJAK_CRIT_DMG },
    ...(factor > 0 ? KKJAK_BYPRODUCT.map((s) => ({ type: s.type, value: s.value * factor })) : []),
  ];
  const slots: SubstatLine[][] = Array.from({ length: Math.max(1, count) }, () => []);
  slots[0] = all;
  return slots;
}

function rows(entries: [string, number][]): RecoRow[] {
  const max = Math.max(...entries.map((e) => e[1]));
  return entries
    .slice()
    .sort((a, b) => b[1] - a[1])
    .map(([label, v]) => ({ label, relative: v / max, best: Math.abs(v - max) < 1e-6 }));
}

// 일반형 라벨용 메인 옵션 약어
const MAIN_ABBR: Partial<Record<StatKey, string>> = {
  critical_damage: '크피', critical_rate: '크리', attack_percent: '공%',
  element_damage_bonus: '속', energy_regen: '공효', hp_percent: '체%', defense_percent: '방%',
};
/** 조합 라벨: 1코 제외, 코스트 내림차순으로 약어 이어붙임. 예: '크피·속·공' */
function comboLabel(picks: MainPrimaryPick[]): string {
  return picks.filter((p) => p.cost !== 1)
    .slice().sort((a, b) => b.cost - a.cost)
    .map((p) => MAIN_ABBR[p.type] ?? p.type).join('·');
}
/** 일반형(직접 입력 등) 메인 조합 추천: 가변 슬롯 메인 전수 → 성능순 상위 3. */
function genericMainReco(ctx: CalcContext): RecoGroup {
  // 순서만 다른 동일 조합 제거(성능 동일)
  const seen = new Set<string>();
  const uniq = [...mainCombos(costsOf(ctx.costLayout))].filter((p) => {
    const key = p.map((x) => x.cost + ':' + x.type).sort().join('|');
    if (seen.has(key)) return false; seen.add(key); return true;
  });
  return {
    label: '메인 조합',
    theory: rows(uniq.map((p) => [comboLabel(p), bestPerfCoOptTwoPiece(ctx, p, bestSubAllocationPerf)])).slice(0, 3),
    kkjak: rows(uniq.map((p) => [comboLabel(p), bestPerfCoOptTwoPiece(ctx, p, (c, pp) => perfWithMain(c, pp, kkjakSub(c)))])).slice(0, 3),
  };
}

/** 43311: 4코 메인 그룹 + 3코 조합 그룹. 44111: 4코 조합 그룹. 그 외(일반형): 전수 상위 3 단일 그룹. */
export function mainRecommendation(ctx: CalcContext): RecoGroup[] {
  // 자유 2세트 슬롯이 있으면 각 메인 조합을 보조 2세트 조합까지 함께 최적화해 평가(bestPerfCoOptTwoPiece).
  // → 4코 메인 + 3코 조합 + 보조 2세트 효과를 종합 고려. 항상 최적 보조 기준이라 사용자의 보조 선택과 무관(불변).
  const c: CalcContext = { ...ctx, twoPiecePicks: [] };
  if (!hasNamedModes(c)) return [genericMainReco(c)];
  const layout: Cost[] = costsOf(c.costLayout);
  const groups: RecoGroup[] = [];

  if (variableCost(c.costLayout) === 3) {
    // 43311·43111: 4코 메인 비교 + 3코 조합. 그룹1: 4코 메인 비교 (3코 속·1코 공% 고정)
    const g1: [string, MainPrimaryPick[]][] = (['critical_damage', 'critical_rate', 'attack_percent'] as StatKey[])
      .map((t4) => [
        t4 === 'critical_damage' ? '크피' : t4 === 'critical_rate' ? '크리' : '공%',
        layout.map((cost, i) => ({ cost, type: i === 0 ? t4 : cost === 3 ? 'element_damage_bonus' : 'attack_percent' })),
      ]);
    groups.push({
      label: '4코 메인',
      theory: rows(g1.map(([n, p]) => [n, bestPerfCoOptTwoPiece(c, p, bestSubAllocationPerf)])),
      kkjak: rows(g1.map(([n, p]) => [n, bestPerfCoOptTwoPiece(c, p, (cc, pp) => perfWithMain(cc, pp, kkjakSub(cc)))])),
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
  const n = freeTwoPieceSlots(ctx.echoSets, costsOf(ctx.costLayout).length);
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
    return [twoPieceComboLabel(ctx, c), kkjakReferencePerf(cctx)];
  });
  return { theory: rows(theory), kkjak: rows(kkjak) };
}



/**
 * 크크작 분모 기준 최적(최고 통합 성능) 조합 모드 (43311=3코, 44111=4코).
 * 추천 표의 조합 그룹과 동일하게 모드별 kkjakPerf로 비교 → 최고 모드.
 */
export function optimalThreeCoModeKkjak(ctx: CalcContext): ThreeCoMode | null {
  const modes = threeCoModeOptions(ctx).map((o) => o.value);
  if (!modes.length) return null; // 일반형 레이아웃: 명명 모드 없음
  let best = modes[0];
  let bestPerf = -Infinity;
  for (const m of modes) {
    const p = kkjakPerf(ctx, m);
    if (p > bestPerf) { bestPerf = p; best = m; }
  }
  return best;
}
