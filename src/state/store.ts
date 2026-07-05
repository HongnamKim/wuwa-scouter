import type { Character, EchoSet, MainSlotEcho, Weapon, Buff } from '../types/data';
import type { CalcContext, SubstatLine, MainPrimaryPick, ManualBuff, EchoSlot, PartyMember } from '../engine/context';
import { loadCharacters, loadWeapons, loadEchoSets, loadTwoPieceEffects } from '../engine/loadData';
import { memberProvidedBuffs, type MemberBuild } from '../engine/buffs';
import { computeEnergyRegen } from '../engine/build';
import { energyScaleValue } from '../engine/mechanisms';
import { optimalTwoPiecePicks } from '../engine/theory';
import { freeTwoPieceSlots, defaultSlots, slotsFrom } from '../engine/echoSlots';
import type { CostLayout } from '../types/domain';

/**
 * 기록 전용(서포터) 캐릭터 여부. 개인 딜 최적화(최고점/크크작 상대점수·메인 조합 추천)를 제공하지 않고
 * 스펙·버프·딜 상승 수치만 기록용으로 보여준다. buff_conversion(공효→버프) 또는 매트릭스 코스트 2(서포터)로 판별.
 */
export function isRecordOnly(character: Character): boolean {
  return character.energy_regen_mode === 'buff_conversion' || character.matrix_cost === 2;
}

/** 저장된 파티원 복원: 존재하는 id·자기 자신 제외·중복 제거·최대 2명·불리언 보정 */
function restorePartyMembers(saved: PartyMember[] | undefined, selfId: string): PartyMember[] {
  if (!Array.isArray(saved)) return [];
  const ids = new Set(loadCharacters().map((c) => c.id));
  const seen = new Set<string>();
  const out: PartyMember[] = [];
  for (const m of saved) {
    if (!m || typeof m.id !== 'string' || !ids.has(m.id) || m.id === selfId || seen.has(m.id)) continue;
    seen.add(m.id);
    const disabled = Array.isArray(m.disabled) ? m.disabled.filter((x): x is string => typeof x === 'string') : [];
    out.push({ id: m.id, disabled });
    if (out.length >= 2) break;
  }
  return out;
}

/** 파티원 캐릭터의 내 저장 빌드(돌파/재련/무기/세트/메인에코/모드)만 가볍게 로드. 저장값 없으면 null.
 * (loadCharacterState는 파티 해석을 재귀 호출하므로 여기선 쓰지 않는다) */
function loadMemberBuild(character: Character): MemberBuild | null {
  if (!hasStorage) return null;
  const raw = localStorage.getItem(SAVE_KEY(character.id));
  if (!raw) return null;
  try {
    const s: SavedState = JSON.parse(raw);
    const weapon = s.weaponId ? (loadWeapons().find((w) => w.id === s.weaponId) ?? null) : null;
    const echoSets = (s.echoSetIds ?? [])
      .map((id) => loadEchoSets().find((x) => x.id === id))
      .filter((x): x is EchoSet => !!x);
    const mainEcho = s.mainEchoId ? (combinedMainEchoes(echoSets).find((m) => m.id === s.mainEchoId) ?? null) : null;
    return {
      ascensionLevel: s.ascensionLevel ?? 0,
      refinementLevel: Math.max(1, Math.min(5, s.refinementLevel ?? 1)),
      weapon, echoSets, mainEcho,
      selectedMode: character.modes?.some((m) => m.id === s.selectedMode) ? s.selectedMode : character.modes?.[0]?.id,
    };
  } catch {
    return null;
  }
}

/** 파티 탭 표시용: 이 파티원이 (내 저장 빌드 기준) 제공하는 버프 목록. */
export function memberProvidedBuffsFor(character: Character) {
  return memberProvidedBuffs(loadMemberBuild(character) ?? {}, character);
}

/** partyMembers를 내 저장 빌드로 해석해 합산용 버프(Buff[])로. disabled 제외, always:true.
 * energy_scale 버프(간섭 표기 등)는 그 파티원의 공효로 실제 값을 구워 넣는다(수령자 공효가 아님). */
function resolvePartyProvidedBuffs(partyMembers: PartyMember[] | undefined, selfId: string): Buff[] {
  const chars = loadCharacters();
  return (partyMembers ?? []).flatMap((pm) => {
    if (pm.id === selfId) return [];
    const char = chars.find((c) => c.id === pm.id);
    if (!char) return [];
    const memberCtx = loadMemberContext(char);              // 완전 빌드(공효 계산용)
    const memberER = memberCtx ? computeEnergyRegen(memberCtx) : 1;
    const build: MemberBuild = loadMemberBuild(char) ?? {}; // 버프 목록/키는 UI(memberProvidedBuffsFor)와 동일 소스
    const off = new Set(pm.disabled ?? []);
    return memberProvidedBuffs(build, char)
      .filter(({ key }) => !off.has(key))
      // specific_character: 내가(수신자) 그 지정 캐릭터일 때만 수혜
      .filter(({ buff: b }) => b.target !== 'specific_character' || b.target_character === selfId)
      .map(({ buff: b }): Buff => ({
        type: b.type,
        value: b.energy_scale ? energyScaleValue(b.energy_scale, memberER) : b.value,
        element: b.element,
        always: true,
      }));
  });
}

// 화면 입력 상태. 데이터 없는(신규) 캐릭터는 무기/메인에코/코스트 미선택 → null, 화음세트/슬롯 미선택 → 빈 배열.
// 넷이 모두 채워졌을 때만 계산 가능(analysisContext).
export interface AppState extends Omit<CalcContext, 'weapon' | 'mainEcho' | 'costLayout'> {
  weapon: Weapon | null;
  mainEcho: MainSlotEcho | null;
  costLayout: CostLayout | null;
}

/** 무기·화음세트·메인에코·코스트가 모두 설정됐을 때만 계산용 CalcContext 반환. 미완이면 null. */
export function analysisContext(s: AppState, includeParty = true): CalcContext | null {
  if (!s.weapon || !s.mainEcho || !s.costLayout || s.echoSets.length === 0 || s.slots.length === 0) return null;
  return {
    ...s, weapon: s.weapon, mainEcho: s.mainEcho, costLayout: s.costLayout,
    // includeParty=false: 파티원 빌드 해석 시 재귀/무한루프 방지용(파티원의 파티는 다시 풀지 않음)
    partyProvidedBuffs: includeParty ? resolvePartyProvidedBuffs(s.partyMembers, s.character.id) : [],
  };
}

/** 파티원 캐릭터의 내 저장 빌드를 완전한 CalcContext로(파티 해석 제외). 미완성/미저장이면 null. */
function loadMemberContext(character: Character): CalcContext | null {
  const saved = loadCharacterState(character);
  return saved ? analysisContext(saved, false) : null;
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

/** 목록 정렬 = 출시 시간순. 기본(내림차순)=버전 desc + 같은 버전 내 후반→전반, 오름차순=버전 asc + 전반→후반.
 * 이름은 방향과 무관하게 항상 오름차순(동일 버전·전반후반 내 안정적 표시). 미지정 phase는 뒤. 목록·드롭다운 공통. */
const phaseRankDesc = (p?: string) => (p === '후반' ? 0 : p === '전반' ? 1 : 2); // 내림차순 기준: 후반 먼저
export function charactersInListOrder(ascending = false): Character[] {
  const dir = ascending ? -1 : 1;
  return [...loadCharacters()].sort((a, b) =>
    dir * (b.version - a.version)
    || dir * (phaseRankDesc(a.version_phase) - phaseRankDesc(b.version_phase))
    || a.name.localeCompare(b.name));
}

/** 캐릭터의 기본 세팅 상태(저장값 없을 때).
 * 전용무기(없으면 추천무기 1순위)·추천 화음세트·추천 메인에코·기본 코스트(43311)를 미리 채워
 * 메인 조합 추천이 바로 보이게 한다. 이 함수는 결정적(deterministic)이어야 하며,
 * isUntouchedDefault가 이 결과와 deep-equal로 비교해 "미조작 이탈 시 저장 팝업"을 막는다.
 * 코스트별 슬롯 배정·조건부 토글은 비워둔다(코스트는 사용자 배정, 토글은 돌파 기준 동적 계산). */
export function defaultStateForCharacter(character: Character): AppState {
  const weapons = loadWeapons();
  const sets = loadEchoSets();
  const weaponId = character.signature_weapon ?? character.recommended_weapons[0] ?? null;
  const weapon = weaponId ? (weapons.find((w) => w.id === weaponId) ?? null) : null;
  const recSets = character.recommended_echo_sets
    .map((id) => sets.find((s) => s.id === id))
    .filter((x): x is EchoSet => !!x);
  // 추천 세트가 여러 개여도 기본 착용은 항상 첫 번째 하나만.
  // 엔진은 echoSets의 모든 세트 버프를 합산하므로, 2개를 넣으면 실제로 동시 착용 불가한 조합이
  // 과다 계산되어 메인 조합 추천이 틀린 값을 보여준다. 나머지 추천 세트는 드롭다운 ★로만 노출.
  const echoSets = recSets.slice(0, 1);
  const mainEcho = echoSets.length ? pickMainEcho(echoSets, character) : null;
  const costLayout: CostLayout = character.cost_layout;
  const base: AppState = {
    character,
    weapon,
    mainEcho,
    echoSets,
    costLayout,
    slots: defaultSlots(costLayout),
    twoPiecePicks: [],
    selectedMode: character.modes?.[0]?.id,
    partyMembers: [],
    conditionalToggles: {},
    manualBuffs: [],
    requiredEnergyRegen: character.default_required_energy_regen,
    ascensionLevel: 0,
    refinementLevel: 1,
  };
  // 자유 2세트 슬롯이 있으면 최적 조합으로 채움(로드 경로와 동일, 결정적)
  const ctx = analysisContext(base, false);
  return { ...base, twoPiecePicks: ctx ? optimalTwoPiecePicks(ctx) : [] };
}

// ===== 캐릭터별 저장/불러오기 (localStorage; 백엔드 도입 시 교체) =====
const SAVE_KEY = (id: string) => `wuwa-scouter:save:${id}`;
const hasStorage = typeof localStorage !== 'undefined';

interface SavedState {
  weaponId: string | null;
  echoSetIds: string[];
  mainEchoId: string | null;
  costLayout: CostLayout | null;
  slots?: EchoSlot[];
  // 구버전 저장분 마이그레이션용 (읽기 전용)
  mainPrimary?: MainPrimaryPick[];
  substats?: SubstatLine[][];
  twoPiecePicks?: string[];
  selectedMode?: string;
  partyMembers?: PartyMember[];
  conditionalToggles: Record<string, boolean>;
  manualBuffs: ManualBuff[];
  requiredEnergyRegen?: number;
  ascensionLevel?: number;
  refinementLevel?: number;
}

function serializeState(state: AppState): SavedState {
  return {
    weaponId: state.weapon?.id ?? null,
    echoSetIds: state.echoSets.map((e) => e.id),
    mainEchoId: state.mainEcho?.id ?? null,
    costLayout: state.costLayout,
    slots: state.slots,
    twoPiecePicks: state.twoPiecePicks ?? [],
    selectedMode: state.selectedMode,
    partyMembers: state.partyMembers ?? [],
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

/** 저장값이 없고 아직 기본(빈) 상태 그대로면 true — 저장/이탈 차단할 것이 없음.
 * (데이터 없는 캐릭터에 들어갔다가 아무것도 안 하고 나갈 때 저장 확인 팝업 방지) */
export function isUntouchedDefault(state: AppState): boolean {
  if (hasSavedState(state.character.id)) return false;
  return JSON.stringify(serializeState(state))
    === JSON.stringify(serializeState(defaultStateForCharacter(state.character)));
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
    // 저장값을 그대로 복원 — 미선택(null/빈배열)이면 채우지 않고 그대로 비워둔다.
    const weapon = s.weaponId ? (weapons.find((w) => w.id === s.weaponId) ?? null) : null;
    const echoSets = (s.echoSetIds ?? [])
      .map((id) => sets.find((x) => x.id === id))
      .filter((x): x is EchoSet => !!x);
    const combined = combinedMainEchoes(echoSets);
    const mainEcho = s.mainEchoId ? (combined.find((m) => m.id === s.mainEchoId) ?? null) : null;
    const layout: CostLayout | null = s.costLayout ?? null;
    // 신형 slots: 길이 5 + 각 요소 형태 검증(손상/구포맷 저장분이 malformed slots로 로드돼 렌더 시 크래시하는 것 방지)
    const validSlot = (x: unknown): x is EchoSlot => {
      const o = x as EchoSlot | undefined;
      return !!o && typeof o === 'object'
        && (o.cost === null || o.cost === 1 || o.cost === 3 || o.cost === 4)
        && typeof o.main === 'string'
        && Array.isArray(o.substats);
    };
    const slots = Array.isArray(s.slots) && s.slots.length === 5 && s.slots.every(validSlot)
      ? s.slots
      : (s.mainPrimary && s.substats && layout) // 구버전 저장분 1:1 변환(코스트 있을 때만)
        ? slotsFrom(layout, s.mainPrimary, s.substats)
        : (layout ? defaultSlots(layout) : []);
    const state: AppState = {
      character,
      weapon,
      mainEcho,
      echoSets,
      costLayout: layout,
      slots,
      twoPiecePicks: [],
      selectedMode: character.modes?.some((m) => m.id === s.selectedMode) ? s.selectedMode : character.modes?.[0]?.id,
      partyMembers: restorePartyMembers(s.partyMembers, character.id),
      conditionalToggles: s.conditionalToggles ?? {},
      manualBuffs: s.manualBuffs ?? [],
      requiredEnergyRegen: s.requiredEnergyRegen,
      ascensionLevel: s.ascensionLevel ?? 0,
      refinementLevel: Math.max(1, Math.min(5, s.refinementLevel ?? 1)),
    };
    // 자유 2세트 효과: 저장값이 유효하면 사용, 아니면(구버전/누락) 계산 가능할 때만 최적 조합으로 보정
    const pool = loadTwoPieceEffects();
    const saved = s.twoPiecePicks;
    const twoPieceSlotCount = freeTwoPieceSlots(echoSets);
    const valid = Array.isArray(saved) && saved.length === twoPieceSlotCount
      && saved.every((id) => pool.some((p) => p.id === id));
    const ctx = analysisContext(state, false); // twoPiece 최적화엔 파티 버프 불필요 + 재귀 회피
    return { ...state, twoPiecePicks: valid ? saved! : (ctx ? optimalTwoPiecePicks(ctx) : []) };
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
