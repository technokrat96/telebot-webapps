'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {Button, Card, Form, Input, InputNumber, Table, Tag, Typography, App} from 'antd';
import RoleGuard from '@/components/common/RoleGuard';
import { apiClient } from '@/lib/apiClient';
import { Transaction, TransactionWithDetails } from '@/types';
import TransactionForm, {TransactionFormValues} from "@/components/transaction/TransactionForm";

const { Title } = Typography;

export default function EditTransactionPage() {
  return (
    <RoleGuard allow={['ADMIN']}>
      <EditTransactionContent />
    </RoleGuard>
  );
}

function EditTransactionContent() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [form] = Form.useForm<Transaction>();
  const [order, setOrder] = useState<TransactionWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { message } = App.useApp();

  useEffect(() => {
    apiClient
      .get<{ transaction: TransactionWithDetails }>(`/api/transactions/${id}`)
      .then((res) => {
        setOrder(res.transaction);
        form.setFieldsValue(res.transaction);
      })
      .catch((err) => message.error(err.message))
      .finally(() => setLoading(false));
  }, [id, form]);

  async function handleSave(values: TransactionFormValues) {
    setSaving(true);
    try {
      await apiClient.put(`/api/transactions/${id}`, values);
      message.success('Perubahan disimpan');
      router.push('/admin/transaction');
    } catch (err) {
      message.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <Title level={3}>Ubah Transaksi {id}</Title>
      <TransactionForm onSubmitAction={handleSave} submitting={loading || saving} />
    </div>
  );
}
