'use client';

import { useEffect, useState } from 'react';
import {Button, Card, Space, Tag, Typography, App} from 'antd';
import RoleGuard from '@/components/common/RoleGuard';
import { apiClient } from '@/lib/apiClient';
import {DeliveryStatus, ItemStatus, TransactionWithDetails} from '@/types';
import { filterOrdersByDeliveryStatus } from '@/lib/statusUtils';

const { Title, Text, Paragraph } = Typography;

// Next available action for an order currently at a given status.
const NEXT_ACTION: Partial<Record<DeliveryStatus, { label: string; next: DeliveryStatus }[]>> = {
  PICKUP: [{ label: 'Mulai Antar (On Delivery)', next: 'ON DELIVERY' }],
  "ON DELIVERY": [
    { label: 'Sudah Terkirim (Delivered)', next: 'DELIVERED' },
    { label: 'Dikembalikan (Returned)', next: 'RETURNED' },
  ],
  DELIVERED: [{ label: 'Diterima Pelanggan (Received)', next: 'RECEIVED' }],
};

const STATUS_COLORS: Record<string, string> = {
  READY_TO_PICKUP: 'gold',
  ON_DELIVERY: 'blue',
  DELIVERED: 'cyan',
  RECEIVED: 'green',
  RETURNED: 'red',
};

export default function KurirPage() {
  return (
    <RoleGuard allow={['KURIR']}>
      <KurirContent />
    </RoleGuard>
  );
}

function KurirContent() {
  const [orders, setOrders] = useState<TransactionWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const { message } = App.useApp();

  async function load() {
    setLoading(true);
    try {
      const res = await apiClient.get<{ orders: TransactionWithDetails[] }>(
        '/api/transaction-details'
      );
      const relevantStatuses: DeliveryStatus[] = [
        'PICKUP',
        'ON DELIVERY',
        'DELIVERED',
      ];
      const relevant = relevantStatuses.flatMap((status) =>
        filterOrdersByDeliveryStatus(res.orders, status)
      );
      setOrders(relevant);
    } catch (err) {
      message.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function advance(orderId: string, status: ItemStatus) {
    setBusyKey(orderId);
    try {
      await apiClient.patch(`/api/transactions/${orderId}/status`, { status });
      message.success(`Status pesanan diubah ke ${status}`);
      await load();
    } catch (err) {
      message.error((err as Error).message);
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div>
      <Title level={3}>Pengiriman</Title>
      <Paragraph type="secondary">
        Daftar pesanan yang siap diambil dan sedang dalam proses pengiriman.
      </Paragraph>

      <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        {orders.map((order) => {
          const currentStatus = order.details[0]?.ITEM_STATUS as ItemStatus;
          const actions = NEXT_ACTION[currentStatus] ?? [];
          return (
            <Card key={order.ORDER_ID} loading={loading} title={`${order.ORDER_ID} · ${order.CUSTOMER_NAME}`}>
              <Space orientation="vertical" style={{ width: '100%' }}>
                <Text>Alamat: {order.CUSTOMER_ADDRESS}</Text>
                <Text>Telepon: {order.CUSTOMER_PHONE}</Text>
                <Tag color={STATUS_COLORS[currentStatus] ?? 'default'}>{currentStatus}</Tag>
                <Space wrap>
                  {actions.map((action) => (
                    <Button
                      key={action.next}
                      type="primary"
                      loading={busyKey === order.ORDER_ID}
                      onClick={() => advance(order.ORDER_ID, action.next)}
                    >
                      {action.label}
                    </Button>
                  ))}
                </Space>
              </Space>
            </Card>
          );
        })}
        {!loading && orders.length === 0 && (
          <Text type="secondary">Belum ada pesanan yang siap diambil.</Text>
        )}
      </Space>
    </div>
  );
}
