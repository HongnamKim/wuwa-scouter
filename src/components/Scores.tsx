import { useState, type ReactNode } from 'react';
import type { AppState } from '../state/store';
import { analysisContext, isRecordOnly } from '../state/store';
import type { CalcContext } from '../engine/context';
import type { Character } from '../types/data';
import type { StatKey } from '../types/domain';
import { computePerf } from '../engine/perf';
import { buildPerfInput, computeEnergyRegen } from '../engine/build';
import { theoryBest, kkjakPerf, kkjakReferencePerf, optimalThreeCoModeKkjak, threeCoModeOptions, hasNamedModes, energyRegenLines, ThreeCoMode, erConstrained } from '../engine/theory';
import { effectiveSubstatsOf } from '../engine/mode';
import { Dropdown } from './Dropdown';

const STAT_LABEL: Partial<Record<StatKey, string>> = {
  critical_rate: '크리', critical_damage: '크피',
  attack_percent: '공%', hp_percent: 'HP%', defense_percent: '방%',
  flat_attack: '깡공', flat_hp: '깡HP', flat_defense: '깡방',
  energy_regen: '공효', element_damage_bonus: '속성피해',
  basic_attack_bonus: '일반공격', heavy_attack_bonus: '강공격',
  resonance_skill_bonus: '공명스킬', resonance_liberation_bonus: '공명해방',
};
const lab = (k: StatKey) => STAT_LABEL[k] ?? k;

const DEAL_TIP = '현재 무기, 에코 등으로 얻는 상승 수치입니다. 절대 데미지가 아니라 같은 캐릭터의 빌드 비교용 상대 지표입니다.';

/** 큰 수치는 천 단위 쉼표 표기 (디자인: 21,847 / 27,900). */
const comma = (n: number) => Math.round(n).toLocaleString('en-US');

/** 도움말(?) 아이콘 + 툴팁 (라벨 옆). */
function Help({ children }: { children: ReactNode }) {
  return (
    <span className="help">
      <span className="help-icon">?</span>
      <span className="help-tip">{children}</span>
    </span>
  );
}

/** 점수 카드 하나 (라벨 + 도움말/드롭다운 + 큰 수치 + 보조줄). */
function ScoreCard({ label, help, extra, big, bigAccent, sub, subline }:
  { label: string; help?: ReactNode; extra?: ReactNode; big: ReactNode; bigAccent?: boolean; sub?: ReactNode; subline?: ReactNode }) {
  return (
    <div className="score-card">
      {/* 드롭다운(크크작 모드)은 우측 상단으로 빼서 라벨/수치 높이를 다른 카드와 맞춘다 */}
      {extra && <div className="score-card-extra">{extra}</div>}
      <div className="lbl">{label}{help && <Help>{help}</Help>}</div>
      <div className="big" style={bigAccent ? { color: 'var(--accent)' } : undefined}>{big}</div>
      {sub != null && <div className="sub">{sub}</div>}
      {subline}
    </div>
  );
}

// 설정 미완성(ctx=null) 시에도 점수 영역 레이아웃은 유지하고, 계산 불가 값만 "-"로 표기한다.
export function Scores({ state }: { state: AppState }) {
  const ctx = analysisContext(state); // null이면 미완성
  // 요구 공효 있는 서포터: 3열 점수 + 작은 공효 도달 배지(하이브리드).
  if (ctx && erConstrained(ctx)) {
    return (
      <>
        <ScoresInner ctx={ctx} dealSubline={<ErReachBadge ctx={ctx} />} />
        {ctx.character.scale_stat !== 'attack' && (
          <p className="muted" style={{ fontSize: '0.8rem', marginTop: 6 }}>
            ※ 공격력을 사용하지 않는 서포터 캐릭터의 딜 상승 수치는 주요 스탯(체력·방어력)을 사용하는 주력 스킬의 피해량을 나타냅니다.
          </p>
        )}
      </>
    );
  }
  if (isRecordOnly(state.character)) return <RecordScore ctx={ctx} character={state.character} />;
  return <ScoresInner ctx={ctx} />;
}

/** 서포터 하이브리드용 작은 공효 도달 배지. */
function ErReachBadge({ ctx }: { ctx: CalcContext }) {
  const target = ctx.requiredEnergyRegen ?? ctx.character.default_required_energy_regen;
  const er = computeEnergyRegen(ctx) * 100;
  if (target == null) return null;
  const ok = er >= target - 1e-9;
  return (
    <div className="sub" style={{ marginTop: 6 }}>
      목표 공명 효율 {target}% 도달{' '}
      <span style={{ fontWeight: 700, color: ok ? 'var(--good)' : '#e5646a' }}>{ok ? '✓' : '✗'}</span>
      <span style={{ marginLeft: 6 }}>(현재 {er.toFixed(1)}%)</span>
    </div>
  );
}

/** 부옵을 하나라도 입력했는지 (없으면 딜 상승 수치는 "-") */
function hasAnySub(ctx: CalcContext | null): boolean {
  return !!ctx && ctx.slots.some((s) => s.substats.some((l) => l.type && l.value != null));
}

/** 기록 전용 캐릭터: 딜 상승 수치(개인 딜 근사) + 공효 도달만 표시. 최고점/크크작 상대 점수는 없음. */
function RecordScore({ ctx, character }: { ctx: CalcContext | null; character: Character }) {
  const hasSub = hasAnySub(ctx);
  const deal = ctx && hasSub ? comma(computePerf(buildPerfInput(ctx))) : '-';
  // 공효 도달 목표: 사용자가 입력한 필요 공명 효율(requiredEnergyRegen)이 목표.
  // 캐릭터 데이터의 default_required_energy_regen은 기본값(폴백)일 뿐 고정값이 아니다.
  const target = ctx?.requiredEnergyRegen ?? ctx?.character.default_required_energy_regen;
  const er = ctx ? computeEnergyRegen(ctx) * 100 : null;
  return (
    <>
      <div className="dc-scores-grid">
        <ScoreCard label="딜 상승 수치" help={DEAL_TIP} big={deal} />
        {er != null && (
          <ScoreCard
            label={`공명 효율${target != null ? ` (목표 ${target}%)` : ''}`}
            big={<>{er.toFixed(1)}<span style={{ fontSize: '1.4rem' }}>%</span>
              {target != null && <span style={{ fontSize: '1.4rem', marginLeft: 8, color: er >= target - 1e-9 ? 'var(--good)' : '#e5646a' }}>{er >= target - 1e-9 ? '✓' : '✗'}</span>}</>}
          />
        )}
      </div>
      <p className="muted" style={{ fontSize: '0.8rem', marginTop: 10 }}>
        ※ 서포터(기록 전용) — 최고점/크크작 상대 점수와 메인 조합 추천은 제공하지 않습니다.
        {character.scale_stat !== 'attack' && (
          <><br />※ 공격력을 사용하지 않는 서포터 캐릭터의 딜 상승 수치는 주요 스탯(체력·방어력)을 사용하는 주력 스킬의 피해량을 나타냅니다.</>
        )}
      </p>
    </>
  );
}

function ScoresInner({ ctx, dealSubline }: { ctx: CalcContext | null; dealSubline?: ReactNode }) {
  const [mode, setMode] = useState<ThreeCoMode | null>(null);

  const named = ctx ? hasNamedModes(ctx) : false;
  // 현재 레이아웃에서 유효한 명명 모드(레이아웃 변경 시 스테일 방지). 없거나 일반형이면 null → 자동 기준.
  const opts = ctx && named ? threeCoModeOptions(ctx) : [];
  const effMode: ThreeCoMode | null = named
    ? (mode && opts.some((o) => o.value === mode) ? mode : (ctx ? optimalThreeCoModeKkjak(ctx) : null))
    : null;

  const hasSub = hasAnySub(ctx);
  const mine = ctx ? computePerf(buildPerfInput(ctx)) : null;
  const best = ctx ? theoryBest(ctx) : null;
  // 명명 레이아웃은 선택 모드 기준, 일반형(직접 입력 등)은 전수 최고 기준.
  const kk = ctx ? (effMode ? kkjakPerf(ctx, effMode) : kkjakReferencePerf(ctx)) : null;

  // 딜 상승 수치: 설정+부옵 있어야 계산 가능
  const dealText = ctx && hasSub && mine != null ? comma(mine) : '-';
  // 상대 점수: 분모(최고점/크크작)는 캐릭터 설정 필요, 분자(내 딜)는 부옵 필요
  const pctNode = (den: number | null): ReactNode =>
    ctx && hasSub && mine != null && den != null
      ? <>{(mine / den * 100).toFixed(1)}<span style={{ fontSize: '1.4rem' }}>%</span></>
      : '-%';

  const erLines = ctx ? energyRegenLines(ctx) : 0;
  const mainDesc = best ? best.mainPicks.map((p) => `${p.cost}코 ${lab(p.type)}`).join(' / ') : '';
  const subDesc = best && ctx
    ? effectiveSubstatsOf(ctx).map((k) => `${lab(k)} ${best.subAllocation[k] ?? 0}줄`).join(', ')
    : '';

  return (
    <div className="dc-scores-grid">
      <ScoreCard label="딜 상승 수치" help={DEAL_TIP} big={dealText} subline={dealSubline} />
      <ScoreCard
        label="최고점 대비"
        help={<>
          최고점 에코 = 유효옵을 각각 최고 단계로 최대 배분(전제형은 필요 공명 효율 도달에 필요한 줄 수만큼 차감) + 메인 옵션 최적 선택 시의 이론 상한.
          {best && (<>
            <br /><br />메인: {mainDesc}
            <br />부옵: {subDesc}{erLines > 0 ? ` (+공효 ${erLines}줄)` : ''}
          </>)}
        </>}
        big={pctNode(best ? best.perf : null)}
        sub={best ? comma(best.perf) : undefined}
      />
      <ScoreCard
        label="크크작 대비"
        bigAccent
        help={<>
          크크작 = 크리 5줄·크피 5줄을 고정하고 나머지 옵션이 평균적으로 붙는 에코작. <br />실제 파밍에서 흔히 나오는 현실적 대비 대상입니다.
          {named && opts.length > 0 && <><br /><br />드롭다운은 분모의 메인 옵션 조합(속=속성피해, 공=공격%)을 선택합니다.</>}
        </>}
        extra={named && opts.length > 0 ? (
          <Dropdown className="dd-tiny" value={effMode ?? opts[0].value} disabled={!ctx}
            options={opts}
            onChange={(v) => setMode(v as ThreeCoMode)} />
        ) : undefined}
        big={pctNode(kk)}
        sub={kk != null ? comma(kk) : undefined}
      />
    </div>
  );
}
