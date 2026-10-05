import type { TwoPieceEffect } from '../types/data';

export const twoPieceEffects = {
  element_dmg: { "id": "element_dmg", "label": "원소피해", "type": "element_damage_bonus", "value": 0.10, "element_from_character": true },
  attack: { "id": "attack", "label": "공격력", "type": "attack_percent", "value": 0.10 },
  energy_regen: { "id": "energy_regen", "label": "공명 효율", "type": "energy_regen", "value": 0.10 }
} satisfies Record<string, TwoPieceEffect>;
