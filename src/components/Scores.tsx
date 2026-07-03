import { useState } from 'react';
import type { AppState } from '../state/store';
import { analysisContext, isRecordOnly } from '../state/store';
import type { CalcContext } from '../engine/context';
import type { StatKey } from '../types/domain';
import { computePerf } from '../engine/perf';
import { buildPerfInput, computeEnergyRegen } from '../engine/build';
import { theoryBest, kkjakPerf, optimalThreeCoModeKkjak, threeCoModeOptions, energyRegenLines, ThreeCoMode } from '../engine/theory';
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
const BIG = { fontSize: '2.4rem', fontWeight: 'bold', lineHeight: 1.1 } as const;

// 설정 미완성(ctx=null) 시에도 점수 영역 레이아웃은 유지하고, 계산 불가 값만 "-"로 표기한다.
export function Scores({ state }: { state: AppState }) {
  const ctx = analysisContext(state); // null이면 미완성
  if (isRecordOnly(state.character)) return <RecordScore ctx={ctx} />;
  return <ScoresInner ctx={ctx} />;
}

/** 부옵을 하나라도 입력했는지 (없으면 딜 상승 수치는 "-") */
function hasAnySub(ctx: CalcContext | null): boolean {
  return !!ctx && ctx.slots.some((s) => s.substats.some((l) => l.type && l.value != null));
}

/** 기록 전용 캐릭터: 딜 상승 수치(개인 딜 근사) + 공효 도달만 표시. 최고점/크크작 상대 점수는 없음. */
function RecordScore({ ctx }: { ctx: CalcContext | null }) {
  const hasSub = hasAnySub(ctx);
  const deal = ctx && hasSub ? computePerf(buildPerfInput(ctx)).toFixed(0) : '-';
  // 공효 도달 목표: 사용자가 입력한 필요 공명 효율(requiredEnergyRegen)이 목표.
  // 캐릭터 데이터의 default_required_energy_regen은 기본값(폴백)일 뿐 고정값이 아니다.
  const target = ctx?.requiredEnergyRegen ?? ctx?.character.default_required_energy_regen;
  const er = ctx ? computeEnergyRegen(ctx) * 100 : null;
  return (
    <div style={{ margin: '8px 0', display: 'flex', gap: 40, flexWrap: 'wrap', alignItems: 'flex-start' }}>
      <div>
        <div className="lbl">딜 상승 수치</div>
        <div style={BIG}>{deal}</div>
      </div>
      {er != null && (
        <div>
          <div className="lbl">공명 효율{target != null ? ` (목표 ${target}%)` : ''}</div>
          <div style={BIG}>
            {er.toFixed(1)}%
            {target != null && <span style={{ fontSize: '1.4rem', marginLeft: 8, color: er >= target ? '#2a7d2a' : '#b00' }}>{er >= target - 1e-9 ? '✓' : '✗'}</span>}
          </div>
        </div>
      )}
      <p className="muted" style={{ fontSize: '0.8rem', marginTop: 6, flexBasis: '100%' }}>
        ※ 서포터(기록 전용) — 최고점/크크작 상대 점수와 메인 조합 추천은 제공하지 않습니다.
      </p>
    </div>
  );
}

function ScoresInner({ ctx }: { ctx: CalcContext | null }) {
  const [mode, setMode] = useState<ThreeCoMode>(() => (ctx ? optimalThreeCoModeKkjak(ctx) : 'soksok'));

  const hasSub = hasAnySub(ctx);
  const mine = ctx ? computePerf(buildPerfInput(ctx)) : null;
  const best = ctx ? theoryBest(ctx) : null;
  const kk = ctx ? kkjakPerf(ctx, mode) : null;

  // 딜 상승 수치: 설정+부옵 있어야 계산 가능
  const dealText = ctx && hasSub && mine != null ? mine.toFixed(0) : '-';
  // 상대 점수: 분모(최고점/크크작)는 캐릭터 설정 필요, 분자(내 딜)는 부옵 필요
  const pct = (den: number | null) =>
    ctx && hasSub && mine != null && den != null ? `${(mine / den * 100).toFixed(1)}%` : '-%';

  const erLines = ctx ? energyRegenLines(ctx) : 0;
  const mainDesc = best ? best.mainPicks.map((p) => `${p.cost}코 ${lab(p.type)}`).join(' / ') : '';
  const subDesc = best && ctx
    ? effectiveSubstatsOf(ctx).map((k) => `${lab(k)} ${best.subAllocation[k] ?? 0}줄`).join(', ')
    : '';

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, margin: '8px 0' }}>
        <div>
          <div className="lbl">딜 상승 수치</div>
          <div style={BIG}>{dealText}</div>
        </div>
        <div>
          <div className="lbl">최고점 대비
            <span className="help">
              <span className="help-icon">?</span>
              <span className="help-tip">
                최고점 에코 = 유효옵을 각각 최고 단계로 최대 배분(전제형은 필요 공명 효율 도달에 필요한 줄 수만큼 차감) + 메인 옵션 최적 선택 시의 이론 상한.
                {best && (<>
                  <br /><br />메인: {mainDesc}
                  <br />부옵: {subDesc}{erLines > 0 ? ` (+공효 ${erLines}줄)` : ''}
                </>)}
              </span>
            </span>
          </div>
          <div style={BIG}>{pct(best ? best.perf : null)}</div>
          {best && <div className="muted">{best.perf.toFixed(0)}</div>}
        </div>
        <div>
          <div className="lbl" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>크크작 대비
            <Dropdown className="dd-narrow" value={mode} disabled={!ctx}
              options={ctx ? threeCoModeOptions(ctx) : [{ value: 'soksok', label: '속속' }]}
              onChange={(v) => setMode(v as ThreeCoMode)} />
          </div>
          <div style={BIG}>{pct(kk)}</div>
          {kk != null && <div className="muted">{kk.toFixed(0)}</div>}
        </div>
      </div>
    </div>
  );
}
