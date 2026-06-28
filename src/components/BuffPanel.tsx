import type { AppState } from '../state/store';
import type { Buff } from '../types/data';
import type { StatKey } from '../types/domain';
import { Dropdown } from './Dropdown';

const BUFF_TYPES: { key: StatKey; label: string }[] = [
  { key: 'critical_rate', label: '크리티컬%' }, { key: 'critical_damage', label: '크리티컬 피해%' },
  { key: 'element_damage_bonus', label: '속성피해% 증가' }, { key: 'element_damage_amplify', label: '속성피해% 부스트' },
  { key: 'all_damage_amplify', label: '전체 피해% 부스트' }, { key: 'attack_percent', label: '공격력%' },
  { key: 'defense_ignore', label: '방어력 무시%' }, { key: 'element_resistance_ignore', label: '속성 저항 무시%' },
];

interface Props { state: AppState; setState: (s: AppState) => void; }

export function BuffPanel({ state, setState }: Props) {
  // 조건부 토글 목록(상시 제외)을 출처별로 그룹핑 (중복 세트는 한 번만)
  const uniqueSets = state.echoSets.filter((s, i) => state.echoSets.findIndex((x) => x.id === s.id) === i);
  const condGroups: { source: string; buffs: Buff[] }[] = [
    { source: '고유 스킬', buffs: state.character.skill_node },
    { source: '무기', buffs: state.weapon.buffs },
    ...uniqueSets.map((s) => ({ source: s.name, buffs: s.buffs })),
    { source: '메인 에코', buffs: state.mainEcho.buffs },
  ]
    .map((g) => ({
      source: g.source,
      // 조건부(상시 제외)만 노출. 돌파 미달 버프도 보여주되 아래에서 비활성화 처리
      buffs: g.buffs.filter((b) => !b.always && b.id),
    }))
    .filter((g) => g.buffs.length > 0);

  // 돌파 조건 미달 → 잠금(체크 불가)
  const isLocked = (b: Buff) => b.min_ascension != null && (state.ascensionLevel ?? 0) < b.min_ascension;

  // 라벨의 {v}를 현재 수치로 치환. 무기 버프는 공진(refinement_values)에 따라 값이 변함.
  const ref = state.refinementLevel ?? 1;
  const labelText = (b: Buff) => {
    if (!b.label) return '';
    const v = b.refinement_values ? (b.refinement_values[ref - 1] ?? b.value) : b.value;
    const text = b.type.startsWith('flat') ? String(v) : `${+(v * 100).toFixed(1)}%`;
    return b.label.replace('{v}', text);
  };

  // 전체 토글: 잠기지 않은 조건부 + 파티/기타 버프를 일괄 on/off
  const condIds = condGroups.flatMap((g) => g.buffs.filter((b) => !isLocked(b)).map((b) => b.id!));
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
          {g.buffs.map((b) => {
            const locked = isLocked(b);
            return (
            <label key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 4, width: 'fit-content', color: locked ? '#aaa' : undefined, cursor: locked ? 'not-allowed' : undefined }}>
              <input type="checkbox" disabled={locked} checked={!locked && (state.conditionalToggles[b.id!] ?? true)}
                onChange={(e) => setState({ ...state, conditionalToggles: { ...state.conditionalToggles, [b.id!]: e.target.checked } })} />
              <span>{labelText(b)}{locked ? ` (돌파 ${b.min_ascension} 필요)` : ''}</span>
            </label>
            );
          })}
        </div>
      ))}
      <div className="muted" style={{ margin: '6px 0 2px', fontWeight: 'bold' }}>파티/기타 버프</div>
      {state.manualBuffs.map((mb, i) => (
        <div className="sub-row" key={i}>
          <input type="checkbox" checked={mb.enabled !== false} onChange={(e) => {
            const next = state.manualBuffs.map((x, idx) => idx === i ? { ...x, enabled: e.target.checked } : x);
            setState({ ...state, manualBuffs: next });
          }} />
          <Dropdown value={mb.type}
            options={[{ value: '', label: '유형' }, ...BUFF_TYPES.map((t) => ({ value: t.key, label: t.label }))]}
            onChange={(v) => {
              const next = state.manualBuffs.map((x, idx) => idx === i ? { ...x, type: v as StatKey | '' } : x);
              setState({ ...state, manualBuffs: next });
            }} />
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
