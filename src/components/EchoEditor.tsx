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
/** 에코 탭 등 좁은 곳에 쓰는 메인 옵션 짧은 라벨 */
export const MAIN_SHORT: Partial<Record<StatKey, string>> = {
  attack_percent: '공%', hp_percent: 'HP%', defense_percent: '방%',
  critical_rate: '크리', critical_damage: '크피', energy_regen: '공효',
  element_damage_bonus: '속피', healing_bonus: '치료',
};
// 순서 = 부옵 옵션 드롭다운의 기본 나열 순서. 스케일 스탯은 %와 깡을 붙여서 나열(공격력%↔깡공 등).
export const SUB_LABEL: Partial<Record<StatKey, string>> = {
  critical_rate: '크리티컬%', critical_damage: '크리티컬 피해%',
  attack_percent: '공격력%', flat_attack: '공격력(깡공)',
  hp_percent: 'HP%', flat_hp: 'HP(깡체력)',
  defense_percent: '방어력%', flat_defense: '방어력(깡방)',
  energy_regen: '공명효율%',
  element_damage_bonus: '속성 피해%',
  basic_attack_bonus: '일반공격 피해%', heavy_attack_bonus: '강공격 피해%',
  resonance_skill_bonus: '공명스킬 피해%', resonance_liberation_bonus: '공명해방 피해%',
};
// 실제로 부옵으로 굴릴 수 없는 옵션(메인 전용)은 부옵 드롭다운에서 제외. 속성 피해는 4코 메인 전용.
const MAIN_ONLY_STATS: StatKey[] = ['element_damage_bonus'];
export const SUB_OPTION_KEYS = (Object.keys(SUB_LABEL) as StatKey[]).filter((k) => !MAIN_ONLY_STATS.includes(k));

const FLAT_OF: Partial<Record<StatKey, StatKey>> = {
  attack_percent: 'flat_attack', hp_percent: 'flat_hp', defense_percent: 'flat_defense',
};
/** 스케일 스탯의 %와 깡을 인접시킨다(예: 공격력% 바로 뒤에 공격력(깡공)). % 위치 기준, 깡은 짝의 뒤로 이동. */
export function pairScaleSubstats(keys: StatKey[]): StatKey[] {
  const flatSet = new Set(Object.values(FLAT_OF));
  const out: StatKey[] = [];
  for (const k of keys) {
    // 짝(%)이 목록에 있는 깡은 여기서 건너뛰고 % 뒤에서 삽입
    if (flatSet.has(k) && keys.some((x) => FLAT_OF[x] === k)) continue;
    out.push(k);
    const flat = FLAT_OF[k];
    if (flat && keys.includes(flat)) out.push(flat);
  }
  return out;
}

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
export function EchoEditor({ cost, main, subs, optionList, matrixCost = 1, scaleStat = 'attack', readOnly, onMain, onSub, orig }: {
  cost: Cost | null; main: StatKey | ''; subs: SubstatLine[]; optionList: DropdownOption[];
  matrixCost?: number; scaleStat?: ScaleStat; readOnly?: boolean;
  onMain?: (k: StatKey) => void; onSub?: (li: number, patch: Partial<SubstatLine>) => void;
  orig?: { main: StatKey | ''; subs: SubstatLine[] }; // 지정 시 원본과 달라진 옵션 배경 강조
}) {
  const mainChanged = !!orig && main !== orig.main;
  // 원본 대비 부옵 변화: 위치가 아니라 '집합'으로 비교 — 순서만 바뀐 건 변화로 보지 않음.
  const subKey = (l: SubstatLine): string | null => (l.type && l.value != null ? `${l.type}|${l.value}` : null);
  const changedLine: boolean[] = (() => {
    if (!orig) return subs.map(() => false);
    const pool = new Map<string, number>();
    for (const l of orig.subs) { const k = subKey(l); if (k) pool.set(k, (pool.get(k) ?? 0) + 1); }
    return subs.map((l) => {
      const k = subKey(l);
      if (!k) return false;                              // 빈 줄은 강조 안 함
      const n = pool.get(k) ?? 0;
      if (n > 0) { pool.set(k, n - 1); return false; }   // 원본에 있던 값 → 변화 아님
      return true;                                       // 원본 어디에도 없는 값 → 변화
    });
  })();
  const mainOptions: DropdownOption[] = cost == null
    ? [{ value: '', label: '-' }]
    : mainOptionsFor(cost, matrixCost, scaleStat).map((k) => ({ value: k, label: `${MAIN_LABEL[k] ?? SUB_LABEL[k] ?? k} (${MAIN_PRIMARY[cost][k]}%)` }));
  return (
    <>
      <div className="sub-row">
        <span className="muted" style={{ minWidth: 44 }}>메인</span>
        <Dropdown className={'dd-grow' + (mainChanged ? ' dd-changed' : '')} value={main} readOnly={readOnly || cost == null}
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
        const subChanged = changedLine[li];
        return (
          <div className="sub-row" key={li}>
            <Dropdown className={'dd-sub' + (subChanged ? ' dd-changed' : '')} value={line.type} readOnly={readOnly} options={lineOptions}
              onChange={(v) => onSub?.(li, { type: v as StatKey | '', value: null })} />
            <Dropdown className={'dd-subval' + (subChanged ? ' dd-changed' : '')} value={line.value != null ? String(line.value) : ''} readOnly={readOnly} options={valueOptions}
              onChange={(v) => onSub?.(li, { value: v === '' ? null : parseFloat(v) })} />
          </div>
        );
      })}
      </div>
    </>
  );
}
