import { describe, it, expect } from 'vitest';
import { loadEchoSets } from '../../src/engine/loadData';
import { aggregateBuffs } from '../../src/engine/buffs';
import { hiyukiBaseCtx } from './fixtures';

describe('buff target — single-character exclusion', () => {
  it('self-targeted main echo (void_god) contributes its element bonus', () => {
    // 세트 2코 0.10 + 5코 0.10(ON) + void_god 메인에코 0.12 = 0.32
    expect(aggregateBuffs(hiyukiBaseCtx()).element_bonus).toBeCloseTo(0.32, 10);
  });

  it('next_character buff (글로모스) is excluded from my aggregation', () => {
    const glomos = loadEchoSets()[0].main_slot_echoes.find((e) => e.id === 'glommoth')!;
    const ctx = { ...hiyukiBaseCtx(), mainEcho: glomos };
    // 글로모스의 유일한 버프는 element_damage_bonus 0.12 (target next_character) → 제외.
    // 따라서 element_bonus = 세트 0.20만 (메인에코 기여 0).
    expect(aggregateBuffs(ctx).element_bonus).toBeCloseTo(0.20, 10);
  });
});
