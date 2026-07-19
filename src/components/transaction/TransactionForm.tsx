'use client';

import {
  Button,
  Card,
  Collapse,
  DatePicker,
  Divider,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  TimePicker,
  Typography
} from 'antd';
import {MinusCircleOutlined, PlusOutlined} from '@ant-design/icons';
import {DELIVERY_METHODS, ORDER_SOURCES, PAYMENT_METHODS, Transaction, TransactionDetail} from '@/types';
import {useEffect, useState} from "react";

const { Title } = Typography;

export type TransactionFormValues = Omit<Transaction, 'ORDER_ID'>
  & Pick<TransactionDetail,
  "RECEIVER_NAME" |
  "RECEIVER_ADDRESS" |
  "RECEIVER_PHONE" |
  "CARD_TO" |
  "CARD_FROM" |
  "CARD_MESSAGE" |
  "CARD_CREATED_BY" |
  "DELIVERY_METHOD" |
  "DELIVERY_DATE" |
  "DELIVERY_TIME" |
  "DELIVERY_BY" |
  "SHIPPING_FEE"
> & {
  ORDER_ID?: string;
  details: Omit<TransactionDetail,
    'ORDER_ID' | 'ORDER_ITEM_ID' | 'ITEM_STATUS' | 'FLORIST_NAME' | 'CARD_STATUS' | 'DELIVERY_STATUS'
  >[];
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
  const [activeKeys, setActiveKeys] = useState<string[]>([]);

  const detailsWatch = Form.useWatch('details', form);
  const downPaymentWatch = Form.useWatch('DOWN_PAYMENT', form);

  useEffect(() => {
    const grandTotal = (detailsWatch ?? []).reduce(
      (sum, d) => sum + Number(d?.SUBTOTAL || 0),
      0
    );
    const remaining = grandTotal - Number(downPaymentWatch || 0);
    form.setFieldsValue({ GRAND_TOTAL: grandTotal, REMAINING_BALANCE: remaining });
  }, [detailsWatch, downPaymentWatch, form]);

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
      <Card style={{marginBottom: 16}}>
        <Title level={5}>Transaksi</Title>
        {isEdit && (
          <Form.Item label="Order ID" name="ORDER_ID">
            <Input disabled/>
          </Form.Item>
        )}

        <Form.Item label="Sumber Order" name="ORDER_SOURCE">
          <Select
            placeholder="Pilih sumber order"
            options={ORDER_SOURCES.map((s) => ({label: s, value: s}))}
          />
        </Form.Item>
        <Form.Item label="Nama Sales" name="SALES_NAME">
          <Input disabled/>
        </Form.Item>
      </Card>

      <Card style={{marginBottom: 16}}>
        <Title level={5}>Pelanggan</Title>
        <Form.Item
          label="Nama Pelanggan"
          name="CUSTOMER_NAME"
          rules={[{required: true, message: 'Nama pelanggan wajib diisi'}]}
        >
          <Input/>
        </Form.Item>
        <Form.Item label="Alamat Pelanggan" name="CUSTOMER_ADDRESS">
          <Input.TextArea rows={2}/>
        </Form.Item>
        <Form.Item label="Telepon Pelanggan" name="CUSTOMER_PHONE">
          <Input/>
        </Form.Item>
        <Form.Item label="Email Pelanggan" name="CUSTOMER_EMAIL">
          <Input type="email"/>
        </Form.Item>
      </Card>
      {/* ================= PENERIMA ================= */}
      <Card style={{marginBottom: 16}}>
        <Title level={5}>Penerima</Title>
        <Form.Item label="Nama Penerima" name="RECEIVER_NAME">
          <Input/>
        </Form.Item>
        <Form.Item label="Alamat Penerima" name="RECEIVER_ADDRESS">
          <Input.TextArea rows={2}/>
        </Form.Item>
        <Form.Item label="Telepon Penerima" name="RECEIVER_PHONE">
          <Input/>
        </Form.Item>
      </Card>

      {/* ================= KARTU UCAPAN ================= */}
      <Card style={{marginBottom: 16}}>
        <Title level={5}>Kartu Ucapan</Title>
        <Form.Item label="Untuk" name="CARD_TO">
          <Input/>
        </Form.Item>
        <Form.Item label="Dari" name="CARD_FROM">
          <Input/>
        </Form.Item>
        <Form.Item label="Pesan Kartu Ucapan" name="CARD_MESSAGE">
          <Input.TextArea rows={2}/>
        </Form.Item>
      </Card>

      {/* ================= PENGIRIMAN ================= */}
      <Card style={{marginBottom: 16}}>
        <Title level={5}>Pengiriman</Title>
        <Form.Item label="Metode Pengiriman" name="DELIVERY_METHOD">
          <Select
            placeholder="Pilih metode pengiriman"
            options={DELIVERY_METHODS.map((m) => ({label: m, value: m}))}
          />
        </Form.Item>
        <Form.Item label="Tanggal Pengiriman" name="DELIVERY_DATE">
          <DatePicker style={{width: '100%'}}/>
        </Form.Item>
        <Form.Item label="Jam Pengiriman" name="DELIVERY_TIME">
          <TimePicker style={{width: '100%'}} format="HH:mm"/>
        </Form.Item>
        <Form.Item label="Ongkos Kirim" name="SHIPPING_FEE">
          <InputNumber style={{width: '100%'}} min={0}/>
        </Form.Item>
      </Card>
      <Card style={{marginBottom: 16}}>
        <Title level={5}>Item Pesanan</Title>
        <Form.List name="details">
          {(fields, {add, remove}) => {
            if (fields.length === 1 && !activeKeys.includes(fields[0].key.toString())) {
              setActiveKeys([fields[0].key.toString()]);
            }
            return (
              <>
                {fields.length > 0 && (
                  <Collapse
                    activeKey={activeKeys}
                    onChange={(keys) => setActiveKeys(keys)}
                    style={{marginBottom: 16}}
                  >
                    {fields.map((field, idx) => {
                      const panelKey = field.key.toString();
                      const isOnlyOneItem = fields.length === 1;
                      return (
                        <Collapse.Panel
                          key={panelKey}
                          collapsible={isOnlyOneItem ? 'disabled' : 'header'}
                          showArrow={!isOnlyOneItem}
                          header={
                            <Space style={{width: '100%', justifyContent: 'space-between'}}>
                              <span style={{fontWeight: 'bold'}}>Item {idx + 1}</span>
                              {fields.length > 1 && (
                                <MinusCircleOutlined
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    remove(field.name);
                                  }}
                                  style={{color: '#ff4d4f'}}
                                />
                              )}
                            </Space>
                          }
                        >
                          <Form.Item
                            {...field}
                            label="Nama Item"
                            name={[field.name, 'ITEM_NAME']}
                            rules={[{required: true, message: 'Wajib diisi'}]}
                          >
                            <Input placeholder="Buket Mawar Merah"/>
                          </Form.Item>
                          <Form.Item {...field} label="Qty" name={[field.name, 'QUANTITY']}>
                            <InputNumber style={{width: '100%'}} min={1}/>
                          </Form.Item>
                          <Form.Item {...field} label="Harga Satuan" name={[field.name, 'UNIT_PRICE']}>
                            <InputNumber style={{width: '100%'}} min={0}/>
                          </Form.Item>
                          <Form.Item {...field} label="Subtotal" name={[field.name, 'SUBTOTAL']}>
                            <InputNumber style={{width: '100%'}} min={0}/>
                          </Form.Item>
                          <Form.Item {...field} label="Catatan Custom" name={[field.name, 'CUSTOM_NOTES']}>
                            <Input.TextArea rows={2}/>
                          </Form.Item>
                        </Collapse.Panel>
                      );
                    })}
                  </Collapse>
                )}
                <Button
                  type="dashed"
                  onClick={() => {
                    add();
                    const nextVirtualKey = fields.length > 0
                      ? (Math.max(...fields.map(f => f.key)) + 1).toString()
                      : "0";
                    setActiveKeys([nextVirtualKey]);
                  }}
                  block
                  icon={<PlusOutlined/>}
                >
                  Tambah Item
                </Button>
              </>
            );
          }}
        </Form.List>
      </Card>

      {/* ================= PEMBAYARAN ================= */}
      <Card style={{ marginBottom: 16 }}>
        <Title level={5}>Pembayaran</Title>
        <Form.Item label="Metode Pembayaran" name="PAYMENT_METHOD">
          <Select
            placeholder="Pilih metode pembayaran"
            options={PAYMENT_METHODS.map((p) => ({ label: p, value: p }))}
          />
        </Form.Item>
        <Form.Item label="Uang Muka (DP)" name="DOWN_PAYMENT">
          <InputNumber style={{ width: '100%' }} min={0} />
        </Form.Item>
      </Card>

      {/* ================= SUMMARY ================= */}
      <Card style={{ marginBottom: 16 }}>
        <Title level={5}>Summary</Title>
        <Form.Item label="Grand Total" name="GRAND_TOTAL">
          <InputNumber style={{ width: '100%' }} disabled />
        </Form.Item>
        <Form.Item label="Sisa Pembayaran" name="REMAINING_BALANCE">
          <InputNumber style={{ width: '100%' }} disabled />
        </Form.Item>
      </Card>

      <Form.Item style={{ marginTop: 16 }}>
        <Button type="primary" htmlType="submit" loading={submitting} block>
          {isEdit ? 'Simpan Perubahan' : 'Buat Transaksi'}
        </Button>
      </Form.Item>
    </Form>
  );
}