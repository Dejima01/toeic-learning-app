import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { warmupProxy } from './lib/proxyClient';
import { AuthProvider } from './contexts/AuthContext';
import { PrivateRoute } from './components/PrivateRoute';

// 認証ページ
import EntryPage from './pages/EntryPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import PasswordResetPage from './pages/PasswordResetPage';

// ログイン後ページ
import HomePage from './pages/HomePage';
import SettingsPage from './pages/SettingsPage';

// フェーズ4: 単語モード
import WordChapterListPage from './pages/WordChapterListPage';
import WordChapterPage from './pages/WordChapterPage';

// フェーズ5: 文法モード
import GrammarChapterListPage from './pages/GrammarChapterListPage';
import GrammarChapterPage from './pages/GrammarChapterPage';

// フェーズ6: 復習問題一覧
import ReviewListPage from './pages/ReviewListPage';

// フェーズ7: ランク認定テスト
import RankTestPage from './pages/RankTestPage';


function AppRoutes() {
  useEffect(() => {
    warmupProxy();
  }, []);

  return (
    <Routes>
      {/* ── 認証不要 ── */}
      <Route path="/" element={<EntryPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<PasswordResetPage />} />

      {/* ── 要ログイン ── */}
      <Route path="/home" element={<PrivateRoute><HomePage /></PrivateRoute>} />
      <Route path="/settings" element={<PrivateRoute><SettingsPage /></PrivateRoute>} />

      {/* フェーズ4: 単語モード */}
      <Route path="/word" element={<PrivateRoute><WordChapterListPage /></PrivateRoute>} />
      <Route path="/word/:level/:chapter" element={<PrivateRoute><WordChapterPage /></PrivateRoute>} />

      {/* フェーズ5: 文法モード */}
      <Route path="/grammar" element={<PrivateRoute><GrammarChapterListPage /></PrivateRoute>} />
      <Route path="/grammar/:level/:chapter" element={<PrivateRoute><GrammarChapterPage /></PrivateRoute>} />

      {/* フェーズ6: 復習問題一覧 */}
      <Route path="/review" element={<PrivateRoute><ReviewListPage /></PrivateRoute>} />

      {/* フェーズ7: ランク認定テスト */}
      <Route path="/rank-test" element={<PrivateRoute><RankTestPage /></PrivateRoute>} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
