import { describe, it, expect, expectTypeOf } from 'vitest';
import { STAT_KEYS, ELEMENTS } from '../src/types/domain';
import type { Character } from '../src/types/data';
import type { BuffData, CharacterData, SkillNodeData, WeaponData } from '../src/data/schema';
import { characters } from '../src/data/characters';
import { weapons } from '../src/data/weapons';

describe('types', () => {
  it('작성용 타입이 필수 필드·오타·버프 정책 위반을 컴파일 단계에서 거부한다', () => {
    expectTypeOf(characters.buling).toMatchTypeOf<CharacterData>();
    expectTypeOf(weapons.variation).toMatchTypeOf<WeaponData>();
    // 아래 expect-error는 npm run build의 tsc가 검사한다. 잘못된 값이 허용되면 빌드가 실패한다.
    // @ts-expect-error 캐릭터 필수 정보 누락
    ({ id: 'new_character', name: '신규' }) satisfies CharacterData;
    // @ts-expect-error 존재하지 않는 필드 이름
    ({ ...characters.buling, recommended_weapon_ids: [] }) satisfies CharacterData;
    // @ts-expect-error 허용하지 않는 원소
    ({ ...characters.buling, element: '화염' }) satisfies CharacterData;
    // @ts-expect-error 존재하지 않는 무기 ID
    ({ ...characters.buling, recommended_weapons: ['varation'] }) satisfies CharacterData;
    // @ts-expect-error 존재하지 않는 전용 무기 ID
    ({ ...characters.buling, signature_weapon: 'missing_weapon' }) satisfies CharacterData;
    // @ts-expect-error 존재하지 않는 세트 ID
    ({ ...characters.buling, recommended_echo_sets: ['missing_set'] }) satisfies CharacterData;
    // @ts-expect-error 무기 기초 공격력 누락
    ({ ...weapons.variation, base_stats: { energy_regen: 0.5 } }) satisfies WeaponData;
    // @ts-expect-error 점수 플래그 누락
    ({ type: 'critical_rate', value: 0.08, always: true }) satisfies BuffData;
    // @ts-expect-error 두 점수 플래그는 동시에 true일 수 없음
    ({ type: 'critical_rate', value: 0.08, always: true, record_only: true, absolute_score_only: true }) satisfies BuffData;
    // @ts-expect-error 특정 스킬 배율은 기록 전용이어야 함
    ({ type: 'skill_motion_value_amplify', value: 0.2, always: true, record_only: false, absolute_score_only: false }) satisfies BuffData;
    // @ts-expect-error 공진별 수치는 다섯 개여야 함
    ({ type: 'attack_percent', value: 0.1, always: true, record_only: false, absolute_score_only: false, refinement_values: [0.1, 0.2] }) satisfies BuffData;
    // @ts-expect-error 특정 캐릭터 대상에는 target_character 필수
    ({ type: 'energy_regen', value: 0.1, always: true, record_only: false, absolute_score_only: false, target: 'specific_character' }) satisfies BuffData;
    // @ts-expect-error 스킬 노드의 대상과 돌파 조건 누락
    ({ type: 'critical_rate', value: 0.08, always: true, record_only: false, absolute_score_only: false }) satisfies SkillNodeData;
    // @ts-expect-error 돌파 조건은 0~6
    ({ type: 'critical_rate', value: 0.08, always: true, record_only: false, absolute_score_only: false, target: 'self', min_ascension: 7 }) satisfies SkillNodeData;
  });

  it('exposes stat key + element vocab', () => {
    expect(STAT_KEYS).toContain('element_damage_amplify');
    expect(STAT_KEYS).toContain('defense_ignore');
    expect(ELEMENTS).toContain('응결');
  });

  it('Character shape compiles', () => {
    const c: Character = {
      id: 'x', name: 'x', version: 1, element: '응결', weapon_type: 'sword', cost_layout: '43311', scale_stat: 'attack', matrix_cost: 1, base_attack: 1,
      effective_substats: ['critical_rate'], damage_bonus_type: null,
      energy_regen_mode: 'premise', default_required_energy_regen: 25, special_mechanism: null, recommended_echo_sets: [], recommended_main_echo: [], recommended_weapons: [],
      signature_weapon: null,
      skill_node: [],
    };
    expect(c.id).toBe('x');
  });
});
