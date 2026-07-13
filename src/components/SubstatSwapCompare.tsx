import { useState, useMemo } from 'react';
import type { CalcContext, SubstatLine, EchoSlot } from '../engine/context';
import { ConfirmModal } from './ConfirmModal';
import type { StatKey, DamageBonusType, ScaleStat } from '../types/domain';
import { buildPerfInput, sumEffectiveTotal, computeEnergyRegen } from '../engine/build';
import { computePerf } from '../engine/perf';
import { computeDisplaySpec } from '../engine/spec';
import { mechanismDamageTypeBonus } from '../engine/mechanisms';
import { theoryBest, kkjakReferencePerf } from '../engine/theory';
import { effectiveSubstatsOf, damageBonusTypeOf } from '../engine/mode';
import { DropdownOption } from './Dropdown';
import { EchoEditor, SUB_LABEL, SUB_OPTION_KEYS, pairScaleSubstats, MAIN_SHORT } from './EchoEditor';

const DMG_TYPE_LABEL: Record<DamageBonusType, string> = {
  basic_attack: '일반공격 피해', heavy_attack: '강공격 피해', resonance_skill: '공명스킬 피해',
  resonance_liberation: '공명해방 피해', echo_skill: '에코 피해',
};
const SCALE_LABEL: Record<ScaleStat, string> = { attack: '공격력', hp: '체력', defense: '방어력' };
const comma = (n: number) => Math.round(n).toLocaleString('en-US');

/** 변화 한 줄: 현재 → 교체 후. 값이 다르면 방향 색상. */
function ChangeRow({ label, a, b, fmt }: { label: string; a: number; b: number; fmt: (v: number) => string }) {
  const diff = b - a;
  const color = Math.abs(diff) < 1e-9 ? 'var(--muted)' : diff > 0 ? 'var(--good)' : 'var(--bad)';
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', fontSize: '0.92rem', padding: '4px 0' }}>
      <span style={{ minWidth: 104, color: 'var(--muted)' }}>{label}</span>
      <span style={{ whiteSpace: 'nowrap' }}>{fmt(a)} → <b style={{ color, fontFamily: 'var(--mono)' }}>{fmt(b)}</b></span>
    </div>
  );
}

/**
 * 에코 교체 비교: 에코 탭(Ⅰ~Ⅴ)별로 [내 에코]→[교체할 에코]를 편집해 여러 에코를 동시에 교체.
 * 모든 교체안을 반영한 딜 상승 수치/최고점/크크작 + 스펙·유효옵 총합 변화를 표시. 코스트는 슬롯 고정.
 */
const ROMAN = ['Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ', 'Ⅴ'];

// 부옵을 '집합'으로 비교(순서 무관). 완성된 줄(type+value)만 비교, 빈 줄 무시.
const subKey = (l: SubstatLine): string | null => (l.type && l.value != null ? `${l.type}|${l.value}` : null);
function sameSubs(a: SubstatLine[], b: SubstatLine[]): boolean {
  const ka = a.map(subKey).filter((k): k is string => k != null).sort();
  const kb = b.map(subKey).filter((k): k is string => k != null).sort();
  return ka.length === kb.length && ka.every((k, i) => k === kb[i]);
}

export function SubstatSwapCompare({ base, onApply }: { base: CalcContext; onApply?: (slots: EchoSlot[]) => void }) {
  const [active, setActive] = useState(0); // 편집 중인 에코 탭
  const [confirmApply, setConfirmApply] = useState(false); // 내 에코로 적용 확인
  // 슬롯별 교체안(메인/부옵) — 여러 에코를 동시에 교체 비교
  const [edited, setEdited] = useState<{ main: StatKey | ''; substats: SubstatLine[] }[]>(
    () => base.slots.map((s) => ({ main: s.main, substats: s.substats })),
  );
  const setMain = (k: StatKey) => setEdited((e) => e.map((x, i) => (i === active ? { ...x, main: k } : x)));
  const updateSub = (li: number, patch: Partial<SubstatLine>) =>
    setEdited((e) => e.map((x, i) => (i === active ? { ...x, substats: x.substats.map((l, idx) => (idx === li ? { ...l, ...patch } : l)) } : x)));
  const resetActive = () => setEdited((e) => e.map((x, i) => (i === active ? { main: base.slots[active].main, substats: base.slots[active].substats } : x)));
  // 비우기: 이 에코를 통째로 비운 상태로 교체(메인·부옵 없음 → 기여 0). "이 에코를 뺐을 때" 비교용.
  const emptyActive = () => setEdited((e) => e.map((x, i) => (i === active ? { main: '', substats: x.substats.map((): SubstatLine => ({ type: '', value: null })) } : x)));
  const activeEmpty = edited[active].main === '' && edited[active].substats.every((l) => !l.type && l.value == null);
  const activeChanged = base.slots[active].main !== edited[active].main
    || !sameSubs(base.slots[active].substats, edited[active].substats);
  // 하나라도 교체안이 원본과 다르면 '내 에코로 적용' 활성
  const anyChanged = base.slots.some((s, i) => s.main !== edited[i].main || !sameSubs(s.substats, edited[i].substats));

  const cost = base.slots[active].cost;

  // 분모(최고점·크크작)는 슬롯 교체와 무관(빌드 고정) → 한 번만 계산
  const { best, kkjak } = useMemo(() => ({
    best: theoryBest(base).perf,
    kkjak: kkjakReferencePerf(base),
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
  const ppColor = (pp: number) => (pp > 0 ? 'var(--good)' : pp < 0 ? 'var(--bad)' : 'var(--muted)');
  const fmtPp = (pp: number) => `${pp >= 0 ? '+' : ''}${pp.toFixed(1)}%p`;

  return (
    <div>
      <div className="echo-tabs" style={{ margin: '8px 0' }}>
        {base.slots.map((s, i) => {
          const changed = s.main !== edited[i].main || !sameSubs(s.substats, edited[i].substats);
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
          <div className="swap-echo-title" style={{ color: 'var(--muted)' }}>내 에코</div>
          <EchoEditor cost={cost} main={base.slots[active].main} subs={base.slots[active].substats} optionList={optionList} matrixCost={base.character.matrix_cost} scaleStat={base.character.scale_stat} readOnly />
        </div>

        <div className="swap-arrow"><span className="arrow-h">→</span><span className="arrow-v">↓</span></div>

        <div className="swap-echo">
          <div className="swap-echo-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, color: 'var(--accent)' }}>
            교체할 에코
            <span style={{ display: 'flex', gap: 6 }}>
              <button type="button" disabled={!activeChanged} onClick={resetActive} style={{ fontSize: '0.74rem', padding: '0 9px', height: 26 }}>원래대로</button>
              <button type="button" disabled={activeEmpty} onClick={emptyActive} style={{ fontSize: '0.74rem', padding: '0 9px', height: 26 }}>비우기</button>
            </span>
          </div>
          <EchoEditor cost={cost} main={edited[active].main} subs={edited[active].substats} optionList={optionList} matrixCost={base.character.matrix_cost} scaleStat={base.character.scale_stat} onMain={setMain} onSub={updateSub} orig={{ main: base.slots[active].main, subs: base.slots[active].substats }} />
        </div>
      </div>

      {/* 점수: 3열 카드 (a → b + 변화량) */}
      <div className="cmp-score-grid">
        <div className="score-card">
          <div className="cmp-lbl">딜 상승 수치</div>
          <div className="cmp-ab">{comma(current)} → <span>{comma(compared)}</span></div>
          <div className="cmp-delta" style={{ color: diff > 0 ? 'var(--good)' : diff < 0 ? 'var(--bad)' : 'var(--muted)' }}>{diff >= 0 ? '+' : ''}{diff.toFixed(2)}%</div>
        </div>
        <div className="score-card">
          <div className="cmp-lbl">최고점 대비</div>
          <div className="cmp-ab">{pct(current, best)} → <span>{pct(compared, best)}</span></div>
          <div className="cmp-delta" style={{ color: ppColor(bestPp) }}>{fmtPp(bestPp)}</div>
        </div>
        <div className="score-card">
          <div className="cmp-lbl">크크작 대비</div>
          <div className="cmp-ab">{pct(current, kkjak)} → <span>{pct(compared, kkjak)}</span></div>
          <div className="cmp-delta" style={{ color: ppColor(kkPp) }}>{fmtPp(kkPp)}</div>
        </div>
      </div>

      {onApply && (
        <div style={{ textAlign: 'center', margin: '6px 0 18px' }}>
          <button type="button" className="save-btn" disabled={!anyChanged} onClick={() => setConfirmApply(true)}>
            교체할 에코를 내 에코로 적용하기
          </button>
        </div>
      )}

      <div style={{ height: 1, background: 'var(--rule)', margin: '14px 0' }} />

      {/* 스펙 변화(좌) · 유효옵 총합 변화(우) */}
      <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ fontWeight: 800, fontSize: '1rem', margin: '0 0 10px' }}>스펙 변화</div>
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
          <div style={{ fontWeight: 800, fontSize: '1rem', margin: '0 0 10px' }}>유효옵 총합 변화</div>
          {eff.map((k) => {
            const a = subA[k] ?? 0; const b = subB[k] ?? 0;
            if (a === 0 && b === 0) return null;
            const flat = k.startsWith('flat');
            return <ChangeRow key={k} label={SUB_LABEL[k] ?? k} a={a} b={b} fmt={(v) => (flat ? v.toFixed(0) : `${v.toFixed(1)}%`)} />;
          })}
        </div>
      </div>

      {confirmApply && (
        <ConfirmModal
          message="교체할 에코 구성을 저장된 빌드에 덮어씁니다. 계속하시겠습니까?"
          confirmLabel="적용"
          onConfirm={() => { onApply?.(comparedCtx.slots); setConfirmApply(false); }}
          onCancel={() => setConfirmApply(false)}
          onDismiss={() => setConfirmApply(false)}
        />
      )}
    </div>
  );
}
