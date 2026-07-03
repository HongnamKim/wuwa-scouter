import { describe, it, expect } from 'vitest';
import { loadCharacters, loadWeapons, loadEchoSets } from '../../src/engine/loadData';
import { aggregateBuffs, memberProvidedBuffs } from '../../src/engine/buffs';
import { slotsFrom } from '../../src/engine/echoSlots';
import type { CalcContext } from '../../src/engine/context';
import type { Buff } from '../../src/types/data';

function ctx(partyProvidedBuffs: Buff[]): CalcContext {
  const character = loadCharacters().find((c) => c.id === 'hiyuki')!;
  const weapon = loadWeapons().find((w) => w.id === 'frostbound_flame')!;
  const echoSet = loadEchoSets()[0];
  return {
    character, weapon, mainEcho: echoSet.main_slot_echoes[0], echoSets: [echoSet],
    costLayout: '43311', slots: slotsFrom('43311', [], []),
    conditionalToggles: {}, manualBuffs: [], partyProvidedBuffs,
  };
}

describe('파티원 제공 버프 (내 저장 빌드 기준)', () => {
  const mornye = () => loadCharacters().find((c) => c.id === 'mornye')!;

  it('돌파 게이트: min_ascension 미달 버프는 제외 (모니에 CHAIN.2 = 2돌)', () => {
    const at1 = memberProvidedBuffs({ ascensionLevel: 1 }, mornye()).map((x) => x.buff.id);
    const at2 = memberProvidedBuffs({ ascensionLevel: 2 }, mornye()).map((x) => x.buff.id);
    expect(at1.includes('mornye_chain2')).toBe(false);
    expect(at2.includes('mornye_chain2')).toBe(true);
  });

  it('착용 무기의 party 버프가 목록에 포함된다', () => {
    const weapon = loadWeapons().find((w) => w.id === 'starfield_calibrator')!; // party 크피 제공
    const noWeapon = memberProvidedBuffs({}, mornye());
    const withWeapon = memberProvidedBuffs({ weapon }, mornye());
    expect(withWeapon.length).toBeGreaterThan(noWeapon.length);
  });

  it('energy_scale 버프는 energy_scale 필드가 유지된다(스토어가 공효로 값 계산)', () => {
    const provided = memberProvidedBuffs({}, mornye());
    const interf = provided.find((x) => x.buff.id === 'mornye_interference');
    expect(interf?.buff.energy_scale).toBeDefined();
  });

  it('aggregateBuffs가 partyProvidedBuffs를 합산', () => {
    const base = aggregateBuffs(ctx([]));
    const withBuff = aggregateBuffs(ctx([{ type: 'critical_damage', value: 0.4, always: true }]));
    expect(withBuff.critical_damage).toBeCloseTo(base.critical_damage + 0.4, 6);
  });

  it('기도의 눈 반주 분기(다음 캐릭터 응결): 비공명해방 멤버(루실라)만 제공, 공명해방 멤버(히유키)는 미제공', () => {
    const wishes = loadEchoSets().find((s) => s.id === 'wishes_of_quiet_snowfall')!;
    const lucilla = loadCharacters().find((c) => c.id === 'lucilla')!;
    const hiyuki = loadCharacters().find((c) => c.id === 'hiyuki')!;
    const luc = memberProvidedBuffs({ echoSets: [wishes] }, lucilla).map((x) => x.buff.id);
    const hiy = memberProvidedBuffs({ echoSets: [wishes] }, hiyuki).map((x) => x.buff.id);
    expect(luc.includes('set_5pc_next_element')).toBe(true);
    expect(hiy.includes('set_5pc_next_element')).toBe(false);
  });

  it("element 게이트: '전체'는 원소 불문 적용, 특정 원소는 불일치 시 제외 (수혜자=히유키 응결)", () => {
    const base = aggregateBuffs(ctx([])).element_bonus;
    const jeonche = aggregateBuffs(ctx([{ type: 'element_damage_bonus', value: 0.1, always: true, element: '전체' }])).element_bonus;
    const mismatch = aggregateBuffs(ctx([{ type: 'element_damage_bonus', value: 0.1, always: true, element: '용융' }])).element_bonus;
    expect(jeonche - base).toBeCloseTo(0.1, 6); // 전체 → 적용
    expect(mismatch - base).toBeCloseTo(0, 6);   // 용융 → 응결 캐릭터엔 제외
  });
});
