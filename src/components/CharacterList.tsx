import { useState } from 'react';
import type { AppState } from '../state/store';
import { loadCharacterState, analysisContext, isRecordOnly } from '../state/store';
import type { Character } from '../types/data';
import { loadCharacters } from '../engine/loadData';
import { computePerf } from '../engine/perf';
import { buildPerfInput } from '../engine/build';
import { theoryBest, kkjakPerf, optimalThreeCoMode } from '../engine/theory';
import { Dropdown } from './Dropdown';

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
    primary: `크크작 ${((mine / kkjakPerf(ctx, optimalThreeCoMode(ctx))) * 100).toFixed(1)}%`,
    secondary: `최고점 ${((mine / theoryBest(ctx).perf) * 100).toFixed(1)}%`,
  };
}

export function CharacterList({ onSelect }: { onSelect: (characterId: string) => void }) {
  // 데이터에 존재하는 모든 공명자 표시 (저장값 없으면 흑백)
  const entries = loadCharacters().map((c) => ({ character: c, state: loadCharacterState(c) }));
  const [version, setVersion] = useState('all');
  const [element, setElement] = useState('all');

  // 출시 버전은 정수(메이저)로 필터링: 3 선택 시 3.0~3.x 모두 포함
  const versions = [...new Set(entries.map((e) => Math.floor(e.character.version)))].sort((a, b) => a - b);
  const elements = [...new Set(entries.map((e) => e.character.element))];

  const filtered = entries
    .filter((e) =>
      (version === 'all' || String(Math.floor(e.character.version)) === version)
      && (element === 'all' || e.character.element === element))
    // 정렬: 버전 내림차순 → 이름 순
    .sort((a, b) =>
      b.character.version - a.character.version
      || a.character.name.localeCompare(b.character.name));

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
            options={[{ value: 'all', label: '전체' }, ...elements.map((el) => ({ value: el, label: el }))]}
            onChange={setElement} />
        </label>
      </div>

      <div className="card-grid">
        {filtered.map(({ character, state }) => {
          const { primary, secondary } = cardScoreLines(character, state);
          const recorded = !!state;
          return (
            <div className="char-card" key={character.id} onClick={() => onSelect(character.id)}>
              <img className={recorded ? 'card-image' : 'card-image not-recorded'}
                src={`/characters/${character.id}.webp`} alt={character.name}
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }} />
              <div className="card-name">{character.name}</div>
              <div className="muted">{character.version}버전 · {character.element}</div>
              <div className="card-score">{primary}</div>
              <div className="muted">{secondary}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
