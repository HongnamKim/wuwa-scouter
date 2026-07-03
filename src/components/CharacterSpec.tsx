import type { AppState } from '../state/store';
import { analysisContext } from '../state/store';
import type { DamageBonusType, ScaleStat } from '../types/domain';
import { computeDisplaySpec } from '../engine/spec';
import { damageBonusTypeOf } from '../engine/mode';

const DMG_TYPE_LABEL: Record<DamageBonusType, string> = {
  basic_attack: '일반공격 피해',
  heavy_attack: '강공격 피해',
  resonance_skill: '공명스킬 피해',
  resonance_liberation: '공명해방 피해',
  echo_skill: '에코 피해',
};
const SCALE_LABEL: Record<ScaleStat, string> = { attack: '공격력', hp: '체력', defense: '방어력' };

export function CharacterSpec({ state }: { state: AppState }) {
  const ctx = analysisContext(state);
  if (!ctx) {
    return <p className="muted" style={{ margin: '4px 0' }}>무기 · 화음 세트 · 메인 에코 · 코스트 구성을 설정하면 표시됩니다.</p>;
  }
  const s = computeDisplaySpec(ctx);
  const dmgType = damageBonusTypeOf(ctx);
  return (
    <table className="spec-table">
      <tbody>
        <tr><th>{SCALE_LABEL[state.character.scale_stat]}</th><td>{s.attack.toFixed(0)}</td></tr>
        <tr><th>크리티컬</th><td>{(s.criticalRateRaw * 100).toFixed(1)}%{s.criticalRateRaw > 1 ? ' (캡 100)' : ''}</td></tr>
        <tr><th>크리티컬 피해</th><td>{(s.criticalDamage * 100).toFixed(1)}%</td></tr>
        <tr><th>속성 피해</th><td>{(s.elementBonus * 100).toFixed(1)}%{s.amplifyElement > 0 ? ` (부스트 +${(s.amplifyElement * 100).toFixed(0)}%)` : ''}</td></tr>
        {dmgType && <tr><th>{DMG_TYPE_LABEL[dmgType]}</th><td>{(s.damageTypeBonus * 100).toFixed(1)}%{s.amplifyDamageType > 0 ? ` (부스트 +${(s.amplifyDamageType * 100).toFixed(0)}%)` : ''}</td></tr>}
        {s.amplifyAll > 0 && <tr><th>전체 피해 부스트</th><td>+{(s.amplifyAll * 100).toFixed(0)}%</td></tr>}
        <tr><th>공명 효율</th><td>{(s.energyRegen * 100).toFixed(1)}%</td></tr>
      </tbody>
    </table>
  );
}
