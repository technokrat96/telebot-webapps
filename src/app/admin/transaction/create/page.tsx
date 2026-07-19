'use client';

import {useState} from 'react';
import {message, Typography} from 'antd';
import {useRouter} from 'next/navigation';
import RoleGuard from '@/components/common/RoleGuard';
import TransactionForm, {TransactionFormValues,} from '@/components/transaction/TransactionForm';
import {apiClient} from '@/lib/apiClient';
import {useTelegramAuth} from "@/components/common/TelegramProvider";
import dayjs from "dayjs";
import {generateOrderId, generateOrderItemId} from "@/lib/generateId";

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
  const { name, roles, username } = useTelegramAuth();

  async function handleSubmit(values: TransactionFormValues) {
    setSubmitting(true);
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
        CARD_CREATED_BY,
        DELIVERY_METHOD,
        DELIVERY_DATE,
        DELIVERY_TIME,
        DELIVERY_BY,
        SHIPPING_FEE,
        ...transaction
      } = values;

      const orderId = generateOrderId();
      const deliveryDate = DELIVERY_DATE ? dayjs(DELIVERY_DATE as never).format('YYYY-MM-DD') : '';
      const deliveryTime = DELIVERY_TIME ? dayjs(DELIVERY_TIME as never).format('HH:mm') : '';

      await apiClient.post('/api/transactions', {
        transaction: { ...transaction, ORDER_ID: orderId },
        details: (details ?? []).map((d, idx) => ({
          ...d,
          ORDER_ID: orderId,
          ORDER_ITEM_ID: generateOrderItemId(orderId, idx),
          RECEIVER_NAME,
          RECEIVER_ADDRESS,
          RECEIVER_PHONE,
          CARD_TO,
          CARD_FROM,
          CARD_MESSAGE,
          CARD_CREATED_BY,
          DELIVERY_METHOD,
          DELIVERY_DATE: deliveryDate,
          DELIVERY_TIME: deliveryTime,
          DELIVERY_BY,
          SHIPPING_FEE,
          ITEM_STATUS: 'NEW ORDER',
          CARD_STATUS: 'NEW ORDER',
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
