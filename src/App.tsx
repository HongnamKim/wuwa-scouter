import { useState, useEffect, type ReactNode } from 'react';
import {
  createBrowserRouter, RouterProvider, Outlet, Navigate,
  useNavigate, useParams, useLocation, useBlocker,
} from 'react-router-dom';
import type { Character } from './types/data';
import {
  saveCharacterState, isStateSaved, hasSavedState, deleteCharacterState,
  buildStateForCharacter, defaultStateForCharacter, loadCharacterState, analysisContext, isRecordOnly, isUntouchedDefault,
} from './state/store';
import { loadCharacters } from './engine/loadData';
import { freeTwoPieceSlots } from './engine/echoSlots';
import { Selectors } from './components/Selectors';
import { ConfirmModal } from './components/ConfirmModal';
import { CharacterList } from './components/CharacterList';
import { EchoSlots } from './components/EchoSlots';
import { CharacterSpec } from './components/CharacterSpec';
import { BuffPanel } from './components/BuffPanel';
import { Scores } from './components/Scores';
import { MainReco } from './components/MainReco';
import { TwoPieceReco } from './components/TwoPieceReco';
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
  // 미저장 변경이 있으면 화면 이탈(헤더/뒤로가기/캐릭터 변경 포함)을 가로채 확인.
  // 단, 데이터 없는 캐릭터의 손대지 않은 기본(빈) 상태는 저장할 것이 없으므로 차단하지 않는다.
  const blocker = useBlocker(dirty && !isUntouchedDefault(state));

  useEffect(() => { localStorage.setItem(LAST_KEY, character.id); }, [character.id]);

  return (
    <>
      <div className="char-select-row">
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>캐릭터:
          <Dropdown value={character.id}
            options={loadCharacters().map((c) => ({ value: c.id, label: c.name, image: `/characters/${c.id}.png` }))}
            onChange={(cid) => navigate(`/analysis/${cid}`)} />
        </label>
      </div>

      <div className="top-row">
        <Selectors state={state} setState={setState} />
        {isRecordOnly(character) ? (
          <div className="top-reco">
            <h2>기록 전용 (서포터)</h2>
            <p className="muted">개인 딜 최적화(메인 조합 추천·상대 점수)는 제공하지 않고, 스펙·버프·딜 상승 수치만 기록용으로 표시합니다.</p>
          </div>
        ) : (
          <div className="top-reco">
            <h2>메인 조합 추천</h2>
            <MainReco state={state} />
            {freeTwoPieceSlots(state.echoSets) > 0 && (
              <>
                <h3 style={{ marginTop: 12 }}>보조 2세트 효과 추천</h3>
                <TwoPieceReco state={state} />
              </>
            )}
          </div>
        )}
      </div>

      <h2>점수</h2>
      <Scores key={state.character.id + (state.costLayout ?? '') + (state.selectedMode ?? '') + (analysisContext(state) ? 'c' : 'u')} state={state} />
      <p className="muted" style={{ fontSize: '0.8rem', margin: '6px 0 0' }}>
        ※ 이상효과(서리·불꽃·풍식 등) 딜은 별도 스케일로 점수에 포함되지 않습니다.
      </p>
      <p className="muted" style={{ fontSize: '0.8rem', margin: '2px 0 0' }}>
        ※ 돌파(공명 체인)로 인한 개별 스킬의 피해 배율(계수) 변화는 점수에 포함되지 않습니다.
      </p>

      <h2>내 캐릭터 스펙</h2>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
        <button className="compare-btn" onClick={() => navigate(`/compare/${character.id}`)}>비교 화면 →</button>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="save-btn" disabled={!dirty} onClick={() => { saveCharacterState(state); rerender(); }}>
            {dirty ? '저장하기' : '저장됨'}
          </button>
          <button className="reset-btn" disabled={!dirty}
            onClick={() => setState(buildStateForCharacter(character))}>
            초기화
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
          <h3>에코 슬롯</h3>
          <EchoSlots state={state} setState={setState} />
        </div>
      </div>
      {/* 맨 아래 부옵 드롭다운이 한 화면에 펼쳐질 수 있도록 넉넉한 하단 여백 */}
      <div aria-hidden style={{ height: '35vh' }} />

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
/** 접이식 섹션(아코디언). 헤더 클릭으로 토글. */
function AccordionSection({ title, open, onToggle, children, topBorder = true }: { title: string; open: boolean; onToggle: () => void; children: ReactNode; topBorder?: boolean }) {
  return (
    <div style={{ borderTop: topBorder ? '1px solid #ddd' : undefined, margin: '4px 0' }}>
      <h3 style={{ cursor: 'pointer', userSelect: 'none', display: 'flex', alignItems: 'center', gap: 8, margin: '12px 0 8px' }} onClick={onToggle}>
        <span style={{ fontSize: '0.8rem', color: '#888' }}>{open ? '▾' : '▸'}</span>{title}
      </h3>
      {open && <div style={{ marginBottom: 12 }}>{children}</div>}
    </div>
  );
}

function CompareScreen({ character }: { character: Character }) {
  const navigate = useNavigate();
  useEffect(() => { localStorage.setItem(LAST_KEY, character.id); }, [character.id]);
  const saved = loadCharacterState(character);
  const base = saved ? analysisContext(saved) : null;
  const [openWeapon, setOpenWeapon] = useState(false); // 무기 비교: 전용무기 쓰면 잘 안 봄 → 기본 접힘
  const [openSwap, setOpenSwap] = useState(true);       // 에코 교체 비교: 기본 펼침

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
          <AccordionSection title="에코 교체 비교" open={openSwap} onToggle={() => setOpenSwap((o) => !o)} topBorder={false}>
            <SubstatSwapCompare base={base} />
          </AccordionSection>
          <AccordionSection title="무기 비교" open={openWeapon} onToggle={() => setOpenWeapon((o) => !o)}>
            <WeaponCompare base={base} />
          </AccordionSection>
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
