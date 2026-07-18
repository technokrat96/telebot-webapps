'use client';

import { Button, Card, Divider, Form, Input, InputNumber, Space, Typography } from 'antd';
import { PlusOutlined, MinusCircleOutlined } from '@ant-design/icons';
import { Transaction, TransactionDetail } from '@/types';

const { Title } = Typography;

export interface TransactionFormValues extends Omit<Transaction, 'ORDER_ID'> {
  ORDER_ID?: string;
  details: Omit<TransactionDetail, 'ORDER_ID'>[];
}

export default function TransactionForm({
  initialValues,
  onSubmitAction,
  submitting,
  isEdit = false,
}: {
  initialValues?: Partial<TransactionFormValues>;
  onSubmitAction: (values: TransactionFormValues) => void;
  submitting?: boolean;
  isEdit?: boolean;
}) {
  const [form] = Form.useForm<TransactionFormValues>();

  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={{
        details: [{}],
        ...initialValues,
      }}
      onFinish={onSubmitAction}
    >
      <Card style={{ marginBottom: 16 }}>
        <Title level={5}>Data Transaksi</Title>
        <Form.Item
          label="Order ID"
          name="ORDER_ID"
          rules={[{ required: true, message: 'Order ID wajib diisi' }]}
        >
          <Input disabled={isEdit} placeholder="ORD-0001" />
        </Form.Item>
        <Form.Item label="Sumber Order" name="ORDER_SOURCE">
          <Input placeholder="Instagram / Whatsapp / Toko" />
        </Form.Item>
        <Form.Item label="Nama Sales" name="SALES_NAME">
          <Input />
        </Form.Item>
        <Form.Item
          label="Nama Pelanggan"
          name="CUSTOMER_NAME"
          rules={[{ required: true, message: 'Nama pelanggan wajib diisi' }]}
        >
          <Input />
        </Form.Item>
        <Form.Item label="Alamat Pelanggan" name="CUSTOMER_ADDRESS">
          <Input.TextArea rows={2} />
        </Form.Item>
        <Form.Item label="Telepon Pelanggan" name="CUSTOMER_PHONE">
          <Input />
        </Form.Item>
        <Form.Item label="Email Pelanggan" name="CUSTOMER_EMAIL">
          <Input type="email" />
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
          <Input placeholder="Cash / Transfer / QRIS" />
        </Form.Item>
      </Card>

      <Card>
        <Title level={5}>Item Pesanan</Title>
        <Form.List name="details">
          {(fields, { add, remove }) => (
            <>
              {fields.map((field, idx) => (
                <div key={field.key}>
                  {idx > 0 && <Divider />}
                  <Space align="baseline" style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Title level={5} style={{ margin: 0 }}>
                      Item {idx + 1}
                    </Title>
                    {fields.length > 1 && (
                      <MinusCircleOutlined onClick={() => remove(field.name)} />
                    )}
                  </Space>
                  {!isEdit && (
                    <Form.Item
                      {...field}
                      label="Order Item ID"
                      name={[field.name, 'ORDER_ITEM_ID']}
                      rules={[{ required: true, message: 'Wajib diisi' }]}
                    >
                      <Input placeholder="ORD-0001-01" />
                    </Form.Item>
                  )}
                  <Form.Item
                    {...field}
                    label="Nama Item"
                    name={[field.name, 'ITEM_NAME']}
                    rules={[{ required: true, message: 'Wajib diisi' }]}
                  >
                    <Input placeholder="Buket Mawar Merah" />
                  </Form.Item>
                  <Form.Item {...field} label="Qty" name={[field.name, 'QUANTITY']}>
                    <InputNumber style={{ width: '100%' }} min={1} />
                  </Form.Item>
                  <Form.Item {...field} label="Harga Satuan" name={[field.name, 'UNIT_PRICE']}>
                    <InputNumber style={{ width: '100%' }} min={0} />
                  </Form.Item>
                  <Form.Item {...field} label="Subtotal" name={[field.name, 'SUBTOTAL']}>
                    <InputNumber style={{ width: '100%' }} min={0} />
                  </Form.Item>
                  <Form.Item {...field} label="Catatan Custom" name={[field.name, 'CUSTOM_NOTES']}>
                    <Input.TextArea rows={2} />
                  </Form.Item>
                  <Form.Item {...field} label="Untuk (Kartu Ucapan)" name={[field.name, 'CARD_TO']}>
                    <Input />
                  </Form.Item>
                  <Form.Item {...field} label="Pesan Kartu Ucapan" name={[field.name, 'CARD_MESSAGE']}>
                    <Input.TextArea rows={2} />
                  </Form.Item>
                </div>
              ))}
              <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                Tambah Item
              </Button>
            </>
          )}
        </Form.List>
      </Card>

      <Form.Item style={{ marginTop: 16 }}>
        <Button type="primary" htmlType="submit" loading={submitting} block>
          {isEdit ? 'Simpan Perubahan' : 'Buat Transaksi'}
        </Button>
      </Form.Item>
    </Form>
  );
}
