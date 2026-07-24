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
import { useTelegramAuth } from '@/components/common/TelegramProvider';
import { apiClient } from '@/lib/apiClient';
import { AvailableFloristItem, MyFloristAssignment } from '@/types';
import useSWR from "swr";

const { Title, Text, Paragraph } = Typography;

const fetcher = <T,>(url: string) => apiClient.get<T>(url);
const POLL_INTERVAL = 1000 * 5;

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
  const { name } = useTelegramAuth();
  const { message } = App.useApp();
  const { progress, reset } = usePollingProgress(POLL_INTERVAL);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [qtyInput, setQtyInput] = useState<Record<string, number>>({});

  const { data: availRes, mutate: mutateAvail } = useSWR<{ items: AvailableFloristItem[] }>(
    '/api/florist-assignments/available',
    fetcher,
    {
      refreshInterval: POLL_INTERVAL,
      onSuccess: reset, // progress balik ke 0 tiap kali fetch sukses
    }
  );
  const { data: mineRes, mutate: mutateMine } = useSWR<{ assignments: MyFloristAssignment[] }>(
    '/api/florist-assignments',
    fetcher,
    {
      refreshInterval: POLL_INTERVAL,
    }
  );

  const available = availRes?.items ?? [];
  const mine = mineRes?.assignments ?? [];

  async function load() {
    setLoading(true);
    try {
      const [availRes, mineRes] = await Promise.all([
        apiClient.get<{ items: AvailableFloristItem[] }>('/api/florist-assignments/available'),
        apiClient.get<{ assignments: MyFloristAssignment[] }>('/api/florist-assignments'),
      ]);
      mutateAvail();
      mutateMine();
    } catch (err) {
      message.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

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
      await mutateAvail();  // <-- refresh instan, jangan tunggu polling
      await mutateMine();
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
      await mutateAvail();  // <-- refresh instan, jangan tunggu polling
      await mutateMine();
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
      await mutateAvail();  // <-- refresh instan, jangan tunggu polling
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
            loading={loading}
            title={`${a.ORDER_ID} · ${a.item?.CUSTOMER_NAME}`}
          >
            <Space orientation="vertical" size={4} style={{ width: '100%' }}>
              <Text strong>{a.item?.ITEM_NAME}</Text>
              <Tag color="blue">Qty diambil: {a.QUANTITY_ASSIGNED}</Tag>
              {a.item?.CUSTOM_NOTES && <Text type="secondary">Catatan: {a.item.CUSTOM_NOTES}</Text>}
              {a.item?.CARD_TO && <Text type="secondary">Kartu untuk: {a.item.CARD_TO}</Text>}
              {a.item?.CARD_MESSAGE && <Text type="secondary">Pesan: {a.item.CARD_MESSAGE}</Text>}
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
        {!loading && mine.length === 0 && <Empty description="Kamu belum mengambil pekerjaan apapun." />}
      </Space>

      <Divider />

      {/* ================= ORDER TERSEDIA ================= */}
      <Title level={4}>Order Tersedia ({available.length})</Title>
      <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        {available.map((item) => (
          <Card
            key={item.ORDER_ITEM_ID}
            loading={loading}
            title={`${item.ORDER_ID} · ${item.CUSTOMER_NAME}`}
          >
            <Space orientation="vertical" size={4} style={{ width: '100%' }}>
              <Text strong>{item.ITEM_NAME}</Text>
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
        {!loading && available.length === 0 && <Empty description="Tidak ada order tersedia saat ini." />}
      </Space>
    </div>
  );
}