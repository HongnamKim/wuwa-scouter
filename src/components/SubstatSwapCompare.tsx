import { useState, useMemo } from 'react';
import type { CalcContext, SubstatLine } from '../engine/context';
import type { StatKey, DamageBonusType, ScaleStat } from '../types/domain';
import { buildPerfInput, sumEffectiveTotal, computeEnergyRegen } from '../engine/build';
import { computePerf } from '../engine/perf';
import { computeDisplaySpec } from '../engine/spec';
import { mechanismDamageTypeBonus } from '../engine/mechanisms';
import { theoryBest, kkjakPerf, optimalThreeCoModeKkjak } from '../engine/theory';
import { effectiveSubstatsOf, damageBonusTypeOf } from '../engine/mode';
import { DropdownOption } from './Dropdown';
import { EchoEditor, SUB_LABEL, SUB_OPTION_KEYS, pairScaleSubstats, MAIN_SHORT } from './EchoEditor';

const DMG_TYPE_LABEL: Record<DamageBonusType, string> = {
  basic_attack: '일반공격 피해', heavy_attack: '강공격 피해', resonance_skill: '공명스킬 피해',
  resonance_liberation: '공명해방 피해', echo_skill: '에코 피해',
};
const SCALE_LABEL: Record<ScaleStat, string> = { attack: '공격력', hp: '체력', defense: '방어력' };
const CMP = { fontSize: '1.5rem', lineHeight: 1.2 } as const; // 현재 → 교체후 표시 크기

/** 변화 한 줄: 현재 → 교체 후. 값이 다르면 방향 색상. */
function ChangeRow({ label, a, b, fmt }: { label: string; a: number; b: number; fmt: (v: number) => string }) {
  const diff = b - a;
  const color = Math.abs(diff) < 1e-9 ? '#888' : diff > 0 ? '#15803d' : '#b91c1c';
  return (
    <div style={{ display: 'flex', gap: 10, fontSize: '1.05rem', padding: '3px 0' }}>
      <span style={{ minWidth: 110, color: '#555' }}>{label}</span>
      <span>{fmt(a)} → <b style={{ color }}>{fmt(b)}</b></span>
    </div>
  );
}

/**
 * 에코 교체 비교: 에코 탭(Ⅰ~Ⅴ)별로 [내 에코]→[교체할 에코]를 편집해 여러 에코를 동시에 교체.
 * 모든 교체안을 반영한 딜 상승 수치/최고점/크크작 + 스펙·유효옵 총합 변화를 표시. 코스트는 슬롯 고정.
 */
const ROMAN = ['Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ', 'Ⅴ'];

export function SubstatSwapCompare({ base }: { base: CalcContext }) {
  const [active, setActive] = useState(0); // 편집 중인 에코 탭
  // 슬롯별 교체안(메인/부옵) — 여러 에코를 동시에 교체 비교
  const [edited, setEdited] = useState<{ main: StatKey | ''; substats: SubstatLine[] }[]>(
    () => base.slots.map((s) => ({ main: s.main, substats: s.substats })),
  );
  const setMain = (k: StatKey) => setEdited((e) => e.map((x, i) => (i === active ? { ...x, main: k } : x)));
  const updateSub = (li: number, patch: Partial<SubstatLine>) =>
    setEdited((e) => e.map((x, i) => (i === active ? { ...x, substats: x.substats.map((l, idx) => (idx === li ? { ...l, ...patch } : l)) } : x)));
  const resetActive = () => setEdited((e) => e.map((x, i) => (i === active ? { main: base.slots[active].main, substats: base.slots[active].substats } : x)));
  const activeChanged = base.slots[active].main !== edited[active].main
    || JSON.stringify(base.slots[active].substats) !== JSON.stringify(edited[active].substats);

  const cost = base.slots[active].cost;

  // 분모(최고점·크크작)는 슬롯 교체와 무관(빌드 고정) → 한 번만 계산
  const { best, kkjak } = useMemo(() => ({
    best: theoryBest(base).perf,
    kkjak: kkjakPerf(base, optimalThreeCoModeKkjak(base)),
  }), [base]);

  const comparedCtx: CalcContext = { ...base, slots: base.slots.map((s, i) => ({ ...s, main: edited[i].main, substats: edited[i].substats })) };
  const current = computePerf(buildPerfInput(base));
  const compared = computePerf(buildPerfInput(comparedCtx));
  const diff = (compared / current - 1) * 100;

  // 변화 데이터: 유효옵 총합 / 스펙 / 메커니즘 보너스
  const subA = sumEffectiveTotal(base);
  const subB = sumEffectiveTotal(comparedCtx);
  const specA = computeDisplaySpec(base);
  const specB = computeDisplaySpec(comparedCtx);
  const dmgType = damageBonusTypeOf(base);
  const mechKey = base.character.special_mechanism;
  const mechA = mechKey ? mechanismDamageTypeBonus(mechKey, computeEnergyRegen(base)) : 0;
  const mechB = mechKey ? mechanismDamageTypeBonus(mechKey, computeEnergyRegen(comparedCtx)) : 0;
  const pctv = (v: number) => `${(v * 100).toFixed(1)}%`;

  const eff = effectiveSubstatsOf(base);
  const orderedKeys: StatKey[] = pairScaleSubstats([...eff.filter((k) => SUB_LABEL[k]), ...SUB_OPTION_KEYS.filter((k) => !eff.includes(k))]);
  const optionList: DropdownOption[] = [
    { value: '', label: '옵션 선택' },
    ...orderedKeys.map((k) => ({ value: k, label: (eff.includes(k) ? '★ ' : '') + SUB_LABEL[k] })),
  ];

  const pct = (n: number, d: number) => `${(n / d * 100).toFixed(1)}%`;
  // 최고점/크크작 대비의 %p 변화(교체 후 − 현재)
  const bestPp = (compared - current) / best * 100;
  const kkPp = (compared - current) / kkjak * 100;
  const ppColor = (pp: number) => (pp > 0 ? '#15803d' : pp < 0 ? '#b91c1c' : '#888');
  const fmtPp = (pp: number) => `${pp >= 0 ? '+' : ''}${pp.toFixed(1)}%p`;
  const DELTA = { fontWeight: 'bold', fontSize: '1.1rem' } as const;

  return (
    <div>
      <div className="echo-tabs" style={{ margin: '8px 0' }}>
        {base.slots.map((s, i) => {
          const changed = s.main !== edited[i].main || JSON.stringify(s.substats) !== JSON.stringify(edited[i].substats);
          return (
            <button key={i} type="button" className={i === active ? 'echo-tab active' : 'echo-tab'} onClick={() => setActive(i)}>
              <span>에코 {ROMAN[i]}{changed ? ' *' : ''}</span>
              <span className="echo-tab-cost">{s.cost != null ? `${s.cost}코${s.main ? ' ' + (MAIN_SHORT[s.main] ?? s.main) : ''}` : '-'}</span>
            </button>
          );
        })}
      </div>

      <div className="swap-cols">
        <div className="swap-echo">
          <div className="swap-echo-title">내 에코</div>
          <EchoEditor cost={cost} main={base.slots[active].main} subs={base.slots[active].substats} optionList={optionList} matrixCost={base.character.matrix_cost} scaleStat={base.character.scale_stat} readOnly />
        </div>

        <div className="swap-arrow"><span className="arrow-h">→</span><span className="arrow-v">↓</span></div>

        <div className="swap-echo">
          <div className="swap-echo-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            교체할 에코
            <button type="button" disabled={!activeChanged} onClick={resetActive} style={{ fontSize: '0.78rem', padding: '2px 8px' }}>원래대로</button>
          </div>
          <EchoEditor cost={cost} main={edited[active].main} subs={edited[active].substats} optionList={optionList} matrixCost={base.character.matrix_cost} scaleStat={base.character.scale_stat} onMain={setMain} onSub={updateSub} orig={{ main: base.slots[active].main, subs: base.slots[active].substats }} />
        </div>
      </div>

      {/* 점수: 분석 화면 점수와 동일한 3열 가로 레이아웃 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, margin: '10px 0' }}>
        <div>
          <div className="lbl">딜 상승 수치</div>
          <div style={CMP}>{current.toFixed(0)} → <b>{compared.toFixed(0)}</b></div>
          <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: diff > 0 ? '#15803d' : diff < 0 ? '#b91c1c' : '#888' }}>
            {diff >= 0 ? '+' : ''}{diff.toFixed(2)}%
          </div>
        </div>
        <div>
          <div className="lbl">최고점 대비</div>
          <div style={CMP}>{pct(current, best)} → <b>{pct(compared, best)}</b></div>
          <div style={{ ...DELTA, color: ppColor(bestPp) }}>{fmtPp(bestPp)}</div>
        </div>
        <div>
          <div className="lbl">크크작 대비</div>
          <div style={CMP}>{pct(current, kkjak)} → <b>{pct(compared, kkjak)}</b></div>
          <div style={{ ...DELTA, color: ppColor(kkPp) }}>{fmtPp(kkPp)}</div>
        </div>
      </div>

      <hr style={{ border: 'none', borderTop: '1px solid #ddd', margin: '12px 0' }} />

      {/* 스펙 변화(좌) · 유효옵 총합 변화(우) */}
      <div style={{ display: 'flex', gap: 40, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ fontWeight: 'bold', fontSize: '1.15rem', margin: '0 0 6px' }}>스펙 변화</div>
          <ChangeRow label={SCALE_LABEL[base.character.scale_stat]} a={specA.attack} b={specB.attack} fmt={(v) => v.toFixed(0)} />
          <ChangeRow label="크리티컬" a={specA.criticalRateRaw} b={specB.criticalRateRaw} fmt={pctv} />
          <ChangeRow label="크리티컬 피해" a={specA.criticalDamage} b={specB.criticalDamage} fmt={pctv} />
          <ChangeRow label="속성 피해" a={specA.elementBonus} b={specB.elementBonus} fmt={pctv} />
          {dmgType && <ChangeRow label={DMG_TYPE_LABEL[dmgType]} a={specA.damageTypeBonus} b={specB.damageTypeBonus} fmt={pctv} />}
          {(specA.amplifyAll > 0 || specB.amplifyAll > 0) && <ChangeRow label="전체 피해 부스트" a={specA.amplifyAll} b={specB.amplifyAll} fmt={pctv} />}
          <ChangeRow label="공명 효율" a={specA.energyRegen} b={specB.energyRegen} fmt={pctv} />
          {mechKey && <ChangeRow label="공효→에코 보너스" a={mechA} b={mechB} fmt={pctv} />}
        </div>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ fontWeight: 'bold', fontSize: '1.15rem', margin: '0 0 6px' }}>유효옵 총합 변화</div>
          {eff.map((k) => {
            const a = subA[k] ?? 0; const b = subB[k] ?? 0;
            if (a === 0 && b === 0) return null;
            const flat = k.startsWith('flat');
            return <ChangeRow key={k} label={SUB_LABEL[k] ?? k} a={a} b={b} fmt={(v) => (flat ? v.toFixed(0) : `${v.toFixed(1)}%`)} />;
          })}
        </div>
      </div>
    </div>
  );
}
