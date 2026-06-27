import { useState, useRef, useEffect } from 'react';

export interface DropdownOption {
  value: string;
  label: string;
  image?: string; // 없으면 텍스트만 표시
}

interface Props {
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
}

/** 그림(선택) + 텍스트를 지원하는 커스텀 드롭다운. 그림이 없거나 로드 실패 시 텍스트만 표시. */
export function Dropdown({ value, options, onChange }: Props) {
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

  return (
    <div className="dropdown" ref={ref}>
      <button type="button" className="dropdown-trigger" onClick={() => setOpen((o) => !o)}>
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
              className={'dropdown-option' + (o.value === value ? ' selected' : '')}
              onClick={() => { onChange(o.value); setOpen(false); }}>
              {img(o.image)}
              <span className="dropdown-label">{o.label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
