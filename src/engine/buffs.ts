import type { Buff, Character, Weapon, EchoSet, MainSlotEcho } from '../types/data';
import type { StatKey } from '../types/domain';
import type { CalcContext } from './context';
import { loadTwoPieceEffects } from './loadData';
import { damageBonusTypeOf, activeModeId } from './mode';
import { MAIN_PRIMARY } from './constants';
import { energyScaleValue } from './mechanisms';

export interface BuffTotals {
  critical_rate: number;
  critical_damage: number;
  attack_percent: number;
  hp_percent: number;         // 스케일 스탯이 hp인 캐릭터용
  defense_percent: number;    // 스케일 스탯이 defense인 캐릭터용
  element_bonus: number;      // element_damage_bonus (일치)
  damage_type_bonus: number;  // 캐릭터 damage_bonus_type 해당 *_bonus
  amplify: number;            // 부스트 곱연산 합 (계산용 총합)
  amplify_element: number;    // 표시용: 속성 피해 부스트분
  amplify_damage_type: number;// 표시용: 캐릭터 피해유형 부스트분
  amplify_all: number;        // 표시용: 전체 피해 부스트분
  damage_type_bonus_factor: number; // 피해유형 보너스 합계에 더해지는 배수분(0.4 → ×1.4). 곱연산
  energy_regen: number;       // 공명효율(딜 무영향, 표시용)
  defense_ignore: number;     // 방어력 무시 합 (무기 비교용 딜 반영)
  element_resistance_ignore: number; // 속성 저항 무시 합 (element 일치분)
}

const AMPLIFY_KEYS: StatKey[] = [
  'element_damage_amplify', 'all_damage_amplify', 'basic_attack_amplify',
  'heavy_attack_amplify', 'resonance_skill_amplify', 'resonance_liberation_amplify',
  'echo_skill_amplify',
];

/** 파티원의 빌드(내가 저장한 그 캐릭터 데이터). memberProvidedBuffs에 넘긴다. */
export interface MemberBuild {
  ascensionLevel?: number;
  refinementLevel?: number;
  weapon?: Weapon | null;
  echoSets?: EchoSet[];
  mainEcho?: MainSlotEcho | null;
  selectedMode?: string;
}

/** 파티원 제공 버프의 출처 라벨(고유 스킬/무기/화음 세트/메인 에코) */
export type BuffSource = '고유 스킬' | '무기' | '화음 세트' | '메인 에코';

/** 파티원이 제공하는(내가 받는) party/next_character 버프 목록.
 * 내 저장 빌드(build)를 활용: 돌파 게이트(min_ascension) + 착용 무기(재련)/화음세트/메인에코 party 버프 포함.
 * record_only 제외. 개별 토글 키(id 없으면 인덱스) + 출처와 함께 반환 — UI 표시와 계산이 동일 키를 쓴다. */
export function memberProvidedBuffs(build: MemberBuild, char: Character): { key: string; buff: Buff; source: BuffSource }[] {
  const asc = build.ascensionLevel ?? 0;
  const ref = build.refinementLevel ?? 1;
  const weaponBuffs: Buff[] = (build.weapon?.buffs ?? []).map((b) => ({ ...b, value: b.refinement_values?.[ref - 1] ?? b.value }));
  const uniqueSets = (build.echoSets ?? []).filter((s, i, arr) => arr.findIndex((x) => x.id === s.id) === i);
  const tagged: { buff: Buff; source: BuffSource }[] = [
    ...char.skill_node.map((b): { buff: Buff; source: BuffSource } => ({ buff: b, source: '고유 스킬' })),
    ...weaponBuffs.map((b): { buff: Buff; source: BuffSource } => ({ buff: b, source: '무기' })),
    ...uniqueSets.flatMap((s) => s.buffs).map((b): { buff: Buff; source: BuffSource } => ({ buff: b, source: '화음 세트' })),
    ...(build.mainEcho?.buffs ?? []).map((b): { buff: Buff; source: BuffSource } => ({ buff: b, source: '메인 에코' })),
  ];
  return tagged
    .filter(({ buff: b }) => (b.target === 'party' || b.target === 'next_character') && !b.record_only)
    .filter(({ buff: b }) => b.min_ascension == null || asc >= b.min_ascension)   // 돌파 게이트: 미달 버프 제외
    .filter(({ buff: b }) => !b.mode || b.mode === (build.selectedMode ?? char.modes?.[0]?.id))
    // 피해유형 게이트: 파티원(멤버)의 현재 모드 피해유형 기준 (예: 반주 분기는 공명해방 멤버에겐 미제공)
    .filter(({ buff: b }) => {
      if (!b.damage_bonus_type && !b.exclude_damage_bonus_type) return true;
      const dbt = damageBonusTypeOf({ character: char, selectedMode: build.selectedMode });
      if (b.damage_bonus_type && b.damage_bonus_type !== dbt) return false;
      if (b.exclude_damage_bonus_type && b.exclude_damage_bonus_type === dbt) return false;
      return true;
    })
    .map(({ buff: b, source }, i) => ({ key: b.id ?? `#${i}`, buff: b, source }));
}

/** 조건부 버프의 체크박스 기본 상태. default_on_from_ascension이 우선, 없으면 default_on(미지정 시 true) */
export function defaultBuffChecked(b: Buff, ascensionLevel: number): boolean {
  if (b.default_on_from_ascension != null) return ascensionLevel >= b.default_on_from_ascension;
  if (b.default_on != null) return b.default_on;
  return true;
}

/** 이 버프가 현재 활성인지 (대상 / 상시 / 조건부 토글 / element 일치) */
function isActive(b: Buff, ctx: CalcContext): boolean {
  // record_only(특정 스킬 계수/한정): 계산 완전 제외(기록용). absolute_score_only는 계산 포함(비율에선 자동 약분).
  if (b.record_only) return false;
  // 단일 공명자 분석: 내게 적용되는 버프만(self/party). next_character 등은 제외
  if (b.target && b.target !== 'self' && b.target !== 'party') return false;
  // element 게이트: 지정 원소가 캐릭터와 다르면 제외. '전체'(전체 속성피해)는 게이트 없이 통과.
  if (b.element && b.element !== '전체' && b.element !== ctx.character.element) return false;
  // 피해유형 게이트(예: 「강설」→공명해방 크리 분기 / 반주 분기). 모드 전환 캐릭터는 현재 모드 피해유형 기준
  const dbt = damageBonusTypeOf(ctx);
  if (b.damage_bonus_type && b.damage_bonus_type !== dbt) return false;
  if (b.exclude_damage_bonus_type && b.exclude_damage_bonus_type === dbt) return false;
  // 모드 전환 캐릭터: 버프에 mode 지정 시 해당 모드 선택일 때만 활성
  if (b.mode && b.mode !== activeModeId(ctx)) return false;
  // 돌파(공명 체인) 조건: 미달이면 비활성 (예: 히유키 6돌 2스택)
  if (b.min_ascension != null && (ctx.ascensionLevel ?? 0) < b.min_ascension) return false;
  if (b.always) return true;
  if (!b.id) return true;
  // 조건부: 개별 토글에 따름. 미터치(undefined) 시 default_on/default_on_from_ascension 기준
  const t = ctx.conditionalToggles[b.id];
  return t !== undefined ? t : defaultBuffChecked(b, ctx.ascensionLevel ?? 0);
}

function damageTypeBonusKey(ctx: CalcContext): StatKey | null {
  const t = damageBonusTypeOf(ctx);
  return t ? (`${t}_bonus` as StatKey) : null;
}

function damageTypeAmplifyKey(ctx: CalcContext): StatKey | null {
  const t = damageBonusTypeOf(ctx);
  return t ? (`${t}_amplify` as StatKey) : null;
}

export function aggregateBuffs(ctx: CalcContext): BuffTotals {
  const t: BuffTotals = {
    critical_rate: 0, critical_damage: 0, attack_percent: 0, hp_percent: 0, defense_percent: 0,
    element_bonus: 0, damage_type_bonus: 0, amplify: 0, amplify_element: 0, amplify_damage_type: 0, amplify_all: 0, damage_type_bonus_factor: 0, energy_regen: 0,
    defense_ignore: 0, element_resistance_ignore: 0,
  };
  const dmgTypeBonus = damageTypeBonusKey(ctx);
  const dmgTypeAmp = damageTypeAmplifyKey(ctx);

  // 데이터 출처 버프는 isActive로(대상/element/토글), 수동 버프는 마스터 토글로만 판정.
  // 같은 세트가 중복 선택돼도 한 번만 집계
  const uniqueSets = ctx.echoSets.filter((s, i) => ctx.echoSets.findIndex((x) => x.id === s.id) === i);
  // 무기 재련(공진 1~5): 버프량은 weapons.json의 refinement_values[공진-1] 데이터에서 조회 (없으면 기본 value)
  const ref = ctx.refinementLevel ?? 1;
  const weaponBuffs: Buff[] = ctx.weapon.buffs.map((b) => ({ ...b, value: b.refinement_values?.[ref - 1] ?? b.value }));
  // 자유 2세트 효과(원소피해/공격력 등): 선택 id를 버프로 환산. 같은 id 2회 선택 시 2배(예: 회절+회절)
  const pool = loadTwoPieceEffects();
  const twoPieceBuffs: Buff[] = (ctx.twoPiecePicks ?? [])
    .map((id): Buff | null => {
      const e = pool.find((x) => x.id === id);
      return e ? { type: e.type, value: e.value, always: true, element: e.element_from_character ? ctx.character.element : undefined } : null;
    })
    .filter((b): b is Buff => !!b);
  const dataBuffs: Buff[] = [
    ...ctx.character.skill_node,
    ...ctx.mainEcho.buffs,
    ...weaponBuffs,
    ...uniqueSets.flatMap((s) => s.buffs),
    ...twoPieceBuffs,
    // 편성 파티원이 제공하는 버프(store가 내 저장 빌드로 해석·주입. element/피해유형 필터는 내 캐릭터 기준).
    ...(ctx.partyProvidedBuffs ?? []),
  ];
  const manualBuffs: Buff[] = ctx.manualBuffs
    .filter((m) => m.type && m.value != null && m.enabled !== false)
    .map((m): Buff => ({ type: m.type as StatKey, value: (m.value as number) / 100, always: false }));

  const entries: { b: Buff; active: boolean }[] = [
    ...dataBuffs.map((b) => ({ b, active: isActive(b, ctx) })),
    ...manualBuffs.map((b) => ({ b, active: true })),
  ];

  const scaled: Buff[] = []; // 공효 스케일 버프는 공효 계산 후 2패스로 반영
  for (const { b, active } of entries) {
    if (!active) continue;
    if (b.energy_scale) { scaled.push(b); continue; }

    if (b.type === 'critical_rate') t.critical_rate += b.value;
    else if (b.type === 'critical_damage') t.critical_damage += b.value;
    else if (b.type === 'attack_percent') t.attack_percent += b.value;
    else if (b.type === 'hp_percent') t.hp_percent += b.value;
    else if (b.type === 'defense_percent') t.defense_percent += b.value;
    else if (b.type === 'element_damage_bonus') t.element_bonus += b.value;
    else if (dmgTypeBonus && b.type === dmgTypeBonus) t.damage_type_bonus += b.value;
    else if (AMPLIFY_KEYS.includes(b.type)) {
      // 부스트: 속성/전체/캐릭터 피해유형 amplify만 계산 총합에 반영. 표시용으로 속성·유형·전체 분리 집계.
      // 속성 부스트·전체 부스트는 유형 무관하게 항상 반영. 유형 부스트는 캐릭터 피해유형과 일치할 때만(null 유형이면 무시).
      if (b.type === 'element_damage_amplify') { t.amplify += b.value; t.amplify_element += b.value; }
      else if (b.type === 'all_damage_amplify') { t.amplify += b.value; t.amplify_all += b.value; }
      else if (dmgTypeAmp && b.type === dmgTypeAmp) { t.amplify += b.value; t.amplify_damage_type += b.value; }
    }
    else if (b.type === 'damage_type_bonus_factor') t.damage_type_bonus_factor += b.value; // 피해유형 보너스 ×(1+합)
    else if (b.type === 'energy_regen') t.energy_regen += b.value; // 딜 무영향, 표시용 집계
    else if (b.type === 'defense_ignore') t.defense_ignore += b.value;
    else if (b.type === 'element_resistance_ignore') t.element_resistance_ignore += b.value; // isActive에서 element 일치 필터됨
  }

  // 공효 스케일 버프: 실제 공효(초과분)로 값 계산 후 반영. min(per_percent × 초과공효%, cap)
  if (scaled.length > 0) {
    const weaponER = ctx.weapon.base_stats.energy_regen ?? 0;
    const subER = ctx.slots.flatMap((s) => s.substats)
      .filter((l) => l.type === 'energy_regen' && l.value != null)
      .reduce((s, l) => s + (l.value as number), 0) / 100;
    let mainER = 0;
    for (const slot of ctx.slots) {
      if (slot.cost != null && slot.main === 'energy_regen') mainER += (MAIN_PRIMARY[slot.cost].energy_regen ?? 0) / 100;
    }
    const energyRegen = 1 + weaponER + subER + t.energy_regen + mainER;
    for (const b of scaled) {
      const v = energyScaleValue(b.energy_scale!, energyRegen);
      if (b.type === 'critical_rate') t.critical_rate += v;
      else if (b.type === 'critical_damage') t.critical_damage += v;
      else if (b.type === 'all_damage_amplify') { t.amplify += v; t.amplify_all += v; }
    }
  }
  return t;
}
