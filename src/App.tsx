import { useState, useEffect } from 'react';
import {
  createBrowserRouter, RouterProvider, Outlet, Navigate,
  useNavigate, useParams, useLocation, useBlocker,
} from 'react-router-dom';
import type { Character } from './types/data';
import {
  saveCharacterState, isStateSaved, hasSavedState, deleteCharacterState,
  buildStateForCharacter, defaultStateForCharacter, loadCharacterState,
} from './state/store';
import { loadCharacters } from './engine/loadData';
import { Selectors } from './components/Selectors';
import { ConfirmModal } from './components/ConfirmModal';
import { CharacterList } from './components/CharacterList';
import { MainPrimaryTable } from './components/MainPrimaryTable';
import { SubstatInput } from './components/SubstatInput';
import { CharacterSpec } from './components/CharacterSpec';
import { BuffPanel } from './components/BuffPanel';
import { Scores } from './components/Scores';
import { MainReco } from './components/MainReco';
import { WeaponCompare } from './components/WeaponCompare';
import { SubstatSwapCompare } from './components/SubstatSwapCompare';
import { Dropdown } from './components/Dropdown';
import './styles.css';

const LAST_KEY = 'wuwa-scouter:last-character';

function lastCharacterId(): string {
  const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(LAST_KEY) : null;
  const chars = loadCharacters();
  return saved && chars.some((c) => c.id === saved) ? saved : chars[0].id;
}

function Layout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const onList = pathname.startsWith('/list');
  const onAnalysis = pathname.startsWith('/analysis');
  const onCompare = pathname.startsWith('/compare');
  return (
    <>
      <header className="app-header">
        <div className="brand" onClick={() => navigate('/list')}>명조스카우터</div>
        <nav className="header-nav">
          <button className={onList ? 'active' : ''} onClick={() => navigate('/list')}>공명자 목록</button>
          <button className={onAnalysis ? 'active' : ''} onClick={() => navigate(`/analysis/${lastCharacterId()}`)}>공명자 분석</button>
          <button className={onCompare ? 'active' : ''} onClick={() => navigate(`/compare/${lastCharacterId()}`)}>비교</button>
        </nav>
      </header>
      <div className="app"><Outlet /></div>
    </>
  );
}

function ListScreen() {
  const navigate = useNavigate();
  return <CharacterList onSelect={(id) => navigate(`/analysis/${id}`)} />;
}

/** :id → 캐릭터 확인 후 분석 화면. id 바뀌면 key로 상태 초기화 */
function AnalysisRoute() {
  const { id } = useParams();
  const character = loadCharacters().find((c) => c.id === id);
  if (!character) return <Navigate to="/list" replace />;
  return <AnalysisScreen key={character.id} character={character} />;
}

function AnalysisScreen({ character }: { character: Character }) {
  const navigate = useNavigate();
  const [state, setState] = useState(() => buildStateForCharacter(character));
  const [, force] = useState(0);
  const rerender = () => force((n) => n + 1);
  const [deleting, setDeleting] = useState(false);

  const dirty = !isStateSaved(state);
  // 미저장 변경이 있으면 화면 이탈(헤더/뒤로가기/캐릭터 변경 포함)을 가로채 확인
  const blocker = useBlocker(dirty);

  useEffect(() => { localStorage.setItem(LAST_KEY, character.id); }, [character.id]);

  return (
    <>
      <div className="top-row">
        <Selectors state={state} setState={setState}
          onRequestCharacterChange={(cid) => navigate(`/analysis/${cid}`)} />
        <div className="top-reco">
          <h2>메인 조합 추천</h2>
          <MainReco state={state} />
        </div>
      </div>

      <h2>점수</h2>
      <Scores key={state.character.id + state.costLayout} state={state} />

      <h2>내 캐릭터 스펙</h2>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
        <button className="compare-btn" onClick={() => navigate(`/compare/${character.id}`)}>비교 화면 →</button>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="save-btn" disabled={!dirty} onClick={() => { saveCharacterState(state); rerender(); }}>
            {dirty ? '저장하기' : '저장됨'}
          </button>
          <button className="delete-btn" disabled={!hasSavedState(character.id)} onClick={() => setDeleting(true)}>삭제</button>
        </div>
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

      {blocker.state === 'blocked' && (
        <ConfirmModal
          message="변경 내용이 있습니다. 저장하시겠습니까?"
          confirmLabel="저장"
          onConfirm={() => { saveCharacterState(state); blocker.proceed(); }}
          onCancel={() => blocker.proceed()}
          onDismiss={() => blocker.reset()}
        />
      )}
      {deleting && (
        <ConfirmModal
          message="입력 데이터를 삭제하시겠습니까?"
          confirmLabel="삭제"
          danger
          onConfirm={() => { deleteCharacterState(character.id); setState(defaultStateForCharacter(character)); setDeleting(false); }}
          onCancel={() => setDeleting(false)}
          onDismiss={() => setDeleting(false)}
        />
      )}
    </>
  );
}

/** :id → 캐릭터 확인 후 비교 화면. id 바뀌면 key로 초기화 */
function CompareRoute() {
  const { id } = useParams();
  const character = loadCharacters().find((c) => c.id === id);
  if (!character) return <Navigate to="/list" replace />;
  return <CompareScreen key={character.id} character={character} />;
}

/**
 * 비교 화면 골격: 저장된 빌드를 기준으로 무기/부옵 교체 시 딜 변화를 본다.
 * 비교 로직은 추후 구현 — 지금은 레이아웃/진입/빈 상태만.
 */
function CompareScreen({ character }: { character: Character }) {
  const navigate = useNavigate();
  useEffect(() => { localStorage.setItem(LAST_KEY, character.id); }, [character.id]);
  const base = loadCharacterState(character);

  return (
    <>
      <label style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 8 }}>캐릭터:
        <Dropdown value={character.id}
          options={loadCharacters().map((c) => ({ value: c.id, label: c.name, image: `/characters/${c.id}.png` }))}
          onChange={(id) => navigate(`/compare/${id}`)} />
      </label>
      <h2>
        {character.name} 비교
        {base && <span className="muted" style={{ fontSize: '0.85rem', fontWeight: 'normal', marginLeft: 8 }}>저장된 빌드 기준</span>}
      </h2>

      {!base ? (
        <div style={{ margin: '16px 0' }}>
          <p className="muted">비교하려면 먼저 분석 화면에서 스펙을 입력하고 저장해야 합니다.</p>
          <button className="save-btn" onClick={() => navigate(`/analysis/${character.id}`)}>분석 화면에서 입력하기</button>
        </div>
      ) : (
        <>
          <h3>무기 비교</h3>
          <WeaponCompare base={base} />

          <h3>부옵 교체 비교</h3>
          <SubstatSwapCompare base={base} />
        </>
      )}
    </>
  );
}

const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Navigate to="/list" replace /> },
      { path: 'list', element: <ListScreen /> },
      { path: 'analysis/:id', element: <AnalysisRoute /> },
      { path: 'compare/:id', element: <CompareRoute /> },
      { path: '*', element: <Navigate to="/list" replace /> },
    ],
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}
