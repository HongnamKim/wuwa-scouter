import { useState, useMemo } from 'react';
import type { AppState } from '../state/store';
import type { SubstatLine } from '../engine/context';
import type { Cost, StatKey } from '../types/domain';
import { COST_LAYOUTS, MAIN_PRIMARY, SUBSTAT_STAGES } from '../engine/constants';
import { buildPerfInput } from '../engine/build';
import { computePerf } from '../engine/perf';
import { theoryBest, kkjakPerf, optimalThreeCoModeKkjak } from '../engine/theory';
import { Dropdown, DropdownOption } from './Dropdown';

const MAIN_DEAL_KEYS: StatKey[] = ['attack_percent', 'element_damage_bonus', 'critical_rate', 'critical_damage', 'energy_regen'];
const MAIN_LABEL: Partial<Record<StatKey, string>> = {
  attack_percent: '공%', element_damage_bonus: '속성피해', critical_rate: '크리', critical_damage: '크피', energy_regen: '공효',
};
const SUB_LABEL: Partial<Record<StatKey, string>> = {
  critical_rate: '크리티컬%', critical_damage: '크리티컬 피해%', attack_percent: '공격력%',
  hp_percent: 'HP%', defense_percent: '방어력%', flat_attack: '공격력(깡공)',
  flat_hp: 'HP(깡체력)', flat_defense: '방어력(깡방)', energy_regen: '공명효율%',
  element_damage_bonus: '속성 피해%',
  basic_attack_bonus: '일반공격 피해%', heavy_attack_bonus: '강공격 피해%',
  resonance_skill_bonus: '공명스킬 피해%', resonance_liberation_bonus: '공명해방 피해%',
};
const SUB_OPTION_KEYS = Object.keys(SUB_LABEL) as StatKey[];

function mainOptionsFor(cost: Cost): StatKey[] {
  return (Object.keys(MAIN_PRIMARY[cost]) as StatKey[]).filter((k) => MAIN_DEAL_KEYS.includes(k));
}

/** 에코 한 칸 편집기(메인 + 부옵 5줄). readOnly면 같은 디자인의 읽기 전용. */
function EchoEditor({ cost, main, subs, optionList, readOnly, onMain, onSub }: {
  cost: Cost; main: StatKey; subs: SubstatLine[]; optionList: DropdownOption[]; readOnly?: boolean;
  onMain?: (k: StatKey) => void; onSub?: (li: number, patch: Partial<SubstatLine>) => void;
}) {
  return (
    <>
      <div className="sub-row">
        <span className="muted" style={{ minWidth: 44 }}>메인</span>
        <Dropdown className="dd-grow" value={main} readOnly={readOnly}
          options={mainOptionsFor(cost).map((k) => ({ value: k, label: `${MAIN_LABEL[k]} (${MAIN_PRIMARY[cost][k]}%)` }))}
          onChange={(v) => onMain?.(v as StatKey)} />
      </div>
      {subs.map((line, li) => {
        const stages = line.type ? SUBSTAT_STAGES[line.type] : undefined;
        const suffix = line.type && line.type.startsWith('flat') ? '' : '%';
        const valueOptions = stages
          ? [{ value: '', label: '수치' }, ...stages.map((v) => ({ value: String(v), label: `${v}${suffix}` }))]
          : [{ value: '', label: '-' }];
        return (
          <div className="sub-row" key={li}>
            <Dropdown className="dd-grow" value={line.type} readOnly={readOnly} options={optionList}
              onChange={(v) => onSub?.(li, { type: v as StatKey | '', value: null })} />
            <Dropdown className="dd-narrow" value={line.value != null ? String(line.value) : ''} readOnly={readOnly} options={valueOptions}
              onChange={(v) => onSub?.(li, { value: v === '' ? null : parseFloat(v) })} />
          </div>
        );
      })}
    </>
  );
}

/**
 * 부옵 교체 비교: [내 에코] ↓ [교체할 에코]로 한 슬롯을 바꿨을 때
 * 딜 상승 수치/증감%/최고점 대비/크크작 대비 변화를 세로로 표시. 코스트는 선택 슬롯 고정.
 */
export function SubstatSwapCompare({ base }: { base: AppState }) {
  const layout = COST_LAYOUTS[base.costLayout];
  const [slot, setSlot] = useState(0);
  const [main, setMain] = useState<StatKey>(base.mainPrimary[slot].type);
  const [subs, setSubs] = useState<SubstatLine[]>(base.substats[slot]);

  const selectSlot = (i: number) => { setSlot(i); setMain(base.mainPrimary[i].type); setSubs(base.substats[i]); };
  const updateSub = (li: number, patch: Partial<SubstatLine>) =>
    setSubs(subs.map((l, idx) => (idx === li ? { ...l, ...patch } : l)));

  const cost = layout[slot];

  // 분모(최고점·크크작)는 슬롯 교체와 무관(빌드 고정) → 한 번만 계산
  const { best, kkjak } = useMemo(() => ({
    best: theoryBest(base).perf,
    kkjak: kkjakPerf(base, optimalThreeCoModeKkjak(base)),
  }), [base]);

  const current = computePerf(buildPerfInput(base));
  const swappedMain = base.mainPrimary.map((p, i) => (i === slot ? { cost, type: main } : p));
  const swappedSubs = base.substats.map((s, i) => (i === slot ? subs : s));
  const compared = computePerf(buildPerfInput({ ...base, mainPrimary: swappedMain, substats: swappedSubs }));
  const diff = (compared / current - 1) * 100;

  const eff = base.character.effective_substats;
  const orderedKeys: StatKey[] = [...eff.filter((k) => SUB_LABEL[k]), ...SUB_OPTION_KEYS.filter((k) => !eff.includes(k))];
  const optionList: DropdownOption[] = [
    { value: '', label: '옵션 선택' },
    ...orderedKeys.map((k) => ({ value: k, label: (eff.includes(k) ? '★ ' : '') + SUB_LABEL[k] })),
  ];

  const pct = (n: number, d: number) => `${(n / d * 100).toFixed(1)}%`;

  return (
    <div>
      <div className="setting-row" style={{ margin: '8px 0', gap: 8 }}>
        <span className="muted">교체할 에코</span>
        <Dropdown value={String(slot)}
          options={layout.map((c, i) => ({
            value: String(i),
            label: `${i + 1}번 (${c}코 · ${MAIN_LABEL[base.mainPrimary[i].type] ?? base.mainPrimary[i].type})`,
          }))}
          onChange={(v) => selectSlot(Number(v))} />
      </div>

      <div className="swap-cols">
        <div className="swap-echo">
          <div className="swap-echo-title">내 에코</div>
          <EchoEditor cost={cost} main={base.mainPrimary[slot].type} subs={base.substats[slot]} optionList={optionList} readOnly />
        </div>

        <div className="swap-arrow"><span className="arrow-h">→</span><span className="arrow-v">↓</span></div>

        <div className="swap-echo">
          <div className="swap-echo-title">교체할 에코</div>
          <EchoEditor cost={cost} main={main} subs={subs} optionList={optionList} onMain={setMain} onSub={updateSub} />
        </div>
      </div>

      <div className="swap-results">
        <div><span className="swap-res-lbl">딜 상승 수치</span>{current.toFixed(0)} → {compared.toFixed(0)}</div>
        <div>
          <span className="swap-res-lbl">증감</span>
          <span style={{ fontWeight: 'bold', color: diff > 0 ? '#15803d' : diff < 0 ? '#b91c1c' : undefined }}>
            {diff >= 0 ? '+' : ''}{diff.toFixed(2)}%
          </span>
        </div>
        <div><span className="swap-res-lbl">최고점 대비</span>{pct(current, best)} → {pct(compared, best)}</div>
        <div><span className="swap-res-lbl">크크작 대비</span>{pct(current, kkjak)} → {pct(compared, kkjak)}</div>
      </div>
    </div>
  );
}
