import { useRef, useState, type CSSProperties } from 'react';

/** 도달불가 경고(❗) + 안내 툴팁. 순수 CSS :hover 대신 JS 상태로 제어하고,
 *  테이블 클리핑을 피하려 position:fixed로 띄운다. 스타일은 최고점/크크작 안내문구(.help-tip)와 동일. */
export function WarnTip() {
  const ref = useRef<HTMLSpanElement>(null);
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const open = () => {
    const r = ref.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 4, left: Math.max(8, Math.min(r.left, window.innerWidth - 268)) });
    setShow(true);
  };
  const tip: CSSProperties = {
    position: 'fixed', top: pos.top, left: pos.left, zIndex: 100, width: 260,
    padding: '8px 10px', background: '#222', color: '#eee', border: '1px solid #555',
    borderRadius: 4, fontSize: '0.78rem', fontWeight: 'normal', lineHeight: 1.45,
    whiteSpace: 'normal', textAlign: 'left',
  };
  return (
    <span ref={ref} style={{ marginLeft: 4, cursor: 'help' }}
      onMouseEnter={open} onMouseLeave={() => setShow(false)}>
      ❗
      {show && <span style={tip}>이 조합으로는 목표 공명 효율 도달이 어려울 수 있습니다</span>}
    </span>
  );
}
