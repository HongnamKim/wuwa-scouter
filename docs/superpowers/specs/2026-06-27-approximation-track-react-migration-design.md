# 근사 트랙 React 마이그레이션 — 설계 문서

> 검증된 단일 HTML 프로토타입(`index.html`)의 근사 트랙 계산기를 React + Vite 앱으로 옮기고, 캐릭터·무기·에코세트 데이터를 JSON으로 분리해 새 공명자 추가가 **데이터 입력만으로** 가능하도록 일반화한다.

## 1. 목표와 범위

### 1.1 목표
- 현재 프로토타입(히유키 단일, 근사 트랙)을 정식 React 앱으로 이전한다.
- 캐릭터·무기·에코세트의 가변 데이터를 JSON 3종으로 분리한다.
- 계산 엔진을 React에서 분리해 **검증된 수치를 단위 테스트로 고정**한다.
- 새 공명자/무기/세트는 JSON 항목 추가만으로 등장하도록 구조를 일반화한다.

### 1.2 범위에 포함
- 근사 트랙 계산(통합 성능 기반): 두 점수(이론 최고 대비·크크작 대비), 메인 조합 추천, 부옵 자유 비교, 표시 스펙.
- 캐릭터/무기/4코 메인 에코/에코세트 **선택 UI** (JSON 구동).
- 상시/조건부/수동 버프 모델.

### 1.3 범위에서 제외 (YAGNI)
- 백엔드, 로그인, 서버 저장 (기획 Phase 0).
- 정밀 트랙(절대 데미지), 파티 버프, 매트릭스, OCR (Phase 2+).
- 표본 기반 상대 점수(독립 트랙).
- **실데이터는 검증된 히유키 + 그 무기/세트만 채운다.** 미검증 캐릭터는 넣지 않는다. 구조는 일반화하되 데이터는 1건.

### 1.4 성공 기준
- 새 앱이 프로토타입과 **동일한 수치**를 낸다 (아래 검증 수치 테스트 통과).
- `characters.json`에 항목을 하나 추가하면(데이터만) 캐릭터 선택지에 등장하고 계산이 돈다.

## 2. 기술 스택 / 코드 구조

- **React + Vite + TypeScript**, 계산 엔진은 프레임워크 무관 순수 TS로 분리(구조 A).

```
src/
  types/         도메인 타입 (union/enum + 인터페이스). 데이터 계약의 단일 출처
    domain.ts      BuffType, StatKey, Element, ScaleStat, DamageBonusType, EnergyRegenMode, CostLayout 등 union
    data.ts        Character, Weapon, EchoSet, Buff, MainSlotEcho 인터페이스
  engine/        순수 계산 함수 (React 무관, 단위 테스트 대상)
    constants.ts   게임 공통 상수 (부옵 단계값, 메인 옵션 수치, 코스트 레이아웃, secondary 깡공, 기본 크리/크피)
    buffs.ts       상시/조건부/수동 버프 집계 (출처 무관 공통 로직)
    perf.ts        통합 성능, 표시 스펙
    theory.ts      이론 최고 / 크크작 / 메인 조합 추천 / 부옵 비교
    index.ts       엔진 진입점
    loadData.ts    JSON 로드 + 타입 검증/단언
  data/
    characters.json
    weapons.json
    echo-sets.json
  components/    React UI (.tsx)
  state/         선택 상태 (캐릭터/무기/메인에코/세트/부옵/버프 토글/수동버프)
  App.tsx
tests/           엔진 단위 테스트 (검증 수치 고정)
index.html
```

엔진은 입력으로 "조합된 계산 컨텍스트"(캐릭터·무기·세트·메인에코·부옵·버프 상태)를 받아 순수 함수로 결과를 낸다. React는 상태를 들고 엔진을 호출만 한다.

### 2.1 데이터 타입 제약 (엄격)
데이터의 키와 제약된 문자열 값은 **타입으로 강제**한다. 오타·잘못된 키/값은 컴파일(또는 로드 검증)에서 잡는다.

- **union 타입으로 값 제한 (enum 역할):**
  - `BuffType` = 3.2의 전 어휘 union (`'critical_rate' | 'critical_damage' | ... | 'resonance_skill_bonus'`)
  - `StatKey` = 부옵/베이스 스탯 키 union
  - `Element` = `'응결' | ...` (현재 응결만, 확장 union)
  - `ScaleStat` = `'attack' | 'hp' | 'defense'`
  - `DamageBonusType` = `'basic_attack' | 'heavy_attack' | 'resonance_skill' | 'resonance_liberation' | null`
  - `EnergyRegenMode` = `'premise' | 'deal_conversion'`
  - `CostLayout` = `'43311' | '44111'`
- **인터페이스로 키 제한:** `Buff`(상시/조건부 판별 union), `Character`, `Weapon`(`base_stats`는 `Partial<Record<StatKey, number>>`이되 `attack` 필수), `EchoSet`, `MainSlotEcho`.
- **JSON 로드:** `resolveJsonModule`로 import 후 `loadData.ts`에서 인터페이스로 단언 + 경량 런타임 검증(알 수 없는 `type`/`element` 값 거부). JSON 자체는 enum을 못 막으므로 로드 검증이 마지막 방어선.
- **향후:** 이 데이터를 RDB로 이관할 때 enum/FK 제약이 값 유효성을 DB 차원에서 강제하므로, 지금의 JSON + 로드 검증은 합리적 중간 단계다.

## 3. 데이터 모델 (JSON 3종)

### 3.1 공통 버프 객체
세 출처(캐릭터 스킬노드/4코 메인에코, 무기, 에코세트)와 수동 버프가 **동일한 버프 객체**를 쓴다. 엔진의 집계 로직은 출처를 구분하지 않는다.

```jsonc
// 상시(기본버프): 항상 적용, 토글 없음
{ "type": "element_damage_bonus", "value": 0.12, "always": true, "note": "패시브" }

// 조건부버프: 토글 on/off (기본 on)
{ "type": "critical_rate", "value": 0.25, "always": false,
  "id": "set_5pc_critical", "label": "크리티컬 +25% (5세트)" }

// 속성 일치 버프: 캐릭터 element와 일치할 때만 적용
{ "type": "element_damage_bonus", "value": 0.10, "always": true, "element": "응결" }
```

필드:
- `type` (필수): 버프 종류. 아래 어휘.
- `value` (필수): 소수(0.12 = 12%). 깡스탯은 정수.
- `always` (필수): `true`=상시, `false`=조건부.
- `id`, `label` (조건부일 때): 토글 식별자/표시.
- `element` (선택): 지정 시 캐릭터 element와 일치할 때만 적용.
- `set_pieces` (선택, 에코세트 버프 전용): `1` | `2` | `3` | `5`. 세트 단계 표시/그룹핑용.
- `note` (선택): 사람용 메모. 계산 무관.

### 3.2 버프 `type` 어휘 (서술형, 축약 금지)
**증가 계열 (합연산):**
`critical_rate` · `critical_damage` · `attack_percent` · `element_damage_bonus` · `resonance_liberation_bonus`

**부스트 계열 (곱연산 / DMG Amplify):**
`element_damage_amplify` · `all_damage_amplify` · `basic_attack_amplify` · `heavy_attack_amplify` · `resonance_skill_amplify` · `resonance_liberation_amplify`

**부옵 전용 키 (무효옵 포함):**
`flat_attack` · `hp_percent` · `flat_hp` · `defense_percent` · `flat_defense` · `energy_regen` · `basic_attack_bonus` · `heavy_attack_bonus` · `resonance_skill_bonus`

**저항/방어 항 (근사 트랙에서 약분 → 통합 성능 무영향, 데이터만 보관):**
`defense_ignore`(방어력 무시/방무) · `energy_regen`(전제형 한정 무영향)

> 이 항목들은 정밀 트랙(Phase 2)에서 쓰인다. 근사 트랙 엔진은 집계는 하되 통합 성능 계산엔 반영하지 않는다.

> 피해보너스 증가 유효옵은 캐릭터의 `damage_bonus_type`에 따라 결정된다. 히유키는 `resonance_liberation` → 부옵 `resonance_liberation_bonus`만 유효, 나머지 스킬타입 피해 부옵은 무효옵.

### 3.3 characters.json
```jsonc
{
  "id": "hiyuki",
  "name": "히유키",
  "element": "응결",
  "scale_stat": "attack",                 // attack / hp / defense
  "base_attack": 462,                     // 90레벨 기본 (scale_stat 기준값)
  "effective_substats": ["critical_rate", "critical_damage", "attack_percent",
                          "resonance_liberation_bonus", "flat_attack"],
  "damage_bonus_type": "resonance_liberation",  // 쏠림 유형. null이면 4종 통합
  "energy_regen_mode": "premise",         // premise(공효 3줄 차감) / deal_conversion(시그리카형)
  "recommended_echo_sets": ["kido"],      // 추천 세트(우선순위 순)
  "recommended_weapons": ["frostbound_flame", "millennium_eddy"],

  "skill_node": [                         // 스킬 노드로 상시 오르는 스탯
    {"type": "critical_rate",  "value": 0.08, "always": true, "note": "스킬 노드"},
    {"type": "attack_percent", "value": 0.12, "always": true, "note": "스킬 노드"}
  ],

  "main_slot_echo": [                      // 4코 메인 에코 선택지. 첫 항목이 기본
    {
      "id": "void_god_echo",
      "name": "공명의 메아리 · 명식 · 허무의 신",
      "buffs": [
        {"type": "element_damage_bonus",       "value": 0.12, "always": true, "note": "패시브"},
        {"type": "resonance_liberation_bonus", "value": 0.12, "always": true, "note": "패시브"}
      ]
    }
  ]
}
```

- `skill_node`: 스킬 노드 상시 스탯(크리 8%·공% 12%).
- `main_slot_echo`: 4코 메인 에코 후보 배열. 각 에코가 자기 패시브/조건부 버프 보유. UI에서 선택, 미선택 시 첫 항목 적용.
- 기본 크리 5% / 기본 크피 150% 는 전 캐릭터 공통 → 엔진 상수(`constants.js`), JSON에 없음.

### 3.4 weapons.json
무기는 **기본 스탯이 2개**다: 공격력(스케일 베이스) + 보조 주스탯(크리·크피·공효 등). 이를 `base_stats` 맵에 담는다. 그 외 무기 패시브는 `buffs`로 둔다.

```jsonc
// 히유키 전용 무기
{
  "id": "frostbound_flame",
  "name": "서린 불꽃",
  "base_stats": {
    "attack": 587,
    "critical_rate": 0.243
  },
  "buffs": [
    {"type": "attack_percent",        "value": 0.12, "always": true, "note": "무기 패시브"},
    {"type": "element_damage_amplify", "value": 0.28, "always": false, "element": "응결",
     "id": "weapon_glacio_amplify", "label": "응결피해 +28% 부스트 (조건부)"},
    {"type": "defense_ignore",        "value": 0.10, "always": false,
     "id": "weapon_def_ignore", "label": "방어력 무시 +10% (조건부)"}
  ]
}

// 테스트용 무기 (무기 교체 검증용)
{
  "id": "millennium_eddy",
  "name": "천년의 회류",
  "base_stats": {
    "attack": 588,
    "critical_rate": 0.243
  },
  "buffs": [
    {"type": "energy_regen",   "value": 0.128, "always": true,  "note": "무기 패시브(상시)"},
    {"type": "attack_percent", "value": 0.12,  "always": false,
     "id": "weapon_atk_stack", "label": "공격력 +12% (조건부)"}
  ]
}
```
- `base_stats`: 공격력은 ATK 베이스에 가산, 그 외 키(크리·크피·공%·공효 등)는 해당 항에 상시 가산.
- 무기 선택 시 `base_stats`와 `buffs`가 함께 바뀐다.
- `energy_regen`(공효)은 전제형 캐릭터 데미지 식에 들어가지 않음 → 데이터엔 있되 통합 성능엔 영향 없음(현실 반영).

### 3.5 echo-sets.json
세트 효과의 단계(2세트/5세트)는 `note`가 아니라 별도 프로퍼티 `set_pieces`(2 | 5)로 담는다.

```jsonc
{
  "id": "kido",
  "name": "소리 없이 내려앉은 기도의 눈",
  "buffs": [
    {"type": "element_damage_bonus", "value": 0.10, "set_pieces": 2, "always": true,
     "element": "응결"},
    {"type": "element_damage_bonus", "value": 0.10, "set_pieces": 5, "always": false,
     "element": "응결", "id": "set_5pc_element", "label": "응결피해 +10% (5세트)"},
    {"type": "critical_rate", "value": 0.25, "set_pieces": 5, "always": false,
     "id": "set_5pc_critical", "label": "크리티컬 +25% (5세트)"}
  ]
}
```
- `set_pieces`: 에코세트 버프에만 존재(무기·캐릭터 버프엔 없음). 단계는 `1 | 2 | 3 | 5`. 통상 1·2·3세트=상시 스탯, 5세트=조건부 발동이지만 `always`로 별도 표현(set_pieces와 독립). UI 그룹핑/표시에 활용.

### 3.6 게임 공통 상수 (engine/constants.ts, JSON 분리 안 함)

**부옵 단계표 (실측, 단위 %)** — 프로토타입의 `range()` 근사를 대체:
| 부옵 키 | 단계값 |
|---|---|
| `critical_rate` | 6.3, 6.9, 7.5, 8.1, 8.7, 9.3, 9.9, 10.5 |
| `critical_damage` | 12.6, 13.8, 15, 16.2, 17.4, 18.6, 19.8, 21 |
| `energy_regen` | 6.8, 7.6, 8.4, 9.2, 10, 10.8, 11.6, 12.4 |
| `defense_percent` | 8.1, 9, 10, 10.9, 11.8, 12.8, 13.8, 14.7 |
| `attack_percent` · `hp_percent` · 유형별 피해보너스(`basic_attack_bonus`·`heavy_attack_bonus`·`resonance_skill_bonus`·`resonance_liberation_bonus`) | 6.4, 7.1, 7.9, 8.6, 9.4, 10.1, 10.9, 11.6 |
| `flat_hp` | 320, 360, 390, 430, 470, 510, 540, 580 |
| `flat_attack` | 30, 40, 50, 60 |
| `flat_defense` | 40, 50, 60, 70 |

- 공%·HP%·유형별 피해보너스는 **동일 단계표(6.4~11.6)** 공유.
- 크크작 "밑에서 4번째"(index 3): 크리 8.1 / 크피 16.2 / 공% 8.6 — 기획 7.2와 일치.
- 이론 최고 max(×5): 크리 10.5 / 크피 21(=105) / 공% 11.6(=58) / 유형피해 11.6 / 깡공 60 — 기획과 일치.

**메인 주옵션(primary) 표 (단위 %, 코스트별)**:
| 옵션 | 1코 | 3코 | 4코 |
|---|---|---|---|
| `attack_percent` | 18.0 | 30.0 | 33.0 |
| `hp_percent` | 22.8 | 30.0 | 33.0 |
| `defense_percent` | 18.0 | 38.0 | 41.5 |
| `element_damage_bonus`(속성피해) | — | 30.0 | — |
| `energy_regen`(공명효율) | — | 32.0 | — |
| `critical_rate` | — | — | 22.0 |
| `critical_damage` | — | — | 44.0 |
| `healing_bonus`(치료효과) | — | — | 26.0 |

- 캐릭터 `scale_stat`·`effective_substats`에 따라 **딜 관련 옵션만** UI에 노출(히유키: 4코 크피/크리/공%, 3코 공%/속피, 1코 공%). HP%·방%·치료효과 등은 ATK 딜러에겐 비노출. 값 자체는 전체 보관(HP·DEF 스케일 캐릭 대비).

**메인 보조옵션(secondary), 코스트별 고정**:
| 코스트 | 보조 스탯 |
|---|---|
| 1코 | `flat_hp` 2280 |
| 3코 | `flat_attack` 100 |
| 4코 | `flat_attack` 150 |
- 보조옵션은 캐릭터 `scale_stat`의 깡스탯과 일치할 때만 베이스에 가산. 히유키(ATK): 4코+150, 3코+100, 1코 HP 2280은 ATK 무관 → 0.

**기타 상수**: 코스트 레이아웃 `43311`/`44111`, 기본 크리 5%, 기본 크피 150%.

## 4. 계산 엔진 (프로토타입 수치 보존)

프로토타입의 검증된 수식을 **그대로** 이식하되, 하드코딩된 히유키 상수를 JSON+버프 집계로 대체한다.

### 4.1 버프 집계 (`buffs.js`)
입력: 캐릭터(skill_node + 선택된 main_slot_echo) + 선택 무기 + 선택 세트 + 수동 버프 + 토글 상태 + 마스터 토글 + 캐릭터 element.
처리:
- `always: true` 버프는 항상 합산(마스터 토글 무관).
- `always: false` 버프는 토글 on이고 마스터 토글 on일 때만.
- `element` 지정 버프는 캐릭터 element와 일치할 때만.
- `type`을 데미지 식의 항으로 분류:
  - `critical_rate` → 크리율 항, `critical_damage` → 크피 항
  - `attack_percent` → 스케일스탯항 `(1 + Σ)`
  - `element_damage_bonus` + 캐릭터 `damage_bonus_type`에 해당하는 `*_bonus` → 증가피해보너스항(합연산)
  - `*_amplify` 류 → 부스트항(곱연산, 합산 후 곱). `element_damage_amplify`는 `element` 일치 시만.
  - `defense_ignore`, `energy_regen`(전제형) → 근사 트랙 약분/전제로 **통합 성능에 미반영**(집계만).

### 4.2 통합 성능 (`perf.js`)
```
ATK = (char.base_attack + weapon.base_stats.attack)
      × (1 + Σ attack_percent[skill_node·무기·메인에코·세트·수동] + 부옵 공% + 메인 공%)
      + 부옵 깡공 + 메인 secondary 깡공
크리율 = min(0.05 + weapon.base_stats.critical_rate + Σ critical_rate + 부옵 크리 + 메인 크리, 1.0)
크피   = 1.50 + (weapon.base_stats.critical_damage||0) + Σ critical_damage + 부옵 크피 + 메인 크피
증가피해보너스항 = 1 + Σ element_damage_bonus(일치) + Σ(damage_bonus_type 해당 증가) + 부옵 해당 + 메인 속피
부스트항 = 1 + Σ amplify
통합 성능 = ATK × 증가피해보너스항 × 부스트항 × (1 + 크리율 × (크피 − 1))
```
표시 스펙(`displaySpec`)은 통합 성능과 같은 입력으로 캡 전 크리율·응결·해방 등을 따로 산출(전투 실제 스펙).

### 4.3 점수·추천 (`theory.js`)
- **이론 최고**: 유효옵 5종을 각 최고단계로, 22줄(전제형은 공효 3줄 차감)을 5유효옵에 전수 배분 + 메인 primary 전수 탐색 → 통합 성능 최대. → `내 통합/이론최고`.
- **크크작**: 크리 5줄+크피 5줄(밑4번째 단계) + 분모 메인(3코 드롭다운, 기본=이론최고가 고른 최적) → `내 통합/크크작`.
- **메인 조합 추천**: 코스트별(43311 3코 / 44111 4코) 조합을 이론최고·크크작 두 기준으로 상대 % 비교, 최고에 ★. 버프 반영해 갱신.
- **부옵 자유 비교**: 현재 부옵에서 일부 값만 덮어쓴 비교 세팅의 통합 성능 차이%.

## 5. UI / 데이터 흐름

프로토타입 레이아웃을 유지하되 상단에 선택 UI를 JSON 구동으로 추가.
- 캐릭터 선택 → 해당 캐릭터의 `recommended_weapons`/`recommended_echo_sets`/`main_slot_echo`로 하위 선택지 채움.
- 무기 선택 / 4코 메인 에코 선택 / 에코세트 선택.
- 코스트 구성, 메인 primary(슬롯별), 부옵 25줄(옵션+단계), 조건부 토글, 수동 버프 추가.
- 입력 변경 → 엔진 재호출 → 점수/스펙/추천/비교 실시간 갱신.
- 초기값: 검증된 히유키 샘플 부옵 로드(프로토타입 `loadSample` 이식).

## 6. 테스트 — 검증 수치 고정 (TDD)

엔진 단위 테스트로 프로토타입/부록 A 수치를 박아 리팩터링·일반화 회귀를 막는다. 히유키 기준(43311, 5세트 크리율 25%, 파수인 미동반, 부록 A 입력):
- 최종 ATK ≈ **2965** (인게임 표시 2964, ±0.1%).
- 통합 성능 ≈ **13228.6** (공공, **무기 응결 부스트 조건부 OFF** 기준).
- 무기 응결 부스트(서린 불꽃 28%) **ON** → 통합 성능 ×1.28 ≈ **16941**.
- 3코 메인 비교: 속공 **+4.47%**, 속속 **+5.36%** (공공 기준).
- 이론 최고 대비 ≈ **59.9%**.
- 크크작 대비 — **공공 분모(부록 A.5 worked example)** 기준 분모 **10524.9**, 비율 **125.7%**. 단 분모 메인을 분자와 분리하는 새 설계(근사트랙 7.3)에서 드롭다운 **기본값은 최적(속속)**이라 기본 표시 점수는 더 낮음(~116%). 검증은 공공 분모 값으로 고정하고, 기본 동작은 "속속 점수 < 공공 점수"로 확인.
- 부옵 교체 판정(부록 A.6 override: 크피 합 −2.4 / 공% 합 +4.5) → **+0.64%** (검증 엔진 실측; 부록 A.6의 "+1.8%"는 stale 수기 추정치).
- `defense_ignore` 토글 on/off는 통합 성능을 바꾸지 않는다(약분 검증).

> 각 검증은 조건부 토글 상태를 명시적으로 세팅해 고정한다. 부록 A 기준선(13228.6)은 5세트 조건부(응결10·크리25) ON, 무기 응결 부스트 OFF 상태다.

## 7. 미확정 / 구현 중 확인

- 무기명·에코명 확정: 서린 불꽃 / 천년의 회류(테스트용) / 4코 메인 에코 "공명의 메아리 · 명식 · 허무의 신".
- 4코 공% 메인 수치 33% 추정(프로토타입 가정) — 실제값 확인 필요.
- 피해보너스류 부옵 단계값(해방 등) 6.4~11.6 추정 — 유효 유형은 정확값 필요.
- React 빌드 셋업(Vite) 초기화 시 디렉터리/패키지 구성 확정.

## 8. 비목표 재확인
백엔드·로그인·정밀 트랙·파티/매트릭스·OCR·표본 상대점수는 이 작업에서 다루지 않는다. 근사 트랙 단일 캐릭터 계산기의 React 이전 + 데이터 일반화에 집중한다.
