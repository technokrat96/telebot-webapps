'use client';

import {useEffect, useState} from 'react';
import {useParams, useRouter} from 'next/navigation';
import {App, Form, Spin, Typography} from 'antd';
import RoleGuard from '@/components/common/RoleGuard';
import {apiClient} from '@/lib/apiClient';
import {Transaction, TransactionDetail, TransactionWithDetails} from '@/types';
import TransactionForm, {TransactionFormValues} from "@/components/transaction/TransactionForm";
import clientDayJs from "@/lib/cleint.dayjs";

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
  const [form] = Form.useForm<TransactionFormValues>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { message } = App.useApp();

  useEffect(() => {
    apiClient
      .get<{ transaction: TransactionWithDetails }>(`/api/transactions/${id}`)
      .then((res) => {
        const {
          RECEIVER_NAME,
          RECEIVER_ADDRESS,
          RECEIVER_PHONE,
          CARD_TO,
          CARD_FROM,
          CARD_MESSAGE,
          CARD_NOTE,
          CARD_CREATED_BY,
          DELIVERY_METHOD,
          DELIVERY_DATE,
          DELIVERY_TIME,
          SHIPPING_FEE,
        } = res.transaction.details[0];

        const deliveryDate = DELIVERY_DATE ? clientDayJs(DELIVERY_DATE) : undefined;
        const deliveryTime = DELIVERY_TIME ? clientDayJs(DELIVERY_TIME) : undefined;

        form.setFieldsValue({
          ...res.transaction,
          RECEIVER_NAME,
          RECEIVER_ADDRESS,
          RECEIVER_PHONE,
          CARD_TO,
          CARD_FROM,
          CARD_MESSAGE,
          CARD_NOTE,
          CARD_CREATED_BY,
          DELIVERY_METHOD,
          DELIVERY_DATE: deliveryDate,
          DELIVERY_TIME: deliveryTime,
          SHIPPING_FEE,
        });
      })
      .catch((err) => message.error(err.message))
      .finally(() => setLoading(false));
  }, [id, form]);

  async function handleSave(values: TransactionFormValues): Promise<boolean> {
    setSaving(true);
    try {
      const {
        details,
        // order-level fields that get copied into every line item
        RECEIVER_NAME,
        RECEIVER_ADDRESS,
        RECEIVER_PHONE,
        CARD_TO,
        CARD_FROM,
        CARD_MESSAGE,
        CARD_NOTE,
        CARD_CREATED_BY,
        DELIVERY_METHOD,
        DELIVERY_DATE,
        DELIVERY_TIME,
        SHIPPING_FEE,
        ...transaction
      } = values;

      const deliveryDate = DELIVERY_DATE ? clientDayJs(DELIVERY_DATE).format('YYYY-MM-DD') : '';
      const deliveryTime = DELIVERY_TIME ? clientDayJs(DELIVERY_TIME).format('HH:mm') : '';

      await apiClient.put(`/api/transactions/${id}`, {
        transaction: {
          ...transaction,
        } as Transaction,
        details: (details ?? []).map((d) => ({
          ...d,
          RECEIVER_NAME,
          RECEIVER_ADDRESS,
          RECEIVER_PHONE,
          CARD_TO,
          CARD_FROM,
          CARD_MESSAGE,
          CARD_NOTE,
          CARD_CREATED_BY,
          DELIVERY_METHOD,
          DELIVERY_DATE: deliveryDate,
          DELIVERY_TIME: deliveryTime,
          SHIPPING_FEE,
        })) as TransactionDetail[],
      });
      message.success('Perubahan disimpan');
      router.push('/admin/transaction');
      return true;
    } catch (err) {
      message.error((err as Error).message);
      return false;
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <Title level={3}>Ubah Transaksi {id}</Title>
      <Spin spinning={loading} description="Memuat data transaksi...">
        <TransactionForm form={form} onSubmitAction={handleSave} submitting={saving} />
      </Spin>
    </div>
  );
}
