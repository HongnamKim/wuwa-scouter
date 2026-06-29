import type { Character, EchoSet, MainSlotEcho } from '../types/data';
import type { CalcContext, SubstatLine, MainPrimaryPick, ManualBuff } from '../engine/context';
import { loadCharacters, loadWeapons, loadEchoSets, getWeapon, getEchoSet, loadTwoPieceEffects } from '../engine/loadData';
import { SUBSTAT_STAGES, COST_LAYOUTS, MAIN_PRIMARY } from '../engine/constants';
import { optimalTwoPiecePicks } from '../engine/theory';
import { freeTwoPieceSlots } from '../engine/echoSlots';
import type { StatKey, CostLayout } from '../types/domain';

export type AppState = CalcContext;

const DEAL_KEYS: StatKey[] = ['attack_percent', 'element_damage_bonus', 'critical_rate', 'critical_damage', 'energy_regen'];

/** 코스트 구성별 기본 메인 옵션 (4코=크피, 그 외=공%) */
export function defaultMainFor(layout: CostLayout): MainPrimaryPick[] {
  return COST_LAYOUTS[layout].map((cost) => {
    const opts = (Object.keys(MAIN_PRIMARY[cost]) as StatKey[]).filter((k) => DEAL_KEYS.includes(k));
    const def: StatKey = cost === 4 ? 'critical_damage' : 'attack_percent';
    return { cost, type: opts.includes(def) ? def : opts[0] };
  });
}

/** 빈 부옵 (5에코 × 5줄) */
export function emptySubstats(): SubstatLine[][] {
  return Array.from({ length: 5 }, () => Array.from({ length: 5 }, () => ({ type: '' as const, value: null })));
}

/** 착용한 세트들의 메인슬롯 에코를 id 기준으로 합친 목록 */
export function combinedMainEchoes(echoSets: EchoSet[]): MainSlotEcho[] {
  const seen = new Set<string>();
  const out: MainSlotEcho[] = [];
  for (const s of echoSets) {
    for (const e of s.main_slot_echoes) {
      if (!seen.has(e.id)) { seen.add(e.id); out.push(e); }
    }
  }
  return out;
}

/** 합쳐진 메인슬롯 에코 중 캐릭터 피해유형에 맞는 패시브를 가진 것(없으면 첫 번째) */
export function pickMainEcho(echoSets: EchoSet[], character: Character): MainSlotEcho {
  const echoes = combinedMainEchoes(echoSets);
  const rec = character.recommended_main_echo ?? [];
  const recMatch = echoes.find((e) => rec.includes(e.id));
  if (recMatch) return recMatch;
  const want = character.damage_bonus_type ? `${character.damage_bonus_type}_bonus` : null;
  if (want) {
    const match = echoes.find((e) => e.buffs.some((b) => b.type === want));
    if (match) return match;
  }
  return echoes[0];
}

/** 가장 가까운 단계값으로 스냅 */
function snap(type: StatKey, value: number): number {
  const stages = SUBSTAT_STAGES[type];
  if (!stages) return value;
  return stages.reduce((a, b) => (Math.abs(b - value) < Math.abs(a - value) ? b : a));
}

/** 프로토타입 loadSample 이식 (히유키 실제 에코 5개, 무효옵 포함) */
export function loadSampleSubstats(character: Character): SubstatLine[][] {
  if (character.id !== 'hiyuki') {
    return emptySubstats();
  }
  const raw: [StatKey, number][][] = [
    [['critical_rate', 6.9], ['critical_damage', 12.6], ['attack_percent', 7.9], ['resonance_liberation_bonus', 7.9], ['basic_attack_bonus', 10.9]],
    [['critical_damage', 15], ['energy_regen', 8.0], ['flat_defense', 60], ['flat_hp', 394], ['critical_rate', 7.5]],
    [['critical_damage', 18.6], ['attack_percent', 6.4], ['resonance_skill_bonus', 11.6], ['resonance_liberation_bonus', 6.4], ['critical_rate', 6.9]],
    [['attack_percent', 7.2], ['flat_defense', 60], ['critical_damage', 13.8], ['resonance_liberation_bonus', 10.9], ['critical_rate', 6.9]],
    [['resonance_liberation_bonus', 8.6], ['heavy_attack_bonus', 10.1], ['energy_regen', 6.4], ['critical_rate', 7.5], ['attack_percent', 7.9]],
  ];
  return raw.map((echo) => echo.map(([type, v]) => ({ type, value: snap(type, v) })));
}

/** 캐릭터의 기본 세팅 상태(저장값 없을 때) */
export function defaultStateForCharacter(character: Character): AppState {
  const weapons = loadWeapons();
  const sets = loadEchoSets();
  const weapon = getWeapon(character.recommended_weapons[0], weapons);
  const echoSets = [getEchoSet(character.recommended_echo_sets[0], sets)];
  const mainEcho = pickMainEcho(echoSets, character);

  // 조건부 토글 기본 on (상시 외 조건부 버프 전부)
  const conditionalToggles: Record<string, boolean> = {};
  [...character.skill_node, ...mainEcho.buffs, ...weapon.buffs, ...echoSets.flatMap((s) => s.buffs)]
    .forEach((b) => { if (!b.always && b.id) conditionalToggles[b.id] = true; });

  const state: AppState = {
    character,
    weapon,
    mainEcho,
    echoSets,
    costLayout: '43311',
    mainPrimary: defaultMainFor('43311'),
    twoPiecePicks: [],
    substats: loadSampleSubstats(character),
    conditionalToggles,
    manualBuffs: [],
    requiredEnergyRegen: character.default_required_energy_regen,
    ascensionLevel: 0,
    refinementLevel: 1,
  };
  // 자유 2세트 효과 기본값 = 최적 조합
  return { ...state, twoPiecePicks: optimalTwoPiecePicks(state) };
}

// ===== 캐릭터별 저장/불러오기 (localStorage; 백엔드 도입 시 교체) =====
const SAVE_KEY = (id: string) => `wuwa-scouter:save:${id}`;
const hasStorage = typeof localStorage !== 'undefined';

interface SavedState {
  weaponId: string;
  echoSetIds: string[];
  mainEchoId: string;
  costLayout: CostLayout;
  mainPrimary: MainPrimaryPick[];
  twoPiecePicks?: string[];
  substats: SubstatLine[][];
  conditionalToggles: Record<string, boolean>;
  manualBuffs: ManualBuff[];
  requiredEnergyRegen?: number;
  ascensionLevel?: number;
  refinementLevel?: number;
}

function serializeState(state: AppState): SavedState {
  return {
    weaponId: state.weapon.id,
    echoSetIds: state.echoSets.map((e) => e.id),
    mainEchoId: state.mainEcho.id,
    costLayout: state.costLayout,
    mainPrimary: state.mainPrimary,
    twoPiecePicks: state.twoPiecePicks ?? [],
    substats: state.substats,
    conditionalToggles: state.conditionalToggles,
    manualBuffs: state.manualBuffs,
    requiredEnergyRegen: state.requiredEnergyRegen,
    ascensionLevel: state.ascensionLevel,
    refinementLevel: state.refinementLevel,
  };
}

/** 현재 화면 입력 전체를 캐릭터별로 저장 (부옵 자유 비교는 컴포넌트 로컬 상태라 제외) */
export function saveCharacterState(state: AppState): void {
  if (!hasStorage) return;
  localStorage.setItem(SAVE_KEY(state.character.id), JSON.stringify(serializeState(state)));
}

/** 저장된 데이터가 존재하는지 */
export function hasSavedState(characterId: string): boolean {
  return hasStorage && localStorage.getItem(SAVE_KEY(characterId)) != null;
}

/** 저장된 데이터 삭제 */
export function deleteCharacterState(characterId: string): void {
  if (!hasStorage) return;
  localStorage.removeItem(SAVE_KEY(characterId));
}

/** 현재 상태가 저장된 내용과 동일한지 (저장값 없으면 false) */
export function isStateSaved(state: AppState): boolean {
  if (!hasStorage) return false;
  const raw = localStorage.getItem(SAVE_KEY(state.character.id));
  return raw != null && raw === JSON.stringify(serializeState(state));
}

/** 저장된 상태를 불러와 AppState로 복원 (없거나 파싱 실패 시 null) */
export function loadCharacterState(character: Character): AppState | null {
  if (!hasStorage) return null;
  const raw = localStorage.getItem(SAVE_KEY(character.id));
  if (!raw) return null;
  try {
    const s: SavedState = JSON.parse(raw);
    const weapons = loadWeapons();
    const sets = loadEchoSets();
    const weapon = weapons.find((w) => w.id === s.weaponId)
      ?? getWeapon(character.recommended_weapons[0], weapons);
    const echoSets = (s.echoSetIds ?? [])
      .map((id) => sets.find((x) => x.id === id))
      .filter((x): x is EchoSet => !!x);
    const safeSets = echoSets.length ? echoSets : [getEchoSet(character.recommended_echo_sets[0], sets)];
    const combined = combinedMainEchoes(safeSets);
    const mainEcho = combined.find((m) => m.id === s.mainEchoId) ?? pickMainEcho(safeSets, character);
    const state: AppState = {
      character,
      weapon,
      mainEcho,
      echoSets: safeSets,
      costLayout: s.costLayout ?? '43311',
      mainPrimary: s.mainPrimary ?? defaultMainFor(s.costLayout ?? '43311'),
      twoPiecePicks: [],
      substats: s.substats ?? emptySubstats(),
      conditionalToggles: s.conditionalToggles ?? {},
      manualBuffs: s.manualBuffs ?? [],
      requiredEnergyRegen: s.requiredEnergyRegen,
      ascensionLevel: s.ascensionLevel ?? 0,
      refinementLevel: Math.max(1, Math.min(5, s.refinementLevel ?? 1)),
    };
    // 자유 2세트 효과: 저장값이 유효하면 사용, 아니면(구버전/누락) 최적 조합으로 보정
    const pool = loadTwoPieceEffects();
    const saved = s.twoPiecePicks;
    const slots = freeTwoPieceSlots(safeSets);
    const valid = Array.isArray(saved) && saved.length === slots
      && saved.every((id) => pool.some((p) => p.id === id));
    return { ...state, twoPiecePicks: valid ? saved! : optimalTwoPiecePicks(state) };
  } catch {
    return null;
  }
}

/** 저장값이 있으면 그것을, 없으면 기본 세팅을 반환 */
export function buildStateForCharacter(character: Character): AppState {
  return loadCharacterState(character) ?? defaultStateForCharacter(character);
}

export function initialState(): AppState {
  const character = loadCharacters().find((c) => c.id === 'hiyuki')!;
  return buildStateForCharacter(character);
}

/** 저장된(기록된) 공명자들의 상태 목록 */
export function listSavedStates(): AppState[] {
  return loadCharacters()
    .map((c) => loadCharacterState(c))
    .filter((s): s is AppState => !!s);
}
