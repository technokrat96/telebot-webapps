'use client';

import {App, Button, Table, Tag} from 'antd';
import {DownloadOutlined} from '@ant-design/icons';
import {InvoiceWithDetails} from '@/types';
import {getTelegramInitDataHeader} from '@/lib/apiClient';

const STATUS_COLORS: Record<string, string> = {
  UNPAID: 'red',
  PARTIAL: 'gold',
  PAID: 'green',
};

async function downloadInvoicePdf(invoiceId: string, invoiceNumber: string) {
  // Pakai apiClient (bukan <a href> langsung) supaya header x-telegram-init-data ikut kebawa.
  const res = await fetch(`/api/invoices/${invoiceId}/pdf`, {
    headers: getTelegramInitDataHeader(),
  });
  if (!res.ok) throw new Error('Gagal download PDF');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${invoiceNumber || invoiceId}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function InvoiceListTable({
                                           data,
                                           loading,
                                         }: {
  data: InvoiceWithDetails[];
  loading?: boolean;
}) {
  const {message} = App.useApp();

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
        {
          title: 'Aksi',
          key: 'action',
          render: (_, r) => (
            <Button
              size="small"
              icon={<DownloadOutlined/>}
              onClick={() =>
                downloadInvoicePdf(r.INVOICE_ID, r.INVOICE_NUMBER).catch((err) =>
                  message.error((err as Error).message)
                )
              }
            >
              PDF
            </Button>
          ),
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