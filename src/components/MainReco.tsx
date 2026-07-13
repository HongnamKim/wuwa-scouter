import type { AppState } from '../state/store';
import { analysisContext } from '../state/store';
import { mainRecommendation, RecoRow } from '../engine/theory';
import { WarnTip } from './WarnTip';

function Cell({ rows }: { rows: RecoRow[] }) {
  return (
    <div className="reco-lines">
      {rows.map((r) => {
        const warn = r.reached === false; // 요구 공효 미도달
        return (
          <div key={r.label} className={'reco-line' + (r.best ? ' reco-best' : '')}>
            <span>{r.label}</span>
            <span style={warn ? { color: '#e5646a' } : undefined}>
              {(r.relative * 100).toFixed(1)}%{warn && <WarnTip />}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function MainReco({ state }: { state: AppState }) {
  const ctx = analysisContext(state);
  if (!ctx) {
    return (
      <p className="muted" style={{ margin: '8px 0' }}>
        무기 · 화음 세트 · 메인 에코 · 코스트 구성을 먼저 설정해 주세요.
      </p>
    );
  }
  const groups = mainRecommendation(ctx);
  // 후보가 많은 그룹(44111 4코 조합, ER 전환형 3코 조합 등)은 상위 3건만 표시
  const top = (rows: RecoRow[]) => rows.slice(0, 3);
  return (
    <div className="reco-card">
      <table className="reco-grid">
        <thead><tr><th></th>{groups.map((g) => <th key={g.label}>{g.label}</th>)}</tr></thead>
        <tbody>
          <tr><th>최고점</th>{groups.map((g) => <td key={g.label}><Cell rows={top(g.theory)} /></td>)}</tr>
          <tr><th>크크작</th>{groups.map((g) => <td key={g.label}><Cell rows={top(g.kkjak)} /></td>)}</tr>
        </tbody>
      </table>
    </div>
  );
}
