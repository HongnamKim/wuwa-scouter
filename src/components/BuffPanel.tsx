import type { AppState } from '../state/store';
import type { Buff } from '../types/data';
import type { StatKey } from '../types/domain';

const BUFF_TYPES: { key: StatKey; label: string }[] = [
  { key: 'critical_rate', label: '크리티컬%' }, { key: 'critical_damage', label: '크리티컬 피해%' },
  { key: 'element_damage_bonus', label: '속성피해% 증가' }, { key: 'element_damage_amplify', label: '속성피해% 부스트' },
  { key: 'all_damage_amplify', label: '전체 피해% 부스트' }, { key: 'attack_percent', label: '공격력%' },
  { key: 'defense_ignore', label: '방어력 무시%' }, { key: 'element_resistance_ignore', label: '속성 저항 무시%' },
];

interface Props { state: AppState; setState: (s: AppState) => void; }

export function BuffPanel({ state, setState }: Props) {
  // 조건부 토글 목록(상시 제외)을 출처별로 그룹핑
  const condGroups: { source: string; buffs: Buff[] }[] = [
    { source: '무기', buffs: state.weapon.buffs },
    ...state.echoSets.map((s) => ({ source: s.name, buffs: s.buffs })),
    { source: '메인 에코', buffs: state.mainEcho.buffs },
  ]
    .map((g) => ({ source: g.source, buffs: g.buffs.filter((b) => !b.always && b.id) }))
    .filter((g) => g.buffs.length > 0);

  // 전체 토글: 아래 버프들(조건부 + 파티/기타)을 일괄 on/off
  const condIds = condGroups.flatMap((g) => g.buffs.map((b) => b.id!));
  const toggleCount = condIds.length + state.manualBuffs.length;
  const allOn = toggleCount > 0
    && condIds.every((id) => state.conditionalToggles[id] !== false)
    && state.manualBuffs.every((m) => m.enabled !== false);
  const setAll = (value: boolean) => {
    const next = { ...state.conditionalToggles };
    condIds.forEach((id) => { next[id] = value; });
    setState({
      ...state,
      conditionalToggles: next,
      manualBuffs: state.manualBuffs.map((m) => ({ ...m, enabled: value })),
    });
  };

  return (
    <div>
      <h3 style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        추가 버프
        <label style={{ fontSize: '0.8rem', fontWeight: 'normal', display: 'flex', gap: 4, alignItems: 'center' }}>
          <input type="checkbox" checked={allOn} disabled={toggleCount === 0}
            onChange={(e) => setAll(e.target.checked)} /> 전체
        </label>
      </h3>
      {condGroups.map((g) => (
        <div key={g.source}>
          <div className="muted" style={{ margin: '6px 0 2px', fontWeight: 'bold' }}>{g.source}</div>
          {g.buffs.map((b) => (
            <label key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 4, width: 'fit-content' }}>
              <input type="checkbox" checked={state.conditionalToggles[b.id!] ?? true}
                onChange={(e) => setState({ ...state, conditionalToggles: { ...state.conditionalToggles, [b.id!]: e.target.checked } })} />
              <span>{b.label}</span>
            </label>
          ))}
        </div>
      ))}
      <div className="muted" style={{ margin: '6px 0 2px', fontWeight: 'bold' }}>파티/기타 버프</div>
      {state.manualBuffs.map((mb, i) => (
        <div className="sub-row" key={i}>
          <input type="checkbox" checked={mb.enabled !== false} onChange={(e) => {
            const next = state.manualBuffs.map((x, idx) => idx === i ? { ...x, enabled: e.target.checked } : x);
            setState({ ...state, manualBuffs: next });
          }} />
          <select value={mb.type} onChange={(e) => {
            const next = state.manualBuffs.map((x, idx) => idx === i ? { ...x, type: e.target.value as StatKey | '' } : x);
            setState({ ...state, manualBuffs: next });
          }}>
            <option value="">유형</option>
            {BUFF_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
          <input type="number" step="0.1" placeholder="수치" value={mb.value ?? ''}
            onChange={(e) => {
              const next = state.manualBuffs.map((x, idx) => idx === i ? { ...x, value: e.target.value === '' ? null : parseFloat(e.target.value) } : x);
              setState({ ...state, manualBuffs: next });
            }} />
          <button onClick={() => setState({ ...state, manualBuffs: state.manualBuffs.filter((_, idx) => idx !== i) })}>×</button>
        </div>
      ))}
      <button onClick={() => setState({ ...state, manualBuffs: [...state.manualBuffs, { type: '', value: null, enabled: true }] })}>+ 버프 추가</button>
    </div>
  );
}
