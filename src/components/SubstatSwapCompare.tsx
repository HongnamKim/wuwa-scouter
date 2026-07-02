import { useState, useMemo } from 'react';
import type { AppState } from '../state/store';
import type { SubstatLine } from '../engine/context';
import type { StatKey } from '../types/domain';
import { buildPerfInput } from '../engine/build';
import { computePerf } from '../engine/perf';
import { theoryBest, kkjakPerf, optimalThreeCoModeKkjak } from '../engine/theory';
import { effectiveSubstatsOf } from '../engine/mode';
import { Dropdown, DropdownOption } from './Dropdown';
import { EchoEditor, MAIN_LABEL, SUB_LABEL, SUB_OPTION_KEYS } from './EchoEditor';

/**
 * 부옵 교체 비교: [내 에코] ↓ [교체할 에코]로 한 슬롯을 바꿨을 때
 * 딜 상승 수치/증감%/최고점 대비/크크작 대비 변화를 세로로 표시. 코스트는 선택 슬롯 고정.
 */
export function SubstatSwapCompare({ base }: { base: AppState }) {
  const [slot, setSlot] = useState(0);
  const [main, setMain] = useState<StatKey | ''>(base.slots[slot].main);
  const [subs, setSubs] = useState<SubstatLine[]>(base.slots[slot].substats);

  const selectSlot = (i: number) => { setSlot(i); setMain(base.slots[i].main); setSubs(base.slots[i].substats); };
  const updateSub = (li: number, patch: Partial<SubstatLine>) =>
    setSubs(subs.map((l, idx) => (idx === li ? { ...l, ...patch } : l)));

  const cost = base.slots[slot].cost;

  // 분모(최고점·크크작)는 슬롯 교체와 무관(빌드 고정) → 한 번만 계산
  const { best, kkjak } = useMemo(() => ({
    best: theoryBest(base).perf,
    kkjak: kkjakPerf(base, optimalThreeCoModeKkjak(base)),
  }), [base]);

  const current = computePerf(buildPerfInput(base));
  const compared = computePerf(buildPerfInput({ ...base, slots: base.slots.map((s, i) => i === slot ? { ...s, main, substats: subs } : s) }));
  const diff = (compared / current - 1) * 100;

  const eff = effectiveSubstatsOf(base);
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
          options={base.slots.map((s, i) => ({
            value: String(i),
            label: `${i + 1}번 (${s.cost != null ? `${s.cost}코` : '미배정'} · ${s.main ? (MAIN_LABEL[s.main] ?? s.main) : '-'})`,
          }))}
          onChange={(v) => selectSlot(Number(v))} />
      </div>

      <div className="swap-cols">
        <div className="swap-echo">
          <div className="swap-echo-title">내 에코</div>
          <EchoEditor cost={cost} main={base.slots[slot].main} subs={base.slots[slot].substats} optionList={optionList} matrixCost={base.character.matrix_cost} scaleStat={base.character.scale_stat} readOnly />
        </div>

        <div className="swap-arrow"><span className="arrow-h">→</span><span className="arrow-v">↓</span></div>

        <div className="swap-echo">
          <div className="swap-echo-title">교체할 에코</div>
          <EchoEditor cost={cost} main={main} subs={subs} optionList={optionList} matrixCost={base.character.matrix_cost} scaleStat={base.character.scale_stat} onMain={setMain} onSub={updateSub} />
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
