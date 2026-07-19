'use client';

import {
  Button,
  Card,
  Checkbox,
  Col,
  Collapse,
  DatePicker,
  Form,
  FormListFieldData,
  FormListOperation,
  Input,
  Row,
  Select,
  Space,
  TimePicker,
  Typography
} from 'antd';
import {MinusCircleOutlined, PlusOutlined} from '@ant-design/icons';
import {Transaction, TransactionDetail} from '@/types';
import {Dispatch, SetStateAction, useEffect, useState} from "react";
import PhoneNumberInput from "@/components/PhoneNumberInput";
import MoneyInput from "@/components/MoneyInput";
import NumberInput from "@/components/NumberInput";
import {useMasterData} from "@/components/common/MasterDataProvider";

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

function ItemPesananList() {
  const [activeKeys, setActiveKeys] = useState<string[]>([]);

  return (
    <Form.List name="details">
      {(fields, {add, remove}) => {
        return (
          <ItemPesananCollapse
            fields={fields}
            add={add}
            remove={remove}
            activeKeys={activeKeys}
            setActiveKeys={setActiveKeys}
          />
        );
      }}
    </Form.List>
  );
}

function ItemPesananFields({
                             field,
                             form,
                           }: {
  field: Omit<FormListFieldData, "key">;
  form: ReturnType<typeof Form.useFormInstance<TransactionFormValues>>;
}) {
  const quantity = Form.useWatch(['details', field.name, 'QUANTITY'], form);
  const unitPrice = Form.useWatch(['details', field.name, 'UNIT_PRICE'], form);

  useEffect(() => {
    const subtotal = Number(quantity || 0) * Number(unitPrice || 0);
    const currentDetails = form.getFieldValue('details') ?? [];
    // Hindari infinite loop: cuma set kalau nilainya memang berubah.
    if (currentDetails[field.name]?.SUBTOTAL !== subtotal) {
      const next = [...currentDetails];
      next[field.name] = {...next[field.name], SUBTOTAL: subtotal};
      form.setFieldsValue({details: next});
    }
  }, [quantity, unitPrice, field.name, form]);

  return (
    <>
      <Form.Item
        {...field}
        label="Nama Item"
        key={[field.name, 'ITEM_NAME'].join("-")}
        name={[field.name, 'ITEM_NAME']}
        rules={[{required: true, message: 'Wajib diisi'}]}
      >
        <Input placeholder="Buket Mawar Merah"/>
      </Form.Item>
      <Form.Item {...field} label="Qty" name={[field.name, 'QUANTITY']} key={[field.name, 'QUANTITY'].join("-")}>
        <NumberInput style={{width: '100%'}} min={1}/>
      </Form.Item>
      <Form.Item {...field} label="Harga Satuan" name={[field.name, 'UNIT_PRICE']}
                 key={[field.name, 'UNIT_PRICE'].join("-")}>
        <MoneyInput hasCurrency/>
      </Form.Item>
      <Form.Item {...field} label="Subtotal" name={[field.name, 'SUBTOTAL']} key={[field.name, 'SUBTOTAL'].join("-")}>
        <MoneyInput disabled/>
      </Form.Item>
      <Form.Item {...field} label="Catatan Custom" name={[field.name, 'CUSTOM_NOTES']}
                 key={[field.name, 'CUSTOM_NOTES'].join("-")}>
        <Input.TextArea rows={2}/>
      </Form.Item>
    </>
  );
}


function ItemPesananCollapse({fields, add, remove, activeKeys, setActiveKeys}: {
  fields: FormListFieldData[],
  add: FormListOperation["add"]
  remove: FormListOperation["add"],
  activeKeys: string[],
  setActiveKeys: Dispatch<SetStateAction<string[]>>,
}) {
  const form = Form.useFormInstance<TransactionFormValues>();

  // Buka item pertama otomatis saat baru pertama kali render dengan 1 item.
  useEffect(() => {
    if (fields.length === 1) {
      const onlyKey = fields[0].key.toString();
      setActiveKeys((prev: string[]) =>
        prev.includes(onlyKey) ? prev : [onlyKey]
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields.length]);

  return (
    <>
      {fields.length > 0 && (
        <Collapse activeKey={activeKeys} onChange={(keys) => setActiveKeys(keys as string[])}
                  style={{marginBottom: 16}}
                  items={
                    fields.map((field, idx) => {
                      const {key, ...inputField} = field;
                      const panelKey = field.key.toString();
                      const isOnlyOneItem = fields.length === 1;
                      return {
                        key: panelKey,
                        collapsible: isOnlyOneItem ? 'disabled' : 'header',
                        showArrow: !isOnlyOneItem,
                        label: (
                          <>
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
                          </>
                        ),
                        children: (
                          <ItemPesananFields field={inputField} form={form}/>
                        )
                      };
                    })
                  }
        >
          {}
        </Collapse>
      )}
      <Button
        type="dashed"
        onClick={() => {
          add();
          // key baru dari antd biasanya = max(existing keys) + 1
          setActiveKeys((prev: string[]) => {
            const maxKey = fields.length > 0 ? Math.max(...fields.map((f: any) => f.key)) : -1;
            return [...prev, (maxKey + 1).toString()];
          });
        }}
        block
        icon={<PlusOutlined/>}
      >
        Tambah Item
      </Button>
    </>
  );
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
  const { data: { DELIVERY_METHODS, ORDER_SOURCES, PAYMENT_METHODS } } = useMasterData();
  const [form] = Form.useForm<TransactionFormValues>();
  const [receiverSameAsCustomer, setReceiverSameAsCustomer] = useState(true);

  const detailsWatch = Form.useWatch('details', form);
  const downPaymentWatch = Form.useWatch('DOWN_PAYMENT', form);
  const shippingFeeWatch = Form.useWatch('SHIPPING_FEE', form);

  const customerNameWatch = Form.useWatch('CUSTOMER_NAME', form);
  const customerAddressWatch = Form.useWatch('CUSTOMER_ADDRESS', form);
  const customerPhoneWatch = Form.useWatch('CUSTOMER_PHONE', form);

  function handleReceiverSameAsCustomerChange(checked: boolean) {
    setReceiverSameAsCustomer(checked);
    if (checked) {
      // Langsung sync begitu dicentang (tidak perlu tunggu watch berubah)
      form.setFieldsValue({
        RECEIVER_NAME: form.getFieldValue('CUSTOMER_NAME'),
        RECEIVER_ADDRESS: form.getFieldValue('CUSTOMER_ADDRESS'),
        RECEIVER_PHONE: form.getFieldValue('CUSTOMER_PHONE'),
      });
    } else {
      // Uncheck -> kosongkan, biar user isi manual dari blank.
      form.setFieldsValue({
        RECEIVER_NAME: '',
        RECEIVER_ADDRESS: '',
        RECEIVER_PHONE: '',
      });
    }
  }

  useEffect(() => {
    const grandTotal = (detailsWatch ?? []).reduce(
      (sum, d) => sum + Number(d?.SUBTOTAL || '0'),
      0
    );
    const remaining = (grandTotal + Number(shippingFeeWatch || 0)) - Number(downPaymentWatch || 0);
    form.setFieldsValue({ GRAND_TOTAL: grandTotal, REMAINING_BALANCE: remaining });
  }, [shippingFeeWatch, detailsWatch, downPaymentWatch, form]);

  useEffect(() => {
    if (!receiverSameAsCustomer) return;
    form.setFieldsValue({
      RECEIVER_NAME: customerNameWatch,
      RECEIVER_ADDRESS: customerAddressWatch,
      RECEIVER_PHONE: customerPhoneWatch,
    });
  }, [receiverSameAsCustomer, customerNameWatch, customerAddressWatch, customerPhoneWatch, form]);


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
      <Row gutter={12} style={{marginBottom: 16}}>
        <Col span={24} xl={12}>
          <Card style={{height: "100%"}}>
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
              <PhoneNumberInput/>
            </Form.Item>
            <Form.Item label="Email Pelanggan" name="CUSTOMER_EMAIL">
              <Input type="email"/>
            </Form.Item>
          </Card>
        </Col>
        <Col span={24} xl={12}>
          <Card style={{height: "100%"}}>
            <Title level={5}>Penerima</Title>
            <Checkbox
              checked={receiverSameAsCustomer}
              onChange={(e) => handleReceiverSameAsCustomerChange(e.target.checked)}
              style={{marginBottom: 16}}
            >
              Sama dengan Pelanggan
            </Checkbox>
            <Form.Item label="Nama Penerima" name="RECEIVER_NAME">
              <Input disabled={receiverSameAsCustomer}/>
            </Form.Item>
            <Form.Item label="Alamat Penerima" name="RECEIVER_ADDRESS">
              <Input.TextArea rows={2} disabled={receiverSameAsCustomer}/>
            </Form.Item>
            <Form.Item label="Telepon Penerima" name="RECEIVER_PHONE">
              <PhoneNumberInput disabled={receiverSameAsCustomer}/>
            </Form.Item>
          </Card>
        </Col>
      </Row>

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
        <Form.Item label="Note untuk Kartu Ucapan" name="CARD_NOTE">
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
          <MoneyInput/>
        </Form.Item>
      </Card>
      <Card style={{marginBottom: 16}}>
        <Title level={5}>Item Pesanan</Title>
        <ItemPesananList/>
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
          <MoneyInput/>
        </Form.Item>
      </Card>

      {/* ================= SUMMARY ================= */}
      <Card style={{ marginBottom: 16 }}>
        <Title level={5}>Summary</Title>
        <Form.Item label="Grand Total" name="GRAND_TOTAL">
          <MoneyInput disabled/>
        </Form.Item>
        <Form.Item label="Sisa Pembayaran" name="REMAINING_BALANCE">
          <MoneyInput disabled/>
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