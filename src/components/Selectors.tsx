import { useState } from 'react';
import type { AppState } from '../state/store';
import { combinedMainEchoes, analysisContext } from '../state/store';
import { loadWeapons, loadEchoSets, getWeapon, getEchoSet, loadTwoPieceEffects } from '../engine/loadData';
import { freeTwoPieceSlots, defaultSlots } from '../engine/echoSlots';
import { costsOf, isValidCostLayout, normalizeCostLayout } from '../engine/costLayout';
import { optimalTwoPiecePicks } from '../engine/theory';
import type { CostLayout, WeaponType } from '../types/domain';
import type { EchoSet } from '../types/data';
import { Dropdown, DropdownOption } from './Dropdown';
import { onImgError } from './imgFallback';

export const WEAPON_TYPE_LABEL: Record<WeaponType, string> = {
  broad_blade: '대검',
  sword: '직검',
  pistols: '권총',
  gauntlets: '권갑',
  rectifier: '증폭기',
};

interface Props {
  state: AppState;
  setState: (s: AppState) => void;
}

export function Selectors({ state, setState }: Props) {
  const weapons = loadWeapons();
  const allSets = loadEchoSets();
  const char = state.character;
  const echoCount = (l: string | null) => (l ? costsOf(l).length : 5);
  const [customMode, setCustomMode] = useState(false);
  const [customInput, setCustomInput] = useState(state.costLayout ?? '');

  // 설정이 완성(무기·세트·메인에코·코스트)됐고 자유 슬롯이 있으며 아직 2세트 효과 미선택이면 최적 조합으로 채운다.
  // (이미 사용자가 고른 2세트 효과는 건드리지 않음)
  const commit = (next: AppState) => {
    const ctx = analysisContext(next);
    const needPicks = ctx && (next.twoPiecePicks?.length ?? 0) === 0 && freeTwoPieceSlots(next.echoSets, echoCount(next.costLayout)) > 0;
    setState(needPicks ? { ...next, twoPiecePicks: optimalTwoPiecePicks(ctx!) } : next);
  };

  // 에코 세트 변경 시: 자유 슬롯 모드(파생 슬롯>0)면 단일 주 세트로 정리. 메인 에코는 새 세트에 없으면 비운다.
  // 자유 2세트 효과는 슬롯 수가 바뀌므로 (설정 완성 시) 최적 조합으로 재설정, 아니면 비움.
  const applyEchoSets = (echoSets: EchoSet[]) => {
    const sets = freeTwoPieceSlots(echoSets, echoCount(state.costLayout)) > 0 ? [echoSets[0]] : echoSets;
    const combined = combinedMainEchoes(sets);
    // 현재 메인 에코가 새 세트에도 있으면 유지, 없으면 새 세트의 첫 메인 에코로 자동 지정(비우지 않음)
    const mainEcho = state.mainEcho && combined.some((e) => e.id === state.mainEcho!.id) ? state.mainEcho : (combined[0] ?? null);
    const next: AppState = { ...state, echoSets: sets, mainEcho };
    const ctx = analysisContext(next);
    setState({ ...next, twoPiecePicks: ctx ? optimalTwoPiecePicks(ctx) : [] });
  };

  // 추천 항목을 상단에 고정하고 ★ 표시
  const recFirst = <T extends { id: string }>(items: T[], rec: string[]) => [
    ...rec.map((id) => items.find((x) => x.id === id)).filter((x): x is T => !!x),
    ...items.filter((x) => !rec.includes(x.id)),
  ];
  // 무기 드롭다운: 캐릭터 무기 타입 전체 중 선택. 추천무기(recommended_weapons)는 상단·★ 표시(화음세트와 동일).
  const typeWeapons = weapons.filter((w) => w.weapon_type === char.weapon_type && !w.unreleased);
  const weaponOptions: DropdownOption[] = recFirst(typeWeapons, char.recommended_weapons)
    .map((w) => ({ value: w.id, label: (char.recommended_weapons.includes(w.id) ? '★ ' : '') + w.name, image: `/weapons/${w.id}.webp` }));
  const setOptions: DropdownOption[] = recFirst(allSets, char.recommended_echo_sets)
    .map((s) => ({ value: s.id, label: (char.recommended_echo_sets.includes(s.id) ? '★ ' : '') + s.name, image: `/echo-sets/${s.id}.webp` }));
  const mainEchoOptions: DropdownOption[] = recFirst(combinedMainEchoes(state.echoSets), char.recommended_main_echo)
    .map((m) => ({ value: m.id, label: (char.recommended_main_echo.includes(m.id) ? '★ ' : '') + m.name, image: `/echoes/${m.id}.webp` }));
  // 코스트 구성: 프리셋(43311/44111) + 직접 입력. 현재값이 프리셋이 아니면 직접 입력 모드로 취급.
  const CUSTOM = '__custom__';
  const isPreset = state.costLayout === '43311' || state.costLayout === '44111';
  const costOptions: DropdownOption[] = [
    { value: '43311', label: '43311' },
    { value: '44111', label: '44111' },
    // 확정된 커스텀 값을 드롭다운 라벨에 반영: "직접 입력 (41111)"
    { value: CUSTOM, label: '직접 입력' + (!isPreset && state.costLayout ? ` (${state.costLayout})` : '') },
  ];
  // 프리셋이면 그 값, 커스텀 적용 상태면 CUSTOM 표시.
  const costDropdownValue = isPreset ? (state.costLayout ?? '') : (state.costLayout ? CUSTOM : '');
  // 입력칸은 편집 중이거나 현재 커스텀 값이 적용돼 있을 때 계속 노출(확정 후에도 유지 → 재수정 편의).
  const showCustom = customMode || (!isPreset && !!state.costLayout);
  const applyCost = (raw: string) => {
    const norm = normalizeCostLayout(raw.trim());
    if (isValidCostLayout(norm)) { commit({ ...state, costLayout: norm, slots: defaultSlots(norm) }); setCustomMode(false); }
  };
  // 자유 2세트 효과 풀 (원소피해는 캐릭터 원소명으로 표시)
  const twoPieceOptions: DropdownOption[] = loadTwoPieceEffects().map((e) => ({
    value: e.id,
    label: (e.element_from_character ? `${char.element}피해` : e.label) + ` +${Math.round(e.value * 100)}%`,
  }));
  // 자유 2세트 슬롯 수는 선택한 화음 세트의 최대 set_pieces에서 동적으로 파생
  const twoPieceSlots = freeTwoPieceSlots(state.echoSets, echoCount(state.costLayout));
  const twoPiecePicks = state.twoPiecePicks ?? [];
  const setTwoPiece = (i: number, id: string) => {
    const picks = Array.from({ length: twoPieceSlots }, (_, k) => twoPiecePicks[k] ?? twoPieceOptions[0].value);
    picks[i] = id;
    setState({ ...state, twoPiecePicks: picks });
  };

  return (
    <div className="char-config">
      <div className="char-left">
        <img className="char-image" src={`/characters/${char.id}.webp`} alt={char.name} onError={onImgError} />
        {char.modes && char.modes.length > 0 && (
          <div className="mode-toggle">
            {char.modes.map((m) => (
              <button key={m.id} type="button"
                className={'mode-btn' + ((state.selectedMode ?? char.modes![0].id) === m.id ? ' active' : '')}
                onClick={() => setState({ ...state, selectedMode: m.id })}>{m.name}</button>
            ))}
          </div>
        )}
      </div>

      <div className="char-right">
        <div className="setting">
          <div className="setting-label">돌파 <span className="muted">(공명 체인)</span></div>
          <div className="setting-row">
            <input type="range" min={0} max={6} step={1} style={{ flex: 1, minWidth: 120 }}
              value={state.ascensionLevel ?? 0}
              onChange={(e) => setState({ ...state, ascensionLevel: Number(e.target.value) })} />
            <span style={{ fontWeight: 'bold', minWidth: 36, textAlign: 'right' }}>
              {(() => { const a = state.ascensionLevel ?? 0; return a === 0 ? '명함' : a === 6 ? '풀돌' : a + '돌'; })()}
            </span>
          </div>
        </div>

        <div className="setting">
          <div className="setting-label">무기 {state.weapon && <span className="muted">({WEAPON_TYPE_LABEL[state.weapon.weapon_type]})</span>}</div>
          <Dropdown value={state.weapon?.id ?? ''} options={weaponOptions}
            onChange={(id) => commit({ ...state, weapon: getWeapon(id, weapons), refinementLevel: 1 })} />
        </div>

        <div className="setting">
          <div className="setting-label">무기 재련 <span className="muted">(공진)</span></div>
          <div className="setting-row">
            <input type="range" min={1} max={5} step={1} style={{ flex: 1, minWidth: 120 }}
              value={state.refinementLevel ?? 1}
              onChange={(e) => setState({ ...state, refinementLevel: Number(e.target.value) })} />
            <span style={{ fontWeight: 'bold', minWidth: 36, textAlign: 'right' }}>{state.refinementLevel ?? 1}공진</span>
          </div>
        </div>

        <div className="setting">
          <div className="setting-label">화음 세트</div>
          <div className="echo-set-list">
            {(state.echoSets.length ? state.echoSets.map((s) => s.id) : ['']).map((sid, i) => (
              <div key={i} className="echo-set-item">
                <Dropdown value={sid}
                  options={setOptions}
                  onChange={(id) => applyEchoSets(
                    state.echoSets.length
                      ? state.echoSets.map((x, idx) => idx === i ? getEchoSet(id, allSets) : x)
                      : [getEchoSet(id, allSets)]
                  )} />
              </div>
            ))}
          </div>
        </div>

        {twoPieceSlots > 0 && (
          <div className="setting">
            <div className="setting-label">보조 2세트 효과 <span className="muted">(×{twoPieceSlots})</span></div>
            <div className="two-piece-list">
              {Array.from({ length: twoPieceSlots }).map((_, i) => (
                <Dropdown key={i} value={twoPiecePicks[i] ?? twoPieceOptions[0].value}
                  options={twoPieceOptions} onChange={(id) => setTwoPiece(i, id)} />
              ))}
            </div>
          </div>
        )}

        <div className="setting">
          <div className="setting-label">메인 에코</div>
          <Dropdown value={state.mainEcho?.id ?? ''} options={mainEchoOptions}
            onChange={(id) => commit({ ...state, mainEcho: combinedMainEchoes(state.echoSets).find((m) => m.id === id) ?? null })} />
        </div>

        <div className="setting">
          <div className="setting-label">코스트 구성</div>
          <Dropdown value={costDropdownValue} options={costOptions}
            onChange={(v) => {
              if (v === CUSTOM) { setCustomMode(true); setCustomInput(isPreset ? '' : (state.costLayout ?? '')); }
              else { setCustomMode(false); commit({ ...state, costLayout: v as CostLayout, slots: defaultSlots(v as CostLayout) }); }
            }} />
          {showCustom && (() => {
            const valid = isValidCostLayout(normalizeCostLayout(customInput.trim()));
            const cell = { height: 31, padding: '0 10px', fontSize: '0.9rem', border: '1px solid #bbb', borderRadius: 6, boxSizing: 'border-box' as const };
            return (
              <div style={{ marginTop: 4 }}>
                <div style={{ display: 'flex', alignItems: 'stretch', gap: 4, width: 220 }}>
                  <input value={customInput} placeholder="예: 41111 · 444"
                    style={{ ...cell, flex: 1, minWidth: 0 }} inputMode="numeric"
                    onChange={(e) => setCustomInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && valid) applyCost(customInput); }} />
                  <button type="button" disabled={!valid} style={{ ...cell, flex: '0 0 auto', cursor: valid ? 'pointer' : 'default' }} onClick={() => applyCost(customInput)}>확인</button>
                </div>
                {!valid && customInput.trim() !== '' && (
                  <div className="muted" style={{ fontSize: '0.78rem', color: '#c0392b' }}>코스트는 4/3/1, 1~5개, 합 12 이하</div>
                )}
              </div>
            );
          })()}
        </div>

        <div className="setting">
          <div className="setting-label">필요 공명 효율(%)
            <span className="help">
              <span className="help-icon">?</span>
              <span className="help-tip">100% 미만 입력 → 에코로 늘리는 공효 증가분으로 해석. 100% 이상 입력 → 총 공효(기본 100% 포함)로 해석(에코 기여 = 값 − 100).</span>
            </span>
          </div>
          <input type="number" min={0} step={0.1} style={{ width: 80 }}
            value={state.requiredEnergyRegen ?? ''}
            onChange={(e) => {
              const n = parseFloat(e.target.value);
              setState({ ...state, requiredEnergyRegen: e.target.value === '' || isNaN(n) ? undefined : n });
            }} />
        </div>
      </div>
    </div>
  );
}
