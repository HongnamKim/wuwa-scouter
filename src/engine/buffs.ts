import type { Buff } from '../types/data';
import type { StatKey } from '../types/domain';
import type { CalcContext } from './context';
import { loadTwoPieceEffects } from './loadData';
import { damageBonusTypeOf, activeModeId } from './mode';

export interface BuffTotals {
  critical_rate: number;
  critical_damage: number;
  attack_percent: number;
  element_bonus: number;      // element_damage_bonus (일치)
  damage_type_bonus: number;  // 캐릭터 damage_bonus_type 해당 *_bonus
  amplify: number;            // 부스트 곱연산 합
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

/** 이 버프가 현재 활성인지 (대상 / 상시 / 조건부 토글 / element 일치) */
function isActive(b: Buff, ctx: CalcContext): boolean {
  // 단일 공명자 분석: 내게 적용되는 버프만(self/party). next_character 등은 제외
  if (b.target && b.target !== 'self' && b.target !== 'party') return false;
  if (b.element && b.element !== ctx.character.element) return false;
  // 모드 전환 캐릭터: 버프에 mode 지정 시 해당 모드 선택일 때만 활성
  if (b.mode && b.mode !== activeModeId(ctx)) return false;
  // 돌파(공명 체인) 조건: 미달이면 비활성 (예: 히유키 6돌 2스택)
  if (b.min_ascension != null && (ctx.ascensionLevel ?? 0) < b.min_ascension) return false;
  if (b.always) return true;
  // 조건부: 개별 토글에 따름(미지정 시 기본 on)
  return b.id ? ctx.conditionalToggles[b.id] !== false : true;
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
    critical_rate: 0, critical_damage: 0, attack_percent: 0,
    element_bonus: 0, damage_type_bonus: 0, amplify: 0, damage_type_bonus_factor: 0, energy_regen: 0,
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
  ];
  const manualBuffs: Buff[] = ctx.manualBuffs
    .filter((m) => m.type && m.value != null && m.enabled !== false)
    .map((m): Buff => ({ type: m.type as StatKey, value: (m.value as number) / 100, always: false }));

  const entries: { b: Buff; active: boolean }[] = [
    ...dataBuffs.map((b) => ({ b, active: isActive(b, ctx) })),
    ...manualBuffs.map((b) => ({ b, active: true })),
  ];

  for (const { b, active } of entries) {
    if (!active) continue;

    if (b.type === 'critical_rate') t.critical_rate += b.value;
    else if (b.type === 'critical_damage') t.critical_damage += b.value;
    else if (b.type === 'attack_percent') t.attack_percent += b.value;
    else if (b.type === 'element_damage_bonus') t.element_bonus += b.value;
    else if (dmgTypeBonus && b.type === dmgTypeBonus) t.damage_type_bonus += b.value;
    else if (AMPLIFY_KEYS.includes(b.type)) {
      // 부스트: element_damage_amplify(일치)·all_damage_amplify·쏠림유형 amplify만.
      // damage_bonus_type=null(골고루)이면 모든 amplify 합산(가방식).
      if (
        b.type === 'element_damage_amplify' ||
        b.type === 'all_damage_amplify' ||
        (dmgTypeAmp && b.type === dmgTypeAmp) ||
        damageBonusTypeOf(ctx) === null
      ) {
        t.amplify += b.value;
      }
    }
    else if (b.type === 'damage_type_bonus_factor') t.damage_type_bonus_factor += b.value; // 피해유형 보너스 ×(1+합)
    else if (b.type === 'energy_regen') t.energy_regen += b.value; // 딜 무영향, 표시용 집계
    else if (b.type === 'defense_ignore') t.defense_ignore += b.value;
    else if (b.type === 'element_resistance_ignore') t.element_resistance_ignore += b.value; // isActive에서 element 일치 필터됨
  }
  return t;
}
