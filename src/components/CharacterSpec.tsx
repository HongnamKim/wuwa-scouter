import type { AppState } from '../state/store';
import type { DamageBonusType } from '../types/domain';
import { computeDisplaySpec } from '../engine/spec';
import { damageBonusTypeOf } from '../engine/mode';

const DMG_TYPE_LABEL: Record<DamageBonusType, string> = {
  basic_attack: '일반공격 피해',
  heavy_attack: '강공격 피해',
  resonance_skill: '공명스킬 피해',
  resonance_liberation: '공명해방 피해',
  echo_skill: '에코 피해',
};

export function CharacterSpec({ state }: { state: AppState }) {
  const s = computeDisplaySpec(state);
  const dmgType = damageBonusTypeOf(state);
  const typeLabel = dmgType ? DMG_TYPE_LABEL[dmgType] : '유형 피해';
  return (
    <table className="spec-table">
      <tbody>
        <tr><th>공격력</th><td>{s.attack.toFixed(0)}</td></tr>
        <tr><th>크리티컬</th><td>{(s.criticalRateRaw * 100).toFixed(1)}%{s.criticalRateRaw > 1 ? ' (캡 100)' : ''}</td></tr>
        <tr><th>크리티컬 피해</th><td>{(s.criticalDamage * 100).toFixed(1)}%</td></tr>
        <tr><th>속성 피해</th><td>{(s.elementBonus * 100).toFixed(1)}%{s.amplify > 0 ? ` (부스트 +${(s.amplify * 100).toFixed(0)}%)` : ''}</td></tr>
        <tr><th>{typeLabel}</th><td>{(s.damageTypeBonus * 100).toFixed(1)}%</td></tr>
        <tr><th>공명 효율</th><td>{(s.energyRegen * 100).toFixed(1)}%</td></tr>
      </tbody>
    </table>
  );
}
