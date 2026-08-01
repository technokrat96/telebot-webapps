'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  App,
  Button,
  Card,
  Descriptions,
  Divider,
  Empty,
  GetProp,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import RoleGuard from '@/components/common/RoleGuard';
import ItemImageGallery from '@/components/common/ItemImageGallery';
import { apiClient } from '@/lib/apiClient';
import {
  DeliveryDriverAssignment,
  FloristAssignment,
  TransactionDetailWithAssignments,
  TransactionWithDetailsAndAssignments,
} from '@/types';
import useSWR from 'swr';

const { Title, Text } = Typography;

const fetcher = <T,>(url: string) => apiClient.get<T>(url);

const STATUS_COLORS: Record<string, GetProp<typeof Tag, 'color'>> = {
  'NEW ORDER': 'default',
  'WORK IN PROGRESS': 'processing',
  'READY TO PICKUP': 'blue',
  'ON DELIVERY': 'gold',
  DONE: 'success',
  CANCELLED: 'red',
  PENDING: 'cyan',
  RESCHEDULED: 'gold',
};

const ASSIGNMENT_STATUS_LABELS: Record<string, string> = {
  ASSIGNED: 'Diproses',
  COMPLETED: 'Selesai',
  RELEASED: 'Dilepas',
};

const ASSIGNMENT_STATUS_COLORS: Record<string, GetProp<typeof Tag, 'color'>> = {
  ASSIGNED: 'processing',
  COMPLETED: 'success',
  RELEASED: 'default',
};

const DELIVERY_STATUS_COLORS: Record<string, GetProp<typeof Tag, 'color'>> = {
  PICKUP: 'gold',
  'ON DELIVERY': 'blue',
  DELIVERED: 'green',
  RETURNED: 'red',
};

/**
 * Foto bukti kurir (DeliveryDriverAssignment.IMAGE_URLS) ditambahkan tepat 1
 * per perubahan status (lihat advanceAssignmentDeliveryStatus di
 * deliveryDriverAssignment.ts), dengan urutan yang deterministik mengikuti
 * alur PICKUP -> ON DELIVERY -> DELIVERED/RETURNED. Jadi foto pertama di
 * array selalu bukti "ON DELIVERY", foto kedua (kalau ada) selalu bukti
 * status terminal-nya -- dipakai buat kasih label per foto di bawah.
 */
function deliveryPhotoLabels(deliveryStatus: string): string[] {
  const labels = ['ON DELIVERY'];
  if (deliveryStatus === 'DELIVERED' || deliveryStatus === 'RETURNED') {
    labels.push(deliveryStatus);
  }
  return labels;
}

function KurirProofPhotos({ assignment }: { assignment: DeliveryDriverAssignment }) {
  if (!assignment.IMAGE_URLS || assignment.IMAGE_URLS.length === 0) return null;

  const labels = deliveryPhotoLabels(assignment.DELIVERY_STATUS);

  return (
    <Space wrap size={12} style={{ marginTop: 4 }}>
      {assignment.IMAGE_URLS.map((url, idx) => (
        <Space key={url} orientation="vertical" size={2} align="center">
          <Tag color={DELIVERY_STATUS_COLORS[labels[idx]] ?? 'default'} style={{ margin: 0 }}>
            {labels[idx] ?? 'Foto'}
          </Tag>
          <ItemImageGallery urls={[url]} />
        </Space>
      ))}
    </Space>
  );
}

type StaffUser = { username: string; name: string };

type AssignTarget = {
  role: 'FLORIST' | 'KURIR';
  item: TransactionDetailWithAssignments;
} | null;

export default function AdminTransactionDetailPage() {
  return (
    <RoleGuard allow={['ADMIN']}>
      <TransactionDetailContent />
    </RoleGuard>
  );
}

function remainingQty(item: TransactionDetailWithAssignments, kind: 'FLORIST' | 'KURIR') {
  const list = kind === 'FLORIST' ? item.assignments : item.deliveryAssignments;
  const claimed = list
    .filter((a) => a.STATUS !== 'RELEASED')
    .reduce((sum, a) => sum + Number(a.QUANTITY_ASSIGNED || 0), 0);
  return Math.max(0, Number(item.QUANTITY || 0) - claimed);
}

function TransactionDetailContent() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { message } = App.useApp();
  const [assignTarget, setAssignTarget] = useState<AssignTarget>(null);
  const [assignUser, setAssignUser] = useState<string | undefined>(undefined);
  const [assignQty, setAssignQty] = useState<number>(1);
  const [submitting, setSubmitting] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const {
    data,
    isLoading,
    mutate,
  } = useSWR<{ transaction: TransactionWithDetailsAndAssignments }>(
    `/api/transactions/${id}`,
    fetcher
  );

  const { data: floristUsers } = useSWR<{ users: StaffUser[] }>(
    '/api/users/by-role?role=FLORIST',
    fetcher
  );
  const { data: kurirUsers } = useSWR<{ users: StaffUser[] }>(
    '/api/users/by-role?role=KURIR',
    fetcher
  );

  const transaction = data?.transaction;

  // Sama kayak hasDeliveryPastPickup di TransactionCardList.tsx -- begitu
  // ada kurir aktif yang udah lewat PICKUP (ON DELIVERY/DELIVERED/
  // RETURNED), transaksi ini gak boleh diubah lagi.
  const hasDeliveryPastPickup =
    transaction?.details.some((d) =>
      d.deliveryAssignments.some((a) => a.STATUS !== 'RELEASED' && a.DELIVERY_STATUS !== 'PICKUP')
    ) ?? false;

  function openAssignModal(role: 'FLORIST' | 'KURIR', item: TransactionDetailWithAssignments) {
    setAssignTarget({ role, item });
    setAssignUser(undefined);
    setAssignQty(remainingQty(item, role));
  }

  function closeAssignModal() {
    setAssignTarget(null);
  }

  async function submitAssign() {
    if (!assignTarget || !assignUser) return;
    const { role, item } = assignTarget;
    setSubmitting(true);
    try {
      const url = role === 'FLORIST' ? '/api/florist-assignments' : '/api/delivery-assignments';
      await apiClient.post(url, {
        orderItemId: item.ORDER_ITEM_ID,
        orderId: item.ORDER_ID,
        quantity: assignQty,
        targetUsername: assignUser,
      });
      message.success(`Berhasil assign ${role === 'FLORIST' ? 'florist' : 'kurir'}`);
      closeAssignModal();
      await mutate();
    } catch (err) {
      message.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function releaseFloristAssignment(a: FloristAssignment) {
    setBusyKey(a.ASSIGNMENT_ID);
    try {
      await apiClient.patch(`/api/florist-assignments/${a.ASSIGNMENT_ID}/release`, {});
      message.success('Assignment florist dilepas');
      await mutate();
    } catch (err) {
      message.error((err as Error).message);
    } finally {
      setBusyKey(null);
    }
  }

  async function releaseDeliveryAssignment(a: DeliveryDriverAssignment) {
    setBusyKey(a.ASSIGNMENT_ID);
    try {
      await apiClient.patch(`/api/delivery-assignments/${a.ASSIGNMENT_ID}/release`, {});
      message.success('Assignment kurir dilepas');
      await mutate();
    } catch (err) {
      message.error((err as Error).message);
    } finally {
      setBusyKey(null);
    }
  }

  if (!isLoading && !transaction) {
    return <Empty description="Transaksi tidak ditemukan" />;
  }

  const floristOptions = (floristUsers?.users ?? []).map((u) => ({
    label: `${u.name} (@${u.username})`,
    value: u.username,
  }));
  const kurirOptions = (kurirUsers?.users ?? []).map((u) => ({
    label: `${u.name} (@${u.username})`,
    value: u.username,
  }));

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>Detail Transaksi {id}</Title>
        <Space>
          <Button onClick={() => router.push('/admin/transaction')}>Kembali</Button>
          {!hasDeliveryPastPickup && (
            <Button type="primary" onClick={() => router.push(`/admin/transaction/${id}/edit`)}>
              Ubah Transaksi
            </Button>
          )}
        </Space>
      </div>

      <Card loading={isLoading} title="Informasi Transaksi" style={{ marginBottom: 16 }}>
        {transaction && (
          <Descriptions column={2} bordered>
            <Descriptions.Item label="Order ID">{transaction.ORDER_ID}</Descriptions.Item>
            <Descriptions.Item label="Sumber Order">{transaction.ORDER_SOURCE || '-'}</Descriptions.Item>
            <Descriptions.Item label="Sales">{transaction.SALES_NAME || '-'}</Descriptions.Item>
            <Descriptions.Item label="Metode Bayar">{transaction.PAYMENT_METHOD || '-'}</Descriptions.Item>
            <Descriptions.Item label="Pelanggan">{transaction.CUSTOMER_NAME}</Descriptions.Item>
            <Descriptions.Item label="Telepon">{transaction.CUSTOMER_PHONE || '-'}</Descriptions.Item>
            <Descriptions.Item label="Alamat" span={2}>{transaction.CUSTOMER_ADDRESS || '-'}</Descriptions.Item>
            <Descriptions.Item label="Email">{transaction.CUSTOMER_EMAIL || '-'}</Descriptions.Item>
            <Descriptions.Item label="Grand Total">
              {(transaction.GRAND_TOTAL || 0).toLocaleString('id-ID')}
            </Descriptions.Item>
            <Descriptions.Item label="Down Payment">
              {(transaction.DOWN_PAYMENT || 0).toLocaleString('id-ID')}
            </Descriptions.Item>
            <Descriptions.Item label="Sisa Bayar">
              {(transaction.REMAINING_BALANCE || 0).toLocaleString('id-ID')}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Card>

      <Title level={4}>Item Pesanan</Title>
      <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        {transaction?.details.map((item) => {
          const activeFlorist = item.assignments.filter((a) => a.STATUS !== 'RELEASED');
          const activeKurir = item.deliveryAssignments.filter((a) => a.STATUS !== 'RELEASED');
          const canAssignFlorist = remainingQty(item, 'FLORIST') > 0;
          const canAssignKurir = item.ITEM_STATUS === 'READY TO PICKUP';

          return (
            <Card
              key={item.ORDER_ITEM_ID}
              title={
                <Space wrap>
                  <Text strong>{item.ITEM_NAME}</Text>
                  <Tag color={STATUS_COLORS[item.ITEM_STATUS] ?? 'default'}>{item.ITEM_STATUS}</Tag>
                </Space>
              }
            >
              <Space orientation="vertical" size={4} style={{ width: '100%' }}>
                <Text>Qty: {item.QUANTITY} · Harga satuan: {(item.UNIT_PRICE || 0).toLocaleString('id-ID')} · Subtotal: {(item.SUBTOTAL || 0).toLocaleString('id-ID')}</Text>
                {item.CUSTOM_NOTES && <Text type="secondary">Catatan: {item.CUSTOM_NOTES}</Text>}
                <ItemImageGallery urls={item.IMAGE_URLS} />
                {(item.CARD_TO || item.CARD_MESSAGE) && (
                  <Space orientation="vertical" size={0}>
                    {item.CARD_TO && <Text>Kartu untuk: {item.CARD_TO}</Text>}
                    {item.CARD_MESSAGE && <Text type="secondary">Pesan: {item.CARD_MESSAGE}</Text>}
                  </Space>
                )}
                {item.RECEIVER_NAME && (
                  <Text type="secondary">
                    Penerima: {item.RECEIVER_NAME} · {item.RECEIVER_ADDRESS} · {item.RECEIVER_PHONE}
                  </Text>
                )}
              </Space>

              <Divider style={{ margin: '12px 0' }} />

              <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 260 }}>
                  <Space align="center" style={{ marginBottom: 8 }}>
                    <Text strong>Florist</Text>
                    <Tooltip title={canAssignFlorist ? '' : 'Qty item ini sudah habis diambil florist'}>
                      <Button
                        type="primary"
                        disabled={!canAssignFlorist}
                        onClick={() => openAssignModal('FLORIST', item)}
                      >
                        Assign Florist
                      </Button>
                    </Tooltip>
                  </Space>
                  <div>
                    {activeFlorist.length === 0 && <Empty description="Belum ada florist" />}
                    <Space orientation="vertical" size={4} style={{ width: '100%' }}>
                      {activeFlorist.map((a) => (
                        <Space key={a.ASSIGNMENT_ID} size={4} wrap>
                          <Tag color={ASSIGNMENT_STATUS_COLORS[a.STATUS] ?? 'default'}>
                            {ASSIGNMENT_STATUS_LABELS[a.STATUS] ?? a.STATUS}
                          </Tag>
                          <Text>{a.FLORIST_NAME} · qty {a.QUANTITY_ASSIGNED}</Text>
                          {/* Begitu udah ada kurir yang ambil item ini,
                              assignment florist-nya gak boleh dilepas lagi
                              -- barangnya udah dipegang kurir. */}
                          {activeKurir.length === 0 && (
                            <Popconfirm title="Lepas assignment ini?" onConfirm={() => releaseFloristAssignment(a)}>
                              <Button danger loading={busyKey === a.ASSIGNMENT_ID}>
                                Lepas
                              </Button>
                            </Popconfirm>
                          )}
                        </Space>
                      ))}
                    </Space>
                  </div>
                </div>

                <div style={{ flex: 1, minWidth: 260 }}>
                  <Space align="center" style={{ marginBottom: 8 }}>
                    <Text strong>Kurir</Text>
                    <Tooltip title={canAssignKurir ? '' : 'Item harus berstatus READY TO PICKUP dulu sebelum bisa di-assign ke kurir'}>
                      <Button
                        type="primary"
                        disabled={!canAssignKurir}
                        onClick={() => openAssignModal('KURIR', item)}
                      >
                        Assign Kurir
                      </Button>
                    </Tooltip>
                  </Space>
                  <div>
                    {activeKurir.length === 0 && <Empty description="Belum ada kurir" />}
                    <Space orientation="vertical" size={4} style={{ width: '100%' }}>
                      {activeKurir.map((a) => (
                        <div key={a.ASSIGNMENT_ID}>
                          <Space size={4} wrap>
                            <Tag color={ASSIGNMENT_STATUS_COLORS[a.STATUS] ?? 'default'}>
                              {a.DELIVERY_STATUS || ASSIGNMENT_STATUS_LABELS[a.STATUS] || a.STATUS}
                            </Tag>
                            <Text>{a.DELIVERY_DRIVER_NAME} · qty {a.QUANTITY_ASSIGNED}</Text>
                            {/* Begitu udah mulai antar (lewat PICKUP), gak
                                boleh dilepas lagi -- kurir udah bawa barangnya. */}
                            {a.DELIVERY_STATUS === 'PICKUP' && (
                              <Popconfirm title="Lepas assignment ini?" onConfirm={() => releaseDeliveryAssignment(a)}>
                                <Button danger loading={busyKey === a.ASSIGNMENT_ID}>
                                  Lepas
                                </Button>
                              </Popconfirm>
                            )}
                          </Space>
                          <KurirProofPhotos assignment={a} />
                        </div>
                      ))}
                    </Space>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
        {transaction && transaction.details.length === 0 && <Empty description="Tidak ada item" />}
      </Space>

      <Modal
        title={assignTarget?.role === 'FLORIST' ? 'Assign Florist' : 'Assign Kurir'}
        open={!!assignTarget}
        onCancel={closeAssignModal}
        onOk={submitAssign}
        confirmLoading={submitting}
        okButtonProps={{ disabled: !assignUser || assignQty < 1 }}
      >
        {assignTarget && (
          <Space orientation="vertical" size={12} style={{ width: '100%' }}>
            <Text>Item: {assignTarget.item.ITEM_NAME}</Text>
            <div>
              <Text>Pilih {assignTarget.role === 'FLORIST' ? 'florist' : 'kurir'}:</Text>
              <Select
                style={{ width: '100%', marginTop: 4 }}
                placeholder="Pilih user"
                showSearch={{optionFilterProp:"label"}}
                options={assignTarget.role === 'FLORIST' ? floristOptions : kurirOptions}
                value={assignUser}
                onChange={(v) => setAssignUser(v)}
              />
            </div>
            <div>
              <Text>Qty (sisa {remainingQty(assignTarget.item, assignTarget.role)}):</Text>
              <InputNumber
                style={{ width: '100%', marginTop: 4 }}
                min={1}
                max={remainingQty(assignTarget.item, assignTarget.role)}
                value={assignQty}
                onChange={(v) => setAssignQty(Number(v ?? 1))}
              />
            </div>
          </Space>
        )}
      </Modal>
    </div>
  );
}
