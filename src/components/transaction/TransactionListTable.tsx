'use client';

import {Table, Tag, Button, Typography, Space, GetProp} from 'antd';
import { useRouter } from 'next/navigation';
import {ItemStatus, TransactionWithDetails} from '@/types';

const { Text } = Typography;

const STATUS_COLORS: Record<ItemStatus, GetProp<typeof Tag, "color">> = {
  "NEW ORDER": 'default',
  "ON PROGRESS": 'processing',
  DONE: 'success',
  CANCELLED: "red",
  PENDING: "cyan",
  RESCHEDULED: "gold",
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
          render: (v, r) => (r.GRAND_TOTAL || 0).toLocaleString('id-ID'),
        },
        {
          title: 'Sisa Bayar',
          dataIndex: 'REMAINING_BALANCE',
          render: (v, r) => (r.REMAINING_BALANCE || 0).toLocaleString('id-ID'),
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
                render: (v, r) => (r.UNIT_PRICE || 0).toLocaleString('id-ID'),
              },
              {
                title: 'Subtotal',
                dataIndex: 'SUBTOTAL',
                render: (v, r) => (r.SUBTOTAL || 0).toLocaleString('id-ID'),
              },
              {
                title: 'Status',
                dataIndex: 'ITEM_STATUS',
                render: (v, r) => <Tag color={STATUS_COLORS[r.ITEM_STATUS] ?? 'default'}>{r.ITEM_STATUS}</Tag>,
              },
              { title: 'Florist', dataIndex: 'FLORIST_NAME' },
              {
                title: 'Kartu Ucapan',
                key: 'card',
                render: (v, r) => (
                  <Space orientation="vertical" size={0}>
                    {r.CARD_TO && <Text>To: {r.CARD_TO}</Text>}
                    {r.CARD_MESSAGE && <Text type="secondary">{r.CARD_MESSAGE}</Text>}
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
