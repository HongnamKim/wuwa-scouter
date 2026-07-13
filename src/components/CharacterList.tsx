import { useState, useEffect, useRef, type CSSProperties } from 'react';
import type { AppState } from '../state/store';
import { loadCharacterState, analysisContext, charactersInListOrder } from '../state/store';
import type { Character } from '../types/data';
import type { Element } from '../types/domain';
import { ELEMENTS } from '../types/domain';
import { computePerf } from '../engine/perf';
import { buildPerfInput } from '../engine/build';
import { theoryBest, kkjakReferencePerf } from '../engine/theory';
import { isLocked, releaseDateLabel } from '../engine/release';
import { onImgError } from './imgFallback';
import { useTheme, ACCENT, ELEMENT_COLOR, type ThemeVars } from '../theme';

const ELEMENT_SLUG: Record<Element, string> = {
  '응결': 'glacio', '용융': 'fusion', '전도': 'electro', '기류': 'aero', '회절': 'spectro', '인멸': 'havoc',
};
const elementIcon = (el: Element) => `/elements/${ELEMENT_SLUG[el]}.webp`;

function hasSubstats(state: AppState): boolean {
  return state.slots.some((s) => s.substats.some((l) => l.type && l.value != null));
}

/** 카드 스탯 타일 값(크크작 / 최고점). 저장값·부옵 없으면 '—'. */
function cardScoreLines(state: AppState | null): { primary: string; secondary: string } {
  const ctx = state ? analysisContext(state) : null;
  if (!state || !ctx || !hasSubstats(state)) return { primary: '—', secondary: '—' };
  const mine = computePerf(buildPerfInput(ctx));
  return {
    primary: `${((mine / kkjakReferencePerf(ctx)) * 100).toFixed(1)}%`,
    secondary: `${((mine / theoryBest(ctx).perf) * 100).toFixed(1)}%`,
  };
}

interface Opt { value: string; label: string; icon?: string }

/** 필터 셀렉트(라벨 상단 + 팝업 목록). 디자인의 커스텀 드롭다운. */
function FilterSelect({ label, value, options, onChange, vars }:
  { label: string; value: string; options: Opt[]; onChange: (v: string) => void; vars: ThemeVars }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    window.addEventListener('click', onDoc);
    return () => window.removeEventListener('click', onDoc);
  }, []);
  const cur = options.find((o) => o.value === value);
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div style={{ fontSize: '0.72rem', fontWeight: 600, color: vars.muted, marginBottom: 6, letterSpacing: '0.04em' }}>{label}</div>
      <button onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, minWidth: 132, height: 40, padding: '0 14px', borderRadius: 10, border: `1px solid ${vars.ctrlBorder}`, background: vars.ctrl, color: vars.fg, fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {cur?.icon && <img src={cur.icon} alt="" onError={onImgError} style={{ width: 20, height: 20, objectFit: 'contain' }} />}{cur?.label}
        </span>
        <span style={{ color: ACCENT, fontSize: '0.7rem' }}>▾</span>
      </button>
      {open && (
        <ul style={{ position: 'absolute', zIndex: 30, top: '100%', left: 0, margin: '6px 0 0', padding: 6, listStyle: 'none', minWidth: '100%', background: vars.menu, border: `1px solid ${vars.ctrlBorder}`, borderRadius: 12, boxShadow: '0 18px 40px -12px rgba(0,0,0,0.55)' }}>
          {options.map((o) => (
            <li key={o.value} onClick={(e) => { e.stopPropagation(); onChange(o.value); setOpen(false); }}
              style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 12px', borderRadius: 8, fontSize: '0.9rem', fontWeight: 600, color: o.value === value ? ACCENT : vars.fg, background: o.value === value ? vars.hover : 'transparent', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              {o.icon && <img src={o.icon} alt="" onError={onImgError} style={{ width: 20, height: 20, objectFit: 'contain' }} />}{o.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function CharacterList({ onSelect }: { onSelect: (characterId: string) => void }) {
  const { vars } = useTheme();
  const [version, setVersion] = useState('all');
  const [element, setElement] = useState('all');
  const [reversed, setReversed] = useState(false); // 정렬 방향(기본: 최신 버전순 desc). true=오래된순

  const entries = charactersInListOrder(reversed).map((c) => ({ character: c, state: loadCharacterState(c) }));

  const versions = [...new Set(entries.map((e) => Math.floor(e.character.version)))].sort((a, b) => a - b);
  const present = new Set(entries.map((e) => e.character.element));
  const elements = ELEMENTS.filter((el) => present.has(el));

  const filtered = entries.filter((e) =>
    (version === 'all' || String(Math.floor(e.character.version)) === version)
    && (element === 'all' || e.character.element === element));

  type Entry = { character: Character; state: AppState | null };
  const byVersion: { major: number; items: Entry[] }[] = [];
  for (const e of filtered) {
    const major = Math.floor(e.character.version);
    const last = byVersion[byVersion.length - 1];
    if (last && last.major === major) last.items.push(e);
    else byVersion.push({ major, items: [e] });
  }

  // 필터된 공명자 중 내가 입력(저장)한 데이터가 있는 수 (분자). 분모는 필터된 표시 수.
  const withDataCount = filtered.filter((e) => e.state != null).length;
  // 필터·정렬이 기본값에서 바뀌었는지 (초기화 버튼 노출 조건)
  const filterActive = version !== 'all' || element !== 'all' || reversed;
  const resetFilters = () => { setVersion('all'); setElement('all'); setReversed(false); };

  const versionOptions: Opt[] = [{ value: 'all', label: '전체' }, ...versions.map((v) => ({ value: String(v), label: `${v}버전` }))];
  const elementOptions: Opt[] = [{ value: 'all', label: '전체' }, ...elements.map((el) => ({ value: el, label: el, icon: elementIcon(el) }))];

  const renderCard = ({ character, state }: Entry) => {
    const locked = isLocked(character);
    const el = character.element;
    const color = ELEMENT_COLOR[el] ?? ACCENT;
    const recorded = !!state && !locked;
    const { primary, secondary } = cardScoreLines(state);
    const cardStyle: CSSProperties = {
      ['--el' as string]: color,
      position: 'relative', display: 'flex', flexDirection: 'column', borderRadius: 16,
      border: `1px solid ${vars.cardBorder}`, background: vars.card, overflow: 'hidden',
      cursor: locked ? 'default' : 'pointer', textDecoration: 'none', color: vars.fg,
      transition: 'transform .22s ease, border-color .22s ease, box-shadow .22s ease',
      opacity: locked ? 0.62 : 1,
    };
    return (
      <a key={character.id} className={locked ? undefined : 'dc-card'} style={cardStyle}
        onClick={locked ? undefined : () => onSelect(character.id)} aria-disabled={locked || undefined}>
        <span style={{ position: 'absolute', top: 0, left: 20, right: 20, height: 2, background: `linear-gradient(90deg,transparent,${color},transparent)`, opacity: 0.7 }} />
        <span title={el} style={{ position: 'absolute', top: 12, left: 12, zIndex: 2, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: 9, background: `color-mix(in srgb, ${color} 16%, ${vars.chipBase})`, border: `1px solid color-mix(in srgb, ${color} 40%, transparent)` }}>
          <img src={elementIcon(el)} alt={el} onError={onImgError} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        </span>
        {character.notice && <span title={character.notice} style={{ position: 'absolute', top: 14, right: 14, zIndex: 2, fontSize: '0.95rem', color: '#f0a53a', cursor: 'help' }}>⚠</span>}
        <div style={{ position: 'relative', height: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', background: vars.portrait }}>
          <img src={`/characters/${character.id}.webp`} alt={character.name} onError={onImgError}
            style={{ width: '100%', height: 196, objectFit: 'contain', objectPosition: 'bottom', filter: recorded ? 'drop-shadow(0 8px 20px rgba(0,0,0,0.28))' : 'grayscale(1) drop-shadow(0 8px 20px rgba(0,0,0,0.28))' }} />
        </div>
        <div style={{ padding: '13px 15px 15px', borderTop: `1px solid ${vars.cardBorder}` }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ fontWeight: 800, fontSize: '1.02rem', letterSpacing: '-0.01em' }}>{character.name}</span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: '0.68rem', color, fontWeight: 600 }}>v{character.version.toFixed(1)}</span>
          </div>
          <div style={{ fontSize: '0.76rem', color: vars.muted, marginTop: 2 }}>{character.version}버전{character.version_phase ? ` ${character.version_phase}` : ''}</div>
          {locked ? (
            <div style={{ marginTop: 12, padding: '9px', borderRadius: 8, background: vars.stat, fontSize: '0.74rem', color: vars.muted, textAlign: 'center' }}>🔒 {releaseDateLabel(character)} 출시 예정</div>
          ) : (
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              {([['크크작', primary], ['최고점', secondary]] as const).map(([lbl, val]) => (
                <div key={lbl} style={{ flex: 1, padding: '7px 9px', borderRadius: 8, background: vars.stat }}>
                  <div style={{ fontSize: '0.64rem', color: vars.muted, letterSpacing: '0.02em' }}>{lbl}</div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: '0.98rem', fontWeight: 700, color: vars.ghost, marginTop: 1 }}>{val}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </a>
    );
  };

  return (
    <div style={{ maxWidth: 1160, margin: '0 auto' }}>
      <div style={{ marginBottom: 34 }}>
        <div style={{ fontFamily: 'var(--mono)', fontSize: '0.72rem', letterSpacing: '0.22em', color: ACCENT, fontWeight: 600, marginBottom: 10 }}>RESONATOR INDEX</div>
        <h1 style={{ margin: 0, fontSize: 'clamp(1.7rem,3.4vw,2.35rem)', fontWeight: 800, letterSpacing: '-0.02em' }}>공명자 목록</h1>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', marginBottom: 36 }}>
        <FilterSelect label="출시 버전" value={version} options={versionOptions} onChange={setVersion} vars={vars} />
        <FilterSelect label="속성" value={element} options={elementOptions} onChange={setElement} vars={vars} />
        <button onClick={() => setReversed((r) => !r)}
          style={{ alignSelf: 'flex-end', display: 'inline-flex', alignItems: 'center', gap: 7, height: 40, padding: '0 16px', borderRadius: 10, border: `1px solid ${vars.ctrlBorder}`, background: vars.ctrl, color: vars.fg, fontSize: '0.86rem', fontWeight: 600, cursor: 'pointer' }} title="정렬 방향 전환">
          <span style={{ color: ACCENT, fontSize: '0.95rem', lineHeight: 1 }}>{reversed ? '↑' : '↓'}</span>{reversed ? '오래된 버전순' : '최신 버전순'}
        </button>
        {filterActive && (
          <button onClick={resetFilters} title="필터 초기화"
            style={{ alignSelf: 'flex-end', display: 'inline-flex', alignItems: 'center', gap: 6, height: 40, padding: '0 14px', borderRadius: 10, border: `1px solid ${vars.ctrlBorder}`, background: 'transparent', color: vars.muted, fontSize: '0.86rem', fontWeight: 600, cursor: 'pointer' }}>
            <span style={{ fontSize: '0.95rem', lineHeight: 1 }}>↺</span>초기화
          </button>
        )}
        <div style={{ alignSelf: 'flex-end', marginLeft: 'auto', fontFamily: 'var(--mono)', fontSize: '0.78rem', color: vars.muted }}>{withDataCount} / {filtered.length} 공명자</div>
      </div>

      {byVersion.map(({ major, items }) => (
        <section key={major} style={{ marginBottom: 44 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
            <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, letterSpacing: '-0.01em' }}>{major}버전</h2>
            <span style={{ fontFamily: 'var(--mono)', fontSize: '0.72rem', color: vars.muted, padding: '3px 8px', borderRadius: 6, border: `1px solid ${vars.ctrlBorder}` }}>{items.length}</span>
            <span style={{ flex: 1, height: 1, background: vars.rule }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(184px,1fr))', gap: 20 }}>
            {items.map(renderCard)}
          </div>
        </section>
      ))}
    </div>
  );
}
