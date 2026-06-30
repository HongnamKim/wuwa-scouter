import type { AppState } from '../state/store';
import { pickMainEcho, combinedMainEchoes, defaultMainFor } from '../state/store';
import { loadWeapons, loadEchoSets, getWeapon, getEchoSet, loadTwoPieceEffects } from '../engine/loadData';
import { freeTwoPieceSlots } from '../engine/echoSlots';
import { optimalTwoPiecePicks } from '../engine/theory';
import type { CostLayout, WeaponType } from '../types/domain';
import type { EchoSet } from '../types/data';
import { Dropdown, DropdownOption } from './Dropdown';

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

  // 에코 세트 변경 시: 자유 슬롯 모드(파생 슬롯>0)면 단일 주 세트로 정리,
  // 메인 에코 재선택, 자유 2세트 효과를 새 슬롯 수에 맞춰 최적 조합으로 재설정
  const applyEchoSets = (echoSets: EchoSet[]) => {
    const sets = freeTwoPieceSlots(echoSets) > 0 ? [echoSets[0]] : echoSets;
    const combined = combinedMainEchoes(sets);
    const mainEcho = combined.some((e) => e.id === state.mainEcho.id)
      ? state.mainEcho
      : pickMainEcho(sets, char);
    const next = { ...state, echoSets: sets, mainEcho };
    setState({ ...next, twoPiecePicks: optimalTwoPiecePicks(next) });
  };

  const weaponOptions: DropdownOption[] = char.recommended_weapons.map((id) => {
    const w = getWeapon(id, weapons);
    return { value: id, label: (id === char.signature_weapon ? '★ ' : '') + w.name, image: `/weapons/${id}.png` };
  });
  // 추천 항목을 상단에 고정하고 ★ 표시
  const recFirst = <T extends { id: string }>(items: T[], rec: string[]) => [
    ...rec.map((id) => items.find((x) => x.id === id)).filter((x): x is T => !!x),
    ...items.filter((x) => !rec.includes(x.id)),
  ];
  const setOptions: DropdownOption[] = recFirst(allSets, char.recommended_echo_sets)
    .map((s) => ({ value: s.id, label: (char.recommended_echo_sets.includes(s.id) ? '★ ' : '') + s.name, image: `/echo-sets/${s.id}.png` }));
  const mainEchoOptions: DropdownOption[] = recFirst(combinedMainEchoes(state.echoSets), char.recommended_main_echo)
    .map((m) => ({ value: m.id, label: (char.recommended_main_echo.includes(m.id) ? '★ ' : '') + m.name, image: `/echoes/${m.id}.png` }));
  const costOptions: DropdownOption[] = [{ value: '43311', label: '43311' }, { value: '44111', label: '44111' }];
  // 자유 2세트 효과 풀 (원소피해는 캐릭터 원소명으로 표시)
  const twoPieceOptions: DropdownOption[] = loadTwoPieceEffects().map((e) => ({
    value: e.id,
    label: (e.element_from_character ? `${char.element}피해` : e.label) + ` +${Math.round(e.value * 100)}%`,
  }));
  // 자유 2세트 슬롯 수는 선택한 화음 세트의 최대 set_pieces에서 동적으로 파생
  const twoPieceSlots = freeTwoPieceSlots(state.echoSets);
  const twoPiecePicks = state.twoPiecePicks ?? [];
  const setTwoPiece = (i: number, id: string) => {
    const picks = Array.from({ length: twoPieceSlots }, (_, k) => twoPiecePicks[k] ?? twoPieceOptions[0].value);
    picks[i] = id;
    setState({ ...state, twoPiecePicks: picks });
  };

  return (
    <div className="char-config">
      <div className="char-left">
        <img className="char-image" src={`/characters/${char.id}.png`} alt={char.name}
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }} />
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
          <div className="setting-label">돌파 (공명 체인)</div>
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
          <div className="setting-label">무기 <span className="muted">({WEAPON_TYPE_LABEL[state.weapon.weapon_type]})</span></div>
          <Dropdown value={state.weapon.id} options={weaponOptions}
            onChange={(id) => setState({ ...state, weapon: getWeapon(id, weapons), refinementLevel: 1 })} />
        </div>

        <div className="setting">
          <div className="setting-label">무기 재련 (공진)</div>
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
            {state.echoSets.map((s, i) => (
              <div key={i} className="echo-set-item">
                <Dropdown value={s.id}
                  options={setOptions}
                  onChange={(id) => applyEchoSets(state.echoSets.map((x, idx) => idx === i ? getEchoSet(id, allSets) : x))} />
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
          <Dropdown value={state.mainEcho.id} options={mainEchoOptions}
            onChange={(id) => setState({ ...state, mainEcho: combinedMainEchoes(state.echoSets).find((m) => m.id === id)! })} />
        </div>

        <div className="setting">
          <div className="setting-label">코스트 구성</div>
          <Dropdown value={state.costLayout} options={costOptions}
            onChange={(v) => setState({ ...state, costLayout: v as CostLayout, mainPrimary: defaultMainFor(v as CostLayout) })} />
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
