import type { AppState } from '../state/store';
import { COST_LAYOUTS, MAIN_PRIMARY } from '../engine/constants';
import type { Cost, StatKey } from '../types/domain';
import { Dropdown } from './Dropdown';

const DEAL_KEYS: StatKey[] = ['attack_percent', 'element_damage_bonus', 'critical_rate', 'critical_damage', 'energy_regen'];
const LABEL: Partial<Record<StatKey, string>> = {
  attack_percent: '공%', element_damage_bonus: '속성피해', critical_rate: '크리', critical_damage: '크피', energy_regen: '공효',
};

function optionsFor(cost: Cost): StatKey[] {
  return (Object.keys(MAIN_PRIMARY[cost]) as StatKey[]).filter((k) => DEAL_KEYS.includes(k));
}

interface Props { state: AppState; setState: (s: AppState) => void; }

export function MainPrimaryTable({ state, setState }: Props) {
  const layout = COST_LAYOUTS[state.costLayout];
  return (
    <table>
      <thead><tr><th>슬롯</th><th>코스트</th><th>메인 primary</th></tr></thead>
      <tbody>
        {layout.map((cost, i) => (
          <tr key={i}>
            <td>{i + 1}</td><td>{cost}코</td>
            <td>
              <Dropdown value={state.mainPrimary[i]?.type ?? optionsFor(cost)[0]}
                options={optionsFor(cost).map((k) => ({ value: k, label: `${LABEL[k]} (${MAIN_PRIMARY[cost][k]}%)` }))}
                onChange={(v) => {
                  const next = state.mainPrimary.map((p, idx) => idx === i ? { cost, type: v as StatKey } : p);
                  setState({ ...state, mainPrimary: next });
                }} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
