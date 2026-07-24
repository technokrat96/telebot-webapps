'use client';

import {Table, Tag, Button, Typography, Space, GetProp, Progress, TablePaginationConfig} from 'antd';
import { useRouter } from 'next/navigation';
import {
  TransactionDetail,
  TransactionDetailWithAssignments, TransactionWithDetails, TransactionWithDetailsAndAssignments
} from '@/types';

const { Text } = Typography;

const STATUS_COLORS: Record<string, GetProp<typeof Tag, "color">> = {
  "NEW ORDER": 'default',
  "ON PROGRESS": 'processing',
  DONE: 'success',
  CANCELLED: "red",
  PENDING: "cyan",
  RESCHEDULED: "gold",
};

const ASSIGNMENT_STATUS_LABELS: Record<string, string> = {
  ASSIGNED: 'Diproses',
  COMPLETED: 'Selesai',
  RELEASED: 'Dilepas',
};

const ASSIGNMENT_STATUS_COLORS: Record<string, GetProp<typeof Tag, "color">> = {
  ASSIGNED: 'processing',
  COMPLETED: 'success',
  RELEASED: 'default',
};

function summarizeItemStatus(details: TransactionDetail[]) {
  const total = details.length;
  const done = details.filter((d) => d.ITEM_STATUS === 'DONE').length;
  const onProgress = details.filter((d) => d.ITEM_STATUS === 'ON PROGRESS').length;
  const standby = total - done - onProgress;

  return { total, done, onProgress, standby };
}

// Type guard kecil: cek apakah detail ini datang dari endpoint yang sudah
// nge-join florist assignment (/api/transactions), atau dari endpoint lain
// (invoice-details, transaction-details) yang tidak membawa data itu.
function hasAssignments(
  d: TransactionDetail | TransactionDetailWithAssignments
): d is TransactionDetailWithAssignments {
  return Array.isArray((d as TransactionDetailWithAssignments).assignments);
}

export default function TransactionListTable({
  data,
  loading,
  showEditAction = true,
  pagination,
}: {
  data: TransactionWithDetailsAndAssignments[];
  loading?: boolean;
  showEditAction?: boolean;
  pagination?: TablePaginationConfig | false;
}) {
  const router = useRouter();

  return (
    <Table
      rowKey="ORDER_ID"
      loading={loading}
      dataSource={data}
      scroll={{ x: true }}
      pagination={pagination}
      columns={[
        { title: 'Order ID', dataIndex: 'ORDER_ID' },
        { title: 'Sumber', dataIndex: 'ORDER_SOURCE' },
        { title: 'Sales', dataIndex: 'SALES_NAME' },
        { title: 'Pelanggan', dataIndex: 'CUSTOMER_NAME' },
        {
          title: 'Progress Item',
          key: 'itemProgress',
          width: 220,
          render: (_: unknown, record: TransactionWithDetails) => {
            const { total, done, onProgress, standby } = summarizeItemStatus(record.details);
            if (total === 0) return <Text type="secondary">-</Text>;

            return (
              <Space orientation="vertical" size={4} style={{ width: '100%' }}>
                <Progress
                  percent={Math.round((done / total) * 100)}
                  size="small"
                  format={() => `${done}/${total} selesai`}
                />
                <Space size={4} wrap>
                  {done > 0 && <Tag color={STATUS_COLORS.DONE}>Selesai: {done}</Tag>}
                  {onProgress > 0 && (
                    <Tag color={STATUS_COLORS['ON PROGRESS']}>Proses: {onProgress}</Tag>
                  )}
                  {standby > 0 && (
                    <Tag color={STATUS_COLORS['NEW ORDER']}>Standby: {standby}</Tag>
                  )}
                </Space>
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
              {
                title: 'Florist',
                key: 'florist',
                render: (_: unknown, r: TransactionDetail | TransactionDetailWithAssignments) => {
                  if (!hasAssignments(r)) return <Text type="secondary">-</Text>;

                  const activeAssignments = r.assignments.filter((a) => a.STATUS !== 'RELEASED');
                  if (activeAssignments.length === 0) {
                    return <Tag>Belum diambil</Tag>;
                  }

                  return (
                    <Space orientation="vertical" size={2}>
                      {activeAssignments.map((a) => (
                        <Space key={a.ASSIGNMENT_ID} size={4}>
                          <Tag color={ASSIGNMENT_STATUS_COLORS[a.STATUS] ?? 'default'}>
                            {ASSIGNMENT_STATUS_LABELS[a.STATUS] ?? a.STATUS}
                          </Tag>
                          <Text>{a.FLORIST_NAME} · qty {a.QUANTITY_ASSIGNED}</Text>
                        </Space>
                      ))}
                    </Space>
                  );
                },
              },
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
