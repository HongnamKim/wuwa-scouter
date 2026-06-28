import { useState } from 'react';
import type { AppState } from '../state/store';
import { loadWeapons, getWeapon } from '../engine/loadData';
import { buildPerfInput } from '../engine/build';
import { computePerf } from '../engine/perf';

/**
 * 무기 비교: 저장된 빌드에서 무기만 바꿔가며 딜 상승 수치를 계산.
 * 현재(저장) 무기를 100%로 두고 추천무기들의 상대 % 표시. 공진은 슬라이더로 일괄 조절.
 */
export function WeaponCompare({ base }: { base: AppState }) {
  const weapons = loadWeapons();
  const savedRef = base.refinementLevel ?? 1;
  const [refinement, setRefinement] = useState(savedRef);

  // 현재 무기가 추천 목록에 없으면 앞에 포함
  const ids = base.character.recommended_weapons.includes(base.weapon.id)
    ? base.character.recommended_weapons
    : [base.weapon.id, ...base.character.recommended_weapons];

  const dealOf = (wid: string, ref: number) =>
    computePerf(buildPerfInput({ ...base, weapon: getWeapon(wid, weapons), refinementLevel: ref }));

  // 기준선 = 내 무기(저장 공진 고정). 슬라이더 공진과 무관하게 항상 유지.
  const baseDeal = dealOf(base.weapon.id, savedRef);

  type Row = { key: string; id: string; name: string; refinement: number; deal: number; current: boolean };
  const rows: Row[] = [
    { key: 'current', id: base.weapon.id, name: base.weapon.name, refinement: savedRef, deal: baseDeal, current: true },
  ];
  // 나머지 무기 + (슬라이더 공진이 저장과 다르면) 내 무기의 슬라이더-공진 버전을 슬라이더 공진으로 추가
  for (const wid of ids) {
    if (wid === base.weapon.id && refinement === savedRef) continue; // 기준선과 중복 방지
    rows.push({ key: `${wid}@${refinement}`, id: wid, name: getWeapon(wid, weapons).name, refinement, deal: dealOf(wid, refinement), current: false });
  }
  const best = Math.max(...rows.map((r) => r.deal));
  const sorted = [...rows].sort((a, b) => b.deal - a.deal);

  return (
    <div>
      <div className="setting-row" style={{ margin: '8px 0' }}>
        <span className="muted">비교 공진</span>
        <input type="range" min={1} max={5} step={1} style={{ width: 140 }}
          value={refinement} onChange={(e) => setRefinement(Number(e.target.value))} />
        <span style={{ fontWeight: 'bold' }}>{refinement}공진</span>
      </div>
      <p className="muted" style={{ marginTop: 0 }}>내 무기는 저장 공진({savedRef}공진)으로 고정, 나머지는 비교 공진 적용.</p>
      <table style={{ width: '100%', maxWidth: 460, tableLayout: 'fixed' }}>
        <colgroup>
          <col />
          <col style={{ width: 96 }} />
          <col style={{ width: 132 }} />
        </colgroup>
        <thead>
          <tr><th style={{ textAlign: 'left' }}>무기</th><th>딜 상승 수치</th><th>현재 대비</th></tr>
        </thead>
        <tbody>
          {sorted.map((r) => {
            const pct = (r.deal / baseDeal) * 100;
            const diff = pct - 100;
            return (
              <tr key={r.key} style={r.current ? { background: '#eef2ff' } : undefined}>
                <td style={{ textAlign: 'left' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <img src={`/weapons/${r.id}.png`} alt="" style={{ width: 24, height: 24, objectFit: 'contain', flex: '0 0 auto' }}
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                    <span>{r.name} <span className="muted">{r.refinement}공진</span>{r.current ? ' (현재)' : ''}{r.deal === best ? ' ★' : ''}</span>
                  </span>
                </td>
                <td>{r.deal.toFixed(0)}</td>
                <td style={{ fontWeight: 'bold', color: diff > 0 ? '#15803d' : diff < 0 ? '#b91c1c' : undefined }}>
                  {pct.toFixed(1)}%{r.current ? '' : ` (${diff >= 0 ? '+' : ''}${diff.toFixed(1)}%p)`}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
