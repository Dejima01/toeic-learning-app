import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth } from '../firebase';
import { db } from '../firebase';

type ThemeChoice = 'light' | 'dark' | 'system';

interface ThemeContextType {
  isDark: boolean;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextType>({ isDark: false, toggle: () => {} });

function getInitialChoice(): ThemeChoice {
  try {
    const stored = localStorage.getItem('theme');
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  } catch {}
  return 'system';
}

function resolveIsDark(choice: ThemeChoice): boolean {
  if (choice === 'dark') return true;
  if (choice === 'light') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [choice, setChoice] = useState<ThemeChoice>(getInitialChoice);

  const isDark = resolveIsDark(choice);

  // html クラスを同期
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

  // system モード時は OS 変化を監視
  useEffect(() => {
    if (choice !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      document.documentElement.classList.toggle('dark', mq.matches);
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [choice]);

  // ログイン時: Firestore からテーマを読み込み（Firestore の値を優先）
  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      if (!user) return;
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        const saved = snap.data()?.theme;
        if (saved === 'light' || saved === 'dark') {
          try { localStorage.setItem('theme', saved); } catch {}
          setChoice(saved);
        }
      } catch {}
    });
  }, []);

  function toggle() {
    const next: ThemeChoice = isDark ? 'light' : 'dark';
    // localStorage に保存（次回リロード用）
    try { localStorage.setItem('theme', next); } catch {}
    setChoice(next);
    // ログイン中なら Firestore にも保存（他端末への同期用）
    const user = auth.currentUser;
    if (user) {
      setDoc(doc(db, 'users', user.uid), { theme: next }, { merge: true }).catch(() => {});
    }
  }

  return (
    <ThemeContext.Provider value={{ isDark, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
