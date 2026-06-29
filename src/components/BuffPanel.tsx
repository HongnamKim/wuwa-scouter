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
  // 출처별 그룹. 무기·에코 세트·메인 에코는 패시브(상시)도 함께 노출(체크박스 비활성, 글씨는 검정).
  // 고유 스킬만 조건부 노출.
  const uniqueSets = state.echoSets.filter((s, i) => state.echoSets.findIndex((x) => x.id === s.id) === i);
  type Item = { b: Buff; passive: boolean };
  const condGroups: { source: string; items: Item[] }[] = [
    { source: '고유 스킬', buffs: state.character.skill_node, withPassive: false },
    { source: '무기', buffs: state.weapon.buffs, withPassive: true },
    ...uniqueSets.map((s) => ({ source: s.name, buffs: s.buffs, withPassive: true })),
    { source: '메인 에코', buffs: state.mainEcho.buffs, withPassive: true },
  ]
    .map((g) => ({
      source: g.source,
      // 조건부(id 보유) + (세트/메인에코면) 상시 패시브. 돌파 미달 버프도 보여주되 아래에서 비활성
      items: g.buffs
        .filter((b) => (g.withPassive ? (!!b.id || !!b.always) : (!b.always && !!b.id)))
        .map((b): Item => ({ b, passive: !!b.always })),
    }))
    .filter((g) => g.items.length > 0);

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

  // 라벨이 없는 패시브는 유형+수치로 표기(원소피해는 원소명으로)
  const STAT_LABEL: Partial<Record<StatKey, string>> = {
    critical_rate: '크리티컬', critical_damage: '크리티컬 피해', attack_percent: '공격력',
    hp_percent: 'HP', defense_percent: '방어력',
    element_damage_bonus: '속성피해', element_damage_amplify: '속성피해', all_damage_amplify: '전체 피해',
    basic_attack_bonus: '일반공격 피해', heavy_attack_bonus: '강공격 피해', basic_attack_amplify: '일반공격 피해', heavy_attack_amplify: '강공격 피해',
    resonance_skill_bonus: '공명스킬 피해', resonance_liberation_bonus: '공명해방 피해',
    resonance_skill_amplify: '공명스킬 피해', resonance_liberation_amplify: '공명해방 피해',
    echo_skill_bonus: '에코 피해', echo_skill_amplify: '에코 피해', energy_regen: '공명 효율',
    defense_ignore: '방어력 무시', element_resistance_ignore: '속성 저항 무시',
    flat_attack: '공격력(깡공)', flat_hp: 'HP(깡체력)', flat_defense: '방어력(깡방)',
  };
  const describe = (b: Buff) => {
    if (b.label) return labelText(b);
    // 무기 패시브는 공진(refinement_values)에 따라 값이 변함
    const raw = b.refinement_values ? (b.refinement_values[ref - 1] ?? b.value) : b.value;
    const v = b.type.startsWith('flat') ? String(raw) : `${+(raw * 100).toFixed(1)}%`;
    const name = ((b.type === 'element_damage_bonus' || b.type === 'element_damage_amplify') && b.element)
      ? `${b.element}피해` : (STAT_LABEL[b.type] ?? b.type);
    // 피해 보너스 = 증가, 피해 증폭 = 부스트 (명확히 구분)
    const suffix = b.type.endsWith('_amplify') ? ' 부스트' : (b.type.endsWith('_bonus') ? ' 증가' : '');
    return `${name} +${v}${suffix}`;
  };

  // 전체 토글: 잠기지 않은 조건부 + 파티/기타 버프를 일괄 on/off
  const condIds = condGroups.flatMap((g) => g.items.filter((it) => !it.passive && !!it.b.id && !isLocked(it.b)).map((it) => it.b.id!));
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
          {g.items.map(({ b, passive }, idx) => {
            const locked = !passive && isLocked(b);
            const checked = passive ? true : (!locked && (state.conditionalToggles[b.id!] ?? true));
            return (
            <label key={b.id ?? `${g.source}-${idx}`} style={{ display: 'flex', alignItems: 'center', gap: 4, width: 'fit-content', color: locked ? '#aaa' : undefined, cursor: (passive || locked) ? 'default' : undefined }}>
              <input type="checkbox" disabled={passive || locked} checked={checked}
                onChange={(e) => { if (passive) return; setState({ ...state, conditionalToggles: { ...state.conditionalToggles, [b.id!]: e.target.checked } }); }} />
              <span>{describe(b)}{locked ? ` (돌파 ${b.min_ascension} 필요)` : passive ? ' (상시)' : ''}</span>
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
