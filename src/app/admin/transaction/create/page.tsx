'use client';

import { useState } from 'react';
import { Typography, message } from 'antd';
import { useRouter } from 'next/navigation';
import RoleGuard from '@/components/common/RoleGuard';
import TransactionForm, {
  TransactionFormValues,
} from '@/components/transaction/TransactionForm';
import { apiClient } from '@/lib/apiClient';

const { Title } = Typography;

export default function CreateTransactionPage() {
  return (
    <RoleGuard allow={['ADMIN']}>
      <CreateTransactionContent />
    </RoleGuard>
  );
}

function CreateTransactionContent() {
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  async function handleSubmit(values: TransactionFormValues) {
    setSubmitting(true);
    try {
      const { details, ...transaction } = values;
      await apiClient.post('/api/transactions', {
        transaction: { ...transaction, ORDER_ID: values.ORDER_ID },
        details: (details ?? []).map((d) => ({
          ...d,
          ITEM_STATUS: 'NEW',
        })),
      });
      message.success('Transaksi berhasil dibuat');
      router.push('/admin/transaction');
    } catch (err) {
      message.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <Title level={3}>Buat Transaksi</Title>
      <TransactionForm onSubmitAction={handleSubmit} submitting={submitting} />
    </div>
  );
}
