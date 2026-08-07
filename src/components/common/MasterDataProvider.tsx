'use client';

import {createContext, useCallback, useContext, useEffect, useState} from 'react';
import {MasterData,} from '@/types';
import {apiClient} from '@/lib/apiClient';

const EMPTY_MASTER_DATA: MasterData = {
  ROLES: [],
  PAYMENT_METHODS: [],
  ORDER_SOURCES: [],
  ITEM_STATUSES: [],
  DELIVERY_METHODS: [],
  DELIVERY_STATUSES: [],
  CARD_STATUSES: [],
  INVOICE_STATUSES: [],
  FLORIST_ASSIGNMENT_STATUSES: [],
  CURRENCY: [],
};

interface MasterDataContextValue {
  data: MasterData;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

const MasterDataContext = createContext<MasterDataContextValue | null>(null);

export function useMasterData() {
  const ctx = useContext(MasterDataContext);
  if (!ctx) {
    throw new Error('useMasterData must be used inside MasterDataProvider');
  }
  return ctx;
}

export default function MasterDataProvider({
                                             children,
                                           }: {
  children: React.ReactNode;
}) {
  const [data, setData] = useState<MasterData>(EMPTY_MASTER_DATA);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Dipakai buat trigger reload manual (lihat komentar di bawah).
  const [refreshKey, setRefreshKey] = useState(0);

  // Dipanggil dari luar effect (event handler), jadi aman setLoading(true)
  // langsung di sini. Cukup bump `refreshKey` biar effect di bawah jalan
  // lagi, tidak perlu duplikasi logic fetch-nya.
  const reload = useCallback(() => {
    setLoading(true);
    setRefreshKey((k) => k + 1);
  }, []);

  useEffect(() => {
    // Fetch-nya ditulis inline pakai .then()/.catch()/.finally() (bukan
    // fungsi terpisah yang dipanggil langsung) — react-hooks/set-state-in-effect
    // tetap menganggap "sinkron" kalau kita panggil fungsi lokal yang di
    // dalamnya ada setState, walau fungsi itu sendiri async/pakai await.
    // setState di dalam callback .then() inline begini baru dianggap aman.
    apiClient
      .get<{ masterData: MasterData }>('/api/master-data')
      .then(({ masterData }) => {
        setError(null);
        setData(masterData);
      })
      .catch((err) => {
        setError((err as Error).message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [refreshKey]);

  return (
    <MasterDataContext.Provider value={{ data, loading, error, reload }}>
      {children}
    </MasterDataContext.Provider>
  );
}