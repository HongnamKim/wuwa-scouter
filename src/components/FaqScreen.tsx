import { marked } from 'marked';
import faqMd from '../content/faq.md?raw';

// 자체 정적 마크다운이라 XSS 위험 없음. 모듈 로드 시 1회 변환.
const html = marked.parse(faqMd, { async: false }) as string;

/** FAQ/소개 화면: src/content/faq.md를 렌더. 내용 수정은 마크다운 파일만 편집. */
export function FaqScreen() {
  return <div className="markdown-body" dangerouslySetInnerHTML={{ __html: html }} />;
}
