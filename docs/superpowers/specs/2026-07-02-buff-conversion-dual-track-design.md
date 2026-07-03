# buff_conversion 딜러/서포터 이중 트랙 설계

> ⚠️ **[보관 — 폐기된 설계, 구현 안 됨]** (2026-07-03)
> 이 이중 트랙(딜러/서포터 토글 + 공효 260 도달 제약)은 구현·커밋됐다가 **전면 철회**되었다(커밋 08563d3).
> 대체 결정: 서포터(`buff_conversion` 또는 `matrix_cost === 2`)는 **기록 전용**으로,
> 최고점/크크작 상대 점수·메인 조합 추천 없이 스펙·버프·딜 상승 수치만 표시한다.
> 아래 내용은 히스토리 참고용으로 보관한다.

## 목표
buff_conversion 캐릭터(모니에 등)를 "딜러 세팅 / 서포터 세팅" 중 사용자가 선택하게 하여, 추천(최고점·메인추천·크크작)의 최적화 목표를 트랙별로 분기한다.

## 배경 / 문제
현재 buff_conversion은 `minEnergyRegen`이 항상 `default_required_energy_regen`(예: 260%)을 반환해 **모든** 추천 경로에 "공효 ≥ 필수치" 제약을 무조건 건다. 하지만 buff_conversion 캐릭터도 셀피시 딜러로 굴릴 수 있어 단일 강제는 경직됐다. → 목표를 사용자가 고른다.

## 두 트랙 정의

### 딜러 세팅
- 공효 하한 **없음**. 순수 최종딜(raw perf) 최대화.
- 간섭표기(공효→버프, all_damage_amplify, 파티=본인 포함)는 이미 점수에 반영되므로, 공효를 챙기는 게 딜이 더 높으면 자연히 공효 모드가, 아니면 딜 모드가 추천됨 → perf가 저울질.
- 3코 조합 후보: 전체(속속/속공/공공/공효속/공효공/공효공효)가 **raw 딜 순**으로 정렬 → 상위 3건 표시. ★은 raw 최고.

### 서포터 세팅 (기본값)
- 공효 ≥ 필수치 **최우선** (현행 동작).
- 1순위: 필수치 도달 빌드 중 본인 딜 최고. 2순위(미달 시): 공효 높은 순.
- 3코 조합 후보: 전체가 **rank 순**(도달 우선)으로 정렬 → 공효 모드가 상위 3건 차지, ★은 도달 빌드 중 딜 최고.

## 핵심 통찰 (구현 규모 최소)
이중 트랙은 **`minEnergyRegen`의 반환값 하나**로 갈린다:
- 딜러 → `0` (제약 해제, `rank = raw`)
- 서포터 → `default_required_energy_regen / 100`

`perfPair(raw, rank)` → `rows()`(rank 정렬, raw 표시) → top-3 truncation 파이프라인은 그대로 재사용. `threeCoModeOptions`는 이미 erChar에 전체 6모드를 반환하므로 **변경 불필요**: 정렬 기준(rank)이 트랙에 따라 바뀌면 top-3에 살아남는 모드가 자동으로 달라진다.

## 변경 범위

### 1. 타입 / 컨텍스트
- `CalcContext`에 `buildTrack?: 'dealer' | 'support'` 추가 (미지정 시 'support' 취급).
- 딜 계산(버프 집계)엔 **무영향** — `buildTrack`은 추천/최적화 목표에만 쓰인다.

### 2. 엔진 (theory.ts)
- `minEnergyRegen(ctx)`:
  ```ts
  function minEnergyRegen(ctx: CalcContext): number {
    if (ctx.character.energy_regen_mode !== 'buff_conversion') return 0;
    if ((ctx.buildTrack ?? 'support') === 'dealer') return 0;
    return (ctx.character.default_required_energy_regen ?? 0) / 100;
  }
  ```
- 그 외 함수(theoryBest, mainRecommendation, optimalThreeCoModeKkjak, rows, perfPair 등)는 변경 없음.

### 3. 스토어 + UI
- 스토어 상태에 `buildTrack: 'dealer' | 'support'` 추가, 기본 'support', 영속(기존 selectedMode 패턴 미러).
- 캐릭터 전환 시 'support'로 리셋(또는 selectedMode와 동일한 리셋 규칙).
- UI 셀렉터: **buff_conversion 캐릭터에만** 노출. 활성 모드 셀렉터 옆. 라벨 "딜러 세팅 / 서포터 세팅".
- 비-buff_conversion 캐릭터는 셀렉터 숨김(두 트랙이 동일해 무의미).

## 노출 조건 요약
| 캐릭터 | 셀렉터 | 딜러 | 서포터 |
|---|---|---|---|
| buff_conversion (모니에) | 표시 | 공효 하한 0 | 공효 ≥ 필수치 |
| 그 외 | 숨김 | — | — (minER=0 동일) |

## 테스트
- `minEnergyRegen`: buff_conversion+dealer → 0, buff_conversion+support → required, 그 외 → 0.
- theoryBest: 모니에 dealer 트랙에서 공효 미도달이라도 딜 최고 빌드 선택(제약 없음). support 트랙에서 공효 ≥ 필수치 빌드 선택(회귀 없음, 기존 동작).
- 비-buff_conversion(히유키 등): buildTrack 무관하게 추천 불변.

## 비목표 (YAGNI)
- deal_conversion(시그리카)엔 적용 안 함(공효가 곧 자기 딜이라 트랙 개념 무의미).
- premise 캐릭터에도 적용 안 함.
- 트랙별 별도 저장 슬롯/프리셋 없음(단일 토글).
