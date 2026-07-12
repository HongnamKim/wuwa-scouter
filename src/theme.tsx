import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type Theme = 'dark' | 'light';

export interface ThemeVars {
  bg: string; fg: string; muted: string; rule: string;
  card: string; cardBorder: string; portrait: string;
  chipBase: string; stat: string; ghost: string;
  ctrl: string; ctrlBorder: string; menu: string; hover: string;
  code: string; codebg: string;
}

const THEMES: Record<Theme, ThemeVars> = {
  dark: {
    bg: '#0b0e15', fg: '#e7ebf3', muted: '#828b9f', rule: 'rgba(255,255,255,0.09)',
    card: '#121620', cardBorder: 'rgba(255,255,255,0.07)', portrait: '#0e1118',
    chipBase: '#12151d', stat: 'rgba(255,255,255,0.04)', ghost: '#5c6577',
    ctrl: '#141924', ctrlBorder: 'rgba(255,255,255,0.11)', menu: '#161b26', hover: 'rgba(255,255,255,0.06)',
    code: '#e6c46b', codebg: 'rgba(199,155,59,0.12)',
  },
  light: {
    bg: '#eef1f7', fg: '#182130', muted: '#6c7688', rule: '#d7dde7',
    card: '#ffffff', cardBorder: '#e5e9f1', portrait: '#f5f7fb',
    chipBase: '#ffffff', stat: '#f3f5f9', ghost: '#aab2c0',
    ctrl: '#ffffff', ctrlBorder: '#d8dee8', menu: '#ffffff', hover: '#eef2f8',
    code: '#8a6d1e', codebg: '#faf4e4',
  },
};

export const ACCENT = '#c79b3b';

/** 속성별 강조색(카드 테두리·칩). */
export const ELEMENT_COLOR: Record<string, string> = {
  '응결': '#7cd4ff', '용융': '#ff7d5a', '전도': '#c191ff',
  '기류': '#4fe3b0', '회절': '#ffd45f', '인멸': '#ec6bd6',
};

const KEY = 'wuwa-scouter:theme';

interface ThemeCtx { theme: Theme; vars: ThemeVars; toggle: () => void; }
const ThemeContext = createContext<ThemeCtx | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    try { const t = localStorage.getItem(KEY); return t === 'light' || t === 'dark' ? t : 'dark'; } catch { return 'dark'; }
  });
  useEffect(() => {
    try { localStorage.setItem(KEY, theme); } catch { /* noop */ }
    document.documentElement.setAttribute('data-theme', theme);
    document.body.style.background = THEMES[theme].bg;
    document.body.style.color = THEMES[theme].fg;
    document.body.style.transition = 'background .35s ease, color .35s ease';
  }, [theme]);
  const toggle = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  return <ThemeContext.Provider value={{ theme, vars: THEMES[theme], toggle }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeCtx {
  const c = useContext(ThemeContext);
  if (!c) throw new Error('useTheme must be used within ThemeProvider');
  return c;
}
