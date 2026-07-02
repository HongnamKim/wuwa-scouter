# 에코 슬롯 단위 입력 재설계 (Design)

날짜: 2026-07-02
상태: 승인됨 (구현 대기)

## 배경 / 문제
현재 에코 입력은 세 상태가 서로 독립적이다.
- `costLayout: CostLayout` — 캐릭터 레벨 코스트 구성(43311/44111)
- `mainPrimary: MainPrimaryPick[]` — 슬롯별 {cost, 메인 옵션}
- `substats: SubstatLine[][]` — 5 에코 × 5 줄

메인 슬롯과 부옵 배열이 강하게 묶여있지 않아, 사용자가 "슬롯1(4코)의 부옵"을 다른 에코 위치에 넣는 등 **슬롯–부옵 불일치**가 생길 수 있고, 그 결과 **부옵 교체 비교 기능**이 사용자의 의도대로 동작하지 않는다.

비교 컴포넌트(`SubstatSwapCompare`)는 이미 `EchoEditor`로 "코스트+메인+부옵"을 한 단위로 다루므로, 메인 입력을 같은 단위 모델로 맞추면 정합성이 확보된다.

## 목표
에코 슬롯 1~5를 각각 **{코스트, 메인, 부옵} 한 묶음**으로 입력한다. 코스트는 `costLayout`에 맞춰 슬롯별 동적 선택, 메인은 선택 코스트에 따라 동적 제한.

## 상태 모델
`mainPrimary` + `substats`를 하나로 통합한다.
```ts
interface EchoSlot {
  cost: Cost;              // 1 | 3 | 4
  main: StatKey;           // 그 슬롯 메인 옵션 (cost에 따라 유효 선택지 제한)
  substats: SubstatLine[]; // 5줄
}
// CalcContext:
//   - 제거: mainPrimary: MainPrimaryPick[], substats: SubstatLine[][]
//   - 추가: slots: EchoSlot[]  (길이 5)
//   - 유지: costLayout: CostLayout
```
**불변식:** `slots`의 코스트 멀티셋 = `COST_LAYOUTS[costLayout]`.

## 동적 코스트/메인 동작
- 슬롯 i **코스트 드롭다운** = 레이아웃 멀티셋 − 다른 슬롯이 이미 사용한 코스트. (예: 43311에서 슬롯1이 4 선택 → 남은 슬롯엔 3,3,1,1)
- 슬롯 **메인 드롭다운** = `MAIN_PRIMARY[슬롯 cost]`의 딜 관련 키. 코스트 변경 시 현재 메인이 무효면 그 코스트 기본값(4코=크피, 그 외=공%)으로 리셋. **부옵은 유지**.
- `costLayout` 변경 시 슬롯을 기본 순서로 **리셋**(멀티셋이 바뀌므로 부옵 포함 초기화).

## 엔진 (계산식 불변, 입력 소스만 변경)
- `sumMainPrimary` → `slots`의 {cost, main} 순회
- `sumEffectiveSubstats`, 공효 부옵 합(`computeEnergyRegen`) → `slots[].substats` 순회
- `secondaryFlat` → `slots`의 코스트 순회 (`MAIN_SECONDARY[cost]`, 결과 동일)
- `perf.ts` / `theory.ts` 계산식은 그대로. **같은 입력이면 같은 딜 수치**가 나와야 한다(회귀 없음).

## UI
- `MainPrimaryTable` + `SubstatInput` 제거 → **"에코 슬롯" 5장 카드** 섹션으로 대체. 카드 = 코스트▾(동적) + 메인▾(코스트 의존) + 부옵 5줄.
- `SubstatSwapCompare`의 `EchoEditor`를 **공용 컴포넌트로 추출**해 입력·비교가 동일 UI를 공유.

## 마이그레이션 / 저장
- `SavedState`에 `slots` 저장(mainPrimary/substats 제거).
- 기존 저장분은 로드 시 1:1 자동 변환: `slots[i] = { cost: COST_LAYOUTS[layout][i], main: mainPrimary[i].type, substats: substats[i] }`. 사용자 입력 보존.

## 범위 밖 (그대로 둠)
- 메인 에코(몬스터)·화음 세트·무기·자유 2세트 선택 → 별도 축, 기존 selector 유지.

## 파급 범위
`mainPrimary`/`substats` 참조부 전부 수정: `context.ts`, `build.ts`, `store.ts`, `SubstatSwapCompare.tsx`, `MainPrimaryTable.tsx`·`SubstatInput.tsx`(교체), 그리고 **모든 엔진 테스트 픽스처**(ctx 생성부). 기존 테스트는 입력만 `slots`로 바꾸고 **기대값 유지**.

## 성공 기준
1. 기존 캐릭터의 딜 수치가 재설계 전후로 동일(기존 테스트 기대값 유지, slots 입력으로 통과).
2. 슬롯별 코스트 드롭다운이 레이아웃 멀티셋을 소진하며 동적으로 좁혀짐.
3. 슬롯 메인이 그 코스트의 유효 옵션으로만 제한됨.
4. 부옵 교체 비교가 선택 슬롯의 코스트/메인/부옵 단위로 일관 동작.
5. 기존 저장 빌드가 로드 시 손실 없이 slots로 변환.
