import { useState } from 'react';
import type { CalcContext } from '../engine/context';
import { loadWeapons, getWeapon } from '../engine/loadData';
import { onImgError } from './imgFallback';
import { buildPerfInput } from '../engine/build';
import { computePerf } from '../engine/perf';

/**
 * 무기 비교: 저장된 빌드에서 무기만 바꿔가며 딜 상승 수치를 계산.
 * 현재(저장) 무기를 100%로 두고 추천무기들의 상대 % 표시. 공진은 슬라이더로 일괄 조절.
 */
export function WeaponCompare({ base }: { base: CalcContext }) {
  const weapons = loadWeapons();
  const savedRef = base.refinementLevel ?? 1;
  const [refinement, setRefinement] = useState(savedRef); // 슬라이더: 내 무기의 '가정' 공진 → 행으로 추가
  const OTHER_REF = 1; // 비교(추천) 무기는 1공진 기준으로 고정

  // 현재 무기가 추천 목록에 없으면 앞에 포함
  const ids = base.character.recommended_weapons.includes(base.weapon.id)
    ? base.character.recommended_weapons
    : [base.weapon.id, ...base.character.recommended_weapons];

  const dealOf = (wid: string, ref: number) =>
    computePerf(buildPerfInput({ ...base, weapon: getWeapon(wid, weapons), refinementLevel: ref }));

  // 기준(100%) = 내 무기 @ 저장 공진 (착용 무기 고정)
  const baseDeal = dealOf(base.weapon.id, savedRef);

  type Row = { key: string; id: string; name: string; refinement: number; deal: number; current: boolean };
  const rows: Row[] = [
    { key: 'current', id: base.weapon.id, name: base.weapon.name, refinement: savedRef, deal: baseDeal, current: true },
  ];
  // 슬라이더 공진이 저장과 다르면, 내 무기의 그 공진 버전을 새 행으로 추가
  if (refinement !== savedRef) {
    rows.push({ key: `mine@${refinement}`, id: base.weapon.id, name: base.weapon.name, refinement, deal: dealOf(base.weapon.id, refinement), current: false });
  }
  // 비교(추천) 무기는 1공진 고정
  for (const wid of ids) {
    if (wid === base.weapon.id) continue;
    rows.push({ key: wid, id: wid, name: getWeapon(wid, weapons).name, refinement: OTHER_REF, deal: dealOf(wid, OTHER_REF), current: false });
  }
  const best = Math.max(...rows.map((r) => r.deal));
  const sorted = [...rows].sort((a, b) => b.deal - a.deal);

  return (
    <div>
      <div className="setting-row" style={{ margin: '8px 0' }}>
        <span className="muted">내 무기 공진</span>
        <input type="range" min={1} max={5} step={1} style={{ width: 140 }}
          value={refinement} onChange={(e) => setRefinement(Number(e.target.value))} />
        <span style={{ fontWeight: 'bold' }}>{refinement}공진</span>
      </div>
      <p className="muted" style={{ marginTop: 0 }}>내 무기(현재)는 저장 공진({savedRef}공진) 고정(기준 100%). 슬라이더로 내 무기의 다른 공진을 행으로 추가합니다. 비교 무기는 {OTHER_REF}공진 기준.</p>
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
                    <img src={`/weapons/${r.id}.webp`} alt={r.name} style={{ width: 24, height: 24, objectFit: 'contain', flex: '0 0 auto' }} onError={onImgError} />
                    <span>{r.name} <span className="muted">{r.refinement}공진</span>{r.current ? ' (현재)' : ''}{r.deal === best ? ' ★' : ''}</span>
                  </span>
                </td>
                <td>{r.deal.toFixed(0)}</td>
                <td style={{ fontWeight: 'bold', color: diff > 0 ? '#15803d' : diff < 0 ? '#b91c1c' : undefined }}>
                  <div>{pct.toFixed(1)}%</div>
                  {!r.current && <div style={{ fontSize: '0.85rem' }}>({diff >= 0 ? '+' : ''}{diff.toFixed(1)}%p)</div>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
