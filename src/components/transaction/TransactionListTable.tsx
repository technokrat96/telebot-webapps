'use client';

import { Table, Tag, Button, Typography, Space } from 'antd';
import { useRouter } from 'next/navigation';
import { TransactionWithDetails } from '@/types';

const { Text } = Typography;

const STATUS_COLORS: Record<string, string> = {
  NEW: 'default',
  WIP: 'processing',
  DONE: 'success',
  READY_TO_PICKUP: 'gold',
  ON_DELIVERY: 'blue',
  DELIVERED: 'cyan',
  RECEIVED: 'green',
  RETURNED: 'red',
};

export default function TransactionListTable({
  data,
  loading,
  showEditAction = true,
}: {
  data: TransactionWithDetails[];
  loading?: boolean;
  showEditAction?: boolean;
}) {
  const router = useRouter();

  return (
    <Table
      rowKey="ORDER_ID"
      loading={loading}
      dataSource={data}
      scroll={{ x: true }}
      columns={[
        { title: 'Order ID', dataIndex: 'ORDER_ID' },
        { title: 'Sumber', dataIndex: 'ORDER_SOURCE' },
        { title: 'Sales', dataIndex: 'SALES_NAME' },
        { title: 'Pelanggan', dataIndex: 'CUSTOMER_NAME' },
        {
          title: 'Grand Total',
          dataIndex: 'GRAND_TOTAL',
          render: (v) => Number(v || 0).toLocaleString('id-ID'),
        },
        {
          title: 'Sisa Bayar',
          dataIndex: 'REMAINING_BALANCE',
          render: (v) => Number(v || 0).toLocaleString('id-ID'),
        },
        ...(showEditAction
          ? [
              {
                title: 'Aksi',
                key: 'action',
                render: (_: unknown, record: TransactionWithDetails) => (
                  <Button
                    size="small"
                    onClick={() => router.push(`/admin/transaction/${record.ORDER_ID}/edit`)}
                  >
                    Ubah
                  </Button>
                ),
              },
            ]
          : []),
      ]}
      expandable={{
        expandedRowRender: (record) => (
          <Table
            rowKey="ORDER_ITEM_ID"
            dataSource={record.details}
            pagination={false}
            size="small"
            columns={[
              { title: 'Item', dataIndex: 'ITEM_NAME' },
              { title: 'Qty', dataIndex: 'QUANTITY' },
              {
                title: 'Harga Satuan',
                dataIndex: 'UNIT_PRICE',
                render: (v) => Number(v || 0).toLocaleString('id-ID'),
              },
              {
                title: 'Subtotal',
                dataIndex: 'SUBTOTAL',
                render: (v) => Number(v || 0).toLocaleString('id-ID'),
              },
              {
                title: 'Status',
                dataIndex: 'ITEM_STATUS',
                render: (v) => <Tag color={STATUS_COLORS[v] ?? 'default'}>{v}</Tag>,
              },
              { title: 'Florist', dataIndex: 'FLORIST_NAME' },
              {
                title: 'Kartu Ucapan',
                key: 'card',
                render: (_: unknown, d) => (
                  <Space direction="vertical" size={0}>
                    {d.CARD_TO && <Text>To: {d.CARD_TO}</Text>}
                    {d.CARD_MESSAGE && <Text type="secondary">{d.CARD_MESSAGE}</Text>}
                  </Space>
                ),
              },
            ]}
          />
        ),
      }}
    />
  );
}
