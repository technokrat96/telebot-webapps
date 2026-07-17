'use client';

import { useEffect, useState } from 'react';
import {Button, Typography, App} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import RoleGuard from '@/components/common/RoleGuard';
import TransactionListTable from '@/components/transaction/TransactionListTable';
import { apiClient } from '@/lib/apiClient';
import { TransactionWithDetails } from '@/types';

const { Title } = Typography;

export default function AdminTransactionPage() {
  return (
    <RoleGuard allow={['ADMIN']}>
      <TransactionListContent />
    </RoleGuard>
  );
}

function TransactionListContent() {
  const [data, setData] = useState<TransactionWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { message } = App.useApp();

  useEffect(() => {
    apiClient
      .get<{ transactions: TransactionWithDetails[] }>('/api/transactions')
      .then((res) => setData(res.transactions))
      .catch((err) => {
        message.error(err.message)
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>
          Transaksi
        </Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => router.push('/admin/transaction/create')}
        >
          Buat Transaksi
        </Button>
      </div>
      <TransactionListTable data={data} loading={loading} />
    </div>
  );
}
