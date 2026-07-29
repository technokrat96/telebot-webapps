'use client';

import {Table, Tag, Button, App, Space, Modal, Select} from 'antd';
import {DownloadOutlined, SendOutlined} from '@ant-design/icons';
import { InvoiceWithDetails } from '@/types';
import { apiClient } from '@/lib/apiClient';
import { openLink } from '@tma.js/sdk-react';
import {useState} from "react";

const STATUS_COLORS: Record<string, string> = {
  UNPAID: 'red',
  PARTIAL: 'gold',
  PAID: 'green',
};

async function openInvoicePdf(invoiceId: string) {
  const { url } = await apiClient.get<{ url: string }>(`/api/invoices/${invoiceId}/pdf-link`);
  try {
    openLink(url); // buka di in-app/eksternal browser Telegram
  } catch {
    window.open(url, '_blank');
  }
}

export default function InvoiceListTable({
                                           data,
                                           loading,
                                         }: {
  data: InvoiceWithDetails[];
  loading?: boolean;
}) {
  const { message } = App.useApp();
  const [sendModalInvoice, setSendModalInvoice] = useState<InvoiceWithDetails | null>(null);
  const [targetUsername, setTargetUsername] = useState<string | undefined>();
  const [userOptions, setUserOptions] = useState<{ username: string; name: string }[]>([]);
  const [sending, setSending] = useState(false);

  async function openSendModal(invoice: InvoiceWithDetails) {
    setSendModalInvoice(invoice);
    setTargetUsername(undefined);
    try {
      const res = await apiClient.get<{ users: { username: string; name: string }[] }>(
        '/api/users/with-telegram'
      );
      setUserOptions(res.users);
    } catch (err) {
      message.error((err as Error).message);
    }
  }

  async function handleSend() {
    if (!sendModalInvoice || !targetUsername) return;
    setSending(true);
    try {
      await apiClient.post(`/api/invoices/${sendModalInvoice.INVOICE_ID}/send-telegram`, {
        username: targetUsername,
      });
      message.success('Invoice berhasil dikirim ke Telegram');
      setSendModalInvoice(null);
    } catch (err) {
      message.error((err as Error).message);
    } finally {
      setSending(false);
    }
  }

  return (
    <>
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
              <Space.Compact block>
                <Button
                  icon={<DownloadOutlined />}
                  onClick={() =>
                    openInvoicePdf(r.INVOICE_ID).catch((err) => message.error((err as Error).message))
                  }
                >
                  PDF
                </Button>
                <Button icon={<SendOutlined />} onClick={() => openSendModal(r)}>
                  Kirim
                </Button>
              </Space.Compact>
            ),
          },
        ]}
        expandable={{
          expandedRowRender: (record) => (
            <Table
              rowKey="INVOICE_ITEM_ID"
              dataSource={record.details}
              pagination={false}
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
      <Modal
        title="Kirim Invoice via Telegram"
        open={!!sendModalInvoice}
        onCancel={() => setSendModalInvoice(null)}
        onOk={handleSend}
        confirmLoading={sending}
        okText="Kirim"
      >
        <p>
          Invoice <strong>{sendModalInvoice?.INVOICE_NUMBER}</strong> akan dikirim sebagai dokumen
          PDF ke chat Telegram tujuan.
        </p>
        <Select
          style={{ width: '100%' }}
          placeholder="Pilih staff tujuan"
          value={targetUsername}
          onChange={setTargetUsername}
          options={userOptions.map((u) => ({ label: `${u.name} (@${u.username})`, value: u.username }))}
        />
        <p style={{ marginTop: 8, color: '#999', fontSize: 12 }}>
          Cuma bisa kirim ke staff yang sudah pernah login ke app ini (Admin/Florist/Kurir).
          Belum bisa langsung ke nomor pelanggan.
        </p>
      </Modal>
    </>
  );
}