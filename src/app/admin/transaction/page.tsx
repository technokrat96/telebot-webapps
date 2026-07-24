'use client';

import {useEffect, useRef, useState} from 'react';
import {Button, Typography, App, Tooltip, Progress, Spin} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import RoleGuard from '@/components/common/RoleGuard';
import TransactionListTable from '@/components/transaction/TransactionListTable';
import { apiClient } from '@/lib/apiClient';
import {TransactionWithDetails, TransactionWithDetailsAndAssignments} from '@/types';
import useSWR from "swr";

const { Title } = Typography;

type TransactionListResponse = {
  transactions: TransactionWithDetailsAndAssignments[];
  total: number;
};

const fetcher = (url: string) => apiClient.get<TransactionListResponse>(url);
const POLL_INTERVAL = 1000 * 5;

export default function AdminTransactionPage() {
  return (
    <RoleGuard allow={['ADMIN']}>
      <TransactionListContent />
    </RoleGuard>
  );
}

function usePollingProgress(intervalMs: number) {
  const [progress, setProgress] = useState(0);
  const startRef = useRef<number | null>(null); // null dulu, bukan Date.now()

  useEffect(() => {
    // Set nilai awal di sini (dalam efek = boleh, karena ini side effect,
    // bukan proses render murni)
    if (startRef.current === null) {
      startRef.current = Date.now();
    }

    const tick = setInterval(() => {
      const elapsed = Date.now() - (startRef.current ?? Date.now());
      setProgress(Math.min(100, (elapsed / intervalMs) * 100));
    }, 100);

    return () => clearInterval(tick);
  }, [intervalMs]);

  function reset() {
    startRef.current = Date.now(); // ini dipanggil dari event handler/callback (onSuccess), bukan saat render, jadi aman
    setProgress(0);
  }

  return { progress, reset };
}

function TransactionListContent() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const router = useRouter();
  const { message } = App.useApp();
  const { progress, reset } = usePollingProgress(POLL_INTERVAL);

  // useEffect(() => {
  //   apiClient
  //     .get<{ transactions: TransactionWithDetailsAndAssignments[]; total: number }>(
  //       `/api/transactions?page=${page}&pageSize=${pageSize}`
  //     )
  //     .then((res) => {
  //       setData(res.transactions);
  //       setTotal(res.total);
  //     })
  //     .catch((err) => {
  //       message.error(err.message)
  //     })
  //     .finally(() => setLoading(false));
  // }, [page, pageSize]);

  const { data, isLoading, error } = useSWR<TransactionListResponse>(
    `/api/transactions?page=${page}&pageSize=${pageSize}`,
    fetcher,
    {
      refreshInterval: POLL_INTERVAL,
      onSuccess: reset, // progress balik ke 0 tiap kali fetch sukses
      keepPreviousData: true, // biar pas ganti halaman gak flash loading, tabel lama tetep kelihatan sampe data baru datang
    }
  );

  if (error) message.error(error.message);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <Title level={3} style={{ margin: 0 }}>Pekerjaan Florist</Title>
          <Tooltip title="Waktu sampai refresh data berikutnya" placement={"right"}>
            <Progress
              type="circle"
              percent={progress}
              size={28}
              showInfo={false}
            />
          </Tooltip>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => router.push('/admin/transaction/create')}
        >
          Buat Transaksi
        </Button>
      </div>
      <TransactionListTable
        data={data?.transactions ?? []}
        loading={isLoading}
        pagination={{
          current: page,
          pageSize,
          total: data?.total ?? 0,
          showSizeChanger: true,
          showTotal: (t) => `Total ${t} transaksi`,
          onChange: (nextPage, nextPageSize) => {
            setPage(nextPage);
            setPageSize(nextPageSize);
          },
          onShowSizeChange: (nextPage, nextPageSize) => {
            setPage(nextPage);
            setPageSize(nextPageSize);
          },
        }}
      />
    </div>
  );
}
