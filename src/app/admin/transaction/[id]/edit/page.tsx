'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {Button, Card, Form, Input, InputNumber, Table, Tag, Typography, App} from 'antd';
import RoleGuard from '@/components/common/RoleGuard';
import { apiClient } from '@/lib/apiClient';
import { Transaction, TransactionWithDetails } from '@/types';

const { Title } = Typography;

export default function EditTransactionPage() {
  return (
    <RoleGuard allow={['ADMIN']}>
      <EditTransactionContent />
    </RoleGuard>
  );
}

function EditTransactionContent() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [form] = Form.useForm<Transaction>();
  const [order, setOrder] = useState<TransactionWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { message } = App.useApp();

  useEffect(() => {
    apiClient
      .get<{ transaction: TransactionWithDetails }>(`/api/transactions/${id}`)
      .then((res) => {
        setOrder(res.transaction);
        form.setFieldsValue(res.transaction);
      })
      .catch((err) => message.error(err.message))
      .finally(() => setLoading(false));
  }, [id, form]);

  async function handleSave(values: Transaction) {
    setSaving(true);
    try {
      await apiClient.put(`/api/transactions/${id}`, values);
      message.success('Perubahan disimpan');
      router.push('/admin/transaction');
    } catch (err) {
      message.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <Title level={3}>Ubah Transaksi {id}</Title>
      <Card loading={loading} style={{ marginBottom: 16 }}>
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item label="Order ID" name="ORDER_ID">
            <Input disabled />
          </Form.Item>
          <Form.Item label="Sumber Order" name="ORDER_SOURCE">
            <Input />
          </Form.Item>
          <Form.Item label="Nama Sales" name="SALES_NAME">
            <Input />
          </Form.Item>
          <Form.Item label="Nama Pelanggan" name="CUSTOMER_NAME">
            <Input />
          </Form.Item>
          <Form.Item label="Alamat Pelanggan" name="CUSTOMER_ADDRESS">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item label="Telepon Pelanggan" name="CUSTOMER_PHONE">
            <Input />
          </Form.Item>
          <Form.Item label="Email Pelanggan" name="CUSTOMER_EMAIL">
            <Input />
          </Form.Item>
          <Form.Item label="Grand Total" name="GRAND_TOTAL">
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>
          <Form.Item label="Uang Muka (DP)" name="DOWN_PAYMENT">
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>
          <Form.Item label="Sisa Pembayaran" name="REMAINING_BALANCE">
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>
          <Form.Item label="Metode Pembayaran" name="PAYMENT_METHOD">
            <Input />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={saving} block>
            Simpan Perubahan
          </Button>
        </Form>
      </Card>

      <Card title="Item Pesanan (read-only, dikelola Florist/Kurir)">
        <Table
          rowKey="ORDER_ITEM_ID"
          dataSource={order?.details ?? []}
          loading={loading}
          pagination={false}
          size="small"
          columns={[
            { title: 'Item', dataIndex: 'ITEM_NAME' },
            { title: 'Qty', dataIndex: 'QUANTITY' },
            { title: 'Status', dataIndex: 'ITEM_STATUS', render: (v) => <Tag>{v}</Tag> },
            { title: 'Florist', dataIndex: 'FLORIST_NAME' },
          ]}
        />
      </Card>
    </div>
  );
}
