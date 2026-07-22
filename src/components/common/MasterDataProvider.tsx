'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  MasterData,
} from '@/types';
import { apiClient } from '@/lib/apiClient';

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

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { masterData } = await apiClient.get<{ masterData: MasterData }>('/api/master-data');
      setData(masterData );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <MasterDataContext.Provider value={{ data, loading, error, reload: load }}>
      {children}
    </MasterDataContext.Provider>
  );
}