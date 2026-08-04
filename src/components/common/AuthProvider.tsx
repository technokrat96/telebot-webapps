'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Spin } from 'antd';
import { init } from '@tma.js/sdk';
import { retrieveRawInitData } from '@tma.js/sdk-react';
import { useAuthStore } from '@/store/authStore';
import LoginScreen from './LoginScreen';
import TelegramLinkGate from './TelegramLinkGate';
import SetPasswordGate from './SetPasswordGate';

interface AuthState {
  loading: boolean;
  error: string | null;
  name: string | null;
  roles: string[];
  username: string | null;
  telegramLinked: boolean;
  // true kalau AppUser.password sudah pernah di-set. Cuma relevan waktu
  // login lewat Telegram Mini App (login standalone browser sudah pasti
  // butuh password, jadi selalu true di jalur itu).
  hasPassword: boolean;
  // initData mentah yang tadi dipakai buat login-telegram — disimpan biar
  // SetPasswordGate bisa langsung panggil /api/auth/set-password tanpa
  // perlu retrieveRawInitData() ulang. Null di luar konteks Telegram.
  telegramInitData: string | null;
}

interface AuthContextValue extends AuthState {
  logout: () => void;
  refresh: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}

const DEV_STATE: AuthState = {
  loading: false,
  error: null,
  name: 'DEV',
  roles: ['ADMIN', 'FLORIST', 'KURIR'],
  username: 'DEV',
  telegramLinked: true,
  hasPassword: true,
  telegramInitData: null,
};

const EMPTY_STATE: AuthState = {
  loading: false,
  error: null,
  name: null,
  roles: [],
  username: null,
  telegramLinked: false,
  hasPassword: true,
  telegramInitData: null,
};

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  // const isDev = process.env.NODE_ENV !== 'production';
  const token = useAuthStore((s) => s.token);
  const clearToken = useAuthStore((s) => s.clear);
  const setToken = useAuthStore((s) => s.setToken);

  const [state, setState] = useState<AuthState>({ ...EMPTY_STATE, loading: true });

  const bootstrap = useCallback(async () => {
    // if (isDev) {
    //   setState(DEV_STATE);
    //   return;
    // }

    setState((s) => ({ ...s, loading: true, error: null }));

    // Dibuka dari dalam Telegram Mini App? Kalau iya, login diam-diam pakai
    // initData — TIDAK ADA form username/password sama sekali, dan
    // chatId/telegramId ikut ter-update di request ini juga.
    let rawInitData: string | undefined;
    try {
      init();
      rawInitData = retrieveRawInitData();
    } catch {
      rawInitData = undefined;
    }

    if (rawInitData) {
      try {
        const res = await fetch('/api/auth/login-telegram', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ initData: rawInitData }),
        });
        const data = await res.json();
        if (!res.ok) {
          setState({ ...EMPTY_STATE, error: data?.error ?? 'Gagal login lewat Telegram.' });
          return;
        }
        setToken(data.token as string);
        setState({
          loading: false,
          error: null,
          name: data.name,
          roles: data.roles ?? [],
          username: data.username,
          telegramLinked: true,
          hasPassword: !!data.hasPassword,
          telegramInitData: rawInitData,
        });
      } catch {
        setState({ ...EMPTY_STATE, error: 'Tidak bisa terhubung ke server.' });
      }
      return;
    }

    // Browser biasa di luar Telegram — pakai JWT tersimpan (kalau ada).
    // Dibaca langsung dari store (bukan dari closure `token` di luar) biar
    // selalu dapat nilai terbaru, termasuk pas dipanggil tepat setelah
    // LoginScreen berhasil login (lihat handleLoggedIn di bawah).
    const currentToken = useAuthStore.getState().token;
    if (!currentToken) {
      setState(EMPTY_STATE);
      return;
    }
    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${currentToken}` },
      });
      const data = await res.json();
      if (!res.ok) {
        clearToken();
        setState({ ...EMPTY_STATE, error: data?.error ?? 'Sesi berakhir, silakan login lagi.' });
        return;
      }
      setState({
        loading: false,
        error: null,
        name: data.name,
        roles: data.roles ?? [],
        username: data.username,
        telegramLinked: !!data.telegramLinked,
        hasPassword: !!data.hasPassword,
        telegramInitData: null,
      });
    } catch {
      setState((s) => ({ ...s, loading: false, error: 'Tidak bisa terhubung ke server.' }));
    }
  }, [clearToken, setToken]);

  // Dipanggil dari LoginScreen setelah login username/password sukses.
  // setToken() saja tidak cukup — tanpa bootstrap() ulang, `state` (nama,
  // roles, telegramLinked, hasPassword) akan tetap kosong/basi sampai
  // reload, dan render logic di bawah salah nebak (mis. nyasar ke
  // TelegramLinkGate padahal akun itu sebenarnya sudah telegramLinked).
  const handleLoggedIn = useCallback(
    (t: string) => {
      setToken(t);
      bootstrap();
    },
    [setToken, bootstrap]
  );

  // Effects only ever run in the browser (never during SSR), so this alone
  // already guarantees bootstrap() only fires client-side, after zustand's
  // persist middleware has rehydrated `token` from localStorage. The ref
  // just stops it from firing a second time if the effect re-runs (e.g.
  // React Strict Mode's dev-only double-invoke) — a ref survives that
  // without triggering a re-render the way a useState guard would.
  const didBootstrap = useRef(false);
  useEffect(() => {
    if (didBootstrap.current) return;
    didBootstrap.current = true;
    bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setState(EMPTY_STATE);
  }, [clearToken]);

  // Kalau user pilih "Lewati untuk sekarang" di SetPasswordGate, jangan
  // nagih lagi selama sesi/tab ini masih kebuka (di-reset kalau app dibuka
  // ulang, sengaja — supaya suatu saat tetap keingetan).
  const [passwordPromptSkipped, setPasswordPromptSkipped] = useState(false);

  const centered = (content: React.ReactNode) => (
    <div style={{ display: 'flex', justifyContent: 'center', minHeight: '100vh', alignItems: 'center' }}>
      {content}
    </div>
  );

  if (state.loading) {
    return centered(<Spin size="large" description="Memuat data..." />);
  }

  // Error duluan (mis. gagal login-telegram, atau JWT expired) — supaya
  // pesannya kepakai, bukan ketiban kondisi "belum ada token" di bawahnya.
  if (state.error) {
    return <LoginScreen onLoggedInAction={handleLoggedIn} initialError={state.error} />;
  }

  // Kalau tidak sedang di dalam Telegram Mini App (tidak ada login-telegram
  // yang jalan) dan belum ada JWT sama sekali, tampilkan form login.
  if (!token && !state.name) {
    return <LoginScreen onLoggedInAction={handleLoggedIn} />;
  }

  if (!state.telegramLinked) {
    return <TelegramLinkGate name={state.name} onRecheckAction={bootstrap} onLogoutAction={logout} />;
  }

  // Baru login dari Telegram Mini App dan belum pernah set password —
  // tawarkan sekarang juga, sebelum masuk ke aplikasi (bisa dilewati).
  if (state.telegramInitData && !state.hasPassword && !passwordPromptSkipped) {
    return (
      <SetPasswordGate
        name={state.name}
        initData={state.telegramInitData}
        onDoneAction={bootstrap}
        onSkipAction={() => setPasswordPromptSkipped(true)}
      />
    );
  }

  return (
    <AuthContext.Provider value={{ ...state, logout, refresh: bootstrap }}>
      {children}
    </AuthContext.Provider>
  );
}
