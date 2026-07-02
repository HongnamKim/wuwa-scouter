import { useState } from 'react';
import type { AppState } from '../state/store';
import type { StatKey } from '../types/domain';
import { computePerf } from '../engine/perf';
import { buildPerfInput } from '../engine/build';
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

export function Scores({ state }: { state: AppState }) {
  const mine = computePerf(buildPerfInput(state));
  const best = theoryBest(state);
  const [mode, setMode] = useState<ThreeCoMode>(() => optimalThreeCoModeKkjak(state));
  const kk = kkjakPerf(state, mode);

  // 부옵을 하나도 입력하지 않았으면 점수 %는 비워둠
  const hasSub = state.slots.some((s) => s.substats.some((l) => l.type && l.value != null));
  const pct = (num: number, den: number) => (hasSub ? `${(num / den * 100).toFixed(1)}%` : '-%');

  const erLines = energyRegenLines(state);
  const mainDesc = best.mainPicks.map((p) => `${p.cost}코 ${lab(p.type)}`).join(' / ');
  const subDesc = effectiveSubstatsOf(state)
    .map((k) => `${lab(k)} ${best.subAllocation[k] ?? 0}줄`).join(', ');

  const BIG = { fontSize: '2.4rem', fontWeight: 'bold', lineHeight: 1.1 } as const;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, margin: '8px 0' }}>
        <div>
          <div className="lbl">딜 상승 수치</div>
          <div style={BIG}>{hasSub ? mine.toFixed(0) : '-'}</div>
        </div>
        <div>
          <div className="lbl">최고점 대비
            <span className="help">
              <span className="help-icon">?</span>
              <span className="help-tip">
                최고점 에코 = 유효옵을 각각 최고 단계로 최대 배분(전제형은 필요 공명 효율 도달에 필요한 줄 수만큼 차감) + 메인 옵션 최적 선택 시의 이론 상한.
                <br /><br />메인: {mainDesc}
                <br />부옵: {subDesc}{erLines > 0 ? ` (+공효 ${erLines}줄)` : ''}
              </span>
            </span>
          </div>
          <div style={BIG}>{pct(mine, best.perf)}</div>
          <div className="muted">{best.perf.toFixed(0)}</div>
        </div>
        <div>
          <div className="lbl" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>크크작 대비
            <Dropdown className="dd-narrow" value={mode}
              options={threeCoModeOptions(state)}
              onChange={(v) => setMode(v as ThreeCoMode)} />
          </div>
          <div style={BIG}>{pct(mine, kk)}</div>
          <div className="muted">{kk.toFixed(0)}</div>
        </div>
      </div>
    </div>
  );
}
