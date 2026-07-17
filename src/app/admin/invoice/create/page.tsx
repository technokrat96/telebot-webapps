'use client';

import { useEffect, useState } from 'react';
import {Button, Card, Form, Input, InputNumber, DatePicker, Table, Typography, App} from 'antd';
import { useRouter } from 'next/navigation';
import dayjs from 'dayjs';
import RoleGuard from '@/components/common/RoleGuard';
import { apiClient } from '@/lib/apiClient';
import { Invoice, InvoiceDetail, TransactionWithDetails } from '@/types';

const { Title } = Typography;

interface BillableRow {
  ORDER_ID: string;
  ORDER_ITEM_ID: string;
  ITEM_NAME: string;
  QUANTITY: number;
  UNIT_PRICE: number;
  SUBTOTAL: number;
}

export default function CreateInvoicePage() {
  return (
    <RoleGuard allow={['ADMIN']}>
      <CreateInvoiceContent />
    </RoleGuard>
  );
}

function CreateInvoiceContent() {
  const [form] = Form.useForm();
  const [rows, setRows] = useState<BillableRow[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<React.Key[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();
  const { message } = App.useApp();

  useEffect(() => {
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

  async function handleSubmit(values: Omit<Invoice, 'INVOICE_ID'> & { INVOICE_ID: string }) {
    if (selectedKeys.length === 0) {
      message.warning('Pilih minimal satu item untuk ditagihkan');
      return;
    }
    setSubmitting(true);
    try {
      const selectedRows = rows.filter((r) => selectedKeys.includes(r.ORDER_ITEM_ID));
      const details: Omit<InvoiceDetail, 'INVOICE_ID'>[] = selectedRows.map((r) => ({
        INVOICE_ITEM_ID: `${values.INVOICE_ID}-${r.ORDER_ITEM_ID}`,
        ORDER_ITEM_ID: r.ORDER_ITEM_ID,
        QUANTITY_BILLED: r.QUANTITY,
        PRICE_BILLED: r.SUBTOTAL,
      }));

      await apiClient.post('/api/invoices', {
        invoice: {
          ...values,
          INVOICE_DATE: values.INVOICE_DATE
            ? dayjs(values.INVOICE_DATE).format('YYYY-MM-DD')
            : '',
          DUE_DATE: values.DUE_DATE ? dayjs(values.DUE_DATE).format('YYYY-MM-DD') : '',
        },
        details,
      });
      message.success('Invoice berhasil dibuat');
      router.push('/admin/invoice');
    } catch (err) {
      message.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <Title level={3}>Buat Invoice</Title>
      <Card style={{ marginBottom: 16 }}>
        <Form form={form} layout="vertical" onFinish={handleSubmit} initialValues={{ INVOICE_STATUS: 'UNPAID' }}>
          <Form.Item label="Invoice ID" name="INVOICE_ID" rules={[{ required: true }]}>
            <Input placeholder="INV-0001" />
          </Form.Item>
          <Form.Item label="Nomor Invoice" name="INVOICE_NUMBER">
            <Input placeholder="2026/07/001" />
          </Form.Item>
          <Form.Item label="Tanggal Invoice" name="INVOICE_DATE">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="Jatuh Tempo" name="DUE_DATE">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="Ditagihkan Ke" name="BILLED_TO" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label="Alamat Tagihan" name="BILLED_ADDRESS">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item label="Telepon Tagihan" name="BILLED_PHONE">
            <Input />
          </Form.Item>
          <Form.Item label="Total Tagihan" name="TOTAL_AMOUNT">
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>
          <Form.Item label="Sudah Dibayar" name="AMOUNT_PAID">
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>
          <Form.Item label="Status Invoice" name="INVOICE_STATUS">
            <Input placeholder="UNPAID / PARTIAL / PAID" />
          </Form.Item>

          <Card
            type="inner"
            title="Pilih item yang ditagihkan"
            style={{ marginBottom: 16 }}
          >
            <Table
              rowKey="ORDER_ITEM_ID"
              loading={loading}
              dataSource={rows}
              size="small"
              pagination={false}
              rowSelection={{
                selectedRowKeys: selectedKeys,
                onChange: setSelectedKeys,
              }}
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
          </Card>

          <Button type="primary" htmlType="submit" loading={submitting} block>
            Buat Invoice
          </Button>
        </Form>
      </Card>
    </div>
  );
}
