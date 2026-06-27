import type { AppState } from '../state/store';
import { pickMainEcho, combinedMainEchoes, defaultMainFor, buildStateForCharacter } from '../state/store';
import { loadCharacters, loadWeapons, loadEchoSets, getWeapon, getEchoSet } from '../engine/loadData';
import type { CostLayout } from '../types/domain';
import type { EchoSet } from '../types/data';
import { Dropdown, DropdownOption } from './Dropdown';

const MAX_SETS = 3;

interface Props {
  state: AppState;
  setState: (s: AppState) => void;
}

export function Selectors({ state, setState }: Props) {
  const characters = loadCharacters();
  const weapons = loadWeapons();
  const allSets = loadEchoSets();
  const char = state.character;

  // 에코 세트 변경 시, 현재 메인 에코가 합쳐진 목록에 없으면 자동 재선택
  const applyEchoSets = (echoSets: EchoSet[]) => {
    const combined = combinedMainEchoes(echoSets);
    const mainEcho = combined.some((e) => e.id === state.mainEcho.id)
      ? state.mainEcho
      : pickMainEcho(echoSets, char);
    setState({ ...state, echoSets, mainEcho });
  };

  const weaponOptions: DropdownOption[] = char.recommended_weapons.map((id) => {
    const w = getWeapon(id, weapons);
    return { value: id, label: (id === char.signature_weapon ? '★ ' : '') + w.name, image: `/weapons/${id}.png` };
  });
  const setOptions: DropdownOption[] = allSets.map((s) => ({ value: s.id, label: s.name, image: `/echo-sets/${s.id}.png` }));
  const mainEchoOptions: DropdownOption[] = combinedMainEchoes(state.echoSets)
    .map((m) => ({ value: m.id, label: m.name, image: `/echoes/${m.id}.png` }));
  const costOptions: DropdownOption[] = [{ value: '43311', label: '43311' }, { value: '44111', label: '44111' }];

  return (
    <div className="char-config">
      <div className="char-left">
        <label>캐릭터:
          <select value={char.id} onChange={(e) => {
            const c = characters.find((x) => x.id === e.target.value)!;
            setState(buildStateForCharacter(c)); // 저장값 있으면 불러오고, 없으면 기본 세팅
          }}>
            {characters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <img className="char-image" src={`/characters/${char.id}.png`} alt={char.name}
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }} />
      </div>

      <div className="char-right">
        <div className="setting">
          <div className="setting-label">무기</div>
          <Dropdown value={state.weapon.id} options={weaponOptions}
            onChange={(id) => setState({ ...state, weapon: getWeapon(id, weapons) })} />
        </div>

        <div className="setting">
          <div className="setting-label">화음 세트</div>
          <div className="setting-row">
            {state.echoSets.map((s, i) => (
              <span key={i} className="echo-set-item">
                <Dropdown value={s.id} options={setOptions}
                  onChange={(id) => applyEchoSets(state.echoSets.map((x, idx) => idx === i ? getEchoSet(id, allSets) : x))} />
                {state.echoSets.length > 1 && (
                  <button onClick={() => applyEchoSets(state.echoSets.filter((_, idx) => idx !== i))}>×</button>
                )}
              </span>
            ))}
            {state.echoSets.length < MAX_SETS
              && allSets.some((opt) => !state.echoSets.some((s) => s.id === opt.id)) && (
              <button onClick={() => {
                const add = allSets.find((opt) => !state.echoSets.some((s) => s.id === opt.id))!;
                applyEchoSets([...state.echoSets, add]);
              }}>+ 세트 추가</button>
            )}
          </div>
        </div>

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
          <div className="setting-label">필요 공효(%)
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
