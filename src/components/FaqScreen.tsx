import type { CSSProperties } from 'react';
import { marked } from 'marked';
import faqMd from '../content/faq.md?raw';
import { useTheme, ACCENT } from '../theme';

// 자체 정적 마크다운이라 XSS 위험 없음. 모듈 로드 시 1회 변환.
// h2(섹션)에 순차 앵커 id(#s1..)를 부여해 상단 pill 네비와 연결.
const html = (() => {
  let n = 0;
  return (marked.parse(faqMd, { async: false }) as string).replace(/<h2>/g, () => `<h2 id="s${++n}">`);
})();
// 섹션(h2) 제목 → 상단 pill 네비
const sections = [...faqMd.matchAll(/^## (.+)$/gm)].map((m, i) => ({ id: `s${i + 1}`, title: m[1].trim() }));

/** FAQ/소개 화면: src/content/faq.md를 렌더(테마 인식 스타일). 내용 수정은 마크다운 파일만 편집. */
export function FaqScreen() {
  const { vars } = useTheme();
  const cssVars = {
    '--faq-fg': vars.fg, '--faq-muted': vars.muted, '--faq-rule': vars.rule,
    '--faq-code': vars.code, '--faq-codebg': vars.codebg,
  } as CSSProperties;
  return (
    <div style={{ maxWidth: 840, margin: '0 auto', ...cssVars }}>
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontFamily: 'var(--mono)', fontSize: '0.72rem', letterSpacing: '0.22em', color: ACCENT, fontWeight: 600, marginBottom: 10 }}>GUIDE · FAQ</div>
        <h1 style={{ margin: 0, fontSize: 'clamp(1.7rem,3.4vw,2.35rem)', fontWeight: 800, letterSpacing: '-0.02em', color: vars.fg }}>소개 &amp; 자주 묻는 질문</h1>
        <p style={{ margin: '12px 0 0', color: vars.muted, fontSize: '0.95rem', lineHeight: 1.65, maxWidth: 600 }}>명조스카우터가 무엇을 계산하고, 점수를 어떻게 읽어야 하는지 정리했습니다.</p>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 44 }}>
        {sections.map((s) => (
          <a key={s.id} href={`#${s.id}`} className="faq-pill"
            style={{ padding: '8px 14px', borderRadius: 999, border: `1px solid ${vars.cardBorder}`, background: vars.card, fontSize: '0.84rem', fontWeight: 600, color: vars.fg }}>{s.title}</a>
        ))}
      </div>

      <div className="markdown-body" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
