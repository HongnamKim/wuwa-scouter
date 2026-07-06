import { useState } from 'react';
import type { AppState } from '../state/store';
import { loadCharacterState, analysisContext, isRecordOnly, charactersInListOrder } from '../state/store';
import type { Character } from '../types/data';
import type { Element } from '../types/domain';
import { ELEMENTS } from '../types/domain';
import { computePerf } from '../engine/perf';
import { buildPerfInput } from '../engine/build';
import { theoryBest, kkjakReferencePerf } from '../engine/theory';
import { isLocked, releaseDateLabel } from '../engine/release';
import { onImgError } from './imgFallback';
import { Dropdown } from './Dropdown';

// 속성 → 아이콘 파일명(slug). 아이콘은 public/elements/<slug>.webp (없으면 onError로 숨김)
const ELEMENT_SLUG: Record<Element, string> = {
  '응결': 'glacio', '용융': 'fusion', '전도': 'electro', '기류': 'aero', '회절': 'spectro', '인멸': 'havoc',
};
const elementIcon = (el: Element) => `/elements/${ELEMENT_SLUG[el]}.webp`;

function hasSubstats(state: AppState): boolean {
  return state.slots.some((s) => s.substats.some((l) => l.type && l.value != null));
}

// 카드 하단 점수 두 줄. 기록 전용(서포터)은 상대 점수가 없으므로 딜 상승 수치만.
function cardScoreLines(character: Character, state: AppState | null): { primary: string; secondary: string } {
  const record = isRecordOnly(character);
  const ctx = state ? analysisContext(state) : null;
  if (!state || !ctx || !hasSubstats(state)) {
    return record ? { primary: '딜 -', secondary: '서포터(기록)' } : { primary: '크크작 -', secondary: '최고점 -' };
  }
  const mine = computePerf(buildPerfInput(ctx));
  if (record) return { primary: `딜 ${mine.toFixed(0)}`, secondary: '서포터(기록)' };
  return {
    primary: `크크작 ${((mine / kkjakReferencePerf(ctx)) * 100).toFixed(1)}%`,
    secondary: `최고점 ${((mine / theoryBest(ctx).perf) * 100).toFixed(1)}%`,
  };
}

export function CharacterList({ onSelect }: { onSelect: (characterId: string) => void }) {
  const [version, setVersion] = useState('all');
  const [element, setElement] = useState('all');
  const [reversed, setReversed] = useState(false); // 정렬 방향(기본: 최신 버전순 desc). true=오름차순(오래된순)
  // 데이터에 존재하는 모든 공명자 표시 (저장값 없으면 흑백). 정렬 방향 반영.
  const entries = charactersInListOrder(reversed).map((c) => ({ character: c, state: loadCharacterState(c) }));

  // 출시 버전은 정수(메이저)로 필터링: 3 선택 시 3.0~3.x 모두 포함
  const versions = [...new Set(entries.map((e) => Math.floor(e.character.version)))].sort((a, b) => a - b);
  // 속성 필터 순서 고정: 응결·용융·전도·기류·회절·인멸(ELEMENTS 순), 데이터에 존재하는 것만
  const present = new Set(entries.map((e) => e.character.element));
  const elements = ELEMENTS.filter((el) => present.has(el));

  // entries가 이미 방향까지 반영해 정렬돼 있으므로 필터만 적용(순서 보존).
  const filtered = entries
    .filter((e) =>
      (version === 'all' || String(Math.floor(e.character.version)) === version)
      && (element === 'all' || e.character.element === element));

  // major 버전별 그룹. filtered가 버전 순으로 연속 정렬돼 있으므로 연속 묶음.
  type Entry = { character: Character; state: AppState | null };
  const byVersion: { major: number; items: Entry[] }[] = [];
  for (const e of filtered) {
    const major = Math.floor(e.character.version);
    const last = byVersion[byVersion.length - 1];
    if (last && last.major === major) last.items.push(e);
    else byVersion.push({ major, items: [e] });
  }

  const renderCard = ({ character, state }: Entry) => {
    const locked = isLocked(character);
    const { primary, secondary } = locked
      ? { primary: releaseDateLabel(character), secondary: '출시 예정' }
      : cardScoreLines(character, state);
    const recorded = !!state && !locked;
    return (
      <div className={'char-card' + (locked ? ' locked' : '')} key={character.id}
        onClick={locked ? undefined : () => onSelect(character.id)}
        aria-disabled={locked || undefined}>
        <span className="card-element" title={character.element}>
          <img className="card-element-icon" src={elementIcon(character.element)} alt={character.element}
            onError={(e) => { const t = e.currentTarget; t.style.display = 'none'; (t.nextElementSibling as HTMLElement).style.display = 'inline'; }} />
          <span className="card-element-text">{character.element}</span>
        </span>
        <img className={recorded ? 'card-image' : 'card-image not-recorded'}
          src={`/characters/${character.id}.webp`} alt={character.name} onError={onImgError} />
        <div className="card-name">{character.name}</div>
        <div className="muted">{character.version}버전{character.version_phase ? ` ${character.version_phase}` : ''}</div>
        <div className={'card-score' + (locked ? ' card-release' : '')}>{primary}</div>
        <div className="muted">{secondary}</div>
      </div>
    );
  };

  return (
    <div>
      <div className="config">
        <label>출시 버전:
          <Dropdown className="dd-narrow" value={version}
            options={[{ value: 'all', label: '전체' }, ...versions.map((v) => ({ value: String(v), label: `${v}버전` }))]}
            onChange={setVersion} />
        </label>
        <label>속성:
          <Dropdown className="dd-narrow" value={element}
            options={[{ value: 'all', label: '전체' }, ...elements.map((el) => ({ value: el, label: el, image: elementIcon(el) }))]}
            onChange={setElement} />
        </label>
        <button type="button" className="sort-dir-btn" onClick={() => setReversed((r) => !r)}
          title="정렬 방향 전환">
          <span className="sort-dir-arrow">{reversed ? '↑' : '↓'}</span>
          <span>{reversed ? '오래된 버전순' : '최신 버전순'}</span>
        </button>
      </div>

      {byVersion.map(({ major, items }) => (
        <section key={major} className="version-group">
          <h3 className="version-heading">{major}버전</h3>
          <div className="card-grid">{items.map(renderCard)}</div>
        </section>
      ))}
    </div>
  );
}
