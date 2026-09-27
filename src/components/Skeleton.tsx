export function Skeleton({ width = '5em' }: { width?: string }) {
  return <span className="skeleton" style={{ width }} role="status" aria-label="계산 중" />;
}

export function CalculationError() {
  return <span role="alert" className="muted" style={{ fontSize: '0.8rem' }}>계산하지 못했습니다. 새로고침해 주세요.</span>;
}

export function RecommendationSkeleton({ labels }: { labels: string[] }) {
  return (
    <div className="reco-card" aria-busy="true">
      <table className="reco-grid">
        {labels.length > 0 && <thead><tr><th></th>{labels.map((label) => <th key={label}>{label}</th>)}</tr></thead>}
        <tbody>
          {['최고점', '크크작'].map((label) => (
            <tr key={label}><th>{label}</th>{(labels.length ? labels : ['']).map((column) => (
              <td key={column}><div className="reco-lines">
                {[0, 1, 2].map((i) => <div className="reco-line" key={i}><Skeleton width="3em" /><Skeleton width="4em" /></div>)}
              </div></td>
            ))}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
