'use client';

import { useEffect, useState } from 'react';
import {Button, Typography, App, Table} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import RoleGuard from '@/components/common/RoleGuard';
import InvoiceListTable from '@/components/invoice/InvoiceListTable';
import { apiClient } from '@/lib/apiClient';
import {InvoiceWithDetails, TransactionWithDetails} from '@/types';

const { Title } = Typography;


interface BillableRow {
  ORDER_ID: string;
  ORDER_ITEM_ID: string;
  ITEM_NAME: string;
  QUANTITY: number;
  UNIT_PRICE: number;
  SUBTOTAL: number;
}

export default function AdminInvoicePage() {
  return (
    <RoleGuard allow={['ADMIN']}>
      <InvoiceListContent />
    </RoleGuard>
  );
}

function InvoiceListContent() {
  const [data, setData] = useState<InvoiceWithDetails[]>([]);
  const [rows, setRows] = useState<BillableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { message } = App.useApp();

  useEffect(() => {
    apiClient
      .get<{ invoices: InvoiceWithDetails[] }>('/api/invoices')
      .then((res) => setData(res.invoices))
      .catch((err) => message.error(err.message))
      .finally(() => setLoading(false));
    apiClient
      .get<{ orders: TransactionWithDetails[] }>('/api/invoice-details')
      .then((res) => {
        const flat: BillableRow[] = res.orders.flatMap((order) =>
          order.details.map((d) => ({
            ORDER_ID: order.ORDER_ID,
            ORDER_ITEM_ID: d.ORDER_ITEM_ID,
            ITEM_NAME: d.ITEM_NAME,
            QUANTITY: d.QUANTITY,
            UNIT_PRICE: d.UNIT_PRICE,
            SUBTOTAL: d.SUBTOTAL,
          }))
        );
        setRows(flat);
      })
      .catch((err) => message.error(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>
          Invoice
        </Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => router.push('/admin/invoice/create')}
        >
          Buat Invoice
        </Button>
      </div>
      <Table
        rowKey="ORDER_ITEM_ID"
        loading={loading}
        dataSource={rows}
        size="small"
        pagination={false}
        columns={[
          { title: 'Order ID', dataIndex: 'ORDER_ID' },
          { title: 'Item', dataIndex: 'ITEM_NAME' },
          { title: 'Qty', dataIndex: 'QUANTITY' },
          {
            title: 'Subtotal',
            dataIndex: 'SUBTOTAL',
            render: (v) => Number(v || 0).toLocaleString('id-ID'),
          },
        ]}
      />
      <InvoiceListTable data={data} loading={loading} />
    </div>
  );
}
