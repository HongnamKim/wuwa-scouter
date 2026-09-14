# 데이터 대조 오류 수정 계획

**목표:** 린네 피해 보너스와 v2 점검에서 확인된 데이터·계산 오류를 수정한다.
**근거:** 사용자 수정 요청, `docs/buff-recording-rules-v2.md` §11.
**범위:** JSON 형식과 기존 ID를 유지한다. v1 문서는 변경하지 않는다. 불확실한 게임 해석은 별도 확인 항목으로 남긴다.

## 1. 데이터 및 자체 집계

- [x] `tests/engine/data-corrections.test.ts`에 린네 버프 전후 피해 비율, 깃털 세트의 공명 효율 기반 공격력, 루실라 크리티컬 피해의 수혜자 유형, 수수 공격력 상한 테스트를 추가하고 실패를 확인한다.
- [x] `src/data/characters.json`, `src/data/weapons.json`의 원문으로 확인된 항목만 수정한다. 기록 전용 효과는 개별 효과·배율을 보존한다.
- [x] `src/types/data.ts`, `src/engine/buffs.ts`에 수혜자 피해유형 제한을 명시하고 자기 동적 공격력 집계 누락을 수정한다. 기존 제공자 발동 조건은 유지한다.

## 2. 파티 전달 및 표시

- [x] `tests/state/party-buffs.test.ts`에서 저장된 구원 빌드의 크리티컬 50/60/65%, 미저장 빌드, 제공자와 다른 수혜자 스탯, 토글 비활성을 검증한다.
- [x] `src/state/store.ts`에서 `crit_scale`을 제공자 스탯으로 계산하고 수혜자 조건을 전달한다. UI 현재값과 계산값이 같은 함수를 사용하도록 한다.
- [x] `src/components/BuffPanel.tsx`, `src/components/PartyTab.tsx`의 수혜자 피해유형 필터를 계산 경로와 맞춘다.

## 3. 검증 및 문서

- [x] 다음 명령으로 변경된 테스트가 통과함을 확인한다.

```sh
npm test -- --exclude '**/.claude/**' tests/engine/data-corrections.test.ts tests/state/party-buffs.test.ts
```

- [x] `docs/data-authoring.md`, `docs/buff-recording-rules-v2.md`에서 과거 조사와 이번 수정 결과를 구분하고 해결·보류 상태 및 근거를 갱신한다.
- [x] 현재 작업 트리의 전체 테스트와 빌드를 실행한다.

```sh
npm test -- --exclude '**/.claude/**'
npm run build
git diff --check
```

- [x] 코드 리뷰로 데이터 의미·기존 토글 호환·순환 계산·표시와 집계 차이를 점검한다. 커밋은 하지 않는다.

## 실행 결과

- 회귀 테스트는 수정 전에 실패를 확인했고 수정 후 16개가 통과했다.
- 전체 27개 파일 / 140개 테스트 통과. TypeScript 검사·Vite 빌드·`git diff --check` 통과.
- 리뷰에서 발견한 모니에 파티 버프 인덱스 호환 문제를 저장 버전 변환으로 수정하고 재검토했다.
- 기존 v1 문서의 SHA-256은 `2fae6f16bf8c7906b44e24475b01c7a24f47416c2d3c34d9b077587f89634326`로 동일하다.
- 산안개 전달 순서, 혼합 피해의 한정 크리티컬 분배, 기존 ID/미등록 대상 등 남은 범위는 v2 §11에 명시했다.
