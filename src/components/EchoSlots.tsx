import { useState } from 'react';
import type { AppState } from '../state/store';
import type { Cost, StatKey } from '../types/domain';
import { availableCostsForSlot, defaultMainForCost } from '../engine/echoSlots';
import { sumEffectiveTotal } from '../engine/build';
import { effectiveSubstatsOf } from '../engine/mode';
import { Dropdown, DropdownOption } from './Dropdown';
import { EchoEditor, SUB_LABEL, SUB_OPTION_KEYS, mainOptionsFor, pairScaleSubstats, MAIN_SHORT } from './EchoEditor';

interface Props { state: AppState; setState: (s: AppState) => void; }

const ROMAN = ['Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ', 'Ⅴ'];

// 유효옵 합 표 헤더(풀텍스트). flat 스탯은 "깡~" 대신 공격력/체력/방어력으로.
const FLAT_LABEL: Partial<Record<StatKey, string>> = {
  flat_attack: '공격력', flat_hp: '체력', flat_defense: '방어력',
};
const sumLabel = (k: StatKey): string => FLAT_LABEL[k] ?? SUB_LABEL[k] ?? k;

export function EchoSlots({ state, setState }: Props) {
  const [active, setActive] = useState(0);
  const layout = state.costLayout;
  if (layout == null || state.slots.length === 0) {
    return <p className="muted" style={{ margin: '4px 0' }}>코스트 구성을 먼저 선택하세요.</p>;
  }
  const slot = state.slots[active];

  // 부옵 옵션 순서: 유효옵(★) → 공명 효율(유효옵 아니어도 사이클상 중요) → 나머지. 스케일 %↔깡은 인접.
  const eff = effectiveSubstatsOf(state);
  const midKeys: StatKey[] = eff.includes('energy_regen') ? [] : ['energy_regen'];
  const orderedKeys: StatKey[] = pairScaleSubstats([
    ...eff.filter((k) => SUB_LABEL[k]),
    ...midKeys.filter((k) => SUB_LABEL[k]),
    ...SUB_OPTION_KEYS.filter((k) => !eff.includes(k) && k !== 'energy_regen'),
  ]);
  const optionList: DropdownOption[] = [
    { value: '', label: '옵션 선택' },
    ...orderedKeys.map((k) => ({ value: k, label: (eff.includes(k) ? '★ ' : '') + SUB_LABEL[k] })),
  ];

  const patchSlot = (i: number, patch: Partial<AppState['slots'][number]>) =>
    setState({ ...state, slots: state.slots.map((s, si) => (si === i ? { ...s, ...patch } : s)) });

  // 코스트 드롭다운: 미배정 + 남은 코스트(자기 것 포함)
  const costOptions: DropdownOption[] = [
    { value: '', label: '코스트' },
    ...availableCostsForSlot(layout, state.slots, active).map((c) => ({ value: String(c), label: `${c}코` })),
  ];
  const onCostChange = (v: string) => {
    if (v === '') { patchSlot(active, { cost: null, main: '' }); return; }
    const newCost = Number(v) as Cost;
    const valid = mainOptionsFor(newCost, state.character.matrix_cost, state.character.scale_stat);
    const newMain = slot.main && valid.includes(slot.main) ? slot.main : defaultMainForCost(newCost, state.character.scale_stat);
    patchSlot(active, { cost: newCost, main: newMain });
  };
  const onMainChange = (k: StatKey) => patchSlot(active, { main: k });
  const onSubChange = (li: number, patch: Partial<AppState['slots'][number]['substats'][number]>) =>
    patchSlot(active, { substats: slot.substats.map((l, idx) => (idx === li ? { ...l, ...patch } : l)) });

  const sum = sumEffectiveTotal(state);

  return (
    <div className="echo-slots">
      {/* 제목 바로 아래: 전체 에코 유효옵 합 */}
      <table style={{ marginBottom: 14 }}>
        <thead><tr>{eff.map((k) => <th key={k}>{sumLabel(k)}</th>)}</tr></thead>
        <tbody><tr>{eff.map((k) => <td key={k}>{(sum[k] ?? 0).toFixed(k.startsWith('flat') ? 0 : 1)}</td>)}</tr></tbody>
      </table>

      {/* 아래: 에코 슬롯 편집 (탭 → 코스트 → 메인 → 부옵) */}
      <div className="echo-tabs">
        {state.slots.map((s, i) => (
          <button key={i} className={i === active ? 'echo-tab active' : 'echo-tab'} onClick={() => setActive(i)}>
            <span>에코 {ROMAN[i]}</span>
            <span className="echo-tab-cost">{s.cost != null ? `${s.cost}코${s.main ? ' ' + (MAIN_SHORT[s.main] ?? s.main) : ''}` : '-'}</span>
          </button>
        ))}
      </div>

      {/* 선택한 에코의 코스트 → 메인 → 부옵 */}
      <div className="sub-row">
        <span className="muted" style={{ minWidth: 44 }}>코스트</span>
        <Dropdown className="dd-grow" value={slot.cost != null ? String(slot.cost) : ''} options={costOptions} onChange={onCostChange} />
      </div>
      <EchoEditor cost={slot.cost} main={slot.main} subs={slot.substats} optionList={optionList} matrixCost={state.character.matrix_cost} scaleStat={state.character.scale_stat} onMain={onMainChange} onSub={onSubChange} />
    </div>
  );
}
