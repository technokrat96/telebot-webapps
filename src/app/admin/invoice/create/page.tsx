'use client';

import { useEffect, useState } from 'react';
import { Typography, App, Table, Tag, Button, Progress, Space } from 'antd';
import { useRouter } from 'next/navigation';
import RoleGuard from '@/components/common/RoleGuard';
import { apiClient } from '@/lib/apiClient';
import { TransactionWithBilling } from '@/types';

const { Title, Paragraph } = Typography;

const STATUS_LABELS: Record<TransactionWithBilling['invoiceStatus'], string> = {
  NOT_INVOICED: 'Belum Ditagih',
  PARTIAL: 'Sebagian Ditagih',
  FULLY_INVOICED: 'Sudah Lunas Ditagih',
};

const STATUS_COLORS: Record<TransactionWithBilling['invoiceStatus'], string> = {
  NOT_INVOICED: 'default',
  PARTIAL: 'gold',
  FULLY_INVOICED: 'green',
};

export default function CreateInvoicePickTransactionPage() {
  return (
    <RoleGuard allow={['ADMIN']}>
      <PickTransactionContent />
    </RoleGuard>
  );
}

function PickTransactionContent() {
  const [orders, setOrders] = useState<TransactionWithBilling[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { message } = App.useApp();

  useEffect(() => {
    apiClient
      .get<{ orders: TransactionWithBilling[] }>('/api/invoice-details')
      .then((res) => setOrders(res.orders))
      .catch((err) => message.error(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <Title level={3}>Pilih Transaksi untuk Ditagih</Title>
      <Paragraph type="secondary">
        Pilih transaksi yang mau dibuatkan invoice. Transaksi yang sudah lunas ditagih
        (semua qty item sudah masuk invoice) tidak bisa dibuatkan invoice baru lagi.
      </Paragraph>
      <Table
        rowKey="ORDER_ID"
        loading={loading}
        dataSource={orders}
        scroll={{ x: true }}
        columns={[
          { title: 'Order ID', dataIndex: 'ORDER_ID' },
          { title: 'Pelanggan', dataIndex: 'CUSTOMER_NAME' },
          {
            title: 'Progress Penagihan',
            key: 'progress',
            width: 220,
            render: (_, r) => {
              const totalQty = r.details.reduce((s, d) => s + Number(d.QUANTITY || 0), 0);
              const billedQty = r.details.reduce((s, d) => s + Number(d.billedQty || 0), 0);
              const percent = totalQty ? Math.round((billedQty / totalQty) * 100) : 0;
              return (
                <Space orientation="vertical" size={4} style={{ width: '100%' }}>
                  <Progress
                    percent={percent}
                    size="small"
                    format={() => `${billedQty}/${totalQty} qty ditagih`}
                  />
                  <Tag color={STATUS_COLORS[r.invoiceStatus]}>
                    {STATUS_LABELS[r.invoiceStatus]}
                  </Tag>
                </Space>
              );
            },
          },
          {
            title: 'Grand Total',
            dataIndex: 'GRAND_TOTAL',
            render: (v, r) => (r.GRAND_TOTAL || 0).toLocaleString('id-ID'),
          },
          {
            title: 'Aksi',
            key: 'action',
            render: (_, r) => (
              <Button
                type="primary"
                size="small"
                disabled={r.invoiceStatus === 'FULLY_INVOICED'}
                onClick={() => router.push(`/admin/invoice/create/${r.ORDER_ID}`)}
              >
                Buat Invoice
              </Button>
            ),
          },
        ]}
      />
    </div>
  );
}