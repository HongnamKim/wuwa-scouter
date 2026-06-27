import { useState } from 'react';
import type { AppState } from '../state/store';
import { loadCharacterState } from '../state/store';
import { loadCharacters } from '../engine/loadData';
import { computePerf } from '../engine/perf';
import { buildPerfInput } from '../engine/build';
import { theoryBest, kkjakPerf, optimalThreeCoMode } from '../engine/theory';

function hasSubstats(state: AppState): boolean {
  return state.substats.some((echo) => echo.some((l) => l.type && l.value != null));
}

function scoresOf(state: AppState): { theory: number; kkjak: number } | null {
  if (!hasSubstats(state)) return null;
  const mine = computePerf(buildPerfInput(state));
  return {
    theory: (mine / theoryBest(state).perf) * 100,
    kkjak: (mine / kkjakPerf(state, optimalThreeCoMode(state))) * 100,
  };
}

export function CharacterList({ onSelect }: { onSelect: (characterId: string) => void }) {
  // 데이터에 존재하는 모든 공명자 표시 (저장값 없으면 흑백)
  const entries = loadCharacters().map((c) => ({ character: c, state: loadCharacterState(c) }));
  const [version, setVersion] = useState('all');
  const [element, setElement] = useState('all');

  const versions = [...new Set(entries.map((e) => e.character.version))].sort((a, b) => a - b);
  const elements = [...new Set(entries.map((e) => e.character.element))];

  const filtered = entries.filter((e) =>
    (version === 'all' || String(e.character.version) === version)
    && (element === 'all' || e.character.element === element));

  return (
    <div>
      <div className="config">
        <label>출시 버전:
          <select value={version} onChange={(e) => setVersion(e.target.value)}>
            <option value="all">전체</option>
            {versions.map((v) => <option key={v} value={String(v)}>{v}버전</option>)}
          </select>
        </label>
        <label>속성:
          <select value={element} onChange={(e) => setElement(e.target.value)}>
            <option value="all">전체</option>
            {elements.map((el) => <option key={el} value={el}>{el}</option>)}
          </select>
        </label>
      </div>

      <div className="card-grid">
        {filtered.map(({ character, state }) => {
          const sc = state ? scoresOf(state) : null;
          const recorded = !!state;
          return (
            <div className="char-card" key={character.id} onClick={() => onSelect(character.id)}>
              <img className={recorded ? 'card-image' : 'card-image not-recorded'}
                src={`/characters/${character.id}.png`} alt={character.name}
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }} />
              <div className="card-name">{character.name}</div>
              <div className="muted">{character.version}버전 · {character.element}</div>
              <div className="card-score">크크작 {sc ? sc.kkjak.toFixed(1) + '%' : '-'}</div>
              <div className="muted">이론 최고 {sc ? sc.theory.toFixed(1) + '%' : '-'}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
