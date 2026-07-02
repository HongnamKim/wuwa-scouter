import { describe, it, expect } from 'vitest';
import { loadCharacters, loadWeapons, loadEchoSets } from '../../src/engine/loadData';
import { buildPerfInput } from '../../src/engine/build';
import type { CalcContext } from '../../src/engine/context';
import { slotsFrom } from '../../src/engine/echoSlots';

// 방어 스케일 캐릭터를 합성(기존 공격 캐릭에 scale_stat/base_defense만 덮어씀).
function defenseCtx(): CalcContext {
  const base = loadCharacters().find((c) => c.id === 'hiyuki')!;
  const character = { ...base, scale_stat: 'defense' as const, base_attack: 462, base_defense: 1000 };
  const weapon = loadWeapons().find((w) => w.id === 'frostbound_flame')!; // base_stats.attack = 587
  const echoSet = loadEchoSets()[0];
  return {
    character, weapon,
    mainEcho: echoSet.main_slot_echoes[0], echoSets: [echoSet],
    costLayout: '43311', slots: slotsFrom('43311', [], []),
    conditionalToggles: {},
    manualBuffs: [
      { type: 'defense_percent', value: 50, enabled: true },
      { type: 'attack_percent', value: 30, enabled: true }, // 방어 스케일러엔 무영향이어야
    ],
  };
}

describe('scale_stat 일반화 (방어 스케일)', () => {
  it('기초 스탯 = base_defense (base_attack·무기 공격 미사용)', () => {
    // 1000 (defense) — 462(base_attack)도 587(무기 공격)도, 합 1049도 아니어야 함
    expect(buildPerfInput(defenseCtx()).baseAttack).toBe(1000);
  });

  it('defense_percent 버프가 % 스탯에 +0.50 반영', () => {
    const on = defenseCtx();
    const off = defenseCtx();
    off.manualBuffs = off.manualBuffs.filter((m) => m.type !== 'defense_percent');
    const d = buildPerfInput(on).attackPercent - buildPerfInput(off).attackPercent;
    expect(d).toBeCloseTo(0.50, 10);
  });

  it('attack_percent 버프는 방어 스케일러 % 스탯에 무영향', () => {
    const withAtk = defenseCtx();
    const withoutAtk = defenseCtx();
    withoutAtk.manualBuffs = withoutAtk.manualBuffs.filter((m) => m.type !== 'attack_percent');
    expect(buildPerfInput(withAtk).attackPercent).toBeCloseTo(buildPerfInput(withoutAtk).attackPercent, 10);
  });
});
