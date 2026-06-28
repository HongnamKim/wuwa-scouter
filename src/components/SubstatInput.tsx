import { useState } from 'react';
import type { AppState } from '../state/store';
import { emptySubstats } from '../state/store';
import { recommendedMainPicks } from '../engine/theory';
import { SUBSTAT_STAGES } from '../engine/constants';
import { sumEffectiveSubstats } from '../engine/build';
import { Dropdown } from './Dropdown';
import type { StatKey } from '../types/domain';

const SUB_LABEL: Partial<Record<StatKey, string>> = {
  critical_rate: '크리티컬%', critical_damage: '크리티컬 피해%', attack_percent: '공격력%',
  hp_percent: 'HP%', defense_percent: '방어력%', flat_attack: '공격력(깡공)',
  flat_hp: 'HP(깡체력)', flat_defense: '방어력(깡방)', energy_regen: '공명효율%',
  element_damage_bonus: '속성 피해%',
  basic_attack_bonus: '일반공격 피해%', heavy_attack_bonus: '강공격 피해%',
  resonance_skill_bonus: '공명스킬 피해%', resonance_liberation_bonus: '공명해방 피해%',
};
const OPTION_KEYS = Object.keys(SUB_LABEL) as StatKey[];

interface Props { state: AppState; setState: (s: AppState) => void; }

export function SubstatInput({ state, setState }: Props) {
  const [active, setActive] = useState(0);
  const roman = ['Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ', 'Ⅴ'];
  const lines = state.substats[active];

  function update(li: number, patch: { type?: StatKey | ''; value?: number | null }) {
    const next = state.substats.map((echo, ei) =>
      ei !== active ? echo : echo.map((line, idx) => (idx === li ? { ...line, ...patch } : line)));
    setState({ ...state, substats: next });
  }

  const sum = sumEffectiveSubstats(state);

  // 옵션 순서: 캐릭터 유효옵을 상단(★), 그 외는 뒤에
  const eff = state.character.effective_substats;
  const orderedKeys: StatKey[] = [
    ...eff.filter((k) => SUB_LABEL[k]),
    ...OPTION_KEYS.filter((k) => !eff.includes(k)),
  ];
  const optionList = [
    { value: '', label: '옵션 선택' },
    ...orderedKeys.map((k) => ({ value: k, label: (eff.includes(k) ? '★ ' : '') + SUB_LABEL[k] })),
  ];

  return (
    <div>
      <div className="echo-tabs">
        {roman.map((r, i) => (
          <button key={i} className={i === active ? 'echo-tab active' : 'echo-tab'} onClick={() => setActive(i)}>
            에코 {r}
          </button>
        ))}
      </div>
      {lines.map((line, li) => {
        const stages = line.type ? SUBSTAT_STAGES[line.type] : undefined;
        const suffix = line.type && line.type.startsWith('flat') ? '' : '%';
        const valueOptions = stages
          ? [{ value: '', label: '수치' }, ...stages.map((v) => ({ value: String(v), label: `${v}${suffix}` }))]
          : [{ value: '', label: '-' }];
        return (
          <div className="sub-row" key={li}>
            <Dropdown className="dd-grow" value={line.type} options={optionList}
              onChange={(v) => update(li, { type: v as StatKey | '', value: null })} />
            <Dropdown className="dd-narrow" value={line.value != null ? String(line.value) : ''}
              options={valueOptions}
              onChange={(v) => update(li, { value: v === '' ? null : parseFloat(v) })} />
          </div>
        );
      })}
      <table style={{ marginTop: 12 }}>
        <thead><tr><th>유효옵 합</th><th>크리%</th><th>크피%</th><th>공%</th><th>해방%</th><th>깡공</th></tr></thead>
        <tbody><tr>
          <td></td>
          <td>{(sum.critical_rate ?? 0).toFixed(1)}</td>
          <td>{(sum.critical_damage ?? 0).toFixed(1)}</td>
          <td>{(sum.attack_percent ?? 0).toFixed(1)}</td>
          <td>{(sum.resonance_liberation_bonus ?? 0).toFixed(1)}</td>
          <td>{(sum.flat_attack ?? 0).toFixed(0)}</td>
        </tr></tbody>
      </table>
      <button
        style={{ marginTop: 8 }}
        onClick={() => setState({ ...state, mainPrimary: recommendedMainPicks(state), substats: emptySubstats() })}
      >
        입력 초기화
      </button>
    </div>
  );
}
