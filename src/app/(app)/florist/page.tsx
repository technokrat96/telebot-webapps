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
  Tooltip
} from 'antd';
import RoleGuard from '@/components/common/RoleGuard';
import ItemImageGallery from '@/components/common/ItemImageGallery';
import { useAuth } from '@/components/common/AuthProvider';
import { apiClient } from '@/lib/apiClient';
import { AvailableFloristItem, MyFloristAssignment } from '@/types';
import useSWRInfinite from 'swr/infinite';

const { Title, Text, Paragraph } = Typography;

const fetcher = <T,>(url: string) => apiClient.get<T>(url);
const POLL_INTERVAL = 1000 * 60;
const PAGE_SIZE = 5;

// GET /api/florist-assignments sekarang gabungan: "punya saya" (mine, tidak
// dipaginasi) + "tersedia" (available, dipaginasi lewat page/pageSize)
// dalam satu response. Cuma "available" yang butuh infinite-scroll, jadi
// cuma itu yang dijadiin key useSWRInfinite -- "mine" cukup diambil dari
// halaman pertama yang sudah ke-load (isinya sama di semua halaman).
type CombinedResponse = {
  mine: MyFloristAssignment[];
  available: { items: AvailableFloristItem[]; total: number };
  page: number;
  pageSize: number;
};

export default function FloristPage() {
  return (
    <RoleGuard allow={['FLORIST']}>
      <FloristContent />
    </RoleGuard>
  );
}

function usePollingProgress(intervalMs: number) {
  const [progress, setProgress] = useState(0);
  const startRef = useRef<number | null>(null); // null dulu, bukan Date.now()

  useEffect(() => {
    // Set nilai awal di sini (dalam efek = boleh, karena ini side effect,
    // bukan proses render murni)
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
    startRef.current = Date.now(); // ini dipanggil dari event handler/callback (onSuccess), bukan saat render, jadi aman
    setProgress(0);
  }

  return { progress, reset };
}

function FloristContent() {
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
      return `/api/florist-assignments?page=${pageIndex + 1}&pageSize=${PAGE_SIZE}`;
    },
    fetcher,
    {
      refreshInterval: POLL_INTERVAL,
      onSuccess: reset, // progress balik ke 0 tiap kali fetch sukses
      revalidateFirstPage: true,
    }
  );

  const mine = pages?.[0]?.mine ?? [];

  const available = pages?.flatMap((p) => p.available.items) ?? [];
  const availTotal = pages?.[0]?.available.total ?? 0;
  const hasMoreAvail = available.length < availTotal;

  async function claimItem(item: AvailableFloristItem) {
    const qty = qtyInput[item.ORDER_ITEM_ID] ?? item.remainingQty;
    setBusyKey(item.ORDER_ITEM_ID);
    try {
      await apiClient.post('/api/florist-assignments', {
        orderItemId: item.ORDER_ITEM_ID,
        orderId: item.ORDER_ID,
        quantity: qty,
      });
      message.success(`Berhasil ambil ${qty} dari "${item.ITEM_NAME}"`);
      await mutate(); // <-- refresh instan, jangan tunggu polling
    } catch (err) {
      message.error((err as Error).message);
    } finally {
      setBusyKey(null);
    }
  }

  async function completeAssignment(assignment: MyFloristAssignment) {
    setBusyKey(assignment.ASSIGNMENT_ID);
    try {
      await apiClient.patch(`/api/florist-assignments/${assignment.ASSIGNMENT_ID}/complete`, {});
      message.success('Pekerjaan ditandai selesai');
      await mutate(); // <-- refresh instan, jangan tunggu polling
    } catch (err) {
      message.error((err as Error).message);
    } finally {
      setBusyKey(null);
    }
  }

  async function releaseAssignment(assignment: MyFloristAssignment) {
    setBusyKey(assignment.ASSIGNMENT_ID);
    try {
      await apiClient.patch(`/api/florist-assignments/${assignment.ASSIGNMENT_ID}/release`, {});
      message.success('Item dilepas, bisa diambil florist lain');
      await mutate(); // <-- refresh instan, jangan tunggu polling
    } catch (err) {
      message.error((err as Error).message);
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={3} style={{ margin: 0 }}>Pekerjaan Florist</Title>
        <Tooltip title="Waktu sampai refresh data berikutnya" placement={"bottomRight"}>
          <Progress
            type="circle"
            percent={progress}
            size={28}
            showInfo={false}
          />
        </Tooltip>
      </div>
      <Paragraph type="secondary">
        Pilih item yang mau kamu kerjakan. Kalau qty sebagian sudah diambil florist lain, kamu bisa ambil sisanya.
      </Paragraph>

      {/* ================= PEKERJAAN SAYA ================= */}
      <Title level={4}>Pekerjaan Saya ({mine.length})</Title>
      <Space orientation="vertical" size={16} style={{ width: '100%', marginBottom: 24 }}>
        {mine.map((a) => (
          <Card
            key={a.ASSIGNMENT_ID}
            loading={isLoading}
            title={`${a.ORDER_ID} · ${a.item?.CUSTOMER_NAME}`}
          >
            <Space orientation="vertical" size={4} style={{ width: '100%' }}>
              <Text strong>{a.item?.ITEM_NAME}</Text>
              <Tag color="blue">Qty diambil: {a.QUANTITY_ASSIGNED}</Tag>
              <ItemImageGallery urls={a.item?.IMAGE_URLS}/>
              {a.item?.CUSTOM_NOTES && <Text type="secondary">Catatan: {a.item.CUSTOM_NOTES}</Text>}
              <Space wrap>
                <Popconfirm title="Tandai bagian ini selesai?" onConfirm={() => completeAssignment(a)}>
                  <Button type="primary" loading={busyKey === a.ASSIGNMENT_ID}>
                    Selesai (DONE)
                  </Button>
                </Popconfirm>
                <Popconfirm
                  title="Lepas item ini supaya bisa diambil florist lain?"
                  onConfirm={() => releaseAssignment(a)}
                >
                  <Button danger loading={busyKey === a.ASSIGNMENT_ID}>
                    Lepas
                  </Button>
                </Popconfirm>
              </Space>
            </Space>
          </Card>
        ))}
        {!isLoading && mine.length === 0 && <Empty description="Kamu belum mengambil pekerjaan apapun." />}
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
              <ItemImageGallery urls={item.IMAGE_URLS}/>
              {item.CUSTOM_NOTES && <Text type="secondary">Catatan: {item.CUSTOM_NOTES}</Text>}
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
          <Button
            block
            loading={isValidating}
            onClick={() => setSize(size + 1)}
          >
            Muat Lebih Banyak (sisa {availTotal - available.length})
          </Button>
        )}
      </Space>
    </div>
  );
}
