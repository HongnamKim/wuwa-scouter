# 에코 슬롯 단위 입력 재설계 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 에코 입력을 `mainPrimary[]` + `substats[][]` 분리 방식에서 슬롯별 `{cost, main, substats}` 통합(`slots: EchoSlot[]`)으로 재설계해 슬롯–부옵 정합성을 확보한다.

**Architecture:** `CalcContext.slots: EchoSlot[]`(길이 5)가 `mainPrimary`+`substats`를 대체. `costLayout`은 멀티셋 정의로 유지. 엔진 계산식은 불변, 입력 소스만 slots로 전환. `slotsFrom(layout, mainPrimary, substats)` 헬퍼가 저장 마이그레이션·테스트 픽스처·theory 시뮬레이션 컨텍스트 구성을 공용화.

**Tech Stack:** React 18 + Vite + TypeScript, Vitest, 순수 TS 엔진, `mcp__Claude_Preview__*` 검증.

## Global Constraints
- **딜 수치 회귀 없음**: 같은 입력이면 기존과 동일한 딜. 기존 72 테스트는 입력만 slots로 바꾸고 **기대값 유지**.
- 슬롯 코스트 멀티셋 = `COST_LAYOUTS[costLayout]` (43311→{4,3,3,1,1}, 44111→{4,4,1,1,1}).
- 메인 옵션 딜 관련 키: `['attack_percent','element_damage_bonus','critical_rate','critical_damage','energy_regen']` (기존 `DEAL_KEYS`).
- 커밋 메시지 끝: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
- worktree 작업, 커밋 전 diff는 사용자가 직접 확인.

---

### Task 1: 상태 모델·헬퍼·엔진·테스트 픽스처 (원자적 리팩터, 회귀 스위트로 검증)

CalcContext 형태 변경은 전 파일에 걸치므로 한 태스크로 묶어 `tsc` clean + 기존 테스트 그린(동일 기대값)으로 검증한다.

**Files:**
- Modify: `src/engine/context.ts` (EchoSlot 추가, mainPrimary/substats 제거, slots 추가)
- Modify: `src/engine/echoSlots.ts` (헬퍼 3종 추가)
- Modify: `src/engine/build.ts:28-60` (sumMainPrimary/sumEffectiveSubstats/computeEnergyRegen), `secondaryFlat`(64-73)
- Modify: `src/engine/theory.ts` (137,142,161,192-193,201,209,213,334-336,346 — 시뮬 ctx 구성부)
- Modify: `src/state/store.ts` (defaultStateForCharacter, SavedState, serialize/load 마이그레이션)
- Modify: 테스트 픽스처 — `tests/engine/fixtures.ts`, `tests/engine/{build,defres,echo,rebecca,scale,sigrika,spec,stackbuff,swap,twopiece}.test.ts`, `tests/state/store.test.ts`, `tests/types.test.ts`

**Interfaces:**
- Produces:
  - `interface EchoSlot { cost: Cost; main: StatKey; substats: SubstatLine[] }`
  - `CalcContext.slots: EchoSlot[]` (mainPrimary/substats 삭제)
  - `slotsFrom(layout: CostLayout, mainPrimary: MainPrimaryPick[], substats: SubstatLine[][]): EchoSlot[]`
  - `defaultSlots(layout: CostLayout): EchoSlot[]`
  - `availableCostsForSlot(layout: CostLayout, slots: EchoSlot[], slotIndex: number): Cost[]`
- Consumes: `COST_LAYOUTS`, `MAIN_PRIMARY`, `MAIN_SECONDARY` (constants), `MainPrimaryPick`/`SubstatLine` (context).

- [ ] **Step 1: context.ts — EchoSlot 타입 + slots 필드**

`src/engine/context.ts`에서 `MainPrimaryPick`는 남기고(헬퍼 시그니처용), `CalcContext`의 `mainPrimary`/`substats` 라인을 제거하고 slots 추가:
```ts
export interface EchoSlot {
  cost: Cost;              // 1 | 3 | 4
  main: StatKey;           // 그 슬롯 메인 옵션 (cost에 따라 유효 선택지 제한)
  substats: SubstatLine[]; // 5줄
}
// CalcContext 내부: 아래 두 줄 삭제
//   mainPrimary: MainPrimaryPick[];
//   substats: SubstatLine[][];
// 대신 추가:
  slots: EchoSlot[]; // 길이 5, 코스트 멀티셋 = COST_LAYOUTS[costLayout]
```

- [ ] **Step 2: echoSlots.ts — 헬퍼 3종 추가**

`src/engine/echoSlots.ts`에 추가(기존 import에 `MAIN_PRIMARY`, `COST_LAYOUTS`, 타입 보강):
```ts
import type { Cost, CostLayout, StatKey } from '../types/domain';
import type { EchoSlot, MainPrimaryPick, SubstatLine } from './context';
import { COST_LAYOUTS, MAIN_PRIMARY } from './constants';

const DEAL_KEYS: StatKey[] = ['attack_percent', 'element_damage_bonus', 'critical_rate', 'critical_damage', 'energy_regen'];

/** 코스트별 기본 메인 (4코=크피, 그 외=공%; 없으면 첫 딜키) */
function defaultMainForCost(cost: Cost): StatKey {
  const opts = (Object.keys(MAIN_PRIMARY[cost]) as StatKey[]).filter((k) => DEAL_KEYS.includes(k));
  const def: StatKey = cost === 4 ? 'critical_damage' : 'attack_percent';
  return opts.includes(def) ? def : opts[0];
}

/** 레이아웃 순서 그대로 기본 슬롯 (빈 부옵 5줄) */
export function defaultSlots(layout: CostLayout): EchoSlot[] {
  return COST_LAYOUTS[layout].map((cost) => ({
    cost, main: defaultMainForCost(cost),
    substats: Array.from({ length: 5 }, () => ({ type: '' as const, value: null })),
  }));
}

/** 구 상태(mainPrimary+substats) → slots 1:1 변환 (저장 마이그레이션·테스트·theory 공용) */
export function slotsFrom(layout: CostLayout, mainPrimary: MainPrimaryPick[], substats: SubstatLine[][]): EchoSlot[] {
  return COST_LAYOUTS[layout].map((cost, i) => ({
    cost,
    main: mainPrimary[i]?.type ?? defaultMainForCost(cost),
    substats: substats[i] ?? Array.from({ length: 5 }, () => ({ type: '' as const, value: null })),
  }));
}

/** 슬롯 i의 선택 가능한 코스트: 레이아웃 멀티셋 − 다른 슬롯이 이미 쓴 것 (자기 코스트 포함) */
export function availableCostsForSlot(layout: CostLayout, slots: EchoSlot[], slotIndex: number): Cost[] {
  const pool = [...COST_LAYOUTS[layout]];
  slots.forEach((s, i) => {
    if (i === slotIndex) return;
    const idx = pool.indexOf(s.cost);
    if (idx >= 0) pool.splice(idx, 1);
  });
  return [...new Set(pool)].sort((a, b) => b - a) as Cost[];
}
```

- [ ] **Step 3: build.ts — slots 소비로 전환**

`sumMainPrimary` 본문:
```ts
  const sum: Partial<Record<StatKey, number>> = {};
  ctx.slots.forEach((slot) => {
    const pct = MAIN_PRIMARY[slot.cost][slot.main];
    if (pct != null) sum[slot.main] = (sum[slot.main] ?? 0) + pct / 100;
  });
  return sum;
```
`sumEffectiveSubstats` 순회부:
```ts
  for (const slot of ctx.slots) {
    for (const line of slot.substats) {
      if (line.type && line.value != null && eff.has(line.type)) {
        sum[line.type] = (sum[line.type] ?? 0) + line.value;
      }
    }
  }
```
`computeEnergyRegen`의 subER:
```ts
  const subER = ctx.slots.flatMap((s) => s.substats)
    .filter((l) => l.type === 'energy_regen' && l.value != null)
    .reduce((s, l) => s + (l.value as number), 0);
```
`secondaryFlat` reduce:
```ts
  return ctx.slots.reduce((acc, slot) => {
    const sec = MAIN_SECONDARY[slot.cost];
    return acc + (sec.stat === scaleFlat ? sec.value : 0);
  }, 0);
```

- [ ] **Step 4: theory.ts — 시뮬 ctx를 slots로 구성**

`import { slotsFrom } from './echoSlots';` 추가. 각 시뮬 컨텍스트 구성부를 변환:
- `{ ...ctx, mainPrimary: picks, substats }` → `{ ...ctx, slots: slotsFrom(ctx.costLayout, picks, substats) }` (142, 161, 193, 346행 유형)
- 부옵만 교체하던 `{ ...ctx, substats }` (336행) → `{ ...ctx, slots: ctx.slots.map((s, i) => ({ ...s, substats: substats[i] ?? s.substats })) }`
- `perfWithMain(ctx, picks, sub)` 시그니처 유지, 내부만 `slotsFrom(ctx.costLayout, picks, sub)`로.

- [ ] **Step 5: store.ts — 기본 상태 + 저장/마이그레이션**

`import { defaultSlots, slotsFrom } from '../engine/echoSlots';` 추가.
- `defaultStateForCharacter`: `mainPrimary: defaultMainFor(...)`, `substats: emptySubstats()` 두 줄 제거 → `slots: defaultSlots('43311')`. (conditionalToggles 등 나머지 유지)
- `SavedState`: `mainPrimary`, `substats` 필드 제거 → `slots?: EchoSlot[]` 추가.
- `serializeState`: `mainPrimary`/`substats` 대신 `slots: state.slots`.
- `loadCharacterState`: 마이그레이션 —
```ts
  const layout = s.costLayout ?? '43311';
  const slots = Array.isArray(s.slots) && s.slots.length === 5
    ? s.slots
    : (s.mainPrimary && s.substats) // 구버전 저장분 1:1 변환
      ? slotsFrom(layout, s.mainPrimary, s.substats)
      : defaultSlots(layout);
```
  그리고 state 객체에서 `mainPrimary`/`substats` 대신 `slots` 세팅. (SavedState에는 마이그레이션용으로 `mainPrimary?`/`substats?`를 optional로 남겨 읽기만 허용)

- [ ] **Step 6: 테스트 픽스처 일괄 전환 (기대값 유지)**

패턴: ctx 리터럴의
```ts
    costLayout: '43311',
    mainPrimary: [ {cost:4,type:'critical_damage'}, ... ],
    substats: [ [...], ... ],
```
를
```ts
    costLayout: '43311',
    slots: slotsFrom('43311',
      [ {cost:4,type:'critical_damage'}, ... ],
      [ [...], ... ]),
```
로 치환 (각 파일에 `import { slotsFrom } from '../../src/engine/echoSlots';`). `fixtures.ts`의 `hiyukiBaseCtx` 포함 전 파일 동일 패턴. 값·기대치는 그대로.
`scale.test.ts`는 `mainPrimary: [], substats: [[],[],[],[],[]]` → `slots: defaultSlots('43311').map(s => ({...s, main: s.cost===4?'critical_damage':'attack_percent'}))` 형태로(빈 부옵). 단순화: `slots: slotsFrom('43311', [], [])`.

- [ ] **Step 7: tsc + 전체 테스트 (회귀 게이트)**

Run: `cd "$(git rev-parse --show-toplevel)"; npx tsc --noEmit && npm test 2>&1 | grep -E "Tests |FAIL"`
Expected: tsc 무에러, `Tests 72 passed (72)` — **기대값 변화 없이** 전부 통과(딜 회귀 없음 증명).

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "refactor: 에코 입력 상태를 slots(EchoSlot[])로 통합 — 엔진/스토어/테스트

- CalcContext: mainPrimary+substats → slots (costLayout 유지)
- echoSlots: defaultSlots/slotsFrom/availableCostsForSlot 헬퍼
- build/theory: slots 소비로 전환(계산식 불변)
- store: 기본 slots + 저장 slots + 구버전 1:1 마이그레이션
- 테스트 픽스처 slots 전환, 기대값 유지(72 pass, 회귀 없음)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: 공용 EchoEditor 추출 + 에코 슬롯 입력 UI

**Files:**
- Create: `src/components/EchoEditor.tsx` (SubstatSwapCompare에서 추출)
- Create: `src/components/EchoSlots.tsx` (슬롯 5장 입력)
- Modify: `src/components/SubstatSwapCompare.tsx` (추출한 EchoEditor import)
- Delete: `src/components/MainPrimaryTable.tsx`, `src/components/SubstatInput.tsx`
- Modify: 이 둘을 렌더하던 곳(`src/components/Selectors.tsx` 또는 상위 페이지) — EchoSlots로 교체
- Modify: `src/components/Scores.tsx:27`, `src/components/CharacterList.tsx:11` (`state.substats.some(...)` → `state.slots.some((s)=>s.substats.some((l)=>l.type&&l.value!=null))`)
- Modify: `src/components/Selectors.tsx:147` (costLayout 변경 시 `mainPrimary: defaultMainFor(v)` → `slots: defaultSlots(v)`)

**Interfaces:**
- Consumes: `defaultSlots`, `availableCostsForSlot` (echoSlots), `EchoSlot` (context).
- Produces: `<EchoEditor cost main subs optionList readOnly onMain onSub />` (기존 시그니처), `<EchoSlots state setState />`.

- [ ] **Step 1: EchoEditor 추출**

`SubstatSwapCompare.tsx`의 `EchoEditor` 함수 + `mainOptionsFor`/`MAIN_LABEL`/`SUB_LABEL`/`SUB_OPTION_KEYS`를 `src/components/EchoEditor.tsx`로 이동하고 export. SubstatSwapCompare는 `import { EchoEditor, mainOptionsFor, SUB_LABEL, SUB_OPTION_KEYS } from './EchoEditor';`로 참조.

- [ ] **Step 2: EchoSlots 컴포넌트**

`src/components/EchoSlots.tsx` — 슬롯 5장. 각 카드:
```tsx
// 코스트 드롭다운: availableCostsForSlot(state.costLayout, state.slots, i)
// 코스트 변경 시: main이 그 코스트에서 무효면 defaultMainForCost로, substats 유지
// 메인 드롭다운: mainOptionsFor(slot.cost)
// 부옵 5줄: EchoEditor 재사용(onMain/onSub로 state.slots 갱신)
```
`onSub(i, li, patch)`: `setState({ ...state, slots: state.slots.map((s, si) => si===i ? { ...s, substats: s.substats.map((l,idx)=>idx===li?{...l,...patch}:l) } : s) })`.
코스트 변경 핸들러: 새 cost의 유효 메인 목록에 현재 main 없으면 리셋.

- [ ] **Step 3: 페이지 배선 + 파생 참조 수정**

MainPrimaryTable/SubstatInput 렌더 위치를 `<EchoSlots .../>`로 교체, 두 파일 삭제. Scores/CharacterList의 `state.substats` 파생, Selectors의 costLayout onChange 수정(위 Files 참조).

- [ ] **Step 4: tsc + 테스트**

Run: `npx tsc --noEmit && npm test 2>&1 | grep -E "Tests |FAIL"`
Expected: 무에러, 72 passed.

- [ ] **Step 5: 프리뷰 검증**

preview_start(필요시) → 캐릭터 분석 화면에서:
- 슬롯1 코스트 4 선택 → 슬롯2 코스트 옵션에 4 사라짐(43311이면 3,1만).
- 슬롯 코스트 3→4 변경 시 메인이 크피 등 4코 옵션으로 리셋, 부옵 유지.
- 부옵 편집 시 점수(Scores) 갱신.
- preview_screenshot로 캡처.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: 에코 슬롯 단위 입력 UI (코스트·메인·부옵 통합 카드)

- EchoEditor 공용 컴포넌트 추출, EchoSlots 5장 카드 신설
- MainPrimaryTable/SubstatInput 제거, 동적 코스트/메인 드롭다운
- Scores/CharacterList/Selectors 파생 참조 slots로 전환

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: 부옵 교체 비교 slots 전환 + 마이그레이션 검증

**Files:**
- Modify: `src/components/SubstatSwapCompare.tsx` (mainPrimary/substats → slots)

**Interfaces:**
- Consumes: `state.slots`, `EchoEditor`.

- [ ] **Step 1: SubstatSwapCompare를 slots 기준으로**

- `const cost = layout[slot]` → `const cost = base.slots[slot].cost`
- `base.mainPrimary[slot].type` → `base.slots[slot].main`
- `base.substats[slot]` → `base.slots[slot].substats`
- 교체 계산: `swappedMain`/`swappedSubs` 대신
```ts
const swappedSlots = base.slots.map((s, i) => (i === slot ? { ...s, main, substats: subs } : s));
const compared = computePerf(buildPerfInput({ ...base, slots: swappedSlots }));
```
- 슬롯 셀렉터 라벨: `base.slots[i].cost` / `base.slots[i].main`.

- [ ] **Step 2: tsc + 테스트**

Run: `npx tsc --noEmit && npm test 2>&1 | grep -E "Tests |FAIL"`
Expected: 무에러, 72 passed.

- [ ] **Step 3: 프리뷰 — 비교 + 마이그레이션**

- 부옵 교체 비교: 슬롯 선택 → 코스트/메인/부옵 단위로 표시, 교체 시 증감% 정상.
- 마이그레이션: 콘솔에서 구버전 저장 형태를 localStorage에 심고 새로고침 → slots로 무손실 로드 확인.
```js
// preview_eval 예시
localStorage.setItem('wuwa-scouter:save:hiyuki', JSON.stringify({
  weaponId:'frostbound_flame', echoSetIds:[], mainEchoId:'', costLayout:'43311',
  mainPrimary:[{cost:4,type:'critical_damage'},{cost:3,type:'attack_percent'},{cost:3,type:'attack_percent'},{cost:1,type:'attack_percent'},{cost:1,type:'attack_percent'}],
  substats:[[{type:'critical_rate',value:35.7}],[],[],[],[]], conditionalToggles:{}, manualBuffs:[]
})); location.reload();
```
로드 후 슬롯1 크피 메인 + 부옵 유지 확인.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "refactor: 부옵 교체 비교를 slots 기준으로 (슬롯 단위 정합)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- 상태 모델(EchoSlot/slots) → Task 1 Step 1-2 ✓
- 동적 코스트/메인 → Task 2 Step 2 (availableCostsForSlot, 코스트 변경 시 메인 리셋) ✓
- costLayout 변경 시 슬롯 리셋 → Task 2 Step 3 (Selectors onChange = defaultSlots) ✓
- 엔진 입력 소스 전환(계산 불변) → Task 1 Step 3-4 ✓
- UI 카드 + EchoEditor 공용화 → Task 2 ✓
- 마이그레이션/저장 → Task 1 Step 5 + Task 3 Step 3 ✓
- 범위 밖(메인에코/세트/무기/2pc) → 건드리지 않음 ✓
- 회귀 없음 → Task 1 Step 7 (72 pass, 기대값 유지) ✓

**Placeholder scan:** 코드 스텝은 실제 코드 포함, 기계적 반복부는 패턴+예시 제시. 벌크 픽스처 전환은 파일 목록+치환 패턴 명시. 통과.

**Type consistency:** `slotsFrom`/`defaultSlots`/`availableCostsForSlot` 시그니처가 Task 1에서 정의되고 Task 2/3에서 동일하게 사용. `EchoSlot{cost,main,substats}` 일관. `EchoEditor` 시그니처(cost,main,subs,optionList,onMain,onSub) 기존과 동일 유지.
