'use client';

import { useEffect, useState } from 'react';
import {Button, Card, Space, Tag, Typography, Popconfirm, App, GetProp} from 'antd';
import RoleGuard from '@/components/common/RoleGuard';
import { useTelegramAuth } from '@/components/common/TelegramProvider';
import { apiClient } from '@/lib/apiClient';
import {TransactionWithDetails} from '@/types';
import { isOrderFullyDone } from '@/lib/statusUtils';

const { Title, Text, Paragraph } = Typography;

const STATUS_COLORS: Record<string, GetProp<typeof Tag, "color">> = {
  "NEW ORDER": 'default',
  "ON PROGRESS": 'processing',
  DONE: 'success',
  CANCELLED: "red",
  PENDING: "cyan",
  RESCHEDULED: "gold",
};
export default function FloristPage() {
  return (
    <RoleGuard allow={['FLORIST']}>
      <FloristContent />
    </RoleGuard>
  );
}

function FloristContent() {
  const { name } = useTelegramAuth();
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
      // Only orders that still have unfinished work for the florist.
      setOrders(
        res.orders.filter((o) =>
          o.details.some((d) => d.ITEM_STATUS === 'NEW ORDER' || d.ITEM_STATUS === 'ON PROGRESS' || d.ITEM_STATUS === 'DONE')
        )
      );
    } catch (err) {
      message.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function updateItemStatus(orderItemId: string, status: "ON PROGRESS" | "DONE") {
    setBusyKey(orderItemId);
    try {
      await apiClient.patch(`/api/transaction-details/${orderItemId}/status`, {
        ITEM_STATUS: status,
        FLORIST_NAME: name,
      });
      message.success(`Item diupdate ke ${status}`);
      await load();
    } catch (err) {
      message.error((err as Error).message);
    } finally {
      setBusyKey(null);
    }
  }

  async function markOrderDone(orderId: string) {
    setBusyKey(orderId);
    try {
      await apiClient.patch(`/api/transactions/${orderId}/status`, {
        status: 'READY_TO_PICKUP',
      });
      message.success('Transaksi ditandai selesai & siap diambil kurir');
      await load();
    } catch (err) {
      message.error((err as Error).message);
    } finally {
      setBusyKey(null);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <Title level={3}>Pekerjaan Florist</Title>
      <Paragraph type="secondary">
        Update status tiap item bunga, lalu tandai transaksi selesai jika semua item sudah DONE.
      </Paragraph>

      <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        {orders.map((order) => (
          <Card
            key={order.ORDER_ID}
            loading={loading}
            title={`${order.ORDER_ID} · ${order.CUSTOMER_NAME}`}
            extra={
              <Popconfirm
                title="Tandai seluruh transaksi ini selesai & siap diambil kurir?"
                onConfirm={() => markOrderDone(order.ORDER_ID)}
                disabled={!isOrderFullyDone(order.details)}
              >
                <Button
                  type="primary"
                  size="small"
                  disabled={!isOrderFullyDone(order.details)}
                  loading={busyKey === order.ORDER_ID}
                >
                  Update Transaksi ke Done
                </Button>
              </Popconfirm>
            }
          >
            <Space orientation="vertical" style={{ width: '100%' }}>
              {order.details.map((item) => (
                <Card key={item.ORDER_ITEM_ID} type="inner" size="small" title={item.ITEM_NAME}>
                  <Space orientation="vertical" size={4} style={{ width: '100%' }}>
                    <Text>Qty: {item.QUANTITY}</Text>
                    {item.CUSTOM_NOTES && <Text type="secondary">Catatan: {item.CUSTOM_NOTES}</Text>}
                    {item.CARD_TO && <Text type="secondary">Kartu untuk: {item.CARD_TO}</Text>}
                    {item.CARD_MESSAGE && <Text type="secondary">Pesan: {item.CARD_MESSAGE}</Text>}
                    <Space>
                      <Tag color={STATUS_COLORS[item.ITEM_STATUS] ?? 'default'}>
                        {item.ITEM_STATUS || 'NEW ORDER'}
                      </Tag>
                      <Button
                        size="small"
                        loading={busyKey === item.ORDER_ITEM_ID}
                        disabled={item.ITEM_STATUS === 'ON PROGRESS' || item.ITEM_STATUS === 'DONE'}
                        onClick={() => updateItemStatus(item.ORDER_ITEM_ID, 'ON PROGRESS')}
                      >
                        Mulai Kerjakan (WIP)
                      </Button>
                      <Button
                        size="small"
                        type="primary"
                        loading={busyKey === item.ORDER_ITEM_ID}
                        disabled={item.ITEM_STATUS === 'DONE'}
                        onClick={() => updateItemStatus(item.ORDER_ITEM_ID, 'DONE')}
                      >
                        Selesai (DONE)
                      </Button>
                    </Space>
                  </Space>
                </Card>
              ))}
            </Space>
          </Card>
        ))}
        {!loading && orders.length === 0 && <Text type="secondary">Tidak ada pekerjaan saat ini.</Text>}
      </Space>
    </div>
  );
}
