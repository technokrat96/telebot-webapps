'use client';

import {useEffect, useRef, useState} from 'react';
import {
  Button,
  Card,
  Space,
  Tag,
  Typography,
  Popconfirm,
  App,
  InputNumber,
  Progress,
  Empty,
  Divider,
  Tooltip,
} from 'antd';
import RoleGuard from '@/components/common/RoleGuard';
import ItemImageGallery from '@/components/common/ItemImageGallery';
import {apiClient} from '@/lib/apiClient';
import {AvailableDeliveryItem, MyDeliveryAssignment} from '@/types';
import useSWRInfinite from 'swr/infinite';

const { Title, Text, Paragraph } = Typography;

// Next available action for an assignment currently at a given delivery status.
const NEXT_ACTION: Record<string, { label: string; next: string }[]> = {
  PICKUP: [{ label: 'Mulai Antar (On Delivery)', next: 'ON DELIVERY' }],
  "ON DELIVERY": [
    { label: 'Sudah Terkirim (Delivered)', next: 'DELIVERED' },
    { label: 'Dikembalikan (Returned)', next: 'RETURNED' },
  ],
  DELIVERED: [{ label: 'Diterima Pelanggan (Received)', next: 'RECEIVED' }],
};

const STATUS_COLORS: Record<string, string> = {
  PICKUP: 'gold',
  "ON DELIVERY": 'blue',
  DELIVERED: 'cyan',
  RECEIVED: 'green',
  RETURNED: 'red',
};

const fetcher = <T,>(url: string) => apiClient.get<T>(url);
const POLL_INTERVAL = 1000 * 60;
const PAGE_SIZE = 5;

type AvailableResponse = { items: AvailableDeliveryItem[]; total: number };
type MineResponse = { assignments: MyDeliveryAssignment[]; total: number };

export default function KurirPage() {
  return (
    <RoleGuard allow={['KURIR']}>
      <KurirContent />
    </RoleGuard>
  );
}

function usePollingProgress(intervalMs: number) {
  const [progress, setProgress] = useState(0);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (startRef.current === null) {
      startRef.current = Date.now();
    }
    const tick = setInterval(() => {
      const elapsed = Date.now() - (startRef.current ?? Date.now());
      setProgress(Math.min(100, (elapsed / intervalMs) * 100));
    }, 100);
    return () => clearInterval(tick);
  }, [intervalMs]);

  function reset() {
    startRef.current = Date.now();
    setProgress(0);
  }

  return { progress, reset };
}

function KurirContent() {
  const { message } = App.useApp();
  const { progress, reset } = usePollingProgress(POLL_INTERVAL);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [qtyInput, setQtyInput] = useState<Record<string, number>>({});

  const {
    data: availPages,
    size: availSize,
    setSize: setAvailSize,
    isLoading: availLoading,
    isValidating: availValidating,
    mutate: mutateAvail,
  } = useSWRInfinite<AvailableResponse>(
    (pageIndex, previousPageData) => {
      if (previousPageData && pageIndex * PAGE_SIZE >= previousPageData.total) return null;
      return `/api/delivery-assignments/available?page=${pageIndex + 1}&pageSize=${PAGE_SIZE}`;
    },
    fetcher,
    {
      refreshInterval: POLL_INTERVAL,
      onSuccess: reset,
      revalidateFirstPage: false,
    }
  );

  const {
    data: minePages,
    size: mineSize,
    setSize: setMineSize,
    isLoading: mineLoading,
    isValidating: mineValidating,
    mutate: mutateMine,
  } = useSWRInfinite<MineResponse>(
    (pageIndex, previousPageData) => {
      if (previousPageData && pageIndex * PAGE_SIZE >= previousPageData.total) return null;
      return `/api/delivery-assignments?page=${pageIndex + 1}&pageSize=${PAGE_SIZE}`;
    },
    fetcher,
    {
      refreshInterval: POLL_INTERVAL,
      revalidateFirstPage: false,
    }
  );

  const available = availPages?.flatMap((p) => p.items) ?? [];
  const availTotal = availPages?.[0]?.total ?? 0;
  const hasMoreAvail = available.length < availTotal;

  const mine = minePages?.flatMap((p) => p.assignments) ?? [];
  const mineTotal = minePages?.[0]?.total ?? 0;
  const hasMoreMine = mine.length < mineTotal;

  async function claimItem(item: AvailableDeliveryItem) {
    const qty = qtyInput[item.ORDER_ITEM_ID] ?? item.remainingQty;
    setBusyKey(item.ORDER_ITEM_ID);
    try {
      await apiClient.post('/api/delivery-assignments', {
        orderItemId: item.ORDER_ITEM_ID,
        orderId: item.ORDER_ID,
        quantity: qty,
      });
      message.success(`Berhasil ambil ${qty} dari "${item.ITEM_NAME}"`);
      await mutateAvail();
      await mutateMine();
    } catch (err) {
      message.error((err as Error).message);
    } finally {
      setBusyKey(null);
    }
  }

  // Foto bukti WAJIB di setiap perubahan status: klik tombol aksi -> buka
  // file picker dulu (cuma boleh 1 foto) -> baru upload & kirim advance
  // sekaligus dengan foto barunya. Tidak ada jalan untuk ganti status tanpa
  // foto (juga dijaga di server, lihat advanceAssignmentDeliveryStatus di
  // deliveryDriverAssignment.ts).
  function advanceWithPhoto(assignment: MyDeliveryAssignment, deliveryStatus: string) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = false;
    input.onchange = () => doAdvance(assignment, deliveryStatus, input.files);
    input.click();
  }

  async function doAdvance(assignment: MyDeliveryAssignment, deliveryStatus: string, files: FileList | null) {
    const file = files?.[0];
    if (!file) {
      message.warning('Foto bukti wajib diupload sebelum ganti status');
      return;
    }
    setBusyKey(assignment.ASSIGNMENT_ID);
    try {
      const { url } = await apiClient.uploadFile('/api/upload', file);
      await apiClient.patch(`/api/delivery-assignments/${assignment.ASSIGNMENT_ID}/advance`, {
        deliveryStatus,
        imageUrls: [url],
      });
      message.success(`Status diubah ke ${deliveryStatus}`);
      await mutateMine();
    } catch (err) {
      message.error((err as Error).message);
    } finally {
      setBusyKey(null);
    }
  }

  async function releaseAssignment(assignment: MyDeliveryAssignment) {
    setBusyKey(assignment.ASSIGNMENT_ID);
    try {
      await apiClient.patch(`/api/delivery-assignments/${assignment.ASSIGNMENT_ID}/release`, {});
      message.success('Item dilepas, bisa diambil kurir lain');
      await mutateAvail();
      await mutateMine();
    } catch (err) {
      message.error((err as Error).message);
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={3} style={{ margin: 0 }}>Pengiriman</Title>
        <Tooltip title="Waktu sampai refresh data berikutnya" placement="bottomRight">
          <Progress type="circle" percent={progress} size={28} showInfo={false} />
        </Tooltip>
      </div>
      <Paragraph type="secondary">
        Pilih item yang mau kamu antar. Kalau qty sebagian sudah diambil kurir lain, kamu bisa ambil sisanya.
        Setiap ganti status wajib upload foto bukti dulu.
      </Paragraph>

      {/* ================= ORDER SAYA ================= */}
      <Title level={4}>Order Saya ({mineTotal})</Title>
      <Space orientation="vertical" size={16} style={{ width: '100%', marginBottom: 24 }}>
        {mine.map((a) => {
          const actions = NEXT_ACTION[a.DELIVERY_STATUS] ?? [];
          return (
            <Card
              key={a.ASSIGNMENT_ID}
              loading={mineLoading}
              title={`${a.ORDER_ID} · ${a.item?.CUSTOMER_NAME}`}
            >
              <Space orientation="vertical" size={4} style={{ width: '100%' }}>
                <Text strong>{a.item?.ITEM_NAME}</Text>
                <Space wrap>
                  <Tag color="blue">Qty diambil: {a.QUANTITY_ASSIGNED}</Tag>
                  <Tag color={STATUS_COLORS[a.DELIVERY_STATUS] ?? 'default'}>{a.DELIVERY_STATUS}</Tag>
                </Space>
                <Text>Penerima: {a.item?.RECEIVER_NAME}</Text>
                <Text>Alamat: {a.item?.RECEIVER_ADDRESS}</Text>
                <Text>Telepon: {a.item?.RECEIVER_PHONE}</Text>
                <ItemImageGallery urls={a.IMAGE_URLS} />
                <Space wrap>
                  {actions.map((action) => (
                    <Button
                      key={action.next}
                      type="primary"
                      loading={busyKey === a.ASSIGNMENT_ID}
                      onClick={() => advanceWithPhoto(a, action.next)}
                    >
                      {action.label} (upload foto)
                    </Button>
                  ))}
                  <Popconfirm
                    title="Lepas item ini supaya bisa diambil kurir lain?"
                    onConfirm={() => releaseAssignment(a)}
                  >
                    <Button danger loading={busyKey === a.ASSIGNMENT_ID}>
                      Lepas
                    </Button>
                  </Popconfirm>
                </Space>
              </Space>
            </Card>
          );
        })}
        {!mineLoading && mine.length === 0 && <Empty description="Kamu belum mengambil order pengiriman apapun." />}
        {hasMoreMine && (
          <Button block loading={mineValidating} onClick={() => setMineSize(mineSize + 1)}>
            Muat Lebih Banyak (sisa {mineTotal - mine.length})
          </Button>
        )}
      </Space>

      <Divider />

      {/* ================= ORDER TERSEDIA ================= */}
      <Title level={4}>Order Tersedia ({availTotal})</Title>
      <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        {available.map((item) => (
          <Card
            key={item.ORDER_ITEM_ID}
            loading={availLoading}
            title={`${item.ORDER_ID} · ${item.CUSTOMER_NAME}`}
          >
            <Space orientation="vertical" size={4} style={{ width: '100%' }}>
              <Text strong>{item.ITEM_NAME}</Text>
              <Text>Alamat: {item.RECEIVER_ADDRESS}</Text>
              <Text>Telepon: {item.RECEIVER_PHONE}</Text>
              <Progress
                percent={Math.round(((item.totalQty - item.remainingQty) / item.totalQty) * 100)}
                format={() => `${item.totalQty - item.remainingQty}/${item.totalQty} diambil`}
              />
              <Space wrap>
                <Text>Ambil qty:</Text>
                <InputNumber
                  min={1}
                  max={item.remainingQty}
                  defaultValue={item.remainingQty}
                  onChange={(v) =>
                    setQtyInput((prev) => ({ ...prev, [item.ORDER_ITEM_ID]: Number(v ?? 1) }))
                  }
                />
                <Text type="secondary">(sisa {item.remainingQty})</Text>
                <Button type="primary" loading={busyKey === item.ORDER_ITEM_ID} onClick={() => claimItem(item)}>
                  Ambil Item Ini
                </Button>
              </Space>
            </Space>
          </Card>
        ))}
        {!availLoading && available.length === 0 && <Empty description="Tidak ada order tersedia saat ini." />}
        {hasMoreAvail && (
          <Button block loading={availValidating} onClick={() => setAvailSize(availSize + 1)}>
            Muat Lebih Banyak (sisa {availTotal - available.length})
          </Button>
        )}
      </Space>
    </div>
  );
}
