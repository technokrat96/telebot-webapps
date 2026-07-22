'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Alert, Spin } from 'antd';
import {init} from "@tma.js/sdk";
import { retrieveRawInitData } from "@tma.js/sdk-react";

interface AuthState {
  loading: boolean;
  error: string | null;
  name: string | null;
  /** A user can hold more than one role (e.g. ADMIN + FLORIST). */
  roles: string[];
  username: string | null;
}

interface TelegramContextValue extends AuthState {
  retry: () => void;
}

const TelegramContext = createContext<TelegramContextValue | null>(null);

export function useTelegramAuth() {
  const ctx = useContext(TelegramContext);
  if (!ctx) {
    throw new Error('useTelegramAuth must be used inside TelegramProvider');
  }
  return ctx;
}

export default function TelegramProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [state, setState] = useState<AuthState>({
    loading: true,
    error: null,
    name: null,
    roles: [],
    username: null,
  });

  const authenticate = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));

    // Binds the SDK to the current Telegram WebApp environment (safe to
    // call more than once). Throws outside of Telegram — that's expected
    // in local/dev browsing, so we fall through to the dev fallback below.
    let retrieveRawInitDataResult: string | undefined;
    try {
      init();
      retrieveRawInitDataResult = retrieveRawInitData();
    } catch {
      retrieveRawInitDataResult = undefined;
    }

    // Local/dev fallback: allow testing outside Telegram by skipping auth.
    if (!retrieveRawInitDataResult) {
      if (process.env.NODE_ENV !== 'production') {
        // Has all 3 roles so you can click around every page locally
        // without going through Telegram. Narrow this down (e.g.
        // ['FLORIST']) if you want to test a single-role view.
        setState({
          loading: false,
          error: null,
          name: 'DEV',
          roles: ['ADMIN', 'FLORIST', 'KURIR'],
          username: 'DEV',
        });
        return;
      }
      setState({
        loading: false,
        error: 'App ini harus dibuka lewat Telegram Mini App.',
        name: null,
        roles: [],
        username: null,
      });
      return;
    }

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData: retrieveRawInitDataResult }),
      });
      const data = await res.json();

      if (!res.ok) {
        setState({
          loading: false,
          error: data?.error ?? 'Gagal login.',
          name: null,
          roles: [],
          username: null,
        });
        return;
      }

      setState({
        loading: false,
        error: null,
        name: data.name,
        roles: data.roles ?? [],
        username: data.username,
      });
    } catch {
      setState({
        loading: false,
        error: 'Tidak bisa terhubung ke server.',
        name: null,
        roles: [],
        username: null,
      });
    }
  }, []);

  useEffect(() => {
    authenticate();
  }, [authenticate]);

  return (
    <TelegramContext.Provider value={{ ...state, retry: authenticate }}>
      {state.loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', minHeight: "100vh", alignItems: "center" }}>
          <Spin size="large" description="Memuat data..." />
        </div>
      ) : state.error ? (
        <div style={{ padding: 24 }}>
          <Alert type="error" title="Tidak bisa masuk" description={state.error} showIcon />
        </div>
      ) : (
        children
      )}
    </TelegramContext.Provider>
  );
}
