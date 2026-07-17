'use client';

import { Table, Tag } from 'antd';
import { InvoiceWithDetails } from '@/types';

const STATUS_COLORS: Record<string, string> = {
  UNPAID: 'red',
  PARTIAL: 'gold',
  PAID: 'green',
};

export default function InvoiceListTable({
  data,
  loading,
}: {
  data: InvoiceWithDetails[];
  loading?: boolean;
}) {
  return (
    <Table
      rowKey="INVOICE_ID"
      loading={loading}
      dataSource={data}
      scroll={{ x: true }}
      columns={[
        { title: 'Invoice #', dataIndex: 'INVOICE_NUMBER' },
        { title: 'Tanggal', dataIndex: 'INVOICE_DATE' },
        { title: 'Jatuh Tempo', dataIndex: 'DUE_DATE' },
        { title: 'Ditagihkan Ke', dataIndex: 'BILLED_TO' },
        {
          title: 'Total',
          dataIndex: 'TOTAL_AMOUNT',
          render: (v) => Number(v || 0).toLocaleString('id-ID'),
        },
        {
          title: 'Dibayar',
          dataIndex: 'AMOUNT_PAID',
          render: (v) => Number(v || 0).toLocaleString('id-ID'),
        },
        {
          title: 'Status',
          dataIndex: 'INVOICE_STATUS',
          render: (v) => <Tag color={STATUS_COLORS[v] ?? 'default'}>{v}</Tag>,
        },
      ]}
      expandable={{
        expandedRowRender: (record) => (
          <Table
            rowKey="INVOICE_ITEM_ID"
            dataSource={record.details}
            pagination={false}
            size="small"
            columns={[
              { title: 'Order Item ID', dataIndex: 'ORDER_ITEM_ID' },
              { title: 'Qty Ditagih', dataIndex: 'QUANTITY_BILLED' },
              {
                title: 'Harga Ditagih',
                dataIndex: 'PRICE_BILLED',
                render: (v) => Number(v || 0).toLocaleString('id-ID'),
              },
            ]}
          />
        ),
      }}
    />
  );
}
