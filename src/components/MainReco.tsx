import type { AppState } from '../state/store';
import { mainRecommendation, RecoRow } from '../engine/theory';

function Cell({ rows }: { rows: RecoRow[] }) {
  return (
    <table style={{ width: 'auto' }}>
      <tbody>
        {rows.map((r) => (
          <tr key={r.label} style={r.best ? { fontWeight: 'bold', background: '#eef7ee' } : undefined}>
            <td>{r.label}</td><td>{(r.relative * 100).toFixed(1)}%{r.best ? ' ★' : ''}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function MainReco({ state }: { state: AppState }) {
  const groups = mainRecommendation(state);
  // 후보가 많은 그룹(44111 4코 조합, ER 전환형 3코 조합 등)은 상위 3건만 표시
  const top = (rows: RecoRow[]) => rows.slice(0, 3);
  return (
    <table className="reco-grid">
      <thead><tr><th></th>{groups.map((g) => <th key={g.label}>{g.label}</th>)}</tr></thead>
      <tbody>
        <tr><th>최고점</th>{groups.map((g) => <td key={g.label}><Cell rows={top(g.theory)} /></td>)}</tr>
        <tr><th>크크작</th>{groups.map((g) => <td key={g.label}><Cell rows={top(g.kkjak)} /></td>)}</tr>
      </tbody>
    </table>
  );
}
