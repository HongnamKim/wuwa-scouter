import type { Buff } from '../types/data';
import type { StatKey } from '../types/domain';
import type { CalcContext } from './context';

export interface BuffTotals {
  critical_rate: number;
  critical_damage: number;
  attack_percent: number;
  element_bonus: number;      // element_damage_bonus (일치)
  damage_type_bonus: number;  // 캐릭터 damage_bonus_type 해당 *_bonus
  amplify: number;            // 부스트 곱연산 합
  energy_regen: number;       // 공명효율(딜 무영향, 표시용)
}

const AMPLIFY_KEYS: StatKey[] = [
  'element_damage_amplify', 'all_damage_amplify', 'basic_attack_amplify',
  'heavy_attack_amplify', 'resonance_skill_amplify', 'resonance_liberation_amplify',
];

/** 이 버프가 현재 활성인지 (대상 / 상시 / 조건부 토글 / element 일치) */
function isActive(b: Buff, ctx: CalcContext): boolean {
  // 단일 공명자 분석: 내게 적용되는 버프만(self/party). next_character 등은 제외
  if (b.target && b.target !== 'self' && b.target !== 'party') return false;
  if (b.element && b.element !== ctx.character.element) return false;
  if (b.always) return true;
  // 조건부: 개별 토글에 따름(미지정 시 기본 on)
  return b.id ? ctx.conditionalToggles[b.id] !== false : true;
}

function damageTypeBonusKey(ctx: CalcContext): StatKey | null {
  return ctx.character.damage_bonus_type
    ? (`${ctx.character.damage_bonus_type}_bonus` as StatKey)
    : null;
}

function damageTypeAmplifyKey(ctx: CalcContext): StatKey | null {
  return ctx.character.damage_bonus_type
    ? (`${ctx.character.damage_bonus_type}_amplify` as StatKey)
    : null;
}

export function aggregateBuffs(ctx: CalcContext): BuffTotals {
  const t: BuffTotals = {
    critical_rate: 0, critical_damage: 0, attack_percent: 0,
    element_bonus: 0, damage_type_bonus: 0, amplify: 0, energy_regen: 0,
  };
  const dmgTypeBonus = damageTypeBonusKey(ctx);
  const dmgTypeAmp = damageTypeAmplifyKey(ctx);

  // 데이터 출처 버프는 isActive로(대상/element/토글), 수동 버프는 마스터 토글로만 판정.
  const dataBuffs: Buff[] = [
    ...ctx.character.skill_node,
    ...ctx.mainEcho.buffs,
    ...ctx.weapon.buffs,
    ...ctx.echoSets.flatMap((s) => s.buffs),
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
        ctx.character.damage_bonus_type === null
      ) {
        t.amplify += b.value;
      }
    }
    else if (b.type === 'energy_regen') t.energy_regen += b.value; // 딜 무영향, 표시용 집계
    // defense_ignore 등은 근사 트랙 무영향 → 무시
  }
  return t;
}
