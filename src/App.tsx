import { useState, useEffect, type ReactNode, type CSSProperties } from 'react';
import {
  createBrowserRouter, RouterProvider, Outlet, Navigate,
  useNavigate, useParams, useLocation, useBlocker,
} from 'react-router-dom';
import type { Character } from './types/data';
import type { EchoSlot } from './engine/context';
import {
  saveCharacterState, isStateSaved, hasSavedState, deleteCharacterState,
  buildStateForCharacter, defaultStateForCharacter, loadCharacterState, analysisContext, isRecordOnly, isUntouchedDefault,
  charactersInListOrder,
} from './state/store';
import { loadCharacters } from './engine/loadData';
import { freeTwoPieceSlots } from './engine/echoSlots';
import { costsOf } from './engine/costLayout';
import { erConstrained } from './engine/theory';
import { isLocked } from './engine/release';
import { Selectors } from './components/Selectors';
import { ConfirmModal } from './components/ConfirmModal';
import { CharacterList } from './components/CharacterList';
import { ThemeProvider, useTheme, ACCENT, ELEMENT_COLOR } from './theme';
import { EchoSlots } from './components/EchoSlots';
import { CharacterSpec } from './components/CharacterSpec';
import { BuffPanel } from './components/BuffPanel';
import { Scores } from './components/Scores';
import { MainReco } from './components/MainReco';
import { TwoPieceReco } from './components/TwoPieceReco';
import { WeaponCompare } from './components/WeaponCompare';
import { SubstatSwapCompare } from './components/SubstatSwapCompare';
import { FaqScreen } from './components/FaqScreen';
import { Dropdown } from './components/Dropdown';
import { Analytics } from '@vercel/analytics/react';
import { FiSave, FiRotateCcw, FiTrash2 } from 'react-icons/fi';
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
  const { theme, vars, toggle } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false); // 모바일: 햄버거로 네비 토글
  const go = (path: string) => { setMenuOpen(false); navigate(path); };
  const items = [
    { label: '공명자 목록', to: '/list', active: pathname.startsWith('/list') },
    { label: '공명자 분석', to: `/analysis/${lastCharacterId()}`, active: pathname.startsWith('/analysis') },
    { label: '비교', to: `/compare/${lastCharacterId()}`, active: pathname.startsWith('/compare') },
    { label: 'FAQ', to: '/faq', active: pathname.startsWith('/faq') },
  ];
  const themeIcon = theme === 'dark' ? '☾' : '☀';
  const themeLabel = theme === 'dark' ? 'DARK' : 'LIGHT';
  // 테마 CSS 변수를 .app에 주입 → styles.css 클래스와 컴포넌트 인라인 스타일 모두 참조.
  const cssVars = {
    '--fg': vars.fg, '--muted': vars.muted, '--rule': vars.rule,
    '--card': vars.card, '--cardBorder': vars.cardBorder,
    '--ctrl': vars.ctrl, '--ctrlBorder': vars.ctrlBorder,
    '--stat': vars.stat, '--portrait': vars.portrait, '--menu': vars.menu, '--hover': vars.hover,
    '--bestbg': vars.bestbg, '--bestfg': vars.bestfg, '--good': vars.good, '--bad': vars.bad,
    '--accent': ACCENT, '--el': ACCENT,
  } as CSSProperties;
  return (
    <div style={{ minHeight: '100vh', background: vars.bg, color: vars.fg, transition: 'background .35s ease, color .35s ease' }}>
      <header style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, height: 72, display: 'flex', alignItems: 'center', gap: 20, padding: '0 clamp(16px,4vw,48px)', background: 'rgba(13,16,23,0.86)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div onClick={() => go('/list')} style={{ display: 'flex', alignItems: 'center', gap: 11, cursor: 'pointer' }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: ACCENT, boxShadow: `0 0 12px ${ACCENT}`, transform: 'rotate(45deg)' }} />
          <span style={{ fontWeight: 800, fontSize: '1.12rem', letterSpacing: '-0.01em', color: '#f3f5fa' }}>명조<span style={{ color: ACCENT }}>스카우터</span></span>
        </div>
        <nav className="dc-nav-d" style={{ display: 'flex', gap: 4, marginLeft: 8 }}>
          {items.map((it) => (
            <button key={it.to} onClick={() => go(it.to)} style={{
              padding: '9px 16px', borderRadius: 8, fontSize: '0.9rem', fontWeight: it.active ? 700 : 500, cursor: 'pointer', border: 'none',
              color: it.active ? '#0d1017' : '#b9c0cf', background: it.active ? ACCENT : 'transparent',
              boxShadow: it.active ? `0 4px 16px -6px ${ACCENT}` : undefined,
            }}>{it.label}</button>
          ))}
        </nav>
        <button onClick={() => setMenuOpen((o) => !o)} className="dc-burger" aria-label="메뉴" style={{ marginLeft: 'auto', alignItems: 'center', justifyContent: 'center', width: 38, height: 38, borderRadius: 9, border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.04)', color: '#cfd5e2', fontSize: '1.25rem', lineHeight: 1, cursor: 'pointer' }}>☰</button>
        <nav className={'dc-nav-m' + (menuOpen ? ' open' : '')} style={{ position: 'absolute', top: '100%', right: 12, marginTop: 8, flexDirection: 'column', gap: 4, minWidth: 160, background: '#12161f', padding: 8, borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 14px 34px rgba(0,0,0,0.45)', zIndex: 60 }}>
          {items.map((it) => (
            <button key={it.to} onClick={() => go(it.to)} style={{ padding: '10px 14px', borderRadius: 8, fontSize: '0.95rem', fontWeight: it.active ? 700 : 500, cursor: 'pointer', border: 'none', textAlign: 'left', color: it.active ? '#0d1017' : '#cfd5e2', background: it.active ? ACCENT : 'transparent' }}>{it.label}</button>
          ))}
          <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '4px 6px' }} />
          <button onClick={toggle} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '10px 14px', borderRadius: 8, border: 'none', background: 'transparent', color: '#cfd5e2', fontSize: '0.95rem', fontWeight: 500, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
            <span>테마</span><span style={{ fontFamily: 'var(--mono)', fontSize: '0.85rem' }}>{themeIcon} {themeLabel}</span>
          </button>
        </nav>
        <button onClick={toggle} aria-label="테마 전환" className="dc-theme-d" style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 8, height: 38, padding: '0 14px', borderRadius: 999, border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.04)', color: '#cfd5e2', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--mono)' }}>
          <span style={{ fontSize: '0.95rem', lineHeight: 1 }}>{themeIcon}</span>{themeLabel}
        </button>
      </header>
      <div className="app" style={cssVars}><Outlet /></div>
    </div>
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
  if (!character || isLocked(character)) return <Navigate to="/list" replace />;
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

  const elColor = ELEMENT_COLOR[character.element] ?? ACCENT;
  return (
    <div style={{ '--el': elColor } as CSSProperties}>
      <div className="char-select-row">
        <Dropdown className="dd-char" value={character.id}
          options={charactersInListOrder().map((c) => ({
            value: c.id, label: c.name + (isLocked(c) ? ' · 출시 예정' : ''),
            image: `/characters/${c.id}.webp`, group: `${Math.floor(c.version)}버전`, disabled: isLocked(c),
            meta: `v${c.version}`, chip: { text: `${c.element} · v${c.version}`, color: ELEMENT_COLOR[c.element] ?? ACCENT },
          }))}
          onChange={(cid) => navigate(`/analysis/${cid}`)} />
      </div>

      {character.notice && (
        <div className="notice-banner">⚠ {character.notice}</div>
      )}

      <div className="top-row">
        <Selectors state={state} setState={setState} />
        {isRecordOnly(character) && !(analysisContext(state) && erConstrained(analysisContext(state)!)) ? (
          <div className="top-reco">
            <h2>기록 전용 (서포터)</h2>
            <p className="muted">개인 딜 최적화(메인 조합 추천·상대 점수)는 제공하지 않고, 스펙·버프·딜 상승 수치만 기록용으로 표시합니다.</p>
          </div>
        ) : (
          <div className="top-reco">
            <div className="reco-eyebrow">RECOMMENDED</div>
            <h2>메인 조합 추천</h2>
            <MainReco state={state} />
            {freeTwoPieceSlots(state.echoSets, state.costLayout ? costsOf(state.costLayout).length : 5) > 0 && (
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
            <span className="btn-icon" aria-hidden><FiSave /></span><span className="btn-text">{dirty ? '저장하기' : '저장됨'}</span>
          </button>
          <button className="reset-btn" disabled={!dirty}
            onClick={() => setState(buildStateForCharacter(character))}>
            <span className="btn-icon" aria-hidden><FiRotateCcw /></span><span className="btn-text">초기화</span>
          </button>
          <button className="delete-btn" disabled={!hasSavedState(character.id)} onClick={() => setDeleting(true)}>
            <span className="btn-icon" aria-hidden><FiTrash2 /></span><span className="btn-text">삭제</span>
          </button>
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
    </div>
  );
}

/** :id → 캐릭터 확인 후 비교 화면. id 바뀌면 key로 초기화 */
function CompareRoute() {
  const { id } = useParams();
  const character = loadCharacters().find((c) => c.id === id);
  if (!character || isLocked(character)) return <Navigate to="/list" replace />;
  return <CompareScreen key={character.id} character={character} />;
}

/**
 * 비교 화면 골격: 저장된 빌드를 기준으로 무기/부옵 교체 시 딜 변화를 본다.
 * 비교 로직은 추후 구현 — 지금은 레이아웃/진입/빈 상태만.
 */
/** 접이식 섹션(아코디언). 헤더 클릭으로 토글. */
function AccordionSection({ title, subtitle, open, onToggle, children, topBorder = true }: { title: string; subtitle?: string; open: boolean; onToggle: () => void; children: ReactNode; topBorder?: boolean }) {
  return (
    <div style={{ borderTop: topBorder ? '1px solid var(--rule)' : undefined, margin: '4px 0' }}>
      <h3 style={{ cursor: 'pointer', userSelect: 'none', display: 'flex', alignItems: 'center', gap: 9, margin: '14px 0 8px', fontSize: '1.05rem', fontWeight: 800 }} onClick={onToggle}>
        <span style={{ fontSize: '0.8rem', color: 'var(--accent)' }}>{open ? '▾' : '▸'}</span>{title}
        {subtitle && <span style={{ fontSize: '0.78rem', fontWeight: 400, color: 'var(--muted)' }}>{subtitle}</span>}
      </h3>
      {open && <div style={{ marginBottom: 12 }}>{children}</div>}
    </div>
  );
}

function CompareScreen({ character }: { character: Character }) {
  const navigate = useNavigate();
  useEffect(() => { localStorage.setItem(LAST_KEY, character.id); }, [character.id]);
  const [saved, setSaved] = useState(() => loadCharacterState(character));
  const [swapVer, setSwapVer] = useState(0); // 적용 후 교체 편집기 리셋용 key
  const base = saved ? analysisContext(saved) : null;
  const [openWeapon, setOpenWeapon] = useState(true); // 무기 비교: 기본 펼침
  const [openSwap, setOpenSwap] = useState(true);       // 에코 교체 비교: 기본 펼침
  const [openBuild, setOpenBuild] = useState(true);     // 빌드 수정(추가 버프): 기본 펼침
  // 교체할 에코를 실제 저장 빌드에 반영(덮어쓰기) 후 기준 갱신·편집기 리셋
  const applyEditedSlots = (slots: EchoSlot[]) => {
    if (!saved) return;
    const next = { ...saved, slots };
    saveCharacterState(next);
    setSaved(next);
    setSwapVer((v) => v + 1);
  };

  const elColor = ELEMENT_COLOR[character.element] ?? ACCENT;
  return (
    <div style={{ '--el': elColor } as CSSProperties}>
      <div className="char-select-row">
        <Dropdown className="dd-char" value={character.id}
          options={charactersInListOrder().map((c) => ({
            value: c.id, label: c.name + (isLocked(c) ? ' · 출시 예정' : ''),
            image: `/characters/${c.id}.webp`, group: `${Math.floor(c.version)}버전`, disabled: isLocked(c),
            meta: `v${c.version}`, chip: { text: `${c.element} · v${c.version}`, color: ELEMENT_COLOR[c.element] ?? ACCENT },
          }))}
          onChange={(id) => navigate(`/compare/${id}`)} />
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, margin: '0 0 24px', flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0, fontSize: 'clamp(1.5rem,3vw,2rem)', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--fg)' }}>{character.name} 비교</h1>
        {base && <span style={{ fontSize: '0.82rem', color: 'var(--muted)', border: '1px solid var(--ctrlBorder)', borderRadius: 999, padding: '3px 10px' }}>저장된 빌드 기준</span>}
      </div>

      {!base ? (
        <div style={{ margin: '16px 0' }}>
          <p className="muted">비교하려면 먼저 분석 화면에서 스펙을 입력하고 저장해야 합니다.</p>
          <button className="save-btn" onClick={() => navigate(`/analysis/${character.id}`)}>분석 화면에서 입력하기</button>
        </div>
      ) : (
        <>
          <AccordionSection title="버프 수정" open={openBuild} onToggle={() => setOpenBuild((o) => !o)} topBorder={false}>
            <BuffPanel state={saved!} setState={setSaved} hideTitle />
          </AccordionSection>
          <AccordionSection title="에코 교체 비교" open={openSwap} onToggle={() => setOpenSwap((o) => !o)}>
            <SubstatSwapCompare key={swapVer} base={base} onApply={applyEditedSlots} />
          </AccordionSection>
          <AccordionSection title="무기 비교" open={openWeapon} onToggle={() => setOpenWeapon((o) => !o)}>
            <WeaponCompare base={base} />
          </AccordionSection>
        </>
      )}
    </div>
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
      { path: 'faq', element: <FaqScreen /> },
      { path: '*', element: <Navigate to="/list" replace /> },
    ],
  },
]);

export function App() {
  return (
    <ThemeProvider>
      <RouterProvider router={router} />
      <Analytics />
    </ThemeProvider>
  );
}
