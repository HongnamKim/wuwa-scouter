import type { SubstatLine } from '../engine/context';
import type { Cost, StatKey, ScaleStat } from '../types/domain';
import { MAIN_PRIMARY, SUBSTAT_STAGES } from '../engine/constants';
import { Dropdown, DropdownOption } from './Dropdown';

// 4코 메인 표시 순서 (matrix_cost 역할별). matrix_cost 1=딜러, 2=지원가.
const COST4_ORDER_DPS: StatKey[] = ['critical_damage', 'critical_rate', 'attack_percent', 'defense_percent', 'healing_bonus'];
const COST4_ORDER_SUPPORT: StatKey[] = ['healing_bonus', 'defense_percent', 'critical_damage', 'critical_rate', 'attack_percent'];
// 3코 메인 표시 순서 (고정)
const COST3_ORDER: StatKey[] = ['attack_percent', 'element_damage_bonus', 'energy_regen', 'hp_percent', 'defense_percent'];
// 1코: scale_stat에 해당하는 % 옵션을 맨 위에
const SCALE_TO_PERCENT: Record<ScaleStat, StatKey> = { attack: 'attack_percent', hp: 'hp_percent', defense: 'defense_percent' };

export const MAIN_LABEL: Partial<Record<StatKey, string>> = {
  attack_percent: '공격력%', element_damage_bonus: '속성 피해', critical_rate: '크리티컬', critical_damage: '크리티컬 피해', energy_regen: '공명 효율',
  hp_percent: 'HP%', defense_percent: '방어력%', healing_bonus: '치료 효과 보너스',
};
export const SUB_LABEL: Partial<Record<StatKey, string>> = {
  critical_rate: '크리티컬%', critical_damage: '크리티컬 피해%', attack_percent: '공격력%',
  hp_percent: 'HP%', defense_percent: '방어력%', flat_attack: '공격력(깡공)',
  flat_hp: 'HP(깡체력)', flat_defense: '방어력(깡방)', energy_regen: '공명효율%',
  element_damage_bonus: '속성 피해%',
  basic_attack_bonus: '일반공격 피해%', heavy_attack_bonus: '강공격 피해%',
  resonance_skill_bonus: '공명스킬 피해%', resonance_liberation_bonus: '공명해방 피해%',
};
export const SUB_OPTION_KEYS = Object.keys(SUB_LABEL) as StatKey[];

export function mainOptionsFor(cost: Cost | null, matrixCost = 1, scaleStat: ScaleStat = 'attack'): StatKey[] {
  if (cost == null) return [];
  const all = Object.keys(MAIN_PRIMARY[cost]) as StatKey[];
  // 모든 코스트가 전체 메인 옵션을 노출하되, 코스트별로 순서만 다르게. 미지정 나머지는 뒤에.
  let order: StatKey[];
  if (cost === 4) order = matrixCost === 2 ? COST4_ORDER_SUPPORT : COST4_ORDER_DPS;
  else if (cost === 3) order = COST3_ORDER;
  else order = [SCALE_TO_PERCENT[scaleStat]]; // 1코: scale_stat % 맨 위
  const ordered = order.filter((k) => all.includes(k));
  return [...ordered, ...all.filter((k) => !ordered.includes(k))];
}

/** 에코 한 칸 편집기(메인 + 부옵 5줄). readOnly면 같은 디자인의 읽기 전용. cost 미배정(null) 시 메인은 안내 문구만. */
export function EchoEditor({ cost, main, subs, optionList, matrixCost = 1, scaleStat = 'attack', readOnly, onMain, onSub }: {
  cost: Cost | null; main: StatKey | ''; subs: SubstatLine[]; optionList: DropdownOption[];
  matrixCost?: number; scaleStat?: ScaleStat; readOnly?: boolean;
  onMain?: (k: StatKey) => void; onSub?: (li: number, patch: Partial<SubstatLine>) => void;
}) {
  const mainOptions: DropdownOption[] = cost == null
    ? [{ value: '', label: '-' }]
    : mainOptionsFor(cost, matrixCost, scaleStat).map((k) => ({ value: k, label: `${MAIN_LABEL[k] ?? SUB_LABEL[k] ?? k} (${MAIN_PRIMARY[cost][k]}%)` }));
  return (
    <>
      <div className="sub-row">
        <span className="muted" style={{ minWidth: 44 }}>메인</span>
        <Dropdown className="dd-grow" value={main} readOnly={readOnly || cost == null}
          options={mainOptions}
          onChange={(v) => onMain?.(v as StatKey)} />
      </div>
      <div className="echo-subs">
      {subs.map((line, li) => {
        const stages = line.type ? SUBSTAT_STAGES[line.type] : undefined;
        const suffix = line.type && line.type.startsWith('flat') ? '' : '%';
        const valueOptions = stages
          ? [{ value: '', label: '수치' }, ...stages.map((v) => ({ value: String(v), label: `${v}${suffix}` }))]
          : [{ value: '', label: '-' }];
        // 같은 에코 내 다른 줄에서 이미 고른 부옵은 제외(중복 선택 방지). 빈값·본인 현재값은 유지.
        const used = new Set(subs.filter((_, idx) => idx !== li).map((l) => l.type).filter(Boolean));
        const lineOptions = optionList.filter((o) => o.value === '' || o.value === line.type || !used.has(o.value as StatKey));
        return (
          <div className="sub-row" key={li}>
            <Dropdown className="dd-sub" value={line.type} readOnly={readOnly} options={lineOptions}
              onChange={(v) => onSub?.(li, { type: v as StatKey | '', value: null })} />
            <Dropdown className="dd-subval" value={line.value != null ? String(line.value) : ''} readOnly={readOnly} options={valueOptions}
              onChange={(v) => onSub?.(li, { value: v === '' ? null : parseFloat(v) })} />
          </div>
        );
      })}
      </div>
    </>
  );
}
