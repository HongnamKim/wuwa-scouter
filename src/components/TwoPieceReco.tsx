import type { AppState } from '../state/store';
import { analysisContext } from '../state/store';
import { twoPieceRecommendationGroups, RecoRow } from '../engine/theory';

function Cell({ rows }: { rows: RecoRow[] }) {
  return (
    <table style={{ width: 'auto' }}>
      <tbody>
        {rows.map((r) => (
          <tr key={r.label} style={r.best ? { fontWeight: 'bold', background: '#eef7ee' } : undefined}>
            <td>{r.label}</td>
            <td>{(r.relative * 100).toFixed(1)}%{r.best ? ' ★' : ''}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** 자유 2세트 효과(1+2+2, 3+2) 조합별 상대 성능 추천 — 최고점/크크작 기준. 자유 슬롯 0이면 렌더 안 함 */
export function TwoPieceReco({ state }: { state: AppState }) {
  const ctx = analysisContext(state);
  const groups = ctx ? twoPieceRecommendationGroups(ctx) : null;
  if (!groups) return null;
  return (
    <table className="reco-grid">
      <tbody>
        <tr><th>최고점</th><td><Cell rows={groups.theory} /></td></tr>
        <tr><th>크크작</th><td><Cell rows={groups.kkjak} /></td></tr>
      </tbody>
    </table>
  );
}
