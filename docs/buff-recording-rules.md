# 버프 기록 규칙 (캐릭터 · 무기 · 에코 · 화음 세트)

원본 스킬/옵션 텍스트를 데이터의 `Buff` 객체로 옮길 때의 판정 기준. 근사 트랙(딜 근사) 점수의 정합성을 위해 반드시 이 규칙을 따른다.

> 용어 메모: 이 문서는 약어를 쓰지 않는다. "방어력 무시"(방무 아님), "속성 저항 무시"(저무 아님), "크리티컬 피해"(크피 아님), "크리티컬 확률"(크율 아님), "고정 공격력"(깡공 아님)처럼 항상 풀어서 쓴다. 나중에 약어 뜻을 몰라 헤매는 일을 막기 위함이다.

---

## 작업 절차 (캐릭터 본문 → 데이터)
사용자가 캐릭터/무기/에코/세트 **본문(스킬 텍스트)** 을 주면, **바로 데이터를 고치지 않는다.** 먼저 아래 표로 **추출 계획**을 제시하고 **확인받은 뒤** 작업한다.

1. 본문에서 뽑아낼 항목을 **표**로 정리 — 열: `출처(스킬/공명체인)·조건` / `type` / `value` / `mode` / `min_ascension` / `record_only·absolute_score_only` / `기본체크(default_on)` / (신규·유지·수정 여부).
2. **애매하거나 판단이 갈리는 항목은 따로 분리**해 질문한다(예: 특정 스킬 배율인지 유형 부스트인지, 취약 해석, 이상효과 크리 등).
3. 사용자 확정 후에야 데이터·엔진 수정에 들어간다.
4. 수정 후 tsc·테스트·프리뷰 검증 → **커밋 전 diff를 보여주고 확인**받는다(특히 데이터). worktree 커밋도 자동으로 하지 않는다.

(예시: 이 문서 개정 이력의 에이메스 재점검 방식 — 17행 표 + 결정 필요 항목 분리 후 진행)

---

## 0. 대전제

1. **모든 버프는 빠짐없이 기록한다.** 내가 못 받는 버프(`next_character`, 파티 전용), **이상효과(조화파동/불꽃효과/서리효과 등) 관련 수치**, **특정 스킬 배율**도 데이터엔 남긴다 — 향후 파티/매트릭스 기능용. "기록 여부"와 "점수 반영 여부"는 별개다. 점수에서 빠지는 것(record_only, 이상효과 SCORE_HIDDEN)이라고 **생략하지 않는다**.
2. **점수에 반영하는 건 "에코에서 얻을 수 있는 스탯"과 관련된 버프만.** 자력 스탯 보유량이 에코 옵션의 한계효율을 바꾸는지 파악하는 게 점수의 목적이라, 그와 무관한 건 반영하지 않는다.
3. **두 지표를 구분한다** (딜 공식에서 유래):
   ```
   딜 ∝ 공격력 × (1+증가버킷) × (1+부스트버킷) × 크리티컬기대값 × 방어력무시·속성저항무시배수
   ```
   - **딜상승수치** = raw 통합 성능. 부스트·방어력 무시 등이 바뀌면 값이 바뀐다.
   - **상대 점수** = 이론최고/크크작 대비 **비율**. 공통 곱연산(부스트·방어력 무시·속성 저항 무시·취약)은 분자·분모에서 **약분**되어 상대 점수엔 영향이 없다.
4. **원문 단어 그대로 옮긴다. 추정 금지.** "증가"면 `_bonus`, "부스트/증폭"이면 `_amplify`.

---

## 1. 필수 필드 (모든 skill_node 버프)

아래 필드는 **모든 버프에 항상 명시**한다. 생략하지 않는다.

| 필드 | 규칙 |
|---|---|
| `type` | StatKey 어휘 중 하나 (§3) |
| `value` | 소수(0.12 = 12%). 고정 스탯만 정수 |
| `always` | 상시=true, 조건부=false |
| `target` | `self` / `party` / `next_character` — **생략 금지**(self여도 명시). loadData가 검증 |
| `min_ascension` | 돌파(공명 체인) 조건. 조건 없으면 `0`. **생략 금지**. loadData가 검증 |
| `record_only` | `true` / `false` **모든 버프에 명시** (§2). 생략하지 않는다 |
| `absolute_score_only` | `true` / `false` **모든 버프에 명시** (§2). 생략하지 않는다 |
| `id` | 조건부(토글) 버프면 필수. 상시 패시브는 불필요 |
| `label` + `short` | `label`을 넣으면 `short`도 함께(간략 표기용). `{v}`는 현재 수치로 치환 |

- `record_only`와 `absolute_score_only`는 **동시에 true가 될 수 없다**(상호 배타). 둘 다 false이거나, 한쪽만 true.
- 무기 버프 추가 필드: `refinement_values`(공진 1~5별 수치 5개), `base_stats`(무기 자체 스탯).
- 에코 세트 버프 추가 필드: `set_pieces`(1|2|3|5).

---

## 2. 점수 반영 결정 — 두 플래그의 4가지 조합

모든 버프는 `record_only`와 `absolute_score_only`를 true/false로 갖는다. 판단 순서:

**먼저 "에코에서 얻을 수 있는 스탯인가?"** (크리티컬 확률·크리티컬 피해·공격력%·속성 피해 증가·유형 피해 증가·고정 스탯·공명 효율)

```
[에코에서 얻는 스탯인가?]
│
├─ YES → 점수 반영
│   ├─ 증가(bonus)·크리티컬·공격력% 등 (비율에서 약분 안 됨)
│   │       → record_only: false, absolute_score_only: false
│   └─ 부스트(amplify)·방어력 무시·속성 저항 무시·취약 (비율에서 약분됨)
│           → record_only: false, absolute_score_only: true
│        ※ 단독/특정 스킬에 걸려도, 스탯 자체가 에코 스탯이면 여기(반영 유지).
│          예: "독심 크리티컬 피해 +500%", "오버라이드 크리티컬 피해 +100%"
│              → critical_damage, record_only: false, absolute_score_only: false
│
└─ NO → 점수 미반영
    ├─ 특정 스킬의 피해 배율(모션 밸류) 자체 변경
    │       → skill_motion_value_*,  record_only: true, absolute_score_only: false
    │    예: 에이메스 "종결 피해 +25%", 루크 "특정 3스킬 받는 피해 +30%", 루크 "공중공격 +150%"
    ├─ 이상효과 (별도 스케일)
    │       → anomaly_*,  record_only: false, absolute_score_only: false (타입 자체가 SCORE_HIDDEN)
    └─ 조화도 관련 (조화도 파괴 증폭 / 조화 밀집·파동 대응 등)
            → harmony_break_amplify 등,  record_only: true (기록만, 계산·표시 제외)
```

### 플래그 조합별 동작

| record_only | absolute_score_only | 계산(딜상승) | 상대 점수 | 패널/스펙 표시 | 대상 |
|:---:|:---:|:---:|:---:|:---:|---|
| false | false | O | O | O | 에코 스탯 · 증가/크리티컬/공격력 |
| false | true | O (딜상승 반영) | 약분(무영향) | O (표식 없음) | 부스트·방어력 무시·속성 저항 무시·취약 |
| true | false | X | X | X (완전 숨김) | 특정 스킬 배율·에코로 못 얻는 한정 효과 |
| true | true | — | — | — | **금지 조합** (상호 배타) |

이상효과(`anomaly_*`)는 두 플래그가 모두 false여도 **타입 자체가 SCORE_HIDDEN**이라 계산·표시에서 빠진다. **조화도 관련(`harmony_break_amplify` 등 조화도 파괴·조화 밀집/파동 대응)은 `record_only: true`로 기록**한다(계산·표시 제외, 데이터엔 남김).

### 핵심 구분: "특정 스킬 한정"의 두 갈래

- 스탯이 **에코 스탯**(크리티컬 피해·공격력% 등)이면 → 단독 스킬이어도 **반영**(record_only: false).
- 스탯이 **그 스킬의 피해 배율 자체**(종결 피해, 특정 스킬명 받는 피해)이면 → **record_only: true + skill_motion_value_***.
- "일반공격 적용"이라도 **특정 스킬 이름으로 한정**되면 일반적 유형 버프가 아니라 배율 한정 → record_only: true. (범위가 모든 일반공격이면 basic_attack_* 로 반영)

---

## 3. type 결정 규칙

### 증가 vs 부스트 (원문 단어)
- **"증가"** → `_bonus` (합연산 버킷). 예: 속성 피해 증가 = `element_damage_bonus`
- **"부스트 / 증폭 / more DMG / increased DMG"** → `_amplify` (곱연산 버킷)

### ⭐ 피해유형은 "카테고리"가 아니라 "적용되는 피해유형" 기준 (최우선 규칙)
버프/스킬의 유형을 정할 때 **공격의 카테고리(일반/강/스킬/해방/에코)가 아니라, 그 공격이 실제로 적용받는 피해유형**을 본다.
- 스킬 설명에 **"해당 (스킬) 피해는 X 피해로 적용된다"** 가 있으면 그 X를 따른다.
- 그런 명시가 **없으면** 카테고리 그대로 쓴다(강공격→`heavy_attack`, 공명스킬→`resonance_skill` 등).
- 예: 에이메스 **강공격·차지 2단계**는 "공명 해방 피해로 적용된다" → 카테고리는 강공격이지만 유형은 **`resonance_liberation`**.

### 속성 vs 유형 (뭉치지 말 것)
- **속성 피해** = 회절·용융·인멸·응결·전도·기류 → `element_damage_bonus/amplify` (+ `element` 필드)
- **유형 피해** = 일반/강/스킬/해방/에코 → `basic_attack` / `heavy_attack` / `resonance_skill` / `resonance_liberation` / `echo_skill` 접두사 (단, 위 ⭐ 규칙대로 실제 적용 피해유형 우선)
- **전체 피해**(입히는 피해, 속성/유형 무관) = `all_damage_amplify`. ⚠️ "전체 **속성** 피해 보너스"(= 증가 버킷)와 구분.

### "받는 피해 증가"(취약) = 부스트로 해석
- **"~가 받는 [X] 피해가 n% 증가"** / "takes n% more(increased) DMG" 형태는 단어가 **"증가"여도 부스트(`_amplify`)** 로 기록한다. (곱연산 취약이라 받는 피해 다중 배수)
- 예: "목표가 받는 에이메스의 공명 해방 피해가 40% 증가" → `resonance_liberation_amplify` 0.40 (absolute_score_only).
- ⚠️ "증가=_bonus" 일반 규칙의 예외. "내" 피해 증가(자버프)는 그대로 _bonus.

### StatKey 어휘 전체
```
크리티컬       : critical_rate(크리티컬 확률), critical_damage(크리티컬 피해)
스케일 %       : attack_percent, hp_percent, defense_percent
고정 스탯      : flat_attack(고정 공격력), flat_hp(고정 체력), flat_defense(고정 방어력)
기타           : energy_regen(공명 효율), healing_bonus(치유 효과)
증가(합연산)   : element_damage_bonus, basic_attack_bonus, heavy_attack_bonus,
                 resonance_skill_bonus, resonance_liberation_bonus, echo_skill_bonus
부스트(곱연산) : element_damage_amplify, all_damage_amplify, basic_attack_amplify,
                 heavy_attack_amplify, resonance_skill_amplify, resonance_liberation_amplify, echo_skill_amplify
특정 스킬 배율 : skill_motion_value_bonus, skill_motion_value_amplify   (record_only: true 전제)
이상효과       : anomaly_damage_amplify, anomaly_damage_additional      (SCORE_HIDDEN)
조화도 파괴    : harmony_break_amplify                                  (조화도 관련은 record_only: true로 기록)
배수형         : damage_type_bonus_factor                              (유형 보너스 합 ×(1+값))
방어/저항      : defense_ignore(방어력 무시), element_resistance_ignore(속성 저항 무시)
```

### 특수 타입
- `damage_type_bonus_factor`: "모든 출처 [유형] 피해 보너스 ×N 상승"처럼 **증가 버킷에 곱해지는 배수**. value 0.4 → ×1.4. (예: 레베카 6돌). 증가 버킷을 키우므로 **점수 반영**(두 플래그 모두 false).
- `anomaly_damage_additional`: 받는 피해 부스트가 아니라 이상효과를 1회 더 입힘. value=이상효과 배율.
- **스탯 변환 메커니즘**(예: 시그리카 공명 효율→에코 피해)은 버프가 아니라 `special_mechanism`(mechanisms.ts)에서 처리. 곱연산 버프는 절대 여기 넣지 않는다.

---

## 4. target 규칙

- `self`: 본인. 계산·표시 O
- `party`: 파티 전체(본인 포함). 본인도 받으므로 계산·표시 O
- `next_character`: 다음 등장 캐릭터 전용(반주 등). 본인은 못 받으므로 **계산 제외 + 패널 숨김**, 데이터엔 기록(팀 제공 버프 기록용)

---

## 5. 부가 규칙

- **element 필드**: 속성 지정 버프에 붙이면 캐릭터 element와 일치할 때만 활성. `element_resistance_ignore`(속성 저항 무시)도 element로 어느 속성인지 지정.
- **mode 필드**: 모드 전환 캐릭터(루실라 서리/에코 등). 지정 모드 선택 시에만 활성/노출.
- **refinement_values**: 무기 버프. 공진(재련) 1~5별 수치 5개. 지정 시 `refinement_values[공진-1]`로 value 대체.
- **min_ascension 미달**: 버프 잠금(체크 불가), 계산 제외. 패널엔 회색으로 노출.
- **default_on**(true/false): 조건부 버프의 체크박스 기본 상태. 미지정 시 true. 모든 조건부 버프에 명시.
- **default_on_from_ascension**(숫자): 해당 돌파(공명 체인) 이상일 때만 기본 체크, 미만이면 기본 해제(잠금 아님, 토글 가능). `default_on`과 함께 쓰지 않는다(있으면 이쪽 우선). 예: 파티/돌파에 따라 자력 스택 상한이 달라지는 버프.

### 스택형 버프 기록 방식
- 원칙: **단일 버프 1개**로 기록. `value = 스택당(n) × 최대스택(m)`, `note`에 "스택당 n%, 최대 m스택".
- 예외: 자력으로 채울 수 있는 **스택 상한이 파티원/돌파에 따라 달라지는** 경우 → 스택별로 분리하고 `default_on_from_ascension`으로 돌파별 기본 체크를 제어(예: 에이메스 "별과 별 사이").

### 이상효과 크리 (원래 없던 크리가 특정 조건에서 생기는 경우)
- 이상효과 딜엔 본래 크리티컬/크리티컬 피해 계수가 없다. 특정 돌파에서 "이상효과 피해가 크리티컬 발생 가능, 크리 n%·크리피 m% 고정" 식으로 **새로 생기면** critical_rate/critical_damage **증가로 간주**해 기록한다.
- 단, 이상효과 딜 한정이라 근사 점수 밖 → **record_only: true**(기록만, 계산·표시 제외). note로 어떤 이상효과(조화파동/불꽃효과 등) 한정인지 명시.

---

## 6. 표시 규칙 (현재 스펙 표)

부스트는 종류별로 분리해서 보여준다 (사용자 혼동 방지):
- 속성 부스트(`element_damage_amplify`) → **속성 피해 행**에 `(부스트 +N%)`
- 캐릭 유형 부스트(`[유형]_amplify`) → **유형 피해 행**에 `(부스트 +N%)`
- 전체 부스트(`all_damage_amplify`) → **전체 피해 부스트** 별도 행
- `record_only: true` / SCORE_HIDDEN / `next_character` → 표시 안 함

---

## 부록: 실제 분류 예시

| 원문 | type | record_only | absolute_score_only | 이유 |
|---|---|:---:|:---:|---|
| 공명해방 피해 +25% 증가 | resonance_liberation_bonus | false | false | 유형 증가, 에코 스탯 |
| 회절 피해 +65% (강화 후) | element_damage_bonus | false | false | 속성 증가, 에코 스탯 |
| 강공격 피해 +40% 부스트 (루시 6돌) | heavy_attack_amplify | false | true | 유형 부스트, 약분 |
| 목표가 받는 공명해방 피해 +40% (취약) | resonance_liberation_amplify | false | true | 취약=부스트, 약분 |
| 전체 피해 +25% 부스트 (백도어) | all_damage_amplify | false | true | 전체 부스트, 약분 |
| 방어력 무시 15% (거츠) | defense_ignore | false | true | 방어력 무시, 약분 |
| 독심/납도 크리티컬 피해 +500% | critical_damage | false | false | 단독 스킬이나 크리티컬 피해=에코 스탯 → 반영 |
| 종결 피해 +25% 부스트 (에이메스) | skill_motion_value_amplify | true | false | 특정 스킬 배율, 에코로 못 얻음 |
| 햇무리참살 등 3스킬 받는 피해 +30% | skill_motion_value_amplify | true | false | 특정 스킬 한정 배율 |
| 공중공격 시 피해 +150% (루크 1돌) | skill_motion_value_amplify | true | false | 상황 한정, 에코로 못 얻음 |
| 냉해효과 피해 +30% 부스트 | anomaly_damage_amplify | false | false | 이상효과 별도 스케일(타입으로 숨김) |
| 조화도 파괴 증폭 +10pt | harmony_break_amplify | true | false | 조화도 관련은 record_only로 기록 |
| 모든 일반공격 피해 보너스 ×1.4 (레베카 6돌) | damage_type_bonus_factor | false | false | 증가 버킷 배수, 반영 |
| 반주: 다음 캐릭터 전체 피해 +15% (target: next_character) | all_damage_amplify | false | true | 기록만, 본인 미수혜 |
