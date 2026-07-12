import type { CSSProperties } from 'react';
import type { AppState } from '../state/store';
import { analysisContext } from '../state/store';
import { twoPieceRecommendationGroups, RecoRow } from '../engine/theory';
import { WarnTip } from './WarnTip';

function Cell({ rows }: { rows: RecoRow[] }) {
  // 상대 성능 상위 3개만 표시(1+2+2는 조합이 많아 정보 과다 방지). rows/rowsEr가 이미 정렬함(재정렬 금지)
  const top = rows.slice(0, 3);
  return (
    <table style={{ width: 'auto' }}>
      <tbody>
        {top.map((r) => {
          const warn = r.reached === false;
          const rowStyle: CSSProperties | undefined = r.best ? { fontWeight: 'bold', background: '#eef7ee' } : undefined;
          return (
            <tr key={r.label} style={rowStyle}>
              <td>{r.label}</td>
              <td style={warn ? { color: '#b00' } : undefined}>
                {(r.relative * 100).toFixed(1)}%{r.best && !warn ? ' ★' : ''}
                {warn && <WarnTip />}
              </td>
            </tr>
          );
        })}
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
