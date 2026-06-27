import { useState } from 'react';
import type { AppState } from '../state/store';
import { compareSubstats } from '../engine/theory';
import type { StatKey } from '../types/domain';

const FIELDS: { key: StatKey; label: string }[] = [
  { key: 'critical_rate', label: '크리%' }, { key: 'critical_damage', label: '크피%' },
  { key: 'attack_percent', label: '공%' }, { key: 'resonance_liberation_bonus', label: '해방%' },
  { key: 'flat_attack', label: '깡공' },
];

export function SubstatCompare({ state }: { state: AppState }) {
  const [over, setOver] = useState<Partial<Record<StatKey, number>>>({});
  const [result, setResult] = useState<string>('');

  return (
    <div>
      <p className="muted">바꿀 유효옵 합만 입력(비우면 현재값).</p>
      <div className="sub-row">
        {FIELDS.map((f) => (
          <label key={f.key}>{f.label}
            <input type="number" step="0.1" value={over[f.key] ?? ''}
              onChange={(e) => setOver({ ...over, [f.key]: e.target.value === '' ? undefined : parseFloat(e.target.value) })} />
          </label>
        ))}
      </div>
      <button onClick={() => {
        const clean = Object.fromEntries(Object.entries(over).filter(([, v]) => v != null)) as Partial<Record<StatKey, number>>;
        const r = compareSubstats(state, clean);
        setResult(`현재 ${r.current.toFixed(0)} → 비교 ${r.compared.toFixed(0)} · ${r.diffPercent >= 0 ? '+' : ''}${r.diffPercent.toFixed(2)}%`);
      }}>비교</button>
      <div className="cmp-result">{result}</div>
    </div>
  );
}
