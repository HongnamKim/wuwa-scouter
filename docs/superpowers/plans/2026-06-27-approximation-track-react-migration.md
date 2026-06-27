# 근사 트랙 React 마이그레이션 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 검증된 근사 트랙 프로토타입(`index.html`)을 React + Vite + TypeScript 앱으로 이전하고, 캐릭터·무기·에코세트 데이터를 JSON으로 분리해 계산 엔진을 단위 테스트로 고정한다.

**Architecture:** 순수 TypeScript 계산 엔진(`src/engine`)을 React에서 분리한다. 엔진은 plain 입력을 받아 결과를 내는 순수 함수 모음이고, React는 선택 상태를 들고 엔진을 호출만 한다. 데이터는 `src/data/*.json`이며 `src/types`의 인터페이스/union 타입으로 제약하고 로드 시 검증한다.

**Tech Stack:** React 18, Vite, TypeScript, Vitest (단위 테스트).

## Global Constraints

- 언어: TypeScript. 엔진/유틸은 `.ts`, React 컴포넌트는 `.tsx`.
- 데이터 키/값은 `src/types`의 union 타입 + 인터페이스로 제약. JSON 로드 시 런타임 검증으로 미지의 `type`/`element` 거부.
- 계산은 프로토타입 수치를 보존한다. 검증 기준값(히유키, 43311, 5세트 조건부 ON, 무기 부스트 OFF): **최종 ATK ≈ 2965, 통합 성능 ≈ 13228.6, 이론 최고 대비 ≈ 59.9%, 크크작 대비(공공 분모) ≈ 125.7%(분모 10524.9)**. 단 크크작 드롭다운 기본은 최적(속속)이라 기본 표시 점수는 더 낮다(~116%).
- 기본 크리 5%, 기본 크피 150%는 엔진 상수(JSON 아님).
- 모든 부동소수 비교 테스트는 허용 오차를 둔다(절대값 ±1.0 또는 비율 ±0.1%).
- 커밋은 worktree에서 자유롭게. (작업 완료 후 실제 프로젝트 적용 및 최종 커밋은 사용자가 직접 — 이 플랜 범위 밖)
- 스펙: `docs/superpowers/specs/2026-06-27-approximation-track-react-migration-design.md`.

---

## 파일 구조 (생성/수정 대상)

```
package.json, tsconfig.json, vite.config.ts, vitest.config.ts   # Task 1
index.html (Vite 진입), src/main.tsx                            # Task 1
src/types/domain.ts        # union 타입 (Task 2)
src/types/data.ts          # 인터페이스 (Task 2)
src/engine/constants.ts    # 게임 공통 상수 (Task 3)
src/data/characters.json   # 히유키 (Task 4)
src/data/weapons.json      # 서린 불꽃, 천년의 회류 (Task 4)
src/data/echo-sets.json    # 기도의 눈 (Task 4)
src/engine/loadData.ts     # 로드 + 검증 (Task 4)
src/engine/perf.ts         # computePerf 순수 수식 (Task 5)
src/engine/context.ts      # CalcContext 타입 + 빌더 입력 (Task 6)
src/engine/buffs.ts        # 버프 집계 (Task 6)
src/engine/build.ts        # buildPerfInput (ctx → PerfInput) (Task 6)
src/engine/spec.ts         # displaySpec (Task 7)
src/engine/theory.ts       # theoryBest, kkjak, mainReco, compareSubstats (Task 8,9,10)
src/state/store.ts         # 선택 상태 + 기본 히유키 샘플 (Task 11)
src/components/*.tsx        # UI (Task 12,13,14)
src/App.tsx                # 조립 (Task 15)
tests/engine/*.test.ts     # 엔진 테스트 (각 엔진 Task)
```

---

### Task 1: 프로젝트 스캐폴딩 (Vite + React + TS + Vitest)

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `index.html`, `src/main.tsx`, `src/App.tsx`, `tests/smoke.test.ts`
- Note: 기존 루트 `index.html`(프로토타입)은 `prototype.html`로 보존 이동.

**Interfaces:**
- Produces: 동작하는 dev 서버(`npm run dev`)와 테스트 러너(`npm test`).

- [ ] **Step 1: 기존 프로토타입 보존**

```bash
git mv index.html prototype.html
```

- [ ] **Step 1b: .gitignore 작성** (node_modules 커밋 방지)

`.gitignore`:
```
node_modules/
dist/
*.local
.DS_Store
*.tsbuildinfo
```

- [ ] **Step 2: package.json 작성**

`package.json`:
```json
{
  "name": "wuwa-scouter",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "typescript": "^5.5.3",
    "vite": "^5.3.4",
    "vitest": "^2.0.5"
  }
}
```

- [ ] **Step 3: 설정 파일 작성**

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "noEmit": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "jsx": "react-jsx"
  },
  "include": ["src", "tests"]
}
```

`vite.config.ts`:
```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({ plugins: [react()] });
```

`vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({ test: { environment: 'node' } });
```

`index.html`:
```html
<!DOCTYPE html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>명조 에코 평가 (근사 트랙)</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`src/main.tsx`:
```tsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

`src/App.tsx`:
```tsx
export function App() {
  return <h1>명조 에코 평가 (근사 트랙)</h1>;
}
```

- [ ] **Step 4: 스모크 테스트 작성**

`tests/smoke.test.ts`:
```ts
import { describe, it, expect } from 'vitest';

describe('smoke', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: 설치 및 테스트 실행**

Run: `npm install && npm test`
Expected: smoke 테스트 PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: scaffold Vite + React + TS + Vitest"
```

---

### Task 2: 도메인 타입 & 데이터 인터페이스

**Files:**
- Create: `src/types/domain.ts`, `src/types/data.ts`, `tests/types.test.ts`

**Interfaces:**
- Produces: `StatKey`, `Element`, `ScaleStat`, `DamageBonusType`, `EnergyRegenMode`, `CostLayout`, `Cost`, `SetPieces`, `Buff`, `MainSlotEcho`, `Character`, `Weapon`, `EchoSet`.

- [ ] **Step 1: domain.ts 작성**

`src/types/domain.ts`:
```ts
export type ScaleStat = 'attack' | 'hp' | 'defense';

export type Element = '응결'; // 확장 union

export type DamageBonusType =
  | 'basic_attack'
  | 'heavy_attack'
  | 'resonance_skill'
  | 'resonance_liberation';

export type EnergyRegenMode = 'premise' | 'deal_conversion';

export type CostLayout = '43311' | '44111';
export type Cost = 1 | 3 | 4;
export type SetPieces = 1 | 2 | 3 | 5;

/** 버프 type / 부옵 키 / 메인 옵션 키의 통합 어휘 */
export type StatKey =
  // 크리
  | 'critical_rate'
  | 'critical_damage'
  // 스케일 %
  | 'attack_percent'
  | 'hp_percent'
  | 'defense_percent'
  // 깡스탯
  | 'flat_attack'
  | 'flat_hp'
  | 'flat_defense'
  // 기타
  | 'energy_regen'
  | 'healing_bonus'
  // 증가(합연산)
  | 'element_damage_bonus'
  | 'basic_attack_bonus'
  | 'heavy_attack_bonus'
  | 'resonance_skill_bonus'
  | 'resonance_liberation_bonus'
  // 부스트(곱연산)
  | 'element_damage_amplify'
  | 'all_damage_amplify'
  | 'basic_attack_amplify'
  | 'heavy_attack_amplify'
  | 'resonance_skill_amplify'
  | 'resonance_liberation_amplify'
  // 저항/방어 항 (근사 트랙 무영향)
  | 'defense_ignore';

export const STAT_KEYS: readonly StatKey[] = [
  'critical_rate', 'critical_damage', 'attack_percent', 'hp_percent', 'defense_percent',
  'flat_attack', 'flat_hp', 'flat_defense', 'energy_regen', 'healing_bonus',
  'element_damage_bonus', 'basic_attack_bonus', 'heavy_attack_bonus',
  'resonance_skill_bonus', 'resonance_liberation_bonus',
  'element_damage_amplify', 'all_damage_amplify', 'basic_attack_amplify',
  'heavy_attack_amplify', 'resonance_skill_amplify', 'resonance_liberation_amplify',
  'defense_ignore',
];

export const ELEMENTS: readonly Element[] = ['응결'];
```

- [ ] **Step 2: data.ts 작성**

`src/types/data.ts`:
```ts
import type {
  StatKey, Element, ScaleStat, DamageBonusType, EnergyRegenMode, SetPieces,
} from './domain';

export interface Buff {
  type: StatKey;
  value: number;          // 소수(0.12 = 12%), 깡스탯은 정수
  always: boolean;        // true=상시, false=조건부
  id?: string;            // 조건부 토글 식별자
  label?: string;         // 조건부 표시
  element?: Element;      // 지정 시 캐릭터 element 일치할 때만
  set_pieces?: SetPieces; // 에코세트 버프 전용 (1|2|3|5)
  note?: string;
}

export interface MainSlotEcho {
  id: string;
  name: string;
  buffs: Buff[];
}

export interface Character {
  id: string;
  name: string;
  element: Element;
  scale_stat: ScaleStat;
  base_attack: number;
  effective_substats: StatKey[];
  damage_bonus_type: DamageBonusType | null;
  energy_regen_mode: EnergyRegenMode;
  recommended_echo_sets: string[];
  recommended_weapons: string[];
  skill_node: Buff[];
  main_slot_echo: MainSlotEcho[];
}

export interface Weapon {
  id: string;
  name: string;
  base_stats: { attack: number } & Partial<Record<StatKey, number>>;
  buffs: Buff[];
}

export interface EchoSet {
  id: string;
  name: string;
  buffs: Buff[];
}
```

- [ ] **Step 3: 타입 컴파일 확인 테스트**

`tests/types.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { STAT_KEYS, ELEMENTS } from '../src/types/domain';
import type { Character } from '../src/types/data';

describe('types', () => {
  it('exposes stat key + element vocab', () => {
    expect(STAT_KEYS).toContain('element_damage_amplify');
    expect(STAT_KEYS).toContain('defense_ignore');
    expect(ELEMENTS).toContain('응결');
  });

  it('Character shape compiles', () => {
    const c: Character = {
      id: 'x', name: 'x', element: '응결', scale_stat: 'attack', base_attack: 1,
      effective_substats: ['critical_rate'], damage_bonus_type: null,
      energy_regen_mode: 'premise', recommended_echo_sets: [], recommended_weapons: [],
      skill_node: [], main_slot_echo: [],
    };
    expect(c.id).toBe('x');
  });
});
```

- [ ] **Step 4: 실행**

Run: `npm test -- tests/types.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add domain + data types"
```

---

### Task 3: 게임 공통 상수

**Files:**
- Create: `src/engine/constants.ts`, `tests/engine/constants.test.ts`

**Interfaces:**
- Produces:
  - `BASE_CRIT = 0.05`, `BASE_CRIT_DAMAGE = 1.5`
  - `SUBSTAT_STAGES: Partial<Record<StatKey, number[]>>` (% 단위 숫자 배열; 깡스탯은 정수)
  - `MAIN_PRIMARY: Record<Cost, Partial<Record<StatKey, number>>>` (% 단위, 소수 아님 → 18.0 = 18%)
  - `MAIN_SECONDARY: Record<Cost, { stat: StatKey; value: number }>`
  - `COST_LAYOUTS: Record<CostLayout, Cost[]>`
  - `substatFourthFromBottom(key): number` (크크작 분모용, % 단위)
  - `substatMaxStage(key): number` (이론 최고용, % 단위)

- [ ] **Step 1: 실패 테스트 작성**

`tests/engine/constants.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import {
  SUBSTAT_STAGES, MAIN_PRIMARY, MAIN_SECONDARY, COST_LAYOUTS,
  substatFourthFromBottom, substatMaxStage, BASE_CRIT, BASE_CRIT_DAMAGE,
} from '../../src/engine/constants';

describe('constants', () => {
  it('substat stage tables (실측)', () => {
    expect(SUBSTAT_STAGES.critical_rate).toEqual([6.3, 6.9, 7.5, 8.1, 8.7, 9.3, 9.9, 10.5]);
    expect(SUBSTAT_STAGES.critical_damage).toEqual([12.6, 13.8, 15, 16.2, 17.4, 18.6, 19.8, 21]);
    expect(SUBSTAT_STAGES.attack_percent).toEqual([6.4, 7.1, 7.9, 8.6, 9.4, 10.1, 10.9, 11.6]);
    expect(SUBSTAT_STAGES.flat_attack).toEqual([30, 40, 50, 60]);
  });

  it('크크작 밑에서 4번째', () => {
    expect(substatFourthFromBottom('critical_rate')).toBe(8.1);
    expect(substatFourthFromBottom('critical_damage')).toBe(16.2);
    expect(substatFourthFromBottom('attack_percent')).toBe(8.6);
  });

  it('이론 최고 max', () => {
    expect(substatMaxStage('critical_damage')).toBe(21);
    expect(substatMaxStage('attack_percent')).toBe(11.6);
    expect(substatMaxStage('flat_attack')).toBe(60);
  });

  it('main option values', () => {
    expect(MAIN_PRIMARY[4].critical_damage).toBe(44.0);
    expect(MAIN_PRIMARY[3].element_damage_bonus).toBe(30.0);
    expect(MAIN_PRIMARY[1].attack_percent).toBe(18.0);
    expect(MAIN_SECONDARY[4]).toEqual({ stat: 'flat_attack', value: 150 });
    expect(MAIN_SECONDARY[1]).toEqual({ stat: 'flat_hp', value: 2280 });
  });

  it('layouts + bases', () => {
    expect(COST_LAYOUTS['43311']).toEqual([4, 3, 3, 1, 1]);
    expect(BASE_CRIT).toBe(0.05);
    expect(BASE_CRIT_DAMAGE).toBe(1.5);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test -- tests/engine/constants.test.ts`
Expected: FAIL ("Cannot find module ... constants").

- [ ] **Step 3: 구현**

`src/engine/constants.ts`:
```ts
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
```

- [ ] **Step 4: 통과 확인**

Run: `npm test -- tests/engine/constants.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: game constants (substat stages, main options)"
```

---

### Task 4: 데이터 JSON + 로드 검증

**Files:**
- Create: `src/data/characters.json`, `src/data/weapons.json`, `src/data/echo-sets.json`, `src/engine/loadData.ts`, `tests/engine/loadData.test.ts`

**Interfaces:**
- Consumes: `Character`, `Weapon`, `EchoSet` 타입; `STAT_KEYS`, `ELEMENTS`.
- Produces:
  - `loadCharacters(): Character[]`, `loadWeapons(): Weapon[]`, `loadEchoSets(): EchoSet[]`
  - `validateBuff(b): Buff` (미지의 type/element면 throw)
  - `getWeapon(id)`, `getEchoSet(id)` 헬퍼.

- [ ] **Step 1: JSON 데이터 작성**

`src/data/characters.json`:
```json
[
  {
    "id": "hiyuki",
    "name": "히유키",
    "element": "응결",
    "scale_stat": "attack",
    "base_attack": 462,
    "effective_substats": ["critical_rate", "critical_damage", "attack_percent", "resonance_liberation_bonus", "flat_attack"],
    "damage_bonus_type": "resonance_liberation",
    "energy_regen_mode": "premise",
    "recommended_echo_sets": ["kido"],
    "recommended_weapons": ["frostbound_flame", "millennium_eddy"],
    "skill_node": [
      { "type": "critical_rate", "value": 0.08, "always": true, "note": "스킬 노드" },
      { "type": "attack_percent", "value": 0.12, "always": true, "note": "스킬 노드" }
    ],
    "main_slot_echo": [
      {
        "id": "void_god_echo",
        "name": "공명의 메아리 · 명식 · 허무의 신",
        "buffs": [
          { "type": "element_damage_bonus", "value": 0.12, "always": true, "note": "패시브" },
          { "type": "resonance_liberation_bonus", "value": 0.12, "always": true, "note": "패시브" }
        ]
      }
    ]
  }
]
```

`src/data/weapons.json`:
```json
[
  {
    "id": "frostbound_flame",
    "name": "서린 불꽃",
    "base_stats": { "attack": 587, "critical_rate": 0.243 },
    "buffs": [
      { "type": "attack_percent", "value": 0.12, "always": true, "note": "무기 패시브" },
      { "type": "element_damage_amplify", "value": 0.28, "always": false, "element": "응결", "id": "weapon_glacio_amplify", "label": "응결피해 +28% 부스트 (조건부)" },
      { "type": "defense_ignore", "value": 0.10, "always": false, "id": "weapon_def_ignore", "label": "방어력 무시 +10% (조건부)" }
    ]
  },
  {
    "id": "millennium_eddy",
    "name": "천년의 회류",
    "base_stats": { "attack": 588, "critical_rate": 0.243 },
    "buffs": [
      { "type": "energy_regen", "value": 0.128, "always": true, "note": "무기 패시브(상시)" },
      { "type": "attack_percent", "value": 0.12, "always": false, "id": "weapon_atk_stack", "label": "공격력 +12% (조건부)" }
    ]
  }
]
```

`src/data/echo-sets.json`:
```json
[
  {
    "id": "kido",
    "name": "소리 없이 내려앉은 기도의 눈",
    "buffs": [
      { "type": "element_damage_bonus", "value": 0.10, "set_pieces": 2, "always": true, "element": "응결" },
      { "type": "element_damage_bonus", "value": 0.10, "set_pieces": 5, "always": false, "element": "응결", "id": "set_5pc_element", "label": "응결피해 +10% (5세트)" },
      { "type": "critical_rate", "value": 0.25, "set_pieces": 5, "always": false, "id": "set_5pc_critical", "label": "크리티컬 +25% (5세트)" }
    ]
  }
]
```

- [ ] **Step 2: 실패 테스트 작성**

`tests/engine/loadData.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { loadCharacters, loadWeapons, loadEchoSets, validateBuff, getWeapon } from '../../src/engine/loadData';

describe('loadData', () => {
  it('loads hiyuki', () => {
    const c = loadCharacters().find((x) => x.id === 'hiyuki')!;
    expect(c.base_attack).toBe(462);
    expect(c.damage_bonus_type).toBe('resonance_liberation');
    expect(c.main_slot_echo[0].buffs).toHaveLength(2);
  });

  it('loads weapons with base_stats', () => {
    const w = getWeapon('frostbound_flame', loadWeapons());
    expect(w.base_stats.attack).toBe(587);
    expect(w.base_stats.critical_rate).toBe(0.243);
  });

  it('loads echo set with set_pieces', () => {
    const s = loadEchoSets()[0];
    expect(s.buffs[0].set_pieces).toBe(2);
  });

  it('rejects unknown buff type', () => {
    expect(() => validateBuff({ type: 'bogus', value: 1, always: true })).toThrow();
  });

  it('rejects unknown element', () => {
    expect(() => validateBuff({ type: 'element_damage_bonus', value: 0.1, always: true, element: '화염' })).toThrow();
  });
});
```

- [ ] **Step 3: 실패 확인**

Run: `npm test -- tests/engine/loadData.test.ts`
Expected: FAIL (module 없음).

- [ ] **Step 4: 구현**

`src/engine/loadData.ts`:
```ts
import type { Buff, Character, Weapon, EchoSet } from '../types/data';
import { STAT_KEYS, ELEMENTS } from '../types/domain';
import charactersRaw from '../data/characters.json';
import weaponsRaw from '../data/weapons.json';
import echoSetsRaw from '../data/echo-sets.json';

export function validateBuff(b: any): Buff {
  if (!STAT_KEYS.includes(b.type)) throw new Error(`unknown buff type: ${b.type}`);
  if (b.element !== undefined && !ELEMENTS.includes(b.element)) {
    throw new Error(`unknown element: ${b.element}`);
  }
  if (typeof b.value !== 'number' || typeof b.always !== 'boolean') {
    throw new Error(`invalid buff: ${JSON.stringify(b)}`);
  }
  return b as Buff;
}

function validateBuffs(buffs: any[]): Buff[] {
  return buffs.map(validateBuff);
}

export function loadCharacters(): Character[] {
  return (charactersRaw as any[]).map((c) => ({
    ...c,
    skill_node: validateBuffs(c.skill_node),
    main_slot_echo: c.main_slot_echo.map((e: any) => ({ ...e, buffs: validateBuffs(e.buffs) })),
  })) as Character[];
}

export function loadWeapons(): Weapon[] {
  return (weaponsRaw as any[]).map((w) => ({ ...w, buffs: validateBuffs(w.buffs) })) as Weapon[];
}

export function loadEchoSets(): EchoSet[] {
  return (echoSetsRaw as any[]).map((s) => ({ ...s, buffs: validateBuffs(s.buffs) })) as EchoSet[];
}

export function getWeapon(id: string, weapons: Weapon[]): Weapon {
  const w = weapons.find((x) => x.id === id);
  if (!w) throw new Error(`weapon not found: ${id}`);
  return w;
}

export function getEchoSet(id: string, sets: EchoSet[]): EchoSet {
  const s = sets.find((x) => x.id === id);
  if (!s) throw new Error(`echo set not found: ${id}`);
  return s;
}
```

- [ ] **Step 5: 통과 확인**

Run: `npm test -- tests/engine/loadData.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: data JSON + load validation"
```

---

### Task 5: computePerf (순수 수식)

**Files:**
- Create: `src/engine/perf.ts`, `tests/engine/perf.test.ts`

**Interfaces:**
- Produces:
  - `interface PerfInput { baseAttack; attackPercent; flatAttack; criticalRate; criticalDamage; increaseBonus; amplify }` (모두 number, % 아닌 소수)
  - `computePerf(i: PerfInput): number`

- [ ] **Step 1: 실패 테스트 작성**

`tests/engine/perf.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { computePerf, PerfInput } from '../../src/engine/perf';

// 부록 A 히유키 (5세트 ON, 무기 부스트 OFF)
const HIYUKI: PerfInput = {
  baseAttack: 1049,        // 462 + 587
  attackPercent: 0.24 + 0.293 + 0.96, // 노드+무기 0.24 / 부옵 0.293 / 메인 0.96
  flatAttack: 350,         // secondary 4코150 + 3코100x2
  criticalRate: 0.98,      // 0.05+0.243+0.08+0.25+0.357
  criticalDamage: 2.54,    // 1.50 + 부옵0.60 + 메인0.44
  increaseBonus: 0.778,    // 응결0.32 + 해방(0.12+0.338)
  amplify: 0,
};

describe('computePerf', () => {
  it('히유키 통합 성능 ≈ 13228.6', () => {
    expect(computePerf(HIYUKI)).toBeCloseTo(13228.6, 0);
  });

  it('ATK 항 ≈ 2965', () => {
    const atk = 1049 * (1 + HIYUKI.attackPercent) + 350;
    expect(atk).toBeCloseTo(2965, 0);
  });

  it('무기 부스트 28% → ×1.28', () => {
    const boosted = computePerf({ ...HIYUKI, amplify: 0.28 });
    expect(boosted / computePerf(HIYUKI)).toBeCloseTo(1.28, 5);
  });

  it('크리율 100% 캡', () => {
    const a = computePerf({ ...HIYUKI, criticalRate: 1.2 });
    const b = computePerf({ ...HIYUKI, criticalRate: 1.0 });
    expect(a).toBe(b);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test -- tests/engine/perf.test.ts`
Expected: FAIL.

- [ ] **Step 3: 구현**

`src/engine/perf.ts`:
```ts
export interface PerfInput {
  baseAttack: number;
  attackPercent: number;  // 소수 합
  flatAttack: number;
  criticalRate: number;   // 캡 전, 소수
  criticalDamage: number; // 1.5 포함
  increaseBonus: number;  // 증가피해보너스 소수 합
  amplify: number;        // 부스트 소수 합
}

export function computePerf(i: PerfInput): number {
  const atk = i.baseAttack * (1 + i.attackPercent) + i.flatAttack;
  const crit = Math.min(i.criticalRate, 1);
  const critExpectation = 1 + crit * (i.criticalDamage - 1);
  return atk * (1 + i.increaseBonus) * (1 + i.amplify) * critExpectation;
}
```

- [ ] **Step 4: 통과 확인**

Run: `npm test -- tests/engine/perf.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: computePerf pure formula"
```

---

### Task 6: 버프 집계 + buildPerfInput (CalcContext → PerfInput)

**Files:**
- Create: `src/engine/context.ts`, `src/engine/buffs.ts`, `src/engine/build.ts`, `tests/engine/build.test.ts`

**Interfaces:**
- Consumes: `computePerf`, `PerfInput`, 상수, 타입.
- Produces:
  - `context.ts`: `interface SubstatLine { type: StatKey | ''; value: number | null }`, `interface ManualBuff { type: StatKey | ''; value: number | null }`, `interface MainPrimaryPick { cost: Cost; type: StatKey }`, `interface CalcContext { character; weapon; mainEcho; echoSet; costLayout; mainPrimary: MainPrimaryPick[]; substats: SubstatLine[][]; conditionalToggles: Record<string, boolean>; manualBuffs: ManualBuff[]; masterToggle: boolean }`
  - `buffs.ts`: `interface BuffTotals { critical_rate; critical_damage; attack_percent; element_bonus; damage_type_bonus; amplify }`, `aggregateBuffs(ctx): BuffTotals`
  - `build.ts`: `buildPerfInput(ctx): PerfInput`, `sumEffectiveSubstats(ctx): Record<StatKey, number>`, `sumMainPrimary(ctx)`, `secondaryFlat(ctx): number`

- [ ] **Step 1: context.ts 작성 (타입만)**

`src/engine/context.ts`:
```ts
import type { Character, Weapon, EchoSet, MainSlotEcho } from '../types/data';
import type { StatKey, Cost, CostLayout } from '../types/domain';

export interface SubstatLine {
  type: StatKey | '';
  value: number | null; // % 단위 (예: 8.6) / 깡스탯은 정수
}

export interface ManualBuff {
  type: StatKey | '';
  value: number | null; // % 단위 입력값
}

export interface MainPrimaryPick {
  cost: Cost;
  type: StatKey; // 그 슬롯에서 고른 메인 옵션
}

export interface CalcContext {
  character: Character;
  weapon: Weapon;
  mainEcho: MainSlotEcho;
  echoSet: EchoSet;
  costLayout: CostLayout;
  mainPrimary: MainPrimaryPick[]; // 슬롯 순서대로
  substats: SubstatLine[][];      // 5 에코 × 5 줄
  conditionalToggles: Record<string, boolean>;
  manualBuffs: ManualBuff[];
  masterToggle: boolean;
}
```

- [ ] **Step 2: 실패 테스트 작성**

`tests/engine/build.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { loadCharacters, loadWeapons, loadEchoSets } from '../../src/engine/loadData';
import { computePerf } from '../../src/engine/perf';
import { buildPerfInput } from '../../src/engine/build';
import type { CalcContext } from '../../src/engine/context';

// 부록 A 재현 컨텍스트 (5세트 ON, 무기 부스트 OFF)
function hiyukiCtx(): CalcContext {
  const character = loadCharacters().find((c) => c.id === 'hiyuki')!;
  const weapon = loadWeapons().find((w) => w.id === 'frostbound_flame')!;
  const echoSet = loadEchoSets()[0];
  // 부옵 유효옵 합: 크리 35.7, 크피 60, 공% 29.3, 해방 33.8 (깡공 0)
  const substats = [
    [{ type: 'critical_rate', value: 35.7 }],
    [{ type: 'critical_damage', value: 60 }],
    [{ type: 'attack_percent', value: 29.3 }],
    [{ type: 'resonance_liberation_bonus', value: 33.8 }],
    [],
  ] as CalcContext['substats'];
  return {
    character,
    weapon,
    mainEcho: character.main_slot_echo[0],
    echoSet,
    costLayout: '43311',
    mainPrimary: [
      { cost: 4, type: 'critical_damage' }, // 크피44
      { cost: 3, type: 'attack_percent' },  // 공%30
      { cost: 3, type: 'attack_percent' },  // 공%30
      { cost: 1, type: 'attack_percent' },  // 공%18
      { cost: 1, type: 'attack_percent' },  // 공%18
    ],
    substats,
    conditionalToggles: {
      set_5pc_element: true, set_5pc_critical: true,
      weapon_glacio_amplify: false, weapon_def_ignore: false,
    },
    manualBuffs: [],
    masterToggle: true,
  };
}

describe('buildPerfInput', () => {
  it('부록 A → 통합 성능 ≈ 13228.6', () => {
    const input = buildPerfInput(hiyukiCtx());
    expect(computePerf(input)).toBeCloseTo(13228.6, 0);
  });

  it('ATK 항 ≈ 2965', () => {
    const i = buildPerfInput(hiyukiCtx());
    expect(i.baseAttack * (1 + i.attackPercent) + i.flatAttack).toBeCloseTo(2965, 0);
  });

  it('크리율 ≈ 0.98', () => {
    expect(buildPerfInput(hiyukiCtx()).criticalRate).toBeCloseTo(0.98, 2);
  });

  it('무기 부스트 토글 ON → ×1.28', () => {
    const off = hiyukiCtx();
    const on = hiyukiCtx();
    on.conditionalToggles.weapon_glacio_amplify = true;
    expect(computePerf(buildPerfInput(on)) / computePerf(buildPerfInput(off))).toBeCloseTo(1.28, 3);
  });

  it('방어력 무시 토글은 통합 성능 불변', () => {
    const off = hiyukiCtx();
    const on = hiyukiCtx();
    on.conditionalToggles.weapon_def_ignore = true;
    expect(computePerf(buildPerfInput(on))).toBeCloseTo(computePerf(buildPerfInput(off)), 6);
  });
});
```

- [ ] **Step 3: 실패 확인**

Run: `npm test -- tests/engine/build.test.ts`
Expected: FAIL.

- [ ] **Step 4: buffs.ts 구현**

`src/engine/buffs.ts`:
```ts
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
}

const AMPLIFY_KEYS: StatKey[] = [
  'element_damage_amplify', 'all_damage_amplify', 'basic_attack_amplify',
  'heavy_attack_amplify', 'resonance_skill_amplify', 'resonance_liberation_amplify',
];

/** 이 버프가 현재 활성인지 (상시 / 조건부 토글 / 마스터 토글 / element 일치) */
function isActive(b: Buff, ctx: CalcContext): boolean {
  if (b.element && b.element !== ctx.character.element) return false;
  if (b.always) return true;
  if (!ctx.masterToggle) return false;
  return b.id ? ctx.conditionalToggles[b.id] === true : true;
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
    element_bonus: 0, damage_type_bonus: 0, amplify: 0,
  };
  const dmgTypeBonus = damageTypeBonusKey(ctx);
  const dmgTypeAmp = damageTypeAmplifyKey(ctx);

  const sources: Buff[] = [
    ...ctx.character.skill_node,
    ...ctx.mainEcho.buffs,
    ...ctx.weapon.buffs,
    ...ctx.echoSet.buffs,
    ...ctx.manualBuffs
      .filter((m) => m.type && m.value != null)
      .map((m) => ({ type: m.type as StatKey, value: (m.value as number) / 100, always: false, id: undefined } as Buff)),
  ];

  for (const b of sources) {
    // 수동 버프는 id 없이 항상 활성 취급(마스터 토글만 따름)
    const active = b.id === undefined && !b.always
      ? ctx.masterToggle
      : isActive(b, ctx);
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
    // defense_ignore, energy_regen 등은 근사 트랙 무영향 → 무시
  }
  return t;
}
```

- [ ] **Step 5: build.ts 구현**

`src/engine/build.ts`:
```ts
import type { StatKey, Cost } from '../types/domain';
import type { CalcContext } from './context';
import type { PerfInput } from './perf';
import { aggregateBuffs } from './buffs';
import {
  BASE_CRIT, BASE_CRIT_DAMAGE, COST_LAYOUTS, MAIN_PRIMARY, MAIN_SECONDARY,
} from './constants';

/** 유효옵 부옵 합 (% → 그대로 % 단위 숫자) */
export function sumEffectiveSubstats(ctx: CalcContext): Partial<Record<StatKey, number>> {
  const sum: Partial<Record<StatKey, number>> = {};
  const eff = new Set(ctx.character.effective_substats);
  for (const echo of ctx.substats) {
    for (const line of echo) {
      if (line.type && line.value != null && eff.has(line.type)) {
        sum[line.type] = (sum[line.type] ?? 0) + line.value;
      }
    }
  }
  return sum;
}

/** 메인 primary를 stat별 합으로 (% → 소수) */
export function sumMainPrimary(ctx: CalcContext): Partial<Record<StatKey, number>> {
  const sum: Partial<Record<StatKey, number>> = {};
  ctx.mainPrimary.forEach((pick) => {
    const pct = MAIN_PRIMARY[pick.cost][pick.type];
    if (pct != null) sum[pick.type] = (sum[pick.type] ?? 0) + pct / 100;
  });
  return sum;
}

/** 메인 secondary 깡스탯 중 캐릭터 스케일과 일치하는 것만 합산 */
export function secondaryFlat(ctx: CalcContext): number {
  const scaleFlat: StatKey =
    ctx.character.scale_stat === 'attack' ? 'flat_attack'
    : ctx.character.scale_stat === 'hp' ? 'flat_hp' : 'flat_defense';
  const layout: Cost[] = COST_LAYOUTS[ctx.costLayout];
  return layout.reduce((acc, cost) => {
    const sec = MAIN_SECONDARY[cost];
    return acc + (sec.stat === scaleFlat ? sec.value : 0);
  }, 0);
}

export function buildPerfInput(ctx: CalcContext): PerfInput {
  const buffs = aggregateBuffs(ctx);
  const sub = sumEffectiveSubstats(ctx);
  const main = sumMainPrimary(ctx);
  const dmgTypeBonusKey = ctx.character.damage_bonus_type
    ? (`${ctx.character.damage_bonus_type}_bonus` as StatKey)
    : null;

  const baseAttack = ctx.character.base_attack + ctx.weapon.base_stats.attack;

  const attackPercent =
    buffs.attack_percent + (sub.attack_percent ?? 0) / 100 + (main.attack_percent ?? 0);

  const flatAttack = (sub.flat_attack ?? 0) + secondaryFlat(ctx);

  const criticalRate =
    BASE_CRIT +
    (ctx.weapon.base_stats.critical_rate ?? 0) +
    buffs.critical_rate +
    (sub.critical_rate ?? 0) / 100 +
    (main.critical_rate ?? 0);

  const criticalDamage =
    BASE_CRIT_DAMAGE +
    (ctx.weapon.base_stats.critical_damage ?? 0) +
    buffs.critical_damage +
    (sub.critical_damage ?? 0) / 100 +
    (main.critical_damage ?? 0);

  const subDmgTypeBonus = dmgTypeBonusKey ? (sub[dmgTypeBonusKey] ?? 0) / 100 : 0;
  const increaseBonus =
    buffs.element_bonus + (main.element_damage_bonus ?? 0) +
    buffs.damage_type_bonus + subDmgTypeBonus;

  return {
    baseAttack, attackPercent, flatAttack, criticalRate, criticalDamage,
    increaseBonus, amplify: buffs.amplify,
  };
}
```

- [ ] **Step 6: 통과 확인**

Run: `npm test -- tests/engine/build.test.ts`
Expected: PASS (13228.6, ATK 2965, 크리율 0.98, 부스트 ×1.28, 방무 불변).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: buff aggregation + buildPerfInput (validated 13228.6)"
```

---

### Task 7: displaySpec (전투 실제 스펙 표시)

**Files:**
- Create: `src/engine/spec.ts`, `tests/engine/spec.test.ts`

**Interfaces:**
- Consumes: `buildPerfInput`, `aggregateBuffs`, 상수.
- Produces: `interface DisplaySpec { attack; criticalRateRaw; criticalRate; criticalDamage; elementBonus; damageTypeBonus; amplify }`, `computeDisplaySpec(ctx): DisplaySpec`

- [ ] **Step 1: 실패 테스트 작성**

`tests/engine/spec.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { computeDisplaySpec } from '../../src/engine/spec';
import { loadCharacters, loadWeapons, loadEchoSets } from '../../src/engine/loadData';
import type { CalcContext } from '../../src/engine/context';

function hiyukiCtx(): CalcContext {
  const character = loadCharacters().find((c) => c.id === 'hiyuki')!;
  const weapon = loadWeapons().find((w) => w.id === 'frostbound_flame')!;
  return {
    character, weapon, mainEcho: character.main_slot_echo[0], echoSet: loadEchoSets()[0],
    costLayout: '43311',
    mainPrimary: [
      { cost: 4, type: 'critical_damage' }, { cost: 3, type: 'attack_percent' },
      { cost: 3, type: 'attack_percent' }, { cost: 1, type: 'attack_percent' },
      { cost: 1, type: 'attack_percent' },
    ],
    substats: [
      [{ type: 'critical_rate', value: 35.7 }], [{ type: 'critical_damage', value: 60 }],
      [{ type: 'attack_percent', value: 29.3 }], [{ type: 'resonance_liberation_bonus', value: 33.8 }], [],
    ],
    conditionalToggles: { set_5pc_element: true, set_5pc_critical: true, weapon_glacio_amplify: false, weapon_def_ignore: false },
    manualBuffs: [], masterToggle: true,
  };
}

describe('computeDisplaySpec', () => {
  it('ATK 2965, 크리율 0.98, 크피 2.54, 응결 0.32', () => {
    const s = computeDisplaySpec(hiyukiCtx());
    expect(s.attack).toBeCloseTo(2965, 0);
    expect(s.criticalRate).toBeCloseTo(0.98, 2);
    expect(s.criticalDamage).toBeCloseTo(2.54, 2);
    expect(s.elementBonus).toBeCloseTo(0.32, 2);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test -- tests/engine/spec.test.ts`
Expected: FAIL.

- [ ] **Step 3: 구현**

`src/engine/spec.ts`:
```ts
import type { CalcContext } from './context';
import { buildPerfInput } from './build';

export interface DisplaySpec {
  attack: number;
  criticalRateRaw: number; // 캡 전
  criticalRate: number;    // 캡 1.0
  criticalDamage: number;
  elementBonus: number;       // 증가피해보너스 중 속성분 + 캐릭 유형분 합
  amplify: number;
}

export function computeDisplaySpec(ctx: CalcContext): DisplaySpec {
  const i = buildPerfInput(ctx);
  return {
    attack: i.baseAttack * (1 + i.attackPercent) + i.flatAttack,
    criticalRateRaw: i.criticalRate,
    criticalRate: Math.min(i.criticalRate, 1),
    criticalDamage: i.criticalDamage,
    elementBonus: i.increaseBonus,
    amplify: i.amplify,
  };
}
```

> 참고: `elementBonus`는 증가피해보너스항 전체(속성 + 캐릭터 유형). 표시 라벨은 UI에서 "속성/스킬 피해"로 나눠 보여줄 수 있으나, 근사 계산상 합산값으로 충분.

- [ ] **Step 4: 통과 확인**

Run: `npm test -- tests/engine/spec.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: displaySpec"
```

---

### Task 8: 이론 최고 (theoryBest)

**Files:**
- Create: `src/engine/theory.ts`, `tests/engine/theory.test.ts`

**Interfaces:**
- Consumes: `buildPerfInput`, `computePerf`, `sumEffectiveSubstats` 등, 상수.
- Produces:
  - `interface TheoryResult { perf: number; subAllocation: Record<StatKey, number>; mainDesc: string[]; threeCoMode: 'soksok' | 'sokgong' | 'gonggong' }`
  - `theoryBest(ctx): TheoryResult`
  - `theoryRatio(ctx): number` (내 통합/이론최고)

- [ ] **Step 1: 실패 테스트 작성**

`tests/engine/theory.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { theoryRatio } from '../../src/engine/theory';
import { hiyukiBaseCtx } from './fixtures';

describe('theoryBest', () => {
  it('이론 최고 대비 ≈ 59.9%', () => {
    expect(theoryRatio(hiyukiBaseCtx()) * 100).toBeCloseTo(59.9, 0);
  });
});
```

- [ ] **Step 2: 공유 fixture 작성**

`tests/engine/fixtures.ts`:
```ts
import { loadCharacters, loadWeapons, loadEchoSets } from '../../src/engine/loadData';
import type { CalcContext } from '../../src/engine/context';

export function hiyukiBaseCtx(): CalcContext {
  const character = loadCharacters().find((c) => c.id === 'hiyuki')!;
  const weapon = loadWeapons().find((w) => w.id === 'frostbound_flame')!;
  return {
    character, weapon, mainEcho: character.main_slot_echo[0], echoSet: loadEchoSets()[0],
    costLayout: '43311',
    mainPrimary: [
      { cost: 4, type: 'critical_damage' }, { cost: 3, type: 'attack_percent' },
      { cost: 3, type: 'attack_percent' }, { cost: 1, type: 'attack_percent' },
      { cost: 1, type: 'attack_percent' },
    ],
    substats: [
      [{ type: 'critical_rate', value: 35.7 }], [{ type: 'critical_damage', value: 60 }],
      [{ type: 'attack_percent', value: 29.3 }], [{ type: 'resonance_liberation_bonus', value: 33.8 }], [],
    ],
    conditionalToggles: { set_5pc_element: true, set_5pc_critical: true, weapon_glacio_amplify: false, weapon_def_ignore: false },
    manualBuffs: [], masterToggle: true,
  };
}
```

- [ ] **Step 3: 실패 확인**

Run: `npm test -- tests/engine/theory.test.ts`
Expected: FAIL.

- [ ] **Step 4: 구현 (theoryBest + theoryRatio)**

`src/engine/theory.ts`:
```ts
import type { StatKey, Cost } from '../types/domain';
import type { CalcContext, MainPrimaryPick } from './context';
import { buildPerfInput } from './build';
import { computePerf } from './perf';
import { COST_LAYOUTS, MAIN_PRIMARY, substatMaxStage } from './constants';

export interface TheoryResult {
  perf: number;
  subAllocation: Partial<Record<StatKey, number>>; // 줄 수
  mainDesc: string[];
  threeCoMode: 'soksok' | 'sokgong' | 'gonggong';
}

/** 해당 슬롯 코스트에서 가능한 메인 옵션 키 목록 (딜 관련만) */
function mainOptionsFor(cost: Cost): StatKey[] {
  const all = Object.keys(MAIN_PRIMARY[cost]) as StatKey[];
  // 딜 관련: attack_percent, element_damage_bonus, critical_rate, critical_damage
  const dealKeys: StatKey[] = ['attack_percent', 'element_damage_bonus', 'critical_rate', 'critical_damage'];
  return all.filter((k) => dealKeys.includes(k));
}

/** 메인 선택 조합 전수 생성 */
function* mainCombos(layout: Cost[]): Generator<MainPrimaryPick[]> {
  function* rec(i: number, acc: MainPrimaryPick[]): Generator<MainPrimaryPick[]> {
    if (i === layout.length) { yield acc; return; }
    for (const type of mainOptionsFor(layout[i])) {
      yield* rec(i + 1, [...acc, { cost: layout[i], type }]);
    }
  }
  yield* rec(0, []);
}

/** 유효옵 줄 배분 (각 0~5, 합 = totalLines) 전수 */
function* subAllocations(keys: StatKey[], totalLines: number): Generator<number[]> {
  function* rec(idx: number, remaining: number, acc: number[]): Generator<number[]> {
    if (idx === keys.length - 1) {
      if (remaining >= 0 && remaining <= 5) yield [...acc, remaining];
      return;
    }
    for (let n = 0; n <= 5; n++) {
      if (n > remaining) break;
      yield* rec(idx + 1, remaining - n, [...acc, n]);
    }
  }
  yield* rec(0, totalLines, []);
}

function describeMain(picks: MainPrimaryPick[]): string[] {
  return picks.map((p) => `${p.cost}코:${p.type}`);
}

function threeCoModeOf(picks: MainPrimaryPick[]): 'soksok' | 'sokgong' | 'gonggong' {
  const threeCo = picks.filter((p) => p.cost === 3);
  const ele = threeCo.filter((p) => p.type === 'element_damage_bonus').length;
  if (ele === 2) return 'soksok';
  if (ele === 1) return 'sokgong';
  return 'gonggong';
}

export function theoryBest(ctx: CalcContext): TheoryResult {
  const layout: Cost[] = COST_LAYOUTS[ctx.costLayout];
  const keys = ctx.character.effective_substats;
  // 전제형: 공효 3줄 차감 → 22줄, 그 외 25줄
  const totalLines = ctx.character.energy_regen_mode === 'premise' ? 22 : 25;

  let best: TheoryResult | null = null;
  const combos = [...mainCombos(layout)];

  for (const alloc of subAllocations(keys, totalLines)) {
    // 이 배분으로 부옵 substats 구성 (각 유효옵 = 줄수 × max단계)
    const substats: CalcContext['substats'] = keys.map((k, idx) => {
      const lines = alloc[idx];
      return lines > 0 ? [{ type: k, value: lines * substatMaxStage(k) }] : [];
    });
    for (const picks of combos) {
      const trial: CalcContext = { ...ctx, mainPrimary: picks, substats };
      const perf = computePerf(buildPerfInput(trial));
      if (!best || perf > best.perf) {
        const subAllocation: Partial<Record<StatKey, number>> = {};
        keys.forEach((k, idx) => { subAllocation[k] = alloc[idx]; });
        best = { perf, subAllocation, mainDesc: describeMain(picks), threeCoMode: threeCoModeOf(picks) };
      }
    }
  }
  return best!;
}

export function theoryRatio(ctx: CalcContext): number {
  const mine = computePerf(buildPerfInput(ctx));
  return mine / theoryBest(ctx).perf;
}
```

> 주의: `subAllocations`는 마지막 키에 잔여를 할당하므로 합이 정확히 `totalLines`가 되고 각 0~5 범위를 보장한다. 유효옵이 5종이면 22줄(전제형)/25줄 배분이 프로토타입과 동일.

- [ ] **Step 5: 통과 확인**

Run: `npm test -- tests/engine/theory.test.ts`
Expected: PASS (≈ 59.9%).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: theoryBest + theory ratio (59.9%)"
```

---

### Task 9: 크크작 대비 + 메인 조합 추천

**Files:**
- Modify: `src/engine/theory.ts`
- Test: `tests/engine/kkjak.test.ts`

**Interfaces:**
- Consumes: 위 theory + buildPerfInput.
- Produces:
  - `type ThreeCoMode = 'soksok' | 'sokgong' | 'gonggong'`
  - `kkjakPerf(ctx, mode): number`
  - `kkjakRatio(ctx, mode): number`
  - `optimalThreeCoMode(ctx): ThreeCoMode` (이론최고가 고른 3코)
  - `interface RecoRow { label: string; relative: number; best: boolean }`, `mainRecommendation(ctx): { theory: RecoRow[]; kkjak: RecoRow[] }[]` (그룹 배열)

- [ ] **Step 1: 실패 테스트 작성**

`tests/engine/kkjak.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { kkjakRatio, kkjakPerf, optimalThreeCoMode } from '../../src/engine/theory';
import { hiyukiBaseCtx } from './fixtures';

describe('크크작 대비', () => {
  it('이론최고가 고른 3코 = 속속 (드롭다운 기본값)', () => {
    expect(optimalThreeCoMode(hiyukiBaseCtx())).toBe('soksok');
  });

  // 검증 앵커: 기획서 부록 A.5 worked example은 공공 분모 기준
  // (분모 메인=내 메인=공공). 분모 10524.9, 비율 125.7%.
  it('공공 분모 통합 성능 ≈ 10524.9', () => {
    expect(kkjakPerf(hiyukiBaseCtx(), 'gonggong')).toBeCloseTo(10524.9, -1);
  });

  it('크크작 대비(공공 분모) ≈ 125.7%', () => {
    expect(kkjakRatio(hiyukiBaseCtx(), 'gonggong') * 100).toBeCloseTo(125.7, 0);
  });

  // 새 설계(7.3): 기본 분모는 최적(속속)이라 점수가 더 낮게 나온다(공공 유저 패널티).
  it('속속 분모 점수 < 공공 분모 점수', () => {
    expect(kkjakRatio(hiyukiBaseCtx(), 'soksok')).toBeLessThan(kkjakRatio(hiyukiBaseCtx(), 'gonggong'));
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test -- tests/engine/kkjak.test.ts`
Expected: FAIL.

- [ ] **Step 3: theory.ts에 추가 구현**

`src/engine/theory.ts` 끝에 추가:
```ts
import { substatFourthFromBottom } from './constants';

export type ThreeCoMode = 'soksok' | 'sokgong' | 'gonggong';

/** 크크작 분모 컨텍스트: 크리5+크피5(밑4번째), 메인은 4코 크피·1코 공%·3코 모드별 */
function kkjakCtx(ctx: CalcContext, mode: ThreeCoMode): CalcContext {
  const layout: Cost[] = COST_LAYOUTS[ctx.costLayout];
  const crit = substatFourthFromBottom('critical_rate') * 5;       // %
  const cd = substatFourthFromBottom('critical_damage') * 5;       // %
  const substats: CalcContext['substats'] = [
    [{ type: 'critical_rate', value: crit }],
    [{ type: 'critical_damage', value: cd }],
    [], [], [],
  ];
  // 분모 메인: 4코→크피, 3코→모드별, 1코→공%
  const mainPrimary: MainPrimaryPick[] = layout.map((cost) => {
    if (cost === 4) return { cost, type: 'critical_damage' as StatKey };
    if (cost === 1) return { cost, type: 'attack_percent' as StatKey };
    // 3코
    if (mode === 'soksok') return { cost, type: 'element_damage_bonus' as StatKey };
    if (mode === 'gonggong') return { cost, type: 'attack_percent' as StatKey };
    // sokgong: 첫 3코는 속피, 둘째는 공% (호출 순서로 분배)
    return { cost, type: 'element_damage_bonus' as StatKey };
  });
  // sokgong 보정: 3코가 둘이면 둘째를 공%로
  if (mode === 'sokgong') {
    let seen = 0;
    for (const p of mainPrimary) {
      if (p.cost === 3) { seen++; if (seen === 2) p.type = 'attack_percent'; }
    }
  }
  return { ...ctx, mainPrimary, substats };
}

export function kkjakPerf(ctx: CalcContext, mode: ThreeCoMode): number {
  return computePerf(buildPerfInput(kkjakCtx(ctx, mode)));
}

export function kkjakRatio(ctx: CalcContext, mode: ThreeCoMode): number {
  return computePerf(buildPerfInput(ctx)) / kkjakPerf(ctx, mode);
}

export function optimalThreeCoMode(ctx: CalcContext): ThreeCoMode {
  return theoryBest(ctx).threeCoMode;
}
```

- [ ] **Step 4: 통과 확인**

Run: `npm test -- tests/engine/kkjak.test.ts`
Expected: PASS (속속, ≈ 125.7%).

- [ ] **Step 5: 메인 조합 추천 구현**

`src/engine/theory.ts` 끝에 추가:
```ts
export interface RecoRow { label: string; relative: number; best: boolean }
export interface RecoGroup { label: string; theory: RecoRow[]; kkjak: RecoRow[] }

/** 한 메인 조합(고정 슬롯 + 가변 슬롯)에서 이론최고 부옵 / 크크작 부옵의 통합 성능 */
function perfWithMain(ctx: CalcContext, picks: MainPrimaryPick[], sub: CalcContext['substats']): number {
  return computePerf(buildPerfInput({ ...ctx, mainPrimary: picks, substats: sub }));
}

function bestSubAllocationPerf(ctx: CalcContext, picks: MainPrimaryPick[]): number {
  const keys = ctx.character.effective_substats;
  const total = ctx.character.energy_regen_mode === 'premise' ? 22 : 25;
  let best = 0;
  for (const alloc of subAllocations(keys, total)) {
    const sub: CalcContext['substats'] = keys.map((k, idx) =>
      alloc[idx] > 0 ? [{ type: k, value: alloc[idx] * substatMaxStage(k) }] : []);
    const p = perfWithMain(ctx, picks, sub);
    if (p > best) best = p;
  }
  return best;
}

function kkjakSub(): CalcContext['substats'] {
  const crit = substatFourthFromBottom('critical_rate') * 5;
  const cd = substatFourthFromBottom('critical_damage') * 5;
  return [[{ type: 'critical_rate', value: crit }], [{ type: 'critical_damage', value: cd }], [], [], []];
}

function rows(entries: [string, number][]): RecoRow[] {
  const max = Math.max(...entries.map((e) => e[1]));
  return entries
    .slice()
    .sort((a, b) => b[1] - a[1])
    .map(([label, v]) => ({ label, relative: v / max, best: Math.abs(v - max) < 1e-6 }));
}

/** 43311: 4코 메인 그룹 + 3코 조합 그룹. 44111: 4코 조합 그룹. */
export function mainRecommendation(ctx: CalcContext): RecoGroup[] {
  const layout: Cost[] = COST_LAYOUTS[ctx.costLayout];
  const groups: RecoGroup[] = [];

  if (ctx.costLayout === '43311') {
    // 그룹1: 4코 메인 비교 (3코 속속·1코 공% 고정)
    const g1: [string, MainPrimaryPick[]][] = (['critical_damage', 'critical_rate', 'attack_percent'] as StatKey[])
      .map((t4) => [
        t4 === 'critical_damage' ? '크피' : t4 === 'critical_rate' ? '크리' : '공%',
        layout.map((cost, i) => ({ cost, type: i === 0 ? t4 : cost === 3 ? 'element_damage_bonus' : 'attack_percent' })),
      ]);
    groups.push({
      label: '4코 메인 (3코 속속·1코 공% 고정)',
      theory: rows(g1.map(([n, p]) => [n, bestSubAllocationPerf(ctx, p)])),
      kkjak: rows(g1.map(([n, p]) => [n, perfWithMain(ctx, p, kkjakSub())])),
    });
    // 그룹2: 3코 조합 비교 (4코 크피·1코 공% 고정)
    const threeCombos: [string, StatKey[]][] = [
      ['속속', ['element_damage_bonus', 'element_damage_bonus']],
      ['속공', ['element_damage_bonus', 'attack_percent']],
      ['공공', ['attack_percent', 'attack_percent']],
    ];
    const g2: [string, MainPrimaryPick[]][] = threeCombos.map(([n, threes]) => {
      let ti = 0;
      const picks = layout.map((cost, i) => ({
        cost,
        type: cost === 4 ? 'critical_damage' as StatKey : cost === 1 ? 'attack_percent' as StatKey : threes[ti++],
      }));
      return [n, picks];
    });
    groups.push({
      label: '3코 조합 (4코 크피·1코 공% 고정)',
      theory: rows(g2.map(([n, p]) => [n, bestSubAllocationPerf(ctx, p)])),
      kkjak: rows(g2.map(([n, p]) => [n, perfWithMain(ctx, p, kkjakSub())])),
    });
  } else {
    // 44111: 4코 두 슬롯 조합 비교 (1코 공% 고정)
    const fourCombos: [string, StatKey[]][] = [
      ['크피+크피', ['critical_damage', 'critical_damage']],
      ['크피+크리', ['critical_damage', 'critical_rate']],
      ['크피+공%', ['critical_damage', 'attack_percent']],
      ['크리+크리', ['critical_rate', 'critical_rate']],
      ['크리+공%', ['critical_rate', 'attack_percent']],
      ['공%+공%', ['attack_percent', 'attack_percent']],
    ];
    const g: [string, MainPrimaryPick[]][] = fourCombos.map(([n, fours]) => {
      let fi = 0;
      const picks = layout.map((cost) => ({
        cost, type: cost === 4 ? fours[fi++] : 'attack_percent' as StatKey,
      }));
      return [n, picks];
    });
    groups.push({
      label: '4코 조합 (1코 공% 고정)',
      theory: rows(g.map(([n, p]) => [n, bestSubAllocationPerf(ctx, p)])),
      kkjak: rows(g.map(([n, p]) => [n, perfWithMain(ctx, p, kkjakSub())])),
    });
  }
  return groups;
}
```

- [ ] **Step 6: 추천 스모크 테스트 추가**

`tests/engine/kkjak.test.ts`에 추가:
```ts
import { mainRecommendation } from '../../src/engine/theory';

it('43311 추천: 3코 그룹 최고가 속속', () => {
  const groups = mainRecommendation(hiyukiBaseCtx());
  const threeGroup = groups.find((g) => g.label.startsWith('3코'))!;
  const top = threeGroup.theory.find((r) => r.best)!;
  expect(top.label).toBe('속속');
});
```

- [ ] **Step 7: 통과 확인 + 미사용 정리**

Run: `npm test -- tests/engine/kkjak.test.ts`
Expected: PASS. 이어 `npm run build`로 타입(미사용 변수 포함) 확인.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: kkjak ratio + main recommendation"
```

---

### Task 10: 부옵 자유 비교

**Files:**
- Modify: `src/engine/theory.ts`
- Test: `tests/engine/compare.test.ts`

**Interfaces:**
- Produces: `compareSubstats(ctx, override: Partial<Record<StatKey, number>>): { current: number; compared: number; diffPercent: number }`

- [ ] **Step 1: 실패 테스트 작성**

`tests/engine/compare.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { compareSubstats } from '../../src/engine/theory';
import { hiyukiBaseCtx } from './fixtures';

describe('부옵 자유 비교', () => {
  it('슬롯 변경 ≈ +0.64%', () => {
    // 부록 A.6 override: 크피 합 60→57.6 (-2.4), 공% 합 29.3→33.8 (+4.5)
    // 검증 엔진 실측 +0.64%. 부록 A.6 "+1.8%"는 stale 수기 추정치.
    const r = compareSubstats(hiyukiBaseCtx(), { critical_damage: 57.6, attack_percent: 33.8 });
    expect(r.diffPercent).toBeCloseTo(0.64, 1);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test -- tests/engine/compare.test.ts`
Expected: FAIL.

- [ ] **Step 3: 구현**

`src/engine/theory.ts` 끝에 추가:
```ts
import { sumEffectiveSubstats } from './build';

export function compareSubstats(
  ctx: CalcContext,
  override: Partial<Record<StatKey, number>>,
): { current: number; compared: number; diffPercent: number } {
  const current = computePerf(buildPerfInput(ctx));
  // 현재 유효옵 합을 한 에코에 몰아넣은 동등 컨텍스트 + override 적용
  const base = sumEffectiveSubstats(ctx);
  const merged: Partial<Record<StatKey, number>> = { ...base, ...override };
  const substats: CalcContext['substats'] = ctx.character.effective_substats.map((k) =>
    merged[k] != null ? [{ type: k, value: merged[k]! }] : []);
  const compared = computePerf(buildPerfInput({ ...ctx, substats }));
  return { current, compared, diffPercent: (compared / current - 1) * 100 };
}
```

- [ ] **Step 4: 통과 확인**

Run: `npm test -- tests/engine/compare.test.ts`
Expected: PASS (≈ +0.64%).

- [ ] **Step 5: 엔진 전체 회귀 확인**

Run: `npm test`
Expected: 모든 엔진 테스트 PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: substat free comparison (+0.64%)"
```

---

### Task 11: 선택 상태 스토어 + 기본 히유키 샘플

**Files:**
- Create: `src/state/store.ts`, `tests/state/store.test.ts`

**Interfaces:**
- Consumes: 타입, loadData.
- Produces:
  - `interface AppState extends CalcContext {}` (선택 상태 = CalcContext)
  - `initialState(): AppState` (히유키 + 서린 불꽃 + 기도의 눈 + 부록 A 샘플 부옵 + 기본 메인 + 조건부 전부 on, 무기 부스트 on=기본)
  - `loadSampleSubstats(character): SubstatLine[][]` (프로토타입 loadSample 이식, 단계값 스냅)

- [ ] **Step 1: 실패 테스트 작성**

`tests/state/store.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { initialState } from '../../src/state/store';
import { computePerf } from '../../src/engine/perf';
import { buildPerfInput } from '../../src/engine/build';

describe('initialState', () => {
  it('히유키 기본 상태 로드', () => {
    const s = initialState();
    expect(s.character.id).toBe('hiyuki');
    expect(s.weapon.id).toBe('frostbound_flame');
    expect(s.costLayout).toBe('43311');
    expect(s.substats).toHaveLength(5);
  });

  it('기본 상태(무기 부스트 ON)는 양수 통합 성능', () => {
    const s = initialState();
    expect(computePerf(buildPerfInput(s))).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test -- tests/state/store.test.ts`
Expected: FAIL.

- [ ] **Step 3: 구현**

`src/state/store.ts`:
```ts
import type { Character } from '../types/data';
import type { CalcContext, SubstatLine, MainPrimaryPick } from '../engine/context';
import { loadCharacters, loadWeapons, loadEchoSets, getWeapon, getEchoSet } from '../engine/loadData';
import { SUBSTAT_STAGES } from '../engine/constants';
import type { StatKey } from '../types/domain';

export type AppState = CalcContext;

/** 가장 가까운 단계값으로 스냅 */
function snap(type: StatKey, value: number): number {
  const stages = SUBSTAT_STAGES[type];
  if (!stages) return value;
  return stages.reduce((a, b) => (Math.abs(b - value) < Math.abs(a - value) ? b : a));
}

/** 프로토타입 loadSample 이식 (히유키 실제 에코 5개, 무효옵 포함) */
export function loadSampleSubstats(character: Character): SubstatLine[][] {
  if (character.id !== 'hiyuki') {
    return Array.from({ length: 5 }, () => Array.from({ length: 5 }, () => ({ type: '' as const, value: null })));
  }
  const raw: [StatKey, number][][] = [
    [['critical_rate', 6.9], ['critical_damage', 12.6], ['attack_percent', 7.9], ['resonance_liberation_bonus', 7.9], ['basic_attack_bonus', 10.9]],
    [['critical_damage', 15], ['energy_regen', 8.0], ['flat_defense', 60], ['flat_hp', 394], ['critical_rate', 7.5]],
    [['critical_damage', 18.6], ['attack_percent', 6.4], ['resonance_skill_bonus', 11.6], ['resonance_liberation_bonus', 6.4], ['critical_rate', 6.9]],
    [['attack_percent', 7.2], ['flat_defense', 60], ['critical_damage', 13.8], ['resonance_liberation_bonus', 10.9], ['critical_rate', 6.9]],
    [['resonance_liberation_bonus', 8.6], ['heavy_attack_bonus', 10.1], ['energy_regen', 6.4], ['critical_rate', 7.5], ['attack_percent', 7.9]],
  ];
  return raw.map((echo) => echo.map(([type, v]) => ({ type, value: snap(type, v) })));
}

const DEFAULT_MAIN: MainPrimaryPick[] = [
  { cost: 4, type: 'critical_damage' },
  { cost: 3, type: 'attack_percent' },
  { cost: 3, type: 'attack_percent' },
  { cost: 1, type: 'attack_percent' },
  { cost: 1, type: 'attack_percent' },
];

export function initialState(): AppState {
  const character = loadCharacters().find((c) => c.id === 'hiyuki')!;
  const weapons = loadWeapons();
  const sets = loadEchoSets();
  const weapon = getWeapon(character.recommended_weapons[0], weapons);
  const echoSet = getEchoSet(character.recommended_echo_sets[0], sets);

  // 조건부 토글 기본 on (상시 외 조건부 버프 전부)
  const conditionalToggles: Record<string, boolean> = {};
  [...character.skill_node, ...character.main_slot_echo[0].buffs, ...weapon.buffs, ...echoSet.buffs]
    .forEach((b) => { if (!b.always && b.id) conditionalToggles[b.id] = true; });

  return {
    character,
    weapon,
    mainEcho: character.main_slot_echo[0],
    echoSet,
    costLayout: '43311',
    mainPrimary: DEFAULT_MAIN,
    substats: loadSampleSubstats(character),
    conditionalToggles,
    manualBuffs: [],
    masterToggle: true,
  };
}
```

- [ ] **Step 4: 통과 확인**

Run: `npm test -- tests/state/store.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: app state + hiyuki sample"
```

---

### Task 12: UI — 설정 & 선택 셀렉터

**Files:**
- Create: `src/components/Selectors.tsx`, `src/App.tsx` (수정)
- Test: 수동 스모크 (dev 서버)

**Interfaces:**
- Consumes: `AppState`, loadData 헬퍼.
- Produces: `<Selectors state setState />` — 캐릭터/무기/4코 메인 에코/에코세트/코스트 구성 드롭다운.

- [ ] **Step 1: Selectors 컴포넌트 구현**

`src/components/Selectors.tsx`:
```tsx
import type { AppState } from '../state/store';
import { loadCharacters, loadWeapons, loadEchoSets, getWeapon, getEchoSet } from '../engine/loadData';
import type { CostLayout } from '../types/domain';

interface Props {
  state: AppState;
  setState: (s: AppState) => void;
}

export function Selectors({ state, setState }: Props) {
  const characters = loadCharacters();
  const weapons = loadWeapons();
  const sets = loadEchoSets();
  const char = state.character;

  return (
    <div className="config">
      <label>캐릭터:
        <select value={char.id} onChange={(e) => {
          const c = characters.find((x) => x.id === e.target.value)!;
          const w = getWeapon(c.recommended_weapons[0], weapons);
          const s = getEchoSet(c.recommended_echo_sets[0], sets);
          setState({ ...state, character: c, weapon: w, echoSet: s, mainEcho: c.main_slot_echo[0] });
        }}>
          {characters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </label>

      <label>무기:
        <select value={state.weapon.id} onChange={(e) =>
          setState({ ...state, weapon: getWeapon(e.target.value, weapons) })}>
          {char.recommended_weapons.map((id) => {
            const w = getWeapon(id, weapons);
            return <option key={id} value={id}>{w.name}</option>;
          })}
        </select>
      </label>

      <label>4코 메인 에코:
        <select value={state.mainEcho.id} onChange={(e) =>
          setState({ ...state, mainEcho: char.main_slot_echo.find((m) => m.id === e.target.value)! })}>
          {char.main_slot_echo.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </label>

      <label>에코 세트:
        <select value={state.echoSet.id} onChange={(e) =>
          setState({ ...state, echoSet: getEchoSet(e.target.value, sets) })}>
          {char.recommended_echo_sets.map((id) => {
            const s = getEchoSet(id, sets);
            return <option key={id} value={id}>{s.name}</option>;
          })}
        </select>
      </label>

      <label>코스트 구성:
        <select value={state.costLayout} onChange={(e) =>
          setState({ ...state, costLayout: e.target.value as CostLayout })}>
          <option value="43311">43311</option>
          <option value="44111">44111</option>
        </select>
      </label>
    </div>
  );
}
```

- [ ] **Step 2: App에 상태 + Selectors 연결**

`src/App.tsx`:
```tsx
import { useState } from 'react';
import { initialState } from './state/store';
import { Selectors } from './components/Selectors';

export function App() {
  const [state, setState] = useState(initialState);
  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: 16 }}>
      <h1>명조 에코 평가 (근사 트랙)</h1>
      <Selectors state={state} setState={setState} />
    </div>
  );
}
```

- [ ] **Step 3: 빌드 + 수동 스모크**

Run: `npm run build`
Expected: 타입 에러 없음.
Run: `npm run dev` → 브라우저에서 5개 드롭다운이 보이고, 무기를 천년의 회류로 바꿔도 에러 없음.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: selectors UI"
```

---

### Task 13: UI — 메인 옵션 표 + 부옵 입력

**Files:**
- Create: `src/components/MainPrimaryTable.tsx`, `src/components/SubstatInput.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `AppState`, `MAIN_PRIMARY`, `SUBSTAT_STAGES`, `COST_LAYOUTS`.
- Produces: `<MainPrimaryTable>` (슬롯별 메인 옵션 드롭다운, 딜 관련만), `<SubstatInput>` (5에코 탭 × 5줄 옵션+단계 + 유효옵 합계).

- [ ] **Step 1: MainPrimaryTable 구현**

`src/components/MainPrimaryTable.tsx`:
```tsx
import type { AppState } from '../state/store';
import { COST_LAYOUTS, MAIN_PRIMARY } from '../engine/constants';
import type { Cost, StatKey } from '../types/domain';

const DEAL_KEYS: StatKey[] = ['attack_percent', 'element_damage_bonus', 'critical_rate', 'critical_damage'];
const LABEL: Partial<Record<StatKey, string>> = {
  attack_percent: '공%', element_damage_bonus: '속성피해', critical_rate: '크리', critical_damage: '크피',
};

function optionsFor(cost: Cost): StatKey[] {
  return (Object.keys(MAIN_PRIMARY[cost]) as StatKey[]).filter((k) => DEAL_KEYS.includes(k));
}

interface Props { state: AppState; setState: (s: AppState) => void; }

export function MainPrimaryTable({ state, setState }: Props) {
  const layout = COST_LAYOUTS[state.costLayout];
  return (
    <table>
      <thead><tr><th>슬롯</th><th>코스트</th><th>메인 primary</th></tr></thead>
      <tbody>
        {layout.map((cost, i) => (
          <tr key={i}>
            <td>{i + 1}</td><td>{cost}코</td>
            <td>
              <select value={state.mainPrimary[i]?.type ?? optionsFor(cost)[0]} onChange={(e) => {
                const next = state.mainPrimary.map((p, idx) =>
                  idx === i ? { cost, type: e.target.value as StatKey } : p);
                setState({ ...state, mainPrimary: next });
              }}>
                {optionsFor(cost).map((k) => (
                  <option key={k} value={k}>{LABEL[k]} ({MAIN_PRIMARY[cost][k]}%)</option>
                ))}
              </select>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

> 코스트 구성 변경 시 `state.mainPrimary` 길이/코스트가 안 맞을 수 있으므로, App에서 `costLayout` 변경 핸들러가 `mainPrimary`를 새 레이아웃 기본값으로 재생성하도록 한다(Step 3).

- [ ] **Step 2: SubstatInput 구현**

`src/components/SubstatInput.tsx`:
```tsx
import { useState } from 'react';
import type { AppState } from '../state/store';
import { SUBSTAT_STAGES } from '../engine/constants';
import { sumEffectiveSubstats } from '../engine/build';
import type { StatKey } from '../types/domain';

const SUB_LABEL: Partial<Record<StatKey, string>> = {
  critical_rate: '크리티컬%', critical_damage: '크리티컬 피해%', attack_percent: '공격력%',
  hp_percent: 'HP%', defense_percent: '방어력%', flat_attack: '공격력(깡공)',
  flat_hp: 'HP(깡체력)', flat_defense: '방어력(깡방)', energy_regen: '공명효율%',
  element_damage_bonus: '속성 피해%',
  basic_attack_bonus: '일반공격 피해%', heavy_attack_bonus: '강공격 피해%',
  resonance_skill_bonus: '공명스킬 피해%', resonance_liberation_bonus: '공명해방 피해%',
};
const OPTION_KEYS = Object.keys(SUB_LABEL) as StatKey[];

interface Props { state: AppState; setState: (s: AppState) => void; }

export function SubstatInput({ state, setState }: Props) {
  const [active, setActive] = useState(0);
  const roman = ['Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ', 'Ⅴ'];
  const lines = state.substats[active];

  function update(li: number, patch: { type?: StatKey | ''; value?: number | null }) {
    const next = state.substats.map((echo, ei) =>
      ei !== active ? echo : echo.map((line, idx) => (idx === li ? { ...line, ...patch } : line)));
    setState({ ...state, substats: next });
  }

  const sum = sumEffectiveSubstats(state);

  return (
    <div>
      <div className="echo-tabs">
        {roman.map((r, i) => (
          <button key={i} className={i === active ? 'echo-tab active' : 'echo-tab'} onClick={() => setActive(i)}>
            에코 {r}
          </button>
        ))}
      </div>
      {lines.map((line, li) => {
        const stages = line.type ? SUBSTAT_STAGES[line.type] : undefined;
        return (
          <div className="sub-row" key={li}>
            <select value={line.type} onChange={(e) => update(li, { type: e.target.value as StatKey | '', value: null })}>
              <option value="">옵션 선택</option>
              {OPTION_KEYS.map((k) => <option key={k} value={k}>{SUB_LABEL[k]}</option>)}
            </select>
            <select className="val" disabled={!stages} value={line.value ?? ''}
              onChange={(e) => update(li, { value: e.target.value === '' ? null : parseFloat(e.target.value) })}>
              <option value="">수치</option>
              {stages?.map((v) => <option key={v} value={v}>{v}{line.type?.startsWith('flat') ? '' : '%'}</option>)}
            </select>
          </div>
        );
      })}
      <table style={{ marginTop: 12 }}>
        <thead><tr><th>유효옵 합</th><th>크리%</th><th>크피%</th><th>공%</th><th>해방%</th><th>깡공</th></tr></thead>
        <tbody><tr>
          <td></td>
          <td>{(sum.critical_rate ?? 0).toFixed(1)}</td>
          <td>{(sum.critical_damage ?? 0).toFixed(1)}</td>
          <td>{(sum.attack_percent ?? 0).toFixed(1)}</td>
          <td>{(sum.resonance_liberation_bonus ?? 0).toFixed(1)}</td>
          <td>{(sum.flat_attack ?? 0).toFixed(0)}</td>
        </tr></tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 3: App에 결합 + costLayout 변경 시 mainPrimary 재생성**

`src/App.tsx` (수정):
```tsx
import { useState } from 'react';
import { initialState, AppState } from './state/store';
import { Selectors } from './components/Selectors';
import { MainPrimaryTable } from './components/MainPrimaryTable';
import { SubstatInput } from './components/SubstatInput';
import { COST_LAYOUTS, MAIN_PRIMARY } from './engine/constants';
import type { StatKey } from './types/domain';

const DEAL_KEYS: StatKey[] = ['attack_percent', 'element_damage_bonus', 'critical_rate', 'critical_damage'];

function defaultMainFor(layout: AppState['costLayout']): AppState['mainPrimary'] {
  return COST_LAYOUTS[layout].map((cost) => {
    const opts = (Object.keys(MAIN_PRIMARY[cost]) as StatKey[]).filter((k) => DEAL_KEYS.includes(k));
    // 4코는 크피 기본, 그 외 공% 기본
    const def = cost === 4 ? 'critical_damage' : 'attack_percent';
    return { cost, type: (opts.includes(def) ? def : opts[0]) as StatKey };
  });
}

export function App() {
  const [state, setRaw] = useState(initialState);
  const setState = (s: AppState) => {
    // costLayout이 바뀌면 mainPrimary 재생성
    if (s.costLayout !== state.costLayout) s = { ...s, mainPrimary: defaultMainFor(s.costLayout) };
    setRaw(s);
  };
  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: 16 }}>
      <h1>명조 에코 평가 (근사 트랙)</h1>
      <Selectors state={state} setState={setState} />
      <h2>메인 옵션</h2>
      <MainPrimaryTable state={state} setState={setState} />
      <h2>부옵</h2>
      <SubstatInput state={state} setState={setState} />
    </div>
  );
}
```

> `AppState`를 `store.ts`에서 named export로 노출(이미 `export type AppState`). App import 경로 확인.

- [ ] **Step 4: 빌드 + 수동 스모크**

Run: `npm run build`
Expected: 타입 에러 없음.
Run: `npm run dev` → 메인 옵션 드롭다운 + 부옵 탭/입력, 유효옵 합계가 갱신됨. 기본 히유키 합계가 크리 35.7 / 크피 60 / 공% 29.3 / 해방 33.8 근처.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: main option + substat input UI"
```

---

### Task 14: UI — 스펙·점수·이론구성·추천·비교

**Files:**
- Create: `src/components/CharacterSpec.tsx`, `src/components/Scores.tsx`, `src/components/BuffPanel.tsx`, `src/components/MainReco.tsx`, `src/components/SubstatCompare.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: 엔진 전부(`computeDisplaySpec`, `theoryBest`, `theoryRatio`, `kkjakRatio`, `optimalThreeCoMode`, `mainRecommendation`, `compareSubstats`, `computePerf`, `buildPerfInput`).
- Produces: 각 표시 컴포넌트.

- [ ] **Step 1: CharacterSpec + BuffPanel 구현**

`src/components/CharacterSpec.tsx`:
```tsx
import type { AppState } from '../state/store';
import { computeDisplaySpec } from '../engine/spec';

export function CharacterSpec({ state }: { state: AppState }) {
  const s = computeDisplaySpec(state);
  return (
    <table className="spec-table">
      <tbody>
        <tr><th>공격력</th><td>{s.attack.toFixed(0)}</td></tr>
        <tr><th>크리티컬</th><td>{(s.criticalRateRaw * 100).toFixed(1)}%{s.criticalRateRaw > 1 ? ' (캡 100)' : ''}</td></tr>
        <tr><th>크리티컬 피해</th><td>{(s.criticalDamage * 100).toFixed(1)}%</td></tr>
        <tr><th>속성 피해</th><td>{(s.elementBonus * 100).toFixed(1)}%{s.amplify > 0 ? ` (부스트 +${(s.amplify * 100).toFixed(0)}%)` : ''}</td></tr>
        <tr><th>스킬 피해(유형)</th><td>{(s.damageTypeBonus * 100).toFixed(1)}%</td></tr>
      </tbody>
    </table>
  );
}
```

`src/components/BuffPanel.tsx`:
```tsx
import type { AppState } from '../state/store';
import type { Buff } from '../types/data';
import type { StatKey } from '../types/domain';

const BUFF_TYPES: { key: StatKey; label: string }[] = [
  { key: 'critical_rate', label: '크리티컬%' }, { key: 'critical_damage', label: '크리티컬 피해%' },
  { key: 'element_damage_bonus', label: '속성피해% 증가' }, { key: 'element_damage_amplify', label: '속성피해% 부스트' },
  { key: 'all_damage_amplify', label: '전체 피해% 부스트' }, { key: 'attack_percent', label: '공격력%' },
];

interface Props { state: AppState; setState: (s: AppState) => void; }

export function BuffPanel({ state, setState }: Props) {
  // 조건부 토글 목록(상시 제외): 무기·세트·메인에코에서 수집
  const conditional: Buff[] = [
    ...state.mainEcho.buffs, ...state.weapon.buffs, ...state.echoSet.buffs,
  ].filter((b) => !b.always && b.id);

  return (
    <div>
      <label style={{ display: 'block', margin: '4px 0' }}>
        <input type="checkbox" checked={state.masterToggle}
          onChange={(e) => setState({ ...state, masterToggle: e.target.checked })} /> 추가 버프 적용(마스터)
      </label>
      <div className="muted">조건부</div>
      {conditional.map((b) => (
        <label key={b.id} style={{ display: 'block' }}>
          <input type="checkbox" checked={state.conditionalToggles[b.id!] ?? true}
            onChange={(e) => setState({ ...state, conditionalToggles: { ...state.conditionalToggles, [b.id!]: e.target.checked } })} />
          {' '}{b.label}
        </label>
      ))}
      <div className="muted" style={{ margin: '8px 0 4px' }}>파티/기타 버프</div>
      {state.manualBuffs.map((mb, i) => (
        <div className="sub-row" key={i}>
          <select value={mb.type} onChange={(e) => {
            const next = state.manualBuffs.map((x, idx) => idx === i ? { ...x, type: e.target.value as StatKey | '' } : x);
            setState({ ...state, manualBuffs: next });
          }}>
            <option value="">유형</option>
            {BUFF_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
          <input type="number" step="0.1" placeholder="수치" value={mb.value ?? ''}
            onChange={(e) => {
              const next = state.manualBuffs.map((x, idx) => idx === i ? { ...x, value: e.target.value === '' ? null : parseFloat(e.target.value) } : x);
              setState({ ...state, manualBuffs: next });
            }} />
          <button onClick={() => setState({ ...state, manualBuffs: state.manualBuffs.filter((_, idx) => idx !== i) })}>×</button>
        </div>
      ))}
      <button onClick={() => setState({ ...state, manualBuffs: [...state.manualBuffs, { type: '', value: null }] })}>+ 버프 추가</button>
    </div>
  );
}
```

- [ ] **Step 2: Scores + 이론 구성 구현**

`src/components/Scores.tsx`:
```tsx
import { useState } from 'react';
import type { AppState } from '../state/store';
import { computePerf } from '../engine/perf';
import { buildPerfInput } from '../engine/build';
import { theoryBest, kkjakPerf, optimalThreeCoMode, ThreeCoMode } from '../engine/theory';

export function Scores({ state }: { state: AppState }) {
  const mine = computePerf(buildPerfInput(state));
  const best = theoryBest(state);
  const [mode, setMode] = useState<ThreeCoMode>(() => optimalThreeCoMode(state));
  const kk = kkjakPerf(state, mode);

  const lbl = state.character.effective_substats;
  const subDesc = lbl.map((k) => `${k} ${best.subAllocation[k] ?? 0}줄`).join(', ');

  return (
    <div>
      <div className="score">
        <div className="score-box"><div className="val">{(mine / best.perf * 100).toFixed(1)}%</div><div className="lbl">이론 최고 대비</div></div>
        <div className="score-box">
          <div className="val">{(mine / kk * 100).toFixed(1)}%</div>
          <div className="lbl">크크작 대비 · 3코:
            <select value={mode} onChange={(e) => setMode(e.target.value as ThreeCoMode)}>
              <option value="soksok">속속</option><option value="sokgong">속공</option><option value="gonggong">공공</option>
            </select>
          </div>
        </div>
      </div>
      <p className="muted">내 통합성능 {mine.toFixed(0)} / 이론최고 {best.perf.toFixed(0)} / 크크작 {kk.toFixed(0)}</p>
      <p className="muted">이론 최고: 메인 {best.mainDesc.join(' / ')} · 부옵 {subDesc} (+공효 3줄)</p>
    </div>
  );
}
```

- [ ] **Step 3: MainReco + SubstatCompare 구현**

`src/components/MainReco.tsx`:
```tsx
import type { AppState } from '../state/store';
import { mainRecommendation, RecoRow } from '../engine/theory';

function Cell({ rows }: { rows: RecoRow[] }) {
  return (
    <table style={{ width: 'auto' }}>
      <tbody>
        {rows.map((r) => (
          <tr key={r.label} style={r.best ? { fontWeight: 'bold', background: '#eef7ee' } : undefined}>
            <td>{r.label}</td><td>{(r.relative * 100).toFixed(1)}%{r.best ? ' ★' : ''}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function MainReco({ state }: { state: AppState }) {
  const groups = mainRecommendation(state);
  return (
    <table className="reco-grid">
      <thead><tr><th></th>{groups.map((g) => <th key={g.label}>{g.label}</th>)}</tr></thead>
      <tbody>
        <tr><th>이론 최고</th>{groups.map((g) => <td key={g.label}><Cell rows={g.theory} /></td>)}</tr>
        <tr><th>크크작</th>{groups.map((g) => <td key={g.label}><Cell rows={g.kkjak} /></td>)}</tr>
      </tbody>
    </table>
  );
}
```

`src/components/SubstatCompare.tsx`:
```tsx
import { useState } from 'react';
import type { AppState } from '../state/store';
import { compareSubstats } from '../engine/theory';
import type { StatKey } from '../types/domain';

const FIELDS: { key: StatKey; label: string }[] = [
  { key: 'critical_rate', label: '크리%' }, { key: 'critical_damage', label: '크피%' },
  { key: 'attack_percent', label: '공%' }, { key: 'resonance_liberation_bonus', label: '해방%' },
  { key: 'flat_attack', label: '깡공' },
];

export function SubstatCompare({ state }: { state: AppState }) {
  const [over, setOver] = useState<Partial<Record<StatKey, number>>>({});
  const [result, setResult] = useState<string>('');

  return (
    <div>
      <p className="muted">바꿀 유효옵 합만 입력(비우면 현재값).</p>
      <div className="sub-row">
        {FIELDS.map((f) => (
          <label key={f.key}>{f.label}
            <input type="number" step="0.1" value={over[f.key] ?? ''}
              onChange={(e) => setOver({ ...over, [f.key]: e.target.value === '' ? undefined : parseFloat(e.target.value) })} />
          </label>
        ))}
      </div>
      <button onClick={() => {
        const clean = Object.fromEntries(Object.entries(over).filter(([, v]) => v != null)) as Partial<Record<StatKey, number>>;
        const r = compareSubstats(state, clean);
        setResult(`현재 ${r.current.toFixed(0)} → 비교 ${r.compared.toFixed(0)} · ${r.diffPercent >= 0 ? '+' : ''}${r.diffPercent.toFixed(2)}%`);
      }}>비교</button>
      <div className="cmp-result">{result}</div>
    </div>
  );
}
```

- [ ] **Step 4: App 최종 조립 + 스타일**

`src/App.tsx` (최종):
```tsx
import { useState } from 'react';
import { initialState, AppState } from './state/store';
import { Selectors } from './components/Selectors';
import { MainPrimaryTable } from './components/MainPrimaryTable';
import { SubstatInput } from './components/SubstatInput';
import { CharacterSpec } from './components/CharacterSpec';
import { BuffPanel } from './components/BuffPanel';
import { Scores } from './components/Scores';
import { MainReco } from './components/MainReco';
import { SubstatCompare } from './components/SubstatCompare';
import { COST_LAYOUTS, MAIN_PRIMARY } from './engine/constants';
import type { StatKey } from './types/domain';
import './styles.css';

const DEAL_KEYS: StatKey[] = ['attack_percent', 'element_damage_bonus', 'critical_rate', 'critical_damage'];
function defaultMainFor(layout: AppState['costLayout']): AppState['mainPrimary'] {
  return COST_LAYOUTS[layout].map((cost) => {
    const opts = (Object.keys(MAIN_PRIMARY[cost]) as StatKey[]).filter((k) => DEAL_KEYS.includes(k));
    const def = cost === 4 ? 'critical_damage' : 'attack_percent';
    return { cost, type: (opts.includes(def) ? def : opts[0]) as StatKey };
  });
}

export function App() {
  const [state, setRaw] = useState(initialState);
  const setState = (s: AppState) => {
    if (s.costLayout !== state.costLayout) s = { ...s, mainPrimary: defaultMainFor(s.costLayout) };
    setRaw(s);
  };
  return (
    <div className="app">
      <h1>명조 에코 평가 (근사 트랙)</h1>
      <Selectors state={state} setState={setState} />
      <h2>메인 조합 추천</h2>
      <MainReco state={state} />
      <div className="two-col">
        <div className="left-col">
          <h2>내 캐릭터 스펙</h2>
          <CharacterSpec state={state} />
          <h2>추가 버프</h2>
          <BuffPanel state={state} setState={setState} />
        </div>
        <div className="right-col">
          <h2>메인 옵션</h2>
          <MainPrimaryTable state={state} setState={setState} />
          <h2>부옵</h2>
          <SubstatInput state={state} setState={setState} />
        </div>
      </div>
      <h2>점수</h2>
      <Scores state={state} />
      <h2>부옵 자유 비교</h2>
      <SubstatCompare state={state} />
    </div>
  );
}
```

`src/styles.css` (프로토타입 스타일 이식, 발췌):
```css
* { box-sizing: border-box; }
body { font-family: system-ui, sans-serif; line-height: 1.5; }
.app { max-width: 1000px; margin: 0 auto; padding: 16px; }
h2 { font-size: 1.05rem; margin-top: 24px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
.two-col { display: flex; gap: 24px; align-items: flex-start; }
.left-col, .right-col { flex: 1; }
table { border-collapse: collapse; width: 100%; margin: 8px 0; }
th, td { border: 1px solid #ddd; padding: 4px 6px; text-align: center; font-size: 0.9rem; }
th { background: #f5f5f5; }
.spec-table th { text-align: left; width: 45%; }
.spec-table td { text-align: right; font-weight: bold; }
.config { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; margin: 8px 0; }
.config label { display: flex; gap: 4px; align-items: center; font-size: 0.9rem; }
.score { display: flex; gap: 16px; flex-wrap: wrap; margin: 12px 0; }
.score-box { border: 1px solid #999; padding: 10px 14px; min-width: 160px; }
.score-box .val { font-size: 1.6rem; font-weight: bold; }
.score-box .lbl { font-size: 0.8rem; color: #555; }
.muted { color: #777; font-size: 0.85rem; }
.echo-tabs { display: flex; gap: 6px; flex-wrap: wrap; margin: 8px 0; }
.echo-tab { padding: 6px 14px; border: 1px solid #bbb; border-radius: 6px; cursor: pointer; background: #fafafa; }
.echo-tab.active { background: #2563eb; color: #fff; border-color: #2563eb; font-weight: bold; }
.sub-row { display: flex; gap: 8px; margin: 6px 0; align-items: center; }
.cmp-result { font-weight: bold; margin: 8px 0; }
@media (max-width: 720px) { .two-col { flex-direction: column; } }
```

- [ ] **Step 5: 빌드 + 수동 검증 (검증 수치 화면 대조)**

Run: `npm run build`
Expected: 타입 에러 없음.
Run: `npm run dev` → 기본 히유키(서린 불꽃, 무기 부스트 ON) 상태에서:
- 이론 최고 대비 ≈ 59.9% 확인.
- 크크작 대비: 드롭다운 기본 **속속** ≈ 116%. 드롭다운을 **공공**으로 바꾸면 ≈ 125.7%(부록 A.5 worked example과 일치).
- "응결피해 +28% 부스트" 토글을 끄면 통합성능이 ×(1/1.28)로 감소, 스펙의 부스트 표시가 사라짐.
- 무기를 천년의 회류로 바꾸면 ATK가 소폭 변하고 부스트 토글 목록이 바뀜.

> 주: 화면 기본값은 무기 부스트 ON이므로 통합성능 절대값은 16941 근처지만, **비율 점수(59.9%·125.7%)는 분자·분모에 부스트가 같이 들어가 거의 동일하게 유지**된다. 점수가 크게 흔들리면 버프 적용 경로 버그.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: spec/score/reco/compare UI — full app"
```

---

### Task 15: 최종 회귀 + 정리

**Files:**
- Modify: 필요 시 미사용 코드 제거.

- [ ] **Step 1: 전체 테스트**

Run: `npm test`
Expected: 모든 테스트 PASS.

- [ ] **Step 2: 타입/빌드 클린 확인**

Run: `npm run build`
Expected: 에러 없음(미사용 변수 포함).

- [ ] **Step 3: 미사용 정리 커밋 (있으면)**

```bash
git add -A
git commit -m "chore: cleanup unused engine helpers"
```

---

## 완료 기준
- `npm test` 전부 통과: 13228.6 / ATK 2965 / ×1.28 / 59.9% / 크크작 공공분모 125.7%(10524.9) / 부옵교체 +0.64% / 속속 추천·기본.
- `npm run dev`로 히유키 화면이 프로토타입과 동일하게 동작하고, 무기·세트·메인에코·캐릭터 셀렉터가 JSON 구동으로 작동.
- 새 캐릭터/무기/세트는 JSON 항목 추가만으로 등장(엔진 코드 변경 불필요).
