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

// Next available action for an assignment currently at a given delivery
// status. DELIVERED dan RETURNED keduanya terminal -- tidak ada aksi
// lanjutan (proses reschedule untuk RETURNED menyusul nanti).
const NEXT_ACTION: Record<string, { label: string; next: string }[]> = {
  PICKUP: [{ label: 'Mulai Antar (On Delivery)', next: 'ON DELIVERY' }],
  "ON DELIVERY": [
    { label: 'Sudah Terkirim (Delivered)', next: 'DELIVERED' },
    { label: 'Dikembalikan (Returned)', next: 'RETURNED' },
  ],
};

const STATUS_COLORS: Record<string, string> = {
  PICKUP: 'gold',
  "ON DELIVERY": 'blue',
  DELIVERED: 'green',
  RETURNED: 'red',
};

const fetcher = <T,>(url: string) => apiClient.get<T>(url);
const POLL_INTERVAL = 1000 * 60;
const PAGE_SIZE = 5;

// GET /api/delivery-assignments sekarang gabungan: "punya saya" (mine,
// tidak dipaginasi) + "tersedia" (available, dipaginasi lewat
// page/pageSize) dalam satu response -- lihat florist/page.tsx untuk pola
// yang sama.
type CombinedResponse = {
  mine: MyDeliveryAssignment[];
  available: { items: AvailableDeliveryItem[]; total: number };
  page: number;
  pageSize: number;
};

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
    data: pages,
    size,
    setSize,
    isLoading,
    isValidating,
    mutate,
  } = useSWRInfinite<CombinedResponse>(
    (pageIndex, previousPageData) => {
      if (previousPageData && pageIndex * PAGE_SIZE >= previousPageData.available.total) return null;
      return `/api/delivery-assignments?page=${pageIndex + 1}&pageSize=${PAGE_SIZE}`;
    },
    fetcher,
    {
      refreshInterval: POLL_INTERVAL,
      onSuccess: reset,
      revalidateFirstPage: true,
    }
  );

  const mine = pages?.[0]?.mine ?? [];

  const available = pages?.flatMap((p) => p.available.items) ?? [];
  const availTotal = pages?.[0]?.available.total ?? 0;
  const hasMoreAvail = available.length < availTotal;

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
      await mutate();
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
  //
  // Elemen <input> WAJIB di-attach ke document dulu sebelum .click() --
  // kalau dibiarkan lepas (detached), banyak WebView (termasuk Telegram
  // in-app browser) tidak mau fire event "change" sama sekali setelah user
  // pilih file, jadi kelihatannya "gak kejadian apa-apa" padahal file picker
  // sempat kebuka. Dibersihkan lagi dari DOM setelah dipakai.
  function advanceWithPhoto(assignment: MyDeliveryAssignment, deliveryStatus: string) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = false;
    input.style.position = 'fixed';
    input.style.top = '-1000px';
    input.style.left = '-1000px';
    document.body.appendChild(input);

    const cleanup = () => {
      input.remove();
    };

    input.addEventListener('change', () => {
      doAdvance(assignment, deliveryStatus, input.files);
      cleanup();
    });
    // Kalau user batal (tidak pilih file), sebagian besar browser tidak
    // fire "change" -- fallback ke "cancel" event (didukung Chrome/Safari
    // modern) supaya elemen tetap dibersihkan. Kalau tidak didukung, cleanup
    // di atas tetap jalan begitu user benar-benar pilih file.
    input.addEventListener('cancel', cleanup);

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
      await mutate();
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
      await mutate();
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
      <Title level={4}>Order Saya ({mine.length})</Title>
      <Space orientation="vertical" size={16} style={{ width: '100%', marginBottom: 24 }}>
        {mine.map((a) => {
          const actions = NEXT_ACTION[a.DELIVERY_STATUS] ?? [];
          return (
            <Card
              key={a.ASSIGNMENT_ID}
              loading={isLoading}
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
                  {/* Begitu udah mulai antar (lewat PICKUP), gak boleh
                      dilepas lagi -- kurir udah bawa barangnya. */}
                  {a.DELIVERY_STATUS === 'PICKUP' && (
                    <Popconfirm
                      title="Lepas item ini supaya bisa diambil kurir lain?"
                      onConfirm={() => releaseAssignment(a)}
                    >
                      <Button danger loading={busyKey === a.ASSIGNMENT_ID}>
                        Lepas
                      </Button>
                    </Popconfirm>
                  )}
                </Space>
              </Space>
            </Card>
          );
        })}
        {!isLoading && mine.length === 0 && <Empty description="Kamu belum mengambil order pengiriman apapun." />}
      </Space>

      <Divider />

      {/* ================= ORDER TERSEDIA ================= */}
      <Title level={4}>Order Tersedia ({availTotal})</Title>
      <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        {available.map((item) => (
          <Card
            key={item.ORDER_ITEM_ID}
            loading={isLoading}
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
        {!isLoading && available.length === 0 && <Empty description="Tidak ada order tersedia saat ini." />}
        {hasMoreAvail && (
          <Button block loading={isValidating} onClick={() => setSize(size + 1)}>
            Muat Lebih Banyak (sisa {availTotal - available.length})
          </Button>
        )}
      </Space>
    </div>
  );
}
