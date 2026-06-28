import { useState, useRef, useEffect } from 'react';

export interface DropdownOption {
  value: string;
  label: string;
  image?: string;    // 없으면 텍스트만 표시
  disabled?: boolean; // 선택 불가(이미 다른 곳에서 선택 등)
}

interface Props {
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  className?: string; // 폭 등 개별 스타일 제어용
  disabled?: boolean; // true면 열 수 없음(회색)
  readOnly?: boolean; // true면 같은 디자인이되 삼각형/상호작용 없는 읽기 전용 표시
}

/** 그림(선택) + 텍스트를 지원하는 커스텀 드롭다운. 그림이 없거나 로드 실패 시 텍스트만 표시. */
export function Dropdown({ value, options, onChange, className, disabled, readOnly }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const img = (src?: string) =>
    src ? (
      <img className="dropdown-img" src={src} alt=""
        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
    ) : null;

  if (readOnly) {
    // 편집 드롭다운과 동일한 button 요소·구조로 렌더(높이/정렬 일치), 삼각형은 자리만 두고 숨김
    return (
      <div className={'dropdown' + (className ? ' ' + className : '')}>
        <button type="button" className="dropdown-trigger dropdown-readonly" tabIndex={-1}>
          <span className="dropdown-item">
            {img(selected?.image)}
            <span className="dropdown-label">{selected?.label ?? '-'}</span>
          </span>
          <span className="dropdown-arrow" aria-hidden style={{ visibility: 'hidden' }}>▾</span>
        </button>
      </div>
    );
  }

  return (
    <div className={'dropdown' + (className ? ' ' + className : '')} ref={ref}>
      <button type="button" className="dropdown-trigger" disabled={disabled}
        onClick={(e) => { e.stopPropagation(); if (disabled) return; setOpen((o) => !o); }}>
        <span className="dropdown-item">
          {img(selected?.image)}
          <span className="dropdown-label">{selected?.label ?? '선택'}</span>
        </span>
        <span className="dropdown-arrow">▾</span>
      </button>
      {open && (
        <ul className="dropdown-menu">
          {options.map((o) => (
            <li key={o.value}
              className={'dropdown-option' + (o.value === value ? ' selected' : '') + (o.disabled ? ' disabled' : '')}
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (o.disabled) return; onChange(o.value); setOpen(false); }}>
              {img(o.image)}
              <span className="dropdown-label">{o.label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
