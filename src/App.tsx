import { useState } from 'react';
import { initialState, saveCharacterState, isStateSaved, buildStateForCharacter, AppState } from './state/store';
import { loadCharacters } from './engine/loadData';
import { Selectors } from './components/Selectors';
import { CharacterList } from './components/CharacterList';
import { MainPrimaryTable } from './components/MainPrimaryTable';
import { SubstatInput } from './components/SubstatInput';
import { CharacterSpec } from './components/CharacterSpec';
import { BuffPanel } from './components/BuffPanel';
import { Scores } from './components/Scores';
import { MainReco } from './components/MainReco';
import { SubstatCompare } from './components/SubstatCompare';
import './styles.css';

function SaveButton({ state }: { state: AppState }) {
  const [, force] = useState(0);
  const dirty = !isStateSaved(state);
  return (
    <button className="save-btn" disabled={!dirty} onClick={() => { saveCharacterState(state); force((n) => n + 1); }}>
      {dirty ? '저장하기' : '저장됨'}
    </button>
  );
}

export function App() {
  const [state, setState] = useState(initialState);
  const [view, setView] = useState<'analysis' | 'list'>('list');

  const openInAnalysis = (characterId: string) => {
    const c = loadCharacters().find((x) => x.id === characterId);
    if (c) setState(buildStateForCharacter(c));
    setView('analysis');
  };

  return (
    <>
      <header className="app-header">
        <div className="brand" onClick={() => setView('list')}>명조스카우터</div>
        <nav className="header-nav">
          <button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}>공명자 목록</button>
          <button className={view === 'analysis' ? 'active' : ''} onClick={() => setView('analysis')}>공명자 분석</button>
        </nav>
      </header>

      <div className="app">
      {view === 'list' ? (
        <CharacterList onSelect={openInAnalysis} />
      ) : (
      <>
      <div className="top-row">
        <Selectors state={state} setState={setState} />
        <div className="top-reco">
          <h2>메인 조합 추천</h2>
          <MainReco state={state} />
        </div>
      </div>

      <h2>점수</h2>
      <Scores state={state} />

      <h2>내 캐릭터 스펙</h2>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <SaveButton state={state} />
      </div>
      <div className="two-col">
        <div className="left-col">
          <h3>현재 스펙</h3>
          <CharacterSpec state={state} />
          <BuffPanel state={state} setState={setState} />
        </div>
        <div className="right-col">
          <h3>메인 옵션</h3>
          <MainPrimaryTable state={state} setState={setState} />
          <h3>부옵</h3>
          <SubstatInput state={state} setState={setState} />
        </div>
      </div>

      <h2>부옵 자유 비교</h2>
      <SubstatCompare state={state} />
      </>
      )}
      </div>
    </>
  );
}
