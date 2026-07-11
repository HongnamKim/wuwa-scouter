import { useState } from 'react';
import type { AppState } from '../state/store';
import { analysisContext } from '../state/store';
import type { Buff } from '../types/data';
import type { StatKey } from '../types/domain';
import { Dropdown } from './Dropdown';
import { defaultBuffChecked } from '../engine/buffs';
import { costsOf } from '../engine/costLayout';
import { loadTwoPieceEffects } from '../engine/loadData';
import { damageBonusTypeOf } from '../engine/mode';
import { computeEnergyRegen } from '../engine/build';
import { energyScaleValue, critScaleValue } from '../engine/mechanisms';
import { computeDisplaySpec } from '../engine/spec';
import { PartyTab } from './PartyTab';

const SIMPLE_KEY = 'wuwa-scouter:buff-simple';

// 점수에 집계되지 않는(이상효과·조화도 파괴 등) 버프 타입.
// 데이터엔 기록하되 추가 버프 패널엔 표시하지 않는다(점수 영향 버프만 노출).
const SCORE_HIDDEN_TYPES: StatKey[] = ['anomaly_damage_amplify', 'anomaly_damage_additional', 'harmony'];

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
  // 돌파 미달로 잠긴 버프는 그룹별 "더보기/숨기기"로 토글 (키 = 그룹 source)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  // 미터치 그룹의 기본 상태: 데스크톱은 펼침, 모바일(좁은 화면)은 접힘
  const [defaultShow] = useState(() => !(typeof window !== 'undefined' && !!window.matchMedia?.('(max-width: 640px)').matches));
  // 카테고리 탭 선택 인덱스
  const [tab, setTab] = useState(0);

  // 출처별 그룹. 무기·에코 세트·메인 에코는 패시브(상시)도 함께 노출(체크박스 비활성, 글씨는 검정).
  // 고유 스킬만 조건부 노출.
  const uniqueSets = state.echoSets.filter((s, i) => state.echoSets.findIndex((x) => x.id === s.id) === i);
  // 세트 효과 게이팅: 에코 개수(코스트 개수)보다 큰 set_pieces 효과는 착용 불가 → 잠금 표시.
  const echoCount = state.costLayout ? costsOf(state.costLayout).length : 5;
  type Item = { b: Buff; passive: boolean; setLocked?: boolean };
  // 보조 2세트 효과(3+2 등 자유 슬롯): 선택된 twoPiecePicks를 상시 버프로 표시. 원소피해는 캐릭터 원소로.
  const twoPiecePool = loadTwoPieceEffects();
  const twoPieceBuffs: Buff[] = (state.twoPiecePicks ?? [])
    .map((id) => twoPiecePool.find((p) => p.id === id))
    .filter((e): e is NonNullable<typeof e> => !!e)
    .map((e) => ({
      type: e.type, value: e.value, always: true,
      element: e.element_from_character ? state.character.element : undefined,
      label: `${e.element_from_character ? `${state.character.element}피해` : e.label} +${Math.round(e.value * 100)}%`,
      record_only: false, absolute_score_only: false,
    }));
  // 무기/메인에코는 미설정(null)일 수 있으므로 설정된 출처만 그룹에 포함
  const condGroups: { source: string; weaponStats: boolean; items: Item[] }[] = [
    { source: '고유 스킬', buffs: state.character.skill_node, withPassive: false, weaponStats: false },
    ...(state.weapon ? [{ source: `무기: ${state.weapon.name}`, buffs: state.weapon.buffs, withPassive: true, weaponStats: true }] : []),
    ...uniqueSets.map((s) => ({ source: `화음 세트: ${s.name}`, buffs: s.buffs, withPassive: true, weaponStats: false })),
    ...(state.mainEcho ? [{ source: `메인 에코: ${state.mainEcho.name}`, buffs: state.mainEcho.buffs, withPassive: true, weaponStats: false }] : []),
    ...(twoPieceBuffs.length ? [{ source: '보조 2세트 효과', buffs: twoPieceBuffs, withPassive: true, weaponStats: false }] : []),
  ]
    .map((g) => ({
      source: g.source,
      weaponStats: g.weaponStats,
      // 조건부(id 보유) + (세트/메인에코면) 상시 패시브. 돌파 미달 버프도 보여주되 아래에서 비활성
      // 모드 전환 캐릭터: 다른 모드 전용 버프는 숨김
      items: g.buffs
        .filter((b) => (g.withPassive ? (!!b.id || !!b.always) : (!b.always && !!b.id)))
        // next_character(다음 등장 캐릭터 전용)·party_except_self(본인 제외 파티)는 본인이 못 받으므로 숨김 — 팀 제공 기록용.
        // party(파티 전체, 본인 포함)와 self는 본인도 받으므로 표시.
        .filter((b) => !b.target || b.target === 'self' || b.target === 'party')
        // element 게이트: 지정 원소가 캐릭터와 다르면 비표시(속성 조건 버프, 예: 서리효과=응결/암흑효과=인멸 분기). '전체'는 통과.
        .filter((b) => !b.element || b.element === '전체' || b.element === state.character.element)
        // provider_element 게이트: 착용자 원소 조건(브랜치 선택). 예: 깃털 5세트 응결분기는 응결 착용자만 표시
        .filter((b) => !b.provider_element || b.provider_element === state.character.element)
        // only_character 게이트: 지정 캐릭터가 아닌 착용자에겐 비표시(예: 푸른 의지 파죽 2스택=구원 전용)
        .filter((b) => !b.only_character || b.only_character === state.character.id)
        // 이상효과·조화도 파괴 등 전용 타입은 패널 비표시(데이터 기록 전용)
        .filter((b) => !SCORE_HIDDEN_TYPES.includes(b.type))
        // record_only(특정 스킬 계수/한정, 계산 제외)는 순수 기록용 → 패널 비표시
        .filter((b) => !b.record_only)
        .filter((b) => !b.mode || b.mode === (state.selectedMode ?? state.character.modes?.[0]?.id))
        // 피해유형 게이트: 캐릭터(모드) 피해유형과 안 맞는 버프는 비표시 (예: 「강설」 크리 분기는 공명해방 캐릭터만)
        .filter((b) => {
          const dbt = damageBonusTypeOf({ character: state.character, selectedMode: state.selectedMode });
          if (b.damage_bonus_type && b.damage_bonus_type !== dbt) return false;
          if (b.exclude_damage_bonus_type && b.exclude_damage_bonus_type === dbt) return false;
          return true;
        })
        .map((b): Item => ({ b, passive: !!b.always, setLocked: b.set_pieces != null && b.set_pieces > echoCount })),
    }))
    // 무기 그룹은 버프가 없어도 스탯 줄을 보기 위해 항상 표시. 그 외 그룹은 표시할 버프가 있을 때만.
    .filter((g) => g.items.length > 0 || g.weaponStats);

  // 돌파 조건 미달 → 잠금(체크 불가)
  const isLocked = (b: Buff) => b.min_ascension != null && (state.ascensionLevel ?? 0) < b.min_ascension;
  // 조건부 버프 현재 체크 상태: 저장값 우선, 미터치면 default_on/돌파 기준
  const isChecked = (b: Buff) => state.conditionalToggles[b.id!] ?? defaultBuffChecked(b, state.ascensionLevel ?? 0);

  // 공효 스케일 버프(energy_scale)의 현재 적용량: 현재 빌드 공효로 계산. 설정 미완성이면 계산 불가(null).
  const ctx = analysisContext(state);
  const currentER = ctx ? computeEnergyRegen(ctx) : null;
  const scaleNowText = (b: Buff): string | null => {
    if (b.energy_scale && currentER != null) return `현재 ${+(energyScaleValue(b.energy_scale, currentER) * 100).toFixed(2)}%`;
    // 크리율 스케일(구원 공명해방 등): 현재 크리율로 계산
    if (b.crit_scale && ctx) return `현재 ${+(critScaleValue(b.crit_scale, computeDisplaySpec(ctx).criticalRateRaw) * 100).toFixed(2)}%`;
    return null;
  };

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
    echo_skill_bonus: '에코 피해', echo_skill_amplify: '에코 피해', energy_regen: '공명 효율', healing_bonus: '치료 효과 보너스',
    anomaly_damage_amplify: '이상효과 피해', anomaly_damage_additional: '이상효과 추가타', harmony: '조화도',
    defense_ignore: '방어력 무시', element_resistance_ignore: '속성 저항 무시',
    flat_attack: '공격력(깡공)', flat_hp: 'HP(깡체력)', flat_defense: '방어력(깡방)',
  };
  // 무기 자체 스탯(기초 공격 + 부가 스탯 1종) 한 줄 표기. 예: "공격 587 · 크리티컬 24.3%"
  const weaponStatLine = () => {
    if (!state.weapon) return '';
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

  // 전체 적용/미적용: 잠기지 않은 조건부 + 파티/기타 버프를 일괄 on/off (1회 액션)
  const condItems = condGroups.flatMap((g) => g.items.filter((it) => !it.passive && !!it.b.id && !isLocked(it.b)).map((it) => it.b));
  const condIds = condItems.map((b) => b.id!);
  const toggleCount = condIds.length + state.manualBuffs.length;
  // 활성화 가능한 버프가 모두 체크되어 있는지 → 버튼이 '전체 미적용'(해제)일지 '전체 적용'일지 결정
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

  // 카테고리 탭: 고유 스킬 / 무기 / 화음 세트(메인 에코 포함) / 파티·기타. 라벨은 짧게(무기: X → 무기).
  const catOf = (source: string) =>
    source.startsWith('무기') ? '무기'
      : (source.startsWith('화음 세트') || source.startsWith('메인 에코') || source.startsWith('보조 2세트')) ? '화음 세트'
        : source; // 고유 스킬
  const catMap = new Map<string, typeof condGroups>();
  for (const g of condGroups) {
    const c = catOf(g.source);
    const arr = catMap.get(c);
    if (arr) arr.push(g); else catMap.set(c, [g]);
  }
  const buffTabs = [...catMap.entries()].map(([label, groups]) => ({ label, groups }));
  const tabLabels = [...buffTabs.map((t) => t.label), '파티', '기타'];
  const activeIdx = tab < tabLabels.length ? tab : 0;
  const activeTab = activeIdx < buffTabs.length ? buffTabs[activeIdx] : null;

  // 한 버프 그룹 렌더 (탭 내부). 잠긴 버프는 기본 펼침(더보기 누른 상태) — 숨기기로 접을 수 있음.
  const renderGroup = (g: (typeof condGroups)[number]) => {
    const hasLocked = g.items.some((it) => !it.passive && isLocked(it.b));
    const show = expanded[g.source] ?? defaultShow;
    const vis = show ? g.items : g.items.filter((it) => it.passive || !isLocked(it.b));
    const label = catOf(g.source); // 그룹 소스가 탭 카테고리와 다르면 헤더 표시(보조 2세트 등 콜론 없는 그룹 포함)
    return (
      <div key={g.source}>
        {g.source !== label && <div className="muted" style={{ margin: '2px 0 6px', fontWeight: 'bold' }}>{g.source}</div>}
        {g.weaponStats && <div style={{ margin: '0 0 8px', fontSize: '0.8rem', color: '#333' }}>스탯: {weaponStatLine()}</div>}
        {vis.map(({ b, passive, setLocked }, idx) => {
          const locked = (!passive && isLocked(b)) || !!setLocked;
          const checked = setLocked ? false : (passive ? true : (!locked && isChecked(b)));
          return (
            <label key={b.id ?? `${g.source}-${idx}`} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 8, width: 'fit-content', color: locked ? '#aaa' : undefined, cursor: (passive || locked) ? 'default' : undefined }}>
              <input type="checkbox" disabled={passive || locked} checked={checked}
                onChange={(e) => { if (passive || setLocked) return; setState({ ...state, conditionalToggles: { ...state.conditionalToggles, [b.id!]: e.target.checked } }); }} />
              <span>{simple ? shortText(b) : fullText(b)}{passive && !setLocked ? ' (상시)' : ''}
                {setLocked && <span className="muted" style={{ marginLeft: 4 }}>· 🔒 {b.set_pieces}세트(에코 {b.set_pieces}개↑ 필요)</span>}
                {scaleNowText(b) && <span className="muted" style={{ marginLeft: 4 }}>· {scaleNowText(b)}</span>}
              </span>
            </label>
          );
        })}
        {vis.length === 0 && !g.weaponStats && !hasLocked && <div className="muted" style={{ fontSize: '0.85rem' }}>표시할 버프가 없습니다.</div>}
        {hasLocked && (
          <div style={{ display: 'flex', justifyContent: 'center', margin: '2px 0 8px' }}>
            <button onClick={() => setExpanded((e) => ({ ...e, [g.source]: !(e[g.source] ?? defaultShow) }))}>
              {show ? '숨기기' : '더보기'}
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      <h3 style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        추가 버프
        <span style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: '0.8rem', fontWeight: 'normal' }}>
          <label style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <input type="checkbox" checked={simple} onChange={(e) => toggleSimple(e.target.checked)} /> 간략 설명
          </label>
          <button type="button" disabled={toggleCount === 0} onClick={() => setAll(!allOn)}>
            {allOn ? '전체 미적용' : '전체 적용'}
          </button>
        </span>
      </h3>
      {/* 카테고리 탭 — 버튼이 패널 좌우 폭을 모두 채우도록 각 버튼 flex:1 */}
      <div className="mode-toggle" style={{ display: 'flex', width: '100%', marginTop: 12, marginBottom: 8 }}>
        {tabLabels.map((label, i) => (
          <button key={label} type="button" style={{ flex: 1 }} className={'mode-btn' + (i === activeIdx ? ' active' : '')} onClick={() => setTab(i)}>{label}</button>
        ))}
      </div>

      {activeTab ? (
        <div>{activeTab.groups.map(renderGroup)}</div>
      ) : activeIdx === buffTabs.length ? (
        <PartyTab state={state} setState={setState} simple={simple} />
      ) : (
        <div>
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
      )}
    </div>
  );
}
