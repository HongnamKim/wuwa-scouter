# 코스트 구성 직접 입력 + 완전 일반화 설계

**목표:** 코스트 구성을 고정 프리셋(43311/44111/43111)에서 **직접 입력 가능한 임의 레이아웃**으로 일반화한다. 코스트는 4/3/1만, 합 ≤ 12, 요소 1~5개. 슬롯 수는 코스트 개수에 따라 가변이며, 세트 효과·부옵 예산·자유 2세트 슬롯이 개수 기반으로 동작한다. 딜/최고점은 이미 전수 탐색이라 무변경, **크크작·메인 조합 추천**을 일반화한다(단 43311·44111은 기존 명명 모드 UI 유지).

## 현재 상태 / 문제

- `CostLayout = '43311' | '44111' | '43111'` (유니온). `COST_LAYOUTS`가 각 프리셋을 `Cost[]`(길이 5 고정)로 매핑.
- 코드 전반이 **5슬롯 고정**을 가정: `defaultSlots`/`slotsFrom`(5개), 부옵 예산 25줄(5×5), `freeTwoPieceSlots = floor((5 − maxPieces)/2)`, `kkjakSub`(5슬롯 하드코딩).
- `theory.ts`의 크크작 모드(`KKJAK_MODES`)와 `mainRecommendation`이 프리셋별로 하드코딩됨 → 새 조합마다 수동 추가 필요(43111도 그렇게 추가했음).
- 피드백에서 41111 등 예상 못한 조합이 계속 요구됨.

## 설계

### 1. 데이터 모델 & 검증

- `CostLayout`을 **검증된 문자열**로 완화한다(유니온 제거, `type CostLayout = string`). 캐릭터 데이터 기본값은 여전히 `"43311"` 등.
- 새 헬퍼(`src/engine/costLayout.ts`):
  - `costsOf(layout: string): Cost[]` — `layout.split('').map(Number)`. 곳곳의 `COST_LAYOUTS[x]` 조회를 이걸로 대체.
  - `isValidCostLayout(s: string): boolean` — 길이 1~5, 각 문자 ∈ {'4','3','1'}, 합 ≤ 12.
  - `normalizeCostLayout(s: string): string` — 유효 입력을 **내림차순 정규형**으로(예 `"13431" → "43311"`). 저장·표시·비교는 정규형 사용.
- `COST_LAYOUTS` 상수는 제거하고 `costsOf`로 대체(모든 참조지: theory/echoSlots/build/store/tests). 코스트별 메인 옵션은 기존 `MAIN_PRIMARY[cost]` 그대로(코스트 단위라 무변경).

### 2. 가변 슬롯 (코어)

`슬롯 수 = costsOf(layout).length` (1~5).

- `defaultSlots(layout)` / `slotsFrom(layout, ...)`: 길이 = 코스트 개수.
- 부옵 예산: `theory.ts`의 `subAllocations` 총줄 = **개수 × 5**(기존 25 하드코딩 → `costsOf(layout).length * 5`). `energyRegenLines` 차감 로직 유지.
- `kkjakSub(ctx)`: 5슬롯 하드코딩 배열 → 슬롯 개수만큼 생성(크리 1슬롯·크피 1슬롯·[ER 1슬롯]·나머지 빈 슬롯).
- `freeTwoPieceSlots(echoSets, count)`: `floor((count − maxSetPieces(echoSets[0])) / 2)` (5 → count). 시그니처에 count(또는 layout) 추가.
- `availableCostsForSlot`: 이미 `COST_LAYOUTS[layout]` 기반 → `costsOf(layout)`로 대체하면 가변 길이 자동 대응.

### 3. 세트 효과 게이팅

코스트 개수 < 세트의 요구 피스면 그 세트 효과(버프)는 **잠금**.

- 규칙: 세트 버프 `b.set_pieces`가 있고 `b.set_pieces > count`면 **계산 제외 + 패널에서 잠금 표시**.
- 적용 위치:
  - `buffs.ts`: 세트 버프 집계 시 `set_pieces > count`인 것 필터(계산 제외).
  - `BuffPanel.tsx` 화음세트 탭: 해당 버프를 잠금(비활성 체크박스 + "N세트 (에코 N개 필요)" 안내), 토글 불가.
  - `freeTwoPieceSlots`: count 기반이라 자연히 정합(예 count 4, 주세트 3피스 → floor((4−3)/2)=0).
- 예: `444`(3개) → 5세트·… 잠금, 2/3세트만. `43311`(5개) → 전부 가능.

### 4. 추천 (하이브리드)

- **43311 · 44111**: 기존 `KKJAK_MODES` 명명 모드 + `mainRecommendation`의 2그룹 UI(4코 메인 / 3·4코 조합) **그대로 유지**.
- **그 외 모든 레이아웃(직접 입력, 43111 포함)**: 일반형 경로.
  - 가변 슬롯 = 코스트 3 또는 4인 슬롯. 1코 슬롯은 고정(공%/스케일).
  - 가변 슬롯들의 메인 옵션 조합을 **전수 생성**(`mainOptionsFor(cost)` 활용) → 최고점/크크작 성능순 **상위 N(=3)** 리스트.
  - 라벨 자동 생성: 각 가변 슬롯 메인을 이어붙임(예 "크피·속·공"). 짧은 한글 약어 매핑(크피/크리/공%/속/공효).
  - 크크작 분모: 명명 모드 없이 `kkjakSub`(개수 기반) + **최적 메인 전수**로 계산.
- 분기 지점: `mainRecommendation(ctx)` 시작에서 `NAMED_LAYOUTS = {'43311','44111'}` 포함 여부로 분기. 카드 점수 경로(`optimalThreeCoMode`/`kkjakPerf`)도 일반형 레이아웃이면 명명 모드 대신 전수 크크작 기준을 쓰도록 헬퍼 분리.
- `ThreeCoMode`/`KKJAK_MODES`에서 43111 전용 항목(`sok111`/`gong111`/`er111`)은 제거(일반형으로 흡수). 43311/44111 항목은 유지.
- 딜 계산·`theoryBest`(최고점): 무변경(이미 전수·길이 무관).

### 5. 입력 UX

- `Selectors.tsx` 코스트 드롭다운: `43311`, `44111`, **"직접 입력"** 항목.
  - "직접 입력" 선택 → 인라인 입력칸 노출. 입력값을 `normalizeCostLayout` 후 `isValidCostLayout` 통과 시 `state.costLayout` 갱신. 실패 시 인라인 에러("코스트는 4/3/1, 합 12 이하").
  - 현재 `costLayout`이 프리셋이 아니면 드롭다운이 "직접 입력(43111)"처럼 현재값을 보여줌.
- 코스트 변경 시 기존 로직대로 슬롯 재생성(`defaultSlots`) + 2세트 재계산.

## 컴포넌트 / 파일 영향

| 파일 | 변경 |
|---|---|
| `types/domain.ts` | `CostLayout = string` |
| `engine/costLayout.ts`(신규) | `costsOf`/`isValidCostLayout`/`normalizeCostLayout` |
| `engine/constants.ts` | `COST_LAYOUTS` 제거(→ costsOf) |
| `engine/loadData.ts` | `cost_layout` 검증을 `in COST_LAYOUTS` → `isValidCostLayout(c.cost_layout)`로 교체 |
| `engine/echoSlots.ts` | `defaultSlots`/`slotsFrom`/`availableCostsForSlot`/`freeTwoPieceSlots` 가변화 |
| `engine/theory.ts` | 부옵 예산·`kkjakSub` 개수화, 하이브리드 분기 + 일반형 추천/크크작, 43111 모드 제거 |
| `engine/buffs.ts` | 세트 버프 `set_pieces > count` 필터 |
| `state/store.ts` | `COST_LAYOUTS` 참조 제거, count 전달 |
| `components/Selectors.tsx` | 직접 입력 UI |
| `components/BuffPanel.tsx` | 세트 효과 잠금 표시 |
| `components/EchoSlots.tsx` | (availableCostsForSlot 경유, 대체로 자동) |
| tests | costLayout 헬퍼, 가변 슬롯 부옵/추천, 세트 게이팅, 회귀(43311/44111 값 불변) |

## 테스트 (성공 기준)

1. **검증**: `isValidCostLayout` — 43311/41111/444/4431 통과, 44411(17)·2 포함·6자리 거부. `normalizeCostLayout('13431')==='43311'`.
2. **회귀 불변**: 43311·44111 기존 캐릭터의 딜·최고점·크크작·MainReco 값이 변경 전과 동일(스냅샷).
3. **가변 부옵**: `444`(3슬롯) 최고점의 부옵 총줄 = 15, 세트 게이팅으로 5세트 버프 미적용.
4. **세트 게이팅**: count 4에서 set_pieces 5 버프가 계산 제외 + 패널 잠금.
5. **일반형 추천**: 임의 레이아웃(예 `4431`)에서 `mainRecommendation`·크크작·카드 점수가 크래시 없이 상위 N 리스트 반환.

## 결정된 사항 (요약)

- 코스트: 4/3/1만, 합 ≤ 12, 요소 1~5개. 개수 = 슬롯 수.
- 세트 효과: `set_pieces > 개수`면 잠금(계산·표시 제외).
- 추천: 43311·44111만 명명 모드 UI 유지, 나머지는 전수 상위 N 일반형.
- 잠금은 클라이언트 UX(백엔드 아님) — 본 기능과 무관.

## 범위 밖 (YAGNI)

- 코스트 개수 6 이상, 4/3/1 외 코스트, 합 12 초과 허용.
- 명명 모드를 임의 레이아웃까지 확장(라벨 자동 생성으로 충분).
- 저장 데이터 마이그레이션: 기존 저장값은 프리셋 문자열이라 그대로 유효.
