'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  App,
  Alert,
  Button,
  Card,
  Checkbox,
  DatePicker,
  Empty,
  Input,
  InputNumber,
  Radio,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import { Dayjs } from 'dayjs';
import RoleGuard from '@/components/common/RoleGuard';
import { apiClient } from '@/lib/apiClient';
import MoneyInput from '@/components/MoneyInput';
import { InvoiceDetail, TransactionWithBilling } from '@/types';
import clientDayJs from "@/lib/cleint.dayjs";

const { Title, Paragraph, Text } = Typography;

type BillSource = 'CUSTOMER' | 'RECEIVER' | 'MANUAL';

export default function CreateInvoiceForOrderPage() {
  return (
    <RoleGuard allow={['ADMIN']}>
      <CreateInvoiceForOrderContent />
    </RoleGuard>
  );
}

function CreateInvoiceForOrderContent() {
  const { id: orderId } = useParams<{ id: string }>();
  const router = useRouter();
  const { message } = App.useApp();

  const [order, setOrder] = useState<TransactionWithBilling | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [justCreated, setJustCreated] = useState(false);

  // Pilihan item + qty yang mau ditagihkan
  const [selectedKeys, setSelectedKeys] = useState<React.Key[]>([]);
  const [qtyMap, setQtyMap] = useState<Record<string, number>>({});

  // Ditagihkan Ke
  const [billSource, setBillSource] = useState<BillSource>('CUSTOMER');
  const [billedTo, setBilledTo] = useState('');
  const [billedAddress, setBilledAddress] = useState('');
  const [billedPhone, setBilledPhone] = useState('');

  // Ringkasan invoice
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState<Dayjs>(clientDayJs());
  const [dueDate, setDueDate] = useState<Dayjs | null>(null);
  const [isPaidFull, setIsPaidFull] = useState(true);
  const [amountPaid, setAmountPaid] = useState(0);

  async function load() {
    setLoading(true);
    try {
      const res = await apiClient.get<{ order: TransactionWithBilling }>(
        `/api/invoice-details/${orderId}`
      );
      setOrder(res.order);
    } catch (err) {
      message.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  // Auto-suggest nomor invoice sekali order sudah kebaca
  useEffect(() => {
    if (order && !invoiceNumber) {
      setInvoiceNumber(`INV-${order.ORDER_ID}-${clientDayJs().valueOf().toString().slice(-6)}`);
    }
  }, [order, invoiceNumber]);

  // Sinkron Ditagihkan Ke berdasar sumber yang dipilih
  useEffect(() => {
    if (!order) return;
    if (billSource === 'CUSTOMER') {
      setBilledTo(order.CUSTOMER_NAME ?? '');
      setBilledAddress(order.CUSTOMER_ADDRESS ?? '');
      setBilledPhone(order.CUSTOMER_PHONE ?? '');
    } else if (billSource === 'RECEIVER') {
      const first = order.details[0];
      setBilledTo(first?.RECEIVER_NAME ?? '');
      setBilledAddress(first?.RECEIVER_ADDRESS ?? '');
      setBilledPhone(first?.RECEIVER_PHONE ?? '');
    }
    // MANUAL: biarkan apa adanya, USER isi sendiri
  }, [billSource, order]);

  const totalAmount = useMemo(() => {
    if (!order) return 0;
    return order.details.reduce((sum, d) => {
      if (!selectedKeys.includes(d.ORDER_ITEM_ID)) return sum;
      const qty = qtyMap[d.ORDER_ITEM_ID] ?? 0;
      const unitPrice = Number(d.UNIT_PRICE || 0) * Number(d.CURRENCY_RATE || 1);
      return sum + qty * unitPrice;
    }, 0);
  }, [order, selectedKeys, qtyMap]);

  useEffect(() => {
    if (isPaidFull) setAmountPaid(totalAmount);
  }, [isPaidFull, totalAmount]);

  function resetSelectionForNextInvoice() {
    setSelectedKeys([]);
    setQtyMap({});
    setInvoiceNumber('');
    setDueDate(null);
    setIsPaidFull(true);
  }

  async function handleSubmit() {
    if (!order) return;

    const details: Omit<InvoiceDetail, 'INVOICE_ID' | 'INVOICE_ITEM_ID'>[] = order.details
      .filter((d) => selectedKeys.includes(d.ORDER_ITEM_ID) && (qtyMap[d.ORDER_ITEM_ID] ?? 0) > 0)
      .map((d) => {
        const qty = qtyMap[d.ORDER_ITEM_ID] ?? 0;
        const unitPrice = Number(d.UNIT_PRICE || 0) * Number(d.CURRENCY_RATE || 1);
        return {
          ORDER_ITEM_ID: d.ORDER_ITEM_ID,
          QUANTITY_BILLED: qty,
          PRICE_BILLED: qty * unitPrice,
        };
      });

    if (details.length === 0) {
      message.warning('Pilih minimal satu item untuk ditagihkan');
      return;
    }
    if (!billedTo.trim()) {
      message.warning('Ditagihkan Ke wajib diisi');
      return;
    }

    setSubmitting(true);
    try {
      const invoiceStatus =
        amountPaid <= 0 ? 'UNPAID' : amountPaid >= totalAmount ? 'PAID' : 'PARTIAL';

      await apiClient.post('/api/invoices', {
        invoice: {
          INVOICE_NUMBER: invoiceNumber,
          INVOICE_DATE: invoiceDate ? invoiceDate.format('YYYY-MM-DD') : '',
          DUE_DATE: dueDate ? dueDate.format('YYYY-MM-DD') : '',
          TOTAL_AMOUNT: totalAmount,
          AMOUNT_PAID: amountPaid,
          INVOICE_STATUS: invoiceStatus,
          BILLED_TO: billedTo,
          BILLED_ADDRESS: billedAddress,
          BILLED_PHONE: billedPhone,
        },
        details,
      });

      message.success('Invoice berhasil dibuat');
      setJustCreated(true);
      resetSelectionForNextInvoice();
      await load(); // refresh sisa qty yang masih bisa ditagih
    } catch (err) {
      message.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!loading && !order) {
    return <Empty description="Transaksi tidak ditemukan" />;
  }

  return (
    <div>
      <Title level={3}>Buat Invoice — {orderId}</Title>
      {order && <Paragraph type="secondary">Pelanggan: {order.CUSTOMER_NAME}</Paragraph>}

      {justCreated && (
        <Alert
          type="success"
          showIcon
          closable={{
            onClose: () => setJustCreated(false)
          }}
          title="Invoice berhasil dibuat"
          description="Masih ada sisa item? Kamu bisa langsung buat invoice lain untuk transaksi yang sama di bawah, atau selesai."
          style={{ marginBottom: 16 }}
          action={
            <Button onClick={() => router.push('/admin/invoice')}>
              Selesai
            </Button>
          }
        />
      )}

      <Card title="Pilih Item & Qty yang Ditagihkan" style={{ marginBottom: 16 }}>
        <Table
          rowKey="ORDER_ITEM_ID"
          loading={loading}
          dataSource={order?.details ?? []}
          pagination={false}
          rowSelection={{
            selectedRowKeys: selectedKeys,
            onChange: (keys, rows) => {
              setSelectedKeys(keys);
              setQtyMap((prev) => {
                const next = { ...prev };
                rows.forEach((r) => {
                  if (next[r.ORDER_ITEM_ID] === undefined) {
                    next[r.ORDER_ITEM_ID] = r.remainingQty;
                  }
                });
                return next;
              });
            },
            getCheckboxProps: (record) => ({ disabled: record.remainingQty <= 0 }),
          }}
          columns={[
            { title: 'Item', dataIndex: 'ITEM_NAME' },
            { title: 'Qty Total', dataIndex: 'QUANTITY' },
            {
              title: 'Sudah Ditagih',
              dataIndex: 'billedQty',
              render: (v) => <Tag color={v > 0 ? 'blue' : 'default'}>{v}</Tag>,
            },
            {
              title: 'Sisa',
              dataIndex: 'remainingQty',
              render: (v) => <Tag color={v > 0 ? 'gold' : 'green'}>{v}</Tag>,
            },
            {
              title: 'Harga Satuan',
              key: 'unitPrice',
              render: (_, r) =>
                (Number(r.UNIT_PRICE || 0) * Number(r.CURRENCY_RATE || 1)).toLocaleString('id-ID'),
            },
            {
              title: 'Qty Ditagihkan',
              key: 'qtyBilled',
              render: (_, r) => (
                <InputNumber
                  min={1}
                  max={r.remainingQty}
                  disabled={!selectedKeys.includes(r.ORDER_ITEM_ID) || r.remainingQty <= 0}
                  value={qtyMap[r.ORDER_ITEM_ID] ?? r.remainingQty}
                  onChange={(v) =>
                    setQtyMap((prev) => ({ ...prev, [r.ORDER_ITEM_ID]: Number(v ?? 1) }))
                  }
                />
              ),
            },
          ]}
        />
      </Card>

      <Card title="Ditagihkan Ke" style={{ marginBottom: 16 }}>
        <Radio.Group
          value={billSource}
          onChange={(e) => setBillSource(e.target.value)}
          style={{ marginBottom: 16 }}
        >
          <Radio.Button value="CUSTOMER">Data Pelanggan</Radio.Button>
          <Radio.Button value="RECEIVER">Data Penerima</Radio.Button>
          <Radio.Button value="MANUAL">Input Manual</Radio.Button>
        </Radio.Group>
        <Space orientation="vertical" style={{ width: '100%' }}>
          <div>
            <Text>Ditagihkan Ke</Text>
            <Input
              value={billedTo}
              onChange={(e) => setBilledTo(e.target.value)}
              disabled={billSource !== 'MANUAL'}
            />
          </div>
          <div>
            <Text>Alamat Tagihan</Text>
            <Input.TextArea
              rows={2}
              value={billedAddress}
              onChange={(e) => setBilledAddress(e.target.value)}
              disabled={billSource !== 'MANUAL'}
            />
          </div>
          <div>
            <Text>Telepon Tagihan</Text>
            <Input
              value={billedPhone}
              onChange={(e) => setBilledPhone(e.target.value)}
              disabled={billSource !== 'MANUAL'}
            />
          </div>
        </Space>
      </Card>

      <Card title="Ringkasan Invoice" style={{ marginBottom: 16 }}>
        <Space orientation="vertical" style={{ width: '100%' }}>
          <div>
            <Text>Nomor Invoice</Text>
            <Input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
          </div>
          <Space wrap>
            <div>
              <Text>Tanggal Invoice</Text>
              <br />
              <DatePicker value={invoiceDate} onChange={(v) => v && setInvoiceDate(v)} />
            </div>
            <div>
              <Text>Jatuh Tempo</Text>
              <br />
              <DatePicker value={dueDate} onChange={setDueDate} />
            </div>
          </Space>
          <div>
            <Text>Total Tagihan</Text>
            <MoneyInput value={totalAmount} disabled />
          </div>
          <Checkbox checked={isPaidFull} onChange={(e) => setIsPaidFull(e.target.checked)}>
            Tandai lunas (dibayar penuh sesuai total tagihan)
          </Checkbox>
          <div>
            <Text>Sudah Dibayar</Text>
            <MoneyInput
              value={amountPaid}
              disabled={isPaidFull}
              max={totalAmount}
              onChange={(v) => setAmountPaid(Number(v ?? 0))}
            />
          </div>
        </Space>
      </Card>

      <Button type="primary" block loading={submitting} onClick={handleSubmit}>
        Buat Invoice
      </Button>
    </div>
  );
}