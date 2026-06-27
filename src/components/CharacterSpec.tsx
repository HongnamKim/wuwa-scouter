import type { AppState } from '../state/store';
import { computeDisplaySpec } from '../engine/spec';

export function CharacterSpec({ state }: { state: AppState }) {
  const s = computeDisplaySpec(state);
  return (
    <table className="spec-table">
      <tbody>
        <tr><th>공격력</th><td>{s.attack.toFixed(0)}</td></tr>
        <tr><th>크리티컬</th><td>{(s.criticalRateRaw * 100).toFixed(1)}%{s.criticalRateRaw > 1 ? ' (캡 100)' : ''}</td></tr>
        <tr><th>크리티컬 피해</th><td>{(s.criticalDamage * 100).toFixed(1)}%</td></tr>
        <tr><th>속성 피해</th><td>{(s.elementBonus * 100).toFixed(1)}%{s.amplify > 0 ? ` (부스트 +${(s.amplify * 100).toFixed(0)}%)` : ''}</td></tr>
        <tr><th>스킬 피해(유형)</th><td>{(s.damageTypeBonus * 100).toFixed(1)}%</td></tr>
        <tr><th>공명 효율</th><td>{(s.energyRegen * 100).toFixed(1)}%</td></tr>
      </tbody>
    </table>
  );
}
