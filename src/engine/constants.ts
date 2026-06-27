import type { StatKey, Cost, CostLayout } from '../types/domain';

export const BASE_CRIT = 0.05;
export const BASE_CRIT_DAMAGE = 1.5;

const TYPE_BONUS = [6.4, 7.1, 7.9, 8.6, 9.4, 10.1, 10.9, 11.6];

export const SUBSTAT_STAGES: Partial<Record<StatKey, number[]>> = {
  critical_rate: [6.3, 6.9, 7.5, 8.1, 8.7, 9.3, 9.9, 10.5],
  critical_damage: [12.6, 13.8, 15, 16.2, 17.4, 18.6, 19.8, 21],
  energy_regen: [6.8, 7.6, 8.4, 9.2, 10, 10.8, 11.6, 12.4],
  defense_percent: [8.1, 9, 10, 10.9, 11.8, 12.8, 13.8, 14.7],
  attack_percent: TYPE_BONUS,
  hp_percent: TYPE_BONUS,
  element_damage_bonus: TYPE_BONUS,
  basic_attack_bonus: TYPE_BONUS,
  heavy_attack_bonus: TYPE_BONUS,
  resonance_skill_bonus: TYPE_BONUS,
  resonance_liberation_bonus: TYPE_BONUS,
  flat_hp: [320, 360, 390, 430, 470, 510, 540, 580],
  flat_attack: [30, 40, 50, 60],
  flat_defense: [40, 50, 60, 70],
};

export function substatFourthFromBottom(key: StatKey): number {
  const stages = SUBSTAT_STAGES[key];
  if (!stages) throw new Error(`no stages for ${key}`);
  return stages[3];
}

export function substatMaxStage(key: StatKey): number {
  const stages = SUBSTAT_STAGES[key];
  if (!stages) throw new Error(`no stages for ${key}`);
  return stages[stages.length - 1];
}

export const MAIN_PRIMARY: Record<Cost, Partial<Record<StatKey, number>>> = {
  1: { attack_percent: 18.0, hp_percent: 22.8, defense_percent: 18.0 },
  3: {
    attack_percent: 30.0, hp_percent: 30.0, defense_percent: 38.0,
    element_damage_bonus: 30.0, energy_regen: 32.0,
  },
  4: {
    attack_percent: 33.0, hp_percent: 33.0, defense_percent: 41.5,
    critical_rate: 22.0, critical_damage: 44.0, healing_bonus: 26.0,
  },
};

export const MAIN_SECONDARY: Record<Cost, { stat: StatKey; value: number }> = {
  1: { stat: 'flat_hp', value: 2280 },
  3: { stat: 'flat_attack', value: 100 },
  4: { stat: 'flat_attack', value: 150 },
};

export const COST_LAYOUTS: Record<CostLayout, Cost[]> = {
  '43311': [4, 3, 3, 1, 1],
  '44111': [4, 4, 1, 1, 1],
};
