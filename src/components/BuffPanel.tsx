import { useState } from 'react';
import type { AppState } from '../state/store';
import type { Buff } from '../types/data';
import type { StatKey } from '../types/domain';
import { Dropdown } from './Dropdown';
import { defaultBuffChecked } from '../engine/buffs';

const SIMPLE_KEY = 'wuwa-scouter:buff-simple';

// 점수에 집계되지 않는(이상효과·조화도 파괴 등) 버프 타입.
// 데이터엔 기록하되 추가 버프 패널엔 표시하지 않는다(점수 영향 버프만 노출).
const SCORE_HIDDEN_TYPES: StatKey[] = ['anomaly_damage_amplify', 'anomaly_damage_additional', 'harmony_break_amplify'];

const BUFF_TYPES: { key: StatKey; label: string }[] = [
  { key: 'critical_rate', label: '크리티컬%' }, { key: 'critical_damage', label: '크리티컬 피해%' },
  { key: 'element_damage_bonus', label: '속성피해% 증가' }, { key: 'element_damage_amplify', label: '속성피해% 부스트' },
  { key: 'all_damage_amplify', label: '전체 피해% 부스트' }, { key: 'attack_percent', label: '공격력%' },
  { key: 'defense_ignore', label: '방어력 무시%' }, { key: 'element_resistance_ignore', label: '속성 저항 무시%' },
];

interface Props { state: AppState; setState: (s: AppState) => void; }

export function BuffPanel({ state, setState }: Props) {
  // 라벨 표기: 간략(유형+수치) ⇄ 풀(label). 선택은 localStorage에 저장.
  const [simple, setSimple] = useState<boolean>(() => {
    try { return localStorage.getItem(SIMPLE_KEY) === '1'; } catch { return false; }
  });
  const toggleSimple = (v: boolean) => { setSimple(v); try { localStorage.setItem(SIMPLE_KEY, v ? '1' : '0'); } catch { /* noop */ } };

  // 출처별 그룹. 무기·에코 세트·메인 에코는 패시브(상시)도 함께 노출(체크박스 비활성, 글씨는 검정).
  // 고유 스킬만 조건부 노출.
  const uniqueSets = state.echoSets.filter((s, i) => state.echoSets.findIndex((x) => x.id === s.id) === i);
  type Item = { b: Buff; passive: boolean };
  const condGroups: { source: string; weaponStats: boolean; items: Item[] }[] = [
    { source: '고유 스킬', buffs: state.character.skill_node, withPassive: false, weaponStats: false },
    { source: `무기: ${state.weapon.name}`, buffs: state.weapon.buffs, withPassive: true, weaponStats: true },
    ...uniqueSets.map((s) => ({ source: `화음 세트: ${s.name}`, buffs: s.buffs, withPassive: true, weaponStats: false })),
    { source: `메인 에코: ${state.mainEcho.name}`, buffs: state.mainEcho.buffs, withPassive: true, weaponStats: false },
  ]
    .map((g) => ({
      source: g.source,
      weaponStats: g.weaponStats,
      // 조건부(id 보유) + (세트/메인에코면) 상시 패시브. 돌파 미달 버프도 보여주되 아래에서 비활성
      // 모드 전환 캐릭터: 다른 모드 전용 버프는 숨김
      items: g.buffs
        .filter((b) => (g.withPassive ? (!!b.id || !!b.always) : (!b.always && !!b.id)))
        // next_character(다음 등장 캐릭터 전용)는 본인이 못 받으므로 숨김 — 팀 제공 기록용.
        // party(파티 전체, 본인 포함)와 self는 본인도 받으므로 표시.
        .filter((b) => !b.target || b.target === 'self' || b.target === 'party')
        // 이상효과·조화도 파괴 등 전용 타입은 패널 비표시(데이터 기록 전용)
        .filter((b) => !SCORE_HIDDEN_TYPES.includes(b.type))
        // record_only(특정 스킬 계수/한정, 계산 제외)는 순수 기록용 → 패널 비표시
        .filter((b) => !b.record_only)
        .filter((b) => !b.mode || b.mode === (state.selectedMode ?? state.character.modes?.[0]?.id))
        .map((b): Item => ({ b, passive: !!b.always })),
    }))
    .filter((g) => g.items.length > 0);

  // 돌파 조건 미달 → 잠금(체크 불가)
  const isLocked = (b: Buff) => b.min_ascension != null && (state.ascensionLevel ?? 0) < b.min_ascension;
  // 조건부 버프 현재 체크 상태: 저장값 우선, 미터치면 default_on/돌파 기준
  const isChecked = (b: Buff) => state.conditionalToggles[b.id!] ?? defaultBuffChecked(b, state.ascensionLevel ?? 0);

  // {v}를 현재 수치로 치환. 무기 버프는 공진(refinement_values)에 따라 값이 변함.
  const ref = state.refinementLevel ?? 1;
  const valueText = (b: Buff) => {
    const v = b.refinement_values ? (b.refinement_values[ref - 1] ?? b.value) : b.value;
    return b.type.startsWith('flat') ? String(v) : `${+(v * 100).toFixed(1)}%`;
  };
  const tmpl = (text: string, b: Buff) => text.replace('{v}', valueText(b));

  // 라벨이 없는 패시브는 유형+수치로 표기(원소피해는 원소명으로)
  const STAT_LABEL: Partial<Record<StatKey, string>> = {
    critical_rate: '크리티컬', critical_damage: '크리티컬 피해', attack_percent: '공격력',
    hp_percent: 'HP', defense_percent: '방어력',
    element_damage_bonus: '속성피해', element_damage_amplify: '속성피해', all_damage_amplify: '전체 피해',
    basic_attack_bonus: '일반공격 피해', heavy_attack_bonus: '강공격 피해', basic_attack_amplify: '일반공격 피해', heavy_attack_amplify: '강공격 피해',
    resonance_skill_bonus: '공명스킬 피해', resonance_liberation_bonus: '공명해방 피해',
    resonance_skill_amplify: '공명스킬 피해', resonance_liberation_amplify: '공명해방 피해',
    echo_skill_bonus: '에코 피해', echo_skill_amplify: '에코 피해', energy_regen: '공명 효율',
    anomaly_damage_amplify: '이상효과 피해', anomaly_damage_additional: '이상효과 추가타', harmony_break_amplify: '조화도 파괴 증폭',
    defense_ignore: '방어력 무시', element_resistance_ignore: '속성 저항 무시',
    flat_attack: '공격력(깡공)', flat_hp: 'HP(깡체력)', flat_defense: '방어력(깡방)',
  };
  // 무기 자체 스탯(기초 공격 + 부가 스탯 1종) 한 줄 표기. 예: "공격 587 · 크리티컬 24.3%"
  const weaponStatLine = () => {
    const bs = state.weapon.base_stats;
    const parts = [`공격 ${bs.attack}`];
    (Object.keys(bs) as StatKey[]).forEach((k) => {
      if (k === ('attack' as StatKey)) return;
      const v = bs[k] as number;
      const name = STAT_LABEL[k] ?? k;
      parts.push(`${name} ${k.startsWith('flat') ? v : `${+(v * 100).toFixed(1)}%`}`);
    });
    return parts.join(' · ');
  };

  // label이 아예 없는 버프(무기/세트 깡스탯 패시브 등)는 유형+수치로 표기(원소피해는 원소명으로)
  const autoText = (b: Buff) => {
    const name = ((b.type === 'element_damage_bonus' || b.type === 'element_damage_amplify') && b.element)
      ? `${b.element}피해` : (STAT_LABEL[b.type] ?? b.type);
    // 피해 보너스 = 증가, 피해 증폭 = 부스트 (명확히 구분)
    const suffix = b.type.endsWith('_amplify') ? ' 부스트' : (b.type.endsWith('_bonus') ? ' 증가' : '');
    return `${name} +${valueText(b)}${suffix}`;
  };
  // 풀: label(수치 치환), 없으면 auto
  const fullText = (b: Buff) => (b.label ? tmpl(b.label, b) : autoText(b));
  // 간략: JSON의 short(수치 치환). 미지정 시 풀로 폴백 — 코드로 간략문을 만들지 않음
  const shortText = (b: Buff) => (b.short ? tmpl(b.short, b) : fullText(b));

  // 전체 토글: 잠기지 않은 조건부 + 파티/기타 버프를 일괄 on/off
  const condItems = condGroups.flatMap((g) => g.items.filter((it) => !it.passive && !!it.b.id && !isLocked(it.b)).map((it) => it.b));
  const condIds = condItems.map((b) => b.id!);
  const toggleCount = condIds.length + state.manualBuffs.length;
  const allOn = toggleCount > 0
    && condItems.every((b) => isChecked(b))
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
      <h3 style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        추가 버프
        <span style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: '0.8rem', fontWeight: 'normal' }}>
          <label style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <input type="checkbox" checked={simple} onChange={(e) => toggleSimple(e.target.checked)} /> 간략
          </label>
          <label style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <input type="checkbox" checked={allOn} disabled={toggleCount === 0}
              onChange={(e) => setAll(e.target.checked)} /> 전체
          </label>
        </span>
      </h3>
      {condGroups.map((g) => (
        <div key={g.source}>
          <div className="muted" style={{ margin: '6px 0 2px', fontWeight: 'bold' }}>{g.source}</div>
          {g.weaponStats && (
            <div style={{ margin: '0 0 2px', fontSize: '0.8rem', color: '#333' }}>스탯: {weaponStatLine()}</div>
          )}
          {g.items.map(({ b, passive }, idx) => {
            const locked = !passive && isLocked(b);
            const checked = passive ? true : (!locked && isChecked(b));
            return (
            <label key={b.id ?? `${g.source}-${idx}`} style={{ display: 'flex', alignItems: 'center', gap: 4, width: 'fit-content', color: locked ? '#aaa' : undefined, cursor: (passive || locked) ? 'default' : undefined }}>
              <input type="checkbox" disabled={passive || locked} checked={checked}
                onChange={(e) => { if (passive) return; setState({ ...state, conditionalToggles: { ...state.conditionalToggles, [b.id!]: e.target.checked } }); }} />
              <span>{simple ? shortText(b) : fullText(b)}{passive ? ' (상시)' : ''}</span>
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
